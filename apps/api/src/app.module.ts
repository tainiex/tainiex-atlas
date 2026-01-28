import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { InvitationCode } from './invitation/invitation-code.entity';
import { InvitationModule } from './invitation/invitation.module';
import { User } from './users/user.entity';
import { LlmModule } from './llm/llm.module';
import { ChatModule } from './chat/chat.module';
import { ChatSession } from './chat/chat-session.entity';
import { ChatMessage } from './chat/chat-message.entity';
import { LoggerModule } from './common/logger/logger.module';
import { ActivityModule } from './common/activity/activity.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { RateLimitEntry } from './rate-limit/rate-limit.entity';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { NotesModule } from './notes/notes.module';
import {
  Note,
  Block,
  BlockVersion,
  NoteSnapshot,
  NoteTemplate,
  DocumentState,
} from './notes/entities';
import { StorageModule } from './common/storage/storage.module';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthModule } from './health/health.module';
import { SemanticMemory } from './chat/memory/entities/memory.entity';
import { GraphModule } from './graph/graph.module';
import { GraphNode } from './graph/entities/graph-node.entity';
import { GraphEdge } from './graph/entities/graph-edge.entity';
import { AppConfigModule } from './common/config/config.module';
import { WebSocketModule } from './common/websocket/websocket.module';
import { AgentModule } from './agent/agent.module';

@Module({
  imports: [
    AppConfigModule, // Import global config module first
    LoggerModule,
    ActivityModule,
    WebSocketModule, // WebSocket state machine module (Global)
    HealthModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const isProd = configService.get('NODE_ENV') === 'production';
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const dbSsl = configService.get('DB_SSL');
        // Default to true in production if not explicitly set
        const enableSsl = dbSsl !== undefined ? dbSsl === 'true' : isProd;

        return {
          type: 'postgres',
          host: configService.get<string>('DB_HOST', 'localhost'),
          port: configService.get<number>('DB_PORT', 5432),
          username: configService.get<string>('DB_USERNAME', 'postgres'),
          password: configService.get<string>('DB_PASSWORD', 'postgres'),
          database: configService.get<string>('DB_NAME', 'tainiex_core'),
          entities: [
            User,
            InvitationCode,
            ChatSession,
            ChatMessage,
            RateLimitEntry,
            SemanticMemory, // Add this line
            // Notes System Entities
            Note,
            Block,
            BlockVersion,
            NoteSnapshot,
            NoteTemplate,
            DocumentState,
            // Graph Entities
            GraphNode,
            GraphEdge,
          ],
          synchronize: false, // Strict: Migrations only for all environments
          ssl: enableSsl ? { rejectUnauthorized: false } : false,
        };
      },
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 60, // 60 requests
      },
    ]),
    UsersModule,
    AuthModule,
    LlmModule,
    InvitationModule,
    ChatModule,
    RateLimitModule,
    StorageModule,
    NotesModule,
    GraphModule,
    AgentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
