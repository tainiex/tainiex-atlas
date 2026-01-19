import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IBlock, BlockType } from '@tainiex/shared-atlas';

/**
 * Block entity - represents a content block within a note.
 * Block实体 - 代表笔记中的内容块。
 *
 * Implements IBlock interface from shared-atlas for type consistency.
 * 实现shared-atlas中的IBlock接口以确保类型一致性。
 */
@Entity('blocks')
export class Block implements Omit<IBlock, 'children'> {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'note_id', type: 'uuid' })
  noteId: string;

  @Column({
    type: 'enum',
    enum: BlockType,
  })
  type: BlockType;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ type: 'jsonb', default: {} })
  metadata: any;

  @Column({ name: 'parent_block_id', type: 'uuid', nullable: true })
  parentBlockId?: string;

  @Column({ type: 'int', default: 0 })
  position: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @Column({ name: 'last_edited_by', type: 'uuid' })
  lastEditedBy: string;

  @Column({ name: 'is_deleted', default: false })
  isDeleted: boolean;

  // Full-text search vector (managed by PostgreSQL trigger)
  // 全文搜索向量（由PostgreSQL触发器管理）
  @Column({
    name: 'search_vector',
    type: 'tsvector',
    nullable: true,
    select: false,
    insert: false,
    update: false,
  })
  searchVector?: any;

  // Note: 'children' field is not stored in DB, it's populated during query
  // 注意：'children'字段不存储在数据库中，在查询时动态填充
}
