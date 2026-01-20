import { ConfigService } from '@nestjs/config';
import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { GetMessagesResponse, GetMessagesDto } from '@tainiex/shared-atlas';

import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private chatService: ChatService,
    private configService: ConfigService,
  ) {}

  @Post('sessions')
  async createSession(@Request() req: AuthenticatedRequest) {
    return this.chatService.createSession(req.user.id);
  }

  @Get('sessions')
  async getUserSessions(@Request() req: AuthenticatedRequest) {
    return this.chatService.getUserSessions(req.user.id);
  }

  @Get('sessions/:id')
  async getSession(
    @Request() req: AuthenticatedRequest,
    @Param('id') sessionId: string,
  ) {
    return this.chatService.getSession(sessionId, req.user.id);
  }

  @Delete('sessions/:id')
  async deleteSession(
    @Request() req: AuthenticatedRequest,
    @Param('id') sessionId: string,
  ) {
    await this.chatService.deleteSession(sessionId, req.user.id);
    return { success: true };
  }

  @Patch('sessions/:id')
  async updateSession(
    @Request() req: AuthenticatedRequest,
    @Param('id') sessionId: string,
    @Body() body: { title: string },
  ) {
    if (!body.title) throw new NotFoundException('Title is required');
    return this.chatService.updateSession(sessionId, req.user.id, body.title);
  }

  @Get('models')
  async getModels() {
    return this.chatService.getSupportedModels();
  }

  @Get('sessions/:id/messages')
  async getMessages(
    @Request() req: AuthenticatedRequest,
    @Param('id') sessionId: string,
    @Query() query: GetMessagesDto,
  ): Promise<GetMessagesResponse> {
    const { limit, before, leafMessageId } = query;

    const sessions = await this.chatService.getUserSessions(req.user.id);
    const exists = sessions.find((s) => s.id === sessionId);
    if (!exists) {
      return { messages: [], hasMore: false, nextCursor: null };
    }

    // [NEW] Trigger Lazy Backfill Check (Zero-cost, piggybacking on session load)
    void this.chatService.checkAndTriggerBackfill(sessionId, exists);

    if (leafMessageId) {
      const path = await this.chatService.getHistoryPath(
        sessionId,
        leafMessageId,
      );
      // When fetching by path, pagination logic might differ.
      // For now, return whole path or slice it?
      // getHistoryPath returns max 100 which is fine.
      return {
        messages: path,
        hasMore: false,
        nextCursor: null,
      };
    }

    return this.chatService.getSessionMessages(sessionId, {
      limit: limit ? Number(limit) : undefined,
      before,
    });
  }

  @Patch('sessions/:sessionId/messages/:messageId')
  async updateMessage(
    @Request() req: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Param('messageId') messageId: string,
    @Body() body: { content: string },
  ) {
    if (!body.content) throw new NotFoundException('Content is required');
    return this.chatService.updateMessage(
      sessionId,
      req.user.id,
      messageId,
      body.content,
    );
  }
}
