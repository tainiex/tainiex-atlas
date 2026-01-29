import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Mistral } from '@mistralai/mistralai';
import { ILlmAdapter, ChatMessage, LlmRole } from './llm-adapter.interface';
import { LoggerService } from '../../common/logger/logger.service';

/**
 * Mistral AI 模型适配器
 */
@Injectable()
export class MistralAiAdapter implements ILlmAdapter {
    private client: Mistral;
    private modelName: string;

    constructor(
        private configService: ConfigService,
        private logger: LoggerService,
        modelName: string
    ) {
        this.modelName = modelName;
    }

    async initialize(): Promise<void> {
        const apiKey = this.configService.get<string>('MISTRAL_API_KEY');
        if (!apiKey) {
            throw new Error('MISTRAL_API_KEY is not defined in environment variables');
        }

        this.client = new Mistral({ apiKey });
        this.logger.info(
            `[MistralAiAdapter] Initialized mistral-client for model: ${this.modelName}`
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
            `[MistralAiAdapter] generateContent request: ${prompt.substring(0, 50)}...`
        );
        try {
            const response = await this.client.chat.complete({
                model: this.modelName,
                messages: [{ role: 'user', content: prompt }],
            });
            const content =
                ((response.choices &&
                    response.choices[0] &&
                    response.choices[0].message.content) as string) || '';
            this.logger.debug(
                `[MistralAiAdapter] generateContent response length: ${content.length}`
            );
            return content;
        } catch (error) {
            this.logger.error(
                '[MistralAiAdapter] generateContent failed:',
                (error as Error).message
            );
            throw error;
        }
    }

    async chat(history: ChatMessage[], message: string): Promise<string> {
        this.logger.debug(
            `[MistralAiAdapter] chat request. History: ${history.length}, Message: ${message.substring(0, 50)}...`
        );
        const mistralMessages = history.map(h => ({
            role: this.mapRole(h.role) as 'user' | 'assistant' | 'system',
            content: h.message || h.text || '',
        }));

        mistralMessages.push({ role: 'user', content: message });

        try {
            const response = await this.client.chat.complete({
                model: this.modelName,
                messages: mistralMessages,
            });
            const content =
                ((response.choices &&
                    response.choices[0] &&
                    response.choices[0].message.content) as string) || '';
            this.logger.debug(`[MistralAiAdapter] chat response length: ${content.length}`);
            return content;
        } catch (error) {
            this.logger.error('[MistralAiAdapter] chat failed:', (error as Error).message);
            throw error;
        }
    }

    async *streamChat(history: ChatMessage[], message: string): AsyncGenerator<string> {
        this.logger.debug(
            `[MistralAiAdapter] streamChat request. History: ${history.length}, Message: ${message.substring(0, 50)}...`
        );
        const mistralMessages = history.map(h => ({
            role: this.mapRole(h.role) as 'user' | 'assistant' | 'system',
            content: h.message || h.text || '',
        }));

        mistralMessages.push({ role: 'user', content: message });

        try {
            const result = await this.client.chat.stream({
                model: this.modelName,
                messages: mistralMessages,
            });

            let chunkCount = 0;
            for await (const chunk of result) {
                const text = chunk.data.choices[0].delta.content as string;
                if (text) {
                    chunkCount++;
                    if (chunkCount <= 3) {
                        this.logger.debug(
                            `[MistralAiAdapter] Yielding chunk ${chunkCount}: "${text.substring(0, 20)}..."`
                        );
                    }
                    yield text;
                }
            }
            this.logger.debug(`[MistralAiAdapter] Stream finished. Total chunks: ${chunkCount}`);
        } catch (error) {
            this.logger.error('[MistralAiAdapter] streamChat failed:', (error as Error).message);
            throw error;
        }
    }

    async getEmbeddings(text: string): Promise<number[]> {
        try {
            const response = await this.client.embeddings.create({
                model: 'mistral-embed',
                inputs: [text],
            });
            const embedding = response.data[0].embedding;
            if (!embedding) {
                throw new Error('No embedding returned from Mistral API');
            }
            return embedding;
        } catch (error) {
            this.logger.error('[MistralAiAdapter] getEmbeddings failed:', (error as Error).message);
            throw error;
        }
    }
}
