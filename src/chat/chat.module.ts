import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatSession } from './chat-session.entity';
import { ChatMessage } from './chat-message.entity';
import { LlmModule } from '../llm/llm.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([ChatSession, ChatMessage]),
        LlmModule, // Import LlmModule to use LlmService
    ],
    controllers: [ChatController],
    providers: [ChatService],
    exports: [ChatService],
})
export class ChatModule { }
