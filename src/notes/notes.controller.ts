import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotesService } from './notes.service';
import type { CreateNoteDto, UpdateNoteDto } from '@tainiex/shared-atlas';

/**
 * NotesController - handles HTTP requests for note operations.
 * NotesController - 处理笔记操作的HTTP请求。
 */
@Controller('notes')
@UseGuards(JwtAuthGuard)
export class NotesController {
    constructor(private readonly notesService: NotesService) { }

    /**
     * Create a new note.
     * POST /api/notes
     */
    @Post()
    async create(@Req() req, @Body() createNoteDto: CreateNoteDto) {
        return this.notesService.create(req.user.id, createNoteDto);
    }

    /**
     * Get all notes for current user.
     * GET /api/notes
     */
    @Get()
    async findAll(
        @Req() req,
        @Query('parentId') parentId?: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string
    ) {
        return this.notesService.findAll(req.user.id, {
            parentId,
            limit: limit ? parseInt(limit) : undefined,
            offset: offset ? parseInt(offset) : undefined,
        });
    }

    /**
     * Get a single note by ID.
     * GET /api/notes/:id
     */
    @Get(':id')
    async findOne(@Req() req, @Param('id') id: string) {
        // console.log(`[NotesController] Reading note ${id} for user ${req.user.id}`);
        return this.notesService.findOne(id, req.user.id);
    }

    /**
     * Update note metadata.
     * PATCH /api/notes/:id
     */
    @Patch(':id')
    async update(
        @Req() req,
        @Param('id') id: string,
        @Body() updateNoteDto: UpdateNoteDto
    ) {
        return this.notesService.update(id, req.user.id, updateNoteDto);
    }

    /**
     * Delete a note (soft delete).
     * DELETE /api/notes/:id
     */
    @Delete(':id')
    async delete(@Req() req, @Param('id') id: string) {
        await this.notesService.delete(id, req.user.id);
        return { message: 'Note deleted successfully' };
    }

    /**
     * Duplicate a note.
     * POST /api/notes/:id/duplicate
     */
    @Post(':id/duplicate')
    async duplicate(@Req() req, @Param('id') id: string) {
        return this.notesService.duplicate(id, req.user.id);
    }
}
