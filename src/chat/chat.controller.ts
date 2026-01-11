import { ConfigService } from '@nestjs/config';
import { Controller, Post, Get, Delete, Patch, Body, Param, UseGuards, Request, Res, Query, NotFoundException } from '@nestjs/common';
import { UserThrottlerGuard } from '../common/guards/user-throttler.guard';
import type { Response } from 'express';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatRole, AddMessageDto } from '@tainiex/shared-atlas';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
    constructor(
        private chatService: ChatService,
        private configService: ConfigService
    ) { }

    @Post('sessions')
    async createSession(@Request() req: any) {
        return this.chatService.createSession(req.user.id);
    }

    @Get('sessions')
    async getUserSessions(@Request() req: any) {
        return this.chatService.getUserSessions(req.user.id);
    }

    @Get('sessions/:id')
    async getSession(@Request() req: any, @Param('id') sessionId: string) {
        return this.chatService.getSession(sessionId, req.user.id);
    }

    @Delete('sessions/:id')
    async deleteSession(@Request() req: any, @Param('id') sessionId: string) {
        await this.chatService.deleteSession(sessionId, req.user.id);
        return { success: true };
    }

    @Patch('sessions/:id')
    async updateSession(
        @Request() req: any,
        @Param('id') sessionId: string,
        @Body() body: { title: string }
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
        @Request() req: any,
        @Param('id') sessionId: string,
        @Query('limit') limit?: string,
        @Query('before') before?: string,
        @Query('leafMessageId') leafMessageId?: string,
    ) {
        const sessions = await this.chatService.getUserSessions(req.user.id);
        const exists = sessions.find(s => s.id === sessionId);
        if (!exists) {
            return { messages: [], hasMore: false, nextCursor: null };
        }

        // [NEW] Trigger Lazy Backfill Check (Zero-cost, piggybacking on session load)
        this.chatService.checkAndTriggerBackfill(sessionId, exists);

        if (leafMessageId) {
            const path = await this.chatService.getHistoryPath(sessionId, leafMessageId);
            // When fetching by path, pagination logic might differ. 
            // For now, return whole path or slice it? 
            // getHistoryPath returns max 100 which is fine.
            return {
                messages: path,
                hasMore: false,
                nextCursor: null
            };
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
        const payload = body as AddMessageDto & { parentId?: string };

        // SSE Headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Encoding', 'identity');
        res.setHeader('Transfer-Encoding', 'chunked');

        // CRITICAL: Remove Content-Length to force streaming (chunked) mode
        res.removeHeader('Content-Length');

        // Flush headers immediately
        res.flushHeaders();

        // Send a large preamble (2KB) of spaces to bypass GFE/Nginx buffer minimums
        // Many proxies buffer until 512b or 1kb or 2kb.
        const preamble = ': ' + ' '.repeat(2048) + '\n\n';
        res.write(preamble);

        // Optional: Heartbeat interval could keep connection alive
        const heartbeat = setInterval(() => {
            if (!res.writableEnded) {
                res.write(': heartbeat\n\n');
                if ((res as any).flush) {
                    (res as any).flush();
                } else if ((res as any).socket && (res as any).socket.setNoDelay) {
                    // Try to disable Nagle's algorithm if flush is missing
                    (res as any).socket.setNoDelay(true);
                }
            }
        }, 15000);

        console.log(`[ChatController] Stream started. Flush available: ${!!(res as any).flush}`);

        try {
            const stream = this.chatService.streamMessage(
                sessionId,
                req.user.id,
                payload.content,
                payload.role || ChatRole.USER,
                payload.model, // Optional model param
                payload.parentId // Optional parentId
            );

            let isClosed = false;
            req.on('close', () => {
                isClosed = true;
                console.log('[ChatController] Connection closed by client');
            });

            console.log('[ChatController] Starting stream loop...');
            let chunkIdx = 0;
            for await (const chunk of stream) {
                if (isClosed) break;

                chunkIdx++;
                const now = new Date();
                const ms = now.getMilliseconds().toString().padStart(3, '0');
                const timestamp = `${now.toLocaleTimeString()}.${ms}`;
                console.log(`[ChatController] [${timestamp}] Sending chunk ${chunkIdx} (length: ${chunk.length})`);

                // Ensure chunk is valid JSON string or text; LLM service returns string
                // Append 1KB of whitespace to bypass stubborn per-chunk proxy buffers
                const data = JSON.stringify({ text: chunk });
                const padding = ' '.repeat(1024);
                res.write(`data: ${data}${padding}\n\n`);

                if ((res as any).flush) {
                    (res as any).flush();
                }
            }
            console.log(`[ChatController] Stream loop finished. Total chunks: ${chunkIdx}`);

            res.write('data: [DONE]\n\n');
            res.end();
        } catch (error) {
            console.error('Chat stream failed:', error);
            // If header was already sent, this might just append data, ensuring client sees error event
            res.write(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`);
            res.end();
        } finally {
            clearInterval(heartbeat);
        }
    }

    @UseGuards(UserThrottlerGuard)
    @Post('sessions/:sessionId/messages/:messageId/regenerate')
    async regenerateMessage(
        @Request() req: any,
        @Param('sessionId') sessionId: string,
        @Param('messageId') messageId: string,
        @Body() body: { content: string; model?: string },
        @Res() res: Response
    ) {
        console.log('[ChatController] regenerateMessage called');
        console.log('SessionId:', sessionId, 'MessageId:', messageId);
        console.log('Body:', body);

        if (!body || !body.content) {
            console.error('[ChatController] Missing body or content');
            return res.status(400).json({ error: 'Message content is required' });
        }

        // SSE Headers (same as sendMessage)
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Encoding', 'identity');
        res.setHeader('Transfer-Encoding', 'chunked');

        // Remove Content-Length to force streaming
        res.removeHeader('Content-Length');

        // Flush headers immediately
        res.flushHeaders();

        // Send preamble to bypass proxy buffers
        const preamble = ': ' + ' '.repeat(2048) + '\n\n';
        res.write(preamble);

        // Heartbeat interval
        const heartbeat = setInterval(() => {
            if (!res.writableEnded) {
                res.write(': heartbeat\n\n');
                if ((res as any).flush) {
                    (res as any).flush();
                } else if ((res as any).socket && (res as any).socket.setNoDelay) {
                    (res as any).socket.setNoDelay(true);
                }
            }
        }, 15000);

        console.log(`[ChatController] Regenerate stream started`);

        try {
            const stream = this.chatService.updateMessageAndRegenerate(
                sessionId,
                req.user.id,
                messageId,
                body.content,
                body.model
            );

            let isClosed = false;
            req.on('close', () => {
                isClosed = true;
                console.log('[ChatController] Connection closed by client');
            });

            console.log('[ChatController] Starting regenerate stream loop...');
            let chunkIdx = 0;
            for await (const chunk of stream) {
                if (isClosed) break;

                chunkIdx++;
                const now = new Date();
                const ms = now.getMilliseconds().toString().padStart(3, '0');
                const timestamp = `${now.toLocaleTimeString()}.${ms}`;
                console.log(`[ChatController] [${timestamp}] Sending chunk ${chunkIdx} (length: ${chunk.length})`);

                const data = JSON.stringify({ text: chunk });
                const padding = ' '.repeat(1024);
                res.write(`data: ${data}${padding}\n\n`);

                if ((res as any).flush) {
                    (res as any).flush();
                }
            }
            console.log(`[ChatController] Regenerate stream loop finished. Total chunks: ${chunkIdx}`);

            res.write('data: [DONE]\n\n');
            res.end();
        } catch (error) {
            console.error('Chat regenerate stream failed:', error);
            res.write(`data: ${JSON.stringify({ error: error.message || 'Regenerate failed' })}\n\n`);
            res.end();
        } finally {
            clearInterval(heartbeat);
        }
    }

    @Patch('sessions/:sessionId/messages/:messageId')
    async updateMessage(
        @Request() req: any,
        @Param('sessionId') sessionId: string,
        @Param('messageId') messageId: string,
        @Body() body: { content: string }
    ) {
        if (!body.content) throw new NotFoundException('Content is required');
        return this.chatService.updateMessage(sessionId, req.user.id, messageId, body.content);
    }
}
