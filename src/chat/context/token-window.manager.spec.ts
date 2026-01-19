import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TokenWindowContextManager } from './token-window.manager';
import { ChatMessage } from '../chat-message.entity';
import { ChatRole } from '@tainiex/shared-atlas';

describe('TokenWindowContextManager', () => {
  let manager: TokenWindowContextManager;

  const mockRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenWindowContextManager,
        {
          provide: getRepositoryToken(ChatMessage),
          useValue: mockRepo,
        },
      ],
    }).compile();

    manager = module.get<TokenWindowContextManager>(TokenWindowContextManager);

    // Mock findOne implementation for Linked List Traversal
    mockRepo.findOne.mockImplementation(async ({ where, order }) => {
      if (where.sessionId && order?.createdAt === 'DESC') {
        // Return the latest message (highest ID) in the mock set for this session
        // We assume mock resolved value is set before this runs
        // But mockRepo.find is not used by manager.
        // We need access to the data source.
        return null; // dynamic return based on current test data
      }
      if (where.id) {
        return null;
      }
      return null;
    });
  });

  it('should be defined', () => {
    expect(manager).toBeDefined();
  });

  it('should count tokens correctly for mixed content', async () => {
    // "Hello" (5 chars * 0.25 = 1.25 -> 2 tokens)
    // "你好" (2 chars * 1 = 2 -> 2 tokens)
    // Total should include strict limit checks

    const mockMessages = [
      {
        id: '2',
        content: '你好',
        role: ChatRole.USER,
        createdAt: new Date(2),
        parentId: '1',
      }, // 2 tokens
      {
        id: '1',
        content: 'Hello',
        role: ChatRole.USER,
        createdAt: new Date(1),
        parentId: 'ROOT',
      }, // 2 tokens (ceil(1.25) = 2)
    ] as ChatMessage[];

    // Mock findOne implementation
    mockRepo.findOne.mockImplementation(async (query) => {
      if (query.where.sessionId && query.order?.createdAt === 'DESC') {
        return mockMessages[0]; // Return latest
      }
      if (query.where.id) {
        return mockMessages.find((m) => m.id === query.where.id);
      }
      return null;
    });

    // Test Limit 3.
    // 1. "你好" (2 tokens). Sum=2. Fits.
    // 2. "Hello" (2 tokens). Sum=4. Exceeds 3.

    const result = await manager.getContext('session-1', { maxTokens: 3 });

    expect(result.length).toBe(1);
    expect(result[0].content).toBe('你好');
  });

  it('should handle pure English correctly', async () => {
    // "1234" = 4 * 0.25 = 1 token
    const mockMessages = [
      {
        id: '3',
        content: '1234',
        role: ChatRole.USER,
        createdAt: new Date(3),
        parentId: '2',
        sessionId: 'session-1',
      },
      {
        id: '2',
        content: '5678',
        role: ChatRole.ASSISTANT,
        createdAt: new Date(2),
        parentId: '1',
        sessionId: 'session-1',
      },
      {
        id: '1',
        content: '9012',
        role: ChatRole.USER,
        createdAt: new Date(1),
        parentId: 'ROOT',
        sessionId: 'session-1',
      },
    ] as ChatMessage[];

    mockRepo.findOne.mockImplementation(async (query) => {
      if (query.where.sessionId && query.order?.createdAt === 'DESC') {
        return mockMessages[0]; // Return latest
      }
      if (query.where.id) {
        return mockMessages.find((m) => m.id === query.where.id);
      }
      return null;
    });

    const result = await manager.getContext('session-1', { maxTokens: 2 });
    // 1. "1234" (1). Sum=1. Fits.
    // 2. "5678" (1). Sum=2. Fits.
    // 3. "9012" (1). Sum=3. Exceeds.

    expect(result.length).toBe(2);
    expect(result[0].id).toBe('2');
    expect(result[1].id).toBe('3');
  });

  it('should handle pure CJK correctly', async () => {
    // "测试" = 2 tokens
    const mockMessages = [
      {
        id: '2',
        content: '测试',
        role: ChatRole.USER,
        createdAt: new Date(2),
        parentId: '1',
      }, // 2 tokens
      {
        id: '1',
        content: '数据',
        role: ChatRole.USER,
        createdAt: new Date(1),
        parentId: 'ROOT',
      }, // 2 tokens
    ] as ChatMessage[];

    mockRepo.findOne.mockImplementation(async (query) => {
      if (query.where.sessionId && query.order?.createdAt === 'DESC') {
        return mockMessages[0]; // Return latest
      }
      if (query.where.id) {
        return mockMessages.find((m) => m.id === query.where.id);
      }
      return null;
    });

    const result = await manager.getContext('session-1', { maxTokens: 3 });
    // 1. "测试" (2). Fits.
    // 2. "数据" (2). Sum=4. Exceeds.

    expect(result.length).toBe(1);
    expect(result[0].content).toBe('测试');
  });
});
