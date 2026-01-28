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
import { Server, Socket, Namespace } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { ChatRole } from '@tainiex/shared-atlas';

import { UsePipes, ValidationPipe } from '@nestjs/common';
import { ChatSendDto } from './dto/chat.dto';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { TokenLifecycleService } from './token-lifecycle.service';
import { ConnectionHealthService } from './connection-health.service';
import { ReliableMessageService } from './reliable-message.service';
import { UseFilters } from '@nestjs/common';
import { WebSocketExceptionFilter } from '../common/filters/websocket-exception.filter';
import { WebSocketErrorCode } from '@tainiex/shared-atlas';

import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { LoggerService } from '../common/logger/logger.service';
import { WebSocketStateMachineService } from '../common/websocket/websocket-state-machine.service';
import { WebSocketMachineRegistry } from '../common/websocket/websocket-machine-registry.service';
import {
  WebSocketStates,
  WebSocketEventTypes,
  ClientEventTypes,
} from '../common/websocket/websocket-state-machine.types';

export interface AuthenticatedSocket extends Socket {
  data: {
    user?: JwtPayload;
  };
}

@WebSocketGateway({
  cors: {
    origin: (requestOrigin, callback) => {
      console.log(`[CORS Check] Incoming Origin: '${requestOrigin}'`);
      // Strict CORS check: Only allow origins defined in environment variables
      // This prevents CSRF and WebSocket Hijacking attacks
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
        console.log(`[CORS Check] Allowed Origin: '${requestOrigin}'`);
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
  namespace: '/api/chat',
  // Tuning for Mobile Stability:
  // Increased timeout to wait for slow mobile network wakeups
  pingInterval: 10000,
  pingTimeout: 20000,
  // Maximize transport reliability
  transports: ['websocket', 'polling'],
  // Streaming optimization: disable compression to reduce latency
  perMessageDeflate: false,
  // HTTP compression is disabled to prevent buffering
  httpCompression: false,
  // Reduce buffering for real-time streaming
  wsEngine: 'ws',
})
@UseFilters(new WebSocketExceptionFilter())
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  // Track active streams by sessionId to allow token refresh reconnection
  private activeStreams = new Map<
    string,
    {
      abortController: AbortController;
      userId: string;
      lastClientId: string;
    }
  >();

  @WebSocketServer()
  server: Namespace;

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatService: ChatService,
    private readonly rateLimitService: RateLimitService,
    private readonly tokenLifecycleService: TokenLifecycleService,
    private readonly healthService: ConnectionHealthService,
    private readonly reliableMsgService: ReliableMessageService,
    private readonly logger: LoggerService,
    private readonly machineService: WebSocketStateMachineService,
    private readonly machineRegistry: WebSocketMachineRegistry,
  ) {
    this.logger.setContext(ChatGateway.name);
  }

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
    const ip = client.handshake.address;

    // 0. Rate Limiting Check (before creating state machine)
    const isAllowed = this.rateLimitService.isAllowed(
      ip,
      ChatGateway.RATE_LIMIT_POINTS,
      ChatGateway.RATE_LIMIT_DURATION,
    );
    if (!isAllowed) {
      this.logger.warn(`Connection rejected: Rate limit exceeded for IP ${ip}`);
      client.disconnect(true);
      return;
    }

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

    // 3. Subscribe to State Changes
    actor.subscribe((snapshot) => {
      this.logger.debug(
        `[${client.id}] State: ${JSON.stringify(snapshot.value)}`,
      );

      // Handle Ready State (Authentication Successful)
      if (snapshot.matches(WebSocketStates.READY)) {
        const user = snapshot.context.user;
        if (user) {
          client.data.user = user;

          this.logger.log(
            `Client connected: ${client.id}, User: ${user.sub} (Via ${client.handshake.auth.token ? 'socket.auth' : client.handshake.headers.authorization ? 'header' : 'cookie'})`,
          );

          // Re-attach active streams to this new client (handle reconnection/refresh)
          for (const [sessionId, streamInfo] of this.activeStreams.entries()) {
            if (streamInfo.userId === user.sub) {
              const oldClientId = streamInfo.lastClientId;
              streamInfo.lastClientId = client.id;
              this.logger.log(
                `[Reconnection] Re-attached active stream for session ${sessionId} to new client ${client.id} (was ${oldClientId})`,
              );
            }
          }

          // Schedule token refresh notification
          this.tokenLifecycleService.scheduleRefreshNotification(client, token);

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
          }, 30000); // 30s

          // Resend Pending Messages
          this.reliableMsgService.resendPending(client, user.sub);
        }
      }

      // Handle Error State
      if (snapshot.matches(WebSocketStates.ERROR)) {
        this.logger.error(
          `WebSocket authentication error for ${client.id}: ${snapshot.context.error}`,
        );
        // Error emission is handled by state machine action
        // Just disconnect the client
        client.disconnect();
      }
    });

    // 4. Start State Machine and Begin Authentication
    actor.send({ type: WebSocketEventTypes.CONNECT, client, token, ip });

    // 5. Perform JWT Verification (Async)
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

      // Strict ID Check
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
      actor.send({
        type: WebSocketEventTypes.AUTH_SUCCESS,
        user: payload,
        expiresAt,
      });
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
    const user = client.data.user;
    if (!user) {
      client.emit(ClientEventTypes.CHAT_ERROR, { error: 'Unauthorized' });
      return;
    }

    const { sessionId, content, role, model } = payload;

    // Check if there's already an active stream for this session
    let streamInfo = this.activeStreams.get(sessionId);

    if (streamInfo) {
      // Stream already exists - check if it's from a different user (security)
      if (streamInfo.userId !== user.sub) {
        this.logger.warn(
          `User ${user.sub} attempted to hijack stream for session ${sessionId} owned by ${streamInfo.userId}`,
        );
        client.emit(ClientEventTypes.CHAT_ERROR, {
          error: 'Unauthorized access to session',
        });
        return;
      }

      // Same user, different client (token refresh) - update client reference
      this.logger.log(
        `Updating stream client for session ${sessionId}: ${streamInfo.lastClientId} -> ${client.id}`,
      );
      streamInfo.lastClientId = client.id;
      // Don't create new stream - this request is duplicate/retry
      return;
    }

    // Create new AbortController for this stream
    const abortController = new AbortController();

    // Register this stream
    streamInfo = {
      abortController,
      userId: user.sub,
      lastClientId: client.id,
    };
    this.activeStreams.set(sessionId, streamInfo);

    // Cleanup function - only abort if this is the final disconnect (not a refresh)
    const disconnectHandler = () => {
      // Give client 2 seconds to reconnect (for token refresh)
      setTimeout(() => {
        const currentStreamInfo = this.activeStreams.get(sessionId);
        if (currentStreamInfo && currentStreamInfo.lastClientId === client.id) {
          // Client didn't reconnect within grace period - abort stream
          // Note: Don't delete activeStreams here, let the finally block handle cleanup
          this.logger.info(
            `[ChatGateway] Client ${client.id} did not reconnect for session ${sessionId}, aborting stream`,
          );
          currentStreamInfo.abortController.abort();
        }
      }, 2000);
    };

    client.once('disconnect', disconnectHandler);

    // DTO validation handles content/sessionId checks now, but double check doesn't hurt logic flow
    // Actually DTO ensures they are present and valid if ValidationPipe works.

    this.logger.log(`Processing message for session ${sessionId}`);
    this.logger.debug(
      `[Stream Start] ClientId: ${client.id}, UserId: ${user.sub}, SessionId: ${sessionId}`,
    );

    // Stream the response
    const stream = this.chatService.streamMessage(
      sessionId,
      user.sub,
      content,
      role || ChatRole.USER,
      model,
      payload.parentId,
      streamInfo.abortController.signal, // Use session-tracked abort signal
    );

    let chunkCount = 0;
    try {
      for await (const event of stream) {
        // Find current client for this session (may have changed due to reconnect)
        const currentStreamInfo = this.activeStreams.get(sessionId);
        if (!currentStreamInfo) {
          this.logger.warn(
            `Stream info lost for session ${sessionId}, aborting`,
          );
          break;
        }

        // Debug: Check server availability
        if (!this.server) {
          this.logger.error(`[CRITICAL] this.server is undefined!`);
          break;
        }

        // Find the connected client (might be different from original)
        // Namespace.sockets is a Map<SocketId, Socket>
        const socketsMap = this.server.sockets as Map<
          string,
          AuthenticatedSocket
        >;

        if (!socketsMap) {
          this.logger.error(`[CRITICAL] this.server.sockets is undefined!`);
          break;
        }

        const targetClient = socketsMap.get(currentStreamInfo.lastClientId);

        if (!targetClient || !targetClient.connected) {
          // Debug: Log all connected clients to diagnose the issue
          const allClients = Array.from(socketsMap.keys());
          this.logger.warn(
            `No connected client for session ${sessionId}. ` +
              `Looking for clientId: ${currentStreamInfo.lastClientId}, ` +
              `Connected clients: [${allClients.join(', ')}], ` +
              `Total connected: ${allClients.length}`,
          );
          // In future: buffer chunks for reconnection
          continue;
        }

        chunkCount++;
        // Forward typed event directly (no wrapping needed)
        targetClient.emit(ClientEventTypes.CHAT_STREAM, event);
        // Force immediate flush
        await new Promise((resolve) => setImmediate(resolve));
      }

      this.logger.log(`Stream completed: ${chunkCount} chunks sent`);

      // Fetch updated session (title might have changed)
      const updatedSession = await this.chatService.getSession(
        sessionId,
        user.sub,
      );

      // Find current client for done event
      const finalStreamInfo = this.activeStreams.get(sessionId);
      const socketsMap = this.server?.sockets as
        | Map<string, AuthenticatedSocket>
        | undefined;
      const finalClient =
        finalStreamInfo && socketsMap
          ? socketsMap.get(finalStreamInfo.lastClientId)
          : client;

      if (finalClient && finalClient.connected) {
        finalClient.emit(ClientEventTypes.CHAT_STREAM, {
          type: 'done',
          title: updatedSession.title,
        });
      }
    } catch (error) {
      this.logger.error(
        'Chat stream error:',
        error instanceof Error ? error.stack : String(error),
      );
      const errorMessage =
        error instanceof Error ? error.message : 'Stream failed';

      // Try to send error to current client
      const errorStreamInfo = this.activeStreams.get(sessionId);
      const errorSocketsMap = this.server?.sockets as
        | Map<string, AuthenticatedSocket>
        | undefined;
      const errorClient =
        errorStreamInfo && errorSocketsMap
          ? errorSocketsMap.get(errorStreamInfo.lastClientId)
          : client;

      if (errorClient && errorClient.connected) {
        errorClient.emit(ClientEventTypes.CHAT_STREAM, {
          type: 'error',
          message: errorMessage,
        });
      }
    } finally {
      // Cleanup: remove disconnect handler and stream tracking
      client.off('disconnect', disconnectHandler);
      this.activeStreams.delete(sessionId);
    }
  }
}
