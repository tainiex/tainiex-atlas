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
import { ThrottlerModule } from '@nestjs/throttler';
import { RateLimitEntry } from './rate-limit/rate-limit.entity';
import { RateLimitModule } from './rate-limit/rate-limit.module';

@Module({
  imports: [
    LoggerModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const isProd = configService.get('NODE_ENV') === 'production';
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
          entities: [User, InvitationCode, ChatSession, ChatMessage, RateLimitEntry],
          synchronize: !isProd, // Auto-create tables (dev only)
          ssl: enableSsl ? { rejectUnauthorized: false } : false,
        };
      },
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([{
      ttl: 1000,
      limit: 2,
    }]),
    UsersModule,
    AuthModule,
    LlmModule,
    InvitationModule,
    ChatModule,
    RateLimitModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
