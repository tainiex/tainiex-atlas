import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

/**
 * BlockVersion entity - stores historical versions of blocks.
 * BlockVersion实体 - 存储块的历史版本。
 *
 * Used for version control and undo/redo functionality.
 * 用于版本控制和撤销/重做功能。
 */
@Entity('block_versions')
export class BlockVersion {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'block_id', type: 'uuid' })
    blockId: string;

    @Column({ name: 'version_number', type: 'int' })
    versionNumber: number;

    @Column({ type: 'text', nullable: true })
    content: string;

    @Column({ type: 'jsonb', nullable: true })
    metadata: any;

    @Column({ name: 'change_type', length: 20 })
    changeType: 'created' | 'updated' | 'deleted';

    @Column({ type: 'jsonb', nullable: true })
    diff: any;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @Column({ name: 'created_by', type: 'uuid' })
    createdBy: string;
}
