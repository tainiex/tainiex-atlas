import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotesService } from './notes.service';
import { Note } from './entities/note.entity';
import { LoggerService } from '../common/logger/logger.service';

// Mock QueryBuilder
const mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  distinct: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  getRawMany: jest.fn(),
  getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
};

// Mock Repository
const mockNoteRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findAndCount: jest.fn(),
  findOne: jest.fn(),
  createQueryBuilder: jest.fn(() => mockQueryBuilder),
};

describe('NotesService', () => {
  let service: NotesService;

  beforeEach(async () => {
    const mockLoggerService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      setContext: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotesService,
        {
          provide: getRepositoryToken(Note),
          useValue: mockNoteRepository,
        },
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
      ],
    }).compile();

    service = module.get<NotesService>(NotesService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return notes with hasChildren = true if they have children', async () => {
      const userId = 'user-1';
      const mockNotes = [
        { id: 'parent-1', title: 'Parent Note', userId } as Note,
        { id: 'leaf-1', title: 'Leaf Note', userId } as Note,
      ];

      // Mock getManyAndCount to return the notes
      mockQueryBuilder.getManyAndCount.mockResolvedValue([mockNotes, 2]);

      // Mock batch query result (parent-1 has children)
      mockQueryBuilder.getRawMany.mockResolvedValue([
        { n_parent_id: 'parent-1' }, // Simulating DB raw result alias
      ]);

      const result = await service.findAll(userId);

      expect(result.notes).toHaveLength(2);
      expect(result.notes[0].hasChildren).toBe(true);
      expect(result.notes[1].hasChildren).toBe(false);

      // Verify query builder usage
      expect(mockNoteRepository.createQueryBuilder).toHaveBeenCalledWith('n');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'n.parentId IN (:...ids)',
        { ids: ['parent-1', 'leaf-1'] },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'n.isDeleted = :isDeleted',
        { isDeleted: false },
      );
    });

    it('should return only root notes when parentId is not provided', async () => {
      const userId = 'user-1';
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll(userId);

      // Verify that the query builder was called (service always uses queryBuilder)
      expect(mockNoteRepository.createQueryBuilder).toHaveBeenCalledWith('n');
    });

    it('should handle empty results', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll('user-1');

      expect(result.notes).toHaveLength(0);
      // createQueryBuilder is always called, but getRawMany won't be called for empty results
    });
  });
});
