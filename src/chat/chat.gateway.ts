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
import type { ChatSendPayload, ChatStreamEvent } from '@shared/index';
import { Logger } from '@nestjs/common';

interface AuthenticatedSocket extends Socket {
    data: {
        user?: any;
    };
}


// Process CORS origins with wildcard support
const corsOriginEnv = process.env.CORS_ORIGIN;
let corsOrigins: string | (string | RegExp)[] = '*';

if (corsOriginEnv) {
    corsOrigins = corsOriginEnv.split(',').map((origin) => {
        const trimmed = origin.trim();
        if (trimmed === '*') return trimmed;
        // If containing wildcard but not just '*', convert to Regex
        if (trimmed.includes('*')) {
            const regexString =
                '^' +
                trimmed.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') +
                '$';
            return new RegExp(regexString);
        }
        return trimmed;
    });
}

@WebSocketGateway({
    cors: {
        origin: corsOrigins,
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
        private readonly chatService: ChatService
    ) { }

    afterInit(server: Server) {
        this.logger.log('WebSocket Gateway initialized successfully');
    }

    async handleConnection(client: AuthenticatedSocket) {
        try {
            // Extract token from handshake auth
            const token = client.handshake.auth.token;
            if (!token) {
                this.logger.warn('Connection rejected: No token provided');
                client.disconnect();
                return;
            }

            // Verify JWT
            const payload = await this.jwtService.verifyAsync(token);
            client.data.user = payload;

            this.logger.log(`Client connected: ${client.id}, User: ${payload.id}`);
        } catch (error) {
            this.logger.error('Authentication failed:', error.message);
            client.disconnect();
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
