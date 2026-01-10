import { Test, TestingModule } from '@nestjs/testing';
import { YjsTransformerService } from './yjs-transformer.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Block } from './entities/block.entity';
import { Note } from './entities/note.entity';
import * as Y from 'yjs';
import { BlockType } from '@tainiex/shared';

describe('YjsTransformerService', () => {
    let service: YjsTransformerService;
    let blockRepositoryMock: any;
    let noteRepositoryMock: any;

    beforeEach(async () => {
        blockRepositoryMock = {
            find: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        };
        noteRepositoryMock = {
            findOne: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                YjsTransformerService,
                { provide: getRepositoryToken(Block), useValue: blockRepositoryMock },
                { provide: getRepositoryToken(Note), useValue: noteRepositoryMock },
            ],
        }).compile();

        service = module.get<YjsTransformerService>(YjsTransformerService);
    });

    it('should soft delete missing blocks', async () => {
        const noteId = 'note-1';
        const doc = new Y.Doc();
        // Add one block so we don't hit the "empty doc" safety return
        const yBlocks = doc.getArray('blocks');
        yBlocks.push([new Y.Map([
            ['id', 'block-2'],
            ['type', BlockType.TEXT],
            ['content', 'Kept'],
            ['props', {}]
        ])]);

        // Existing blocks in DB
        const existingBlocks = [
            { id: 'block-1', noteId, content: 'To be deleted', isDeleted: false },
            { id: 'block-2', noteId, content: 'Kept', isDeleted: false }
        ];

        blockRepositoryMock.find.mockResolvedValue(existingBlocks);
        noteRepositoryMock.findOne.mockResolvedValue({ id: noteId, userId: 'user-1' });

        await service.syncToBlocks(noteId, doc);

        expect(blockRepositoryMock.update).toHaveBeenCalledWith(['block-1'], { isDeleted: true });
        expect(blockRepositoryMock.delete).not.toHaveBeenCalled();
    });

    it('should skip update for clean blocks', async () => {
        const noteId = 'note-1';
        const doc = new Y.Doc();
        const yBlocks = doc.getArray('blocks');
        const yMap = new Y.Map();
        yMap.set('id', 'block-1');
        yMap.set('type', BlockType.TEXT);
        yMap.set('content', 'Hello');
        yMap.set('props', {});
        yBlocks.push([yMap]);

        // Existing match
        const existingBlocks = [
            {
                id: 'block-1',
                noteId,
                type: BlockType.TEXT,
                content: 'Hello',
                metadata: {},
                position: 0,
                isDeleted: false,
                createdBy: 'user-1',
                lastEditedBy: 'user-1'
            }
        ];

        blockRepositoryMock.find.mockResolvedValue(existingBlocks);
        noteRepositoryMock.findOne.mockResolvedValue({ id: noteId, userId: 'user-1' });

        await service.syncToBlocks(noteId, doc);

        expect(blockRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('should resurrect deleted blocks if they reappear', async () => {
        const noteId = 'note-1';
        const doc = new Y.Doc();
        const yBlocks = doc.getArray('blocks');
        const yMap = new Y.Map();
        yMap.set('id', 'block-1');
        yMap.set('type', BlockType.TEXT);
        yMap.set('content', 'Hello');
        yMap.set('props', {});
        yBlocks.push([yMap]);

        // Existing match but DELETED
        const existingBlocks = [
            {
                id: 'block-1',
                noteId,
                type: BlockType.TEXT,
                content: 'Hello',
                metadata: {},
                position: 0,
                isDeleted: true, // DELETED
                createdBy: 'user-1',
                lastEditedBy: 'user-1'
            }
        ];

        blockRepositoryMock.find.mockResolvedValue(existingBlocks);
        noteRepositoryMock.findOne.mockResolvedValue({ id: noteId, userId: 'user-1' });

        await service.syncToBlocks(noteId, doc);

        // Should save with isDeleted: false
        expect(blockRepositoryMock.save).toHaveBeenCalledWith(expect.objectContaining({
            id: 'block-1',
            isDeleted: false
        }));
    });
});
