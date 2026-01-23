import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ActivityEvent } from './activity.events';

@WebSocketGateway({
  cors: {
    origin: (requestOrigin, callback) => {
      const allowedOrigins = process.env.CORS_ORIGIN;
      if (!allowedOrigins || allowedOrigins === '*') {
        callback(null, true);
      } else {
        const origins = allowedOrigins.split(',');
        if (origins.includes(requestOrigin) || !requestOrigin) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    },
    credentials: true,
  },
  namespace: 'activity',
})
export class ActivityGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ActivityGateway.name);

  constructor(private readonly jwtService: JwtService) { }

  afterInit(server: Server) {
    server.use(async (socket: Socket, next) => {
      try {
        const token = this.extractToken(socket);
        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        const payload = await this.jwtService.verifyAsync(token);
        socket.data.user = payload;
        next();
      } catch (error) {
        next(new Error('Authentication error: Invalid token'));
      }
    });
    this.logger.log('ActivityGateway initialized with Auth Middleware');
  }

  handleConnection(client: Socket) {
    const user = client.data.user;
    const sessionId = client.handshake.query.sessionId as string;

    if (sessionId) {
      void client.join(`session:${sessionId}`);
      this.logger.log(
        `Client ${client.id} (User: ${user?.sub}) joined activity session: ${sessionId}`,
      );
    } else {
      this.logger.log(`Client ${client.id} (User: ${user?.sub}) connected without sessionId`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client ${client.id} disconnected from activity`);
  }

  @OnEvent('activity.status', { async: true })
  handleActivityEvent(event: ActivityEvent) {
    this.server
      .to(`session:${event.sessionId}`)
      .emit('activity:status', event.payload);
    this.logger.verbose(
      `Pushed activity to session:${event.sessionId} - ${event.payload.description}`,
    );
    return Promise.resolve();
  }

  private extractToken(client: Socket): string | undefined {
    let token = client.handshake.auth?.token;

    if (!token && client.handshake.headers.authorization) {
      token = client.handshake.headers.authorization;
    }

    if (!token && client.handshake.headers.cookie) {
      const cookies = client.handshake.headers.cookie.split(';').reduce((acc, curr) => {
        const [name, value] = curr.trim().split('=');
        acc[name] = value;
        return acc;
      }, {} as Record<string, string>);
      token = cookies['access_token'];
    }

    if (token && typeof token === 'string' && token.toLowerCase().startsWith('bearer ')) {
      token = token.slice(7).trim();
    }

    return token;
  }
}
