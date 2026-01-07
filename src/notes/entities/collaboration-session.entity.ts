import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * CollaborationSession entity - tracks active collaborative editing sessions.
 * CollaborationSession实体 - 跟踪活跃的协同编辑会话。
 * 
 * Used for real-time presence indication and cursor tracking.
 * 用于实时在线状态指示和光标跟踪。
 */
@Entity('collaboration_sessions')
export class CollaborationSession {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'note_id', type: 'uuid' })
    noteId: string;

    @Column({ name: 'user_id', type: 'uuid' })
    userId: string;

    @Column({ name: 'cursor_position', type: 'jsonb', nullable: true })
    cursorPosition?: {
        blockId: string;
        offset: number;
    };

    @Column({ type: 'jsonb', nullable: true })
    selection?: {
        startBlockId: string;
        startOffset: number;
        endBlockId: string;
        endOffset: number;
    };

    @Column({ length: 20 })
    color: string;

    @CreateDateColumn({ name: 'connected_at', type: 'timestamptz' })
    connectedAt: Date;

    @UpdateDateColumn({ name: 'last_active_at', type: 'timestamptz' })
    lastActiveAt: Date;

    @Column({ name: 'socket_id', length: 100 })
    socketId: string;
}
