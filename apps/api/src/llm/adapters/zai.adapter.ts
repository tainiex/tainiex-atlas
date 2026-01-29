import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { ILlmAdapter, ChatMessage, LlmRole } from './llm-adapter.interface';
import { LoggerService } from '../../common/logger/logger.service';

/**
 * Z.ai Adapter
 * Supports accessing Z.ai models via their API
 */
@Injectable()
export class ZaiAdapter implements ILlmAdapter {
    private client: AxiosInstance;
    private modelName: string;
    private apiKey: string;
    private readonly baseUrl = 'https://api.z.ai/api/paas/v4';

    constructor(
        private configService: ConfigService,
        private logger: LoggerService,
        modelName: string
    ) {
        this.modelName = modelName;
    }

    async initialize(): Promise<void> {
        this.apiKey = this.configService.get<string>('ZAI_API_KEY') || '';
        if (!this.apiKey) {
            throw new Error('ZAI_API_KEY is not defined in environment variables');
        }

        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
        });

        this.logger.info(`[ZaiAdapter] Initialized Z.ai client for model: ${this.modelName}`);
        return Promise.resolve();
    }

    private mapRole(role: LlmRole): string {
        if (role === 'user') return 'user';
        if (role === 'assistant') return 'assistant';
        if (role === 'system') return 'system';
        return 'user';
    }

    async generateContent(prompt: string): Promise<string> {
        this.logger.debug(`[ZaiAdapter] generateContent request: ${prompt.substring(0, 50)}...`);
        try {
            const response = await this.client.post<{
                choices: Array<{ message: { content: string } }>;
            }>('/chat/completions', {
                model: this.modelName,
                messages: [{ role: 'user', content: prompt }],
                stream: false,
            });

            const content = response.data?.choices?.[0]?.message?.content || '';

            this.logger.debug(`[ZaiAdapter] generateContent response length: ${content.length}`);
            return content;
        } catch (error) {
            this.logger.error(
                '[ZaiAdapter] generateContent failed:',
                error instanceof Error ? error.message : String(error)
            );
            if (axios.isAxiosError(error) && error.response) {
                this.logger.error(
                    '[ZaiAdapter] API Error Details:',
                    JSON.stringify(error.response.data)
                );
            }
            throw error;
        }
    }

    async chat(history: ChatMessage[], message: string): Promise<string> {
        this.logger.debug(
            `[ZaiAdapter] chat request. History: ${history.length}, Message: ${message.substring(0, 50)}...`
        );
        const messages = history.map(h => ({
            role: this.mapRole(h.role),
            content: h.message || h.text || '',
        }));

        messages.push({ role: 'user', content: message });

        try {
            const response = await this.client.post<{
                choices: Array<{ message: { content: string } }>;
            }>('/chat/completions', {
                model: this.modelName,
                messages: messages,
                stream: false,
            });

            const content = response.data?.choices?.[0]?.message?.content || '';

            this.logger.debug(`[ZaiAdapter] chat response length: ${content.length}`);
            return content;
        } catch (error) {
            this.logger.error(
                '[ZaiAdapter] chat failed:',
                error instanceof Error ? error.message : String(error)
            );
            if (axios.isAxiosError(error) && error.response) {
                this.logger.error(
                    '[ZaiAdapter] API Error Details:',
                    JSON.stringify(error.response.data)
                );
            }
            throw error;
        }
    }

    async *streamChat(
        history: ChatMessage[],
        message: string,
        _tools?: any[],
        options?: { signal?: AbortSignal }
    ): AsyncGenerator<string> {
        this.logger.debug(
            `[ZaiAdapter] streamChat request. History: ${history.length}, Message: ${message.substring(0, 50)}...`
        );
        const messages = history.map(h => ({
            role: this.mapRole(h.role),
            content: h.message || h.text || '',
        }));

        messages.push({ role: 'user', content: message });

        const signal = options?.signal;

        try {
            const response = await this.client.post(
                '/chat/completions',
                {
                    model: this.modelName,
                    messages: messages,
                    stream: true,
                },
                {
                    responseType: 'stream',
                    signal: signal, // Axios accepts AbortSignal
                }
            );

            const { StringDecoder } = await import('string_decoder');
            const decoder = new StringDecoder('utf8');
            let chunkCount = 0;
            const stream = response.data as AsyncIterable<Buffer>;
            let buffer = '';

            for await (const chunk of stream) {
                // Active abort check
                if (signal?.aborted) {
                    this.logger.info('[ZaiAdapter] Stream aborted by client signal');
                    return;
                }

                const str = decoder.write(chunk);
                buffer += str;
                this.logger.debug(
                    `[ZaiAdapter] Raw chunk received, length: ${str.length}, buffer size: ${buffer.length}`
                );

                const lines = buffer.split('\n');
                // The last line might be incomplete, so keep it in the buffer
                buffer = lines.pop() || '';

                let aggregatedContent = '';

                for (const line of lines) {
                    if (line.trim() === '') continue;

                    if (line.startsWith('data: ')) {
                        const dataStr = line.replace('data: ', '').trim();
                        if (dataStr === '[DONE]') continue;

                        try {
                            const data = JSON.parse(dataStr) as {
                                choices: Array<{
                                    delta: { content?: string; reasoning_content?: string };
                                }>;
                            };
                            const delta = data.choices?.[0]?.delta;
                            // Support both content and reasoning_content (Z.ai specific)
                            const content = delta?.content || delta?.reasoning_content;

                            if (content) {
                                aggregatedContent += content;
                            }
                        } catch {
                            this.logger.warn(
                                `[ZaiAdapter] Failed to parse stream chunk: ${dataStr.substring(0, 100)}...`
                            );
                        }
                    }
                }

                if (aggregatedContent) {
                    chunkCount++;
                    try {
                        yield aggregatedContent;
                    } catch {
                        // Passive abort detection: yield failed means downstream disconnected
                        this.logger.warn(
                            '[ZaiAdapter] Client disconnected during yield, aborting stream'
                        );
                        return;
                    }
                }
            }

            // Process any remaining buffer
            buffer += decoder.end();
            if (buffer.trim() !== '' && buffer.startsWith('data: ')) {
                const dataStr = buffer.replace('data: ', '').trim();
                if (dataStr !== '[DONE]') {
                    try {
                        const data = JSON.parse(dataStr) as {
                            choices: Array<{ delta: { content?: string } }>;
                        };
                        const delta = data.choices?.[0]?.delta?.content;
                        if (delta) yield delta;
                    } catch {
                        this.logger.warn(
                            `[ZaiAdapter] Failed to parse final stream chunk: ${dataStr}`
                        );
                    }
                }
            }

            this.logger.debug(`[ZaiAdapter] Stream finished. Total chunks: ${chunkCount}`);
        } catch (error) {
            // Check if it's an abort error
            if (axios.isCancel(error) || (error as Error).name === 'CanceledError') {
                this.logger.info('[ZaiAdapter] Stream cancelled by AbortSignal');
                return;
            }

            this.logger.error(
                '[ZaiAdapter] streamChat failed:',
                error instanceof Error ? error.message : String(error)
            );
            if (axios.isAxiosError(error) && error.response) {
                // Stream error response handling might be tricky as it's a stream
                this.logger.error('[ZaiAdapter] API Error Details (Stream):', String(error));
            }
            throw error;
        }
    }

    async getEmbeddings(): Promise<number[]> {
        await Promise.resolve();
        throw new Error('Embeddings not yet supported for Z.ai adapter');
    }
}
