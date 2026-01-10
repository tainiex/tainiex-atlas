import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

/**
 * NoteSnapshot entity - stores periodic snapshots of entire notes.
 * NoteSnapshot实体 - 存储整个笔记的定期快照。
 * 
 * Used for point-in-time recovery and major version milestones.
 * 用于时间点恢复和主要版本里程碑。
 */
@Entity('note_snapshots')
export class NoteSnapshot {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'note_id', type: 'uuid' })
    noteId: string;

    @Column({ name: 'snapshot_data', type: 'jsonb' })
    snapshotData: any;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @Column({ name: 'created_by', type: 'uuid' })
    createdBy: string;
}
