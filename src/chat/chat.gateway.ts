
import {
    WebSocketGateway,
    SubscribeMessage,
    MessageBody,
    WebSocketServer,
    ConnectedSocket,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { ChatRole } from '@shared/index';
import type { ChatSendPayload, ChatStreamEvent, ChatErrorPayload } from '@shared/index';
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { ChatSendDto } from './dto/chat.dto';
import { RateLimitService } from '../rate-limit/rate-limit.service';

interface AuthenticatedSocket extends Socket {
    data: {
        user?: any;
    };
}

@WebSocketGateway({
    cors: {
        origin: (requestOrigin, callback) => {
            // Strict CORS check: Only allow origins defined in environment variables
            // This prevents CSRF and WebSocket Hijacking attacks
            const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map(o => o.trim());

            if (!requestOrigin || allowedOrigins.includes(requestOrigin)) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true
    },
    namespace: '/api/chat'
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(ChatGateway.name);

    constructor(
        private readonly jwtService: JwtService,
        private readonly chatService: ChatService,
        private readonly rateLimitService: RateLimitService
    ) { }

    afterInit(server: Server) {
        this.logger.log('WebSocket Gateway initialized successfully');
    }

    // Constants for Rate Limiting
    private static readonly RATE_LIMIT_POINTS = 10; // Max requests
    private static readonly RATE_LIMIT_DURATION = 60; // Window in seconds

    async handleConnection(client: AuthenticatedSocket) {
        try {
            // 0. Rate Limiting Check (Database)
            const ip = client.handshake.address;
            const isAllowed = await this.rateLimitService.isAllowed(
                ip,
                ChatGateway.RATE_LIMIT_POINTS,
                ChatGateway.RATE_LIMIT_DURATION
            );
            if (!isAllowed) {
                this.logger.warn(`Connection rejected: Rate limit exceeded for IP ${ip}`);
                client.disconnect(true);
                return;
            }

            // 1. Try to get token from handshake auth (standard socket.io)
            let token = client.handshake.auth.token;

            // 2. Fallback: Parse token from cookies (for browser-based clients)
            if (!token && client.handshake.headers.cookie) {
                const cookies = client.handshake.headers.cookie.split(';').reduce((acc, curr) => {
                    const [name, value] = curr.trim().split('=');
                    acc[name] = value;
                    return acc;
                }, {} as Record<string, string>);

                token = cookies['access_token'];
            }

            if (!token) {
                this.logger.warn('Connection rejected: No token provided in auth or cookies');
                client.disconnect();
                return;
            }

            // Verify JWT
            const payload = await this.jwtService.verifyAsync(token);

            // Strict ID Check
            const userId = payload.sub || payload.id; // Support both but prefer sub
            if (!userId) {
                throw new Error('Invalid token payload: User ID missing');
            }

            payload.id = userId; // Ensure .id is available for legacy code if needed
            client.data.user = payload;

            this.logger.log(`Client connected: ${client.id}, User: ${userId} (Via ${client.handshake.auth.token ? 'auth' : 'cookie'})`);
        } catch (error) {
            this.logger.error('Authentication failed:', error.message);
            client.disconnect();
        }
    }

    handleDisconnect(client: AuthenticatedSocket) {
        this.logger.log(`Client disconnected: ${client.id}`);
    }

    @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
    @SubscribeMessage('chat:send')
    async handleChatMessage(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() payload: ChatSendDto
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
                user.id,
                content,
                role || ChatRole.USER,
                model
            );

            let chunkCount = 0;
            for await (const chunk of stream) {
                chunkCount++;
                client.emit('chat:stream', {
                    type: 'chunk',
                    data: chunk
                });
            }

            this.logger.log(`Stream completed: ${chunkCount} chunks sent`);
            client.emit('chat:stream', { type: 'done' });

        } catch (error) {
            this.logger.error('Chat stream error:', error);
            client.emit('chat:stream', {
                type: 'error',
                error: error.message || 'Stream failed'
            });
        }
    }
}
