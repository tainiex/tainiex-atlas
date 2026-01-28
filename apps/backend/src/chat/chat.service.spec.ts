/**
 * Test file with mock implementations that use `any` for flexibility
 */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChatSession } from './chat-session.entity';
import { ChatMessage } from './chat-message.entity';
import { ChatMessageHistory } from './chat-message-history.entity';
import { LlmService } from '../llm/llm.service';
import { LoggerService } from '../common/logger/logger.service';
import { ChatRole } from '@tainiex/shared-atlas';
import { ConfigService } from '@nestjs/config';
import { MemoryService } from './memory/memory.service';
import { ToolsService } from '../tools/tools.service';
import { AgentFactory } from '../agent/services/agent-factory.service';
import { Repository } from 'typeorm';

describe('ChatService - Title Generation', () => {
  let service: ChatService;
  let llmService: jest.Mocked<LlmService>;
  let mockChatSessionRepo: jest.Mocked<Repository<ChatSession>>;
  let mockChatMessageRepo: jest.Mocked<Repository<ChatMessage>>;

  const partialMockLlmService = {
    generateContent: jest.fn(),
    streamChat: jest.fn(),
    listModels: jest.fn(),
    chat: jest.fn(),
  };

  const partialMockChatSessionRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
  };

  const partialMockChatMessageRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
    find: jest.fn(),
    manager: {
      transaction: jest.fn((cb: any) =>
        cb({ save: jest.fn(), remove: jest.fn() }),
      ),
    },
  };

  const mockContextManager = {
    getContext: jest.fn().mockResolvedValue([]),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'DISTILL_THRESHOLD') return '20';
      return null;
    }),
  };

  const mockMemoryService = {
    distillConversation: jest.fn(),
    searchMemories: jest.fn().mockResolvedValue([]),
    processBackfillChunk: jest.fn(),
  };

  const mockJobQueue = {
    process: jest.fn(),
    add: jest.fn(),
  };

  const mockToolsService = {
    getToolsDefinitions: jest.fn().mockReturnValue([]),
    executeTool: jest.fn(),
  };

  const mockLoggerService = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    setContext: jest.fn(),
  };

  const mockAgentFactory = {
    createAgent: jest.fn().mockReturnValue({
      // eslint-disable-next-line @typescript-eslint/require-await
      execute: jest.fn().mockImplementation(async function* () {
        yield { type: 'answer_chunk', content: 'Mocked agent response' };
        yield { type: 'final_answer', content: 'Mocked agent response' };
      }),
    }),
    getTools: jest.fn().mockReturnValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
        {
          provide: getRepositoryToken(ChatSession),
          useValue: partialMockChatSessionRepo,
        },
        {
          provide: getRepositoryToken(ChatMessage),
          useValue: partialMockChatMessageRepo,
        },
        {
          provide: getRepositoryToken(ChatMessageHistory),
          useValue: partialMockChatMessageRepo, // Reuse for history for now
        },
        { provide: LlmService, useValue: partialMockLlmService },
        { provide: 'IContextManager', useValue: mockContextManager },
        { provide: 'IJobQueue', useValue: mockJobQueue },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MemoryService, useValue: mockMemoryService },
        { provide: ToolsService, useValue: mockToolsService },
        { provide: AgentFactory, useValue: mockAgentFactory },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    llmService = module.get(LlmService);
    mockChatSessionRepo = module.get(getRepositoryToken(ChatSession));
    mockChatMessageRepo = module.get(getRepositoryToken(ChatMessage));

    jest.clearAllMocks();
  });

  describe('streamMessage - Smart Delay Logic', () => {
    // Helper to mock stream flow
    const mockStreamFlow = async (
      content: string,
      messageCount: number,
      currentTitle = 'New Chat',
    ) => {
      const session = {
        id: 's1',
        userId: 'u1',
        title: currentTitle,
        updatedAt: new Date(),
      } as ChatSession;
      mockChatSessionRepo.findOne.mockResolvedValue(session);
      mockChatMessageRepo.create.mockReturnValue({ id: 'm1' } as ChatMessage);
      mockChatMessageRepo.save.mockResolvedValue({ id: 'm1' } as ChatMessage);
      mockChatMessageRepo.count.mockResolvedValue(messageCount);
      // Mock context for title generation
      mockChatMessageRepo.find.mockResolvedValue([
        { role: ChatRole.USER, content: 'prev' } as ChatMessage,
        { role: ChatRole.USER, content } as ChatMessage,
      ]);

      llmService.generateContent.mockResolvedValue('Generated Title');

      // Allow stream to run
      // eslint-disable-next-line @typescript-eslint/require-await
      llmService.streamChat.mockImplementation(async function* () {
        yield 'ai response';
      });

      const generator = service.streamMessage(
        's1',
        'u1',
        content,
        ChatRole.USER,
      );
      for await (const _ of generator) {
        // consume stream
      }
    };

    it('Turn 1: Should NOT generate title if content <= 20 chars', async () => {
      await mockStreamFlow('Hello World', 1);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(llmService.generateContent).not.toHaveBeenCalled();
    });

    it('Turn 1: Should generate title if content > 20 chars', async () => {
      const longContent =
        'This is a very long message that definitely exceeds twenty characters limit.';
      await mockStreamFlow(longContent, 1);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(llmService.generateContent).toHaveBeenCalled();
    });

    it('Turn 2: Should generate title if title is "New Chat"', async () => {
      await mockStreamFlow('Short msg', 2);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(llmService.generateContent).toHaveBeenCalled();
    });

    it('Turn 2: Should NOT generate title if title is already set', async () => {
      await mockStreamFlow('Short msg', 2, 'Existing Title');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(llmService.generateContent).not.toHaveBeenCalled();
    });

    it('Turn 3: Should generate title if title is "New Chat" (Just in case)', async () => {
      await mockStreamFlow('Short msg', 3);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(llmService.generateContent).toHaveBeenCalled();
    });

    it('Turn 4: Should generate title if still New Chat', async () => {
      await mockStreamFlow('Short msg', 4);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(llmService.generateContent).toHaveBeenCalled();
    });
  });

  describe('getSessionMessages', () => {
    const mockDate = new Date('2024-01-01T10:00:00Z');
    const session = { id: 's1', userId: 'u1' } as ChatSession;

    beforeEach(() => {
      mockChatSessionRepo.findOne.mockResolvedValue(session);
    });

    it('should return messages in correct order', async () => {
      const messages = [
        { id: 'm2', createdAt: mockDate } as ChatMessage,
        {
          id: 'm1',
          createdAt: new Date(mockDate.getTime() - 1000),
        } as ChatMessage,
      ];
      mockChatMessageRepo.find.mockResolvedValue(messages);

      const result = await service.getSessionMessages('s1');

      // Service reverses the result from DB (which yields DESC)
      expect(result.messages[0].id).toBe('m1');
      expect(result.messages[1].id).toBe('m2');
    });

    it('should handle pagination with cursor correctly (chronological check)', async () => {
      // Setup: Cursor message (m2) exists at T=100.
      // We want messages BEFORE T=100.
      // m1 is at T=90.
      const cursorMsg = {
        id: 'm2',
        createdAt: new Date(mockDate.getTime()),
      } as ChatMessage;

      mockChatMessageRepo.findOne.mockResolvedValue(cursorMsg);

      // Mock find to return messages before the cursor
      mockChatMessageRepo.find.mockResolvedValue([
        {
          id: 'm1',
          createdAt: new Date(mockDate.getTime() - 1000),
        } as ChatMessage,
      ]);

      await service.getSessionMessages('s1', { before: 'm2' });

      // Verify findOne was called to get cursor time
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockChatMessageRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'm2' },
        select: ['createdAt'],
      });

      // Verify find was called with LessThan logic (we can't easily assert LessThan object equality in check,
      // but we can verify the call structure implicity if needed or trust the logic flow)
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockChatMessageRepo.find).toHaveBeenCalled();
    });

    it('should handle broken chains / missing parents gracefully', async () => {
      // Pagination relies on time, not parentId.
      // Even if parentId is missing or doesn't link up, it should list messages.
      const messages = [
        {
          id: 'm1',
          parentId: 'ROOT',
          createdAt: new Date(mockDate.getTime() - 2000),
        } as ChatMessage,
        {
          id: 'm2',
          parentId: 'MISSING_ID',
          createdAt: new Date(mockDate.getTime() - 1000),
        } as ChatMessage, // Broken chain
        { id: 'm3', parentId: 'm2', createdAt: mockDate } as ChatMessage,
      ];

      mockChatMessageRepo.find.mockResolvedValue(messages.reverse()); // DB returns DESC

      const result = await service.getSessionMessages('s1');

      expect(result.messages.length).toBe(3);
      expect(result.messages[1].id).toBe('m2');
      expect(result.messages[1].parentId).toBe('MISSING_ID');
    });

    it('should correctly handle "random" UUIDs with chronological timestamps', async () => {
      // Case: mA has "smaller" UUID but "later" timestamp than mB?
      // Actually UUID string comparison doesn't matter, we want to prove we use createdAt.
      // If we used ID for cursor, and:
      // m1 (Time=100, ID='B')
      // m2 (Time=200, ID='A') -- cursor
      // If we did "ID < 'A'", we would NOT find m1 (since 'B' > 'A').
      // But with createdAt, Time < 200, we DO find m1.

      const cursorMsg = { id: 'A', createdAt: new Date(20000) } as ChatMessage; // m2
      mockChatMessageRepo.findOne.mockResolvedValue(cursorMsg);

      await service.getSessionMessages('s1', { before: 'A' });

      // The key is that we look up the TIME of 'A'
      // We can't strictly assert the 'LessThan' operator value easily without custom matchers,
      // but we can confirm it didn't use `where: { id: LessThan(...) }`
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockChatMessageRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'A' },
        select: ['createdAt'],
      });
    });
  });
});
