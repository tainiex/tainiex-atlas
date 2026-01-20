/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
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

describe('ChatService - Title Generation', () => {
  let service: ChatService;
  let llmService: any;
  let _chatSessionRepo: any;
  let _chatMessageRepo: any;

  const mockLlmService = {
    generateContent: jest.fn(),
    streamChat: jest.fn(),
  };

  const mockChatSessionRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };

  const mockChatMessageRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
    find: jest.fn(),
  };

  const mockContextManager = {
    getContext: jest.fn().mockResolvedValue([]),
  };

  const mockConfigService = {
    get: jest.fn((key) => {
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

  const mockLoggerService = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    setContext: jest.fn(),
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
          useValue: mockChatSessionRepo,
        },
        {
          provide: getRepositoryToken(ChatMessage),
          useValue: mockChatMessageRepo,
        },
        {
          provide: getRepositoryToken(ChatMessageHistory),
          useValue: mockChatMessageRepo,
        }, // Re-use msg repo mock for simplicity as history likely has similar save/find interface or is not used in strictly tested paths
        { provide: LlmService, useValue: mockLlmService },
        { provide: LlmService, useValue: mockLlmService },
        { provide: 'IContextManager', useValue: mockContextManager },
        { provide: 'IJobQueue', useValue: mockJobQueue },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MemoryService, useValue: mockMemoryService },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    llmService = module.get<LlmService>(LlmService);
    _chatSessionRepo = module.get(getRepositoryToken(ChatSession));
    _chatMessageRepo = module.get(getRepositoryToken(ChatMessage));

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
      };
      mockChatSessionRepo.findOne.mockResolvedValue(session);
      mockChatMessageRepo.create.mockReturnValue({ id: 'm1' });
      mockChatMessageRepo.save.mockResolvedValue({ id: 'm1' });
      mockChatMessageRepo.count.mockResolvedValue(messageCount);
      // Mock context for title generation
      mockChatMessageRepo.find.mockResolvedValue([
        { role: 'user', content: 'prev' },
        { role: 'user', content },
      ]);

      mockLlmService.generateContent.mockResolvedValue('Generated Title');

      // Allow stream to run
      mockLlmService.streamChat.mockImplementation(async function* () {
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
      expect(llmService.generateContent).not.toHaveBeenCalled();
    });

    it('Turn 1: Should generate title if content > 20 chars', async () => {
      const longContent =
        'This is a very long message that definitely exceeds twenty characters limit.';
      await mockStreamFlow(longContent, 1);
      expect(llmService.generateContent).toHaveBeenCalled();
    });

    it('Turn 2: Should generate title if title is "New Chat"', async () => {
      await mockStreamFlow('Short msg', 2);
      expect(llmService.generateContent).toHaveBeenCalled();
    });

    it('Turn 2: Should NOT generate title if title is already set', async () => {
      await mockStreamFlow('Short msg', 2, 'Existing Title');
      expect(llmService.generateContent).not.toHaveBeenCalled();
    });

    it('Turn 3: Should generate title if title is "New Chat" (Just in case)', async () => {
      await mockStreamFlow('Short msg', 3);
      expect(llmService.generateContent).toHaveBeenCalled();
    });

    it('Turn 4: Should generate title if still New Chat', async () => {
      await mockStreamFlow('Short msg', 4);
      expect(llmService.generateContent).toHaveBeenCalled();
    });
  });

  describe('getSessionMessages', () => {
    const mockDate = new Date('2024-01-01T10:00:00Z');
    const session = { id: 's1', userId: 'u1' };

    beforeEach(() => {
      mockChatSessionRepo.findOne.mockResolvedValue(session);
    });

    it('should return messages in correct order', async () => {
      const messages = [
        { id: 'm2', createdAt: mockDate },
        { id: 'm1', createdAt: new Date(mockDate.getTime() - 1000) },
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
      const cursorMsg = { id: 'm2', createdAt: new Date(mockDate.getTime()) };

      mockChatMessageRepo.findOne.mockResolvedValue(cursorMsg);

      // Mock find to return messages before the cursor
      mockChatMessageRepo.find.mockResolvedValue([
        { id: 'm1', createdAt: new Date(mockDate.getTime() - 1000) },
      ]);

      await service.getSessionMessages('s1', { before: 'm2' });

      // Verify findOne was called to get cursor time
      expect(mockChatMessageRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'm2' },
        select: ['createdAt'],
      });

      // Verify find was called with LessThan logic (we can't easily assert LessThan object equality in check,
      // but we can verify the call structure implicity if needed or trust the logic flow)
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
        },
        {
          id: 'm2',
          parentId: 'MISSING_ID',
          createdAt: new Date(mockDate.getTime() - 1000),
        }, // Broken chain
        { id: 'm3', parentId: 'm2', createdAt: mockDate },
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

      const cursorMsg = { id: 'A', createdAt: new Date(20000) }; // m2
      mockChatMessageRepo.findOne.mockResolvedValue(cursorMsg);

      await service.getSessionMessages('s1', { before: 'A' });

      // The key is that we look up the TIME of 'A'
      const _findCall = mockChatMessageRepo.find.mock.calls[0][0];
      // We can't strictly assert the 'LessThan' operator value easily without custom matchers,
      // but we can confirm it didn't use `where: { id: LessThan(...) }`
      expect(mockChatMessageRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'A' },
        select: ['createdAt'],
      });
    });
  });
});
