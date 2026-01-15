import { Controller, Post, Get, Body, UseGuards, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

    // @UseGuards(JwtAuthGuard)
    @Get('models/remote')
    async getRemoteModels() {
        if (this.configService.get('NODE_ENV') !== 'development') {
            throw new NotFoundException();
        }
        try {
            const models = await this.llmService.listRemoteModels();
            return { models };
        } catch (error) {
            console.error('Remote Model Fetch Error:', error);
            // Avoid returning full error object as it may contain circular references
            return { error: 'Failed to fetch models', message: error.message };
        }
    }
}
