import { Controller, Post, Get, Body, UseGuards, Res } from '@nestjs/common';
import type { Response } from 'express';
import { LlmService } from './llm.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('llm')
export class LlmController {
    constructor(private readonly llmService: LlmService) { }

    @UseGuards(JwtAuthGuard)
    @Get('models')
    async getModels() {
        const models = await this.llmService.listModels();
        return { models };
    }


}
