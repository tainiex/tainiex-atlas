/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { InvitationService } from './invitation.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InvitationCode } from './invitation-code.entity';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

describe('InvitationService', () => {
  let service: InvitationService;
  let repo: Repository<InvitationCode>;

  const mockRepo = {
    count: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn(),
    }),
  };

  beforeEach(async () => {
    // Mock count to return enough codes so onModuleInit doesn't generate more
    mockRepo.count.mockResolvedValue(100);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationService,
        {
          provide: getRepositoryToken(InvitationCode),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<InvitationService>(InvitationService);
    repo = module.get<Repository<InvitationCode>>(
      getRepositoryToken(InvitationCode),
    );

    // Clear mocks after init
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('consumeCode', () => {
    it('should return true when update is effective', async () => {
      mockRepo.createQueryBuilder().execute.mockResolvedValue({ affected: 1 });
      const user = { id: 'u1' } as User;
      const result = await service.consumeCode('VALID_CODE', user);
      expect(result).toBe(true);
    });

    it('should return false when update is ineffective (race condition or invalid)', async () => {
      mockRepo.createQueryBuilder().execute.mockResolvedValue({ affected: 0 });
      const user = { id: 'u1' } as User;
      const result = await service.consumeCode('INVALID_CODE', user);
      expect(result).toBe(false);
    });
  });
});
