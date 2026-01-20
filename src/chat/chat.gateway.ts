import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { ChatRole } from '@tainiex/shared-atlas';

import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { ChatSendDto } from './dto/chat.dto';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { TokenLifecycleService } from './token-lifecycle.service';
import { ConnectionHealthService } from './connection-health.service';
import { ReliableMessageService } from './reliable-message.service';
import { UseFilters } from '@nestjs/common';
import { WebSocketExceptionFilter } from '../common/filters/websocket-exception.filter';
import { WebSocketErrorCode } from '@tainiex/shared-atlas';

import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

export interface AuthenticatedSocket extends Socket {
  data: {
    user?: JwtPayload;
  };
}

@WebSocketGateway({
  cors: {
    origin: (requestOrigin, callback) => {
      // Strict CORS check: Only allow origins defined in environment variables
      // This prevents CSRF and WebSocket Hijacking attacks
      // Parse allowed origins and convert wildcards to regex
      const rawConfig = process.env.CORS_ORIGIN || '';
      // Robust parsing: split by comma, trim spaces, AND remove surrounding quotes if any
      const allowedOrigins = rawConfig
        .split(',')
        .map((o) => o.trim().replace(/^['"]|['"]$/g, ''));

      const isAllowed = allowedOrigins.some((origin) => {
        // Exact match
        if (origin === requestOrigin) return true;
        // Wildcard match (simple implementation: convert * to .*)
        if (origin.includes('*')) {
          // Normalize origin for regex (escape dots, convert * to .*)
          const regex = new RegExp(
            `^${origin.replace(/\./g, '\\.').replace(/\*/g, '.*')}$`,
          );
          return regex.test(requestOrigin);
        }
        return false;
      });

      if (!requestOrigin || isAllowed) {
        callback(null, true);
      } else {
        console.warn(
          `[CORS] Rejected Origin: ${requestOrigin}. Configured: ${rawConfig}`,
        ); // Use console.warn for immediate visibility in standard logs
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  },
  namespace: '/api/chat',
  // Tuning for Mobile Stability:
  // Increased timeout to wait for slow mobile network wakeups
  pingInterval: 10000,
  pingTimeout: 20000,
  // Maximize transport reliability
  transports: ['websocket', 'polling'],
})
@UseFilters(new WebSocketExceptionFilter())
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatService: ChatService,
    private readonly rateLimitService: RateLimitService,
    private readonly tokenLifecycleService: TokenLifecycleService,
    private readonly healthService: ConnectionHealthService,
    private readonly reliableMsgService: ReliableMessageService,
  ) {}

  afterInit(_server: Server) {
    this.logger.log('WebSocket Gateway initialized successfully');
  }

  // Constants for Rate Limiting
  private static readonly RATE_LIMIT_POINTS = 50; // Max requests (Relaxed for better UX)
  private static readonly RATE_LIMIT_DURATION = 60; // Window in seconds

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
    try {
      // 0. Rate Limiting Check (Database)
      const ip = client.handshake.address;
      const isAllowed = this.rateLimitService.isAllowed(
        ip,
        ChatGateway.RATE_LIMIT_POINTS,
        ChatGateway.RATE_LIMIT_DURATION,
      );
      if (!isAllowed) {
        this.logger.warn(
          `Connection rejected: Rate limit exceeded for IP ${ip}`,
        );
        client.disconnect(true);
        return;
      }

      // 1. Extract Token using robust helper
      const token = this.extractToken(client);

      if (!token) {
        this.logger.warn(
          'Connection rejected: No token provided in auth, headers, or cookies',
        );
        client.disconnect();
        return;
      }

      // Verify JWT
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

      // Strict ID Check
      const userId = payload.sub || payload.id; // Support both but prefer sub
      if (!userId) {
        throw new Error('Invalid token payload: User ID missing');
      }

      payload.id = userId; // Ensure .id is available for legacy code if needed
      client.data.user = payload;

      this.logger.log(
        `Client connected: ${client.id}, User: ${userId} (Via ${client.handshake.auth.token ? 'socket.auth' : client.handshake.headers.authorization ? 'header' : 'cookie'})`,
      );

      // Schedule token refresh notification
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
          // Expecting immediate ack
          const latency = Date.now() - start;
          this.healthService.recordPong(client.id, latency);
        });
      }, 30000); // 30s
      // Store interval in client data to clear later?
      // Or just rely on closure check !client.connected

      // Resend Pending Messages
      this.reliableMsgService.resendPending(client, userId);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Authentication failed:', errorMessage);
      // WebSocketExceptionFilter will handle this if we re-throw, but here we disconnect manually
      // Let's emit error before disconnecting
      client.emit('error', {
        code: WebSocketErrorCode.AUTH_TOKEN_INVALID,
        message: 'Authentication failed: ' + errorMessage,
        category: 'AUTH',
      });
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.tokenLifecycleService.clearTimer(client.id);
    this.healthService.onDisconnect(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
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

  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @SubscribeMessage('chat:send')
  async handleChatMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: ChatSendDto,
  ) {
    try {
      const user = client.data.user;
      if (!user) {
        client.emit('chat:error', { error: 'Unauthorized' });
        return;
      }

      const { sessionId, content, role, model } = payload;

      // DTO validation handles content/sessionId checks now, but double check doesn't hurt logic flow
      // Actually DTO ensures they are present and valid if ValidationPipe works.

      this.logger.log(`Processing message for session ${sessionId}`);

      // Stream the response
      const stream = this.chatService.streamMessage(
        sessionId,
        user.sub,
        content,
        role || ChatRole.USER,
        model,
        payload.parentId,
      );

      let chunkCount = 0;
      for await (const chunk of stream) {
        // If client disconnected, stop streaming to save resources
        if (!client.connected) {
          this.logger.warn(
            `Client ${client.id} disconnected during stream, aborting.`,
          );
          break;
        }
        chunkCount++;
        client.emit('chat:stream', {
          type: 'chunk',
          data: chunk,
        });
      }

      this.logger.log(`Stream completed: ${chunkCount} chunks sent`);

      // Fetch updated session (title might have changed)
      const updatedSession = await this.chatService.getSession(
        sessionId,
        user.sub,
      );
      client.emit('chat:stream', { type: 'done', title: updatedSession.title });
    } catch (error) {
      this.logger.error('Chat stream error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Stream failed';
      client.emit('chat:stream', {
        type: 'error',
        error: errorMessage,
      });
    }
  }
}
