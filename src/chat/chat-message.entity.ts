import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';
import { ChatRole, IChatMessage } from '@tainiex/shared-atlas';

@Entity('chat_messages')
export class ChatMessage implements IChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @Column({ name: 'parent_id', type: 'varchar', default: 'ROOT' })
  parentId: string;

  @Column({
    type: 'enum',
    enum: ChatRole,
    default: ChatRole.USER,
  })
  role: ChatRole;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
