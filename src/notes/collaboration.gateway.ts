import {
    WebSocketGateway,
    SubscribeMessage,
    MessageBody,
    WebSocketServer,
    ConnectedSocket,
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger, UsePipes, ValidationPipe, UseFilters } from '@nestjs/common';
import { PresenceService } from './presence.service';
import { YjsService } from './yjs.service';
import { NotesService } from './notes.service';
import { TokenLifecycleService } from '../chat/token-lifecycle.service';
import { ConnectionHealthService } from '../chat/connection-health.service';
import { ReliableMessageService } from '../chat/reliable-message.service';
import { WebSocketExceptionFilter } from '../common/filters/websocket-exception.filter';
import { WebSocketErrorCode } from '@tainiex/shared-atlas';
import type {
    NoteJoinPayload,
    NoteLeavePayload,
    YjsUpdatePayload,
    CursorUpdatePayload
} from '@tainiex/shared-atlas';

interface AuthenticatedSocket extends Socket {
    data: {
        user?: any;
    };
}

/**
 * CollaborationGateway - Handles real-time synchronization for note editing.
 * CollaborationGateway - 处理笔记编辑的实时同步。
 * 
 * Events:
 * - note:join: User joins a note / 用户加入笔记
 * - note:leave: User leaves a note / 用户离开笔记
 * - yjs:update: Apply Y.js updates / 应用 Y.js 更新
 * - yjs:sync: Sync Y.js document state / 同步 Y.js 文档状态
 * - cursor:update: Sync cursor and selection / 同步光标和选取
 */
@WebSocketGateway({
    cors: {
        origin: (requestOrigin, callback) => {
            const rawConfig = process.env.CORS_ORIGIN || '';
            const allowedOrigins = rawConfig.split(',').map(o => o.trim().replace(/^['"]|['"]$/g, ''));
            const isAllowed = !requestOrigin || allowedOrigins.some(origin => {
                if (origin === requestOrigin) return true;
                if (origin.includes('*')) {
                    const regex = new RegExp(`^${origin.replace(/\./g, '\\.').replace(/\*/g, '.*')}$`);
                    return regex.test(requestOrigin);
                }
                return false;
            });
            if (isAllowed) callback(null, true);
            else callback(new Error('Not allowed by CORS'));
        },
        credentials: true
    },
    namespace: '/api/collaboration',
    pingInterval: 10000,
    pingTimeout: 20000,
    transports: ['websocket', 'polling']
})
@UseFilters(new WebSocketExceptionFilter())
export class CollaborationGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(CollaborationGateway.name);

    constructor(
        private readonly jwtService: JwtService,
        private readonly presenceService: PresenceService,
        private readonly yjsService: YjsService,
        private readonly notesService: NotesService,
        private readonly tokenLifecycleService: TokenLifecycleService,
        private readonly healthService: ConnectionHealthService,
        private readonly reliableMsgService: ReliableMessageService,
    ) { }

    afterInit(server: Server) {
        this.logger.log('Collaboration Gateway initialized');
    }

    /**
     * Helper to extract token from various sources
     * Supports:
     * 1. socket.auth.token (Socket.IO standard)
     * 2. Authorization header (Standard HTTP)
     * 3. Cookies (Browser fallback)
     * Handles both "Bearer <token>" and raw "<token>" formats.
     */
    private extractToken(client: AuthenticatedSocket): string | undefined {
        // 1. Try handshake auth (most common for Socket.IO clients)
        let token: any = client.handshake.auth?.token;

        // 2. Try Authorization header
        if (!token) {
            token = client.handshake.headers['authorization'];
        }

        // 3. Fallback: Cookies
        if (!token && client.handshake.headers.cookie) {
            const cookies = client.handshake.headers.cookie.split(';').reduce((acc, curr) => {
                const [name, value] = curr.trim().split('=');
                acc[name] = value;
                return acc;
            }, {} as Record<string, string>);

            token = cookies['access_token'];
        }

        // Sanitize: Strip 'Bearer ' prefix if present
        if (token && typeof token === 'string') {
            if (token.toLowerCase().startsWith('bearer ')) {
                token = token.slice(7).trim();
            }
        }

        return token || undefined;
    }

    async handleConnection(client: AuthenticatedSocket) {
        try {
            const token = this.extractToken(client);

            if (!token) {
                client.disconnect();
                return;
            }

            const payload = await this.jwtService.verifyAsync(token);
            client.data.user = payload;

            if (token) {
                this.tokenLifecycleService.scheduleRefreshNotification(client, token);
            }

            // Health Monitor Init
            this.healthService.onConnect(client.id);
            // Start Active Ping
            const pingInterval = setInterval(() => {
                if (!client.connected) {
                    clearInterval(pingInterval);
                    return;
                }
                const start = Date.now();
                client.emit('packet:ping', {}, () => {
                    const latency = Date.now() - start;
                    this.healthService.recordPong(client.id, latency);
                });
            }, 30000);

            // Resend Pending Messages
            const userId = payload.sub || payload.id;
            await this.reliableMsgService.resendPending(client, userId);

            this.logger.log(`Client connected: ${client.id}, User: ${payload.sub || payload.id}`);
        } catch (error) {
            this.logger.error('Authentication failed:', error.message);
            client.emit('error', {
                code: WebSocketErrorCode.AUTH_TOKEN_INVALID,
                message: 'Authentication failed: ' + error.message,
                category: 'AUTH'
            });
            client.disconnect();
        }
    }

    async handleDisconnect(client: AuthenticatedSocket) {
        this.tokenLifecycleService.clearTimer(client.id);
        this.healthService.onDisconnect(client.id);
        // Clean up all sessions for this client
        this.logger.log(`Client disconnected: ${client.id}`);

        const removed = await this.presenceService.removeSessionBySocketId(client.id);

        if (removed) {
            client.to(removed.noteId).emit('presence:leave', { userId: removed.userId });
            this.logger.log(`User ${removed.userId} disconnected (socket cleanup) from note ${removed.noteId}`);
        }
    }

    @SubscribeMessage('note:join')
    async handleJoin(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() payload: NoteJoinPayload
    ) {
        const user = client.data.user;
        if (!user) return;

        const userId = user.sub || user.id;
        const { noteId } = payload;

        // Check permission
        const canEdit = await this.notesService.canEdit(noteId, userId);
        if (!canEdit) {
            client.emit('collaboration:error', { error: 'No edit permission' });
            return;
        }

        // Join session
        const result = await this.presenceService.join(
            noteId,
            userId,
            user.username || 'Anonymous',
            client.id,
            user.avatar
        );

        if (!result.success) {
            client.emit('collaboration:limit', {
                error: result.error,
                currentEditors: this.presenceService.getEditorCount(noteId),
                maxEditors: 5
            });
            return;
        }

        // Join socket.io room
        client.join(noteId);

        // Notify others
        client.to(noteId).emit('presence:join', result.collaborator);

        // Send initial state sync to the user
        const stateVector = await this.yjsService.getStateVector(noteId);
        const update = await this.yjsService.getStateAsUpdate(noteId);

        this.logger.log(`[CollaborationGateway] Sending yjs:sync for note ${noteId} to user ${userId}. Update size: ${update.length} bytes`);

        client.emit('yjs:sync', {
            noteId,
            update: Buffer.from(update).toString('base64'),
            stateVector: Buffer.from(stateVector).toString('base64'),
        });

        // Send list of current collaborators to the joining user
        const sessions = await this.presenceService.getCollaborators(noteId);
        client.emit('presence:list', sessions.map(s => ({
            userId: s.userId,
            color: s.color,
            cursorPosition: s.cursorPosition,
            selection: s.selection,
            // In a real app, you'd fetch user profiles for names/avatars
        })));

        this.logger.log(`User ${userId} joined note ${noteId}`);
    }

    @SubscribeMessage('note:leave')
    async handleLeave(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() payload: NoteLeavePayload
    ) {
        const user = client.data.user;
        if (!user) return;

        const userId = user.sub || user.id;
        const { noteId } = payload;

        await this.presenceService.leave(noteId, userId, client.id);
        client.leave(noteId);

        client.to(noteId).emit('presence:leave', { userId });
        this.logger.log(`User ${userId} left note ${noteId}`);
    }

    @SubscribeMessage('yjs:update')
    async handleYjsUpdate(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() payload: YjsUpdatePayload
    ) {
        const user = client.data.user;
        if (!user) return;

        const { noteId, update: base64Update } = payload;
        const update = Uint8Array.from(Buffer.from(base64Update, 'base64'));

        // Apply update locally
        await this.yjsService.applyUpdate(noteId, update);

        // Broadcast to others in the room
        client.to(noteId).emit('yjs:update', {
            noteId,
            update: base64Update
        });
    }

    @SubscribeMessage('cursor:update')
    async handleCursorUpdate(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() payload: CursorUpdatePayload
    ) {
        const user = client.data.user;
        if (!user) return;

        const userId = user.sub || user.id;
        const { noteId, position, selection } = payload;

        await this.presenceService.updateCursor(noteId, userId, client.id, position, selection);

        // Broadcast to others
        client.to(noteId).emit('cursor:update', {
            noteId,
            userId,
            position,
            selection
        });
    }

    @SubscribeMessage('auth:token-refreshed')
    async handleTokenRefreshed(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() payload: { newToken: string }
    ) {
        if (!payload?.newToken) return;
        await this.tokenLifecycleService.handleTokenRefreshed(client, payload.newToken);
    }

    @SubscribeMessage('message:ack')
    handleMessageAck(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() payload: { messageId: string }
    ) {
        const user = client.data.user;
        if (user && payload?.messageId) {
            this.reliableMsgService.handleAck(user.id, payload.messageId);
        }
    }
}
