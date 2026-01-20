import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Block } from './entities/block.entity';
import { BlockVersion } from './entities/block-version.entity';
import { Note } from './entities/note.entity';
import { NoteSnapshot } from './entities/note-snapshot.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LoggerService } from '../common/logger/logger.service';

/**
 * VersionsService - handles version control, history, and snapshots.
 * VersionsService - 处理版本控制、历史记录和快照。
 */
@Injectable()
export class VersionsService {
  constructor(
    @InjectRepository(Block)
    private blockRepository: Repository<Block>,
    @InjectRepository(BlockVersion)
    private blockVersionRepository: Repository<BlockVersion>,
    @InjectRepository(Note)
    private noteRepository: Repository<Note>,
    @InjectRepository(NoteSnapshot)
    private noteSnapshotRepository: Repository<NoteSnapshot>,
    private logger: LoggerService,
  ) {
    this.logger.setContext(VersionsService.name);
  }

  /**
   * Get history of a specific block.
   * 获取特定块的历史记录。
   */
  async getBlockHistory(
    blockId: string,
    limit: number = 20,
  ): Promise<BlockVersion[]> {
    return this.blockVersionRepository.find({
      where: { blockId },
      order: { versionNumber: 'DESC' },
      take: limit,
    });
  }

  /**
   * Restore a block to a specific version.
   * 将块回滚到特定版本。
   */
  async rollbackBlock(
    blockId: string,
    versionId: string,
    userId: string,
  ): Promise<Block> {
    const version = await this.blockVersionRepository.findOne({
      where: { id: versionId, blockId },
    });

    if (!version) {
      throw new NotFoundException('Version not found');
    }

    const block = await this.blockRepository.findOne({
      where: { id: blockId },
    });
    if (!block) {
      throw new NotFoundException('Block not found');
    }

    // Restore content and metadata
    // If it was a diff version, we might need to reconstruct the state (simplified here for now)
    if (version.content !== null) {
      block.content = version.content;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      block.metadata = version.metadata;
    } else if (version.diff) {
      // Reconstruct from diff (this is a simple implementation)
      // In a real production system, you'd iterate back to the last full snapshot
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (version.diff.content !== undefined)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
        block.content = version.diff.content;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (version.diff.metadata !== undefined)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
        block.metadata = version.diff.metadata;
    }

    block.lastEditedBy = userId;
    block.updatedAt = new Date();

    return this.blockRepository.save(block);
  }

  /**
   * Create a full snapshot for a note.
   * 为笔记创建全量快照。
   */
  async createNoteSnapshot(noteId: string): Promise<NoteSnapshot> {
    const note = await this.noteRepository.findOne({ where: { id: noteId } });
    if (!note) throw new NotFoundException('Note not found');

    const blocks = await this.blockRepository.find({
      where: { noteId },
      order: { position: 'ASC' },
    });

    const snapshot = this.noteSnapshotRepository.create({
      noteId,
      snapshotData: {
        title: note.title,
        icon: note.icon,
        coverImage: note.coverImage,
        blocks: blocks.map((b) => ({
          id: b.id,
          type: b.type,
          content: b.content,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          metadata: b.metadata,
          parentBlockId: b.parentBlockId,
          position: b.position,
        })),
      },
    });

    return this.noteSnapshotRepository.save(snapshot);
  }

  /**
   * Scheduled task to create daily snapshots for modified notes.
   * 定时任务：为当天有变动的笔记创建全量快照。
   * Executed daily at 3 AM.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleDailySnapshots() {
    this.logger.log('[VersionsService] Starting daily smart snapshots...');

    // Find notes updated in the last 24 hours that don't have a snapshot today
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const notesToSnapshot = await this.noteRepository
      .createQueryBuilder('note')
      .where('note.updated_at > :yesterday', { yesterday })
      .andWhere('note.is_deleted = false')
      .getMany();

    for (const note of notesToSnapshot) {
      try {
        await this.createNoteSnapshot(note.id);
        this.logger.log(`[VersionsService] Created snapshot for note: ${note.id}`);
      } catch (error) {
        this.logger.error(
          `[VersionsService] Failed to snapshot note ${note.id}:`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  /**
   * Get snapshots for a note.
   * 获取笔记的所有快照。
   */
  async getNoteSnapshots(noteId: string): Promise<NoteSnapshot[]> {
    return this.noteSnapshotRepository.find({
      where: { noteId },
      order: { createdAt: 'DESC' },
    });
  }
}
