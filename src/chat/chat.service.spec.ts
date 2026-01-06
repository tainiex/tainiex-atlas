
import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChatSession } from './chat-session.entity';
import { ChatMessage } from './chat-message.entity';
import { LlmService } from '../llm/llm.service';
import { JwtService } from '@nestjs/jwt';
import { ChatRole } from '@shared/index';

describe('ChatService - Title Generation', () => {
    let service: ChatService;
    let llmService: any;
    let chatSessionRepo: any;
    let chatMessageRepo: any;

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
        create: jest.fn(),
        save: jest.fn(),
        count: jest.fn(),
        find: jest.fn(),
    };

    const mockContextManager = {
        getContext: jest.fn().mockResolvedValue([]),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ChatService,
                { provide: getRepositoryToken(ChatSession), useValue: mockChatSessionRepo },
                { provide: getRepositoryToken(ChatMessage), useValue: mockChatMessageRepo },
                { provide: LlmService, useValue: mockLlmService },
                { provide: 'IContextManager', useValue: mockContextManager },
            ],
        }).compile();

        service = module.get<ChatService>(ChatService);
        llmService = module.get<LlmService>(LlmService);
        chatSessionRepo = module.get(getRepositoryToken(ChatSession));
        chatMessageRepo = module.get(getRepositoryToken(ChatMessage));

        jest.clearAllMocks();
    });

    describe('streamMessage - Smart Delay Logic', () => {
        // Helper to mock stream flow
        const mockStreamFlow = async (content: string, messageCount: number, currentTitle = 'New Chat') => {
            const session = { id: 's1', userId: 'u1', title: currentTitle, updatedAt: new Date() };
            mockChatSessionRepo.findOne.mockResolvedValue(session);
            mockChatMessageRepo.create.mockReturnValue({ id: 'm1' });
            mockChatMessageRepo.save.mockResolvedValue({ id: 'm1' });
            mockChatMessageRepo.count.mockResolvedValue(messageCount);
            // Mock context for title generation
            mockChatMessageRepo.find.mockResolvedValue([
                { role: 'user', content: 'prev' },
                { role: 'user', content }
            ]);

            mockLlmService.generateContent.mockResolvedValue('Generated Title');

            // Allow stream to run
            mockLlmService.streamChat.mockImplementation(async function* () { yield 'ai response'; });

            const generator = service.streamMessage('s1', 'u1', content, ChatRole.USER);
            for await (const _ of generator) { }
        };

        it('Turn 1: Should NOT generate title if content <= 20 chars', async () => {
            await mockStreamFlow('Hello World', 1);
            expect(llmService.generateContent).not.toHaveBeenCalled();
        });

        it('Turn 1: Should generate title if content > 20 chars', async () => {
            const longContent = 'This is a very long message that definitely exceeds twenty characters limit.';
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

        it('Turn 4: Should NOT generate title even if "New Chat"', async () => {
            await mockStreamFlow('Short msg', 4);
            expect(llmService.generateContent).not.toHaveBeenCalled();
        });
    });
});
