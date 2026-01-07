import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CollaborationSession } from './entities/collaboration-session.entity';
import type { ICollaborator } from '@shared/index';

/**
 * PresenceService - manages user presence in collaborative editing sessions.
 * PresenceService - 管理协同编辑会话中的用户在线状态。
 */
@Injectable()
export class PresenceService {
    private readonly MAX_CONCURRENT_EDITORS = 5;

    // In-memory cache for quick access
    // 内存缓存，用于快速访问
    private activeSessions = new Map<string, Set<string>>(); // noteId -> Set<userId>
    private userColors = new Map<string, string>(); // userId -> color

    // Available colors for user cursors
    // 用户光标的可用颜色
    private readonly COLORS = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
        '#98D8C8', '#F7B731', '#5F27CD', '#00D2D3',
        '#FF9FF3', '#54A0FF', '#48DBFB', '#1DD1A1'
    ];

    constructor(
        @InjectRepository(CollaborationSession)
        private collaborationRepository: Repository<CollaborationSession>,
    ) { }

    /**
     * User joins a note editing session.
     * 用户加入笔记编辑会话。
     */
    async join(
        noteId: string,
        userId: string,
        username: string,
        socketId: string,
        avatar?: string
    ): Promise<{ success: boolean; collaborator?: ICollaborator; error?: string }> {
        // Check concurrent editors limit
        const currentEditors = this.activeSessions.get(noteId) || new Set();

        if (currentEditors.size >= this.MAX_CONCURRENT_EDITORS && !currentEditors.has(userId)) {
            return {
                success: false,
                error: `Maximum ${this.MAX_CONCURRENT_EDITORS} concurrent editors reached`,
            };
        }

        // Assign color
        let color = this.userColors.get(userId);
        if (!color) {
            const usedColors = new Set(this.userColors.values());
            color = this.COLORS.find(c => !usedColors.has(c)) || this.COLORS[0];
            this.userColors.set(userId, color);
        }

        // Save to database
        const session = this.collaborationRepository.create({
            noteId,
            userId,
            socketId,
            color,
        });

        await this.collaborationRepository.save(session);

        // Update in-memory cache
        if (!this.activeSessions.has(noteId)) {
            this.activeSessions.set(noteId, new Set());
        }
        this.activeSessions.get(noteId)!.add(userId);

        return {
            success: true,
            collaborator: {
                userId,
                username,
                avatar,
                color,
            },
        };
    }

    /**
     * User leaves a note editing session.
     * 用户离开笔记编辑会话。
     */
    async leave(noteId: string, userId: string, socketId: string): Promise<void> {
        // Remove from database
        await this.collaborationRepository.delete({
            noteId,
            userId,
            socketId,
        });

        // Update in-memory cache
        const editors = this.activeSessions.get(noteId);
        if (editors) {
            editors.delete(userId);
            if (editors.size === 0) {
                this.activeSessions.delete(noteId);
            }
        }
    }

    /**
     * Update user's cursor position.
     * 更新用户光标位置。
     */
    async updateCursor(
        noteId: string,
        userId: string,
        socketId: string,
        cursorPosition?: { blockId: string; offset: number },
        selection?: {
            startBlockId: string;
            startOffset: number;
            endBlockId: string;
            endOffset: number;
        }
    ): Promise<void> {
        await this.collaborationRepository.update(
            { noteId, userId, socketId },
            {
                cursorPosition,
                selection,
                lastActiveAt: new Date(),
            }
        );
    }

    /**
     * Get all active collaborators for a note.
     * 获取笔记的所有活跃协作者。
     */
    async getCollaborators(noteId: string): Promise<CollaborationSession[]> {
        return this.collaborationRepository.find({
            where: { noteId },
            order: { connectedAt: 'ASC' },
        });
    }

    /**
     * Clean up stale sessions (older than 1 hour).
     * 清理过期会话（超过1小时）。
     */
    async cleanupStaleSessions(): Promise<void> {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        await this.collaborationRepository
            .createQueryBuilder()
            .delete()
            .where('last_active_at < :time', { time: oneHourAgo })
            .execute();

        // Rebuild in-memory cache
        this.activeSessions.clear();
        const allSessions = await this.collaborationRepository.find();

        for (const session of allSessions) {
            if (!this.activeSessions.has(session.noteId)) {
                this.activeSessions.set(session.noteId, new Set());
            }
            this.activeSessions.get(session.noteId)!.add(session.userId);
        }
    }

    /**
     * Get current editor count for a note.
     * 获取笔记的当前编辑者数量。
     */
    getEditorCount(noteId: string): number {
        return this.activeSessions.get(noteId)?.size || 0;
    }

    /**
     * Check if a note has reached max editors.
     * 检查笔记是否达到最大编辑者数量。
     */
    isAtCapacity(noteId: string): boolean {
        return this.getEditorCount(noteId) >= this.MAX_CONCURRENT_EDITORS;
    }
}
