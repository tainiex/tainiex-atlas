import { Controller, Post, Get, Body, UseGuards, Res, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { LlmService } from './llm.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('llm')
export class LlmController {
    constructor(
        private readonly llmService: LlmService,
        private readonly configService: ConfigService
    ) { }

    @UseGuards(JwtAuthGuard)
    @Get('models')
    async getModels() {
        if (this.configService.get('NODE_ENV') !== 'development') {
            throw new NotFoundException();
        }
        const models = await this.llmService.listModels();
        return { models };
    }


}
