import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VersionsService } from './versions.service';

/**
 * VersionsController - handles version history and restoration.
 * VersionsController - 处理版本历史和恢复。
 */
@Controller('versions')
@UseGuards(JwtAuthGuard)
export class VersionsController {
  constructor(private readonly versionsService: VersionsService) {}

  /**
   * Get block version history.
   * GET /api/versions/blocks/:blockId
   */
  @Get('blocks/:blockId')
  async getBlockHistory(
    @Param('blockId') blockId: string,
    @Query('limit') limit?: string,
  ) {
    return this.versionsService.getBlockHistory(
      blockId,
      limit ? parseInt(limit) : undefined,
    );
  }

  /**
   * Rollback a block to a specific version.
   * POST /api/versions/blocks/:blockId/rollback/:versionId
   */
  @Post('blocks/:blockId/rollback/:versionId')
  async rollbackBlock(
    @Req() req,
    @Param('blockId') blockId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.versionsService.rollbackBlock(blockId, versionId, req.user.id);
  }

  /**
   * Get note snapshots.
   * GET /api/versions/notes/:noteId/snapshots
   */
  @Get('notes/:noteId/snapshots')
  async getNoteSnapshots(@Param('noteId') noteId: string) {
    return this.versionsService.getNoteSnapshots(noteId);
  }

  /**
   * Manually trigger a note snapshot.
   * POST /api/versions/notes/:noteId/snapshots
   */
  @Post('notes/:noteId/snapshots')
  async createNoteSnapshot(@Param('noteId') noteId: string) {
    return this.versionsService.createNoteSnapshot(noteId);
  }
}
