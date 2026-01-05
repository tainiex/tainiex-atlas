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
import { Logger } from '@nestjs/common';

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

    private connectionCounts = new Map<string, number[]>();

    constructor(
        private readonly jwtService: JwtService,
        private readonly chatService: ChatService
    ) { }

    afterInit(server: Server) {
        this.logger.log('WebSocket Gateway initialized successfully');

        // Clean up connection counts periodically to prevent memory leak
        setInterval(() => {
            this.cleanupConnectionCounts();
        }, 60000); // Every minute
    }

    async handleConnection(client: AuthenticatedSocket) {
        try {
            // 0. Rate Limiting Check
            const ip = client.handshake.address;
            if (this.isRateLimited(ip)) {
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

    private isRateLimited(ip: string): boolean {
        const now = Date.now();
        const windowMs = 60 * 1000; // 1 minute
        const limit = 10; // Max connections per minute

        let timestamps = this.connectionCounts.get(ip) || [];
        // Filter out old timestamps
        timestamps = timestamps.filter(time => now - time < windowMs);

        if (timestamps.length >= limit) {
            return true;
        }

        timestamps.push(now);
        this.connectionCounts.set(ip, timestamps);
        return false;
    }

    private cleanupConnectionCounts() {
        const now = Date.now();
        const windowMs = 60 * 1000;
        for (const [ip, timestamps] of this.connectionCounts.entries()) {
            const validTimestamps = timestamps.filter(time => now - time < windowMs);
            if (validTimestamps.length === 0) {
                this.connectionCounts.delete(ip);
            } else {
                this.connectionCounts.set(ip, validTimestamps);
            }
        }
    }

    handleDisconnect(client: AuthenticatedSocket) {
        this.logger.log(`Client disconnected: ${client.id}`);
    }

    @SubscribeMessage('chat:send')
    async handleChatMessage(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() payload: ChatSendPayload
    ) {
        try {
            const user = client.data.user;
            if (!user) {
                client.emit('chat:error', { error: 'Unauthorized' });
                return;
            }

            const { sessionId, content, role, model } = payload;

            if (!content || !sessionId) {
                client.emit('chat:error', { error: 'Missing required fields' });
                return;
            }

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
