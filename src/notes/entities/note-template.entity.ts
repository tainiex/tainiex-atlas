import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { INoteTemplate } from '@tainiex/shared-atlas';

/**
 * NoteTemplate entity - stores predefined and user-created templates.
 * NoteTemplate实体 - 存储预定义和用户创建的模板。
 *
 * Implements INoteTemplate interface from shared-atlas for type consistency.
 * 实现shared-atlas中的INoteTemplate接口以确保类型一致性。
 */
@Entity('note_templates')
export class NoteTemplate implements INoteTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ length: 500, nullable: true })
  thumbnail?: string;

  @Column({ length: 50 })
  category: string;

  @Column({ name: 'is_public', default: true })
  isPublic: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @Column({ name: 'template_data', type: 'jsonb' })
  templateData: any;

  @Column({ name: 'usage_count', type: 'int', default: 0 })
  usageCount: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
