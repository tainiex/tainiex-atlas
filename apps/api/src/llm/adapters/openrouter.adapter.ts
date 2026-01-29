import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenRouter } from '@openrouter/sdk';
import { ILlmAdapter, ChatMessage, LlmRole } from './llm-adapter.interface';
import { LoggerService } from '../../common/logger/logger.service';

/**
 * OpenRouter Adapter
 * Supports accessing various models (OpenAI, Anthropic, Google, etc.) via OpenRouter
 */
@Injectable()
export class OpenRouterAdapter implements ILlmAdapter {
    private client: OpenRouter;
    private modelName: string;

    constructor(
        private configService: ConfigService,
        private logger: LoggerService,
        modelName: string
    ) {
        this.modelName = modelName;
    }

    async initialize(): Promise<void> {
        const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');
        if (!apiKey) {
            throw new Error('OPENROUTER_API_KEY is not defined in environment variables');
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        this.client = new OpenRouter({
            apiKey: apiKey,
        } as any);

        this.logger.info(
            `[OpenRouterAdapter] Initialized OpenRouter client for model: ${this.modelName}`
        );
        return Promise.resolve();
    }

    private mapRole(role: LlmRole): string {
        if (role === 'user') return 'user';
        if (role === 'assistant') return 'assistant';
        if (role === 'system') return 'system';
        return 'user';
    }

    async generateContent(prompt: string): Promise<string> {
        this.logger.debug(
            `[OpenRouterAdapter] generateContent request: ${prompt.substring(0, 50)}...`
        );
        try {
            const response = await this.client.chat.send({
                model: this.modelName,
                messages: [{ role: 'user', content: prompt }],
            });
            const content =
                ((response.choices &&
                    response.choices[0] &&
                    response.choices[0].message.content) as string) || '';

            this.logger.debug(
                `[OpenRouterAdapter] generateContent response length: ${content.length}`
            );
            return content;
        } catch (error) {
            this.logger.error(
                '[OpenRouterAdapter] generateContent failed:',
                (error as Error).message
            );
            throw error;
        }
    }

    async chat(history: ChatMessage[], message: string): Promise<string> {
        this.logger.debug(
            `[OpenRouterAdapter] chat request. History: ${history.length}, Message: ${message.substring(0, 50)}...`
        );
        const messages = history.map(h => ({
            role: this.mapRole(h.role) as 'user' | 'assistant' | 'system',
            content: h.message || h.text || '',
        }));

        messages.push({ role: 'user', content: message });

        try {
            const response = await this.client.chat.send({
                model: this.modelName,
                messages: messages,
            });
            const content =
                ((response.choices &&
                    response.choices[0] &&
                    response.choices[0].message.content) as string) || '';

            this.logger.debug(`[OpenRouterAdapter] chat response length: ${content.length}`);
            return content;
        } catch (error) {
            this.logger.error('[OpenRouterAdapter] chat failed:', (error as Error).message);
            throw error;
        }
    }

    async *streamChat(history: ChatMessage[], message: string): AsyncGenerator<string> {
        this.logger.debug(
            `[OpenRouterAdapter] streamChat request. History: ${history.length}, Message: ${message.substring(0, 50)}...`
        );
        const messages = history.map(h => ({
            role: this.mapRole(h.role) as 'user' | 'assistant' | 'system',
            content: h.message || h.text || '',
        }));

        messages.push({ role: 'user', content: message });

        try {
            // Note: 'send' with 'stream: true' returns a stream
            const result = await this.client.chat.send({
                model: this.modelName,
                messages: messages,
                stream: true,
            });

            let chunkCount = 0;
            // The OpenRouter SDK stream handling
            for await (const chunk of result) {
                // According to usage example: chunk.choices[0].delta.content
                // We need to access it somewhat dynamically if types are loose or check type guard
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                const delta = (chunk as any).choices?.[0]?.delta?.content;
                if (delta) {
                    chunkCount++;
                    // Log first few chunks for debug, summary for rest
                    if (chunkCount <= 3) {
                        this.logger.debug(
                            `[OpenRouterAdapter] Yielding chunk ${chunkCount}: "${(delta as string).substring(0, 20)}..."`
                        );
                    }
                    yield delta as string;
                }
            }
            this.logger.debug(`[OpenRouterAdapter] Stream finished. Total chunks: ${chunkCount}`);
        } catch (error) {
            this.logger.error('[OpenRouterAdapter] streamChat failed:', (error as Error).message);
            throw error;
        }
    }

    async getEmbeddings(): Promise<number[]> {
        await Promise.resolve();
        throw new Error('Embeddings not yet supported for OpenRouter adapter');
    }
}
