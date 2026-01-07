import {
    Controller,
    Get,
    Param,
    Res,
    UseGuards,
    Req,
    Header,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExportService } from './export.service';

/**
 * ExportController - handles downloading notes in different formats.
 * ExportController - 处理以不同格式下载笔记。
 */
@Controller('export')
@UseGuards(JwtAuthGuard)
export class ExportController {
    constructor(private readonly exportService: ExportService) { }

    /**
     * Export note as Markdown.
     * GET /api/export/:noteId/markdown
     */
    @Get(':noteId/markdown')
    @Header('Content-Type', 'text/markdown')
    async exportMarkdown(
        @Req() req,
        @Param('noteId') noteId: string,
        @Res() res: Response
    ) {
        const markdown = await this.exportService.exportToMarkdown(noteId, req.user.id);

        // Suggest a filename
        res.setHeader('Content-Disposition', `attachment; filename="note_${noteId}.md"`);
        return res.send(markdown);
    }

    /**
     * Export note as HTML.
     * GET /api/export/:noteId/html
     */
    @Get(':noteId/html')
    @Header('Content-Type', 'text/html')
    async exportHtml(
        @Req() req,
        @Param('noteId') noteId: string,
        @Res() res: Response
    ) {
        const html = await this.exportService.exportToHtml(noteId, req.user.id);
        res.setHeader('Content-Disposition', `attachment; filename="note_${noteId}.html"`);
        return res.send(html);
    }
}
