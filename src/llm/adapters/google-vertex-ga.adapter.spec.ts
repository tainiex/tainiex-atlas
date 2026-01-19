import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GoogleVertexGaAdapter } from './google-vertex-ga.adapter';
import { GoogleAuth } from 'google-auth-library';
import { LoggerService } from '../../common/logger/logger.service';
import { ChatMessage } from './llm-adapter.interface';

// Mock dependencies
const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'VERTEX_PROJECT_ID') return 'test-project';
    if (key === 'VERTEX_LOCATION') return 'us-central1';
    return null;
  }),
};

const mockAuth = {
  getClient: jest.fn().mockResolvedValue({}),
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock VertexAI SDK
const mockSendMessage = jest.fn().mockResolvedValue({
  response: {
    candidates: [{ content: { parts: [{ text: 'AI response' }] } }],
  },
});

const mockStartChat = jest.fn().mockReturnValue({
  sendMessage: mockSendMessage,
});

const mockGetGenerativeModel = jest.fn().mockReturnValue({
  startChat: mockStartChat,
  generateContent: jest.fn().mockResolvedValue({
    response: {
      candidates: [{ content: { parts: [{ text: 'Generated content' }] } }],
    },
  }),
});

jest.mock('@google-cloud/vertexai', () => {
  return {
    VertexAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: mockGetGenerativeModel,
    })),
  };
});

describe('GoogleVertexGaAdapter', () => {
  let adapter: GoogleVertexGaAdapter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: GoogleVertexGaAdapter,
          useFactory: (config, auth, logger) =>
            new GoogleVertexGaAdapter(config, auth, logger, 'gemini-pro'),
          inject: [ConfigService, GoogleAuth, LoggerService],
        },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: GoogleAuth, useValue: mockAuth },
        { provide: LoggerService, useValue: mockLogger },
      ],
    }).compile();

    adapter = module.get<GoogleVertexGaAdapter>(GoogleVertexGaAdapter);
    await adapter.initialize();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should correctly map assistant role to model', async () => {
    const history: ChatMessage[] = [
      { role: 'user', message: 'Hello' },
      { role: 'assistant', message: 'Hi there' }, // Should be mapped to 'model'
    ];
    const message = 'How are you?';

    await adapter.chat(history, message);

    expect(mockStartChat).toHaveBeenCalledWith(
      expect.objectContaining({
        history: [
          { role: 'user', parts: [{ text: 'Hello' }] },
          { role: 'model', parts: [{ text: 'Hi there' }] },
        ],
      }),
    );
  });
});
