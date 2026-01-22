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
import { UseFilters } from '@nestjs/common';
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
  CursorUpdatePayload,
} from '@tainiex/shared-atlas';

import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { LoggerService } from '../common/logger/logger.service';
import { WebSocketStateMachineService } from '../common/websocket/websocket-state-machine.service';
import { WebSocketMachineRegistry } from '../common/websocket/websocket-machine-registry.service';
import {
  WebSocketStates,
  WebSocketEventTypes,
  ClientEventTypes,
} from '../common/websocket/websocket-state-machine.types';

interface AuthenticatedSocket extends Socket {
  data: {
    user?: JwtPayload;
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

      // Use the same parsing logic as ConfigurationService
      const allowedOrigins = rawConfig
        .split(',')
        .map((origin) => {
          const trimmed = origin.trim().replace(/^['"]|['"]$/g, '');

          if (trimmed === '*')
            return { type: 'wildcard' as const, value: trimmed };

          if (trimmed.includes('*')) {
            const regexString =
              '^' +
              trimmed
                .replace(/[.+^${}()|[\]\\]/g, '\\$&')
                .replace(/\*/g, '.*') +
              '$';
            return { type: 'regex' as const, value: new RegExp(regexString) };
          }

          return { type: 'exact' as const, value: trimmed };
        })
        .filter((origin) => origin.value);

      const isAllowed = allowedOrigins.some((origin) => {
        if (origin.type === 'wildcard' && origin.value === '*') return true;
        if (origin.type === 'exact') return origin.value === requestOrigin;
        if (origin.type === 'regex') return origin.value.test(requestOrigin);
        return false;
      });

      if (!requestOrigin || isAllowed) {
        callback(null, true);
      } else {
        console.warn(
          `[CORS] Rejected Origin: ${requestOrigin}. Configured: ${rawConfig}`,
        );
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  },
  namespace: '/api/collaboration',
  pingInterval: 10000,
  pingTimeout: 20000,
  transports: ['websocket', 'polling'],
})
@UseFilters(new WebSocketExceptionFilter())
export class CollaborationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly presenceService: PresenceService,
    private readonly yjsService: YjsService,
    private readonly notesService: NotesService,
    private readonly tokenLifecycleService: TokenLifecycleService,
    private readonly healthService: ConnectionHealthService,
    private readonly reliableMsgService: ReliableMessageService,
    private readonly logger: LoggerService,
    private readonly machineService: WebSocketStateMachineService,
    private readonly machineRegistry: WebSocketMachineRegistry,
  ) {
    this.logger.setContext(CollaborationGateway.name);
  }

  afterInit(_server: Server) {
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
    let token: string | undefined = client.handshake.auth?.token as
      | string
      | undefined;

    // 2. Try Authorization header
    if (!token) {
      token = client.handshake.headers['authorization'];
    }

    // 3. Fallback: Cookies
    if (!token && client.handshake.headers.cookie) {
      const cookies = client.handshake.headers.cookie.split(';').reduce(
        (acc, curr) => {
          const [name, value] = curr.trim().split('=');
          acc[name] = value;
          return acc;
        },
        {} as Record<string, string>,
      );

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
    // 1. Extract Token
    const token = this.machineService.extractToken(client);

    if (!token) {
      this.logger.warn(
        'Connection rejected: No token provided in auth, headers, or cookies',
      );
      client.emit(ClientEventTypes.ERROR, {
        code: WebSocketErrorCode.AUTH_TOKEN_INVALID,
        message: 'No authentication token provided',
        category: 'AUTH',
      });
      client.disconnect();
      return;
    }

    // 2. Create and Start State Machine
    const actor = this.machineRegistry.create(client.id);
    const ip = client.handshake.address;

    // 3. Subscribe to State Changes
    actor.subscribe((snapshot) => {
      this.logger.debug(
        `[Collaboration ${client.id}] State: ${JSON.stringify(snapshot.value)}`,
      );

      // Handle Ready State (Authentication Successful)
      if (snapshot.matches(WebSocketStates.READY)) {
        const user = snapshot.context.user;
        if (user) {
          client.data.user = user;

          // Schedule token refresh notification
          this.tokenLifecycleService.scheduleRefreshNotification(
            client,
            token,
          );

          // Health Monitor Init
          this.healthService.onConnect(client.id);

          // Start Active Ping
          const pingInterval = setInterval(() => {
            if (!client.connected) {
              clearInterval(pingInterval);
              return;
            }
            const start = Date.now();
            client.emit(ClientEventTypes.PACKET_PING, {}, () => {
              const latency = Date.now() - start;
              this.healthService.recordPong(client.id, latency);
            });
          }, 30000);

          // Resend Pending Messages
          this.reliableMsgService.resendPending(client, user.sub);

          this.logger.log(
            `Client connected: ${client.id}, User: ${user.sub || user.id}`,
          );
        }
      }

      // Handle Error State
      if (snapshot.matches(WebSocketStates.ERROR)) {
        this.logger.error(
          `WebSocket authentication error for ${client.id}: ${snapshot.context.error}`,
        );
        client.disconnect();
      }
    });

    // 4. Start State Machine
    actor.send({ type: WebSocketEventTypes.CONNECT, client, token, ip });

    // 5. Perform JWT Verification (Async)
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

      const userId = payload.sub || payload.id;
      if (!userId) {
        actor.send({
          type: WebSocketEventTypes.AUTH_FAILED,
          error: 'Invalid token payload: User ID missing',
        });
        return;
      }

      payload.id = userId; // Ensure .id is available for legacy code

      // Calculate token expiration
      const expiresAt = payload.exp
        ? payload.exp * 1000
        : Date.now() + 15 * 60 * 1000;

      // Send success event to state machine
      actor.send({ type: WebSocketEventTypes.AUTH_SUCCESS, user: payload, expiresAt });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('JWT verification failed:', errorMessage);

      actor.send({
        type: WebSocketEventTypes.AUTH_FAILED,
        error: 'Authentication failed: ' + errorMessage,
      });
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    // Clean up state machine
    this.machineRegistry.remove(client.id);

    // Clean up other services
    this.tokenLifecycleService.clearTimer(client.id);
    this.healthService.onDisconnect(client.id);

    // Clean up presence (Y.js session)
    const removed = this.presenceService.removeSessionBySocketId(client.id);

    if (removed) {
      client
        .to(removed.noteId)
        .emit(ClientEventTypes.PRESENCE_LEAVE, { userId: removed.userId });
      this.logger.log(
        `User ${removed.userId} disconnected (socket cleanup) from note ${removed.noteId}`,
      );
    }

    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('note:join')
  async handleJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: NoteJoinPayload,
  ) {
    const user = client.data.user;
    if (!user) return;

    const userId = user.sub;
    const { noteId } = payload;

    // Check permission
    const canEdit = await this.notesService.canEdit(noteId, userId);
    if (!canEdit) {
      client.emit(ClientEventTypes.COLLABORATION_ERROR, { error: 'No edit permission' });
      return;
    }

    // Join session
    const result = this.presenceService.join(
      noteId,
      userId,
      user.username || 'Anonymous',
      client.id,
      user.avatar,
    );

    if (!result.success) {
      client.emit(ClientEventTypes.COLLABORATION_LIMIT, {
        error: result.error,
        currentEditors: this.presenceService.getEditorCount(noteId),
        maxEditors: 5,
      });
      return;
    }

    // Join socket.io room
    await client.join(noteId);

    // Notify others
    client.to(noteId).emit(ClientEventTypes.PRESENCE_JOIN, result.collaborator);

    // Send initial state sync to the user
    const stateVector = await this.yjsService.getStateVector(noteId);
    const update = await this.yjsService.getStateAsUpdate(noteId);

    this.logger.log(
      `[CollaborationGateway] Sending yjs:sync for note ${noteId} to user ${userId}. Update size: ${update.length} bytes`,
    );

    client.emit(ClientEventTypes.YJS_SYNC, {
      noteId,
      update: Buffer.from(update).toString('base64'),
      stateVector: Buffer.from(stateVector).toString('base64'),
    });

    // Send list of current collaborators to the joining user
    const sessions = this.presenceService.getCollaborators(noteId);
    client.emit(
      'presence:list',
      sessions.map((s) => ({
        userId: s.userId,
        username: s.username,
        avatar: s.avatar,
        color: s.color,
        cursorPosition: s.cursorPosition,
        selection: s.selection,
        connectedAt: s.connectedAt,
      })),
    );

    this.logger.log(`User ${userId} joined note ${noteId}`);
  }

  @SubscribeMessage('note:leave')
  async handleLeave(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: NoteLeavePayload,
  ) {
    const user = client.data.user;
    if (!user) return;

    const userId = user.sub;
    const { noteId } = payload;

    this.presenceService.leave(noteId, userId, client.id);
    await client.leave(noteId);

    client.to(noteId).emit(ClientEventTypes.PRESENCE_LEAVE, { userId });
    this.logger.log(`User ${userId} left note ${noteId}`);
  }

  @SubscribeMessage('yjs:update')
  async handleYjsUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: YjsUpdatePayload,
  ) {
    const user = client.data.user;
    if (!user) return;

    const { noteId, update: base64Update } = payload;
    const update = Uint8Array.from(Buffer.from(base64Update, 'base64'));

    // Apply update locally
    await this.yjsService.applyUpdate(noteId, update);

    // Broadcast to others in the room
    client.to(noteId).emit(ClientEventTypes.YJS_UPDATE, {
      noteId,
      update: base64Update,
    });
  }

  @SubscribeMessage('cursor:update')
  handleCursorUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: CursorUpdatePayload,
  ) {
    const user = client.data.user;
    if (!user) return;

    const userId = user.sub;
    const { noteId, position, selection } = payload;

    this.presenceService.updateCursor(
      noteId,
      userId,
      client.id,
      position,
      selection,
    );

    // Broadcast to others
    client.to(noteId).emit(ClientEventTypes.CURSOR_UPDATE, {
      noteId,
      userId,
      position,
      selection,
    });
  }

  @SubscribeMessage('auth:token-refreshed')
  async handleTokenRefreshed(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { newToken: string },
  ) {
    if (!payload?.newToken) return;
    await this.tokenLifecycleService.handleTokenRefreshed(
      client,
      payload.newToken,
    );
  }

  @SubscribeMessage('message:ack')
  handleMessageAck(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { messageId: string },
  ) {
    const user = client.data.user;
    if (user && payload?.messageId) {
      this.reliableMsgService.handleAck(user.sub, payload.messageId);
    }
  }
}
