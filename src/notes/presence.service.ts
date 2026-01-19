import { Injectable, Logger } from '@nestjs/common';
import type { ICollaborator } from '@tainiex/shared-atlas';

/**
 * Local session interface for in-memory storage.
 * 用于内存存储的本地会话接口。
 */
interface LocalSession {
  noteId: string;
  userId: string;
  socketId: string;
  color: string;
  username: string;
  avatar?: string;
  connectedAt: Date;
  lastActiveAt: Date;
  cursorPosition?: { blockId: string; offset: number };
  selection?: {
    startBlockId: string;
    startOffset: number;
    endBlockId: string;
    endOffset: number;
  };
}

/**
 * PresenceService - manages user presence in collaborative editing sessions (In-Memory).
 * PresenceService - 管理协同编辑会话中的用户在线状态（内存存储）。
 */
@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);
  private readonly MAX_CONCURRENT_EDITORS = 5;

  // In-memory stores
  // 内存存储

  // Key: socketId -> Session Data (Fast lookup for disconnects/updates)
  // 键: socketId -> 会话数据 (用于快速查找断开连接/更新)
  private sessions = new Map<string, LocalSession>();

  // Key: noteId -> Set of socketIds (Fast lookup for who is in a note)
  // 键: noteId -> socketId 集合 (用于快速查找谁在笔记中)
  private noteSessions = new Map<string, Set<string>>();

  private userColors = new Map<string, string>(); // userId -> color

  // Available colors for user cursors
  // 用户光标的可用颜色
  private readonly COLORS = [
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#FFA07A',
    '#98D8C8',
    '#F7B731',
    '#5F27CD',
    '#00D2D3',
    '#FF9FF3',
    '#54A0FF',
    '#48DBFB',
    '#1DD1A1',
  ];

  constructor() {}

  /**
   * User joins a note editing session.
   * 用户加入笔记编辑会话。
   */
  async join(
    noteId: string,
    userId: string,
    username: string,
    socketId: string,
    avatar?: string,
  ): Promise<{
    success: boolean;
    collaborator?: ICollaborator;
    error?: string;
  }> {
    // Check concurrent editors limit
    const currentEditors = this.noteSessions.get(noteId) || new Set();

    // Check if user is already in (allow multi-tab, but check unique users count if needed)
    // Currently checking raw socket count or unique user count?
    // Let's count unique users for the limit.
    const uniqueUsers = new Set<string>();
    currentEditors.forEach((sid) => {
      const sess = this.sessions.get(sid);
      if (sess) uniqueUsers.add(sess.userId);
    });

    if (
      uniqueUsers.size >= this.MAX_CONCURRENT_EDITORS &&
      !uniqueUsers.has(userId)
    ) {
      return {
        success: false,
        error: `Maximum ${this.MAX_CONCURRENT_EDITORS} concurrent editors reached`,
      };
    }

    // Assign color
    let color = this.userColors.get(userId);
    if (!color) {
      const usedColors = new Set(this.userColors.values());
      color = this.COLORS.find((c) => !usedColors.has(c)) || this.COLORS[0];
      this.userColors.set(userId, color);
    }

    // Create session object
    const session: LocalSession = {
      noteId,
      userId,
      socketId,
      username,
      avatar,
      color,
      connectedAt: new Date(),
      lastActiveAt: new Date(),
    };

    // Store in maps
    this.sessions.set(socketId, session);

    if (!this.noteSessions.has(noteId)) {
      this.noteSessions.set(noteId, new Set());
    }
    this.noteSessions.get(noteId)!.add(socketId);

    return {
      success: true,
      collaborator: {
        userId,
        username,
        avatar,
        color,
        connectedAt: session.connectedAt,
      },
    };
  }

  /**
   * User leaves a note editing session.
   * 用户离开笔记编辑会话。
   */
  async leave(noteId: string, userId: string, socketId: string): Promise<void> {
    this.removeSessionInternal(socketId);
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
    },
  ): Promise<void> {
    const session = this.sessions.get(socketId);
    if (session) {
      session.cursorPosition = cursorPosition;
      session.selection = selection;
      session.lastActiveAt = new Date();
    }
  }

  /**
   * Get all active collaborators for a note.
   * 获取笔记的所有活跃协作者。
   */
  async getCollaborators(noteId: string): Promise<ICollaborator[]> {
    const socketIds = this.noteSessions.get(noteId);
    if (!socketIds) return [];

    const collaborators: ICollaborator[] = [];
    socketIds.forEach((sid) => {
      const sess = this.sessions.get(sid);
      if (sess) {
        collaborators.push({
          userId: sess.userId,
          color: sess.color,
          cursorPosition: sess.cursorPosition,
          selection: sess.selection,
          username: sess.username,
          avatar: sess.avatar,
          connectedAt: sess.connectedAt,
        });
      }
    });

    return collaborators.sort(
      (a, b) => a.connectedAt.getTime() - b.connectedAt.getTime(),
    );
  }

  /**
   * Get current editor count for a note.
   * 获取笔记的当前编辑者数量。
   */
  getEditorCount(noteId: string): number {
    const socketIds = this.noteSessions.get(noteId);
    if (!socketIds) return 0;

    const uniqueUsers = new Set<string>();
    socketIds.forEach((sid) => {
      const sess = this.sessions.get(sid);
      if (sess) uniqueUsers.add(sess.userId);
    });
    return uniqueUsers.size;
  }

  /**
   * Check if a note has reached max editors.
   * 检查笔记是否达到最大编辑者数量。
   */
  isAtCapacity(noteId: string): boolean {
    return this.getEditorCount(noteId) >= this.MAX_CONCURRENT_EDITORS;
  }

  /**
   * Remove session by socket ID (used on disconnect).
   * 根据 Socket ID 移除会话（用于断开连接时）。
   */
  async removeSessionBySocketId(
    socketId: string,
  ): Promise<{ noteId: string; userId: string } | null> {
    return this.removeSessionInternal(socketId);
  }

  /**
   * Internal helper to remove a session.
   * 移除会话的内部辅助方法。
   */
  private removeSessionInternal(
    socketId: string,
  ): { noteId: string; userId: string } | null {
    const session = this.sessions.get(socketId);
    if (!session) return null;

    // Remove from sessions map
    this.sessions.delete(socketId);

    // Remove from noteSessions map
    const noteSockets = this.noteSessions.get(session.noteId);
    if (noteSockets) {
      noteSockets.delete(socketId);
      if (noteSockets.size === 0) {
        this.noteSessions.delete(session.noteId);
      }
    }

    return { noteId: session.noteId, userId: session.userId };
  }
}
