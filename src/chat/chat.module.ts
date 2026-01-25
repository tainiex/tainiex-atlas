import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ChatSession } from './chat-session.entity';
import { ChatMessage } from './chat-message.entity';
import { ChatMessageHistory } from './chat-message-history.entity';
import { LlmModule } from '../llm/llm.module';
import { TokenWindowContextManager } from './context/token-window.manager';
import { TokenLifecycleService } from './token-lifecycle.service';
import { ConnectionHealthService } from './connection-health.service';
import { ReliableMessageService } from './reliable-message.service';

import { RateLimitModule } from '../rate-limit/rate-limit.module';

import { MemoryModule } from './memory/memory.module';
import { JobQueueModule } from './queue/job-queue.module';
// import { ToolsModule } from '../tools/tools.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatSession, ChatMessage, ChatMessageHistory]),
    LlmModule,
    MemoryModule,
    JobQueueModule,
    RateLimitModule,
    // ToolsModule, // DEPRECATED
  ],
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatGateway,
    TokenLifecycleService,
    ConnectionHealthService,
    ReliableMessageService,
    TokenWindowContextManager,
    {
      provide: 'IContextManager',
      useClass: TokenWindowContextManager,
    },
  ],
  exports: [ChatService],
})
export class ChatModule { }
