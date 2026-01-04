import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage } from '../chat-message.entity';
import { IContextManager } from './context-manager.interface';

@Injectable()
export class TokenWindowContextManager implements IContextManager {
    private readonly logger = new Logger(TokenWindowContextManager.name);
    private readonly DEFAULT_MAX_TOKENS = 4000; // Conservative default for most models


    constructor(
        @InjectRepository(ChatMessage)
        private chatMessageRepository: Repository<ChatMessage>,
    ) { }

    async getContext(sessionId: string, options?: { maxTokens?: number }): Promise<ChatMessage[]> {
        const maxTokens = options?.maxTokens || this.DEFAULT_MAX_TOKENS;
        this.logger.debug(`[TokenWindowContextManager] Getting context for session ${sessionId}, limit: ${maxTokens} tokens`);

        // Fetch the last 50 messages (assuming this covers most reasonable contexts)
        // We fetch in descending order to get the newest first
        const messages = await this.chatMessageRepository.find({
            where: { sessionId },
            order: { createdAt: 'DESC' },
            take: 50,
        });

        // Loop from newest to oldest, accumulating tokens until we hit the limit
        const contextMessages: ChatMessage[] = [];
        let currentTokens = 0;

        for (const message of messages) {
            const messageTokens = this.estimateTokens(message.content);

            if (currentTokens + messageTokens > maxTokens) {
                this.logger.debug(`[TokenWindowContextManager] Token limit reached. Used: ${currentTokens}, Next msg: ${messageTokens}, Limit: ${maxTokens}`);
                break;
            }

            contextMessages.push(message);
            currentTokens += messageTokens;
        }

        this.logger.debug(`[TokenWindowContextManager] Returning ${contextMessages.length} messages (${currentTokens} tokens)`);

        // Return in chronological order (oldest to newest) for the LLM
        return contextMessages.reverse();
    }

    private estimateTokens(text: string): number {
        if (!text) return 0;

        let tokenCount = 0;
        for (let i = 0; i < text.length; i++) {
            const code = text.charCodeAt(i);
            // Simple heuristic: CJK characters (and other wide chars) are typically 1 token.
            // ASCII/English characters are typically ~0.25 tokens (4 chars per token).
            if (code > 255) {
                tokenCount += 1;
            } else {
                tokenCount += 0.25;
            }
        }
        return Math.ceil(tokenCount);
    }
}
