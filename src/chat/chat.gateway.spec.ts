
import { Test, TestingModule } from '@nestjs/testing';
import { ChatGateway } from './chat.gateway';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';

describe('ChatGateway', () => {
    let gateway: ChatGateway;
    let jwtService: JwtService;

    const mockJwtService = {
        verifyAsync: jest.fn(),
    };

    const mockChatService = {
        streamMessage: jest.fn(),
    };

    const mockRateLimitService = {
        isAllowed: jest.fn().mockResolvedValue(true),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ChatGateway,
                { provide: JwtService, useValue: mockJwtService },
                { provide: ChatService, useValue: mockChatService },
                { provide: RateLimitService, useValue: mockRateLimitService },
            ],
        }).compile();

        gateway = module.get<ChatGateway>(ChatGateway);
        jwtService = module.get<JwtService>(JwtService);
    });

    it('should be defined', () => {
        expect(gateway).toBeDefined();
    });

    describe('handleConnection', () => {
        it('should unauthorized if no token provided', async () => {
            const client: any = {
                handshake: { auth: {}, headers: {}, address: '127.0.0.1' },
                disconnect: jest.fn(),
            };
            await gateway.handleConnection(client);
            expect(client.disconnect).toHaveBeenCalled();
        });

        it('should authorized with valid token in auth', async () => {
            const client: any = {
                id: 'socket_1',
                handshake: { auth: { token: 'valid_token' }, headers: {}, address: '127.0.0.1' },
                disconnect: jest.fn(),
                data: {},
            };
            mockJwtService.verifyAsync.mockResolvedValue({ sub: 'user_1' });

            await gateway.handleConnection(client);
            expect(client.data.user).toBeDefined();
            expect(client.data.user.id).toBe('user_1');
            expect(client.disconnect).not.toHaveBeenCalled();
        });

        it('should authorized with valid token in cookie', async () => {
            const client: any = {
                id: 'socket_1',
                handshake: {
                    auth: {},
                    headers: { cookie: 'access_token=valid_cookie_token' },
                    address: '127.0.0.1'
                },
                disconnect: jest.fn(),
                data: {},
            };
            mockJwtService.verifyAsync.mockResolvedValue({ sub: 'user_1' });

            await gateway.handleConnection(client);
            expect(client.data.user).toBeDefined();
            expect(client.data.user.id).toBe('user_1');
        });

        it('should reject if rate limit exceeded', async () => {
            mockRateLimitService.isAllowed.mockResolvedValueOnce(false);
            const client: any = {
                handshake: { auth: { token: 'valid_token' }, headers: {}, address: '127.0.0.1' },
                disconnect: jest.fn(),
            };
            await gateway.handleConnection(client);
            expect(client.disconnect).toHaveBeenCalledWith(true);
        });
    });
});
