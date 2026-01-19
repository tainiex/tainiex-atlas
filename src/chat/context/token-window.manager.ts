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
  ) {}

  async getContext(
    sessionId: string,
    options?: { maxTokens?: number },
  ): Promise<ChatMessage[]> {
    const maxTokens = options?.maxTokens || this.DEFAULT_MAX_TOKENS;
    this.logger.debug(
      `[TokenWindowContextManager] Getting context for session ${sessionId}, limit: ${maxTokens} tokens`,
    );

    // Fetch path using linked list traversal
    const messages = await this.getHistoryPath(sessionId);

    // Messages are returned oldest -> newest by getHistoryPath (unshift)
    // But for token window trimming, we want to iterate reversed (Newest -> Oldest)
    const reversedMessages = [...messages].reverse();

    const contextMessages: ChatMessage[] = [];
    let currentTokens = 0;

    for (const message of reversedMessages) {
      const messageTokens = this.estimateTokens(message.content);

      if (currentTokens + messageTokens > maxTokens) {
        this.logger.debug(
          `[TokenWindowContextManager] Token limit reached. Used: ${currentTokens}, Next msg: ${messageTokens}, Limit: ${maxTokens}`,
        );
        break;
      }

      contextMessages.unshift(message); // Add to front to maintain chronological order
      currentTokens += messageTokens;
    }

    this.logger.debug(
      `[TokenWindowContextManager] Returning ${contextMessages.length} messages (${currentTokens} tokens)`,
    );

    return contextMessages;
  }

  private async getHistoryPath(
    sessionId: string,
    leafMessageId?: string,
  ): Promise<ChatMessage[]> {
    let currentId = leafMessageId;

    if (!currentId) {
      // Find latest by time
      const last = await this.chatMessageRepository.findOne({
        where: { sessionId },
        order: { createdAt: 'DESC' },
      });
      if (!last) return [];
      currentId = last.id;
    }

    const path: ChatMessage[] = [];
    let maxDepth = 100; // Safety break

    while (currentId && currentId !== 'ROOT' && maxDepth > 0) {
      const msg = await this.chatMessageRepository.findOne({
        where: { id: currentId },
      });
      if (!msg) break;

      path.unshift(msg); // Add to beginning (to form chronological order)
      currentId = msg.parentId;

      // Safety: Detect cycles
      if (path.find((p) => p.id === currentId)) {
        break;
      }
      maxDepth--;
    }

    return path;
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
