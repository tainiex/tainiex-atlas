import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BlocksService } from './blocks.service';
import type { CreateBlockDto, UpdateBlockDto, MoveBlockDto } from '@tainiex/shared-atlas';

import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

/**
 * BlocksController - handles HTTP requests for block operations.
 * BlocksController - 处理块操作的HTTP请求。
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class BlocksController {
    constructor(private readonly blocksService: BlocksService) {}

    /**
     * Get all blocks for a note.
     * GET /api/notes/:noteId/blocks
     */
    @Get('notes/:noteId/blocks')
    async findByNote(@Req() req: AuthenticatedRequest, @Param('noteId') noteId: string) {
        return this.blocksService.findByNote(noteId, req.user.id);
    }

    /**
     * Create a new block.
     * POST /api/notes/:noteId/blocks
     */
    @Post('notes/:noteId/blocks')
    async create(
        @Req() req: AuthenticatedRequest,
        @Param('noteId') noteId: string,
        @Body() createBlockDto: CreateBlockDto
    ) {
        return this.blocksService.create(noteId, req.user.id, createBlockDto);
    }

    /**
     * Update a block.
     * PATCH /api/blocks/:id
     */
    @Patch('blocks/:id')
    async update(
        @Req() req: AuthenticatedRequest,
        @Param('id') id: string,
        @Body() updateBlockDto: UpdateBlockDto
    ) {
        return this.blocksService.update(id, req.user.id, updateBlockDto);
    }

    /**
     * Delete a block.
     * DELETE /api/blocks/:id
     */
    @Delete('blocks/:id')
    async delete(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
        await this.blocksService.delete(id, req.user.id);
        return { message: 'Block deleted successfully' };
    }

    /**
     * Move a block to a new position.
     * POST /api/blocks/:id/move
     */
    @Post('blocks/:id/move')
    async move(
        @Req() req: AuthenticatedRequest,
        @Param('id') id: string,
        @Body() moveBlockDto: MoveBlockDto
    ) {
        return this.blocksService.move(id, req.user.id, moveBlockDto);
    }
}
