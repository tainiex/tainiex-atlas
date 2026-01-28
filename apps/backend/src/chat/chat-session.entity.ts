import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IChatSession } from '@tainiex/shared-atlas';

@Entity('chat_sessions')
export class ChatSession implements IChatSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ length: 100, default: 'New Chat', nullable: false })
  title: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'is_deleted', default: false })
  isDeleted: boolean;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;
}
