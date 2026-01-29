import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SearchService } from './search.service';
import { SearchResultDto } from '@tainiex/shared-atlas';

import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

/**
 * SearchController - handles searching within notes.
 * SearchController - 处理笔记内的搜索。
 */
@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
    constructor(private readonly searchService: SearchService) {}

    /**
     * Search notes and blocks.
     * GET /api/search?q=query_string
     */
    @Get()
    async search(
        @Req() req: AuthenticatedRequest,
        @Query('q') query: string
    ): Promise<SearchResultDto> {
        return this.searchService.search(req.user.id, query);
    }
}
