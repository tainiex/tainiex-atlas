import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentState } from './entities/document-state.entity';
import { YjsTransformerService } from './yjs-transformer.service';
import * as Y from 'yjs';
import { LoggerService } from '../common/logger/logger.service';

/**
 * YjsService - manages Y.js document states for collaborative editing.
 * YjsService - 管理Y.js文档状态用于协同编辑。
 *
 * Key responsibilities / 核心职责:
 * 1. Create and load Y.js documents / 创建和加载Y.js文档
 * 2. Apply updates from clients / 应用来自客户端的更新
 * 3. Persist state to database / 持久化状态到数据库
 * 4. Sync state vectors / 同步状态向量
 */
@Injectable()
export class YjsService {
  // In-memory Y.js documents cache
  // 内存中的Y.js文档缓存
  private documents = new Map<string, Y.Doc>();

  // Track pending updates for batch persistence
  // 跟踪待持久化的更新（批量写入）
  private pendingUpdates = new Map<
    string,
    { doc: Y.Doc; updateCount: number }
  >();

  // Batch persistence configuration
  // 批量持久化配置
  private readonly BATCH_SIZE = 100; // Max updates before forcing persist
  private readonly BATCH_INTERVAL = 5000; // 5 seconds

  constructor(
    @InjectRepository(DocumentState)
    private documentStateRepository: Repository<DocumentState>,
    private yjsTransformerService: YjsTransformerService,
    private logger: LoggerService,
  ) {
    this.logger.setContext(YjsService.name);
    // Start periodic persistence
    // 启动定期持久化
    setInterval(() => {
      void this.persistPendingUpdates();
    }, this.BATCH_INTERVAL);
  }

  /**
   * Get or create a Y.js document for a note.
   * 获取或创建笔记的Y.js文档。
   */
  async getDocument(noteId: string): Promise<Y.Doc> {
    // Check in-memory cache
    let doc = this.documents.get(noteId);

    if (doc) {
      console.log(
        `[YjsService] getDocument: Returning CACHED doc for ${noteId}`,
      );
      return doc;
    }

    // Load from database
    const state = await this.documentStateRepository.findOne({
      where: { noteId },
    });

    doc = new Y.Doc();

    if (state && state.documentState) {
      // Restore document state
      console.log(
        `[YjsService] getDocument: Loaded from DB state for ${noteId}, size: ${state.documentState.length}`,
      );
      Y.applyUpdate(doc, state.documentState);
    } else {
      console.log(
        `[YjsService] getDocument: No DB state found for ${noteId}, creating new empty doc`,
      );
    }

    // AUTO-REPAIR / MIGRATION:
    // If Y.js doc is missing 'blocks' key (e.g. old data in 'default', or empty),
    // try to reconstruct it from SQL Blocks (source of truth).
    const hasBlocks = doc.share.has('blocks');
    if (!hasBlocks) {
      console.log(
        `[YjsService] Note ${noteId} missing 'blocks' key. Attempting reconstruction from SQL...`,
      );
      await this.yjsTransformerService.loadBlocksToYDoc(noteId, doc);

      // Check again
      const hasBlocksAfter = doc.share.has('blocks');

      // Fallback: If SQL was empty, but we have 'default' key (Legacy Data)
      if (!hasBlocksAfter && doc.share.has('default')) {
        console.log(
          `[YjsService] Note ${noteId} has legacy 'default' content but no 'blocks'. helping migration...`,
        );

        // 1. Sync 'default' -> SQL
        await this.yjsTransformerService.syncToBlocks(noteId, doc);

        // 2. Re-load SQL -> 'blocks'
        await this.yjsTransformerService.loadBlocksToYDoc(noteId, doc);
        console.log(
          `[YjsService] Legacy migration finished. Blocks populated: ${doc.share.has('blocks')}`,
        );
      }

      // If we reconstructed (or migrated), we should persist this converted state back to document_states immediately?
      // Or let the periodic saver handle it.
      // Let's force a persist trigger effectively.
      if (doc.share.has('blocks')) {
        this.pendingUpdates.set(noteId, { doc, updateCount: 1 });
      }
    }

    // Cache in memory
    this.documents.set(noteId, doc);

    return doc;
  }

  /**
   * Apply an update from a client.
   * 应用来自客户端的更新。
   *
   * @param noteId Note ID
   * @param update Y.js update (Uint8Array)
   * @returns The update to broadcast to other clients
   */
  async applyUpdate(noteId: string, update: Uint8Array): Promise<Uint8Array> {
    const doc = await this.getDocument(noteId);

    // Apply the update to the document
    Y.applyUpdate(doc, update);

    // Track for batched persistence
    const pending = this.pendingUpdates.get(noteId);
    if (pending) {
      pending.updateCount++;
      if (pending.updateCount >= this.BATCH_SIZE) {
        // Force persist if batch size reached
        await this.persistDocument(noteId, doc);
        this.pendingUpdates.delete(noteId);
      }
    } else {
      this.pendingUpdates.set(noteId, { doc, updateCount: 1 });
    }

    return update;
  }

  /**
   * Get the state vector for a note (for sync).
   * 获取笔记的状态向量（用于同步）。
   */
  async getStateVector(noteId: string): Promise<Uint8Array> {
    const doc = await this.getDocument(noteId);
    return Y.encodeStateVector(doc);
  }

  /**
   * Get the state as update (for initial sync).
   * 获取状态更新（用于初始同步）。
   */
  async getStateAsUpdate(
    noteId: string,
    stateVector?: Uint8Array,
  ): Promise<Uint8Array> {
    const doc = await this.getDocument(noteId);

    if (stateVector) {
      return Y.encodeStateAsUpdate(doc, stateVector);
    }

    return Y.encodeStateAsUpdate(doc);
  }

  /**
   * Persist a document to the database.
   * 持久化文档到数据库。
   */
  private async persistDocument(noteId: string, doc: Y.Doc): Promise<void> {
    this.logger.log(`[Debug] persistDocument called for note: ${noteId}`);
    const documentState = Y.encodeStateAsUpdate(doc);
    const stateVector = Y.encodeStateVector(doc);

    await this.documentStateRepository.upsert(
      {
        noteId,
        documentState: Buffer.from(documentState),
        stateVector: Buffer.from(stateVector),
      },
      ['noteId'],
    );

    // Sync to Blocks table
    // 同步到Blocks表
    try {
      await this.yjsTransformerService.syncToBlocks(noteId, doc);
    } catch (error) {
      console.error(
        `[YjsService] Failed to sync blocks for note ${noteId}:`,
        error,
      );
    }

    this.logger.log(
      `[YjsService] Persisted document state for note: ${noteId}`,
    );
  }

  /**
   * Persist all pending updates (called periodically).
   * 持久化所有待处理的更新（定期调用）。
   */
  private async persistPendingUpdates(): Promise<void> {
    if (this.pendingUpdates.size === 0) {
      return;
    }

    const updates = Array.from(this.pendingUpdates.entries());
    this.pendingUpdates.clear();

    for (const [noteId, { doc }] of updates) {
      try {
        await this.persistDocument(noteId, doc);
      } catch (error) {
        console.error(
          `[YjsService] Failed to persist document ${noteId}:`,
          error,
        );
        // Re-queue for next batch
        this.pendingUpdates.set(noteId, { doc, updateCount: 0 });
      }
    }
  }

  /**
   * Destroy a document (free memory).
   * 销毁文档（释放内存）。
   */
  async destroyDocument(noteId: string): Promise<void> {
    const doc = this.documents.get(noteId);

    if (doc) {
      // Persist before destroying
      await this.persistDocument(noteId, doc);
      doc.destroy();
      this.documents.delete(noteId);
    }

    this.pendingUpdates.delete(noteId);
  }

  /**
   * Get number of active documents in memory.
   * 获取内存中活跃文档的数量。
   */
  getActiveDocumentCount(): number {
    return this.documents.size;
  }
}
