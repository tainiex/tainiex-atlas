import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Note, Block } from './entities';
import { BlockType } from '@tainiex/shared-atlas';

/**
 * ExportService - handles exporting notes to various formats.
 * ExportService - 处理将笔记导出为各种格式。
 */
@Injectable()
export class ExportService {
    constructor(
        @InjectRepository(Note)
        private noteRepository: Repository<Note>,
        @InjectRepository(Block)
        private blockRepository: Repository<Block>
    ) {}

    /**
     * Export a note to Markdown format.
     * 将笔记导出为 Markdown 格式。
     */
    async exportToMarkdown(noteId: string, userId: string): Promise<string> {
        const note = await this.noteRepository.findOne({
            where: { id: noteId, userId },
        });

        if (!note) {
            throw new NotFoundException('Note not found');
        }

        const blocks = await this.blockRepository.find({
            where: { noteId },
            order: { position: 'ASC' },
        });

        let markdown = `# ${note.title}\n\n`;

        for (const block of blocks) {
            markdown += this.blockToMarkdown(block) + '\n\n';
        }

        return markdown;
    }

    /**
     * Helper to convert a single block to Markdown.
     * 将单个块转换为 Markdown 的辅助方法。
     */
    private blockToMarkdown(block: Block): string {
        switch (block.type) {
            case BlockType.HEADING1:
                return `# ${block.content}`;
            case BlockType.HEADING2:
                return `## ${block.content}`;
            case BlockType.HEADING3:
                return `### ${block.content}`;
            case BlockType.BULLET_LIST:
                return `- ${block.content}`;
            case BlockType.NUMBERED_LIST:
                return `1. ${block.content}`;
            case BlockType.TODO_LIST: {
                const metadata = block.metadata as { checked?: boolean } | undefined;
                const checked = metadata?.checked ? '[x]' : '[ ]';
                return `${checked} ${block.content}`;
            }
            case BlockType.CODE: {
                const metadata = block.metadata as { language?: string } | undefined;
                const lang = metadata?.language || '';
                return `\`\`\`${lang}\n${block.content}\n\`\`\``;
            }
            case BlockType.QUOTE:
                return `> ${block.content}`;
            case BlockType.DIVIDER:
                return `---`;
            case BlockType.IMAGE: {
                const metadata = block.metadata as { filename?: string } | undefined;
                return `![${metadata?.filename || 'image'}](${block.content})`;
            }
            case BlockType.VIDEO: {
                const metadata = block.metadata as { filename?: string } | undefined;
                return `[Video: ${metadata?.filename || 'video'}](${block.content})`;
            }
            case BlockType.FILE: {
                const metadata = block.metadata as { filename?: string } | undefined;
                return `[File: ${metadata?.filename || 'attachment'}](${block.content})`;
            }
            case BlockType.CALLOUT:
                return `:::info\n${block.content}\n:::`;
            case BlockType.TEXT:
            default:
                return block.content || '';
        }
    }

    /**
     * Export a note to HTML format.
     * 将笔记导出为 HTML 格式。
     */
    async exportToHtml(noteId: string, userId: string): Promise<string> {
        // Very basic HTML export for now
        const md = await this.exportToMarkdown(noteId, userId);
        // In a real app, use a library like showdown or markdown-it
        return `<html><body>${md.replace(/\n/g, '<br>')}</body></html>`;
    }
}
