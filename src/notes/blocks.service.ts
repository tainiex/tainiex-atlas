import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Block } from './entities/block.entity';
import { BlockVersion } from './entities/block-version.entity';
import {
  CreateBlockDto,
  UpdateBlockDto,
  MoveBlockDto,
  IBlock,
} from '@tainiex/shared-atlas';
import { NotesService } from './notes.service';

/**
 * BlocksService - handles block operations.
 * BlocksService - 处理块操作。
 */
@Injectable()
export class BlocksService {
  constructor(
    @InjectRepository(Block)
    private blockRepository: Repository<Block>,
    @InjectRepository(BlockVersion)
    private blockVersionRepository: Repository<BlockVersion>,
    private notesService: NotesService,
  ) {}

  /**
   * Create a new block.
   * 创建新块。
   */
  async create(
    noteId: string,
    userId: string,
    createBlockDto: CreateBlockDto,
  ): Promise<Block> {
    // Check permission
    const canEdit = await this.notesService.canEdit(noteId, userId);
    if (!canEdit) {
      throw new ForbiddenException('Cannot edit this note');
    }

    // Determine position
    let position = createBlockDto.position;
    if (position === undefined) {
      // Add to end
      const maxPosition = await this.blockRepository
        .createQueryBuilder('block')
        .select('MAX(block.position)', 'max')
        .where('block.noteId = :noteId', { noteId })
        .andWhere(
          'block.parentBlockId IS NULL OR block.parentBlockId = :parentBlockId',
          {
            parentBlockId: createBlockDto.parentBlockId || null,
          },
        )

        .getRawOne<{ max: number }>();

      position = (maxPosition?.max ?? -1) + 1;
    }

    const block = this.blockRepository.create({
      noteId,
      type: createBlockDto.type,
      content: createBlockDto.content,
      metadata: (createBlockDto.metadata || {}) as Record<string, any>,
      parentBlockId: createBlockDto.parentBlockId,
      position,
      createdBy: userId,
      lastEditedBy: userId,
    });

    const savedBlock = await this.blockRepository.save(block);

    // Create initial version
    await this.createVersion(savedBlock.id, userId, 'created');

    return savedBlock;
  }

  /**
   * Find all blocks for a note (tree structure).
   * 查询笔记的所有块（树状结构）。
   */
  async findByNote(noteId: string, userId: string): Promise<IBlock[]> {
    // Check permission
    const canAccess = await this.notesService.canAccess(noteId, userId);
    if (!canAccess) {
      throw new ForbiddenException('Cannot access this note');
    }

    const blocks = await this.blockRepository.find({
      where: { noteId, isDeleted: false },
      order: { position: 'ASC' },
    });

    // Build tree structure
    return this.buildTree(blocks);
  }

  /**
   * Update a block.
   * 更新块。
   */
  async update(
    id: string,
    userId: string,
    updateBlockDto: UpdateBlockDto,
  ): Promise<Block> {
    const block = await this.blockRepository.findOne({ where: { id } });
    if (!block) {
      throw new NotFoundException('Block not found');
    }

    // Check permission
    const canEdit = await this.notesService.canEdit(block.noteId, userId);
    if (!canEdit) {
      throw new ForbiddenException('Cannot edit this note');
    }

    // Create version before update (every 10 updates creates a full snapshot)
    const versionCount = await this.blockVersionRepository.count({
      where: { blockId: id },
    });
    const isSnapshotVersion = versionCount % 10 === 0;
    await this.createVersion(id, userId, 'updated', !isSnapshotVersion);

    if (updateBlockDto.content !== undefined) {
      block.content = updateBlockDto.content;
    }
    if (updateBlockDto.metadata !== undefined) {
      block.metadata = updateBlockDto.metadata as Record<string, any>;
    }

    block.lastEditedBy = userId;
    block.updatedAt = new Date();

    return this.blockRepository.save(block);
  }

  /**
   * Delete a block.
   * 删除块。
   */
  async delete(id: string, userId: string): Promise<void> {
    const block = await this.blockRepository.findOne({ where: { id } });
    if (!block) {
      throw new NotFoundException('Block not found');
    }

    // Check permission
    const canEdit = await this.notesService.canEdit(block.noteId, userId);
    if (!canEdit) {
      throw new ForbiddenException('Cannot edit this note');
    }

    // Create deletion version
    await this.createVersion(id, userId, 'deleted');

    // Soft Delete
    // 软删除
    block.isDeleted = true;
    await this.blockRepository.save(block);

    // Note: Children handling in Soft Delete?
    // Currently we leave them as orphans or let UI handle it.
    // Ideally should cascade soft delete, but for now we keep simple logic.
    // await this.blockRepository.remove(block);
  }

  /**
   * Move a block to a new position.
   * 移动块到新位置。
   */
  async move(
    id: string,
    userId: string,
    moveBlockDto: MoveBlockDto,
  ): Promise<Block> {
    const block = await this.blockRepository.findOne({ where: { id } });
    if (!block) {
      throw new NotFoundException('Block not found');
    }

    // Check permission
    const canEdit = await this.notesService.canEdit(block.noteId, userId);
    if (!canEdit) {
      throw new ForbiddenException('Cannot edit this note');
    }

    // Update position and parent
    block.position = moveBlockDto.position;
    if (moveBlockDto.parentBlockId !== undefined) {
      block.parentBlockId = moveBlockDto.parentBlockId;
    }
    block.lastEditedBy = userId;

    return this.blockRepository.save(block);
  }

  /**
   * Create a block version.
   * 创建块版本。
   */
  private async createVersion(
    blockId: string,
    userId: string,
    changeType: 'created' | 'updated' | 'deleted',
    useDiff: boolean = false,
  ): Promise<void> {
    const block = await this.blockRepository.findOne({
      where: { id: blockId },
    });
    if (!block) return;

    const versionNumber =
      (await this.blockVersionRepository.count({
        where: { blockId },
      })) + 1;

    let diff: any = undefined;
    let content: string | undefined = block.content;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    let metadata: Record<string, any> | undefined = block.metadata;

    if (useDiff) {
      // Get previous version to calculate diff
      const previousVersion = await this.blockVersionRepository.findOne({
        where: { blockId },
        order: { versionNumber: 'DESC' },
      });

      if (previousVersion) {
        // Simple diff: store only what changed
        const contentChanged = block.content !== previousVersion.content;
        const metadataChanged =
          JSON.stringify(block.metadata) !==
          JSON.stringify(previousVersion.metadata);

        if (contentChanged || metadataChanged) {
          diff = {
            content: contentChanged ? block.content : undefined,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            metadata: metadataChanged ? block.metadata : undefined,
          };
        }
        // When using diff, don't store full content/metadata
        content = undefined;
        metadata = undefined;
      }
    }

    const version = this.blockVersionRepository.create({
      blockId,
      versionNumber,
      content,

      metadata,
      changeType,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      diff,
      createdBy: userId,
    });

    await this.blockVersionRepository.save(version);
  }

  /**
   * Build tree structure from flat block list.
   * 从扁平块列表构建树状结构。
   */
  private buildTree(blocks: Block[]): IBlock[] {
    const blockMap = new Map<string, IBlock>();
    const rootBlocks: IBlock[] = [];

    // First pass: create map
    blocks.forEach((block) => {
      blockMap.set(block.id, {
        ...block,
        children: [],
      });
    });

    // Second pass: build tree
    blocks.forEach((block) => {
      const node = blockMap.get(block.id)!;
      if (block.parentBlockId) {
        const parent = blockMap.get(block.parentBlockId);
        if (parent) {
          parent.children!.push(node);
        } else {
          // Parent not found, treat as root
          rootBlocks.push(node);
        }
      } else {
        rootBlocks.push(node);
      }
    });

    return rootBlocks;
  }
}
