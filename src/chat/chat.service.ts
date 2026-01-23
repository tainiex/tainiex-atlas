import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan, FindOptionsWhere } from 'typeorm';
import { ChatSession } from './chat-session.entity';
import { ChatMessage } from './chat-message.entity';
import { ChatMessageHistory } from './chat-message-history.entity';
import { LlmService } from '../llm/llm.service';
import { MemoryService } from './memory/memory.service';
import { ToolsService } from '../tools/tools.service';
import type { IJobQueue } from './queue/job-queue.interface';
import { ChatRole, CHAT_ROOT_PARENT_ID } from '@tainiex/shared-atlas';
import type { IContextManager } from './context/context-manager.interface';
import type {
  ChatMessage as LlmMessage,
  LlmRole,
} from '../llm/adapters/llm-adapter.interface';
import { LoggerService } from '../common/logger/logger.service';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatSession)
    private chatSessionRepository: Repository<ChatSession>,
    @InjectRepository(ChatMessage)
    private chatMessageRepository: Repository<ChatMessage>,
    @InjectRepository(ChatMessageHistory)
    private chatMessageHistoryRepository: Repository<ChatMessageHistory>,
    private llmService: LlmService,
    private memoryService: MemoryService,
    private toolsService: ToolsService, // [NEW] Injected ToolsService
    @Inject('IContextManager')
    private contextManager: IContextManager,
    @Inject('IJobQueue')
    private backfillQueue: IJobQueue<{ sessionId: string; userId: string }>,
    private configService: ConfigService,
    private logger: LoggerService,
  ) {
    this.logger.setContext(ChatService.name);
    // Register Queue Processor
    this.backfillQueue.process(async (job) => {
      await this.processBackfillJob(job.sessionId, job.userId);
    });
  }

  async createSession(userId: string): Promise<ChatSession> {
    // Explicitly set default title to ensure it is returned in the response
    // and not relying on Database default (which might not be returned by TypeORM save() immediately)
    const session = this.chatSessionRepository.create({
      userId,
      title: 'New Chat',
    });
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
      where: { id: sessionId, userId, isDeleted: false },
    });
    if (!session) {
      throw new Error('Session not found or access denied');
    }
    return session;
  }

  async deleteSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.chatSessionRepository.findOne({
      where: { id: sessionId, userId, isDeleted: false },
    });

    if (!session) {
      throw new Error('Session not found or access denied');
    }

    session.isDeleted = true;
    await this.chatSessionRepository.save(session);
  }

  async updateSession(
    sessionId: string,
    userId: string,
    title: string,
  ): Promise<ChatSession> {
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
    },
  ): Promise<{
    messages: ChatMessage[];
    hasMore: boolean;
    nextCursor: string | null;
  }> {
    // [NEW] Trigger Lazy Backfill Check
    // We need to fetch session first to check metadata (or rely on Caller passing it? No, caller is Controller)
    // Optimization: We could fetch Session + Messages in parallel or use loaded session if available.
    // Controller calls getUserSessions which loads ALL sessions.
    // Ideally we should pass the session object to this method to avoid re-fetch,
    // but `getSessionMessages` signature is `sessionId`.
    // Let's do a quick fetch of the session here or in the Controller.

    // Actually, the Controller calls `getUserSessions` first, finds the session, then calls `getSessionMessages`.
    // Let's modify `getSessionMessages` to accept the `session` entity?
    // Or simply fetch it here (cost: 1 DB read).
    // Since we want "Zero Cost", maybe the Controller should call `checkAndTriggerBackfill`
    // because IT has the session object from `getUserSessions`.

    // REVERT: Updated Implementation Plan said "Check !session.metadata.backfill_complete in memory".
    // The Controller has the session list. Let's move the trigger to the Controller?
    // OR: Allow `getSessionMessages` to take `session: ChatSession` as optional arg.

    // Let's stick to the Plan: "User calls GET messages... Backend loads session... if (!meta) queue".
    // I'll update the Controller to do this check since it already has the session object.

    const limit = Math.min(options?.limit || 20, 100);

    // 构建查询条件
    const where: FindOptionsWhere<ChatMessage> = { sessionId };

    if (options?.before) {
      // 必须先获取 cursor 消息的创建时间
      // Must fetch the cursor message's createdAt first
      const cursorMsg = await this.chatMessageRepository.findOne({
        where: { id: options.before },
        select: ['createdAt'], // Optimize selection
      });

      if (cursorMsg) {
        // 查找创建时间早于 cursor 的消息
        // Find messages created before the cursor
        where.createdAt = LessThan(cursorMsg.createdAt);
      } else {
        // Cursor not found? Maybe return empty or just ignore cursor.
        // If cursor is invalid, we might want to return nothing or start from top.
        // Safest for pagination is to return empty if cursor context is lost.
        return { messages: [], hasMore: false, nextCursor: null };
      }
    }

    // 查询 limit + 1 条，用于判断 hasMore
    const messages = await this.chatMessageRepository.find({
      where,
      order: { createdAt: 'DESC' }, // 最新的在前
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

  async addMessage(
    sessionId: string,
    userId: string,
    content: string,
    role: ChatRole,
    parentId?: string,
  ): Promise<ChatMessage> {
    // ... (existing implementation details) ...
    // Re-implementing to ensure consistency if overwriting file
    const session = await this.chatSessionRepository.findOne({
      where: { id: sessionId, userId },
    });
    if (!session) {
      throw new Error('Session not found or access denied');
    }

    // Determine Parent ID
    let actualParentId = parentId;
    if (!actualParentId) {
      const lastMessage = await this.chatMessageRepository.findOne({
        where: { sessionId },
        order: { createdAt: 'DESC' },
      });
      actualParentId = lastMessage ? lastMessage.id : 'ROOT';
    }

    const userMessage = this.chatMessageRepository.create({
      sessionId,
      role,
      content,
      parentId: actualParentId,
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
  async *streamMessage(
    sessionId: string,
    userId: string,
    content: string,
    role: ChatRole,
    model?: string,
    parentId?: string,
  ): AsyncGenerator<string> {
    this.logger.debug(
      `[ChatService] streamMessage called: ${JSON.stringify({
        sessionId,
        userId,
        content,
        role,
        parentId,
      })}`,
    );

    // 1. Verify session
    const session = await this.chatSessionRepository.findOne({
      where: { id: sessionId, userId },
    });
    if (!session) throw new Error('Session not found');

    // [NEW] Trigger Distillation (Buffered)
    // Check session metadata for message count
    const currentMetadata = (session.metadata || {}) as {
      msg_count_since_distill?: number;
      [key: string]: any;
    };
    const msgCount = (currentMetadata.msg_count_since_distill || 0) + 1;
    const DISTILL_THRESHOLD = parseInt(
      this.configService.get('DISTILL_THRESHOLD') || '20',
      10,
    );

    let shouldDistill = false;
    if (msgCount >= DISTILL_THRESHOLD) {
      shouldDistill = true;
      session.metadata = { ...currentMetadata, msg_count_since_distill: 0 };
    } else {
      session.metadata = {
        ...currentMetadata,
        msg_count_since_distill: msgCount,
      };
    }

    this.logger.debug(
      `[ChatService] Distillation Progress: ${msgCount}/${DISTILL_THRESHOLD}`,
    );

    if (shouldDistill) {
      this.logger.debug(
        '[ChatService] Triggering Memory Distillation (Buffered 10 msgs)',
      );
      // Run in background to not block response
      void (async () => {
        try {
          // Fetch recent context for distillation
          // Note: We want the last 30 messages to analyze the recent conversation flow
          const recentMessages = await this.chatMessageRepository.find({
            where: { sessionId },
            order: { createdAt: 'DESC' },
            take: 30,
          });

          // Reverse to chronological order (Oldest -> Newest)
          const context = recentMessages.reverse().map((m) => ({
            role: m.role,
            content: m.content,
          }));

          // Include the current message being processed if it's not saved yet?
          // The current message 'userMessage' is saved at Step 3 (line 214+).
          // This distillation block is at Step 1 (line 181).
          // So 'recentMessages' likely DOES NOT include the current message yet.
          // Let's add the current message to context manually.
          context.push({ role, content });

          // eslint-disable-next-line @typescript-eslint/await-thenable
          await this.memoryService.distillConversation(
            userId,
            sessionId,
            context,
          );
        } catch (e) {
          this.logger.error('[ChatService] Distillation trigger failed', e);
        }
      })();
    }

    // 1. Verify session (Already verified above, but we updated session object)
    // const session = ... (Already loaded)
    if (!session) throw new Error('Session not found');

    // 2. Determine Parent ID
    let actualParentId = parentId;

    if (actualParentId === CHAT_ROOT_PARENT_ID) {
      // Constraint: ROOT is only allowed for the very first message
      // This prevents frontend bugs from "resetting" context by always sending ROOT
      if (msgCount > 0) {
        this.logger.warn(
          `[ChatService] Frontend sent ROOT parentId for non-empty session ${sessionId}. Auto-correcting to latest message.`,
        );
        const lastMessage = await this.chatMessageRepository.findOne({
          where: { sessionId },
          order: { createdAt: 'DESC' },
        });
        actualParentId = lastMessage ? lastMessage.id : CHAT_ROOT_PARENT_ID;
      }
    } else if (actualParentId) {
      // Validate: check if parent exists AND belongs to this session
      const parentMsg = await this.chatMessageRepository.findOne({
        where: { id: actualParentId, sessionId },
        select: ['id'],
      });

      if (!parentMsg) {
        // Security/Integrity Check Failed
        throw new BadRequestException(
          `Invalid parentId: Message ${actualParentId} not found in this session.`,
        );
      }
    } else {
      // Auto-detect: Append to the latest message
      const lastMessage = await this.chatMessageRepository.findOne({
        where: { sessionId },
        order: { createdAt: 'DESC' },
      });
      actualParentId = lastMessage ? lastMessage.id : CHAT_ROOT_PARENT_ID;
    }

    // 3. Save User Message
    const userMessage = this.chatMessageRepository.create({
      sessionId,
      role,
      content,
      parentId: actualParentId,
    });
    await this.chatMessageRepository.save(userMessage);

    // 4. Update Session
    session.updatedAt = new Date();
    await this.chatSessionRepository.save(session);

    // Smart Delay Strategy for Title Generation
    const messageCount = await this.chatMessageRepository.count({
      where: { sessionId },
    });

    let shouldUpdateTitle = false;
    if (session.title === 'New Chat') {
      if (messageCount === 1) {
        if (content.length > 20) {
          shouldUpdateTitle = true;
        }
      } else {
        shouldUpdateTitle = true;
      }
    }

    let titlePromise: Promise<any> | null = null;
    if (shouldUpdateTitle) {
      this.logger.debug(
        `[ChatService] Triggering title update. MessageCount: ${messageCount}`,
      );
      titlePromise = this.updateSessionTitle(session, content);
    } else {
      this.logger.debug(
        `[ChatService] Skipping title update. MessageCount: ${messageCount} Length: ${content.length} CurrentTitle: ${session.title}`,
      );
    }

    if (role !== ChatRole.USER) {
      this.logger.log('[ChatService] Role is not USER, skipping AI response');
      return;
    }

    this.logger.log('[ChatService] Preparing to call LLM service (Agentic Loop)...');

    // 5. Agentic Loop (ReAct)
    const history = await this.contextManager.getContext(sessionId);
    const previousMessages = history.filter((m) => m.id !== userMessage.id);

    // Prepare Tools Definition
    const tools = this.toolsService.getToolsDefinitions();
    const toolsJson = JSON.stringify(tools, null, 2);

    // RAG / Memory Context
    let memoryContext = '';
    try {
      if (content && content.trim().length > 0) {
        const relevantMemories = await this.memoryService.searchMemories(userId, content);
        if (relevantMemories.length > 0) {
          memoryContext = relevantMemories
            .map((m) => `- ${m.content} (Source: ${m.metadata.sourceType})`)
            .join('\n');
        }
      }
    } catch (e) {
      this.logger.error('[ChatService] Memory retrieval failed', e);
    }

    // System Prompt construction
    const dateStr = new Date().toISOString();
    const systemPrompt = `You are Tainiex, an advanced AI assistant powered by Tainiex Atlas.
Current Time: ${dateStr}

You have access to the following tools:
${toolsJson}

RULES:
1. Identity: You are Tainiex.
2. Real-time Data: If asked about real-time data (e.g., weather, stocks, news) and you do not have a tool to retrieve this information, you MUST explicitly state that you cannot provide real-time data. DO NOT fabricate dates, prices, or facts.
3. If the user's request can be answered directly, reply normally.
4. If you need to use a tool, you MUST output ONE JSON object in this EXACT format:
   { "tool": "tool_name", "parameters": { ... } }
5. **IMPORTANT**: Call each tool ONLY ONCE with the best parameters. Do NOT call the same tool multiple times.
6. After using a tool, you will receive the observation. Then you can answer the user.
7. If you use "web_search", cite your sources.

Relevant Memories:
${memoryContext}
`;

    // Initialize Conversation History with System Prompt
    let currentHistory: LlmMessage[] = [
      { role: 'system', message: systemPrompt },
      ...previousMessages.map(m => ({ role: m.role as LlmRole, message: m.content })),
      { role: 'user', message: content } // Current User Message
    ];

    let loopCount = 0;
    const MAX_LOOPS = 5;
    let finalAnswer = '';

    while (loopCount < MAX_LOOPS) {
      loopCount++;
      this.logger.debug(`[AgentLoop] Iteration ${loopCount}/${MAX_LOOPS}`);

      try {
        // Step 1: Call LLM (Planning/Thinking)
        // SPECULATIVE INTENT RECOGNITION
        // User request: Force 'gemini-2.5-flash' for intent recognition to save time.
        const userModel = model || 'gemini-2.5-flash';
        let effectiveModel = userModel;
        let isSpeculativeMode = false;

        if (loopCount === 1 && userModel !== 'gemini-2.5-flash') {
          effectiveModel = 'gemini-2.5-flash';
          isSpeculativeMode = true;
          this.logger.debug(`[AgentLoop] Speculative Intent Recognition with ${effectiveModel}`);
        } else {
          this.logger.debug(`[AgentLoop] Reasoning with model: ${effectiveModel}`);
        }

        const stream = this.llmService.streamChat(currentHistory, '', effectiveModel);

        let accumulatedResponse = '';

        // If we are in "Speculative Mode" (Flash instead of Pro), we MUST BUFFER the output.
        // We cannot yield to the user yet, because if it's NOT a tool call, we might need to discard 
        // this "cheap" response and re-run with the "expensive" model.

        if (isSpeculativeMode) {
          // Buffer completely
          for await (const chunk of stream) {
            accumulatedResponse += chunk;
          }
        } else {
          // Determine if we should stream immediately
          // For subsequent loops (Synthesis), we just stream.
          for await (const chunk of stream) {
            accumulatedResponse += chunk;
            yield chunk;
          }
        }

        // Step 2: Extract ALL tool calls and deduplicate
        const trimmedResponse = accumulatedResponse.trim();
        const toolCalls: Array<{ tool: string; parameters: any }> = [];

        // First try to extract from code block
        const codeBlockMatch = trimmedResponse.match(/```json\n([\s\S]*?)\n```/);
        if (codeBlockMatch) {
          try {
            const parsed = JSON.parse(codeBlockMatch[1]);
            if (parsed.tool && parsed.parameters) {
              toolCalls.push(parsed);
            }
          } catch (e) {
            // Not valid JSON in code block
          }
        }

        // If no code block, find all JSON objects using non-greedy pattern
        if (toolCalls.length === 0) {
          const jsonPattern = /\{[^{}]*?"tool"[^{}]*?"parameters"[^{}]*?\}/g;
          const matches = trimmedResponse.matchAll(jsonPattern);

          for (const match of matches) {
            try {
              const parsed = JSON.parse(match[0]);
              if (parsed.tool && parsed.parameters) {
                toolCalls.push(parsed);
              }
            } catch (e) {
              this.logger.warn(`[AgentLoop] Failed to parse tool call: ${match[0].substring(0, 50)}...`);
            }
          }
        }

        // Deduplicate by tool name - keep only first occurrence
        const uniqueToolCalls = new Map<string, { tool: string; parameters: any }>();
        for (const tc of toolCalls) {
          if (!uniqueToolCalls.has(tc.tool)) {
            uniqueToolCalls.set(tc.tool, tc);
          } else {
            this.logger.warn(`[AgentLoop] Duplicate tool call detected and ignored: ${tc.tool} with params ${JSON.stringify(tc.parameters)}`);
          }
        }

        // Take the first unique tool call
        const toolCall = uniqueToolCalls.size > 0
          ? Array.from(uniqueToolCalls.values())[0]
          : null;

        // SPECULATIVE CHECK:
        // If we used Flash speculatively, and it failed to produce a tool call...
        // It means correct intent was "Chat", so we need to use the User's preferred model (Pro).
        if (isSpeculativeMode && !toolCall) {
          this.logger.log(`[AgentLoop] Speculative Flash thought it was chat. Re-running with ${userModel}...`);
          // Reset loop count so we retry Step 1 with the correct model
          loopCount--;
          // We did NOT yield anything, so client is still waiting.
          continue;
        }

        // If we are here, either:
        // 1. Not speculative (Standard run)
        // 2. Speculative AND Tool call found (Success!)

        if (isSpeculativeMode && toolCall) {
          // If success, we should yield the "Plan" so user sees it?
          // Or we can just skip yielding the JSON and let the Tool Execution event show "Executing..."
          // Let's yield it to be consistent with normal flow (client expects some chunks before tool event?)
          // Actually, if we yield JSON now, it appears as a burst.
          yield accumulatedResponse;
        }

        if (toolCall) {
          // Step 3: Execute Tool
          this.logger.log(`[AgentLoop] Detected Tool Call: ${toolCall.tool}`);

          // NOTIFY USER (Conceptually via yield or ActivityGateway)
          // The ToolsService.executeTool() ALREADY uses @TrackActivity decorator!
          // So ActivityGateway will broadcast valid events automatically.
          // We just need to execute it.

          let toolResult: any;
          try {
            toolResult = await this.toolsService.executeTool(toolCall.tool, toolCall.parameters);
          } catch (err) {
            toolResult = `Error: ${err.message}`;
          }

          const observation = JSON.stringify(toolResult);
          this.logger.debug(`[AgentLoop] Tool Output: ${observation.substring(0, 100)}...`);

          // Step 4: Update History
          // Add the Assistant's Tool Request
          currentHistory.push({ role: 'assistant', message: trimmedResponse });
          // Add the Tool Output (Observation)
          currentHistory.push({ role: 'tool', message: observation }); // Using new 'tool' role

          // Continue loop to let LLM process the observation
          continue;
        } else {
          // Step 5: Final Answer
          // If it's not a tool call, assuming it's the final answer (or a question for user).
          // Since we already yielded the chunks, we are done.
          finalAnswer = accumulatedResponse;
          break;
        }

      } catch (error) {
        this.logger.error('[AgentLoop] Error:', error);
        yield `\n[System Error: ${error.message}]`;
        throw error;
      }
    }

    if (loopCount >= MAX_LOOPS) {
      yield '\n[System: Max iterations reached. Stopping execution.]';
    }

    // 5. Save AI Message (The FINAL response, or the accumulation of the Agent's journey?)
    // If we want to save the "Thought Process", we should save the final answer.
    // Ideally we save the whole chain, but chat UI usually expects 1 response per 1 request.
    // Let's save the 'finalAnswer' (the last text block).
    // The intermediate steps are ephemeral (or we should save them as a single big message?)
    // Saving only the final answer keeps history clean.

    if (finalAnswer) {
      const aiMessage = this.chatMessageRepository.create({
        sessionId,
        role: ChatRole.ASSISTANT,
        content: finalAnswer, // Only save the final text? 
        // If we want to persist the "Tool Usage" history, we need a better DB schema/Agent Memory.
        // For now, saving the last response is standard for simple Chatbots.
        // Or we concatenate? "Used tool A. Result... Final Answer".
        parentId: userMessage.id,
      });
      await this.chatMessageRepository.save(aiMessage);
    }

    // Ensure title is updated before finishing
    if (titlePromise) {
      await titlePromise;
    }
  }

  private async generateAiResponse(sessionId: string, _session: ChatSession) {
    try {
      const history = await this.contextManager.getContext(sessionId);
      const previousMessages = history.slice(0, -1);
      const lastMessage = history[history.length - 1];

      const responseText = await this.llmService.chat(
        previousMessages.map((m) => ({ role: m.role, message: m.content })),
        lastMessage.content,
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
      this.logger.error('Failed to generate AI response:', error);
    }
  }

  private async updateSessionTitle(
    session: ChatSession,
    _lastUserContent: string,
  ) {
    try {
      // Get last few messages for context if available
      const recentMessages = await this.chatMessageRepository.find({
        where: { sessionId: session.id },
        order: { createdAt: 'ASC' },
        take: 5,
      });

      const contextText = recentMessages
        .map((m) => `${m.role}: ${m.content}`)
        .join('\n');

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
      this.logger.log('[ChatService] Generated Title:', title);

      if (title) {
        session.title = title.substring(0, 100); // Increased limit
        await this.chatSessionRepository.save(session);
      }
    } catch (error) {
      this.logger.error('Failed to auto-generate title:', error);
    }
  }

  async regenerateAllTitles() {
    this.logger.log('[ChatService] Starting batch title regeneration...');
    const sessions = await this.chatSessionRepository.find({
      where: { title: 'New Chat', isDeleted: false },
      order: { updatedAt: 'DESC' },
    });

    this.logger.debug(
      `[ChatService] Found ${sessions.length} sessions with default title.`,
    );

    let processed = 0;
    for (const session of sessions) {
      const count = await this.chatMessageRepository.count({
        where: { sessionId: session.id },
      });
      if (count > 0) {
        await this.updateSessionTitle(session, '');
        processed++;
        this.logger.debug(
          `[ChatService] Updated title for session ${session.id} (${processed}/${sessions.length})`,
        );
      }
    }
    return { processed, total: sessions.length };
  }

  async updateMessage(
    sessionId: string,
    userId: string,
    messageId: string,
    newContent: string,
  ): Promise<ChatMessage> {
    // 1. Verify Access
    const session = await this.chatSessionRepository.findOne({
      where: { id: sessionId, userId },
    });
    if (!session) throw new Error('Session not found');

    const message = await this.chatMessageRepository.findOne({
      where: { id: messageId, sessionId },
    });
    if (!message) throw new Error('Message not found');

    // Allow updates to AI messages? Protocol says "Editing a message" -> implies User editing their own.
    // But maybe we want to correct AI too. Let's allow all for now.

    // 2. Transactional Update: Archive -> Update
    return this.chatMessageRepository.manager.transaction(
      async (transactionalEntityManager) => {
        // A. Archive current state
        const historyEntry = this.chatMessageHistoryRepository.create({
          messageId: message.id,
          role: message.role,
          content: message.content, // Old content
          // archivedAt handled by default
        });
        // Use transactional EM
        await transactionalEntityManager.save(ChatMessageHistory, historyEntry);

        // B. Update Message
        message.content = newContent;
        // Should we update createdAt? No. UpdatedAt? Entity doesn't have it explicitly, schema usually does.
        // If we want to show "Edited", frontend can check history table existence or we add `is_edited` col later.
        await transactionalEntityManager.save(ChatMessage, message);

        return message;
      },
    );
  }

  /**
   * Update a user message and regenerate AI response
   * This is used when user wants to edit their message and get a new AI reply
   */
  async *updateMessageAndRegenerate(
    sessionId: string,
    userId: string,
    messageId: string,
    newContent: string,
    model?: string,
  ): AsyncGenerator<string> {
    this.logger.debug(
      `[ChatService] updateMessageAndRegenerate called: ${JSON.stringify({
        sessionId,
        userId,
        messageId,
        newContent,
      })}`,
    );

    // 1. Verify Access
    const session = await this.chatSessionRepository.findOne({
      where: { id: sessionId, userId },
    });
    if (!session) throw new Error('Session not found');

    const message = await this.chatMessageRepository.findOne({
      where: { id: messageId, sessionId },
    });
    if (!message) throw new Error('Message not found');

    // Only allow editing USER messages
    if (message.role !== ChatRole.USER) {
      throw new Error('Only user messages can be edited and regenerated');
    }

    // 2. Archive and Update User Message (in transaction)
    await this.chatMessageRepository.manager.transaction(
      async (transactionalEntityManager) => {
        // Archive current state
        const historyEntry = this.chatMessageHistoryRepository.create({
          messageId: message.id,
          role: message.role,
          content: message.content, // Old content
        });
        await transactionalEntityManager.save(ChatMessageHistory, historyEntry);

        // Update Message
        message.content = newContent;
        await transactionalEntityManager.save(ChatMessage, message);
      },
    );

    this.logger.log('[ChatService] User message updated and archived');

    // 3. Find AI reply (child message with parent_id = messageId)
    const aiReply = await this.chatMessageRepository.findOne({
      where: {
        sessionId,
        parentId: messageId,
        role: ChatRole.ASSISTANT,
      },
      order: { createdAt: 'ASC' },
    });

    // 4. If AI reply exists, archive and delete it
    if (aiReply) {
      this.logger.debug(
        '[ChatService] Found existing AI reply, archiving and deleting...',
      );

      await this.chatMessageRepository.manager.transaction(
        async (transactionalEntityManager) => {
          // Archive AI reply
          const aiHistoryEntry = this.chatMessageHistoryRepository.create({
            messageId: aiReply.id,
            role: aiReply.role,
            content: aiReply.content,
          });
          await transactionalEntityManager.save(
            ChatMessageHistory,
            aiHistoryEntry,
          );

          // Delete AI reply
          await transactionalEntityManager.remove(ChatMessage, aiReply);
        },
      );

      this.logger.log('[ChatService] Old AI reply archived and deleted');
    }

    // 5. Get context (from updated message backwards)
    // TokenWindowManager will automatically traverse from the edited message
    const history = await this.contextManager.getContext(sessionId);

    // Filter out the message we just edited (it's already updated)
    const previousMessages = history.filter((m) => m.id !== messageId);

    this.logger.debug(
      `[ChatService] Got context with ${previousMessages.length} previous messages`,
    );

    // 6. Stream new AI response
    let fullAiResponse = '';
    try {
      this.logger.log('[ChatService] Calling llmService.streamChat...');
      const stream = this.llmService.streamChat(
        previousMessages.map((m) => ({ role: m.role, message: m.content })),
        newContent, // The updated user message content
        model,
      );

      this.logger.log('[ChatService] Stream obtained, starting iteration...');
      for await (const chunk of stream) {
        fullAiResponse += chunk;
        yield chunk;
      }
    } catch (error) {
      this.logger.error('[ChatService] Stream AI Error:', error);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      this.logger.error('[ChatService] Error stack:', error.stack);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      yield `data: [Error: ${error.message}]\n\n`;
      throw error;
    }

    // 7. Save new AI Message
    if (fullAiResponse) {
      const newAiMessage = this.chatMessageRepository.create({
        sessionId,
        role: ChatRole.ASSISTANT,
        content: fullAiResponse,
        parentId: messageId, // Reply to the updated user message
      });
      await this.chatMessageRepository.save(newAiMessage);
      this.logger.log('[ChatService] New AI message saved');
    }

    // 8. Update session timestamp
    session.updatedAt = new Date();
    await this.chatSessionRepository.save(session);
  }

  // New Linear Context Retrieval (Traverse Backwards)
  // If leafId is provided, traverse from there.
  // If not, try to find the "latest" based on time (for backward compat or simple usage)

  // ============================================
  // Historical Memory Backfill Logic
  // ============================================

  /**
   * Triggered when user loads session history (Zero-cost check in memory)
   */
  async checkAndTriggerBackfill(sessionId: string, session: ChatSession) {
    // 1. Fast Exit: If already marked complete, skip
    if (session.metadata?.backfill_complete === true) {
      this.logger.debug(
        `[Backfill] Session ${sessionId} already complete. Skipping check.`,
      );
      return;
    }

    // 2. Enqueue Job
    // The queue handles deduplication or we can rely on idempotency of the logic
    this.logger.log(
      `[Backfill] Triggering backfill check for session ${sessionId}. Metadata: ${JSON.stringify(session.metadata)}`,
    );
    await this.backfillQueue.add({ sessionId, userId: session.userId });
  }

  private async processBackfillJob(sessionId: string, userId: string) {
    const session = await this.chatSessionRepository.findOne({
      where: { id: sessionId },
    });
    if (!session || session.userId !== userId) {
      this.logger.warn(
        `[Backfill] Session ${sessionId} invalid or not found during job processing.`,
      );
      return;
    }

    // Double-check complete flag
    if (session.metadata?.backfill_complete === true) {
      this.logger.debug(
        `[Backfill] Job skipped, session ${sessionId} already marked complete.`,
      );
      return;
    }

    const lastProcessedId =
      (session.metadata?.last_backfilled_message_id as string | null) || null;

    this.logger.log(
      `[Backfill] Worker processing backfill for ${sessionId}. LastID: ${lastProcessedId}`,
    );

    // Callback to fetch messages (Keeping DB logic in ChatService)
    const messageFetcher = async (
      sid: string,
      lastId: string | null,
      limit: number,
    ) => {
      const where: FindOptionsWhere<ChatMessage> = { sessionId: sid };
      if (lastId) {
        where.id = MoreThan(lastId);
      }
      return this.chatMessageRepository.find({
        where,
        order: { createdAt: 'ASC' }, // Chronological
        take: limit,
        select: ['id', 'role', 'content'],
      });
    };

    const newCheckpoint = await this.memoryService.processBackfillChunk(
      userId,
      sessionId,
      lastProcessedId,
      messageFetcher,
    );

    // Update Session Metadata
    if (newCheckpoint) {
      // Checkpoint updated - More chunks might be needed, handled by recursive queue logic if implemented in Service
      // BUT: Our design was "Recursive Job".
      // In InMemoryQueue, I implemented recursiveness via "processNext".
      // Here we need to decide: Does "processBackfillChunk" recurse?
      // The MemoryService returns 'newCheckpoint' if it did work.
      // If it returns 'null', it means it fetched 0 messages (caught up).

      // Update DB
      session.metadata = {
        ...session.metadata,
        last_backfilled_message_id: newCheckpoint,
      };
      await this.chatSessionRepository.save(session);

      // Enqueue Next Chunk
      await this.backfillQueue.add({ sessionId, userId });
    } else {
      // Caught up!
      session.metadata = {
        ...session.metadata,
        backfill_complete: true,
      };
      await this.chatSessionRepository.save(session);
      this.logger.log(
        `[ChatService] Backfill complete for session ${sessionId}`,
      );
    }
  }

  // New Linear Context Retrieval (Traverse Backwards)
  // If leafId is provided, traverse from there.
  // If not, try to find the "latest" based on time (for backward compat or simple usage)
  async getHistoryPath(
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

      // Safety: Detect cycles? (A->B->A).
      if (path.find((p) => p.id === currentId)) {
        console.error(
          '[ChatService] Cycle detected in message chain',
          sessionId,
        );
        break;
      }
      maxDepth--;
    }

    return path;
  }
}
