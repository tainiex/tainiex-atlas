import { Controller, Post, Get, Body, Param, UseGuards, Request, Res, Query } from '@nestjs/common';
import { UserThrottlerGuard } from '../common/guards/user-throttler.guard';
import type { Response } from 'express';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatRole, AddMessageDto } from '@shared/index';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
    constructor(private chatService: ChatService) { }

    @Post('sessions')
    async createSession(@Request() req: any) {
        return this.chatService.createSession(req.user.id);
    }

    @Get('sessions')
    async getSessions(@Request() req: any) {
        return this.chatService.getUserSessions(req.user.id);
    }

    @Get('sessions/:id/messages')
    async getMessages(
        @Request() req: any,
        @Param('id') sessionId: string,
        @Query('limit') limit?: string,
        @Query('before') before?: string,
    ) {
        const sessions = await this.chatService.getUserSessions(req.user.id);
        const exists = sessions.find(s => s.id === sessionId);
        if (!exists) {
            return { messages: [], hasMore: false, nextCursor: null };
        }

        return this.chatService.getSessionMessages(sessionId, {
            limit: limit ? parseInt(limit, 10) : undefined,
            before,
        });
    }

    @UseGuards(UserThrottlerGuard)
    @Post('sessions/:id/messages')
    async sendMessage(@Request() req: any, @Param('id') sessionId: string, @Body() body: any, @Res() res: Response) {
        console.log('[ChatController] sendMessage called');
        console.log('Headers:', req.headers);
        console.log('Body:', body);

        if (!body || !body.content) {
            console.error('[ChatController] Missing body or content');
            return res.status(400).json({ error: 'Message content is required' });
        }

        // Validation should ideally happen via Zod/Class-validator if using Classes. 
        // With Interfaces, runtime validation is manual or via Schema.
        const payload = body as AddMessageDto;

        // SSE Headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        try {
            const stream = this.chatService.streamMessage(
                sessionId,
                req.user.id,
                payload.content,
                payload.role || ChatRole.USER
            );

            for await (const chunk of stream) {
                // Ensure chunk is valid JSON string or text; LLM service returns string
                res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
            }

            res.write('data: [DONE]\n\n');
            res.end();
        } catch (error) {
            console.error('Chat stream failed:', error);
            // If header was already sent, this might just append data, ensuring client sees error event
            res.write(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`);
            res.end();
        }
    }
}
