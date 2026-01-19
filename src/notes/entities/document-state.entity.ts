import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * DocumentState entity - persists Y.js CRDT state for collaborative editing.
 * DocumentState实体 - 持久化Y.js CRDT状态用于协同编辑。
 *
 * Why this table? / 为什么需要这个表？
 * Y.js maintains document state in memory for real-time collaboration.
 * This table persists that state to:
 * 1. Recover state after server restart / 服务器重启后恢复状态
 * 2. Sync new users quickly / 快速同步新用户
 * 3. Prevent data loss / 防止数据丢失
 *
 * Complements the 'blocks' table:
 * - blocks: structured content storage / 结构化内容存储
 * - document_states: operational history for collaboration / 协作的操作历史
 */
@Entity('document_states')
export class DocumentState {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'note_id', type: 'uuid', unique: true })
  noteId: string;

  @Column({ name: 'state_vector', type: 'bytea', nullable: true })
  stateVector: Buffer;

  @Column({ name: 'document_state', type: 'bytea', nullable: true })
  documentState: Buffer;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
