import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { INote } from '@tainiex/shared-atlas';

/**
 * Note entity - represents a note/page in the database.
 * Note实体 - 代表数据库中的笔记/页面。
 *
 * Implements INote interface from shared-atlas for type consistency.
 * 实现shared-atlas中的INote接口以确保类型一致性。
 */
@Entity('notes')
export class Note implements INote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ length: 200, default: 'Untitled' })
  title: string;

  @Column({ name: 'cover_image', length: 500, nullable: true })
  coverImage?: string;

  @Column({ length: 100, nullable: true })
  icon?: string;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId?: string;

  @Column({ length: 50, nullable: true })
  template?: string;

  @Column({ name: 'is_public', default: false })
  isPublic: boolean;

  @Column({ name: 'is_deleted', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'last_edited_by', type: 'uuid' })
  lastEditedBy: string;

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

  /**
   * Whether the note has children (computed property, not stored in DB).
   * 笔记是否有子节点（计算属性，不存储在数据库中）。
   */
  hasChildren?: boolean;
}
