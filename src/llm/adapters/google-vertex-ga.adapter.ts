import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VertexAI, GenerativeModel, Content } from '@google-cloud/vertexai';
import { GoogleAuth } from 'google-auth-library';
import { ILlmAdapter, ChatMessage } from './llm-adapter.interface';
import { LoggerService } from '../../common/logger/logger.service';

/**
 * GA (Generally Available) 模型适配器
 * 使用 VertexAI SDK 调用稳定版本的模型
 */
@Injectable()
export class GoogleVertexGaAdapter implements ILlmAdapter {
    private vertexAI: VertexAI;
    private model: GenerativeModel;
    private modelName: string;

    constructor(
        private configService: ConfigService,
        private auth: GoogleAuth,
        private logger: LoggerService,
        modelName: string
    ) {
        this.modelName = modelName;
    }

    /**
     * 初始化 VertexAI SDK
     */
    async initialize(): Promise<void> {
        const projectId = this.configService.get<string>('VERTEX_PROJECT_ID');
        const location = this.configService.get<string>('VERTEX_LOCATION', 'us-central1');

        const authClient = await this.auth.getClient();

        const vertexOptions: any = {
            project: projectId,
            location: location,
            googleAuthOptions: {
                authClient: authClient as any
            }
        };

        this.vertexAI = new VertexAI(vertexOptions);
        this.model = this.vertexAI.getGenerativeModel({ model: this.modelName });
        this.logger.info(`[GoogleVertexGaAdapter] Initialized model: ${this.modelName}`);
    }

    async generateContent(prompt: string): Promise<string> {
        try {
            const result = await this.model.generateContent(prompt);
            const response = result.response;
            const text = response.candidates?.[0].content.parts[0].text;
            return text || '';
        } catch (error) {
            this.logger.error('[GoogleVertexGaAdapter] generateContent failed:', error);
            throw error;
        }
    }

    async chat(history: ChatMessage[], message: string): Promise<string> {
        const formattedHistory: Content[] = history.map(h => ({
            role: h.role === 'algo' ? 'model' : 'user',
            parts: [{ text: h.message || h.text || '' }]
        }));

        const runChat = async (maxOutputTokens: number): Promise<string> => {
            try {
                const chat = this.model.startChat({
                    history: formattedHistory,
                    generationConfig: {
                        maxOutputTokens, // Dynamic
                        temperature: 0.9,
                        topP: 0.95,
                        topK: 40,
                    },
                });

                const result = await chat.sendMessage(message);
                const response = result.response;
                const text = response.candidates?.[0].content.parts[0].text;
                return text || '';
            } catch (error: any) {
                // Check for maxOutputTokens error (400 INVALID_ARGUMENT)
                if (maxOutputTokens > 8192 && error.message?.includes('maxOutputTokens')) {
                    this.logger.warn(`[GoogleVertexGaAdapter] chat failed with ${maxOutputTokens} tokens. Retrying with 8192...`);
                    return runChat(8192); // Recursive retry with safe limit
                }
                this.logger.error('[GoogleVertexGaAdapter] chat failed:', error);
                throw error;
            }
        };

        // Initial attempt with high capacity (Optimistic)
        return runChat(65536);
    }

    async *streamChat(history: ChatMessage[], message: string): AsyncGenerator<string> {
        const formattedHistory: Content[] = history.map(h => ({
            role: h.role === 'algo' ? 'model' : 'user',
            parts: [{ text: h.message || h.text || '' }]
        }));

        let currentMaxTokens = 65536; // Initial optimistic limit

        try {
            while (true) {
                try {
                    const chat = this.model.startChat({
                        history: formattedHistory,
                        generationConfig: {
                            maxOutputTokens: currentMaxTokens,
                            temperature: 0.9,
                            topP: 0.95,
                            topK: 40,
                        },
                    });

                    const result = await chat.sendMessageStream(message);

                    let chunkCount = 0;
                    for await (const chunk of result.stream) {
                        chunkCount++;
                        const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) {
                            console.log(`[GoogleVertexGaAdapter] Yielding chunk ${chunkCount}: "${text.substring(0, 20)}..."`);
                            yield text;
                        } else {
                            console.log(`[GoogleVertexGaAdapter] Chunk ${chunkCount} has no text`);
                        }
                    }
                    console.log(`[GoogleVertexGaAdapter] Stream finished with ${chunkCount} chunks`);
                    return; // Success, exit loop
                } catch (error: any) {
                    // Check for maxOutputTokens error and if we haven't downgraded yet
                    if (currentMaxTokens > 8192 && error.message?.includes('maxOutputTokens')) {
                        this.logger.warn(`[GoogleVertexGaAdapter] streamChat failed with ${currentMaxTokens} tokens. Retrying with 8192...`);
                        currentMaxTokens = 8192;
                        continue; // Retry loop with new limit
                    }
                    throw error; // Other errors or already downgraded
                }
            }
        } catch (error) {
            this.logger.error('[GoogleVertexGaAdapter] streamChat failed:', error);
            throw error;
        }
    }
}
