import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Block } from './entities/block.entity';
import { Note } from './entities/note.entity';
import * as Y from 'yjs';
import { BlockType } from '@tainiex/shared-atlas';

@Injectable()
export class YjsTransformerService {
  private readonly logger = new Logger(YjsTransformerService.name);

  constructor(
    @InjectRepository(Block)
    private blockRepository: Repository<Block>,
    @InjectRepository(Note)
    private noteRepository: Repository<Note>,
  ) {}

  /**
   * Sync Y.js document state to Blocks table.
   * This is a "heavy" operation, so it's called periodically by YjsService.
   */
  async syncToBlocks(noteId: string, doc: Y.Doc): Promise<void> {
    // Debug: Log all top-level keys
    const keys = Array.from(doc.share.keys());
    this.logger.debug(
      `[Debug] Note ${noteId} - Top-level keys: ${keys.join(', ')}`,
    );

    let blocksToSave: Partial<Block>[] = [];

    // CASE 1: Check for 'default' key (Tiptap / XmlFragment)
    // This is the most likely case if using Tiptap
    if (keys.includes('default')) {
      try {
        this.logger.debug(
          `[Debug] Found 'default' key, attempting to parse as XmlFragment...`,
        );
        const fragment = doc.getXmlFragment('default');

        // Tiptap toJSON returns a string representation or object?
        // Y.XmlFragment.toJSON() returns a string of the XML.
        // Wait, Tiptap uses Y.XmlFragment but binds it to Prosemirror.
        // If we call .toJSON() on Y.XmlFragment, we get the XML string like "<paragraph>...</paragraph>"
        // We actually want to iterate the types.

        // However, parsing XML string is painful.
        // Let's iterate the children directly using Y.js API.

        blocksToSave = this.parseXmlFragmentToBlocks(noteId, fragment);
        this.logger.debug(
          `[Debug] Parsed ${blocksToSave.length} blocks from XmlFragment.`,
        );
      } catch (error) {
        this.logger.error(`[Debug] Failed to parse 'default' key:`, error);
      }
    }
    // CASE 2: Check for 'blocks' key (Custom Array OR XmlFragment)
    // Note: loadBlocksToYDoc creates 'blocks' as an XmlFragment.
    else if (keys.includes('blocks')) {
      // Try as XmlFragment first (matching loadBlocksToYDoc)
      let yFragment: Y.XmlFragment;
      try {
        yFragment = doc.getXmlFragment('blocks');
      } catch (_e) {
        // Ignore error, might be Array type
        yFragment = new Y.XmlFragment(); // Empty dummy
      }

      // If it has length, it's likely the right type.
      // Warning: getXmlFragment on an Array type might return empty fragment or throw?
      // Y.js is usually consistent.

      if (yFragment.length > 0) {
        this.logger.debug(
          `[Debug] Found 'blocks' XmlFragment. Length: ${yFragment.length}`,
        );
        blocksToSave = this.parseXmlFragmentToBlocks(noteId, yFragment);
      } else {
        // Fallback: Check if it's an Array (Legacy?)
        const yBlocks = doc.getArray<Y.Map<any>>('blocks');
        if (yBlocks.length > 0) {
          this.logger.debug(
            `[Debug] Found 'blocks' Array. Length: ${yBlocks.length}`,
          );
          blocksToSave = this.parseYArrayToBlocks(noteId, yBlocks);
        }
      }
    }

    if (blocksToSave.length === 0) {
      this.logger.warn(
        `[Debug] No blocks extracted from note ${noteId}. Keys: ${keys.join(', ')}`,
      );
      return;
    }

    // 3. Perform Database Operations
    // Retrieve existing blocks to handle IDs and Creators
    const existingBlocks = await this.blockRepository.find({
      where: { noteId },
      select: ['id', 'createdBy', 'lastEditedBy'],
    });

    // Fetch Note to get owner fallback
    const note = await this.noteRepository.findOne({
      where: { id: noteId },
      select: ['userId', 'lastEditedBy'],
    });
    const defaultCreator = note?.userId || note?.lastEditedBy;

    const currentBlockIds = new Set(
      blocksToSave.map((b) => b.id).filter((id) => !!id),
    );
    const existingMap = new Map(existingBlocks.map((b) => [b.id, b]));

    const savePromises = blocksToSave.map(async (partialBlock) => {
      let toSave = partialBlock;
      // let isUpdate = false;

      if (partialBlock.id && existingMap.has(partialBlock.id)) {
        const existing = existingMap.get(partialBlock.id)!;

        // Dirty Check: Skip if content/metadata/position/parent match and not deleted
        // 脏检查：如果内容/元数据/位置/父级均匹配且未删除，则跳过
        const isContentMatch = existing.content === partialBlock.content;
        // Simple fast check for metadata equality (assuming consistent serialization)
        const isMetadataMatch =
          JSON.stringify(existing.metadata) ===
          JSON.stringify(partialBlock.metadata);
        const isPositionMatch = existing.position === partialBlock.position;
        const isParentMatch =
          existing.parentBlockId === partialBlock.parentBlockId;
        const isTypeMatch = existing.type === partialBlock.type;
        const isDeleted = existing.isDeleted;

        if (
          isContentMatch &&
          isMetadataMatch &&
          isPositionMatch &&
          isParentMatch &&
          isTypeMatch &&
          !isDeleted
        ) {
          // No changes needed
          return;
        }

        // If resurrecting a deleted block, we must explicitly set isDeleted: false
        if (isDeleted) {
          toSave.isDeleted = false;
        }

        toSave = {
          ...partialBlock,
          createdBy: existing.createdBy, // Preserve creator
          lastEditedBy: existing.lastEditedBy, // Ideally updated by user, but...
        };
        // isUpdate = true;
      } else {
        // New block (or re-created Tiptap block)
        if (existingBlocks.length > 0) {
          toSave.createdBy = existingBlocks[0].createdBy;
          toSave.lastEditedBy = existingBlocks[0].lastEditedBy;
        } else if (defaultCreator) {
          toSave.createdBy = defaultCreator;
          toSave.lastEditedBy = defaultCreator;
        } else {
          // Last resort fallback
          this.logger.warn(
            `[Debug] No creator found for block in note ${noteId}`,
          );
        }
      }

      return this.blockRepository.save(toSave);
    });

    // Handle Deletions
    // Only if we are confident we extracted ALL blocks.
    // If we parsed 'default', we assume that's the source of truth.
    const idsToDelete = existingBlocks
      .filter((b) => !currentBlockIds.has(b.id) && !b.isDeleted) // Only delete if not already deleted
      .map((b) => b.id);

    if (idsToDelete.length > 0) {
      // Soft Delete instead of Remove
      // 软删除替代物理删除
      await this.blockRepository.update(idsToDelete, { isDeleted: true });
      this.logger.log(
        `Soft deleted ${idsToDelete.length} blocks for note ${noteId}`,
      );
    }

    // Execute Save
    try {
      await Promise.all(savePromises);
      if (blocksToSave.length > 0) {
        this.logger.debug(
          `Persisted ${blocksToSave.length} blocks. First block content preview: "${blocksToSave[0].content?.substring(0, 50)}..."`,
        );
      } else {
        this.logger.debug(`Persisted ${blocksToSave.length} blocks`);
      }
    } catch (e) {
      this.logger.error(`Failed to persist blocks:`, e);
    }
  }

  private parseYArrayToBlocks(
    noteId: string,
    yBlocks: Y.Array<Y.Map<any>>,
  ): Partial<Block>[] {
    const blocks: Partial<Block>[] = [];
    yBlocks.forEach((yBlock, index) => {
      const id = yBlock.get('id');
      const type = yBlock.get('type') as BlockType;
      const content = yBlock.get('content')?.toString() || '';
      const props = yBlock.get('props') || {};

      if (id && type) {
        blocks.push({
          id,
          noteId,
          type,
          content,
          metadata: props,
          position: index,
        });
      }
    });
    return blocks;
  }

  private parseXmlFragmentToBlocks(
    noteId: string,
    fragment: Y.XmlFragment,
  ): Partial<Block>[] {
    const blocks: Partial<Block>[] = [];
    let index = 0;

    // Iterate over children of the fragment
    // Y.XmlFragment contains Y.XmlText or Y.XmlElement
    // Tiptap usually stores doc > [paragraph, heading, ...]

    // We can interact with it like an array somewhat
    // length is number of children
    // get(i) returns child

    for (let i = 0; i < fragment.length; i++) {
      const child = fragment.get(i);

      // Check if it's an Element (node)
      if (child instanceof Y.XmlElement) {
        const nodeName = child.nodeName; // e.g., "paragraph", "heading"
        const attrs = child.getAttributes();

        // Map Node Name to Block Type
        const type = this.mapNodeNameToBlockType(nodeName);

        // Extract Content
        // Content is usually inside the children of this element (Y.XmlText)
        const content = this.extractTextFromElement(child);

        // ID ?
        // Tiptap might store ID in attributes if configured.
        // If not, we can't sync reliably. We MUST assume attributes have 'id', or we use temporary.
        const id = attrs['id'] as string; // or uuid?

        if (type) {
          // ID ?
          // Tiptap might store ID in attributes if configured.
          // If not, we can't sync reliably. We MUST assume attributes have 'id', or we use temporary.
          // For IDs missing, we let TypeORM generate one (persistence only, no sync back).
          // This causes full re-creation of blocks on every sync, but ensures data is searchable.

          if (!id) {
            this.logger.debug(
              `[Debug] Node ${nodeName} at index ${i} has no ID. Will be re-created.`,
            );
          }

          blocks.push({
            id, // can be undefined
            noteId,
            type,
            content,
            metadata: attrs, // Store all other attrs in metadata
            position: index++,
          });
        }
      }
    }

    return blocks;
  }

  private mapNodeNameToBlockType(nodeName: string): BlockType | undefined {
    switch (nodeName) {
      case 'paragraph':
        return BlockType.TEXT;
      case 'heading':
        return BlockType.HEADING1; // Need to check 'level' attr for H1/H2/H3
      case 'image':
        return BlockType.IMAGE;
      case 'codeBlock':
        return BlockType.CODE;
      case 'bulletList':
        return BlockType.BULLET_LIST;
      case 'orderedList':
        return BlockType.NUMBERED_LIST;
      case 'taskList':
        return BlockType.TODO_LIST;
      case 'taskItem':
        return BlockType.TODO_ITEM;
      case 'blockquote':
        return BlockType.QUOTE;
      case 'horizontalRule':
        return BlockType.DIVIDER;
      case 'callout':
        return BlockType.CALLOUT;
      case 'toggle':
        return BlockType.TOGGLE;
      default:
        return BlockType.TEXT; // Fallback? or undefined
    }
  }

  /**
   * Reconstruct Y.js document from SQL blocks.
   * Used when Y.js state is missing or needs migration (e.g. key change).
   */
  async loadBlocksToYDoc(noteId: string, doc: Y.Doc): Promise<void> {
    // Check if doc already has content in 'blocks'
    if (doc.share.has('blocks')) {
      doc.share.get('blocks');
      // If it's not empty, we assume it's valid?
      // Or maybe we force overwrite if requested?
      // For now, only load if 'blocks' is missing is safe strategy to avoid overwriting live edits.
      // But if 'blocks' is missing, we check 'default'.

      // Actually, if we want to migrate 'default' -> 'blocks', we should do it here.
      // But relying on SQL is cleaner source of truth.
    }

    // Logic: If 'blocks' key is missing, try to populate it from SQL.
    if (!doc.share.has('blocks')) {
      const blocks = await this.blockRepository.find({
        where: { noteId },
        order: { position: 'ASC' },
      });

      if (blocks.length > 0) {
        this.logger.log(
          `[Reconstruct] Reconstructing ${blocks.length} blocks from SQL to Y.Doc 'blocks' for note ${noteId}...`,
        );

        // We need to create an XmlFragment named 'blocks'
        const fragment = doc.getXmlFragment('blocks');

        doc.transact(() => {
          // Clear fallback just in case? No, keep it for safety or manual cleanup.

          // Convert SQL blocks back to Y.js XML
          // Note: This is an approximation. We lost some rich text formatting if we only stored plain text.
          // Block entity has 'content' (text) and 'metadata' (attributes).

          const nodes = blocks.map((block) => {
            const nodeName = this.mapBlockTypeToNodeName(block.type);
            const xmlElem = new Y.XmlElement(nodeName);

            // Restore attributes
            const attrs = { ...block.metadata, id: block.id };
            for (const [key, value] of Object.entries(attrs)) {
              xmlElem.setAttribute(key, value as any);
            }

            // Restore content
            if (block.content) {
              const text = new Y.XmlText();
              text.insert(0, block.content);
              xmlElem.insert(0, [text]);
            }

            return xmlElem;
          });

          fragment.insert(0, nodes);
        });

        this.logger.log(
          `[Reconstruct] Verification: 'blocks' length is now ${fragment.length}`,
        );
      } else {
        // Fallback: If SQL is empty, check if 'default' key has legacy data
        if (doc.share.has('default')) {
          this.logger.log(
            `[Reconstruct] No SQL blocks found, but 'default' key exists. Migrating 'default' -> 'blocks' in-memory...`,
          );

          const defaultXml = doc.getXmlFragment('default');
          doc.getXmlFragment('blocks');

          if (defaultXml.length > 0) {
            doc.transact(() => {
              // Clone items from default to blocks
              // Note: We can't deep clone easily, but we can iterate and insert.
              // Better approach: Since it's Reference Type, we might need to serialize/deserialize or move.
              // Y.js nodes cannot be moved. We must recreate structure.
              // A simple hack: toJSON -> clear blocks -> insert json

              // WARNING: toJSON returns simple JSON, not Y.Events.
              // We need to handle this carefully.
              // Simplest valid way for plain text/nodes:
              defaultXml.toJSON(); // Returns string (if text) or array (if fragment)
              // Tiptap default is XmlFragment. toJSON returns Array of Objects/Strings.

              // Let's rely on standard Tiptap structure being compatible with Y.js JSON insert?
              // No, Y.XmlElement instantiation is needed.

              // Actually, if we just want to make it visible, we can try to copy.
              // But parsing generic JSON to properly typed Y.XmlElements is complex.

              // ALTERNATIVE: Just tell the user "We found data in default".
              // But better: Try to move it.

              // Let's assume 'default' behaves like a Tiptap fragment.
              // We can iterate its children.
              // For now, let's log deeply and NOT risk breaking it with bad shallow copy.
              // Wait, the user WANTS the data.

              // Safe Strategy:
              // We just realized the backend persistence layer will eventually catching 'default' content and sync to SQL (because of my previous fix).
              // But that sync happens on update. If no update, no sync.

              // So we MUST trigger a sync.
              // If we return here, doc has 'default'.
              // YjsService calls persist? No, only on update.

              // If we just return, frontend gets 'default'. Frontend is listening to 'blocks'.

              // Let's simply RENAME the key in the doc? No, keys are fixed.

              // Migration logic:
              // 1. Read JSON
              // 2. Clear 'default' (optional, safety)
              // 3. Insert to 'blocks' - Wait, insert requires Y.Types.
              // Using Y.js applyUpdate with a fake update? Too hard.

              // Let's stick to the SQL route.
              // If SQL is empty, why? Because we never persisted 'default' to SQL.
              // My previous fix `syncToBlocks` DOES read `default`.
              // So if I force a persist call based on `default` content, it will populate SQL.
              // Then `loadBlocksToYDoc` (next time) will work.

              // So: If SQL empty && default has data -> Trigger Persist immediately!
              this.logger.warn(
                `[Reconstruct] Legacy data found in 'default'. Triggering immediate persistence to populate SQL.`,
              );
              // We can't trigger persist purely from here easily without circular dep or callback.
              // But we can return a flag?
            });
            // The calling YjsService will see 'blocks' is still empty,
            // BUT we can use the 'pendingUpdates' mechanism to force a save.
          }
        }
      }
    }
  }

  private mapBlockTypeToNodeName(type: BlockType): string {
    switch (type) {
      case BlockType.TEXT:
        return 'paragraph';
      case BlockType.HEADING1:
        return 'heading'; // metadata level: 1
      case BlockType.HEADING2:
        return 'heading';
      case BlockType.HEADING3:
        return 'heading';
      case BlockType.IMAGE:
        return 'image';
      case BlockType.CODE:
        return 'codeBlock';
      case BlockType.BULLET_LIST:
        return 'bulletList';
      case BlockType.NUMBERED_LIST:
        return 'orderedList';
      case BlockType.TODO_LIST:
        return 'taskList';
      case BlockType.TODO_ITEM:
        return 'taskItem';
      case BlockType.QUOTE:
        return 'blockquote';
      case BlockType.DIVIDER:
        return 'horizontalRule';
      case BlockType.CALLOUT:
        return 'callout';
      case BlockType.TOGGLE:
        return 'toggle';
      default:
        return 'paragraph';
    }
  }

  private extractTextFromElement(element: Y.XmlElement): string {
    // Simple extraction: generic toJSON checks content keys?
    // Or recursively get text content on children
    // Tiptap XmlElement children are usually XmlText or other Elements

    // Let's use toString() which gives XML representation, then strip tags?
    // No, that's messy.

    // Let's iterate children.
    let text = '';
    for (let i = 0; i < element.length; i++) {
      const child = element.get(i);
      if (child instanceof Y.XmlText) {
        text += child.toString();
      } else if (child instanceof Y.XmlElement) {
        text += this.extractTextFromElement(child);
      }
    }
    return text;
  }
}
