import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Note, Block } from './entities';
import { SearchResultDto, INote, IBlock } from '@tainiex/shared-atlas';

/**
 * SearchService - handles full-text search for notes and blocks.
 * SearchService - 处理笔记和块的全文搜索。
 */
@Injectable()
export class SearchService {
    constructor(
        @InjectRepository(Note)
        private noteRepository: Repository<Note>,
        @InjectRepository(Block)
        private blockRepository: Repository<Block>,
    ) { }

    /**
     * Search notes and blocks based on query string.
     * 根据查询字符串搜索笔记和块。
     */
    async search(userId: string, query: string): Promise<SearchResultDto> {
        if (!query || query.trim().length === 0) {
            return { notes: [], blocks: [], total: 0 };
        }

        // Clean query for websearch-like behavior or use simple plainto_tsquery
        const formattedQuery = query.trim().split(/\s+/).join(' & ');

        // 1. Search Notes (by title)
        const notes = await this.noteRepository
            .createQueryBuilder('note')
            .where('note.user_id = :userId', { userId })
            .andWhere('note.is_deleted = false')
            .andWhere('note.search_vector @@ to_tsquery(\'simple\', :formattedQuery)', { formattedQuery })
            .getMany();

        // 2. Search Blocks (by content)
        // We use a raw query or query builder to get parent note info as well
        const blockMatches = await this.blockRepository
            .createQueryBuilder('block')
            .leftJoinAndSelect(Note, 'note', 'note.id = block.note_id')
            .where('note.user_id = :userId', { userId })
            .andWhere('note.is_deleted = false')
            .andWhere('block.search_vector @@ to_tsquery(\'simple\', :formattedQuery)', { formattedQuery })
            .select([
                'block.id',
                'block.noteId',
                'block.type',
                'block.content',
                'block.updatedAt',
                'note.id',
                'note.title'
            ])
            .getRawAndEntities();

        const formattedBlocks = blockMatches.entities.map((block, index) => {
            const raw = blockMatches.raw[index];
            return {
                ...block,
                note: {
                    id: raw.note_id,
                    title: raw.note_title,
                },
                // For now, we don't implement complex snippet generation in TS,
                // but we could use ts_headline if needed via raw query.
                highlight: this.getSnippet(block.content, query),
            };
        });

        return {
            notes,
            blocks: formattedBlocks as any,
            total: notes.length + formattedBlocks.length,
        };
    }

    /**
     * Simple client-side snippet generation.
     * 简单的客户端片段生成。
     */
    private getSnippet(content: string, query: string): string {
        if (!content) return '';
        const index = content.toLowerCase().indexOf(query.toLowerCase());
        if (index === -1) return content.substring(0, 100);

        const start = Math.max(0, index - 40);
        const end = Math.min(content.length, index + 60);
        let snippet = content.substring(start, end);

        if (start > 0) snippet = '...' + snippet;
        if (end < content.length) snippet = snippet + '...';

        return snippet;
    }
}
