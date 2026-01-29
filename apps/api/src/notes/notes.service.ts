import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Note } from './entities/note.entity';
import { CreateNoteDto, UpdateNoteDto } from '@tainiex/shared-atlas';

/**
 * NotesService - handles core note operations.
 * NotesService - 处理核心笔记操作。
 */
@Injectable()
export class NotesService {
    constructor(
        @InjectRepository(Note)
        private noteRepository: Repository<Note>
    ) {}

    /**
     * Create a new note.
     * 创建新笔记。
     */
    async create(userId: string, createNoteDto: CreateNoteDto): Promise<Note> {
        const note = this.noteRepository.create({
            userId,
            title: createNoteDto.title || 'Untitled',
            parentId: createNoteDto.parentId,
            template: createNoteDto.templateId,
            lastEditedBy: userId,
        });

        return this.noteRepository.save(note);
    }

    /**
     * Find all notes for a user.
     * 查询用户的所有笔记。
     */
    async findAll(
        userId: string,
        options?: {
            parentId?: string;
            isPublic?: boolean;
            limit?: number;
            offset?: number;
        }
    ): Promise<{ notes: Note[]; total: number }> {
        const queryBuilder = this.noteRepository
            .createQueryBuilder('n')
            .where('n.userId = :userId', { userId })
            .andWhere('n.isDeleted = :isDeleted', { isDeleted: false });

        if (options?.parentId !== undefined) {
            if (options.parentId === 'null') {
                queryBuilder.andWhere('n.parentId IS NULL');
            } else {
                queryBuilder.andWhere('n.parentId = :parentId', {
                    parentId: options.parentId,
                });
            }
        } else {
            // Default: only return root notes
            // 默认：只返回根笔记
            queryBuilder.andWhere('n.parentId IS NULL');
        }

        if (options?.isPublic !== undefined) {
            queryBuilder.andWhere('n.isPublic = :isPublic', {
                isPublic: options.isPublic,
            });
        }

        queryBuilder
            .orderBy('n.updatedAt', 'DESC')
            .take(options?.limit || 50)
            .skip(options?.offset || 0);

        const [notes, total] = await queryBuilder.getManyAndCount();

        // Optimization: Batch check for children (Lazy Loading)
        // 优化：批量检查子节点（懒加载）
        if (notes.length > 0) {
            const noteIds = notes.map(n => n.id);
            const childrenCounts = await this.noteRepository
                .createQueryBuilder('n')
                .select('n.parentId')
                .distinct(true)
                .where('n.parentId IN (:...ids)', { ids: noteIds })
                .andWhere('n.isDeleted = :isDeleted', { isDeleted: false })
                .getRawMany();

            const parentIdsWithChildren = new Set(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
                childrenCounts.map((c: any) => c.n_parent_id)
            );

            notes.forEach(note => {
                note.hasChildren = parentIdsWithChildren.has(note.id);
            });
        }

        return { notes, total };
    }

    /**
     * Find a single note by ID.
     * 根据ID查询单个笔记。
     */
    async findOne(id: string, userId: string): Promise<Note> {
        const note = await this.noteRepository.findOne({
            where: { id, isDeleted: false },
        });

        if (!note) {
            throw new NotFoundException('Note not found');
        }

        // Check access permission
        if (note.userId !== userId && !note.isPublic) {
            throw new ForbiddenException('Access denied');
        }

        return note;
    }

    /**
     * Update note metadata.
     * 更新笔记元数据。
     */
    async update(id: string, userId: string, updateNoteDto: UpdateNoteDto): Promise<Note> {
        const note = await this.findOne(id, userId);

        // Only owner can update
        if (note.userId !== userId) {
            throw new ForbiddenException('Only owner can update note');
        }

        if (updateNoteDto.title !== undefined) {
            note.title = updateNoteDto.title;
        }
        if (updateNoteDto.coverImage !== undefined) {
            note.coverImage = updateNoteDto.coverImage;
        }
        if (updateNoteDto.icon !== undefined) {
            note.icon = updateNoteDto.icon;
        }

        note.lastEditedBy = userId;
        note.updatedAt = new Date();

        return this.noteRepository.save(note);
    }

    /**
     * Soft delete a note.
     * 软删除笔记。
     */
    async delete(id: string, userId: string): Promise<void> {
        const note = await this.findOne(id, userId);

        // Only owner can delete
        if (note.userId !== userId) {
            throw new ForbiddenException('Only owner can delete note');
        }

        note.isDeleted = true;
        await this.noteRepository.save(note);
    }

    /**
     * Duplicate a note.
     * 复制笔记。
     */
    async duplicate(id: string, userId: string): Promise<Note> {
        const original = await this.findOne(id, userId);

        const duplicate = this.noteRepository.create({
            userId,
            title: `${original.title} (Copy)`,
            coverImage: original.coverImage,
            icon: original.icon,
            parentId: original.parentId,
            template: original.template,
            isPublic: false, // Duplicates are private by default
            lastEditedBy: userId,
        });

        return this.noteRepository.save(duplicate);
    }

    /**
     * Check if user can access note (for block operations).
     * 检查用户是否可以访问笔记（用于块操作）。
     */
    async canAccess(noteId: string, userId: string): Promise<boolean> {
        const note = await this.noteRepository.findOne({
            where: { id: noteId, isDeleted: false },
        });

        if (!note) return false;
        return note.userId === userId || note.isPublic;
    }

    /**
     * Check if user can edit note (for block operations).
     * 检查用户是否可以编辑笔记（用于块操作）。
     */
    async canEdit(noteId: string, userId: string): Promise<boolean> {
        const note = await this.noteRepository.findOne({
            where: { id: noteId, isDeleted: false },
        });

        if (!note) return false;
        return note.userId === userId;
    }
}
