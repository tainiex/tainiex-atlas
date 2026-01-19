import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ChatMessage } from './chat-message.entity';

@Entity('chat_message_histories')
export class ChatMessageHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'message_id', type: 'uuid' })
  messageId: string;

  @ManyToOne(() => ChatMessage)
  @JoinColumn({ name: 'message_id' })
  message: ChatMessage;

  @Column({
    type: 'varchar',
    length: 50,
  })
  role: string;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn({ name: 'archived_at', type: 'timestamptz' })
  archivedAt: Date;
}
