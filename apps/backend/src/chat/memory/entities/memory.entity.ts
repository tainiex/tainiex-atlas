import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum MemoryType {
  PERSONAL = 'PERSONAL',
  DOMAIN = 'DOMAIN',
  TASK = 'TASK',
}

export enum MemorySource {
  CHAT = 'CHAT',
  NOTE = 'NOTE',
}

@Entity('semantic_memories')
@Index(['userId', 'sourceType'])
export class SemanticMemory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'source_type', type: 'enum', enum: MemorySource })
  sourceType: MemorySource;

  @Column({ name: 'source_id', type: 'uuid' })
  sourceId: string;

  @Column({ type: 'text' })
  content: string;

  // pgvector column
  @Column({ type: 'vector', width: 768, nullable: true })
  embedding: number[];

  @Column({ type: 'enum', enum: MemoryType, default: MemoryType.PERSONAL })
  type: MemoryType;

  @Column({ type: 'jsonb', default: {} })
  entities: Record<string, any>;

  @Column({ type: 'text', array: true, nullable: true })
  tags: string[];

  @Column({ type: 'int', default: 1 })
  importance: number;

  @Column({ name: 'access_count', type: 'int', default: 0 })
  accessCount: number;

  @Column({
    name: 'last_accessed_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  lastAccessedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
