import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ChatSession } from './chat-session.entity';
import { ChatMessage } from './chat-message.entity';
import { LlmModule } from '../llm/llm.module';
import { TokenWindowContextManager } from './context/token-window.manager';



import { RateLimitModule } from '../rate-limit/rate-limit.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([ChatSession, ChatMessage]),
        LlmModule, // Import LlmModule to use LlmService
        RateLimitModule,
    ],
    controllers: [ChatController],
    providers: [
        ChatService,
        ChatGateway,
        TokenWindowContextManager,
        {
            provide: 'IContextManager',
            useClass: TokenWindowContextManager,
        },
    ],
    exports: [ChatService],
})
export class ChatModule { }
