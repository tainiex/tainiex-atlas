import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ChatSession } from './chat-session.entity';
import { ChatMessage } from './chat-message.entity';
import { LlmService } from '../llm/llm.service';
import { ChatRole } from '@shared/index';
import type { IContextManager } from './context/context-manager.interface';

@Injectable()
export class ChatService {
    constructor(
        @InjectRepository(ChatSession)
        private chatSessionRepository: Repository<ChatSession>,
        @InjectRepository(ChatMessage)
        private chatMessageRepository: Repository<ChatMessage>,
        private llmService: LlmService,
        @Inject('IContextManager')
        private contextManager: IContextManager,
    ) { }

    async createSession(userId: string): Promise<ChatSession> {
        // Explicitly set default title to ensure it is returned in the response
        // and not relying on Database default (which might not be returned by TypeORM save() immediately)
        const session = this.chatSessionRepository.create({ userId, title: 'New Chat' });
        return this.chatSessionRepository.save(session);
    }

    async getUserSessions(userId: string): Promise<ChatSession[]> {
        return this.chatSessionRepository.find({
            where: { userId, isDeleted: false },
            order: { updatedAt: 'DESC' },
        });
    }

    async getSession(sessionId: string, userId: string): Promise<ChatSession> {
        const session = await this.chatSessionRepository.findOne({
            where: { id: sessionId, userId, isDeleted: false }
        });
        if (!session) {
            throw new Error('Session not found or access denied');
        }
        return session;
    }

    async deleteSession(sessionId: string, userId: string): Promise<void> {
        const session = await this.chatSessionRepository.findOne({
            where: { id: sessionId, userId, isDeleted: false }
        });

        if (!session) {
            throw new Error('Session not found or access denied');
        }

        session.isDeleted = true;
        await this.chatSessionRepository.save(session);
    }

    async updateSession(sessionId: string, userId: string, title: string): Promise<ChatSession> {
        const session = await this.getSession(sessionId, userId);
        session.title = title;
        return this.chatSessionRepository.save(session);
    }

    async getSupportedModels() {
        return this.llmService.listModels();
    }

    async getSessionMessages(
        sessionId: string,
        options?: {
            limit?: number;
            before?: string;
        }
    ): Promise<{
        messages: ChatMessage[];
        hasMore: boolean;
        nextCursor: string | null;
    }> {
        const limit = Math.min(options?.limit || 20, 100);

        // 构建查询条件
        const where: any = { sessionId };
        if (options?.before) {
            // 查找 ID < before 的消息（更早的消息）
            where.id = LessThan(options.before);
        }

        // 查询 limit + 1 条，用于判断 hasMore
        const messages = await this.chatMessageRepository.find({
            where,
            order: { createdAt: 'DESC' },  // 最新的在前
            take: limit + 1,
        });

        const hasMore = messages.length > limit;
        const result = messages.slice(0, limit);
        const nextCursor = hasMore ? result[result.length - 1].id : null;

        return {
            messages: result.reverse(), // 反转为时间升序（旧→新）
            hasMore,
            nextCursor,
        };
    }

    async addMessage(sessionId: string, userId: string, content: string, role: ChatRole): Promise<ChatMessage> {
        // ... (existing implementation details) ...
        // Re-implementing to ensure consistency if overwriting file
        const session = await this.chatSessionRepository.findOne({ where: { id: sessionId, userId } });
        if (!session) {
            throw new Error('Session not found or access denied');
        }

        const userMessage = this.chatMessageRepository.create({
            sessionId,
            role,
            content,
        });
        await this.chatMessageRepository.save(userMessage);

        session.updatedAt = new Date();
        await this.chatSessionRepository.save(session);

        if (session.title === 'New Chat') {
            await this.updateSessionTitle(session, content);
        }

        if (role === ChatRole.USER) {
            // For standard addMessage, we might keep blocking behavior or deprecate it in favor of stream.
            // But for now let's keep it blocking for non-stream clients?
            // Actually, the requirement was to make "POST /chat/sessions/:id/messages" streaming.
            // Use generateAiResponse blocking here if this method is called.
            await this.generateAiResponse(sessionId, session);
        }

        return userMessage;
    }

    // New Streaming Method
    async *streamMessage(sessionId: string, userId: string, content: string, role: ChatRole, model?: string): AsyncGenerator<string> {
        console.log('[ChatService] streamMessage called:', { sessionId, userId, content, role });
        // 1. Verify session
        const session = await this.chatSessionRepository.findOne({ where: { id: sessionId, userId } });
        if (!session) throw new Error('Session not found');

        // 2. Save User Message
        const userMessage = this.chatMessageRepository.create({
            sessionId,
            role,
            content,
        });
        await this.chatMessageRepository.save(userMessage);

        // 3. Update Session
        session.updatedAt = new Date();
        await this.chatSessionRepository.save(session);

        // Smart Delay Strategy for Title Generation
        const messageCount = await this.chatMessageRepository.count({ where: { sessionId } });
        // Note: messageCount includes the message we just saved.
        // So for the first message, count is 1.

        let shouldUpdateTitle = false;
        if (session.title === 'New Chat') {
            // Relaxed Logic: Always update if title is "New Chat", regardless of turns
            // But still check length for first message to avoid "Hi" titles
            if (messageCount === 1) {
                if (content.length > 20) {
                    shouldUpdateTitle = true;
                }
            } else {
                // messageCount >= 2: Always update if still default
                shouldUpdateTitle = true;
            }
        }

        let titlePromise: Promise<any> | null = null;
        if (shouldUpdateTitle) {
            console.log('[ChatService] Triggering title update. MessageCount:', messageCount);
            titlePromise = this.updateSessionTitle(session, content);
        } else {
            console.log('[ChatService] Skipping title update. MessageCount:', messageCount, 'Length:', content.length, 'CurrentTitle:', session.title);
        }

        if (role !== ChatRole.USER) {
            console.log('[ChatService] Role is not USER, skipping AI response');
            return;
        }

        console.log('[ChatService] Preparing to call LLM service...');
        // 4. Stream AI Response
        // Use context manager to get sliding window history
        const history = await this.contextManager.getContext(sessionId);

        // Exclude the message we just added? wait, we just saved it.
        // History includes it now. LlmService.streamChat usually takes (history, newMessage).
        // If history has it, we should pass history excluding last?
        // Let's stick to: history = previous messages.
        const previousMessages = history.filter(m => m.id !== userMessage.id);

        let fullAiResponse = '';
        try {
            console.log('[ChatService] Calling llmService.streamChat with', previousMessages.length, 'previous messages');
            const stream = this.llmService.streamChat(
                previousMessages.map(m => ({ role: m.role, message: m.content })),
                content,
                model
            );

            console.log('[ChatService] Stream obtained, starting iteration...');
            for await (const chunk of stream) {
                fullAiResponse += chunk;
                yield chunk;
            }
        } catch (error) {
            console.error('[ChatService] Stream AI Error:', error);
            console.error('[ChatService] Error stack:', error.stack);
            yield `data: [Error: ${error.message}]\n\n`;
            throw error;
        }

        // 5. Save AI Message
        if (fullAiResponse) {
            const aiMessage = this.chatMessageRepository.create({
                sessionId,
                role: ChatRole.ASSISTANT,
                content: fullAiResponse,
            });
            await this.chatMessageRepository.save(aiMessage);
        }

        // Ensure title is updated before finishing
        if (titlePromise) {
            await titlePromise;
        }
    }

    private async generateAiResponse(sessionId: string, session: ChatSession) {
        try {
            const history = await this.contextManager.getContext(sessionId);
            const previousMessages = history.slice(0, -1);
            const lastMessage = history[history.length - 1];

            const responseText = await this.llmService.chat(
                previousMessages.map(m => ({ role: m.role, message: m.content })),
                lastMessage.content
            );

            if (responseText) {
                const aiMessage = this.chatMessageRepository.create({
                    sessionId,
                    role: ChatRole.ASSISTANT,
                    content: responseText,
                });
                await this.chatMessageRepository.save(aiMessage);
            }
        } catch (error) {
            console.error('Failed to generate AI response:', error);
        }
    }

    private async updateSessionTitle(session: ChatSession, lastUserContent: string) {
        try {
            // Get last few messages for context if available
            const recentMessages = await this.chatMessageRepository.find({
                where: { sessionId: session.id },
                order: { createdAt: 'ASC' },
                take: 5
            });

            const contextText = recentMessages.map(m => `${m.role}: ${m.content}`).join('\n');

            const prompt = `Role: You are an expert content summarizer.
Task: Generate a concise, engaging, and descriptive title for a chat session based on the Conversation Context.

Rules:
1. Language: STRICTLY match the language of the User's main intent. (If Chinese, output Chinese. If English, output English).
2. Content: Capture the core intent or topic. Avoid generic phrases like "Question about..." or "Chat with...".
3. Length:
    - English: 3 to 10 words.
    - Chinese: 5 to 20 characters.
4. Format: Plain text only. NO quotes. NO prefixes.

Conversation Context:
"""
${contextText}
"""

Title:`;

            const title = await this.llmService.generateContent(prompt);
            console.log('[ChatService] Generated Title:', title);

            if (title) {
                session.title = title.substring(0, 100); // Increased limit
                await this.chatSessionRepository.save(session);
            }
        } catch (error) {
            console.error('Failed to auto-generate title:', error);
        }
    }

    async regenerateAllTitles() {
        console.log('[ChatService] Starting batch title regeneration...');
        const sessions = await this.chatSessionRepository.find({
            where: { title: 'New Chat', isDeleted: false },
            order: { updatedAt: 'DESC' }
        });

        console.log(`[ChatService] Found ${sessions.length} sessions with default title.`);

        let processed = 0;
        for (const session of sessions) {
            const count = await this.chatMessageRepository.count({ where: { sessionId: session.id } });
            if (count > 0) {
                await this.updateSessionTitle(session, '');
                processed++;
                console.log(`[ChatService] Updated title for session ${session.id} (${processed}/${sessions.length})`);
            }
        }
        return { processed, total: sessions.length };
    }
}
