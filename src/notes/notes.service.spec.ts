import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { NotesService } from './notes.service';
import { Note } from './entities/note.entity';

// Mock QueryBuilder
const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    distinct: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
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
    let repository: Repository<Note>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                NotesService,
                {
                    provide: getRepositoryToken(Note),
                    useValue: mockNoteRepository,
                },
            ],
        }).compile();

        service = module.get<NotesService>(NotesService);
        repository = module.get<Repository<Note>>(getRepositoryToken(Note));

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

            // Mock findAndCount result
            mockNoteRepository.findAndCount.mockResolvedValue([mockNotes, 2]);

            // Mock batch query result (parent-1 has children)
            mockQueryBuilder.getRawMany.mockResolvedValue([
                { n_parent_id: 'parent-1' } // Simulating DB raw result alias
            ]);

            const result = await service.findAll(userId);

            expect(result.notes).toHaveLength(2);
            expect(result.notes[0].hasChildren).toBe(true);
            expect(result.notes[1].hasChildren).toBe(false);

            // Verify query builder usage
            expect(mockNoteRepository.createQueryBuilder).toHaveBeenCalledWith('n');
            expect(mockQueryBuilder.where).toHaveBeenCalledWith('n.parentId IN (:...ids)', { ids: ['parent-1', 'leaf-1'] });
            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('n.isDeleted = :isDeleted', { isDeleted: false });
        });

        it('should return only root notes when parentId is not provided', async () => {
            const userId = 'user-1';
            mockNoteRepository.findAndCount.mockResolvedValue([[], 0]);

            await service.findAll(userId);

            // Verify that the where clause includes parentId = null by default
            expect(mockNoteRepository.findAndCount).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        parentId: null
                    })
                })
            );
        });

        it('should handle empty results', async () => {
            mockNoteRepository.findAndCount.mockResolvedValue([[], 0]);

            const result = await service.findAll('user-1');

            expect(result.notes).toHaveLength(0);
            expect(mockNoteRepository.createQueryBuilder).not.toHaveBeenCalled();
        });
    });
});
