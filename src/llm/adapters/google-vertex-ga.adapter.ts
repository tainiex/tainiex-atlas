import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VertexAI, GenerativeModel, Content } from '@google-cloud/vertexai';
import { GoogleAuth } from 'google-auth-library';
import { ILlmAdapter, ChatMessage, LlmRole } from './llm-adapter.interface';
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

    /**
     * Generic retry wrapper for network operations
     */
    private async withRetry<T>(operation: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
        let lastError: any;

        for (let i = 0; i < retries; i++) {
            try {
                return await operation();
            } catch (error: any) {
                lastError = error;
                const isNetworkError =
                    error.message?.includes('fetch failed') ||
                    error.message?.includes('ConnectTimeoutError') ||
                    error.message?.includes('socket hang up') ||
                    error.message?.includes('exception posting request') ||
                    error.code === 'UND_ERR_CONNECT_TIMEOUT' ||
                    error.code === 'ETIMEDOUT';

                if (isNetworkError && i < retries - 1) {
                    const waitTime = delay * Math.pow(2, i); // Exponential backoff
                    this.logger.warn(`[GoogleVertexGaAdapter] Network error: ${error.message}. Retrying in ${waitTime}ms... (${i + 1}/${retries})`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }
                throw error;
            }
        }
        throw lastError;
    }

    async generateContent(prompt: string): Promise<string> {
        return this.withRetry(async () => {
            try {
                const result = await this.model.generateContent(prompt);
                const response = result.response;
                const text = response.candidates?.[0].content.parts[0].text;
                return text || '';
            } catch (error) {
                this.logger.error('[GoogleVertexGaAdapter] generateContent failed:', error);
                throw error;
            }
        });
    }

    private mapRoleToVertex(role: LlmRole): string {
        switch (role) {
            case 'user':
                return 'user';
            case 'assistant':
                return 'model';
            case 'system':
                // Vertex doesn't support system role in history directly for gemini-pro (sometimes), 
                // but usually it's treated as user or prepended. 
                // For safety, let's map to user or just exclude if not needed? 
                // Standard practice: map 'system' to 'user' for some models, or 'system' content if supported.
                // But the user constraint is simple: assistant->model, user->user.
                // Let's assume system -> user for now to avoid errors, or 'user' with a prefix.
                return 'user';
            default:
                this.logger.warn(`[GoogleVertexGaAdapter] Unknown role encountered: ${role}. Defaulting to 'user'.`);
                return 'user';
        }
    }

    async chat(history: ChatMessage[], message: string): Promise<string> {
        const formattedHistory: Content[] = history.map(h => ({
            role: this.mapRoleToVertex(h.role),
            parts: [{ text: h.message || h.text || '' }]
        }));

        const runChat = async (maxOutputTokens: number): Promise<string> => {
            return this.withRetry(async () => {
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
                    // For logic/token errors, we might not want to generic-retry, but for network we do.
                    // withRetry wraps this, so if it throws network error, withRetry catches it.
                    // If it's maxOutputTokens, we handle it recursively here.
                    // Ideally recursion happens outside withRetry? Or inside?
                    // If we're inside withRetry, and we call runChat again, it creates nested withRetry. That's fine.

                    // Actually, if we throw here, withRetry catches it.
                    // If it's a network error, withRetry retries.
                    // If it's maxOutputTokens, withRetry might treat it as non-retriable unless we filter?
                    // My isNetworkError check filters specific errors.
                    // So maxOutputTokens error will bubble up from withRetry if not caught.
                    // So we must catch it inside withRetry callback or let withRetry bubble it.
                    // Wait, standard try/catch inside operation... catch(err) -> check maxTokens -> recurse.
                    // If recurse, return runChat() -> returns Promise from new withRetry.
                    // That works.
                    this.logger.error('[GoogleVertexGaAdapter] chat failed:', error);
                    throw error;
                }
            });
        };

        // Initial attempt with high capacity (Optimistic)
        return runChat(65536);
    }

    async *streamChat(history: ChatMessage[], message: string): AsyncGenerator<string> {
        const formattedHistory: Content[] = history.map(h => ({
            role: this.mapRoleToVertex(h.role),
            parts: [{ text: h.message || h.text || '' }]
        }));

        let currentMaxTokens = 65536; // Initial optimistic limit
        // We wrap the *connection* part in retry.
        // Once stream starts, we yield. If stream breaks mid-way, manual retry isn't easy without re-generating partial.

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

                // Wrap the initial network request (sendMessageStream) with retry
                const result = await this.withRetry(async () => {
                    return await chat.sendMessageStream(message);
                });

                let chunkCount = 0;
                for await (const chunk of result.stream) {
                    chunkCount++;
                    const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) {
                        console.log(`[GoogleVertexGaAdapter] Yielding chunk ${chunkCount}: "${text.substring(0, 20)}..."`);
                        yield text;
                    }
                }
                console.log(`[GoogleVertexGaAdapter] Stream finished with ${chunkCount} chunks`);
                return; // Success, exit loop
            } catch (error: any) {
                // Network errors during streaming iteration will end up here too?
                // Yes, `for await` throws if stream errors.
                // We should retry network errors here too?
                // If we are halfway through, we might duplicate text if we restart?
                // User requirement: "Increase robustnes, max 3 retries" likely implies connection retries.
                // If mid-stream fails, simple restart duplicates content.
                // BUT, withRetry only wraps sendMessageStream.
                // If `for await` fails, it's outside withRetry.
                // Let's catch `for await` errors here.

                const isNetworkError =
                    error.message?.includes('fetch failed') ||
                    error.message?.includes('ConnectTimeoutError') ||
                    error.message?.includes('exception posting request') ||
                    error.code === 'UND_ERR_CONNECT_TIMEOUT';

                if (isNetworkError) {
                    // Ideally we should check if we yielded anything.
                    // If we haven't yielded yet, we can retry safe.
                    // If we yielded, restarting might be messy but better than crash?
                    // Let's just log and throw for now, relying on withRetry for the INITIAL connection which is the main issue.
                    // Wait, if I want to support retrying the connection establishment, existing withRetry does that.
                    // If the stream breaks, proper resumption is hard.
                    // Let's assume the user's issue is INITIAL connection timeout.
                    this.logger.error('[GoogleVertexGaAdapter] streamChat error:', error);

                    // Check for maxOutputTokens error
                    if (currentMaxTokens > 8192 && error.message?.includes('maxOutputTokens')) {
                        this.logger.warn(`[GoogleVertexGaAdapter] streamChat failed with ${currentMaxTokens} tokens. Retrying with 8192...`);
                        currentMaxTokens = 8192;
                        continue; // Retry loop with new limit
                    }
                }

                // If we are here, either maxToken retry or fatal error.
                // If it's a network error that happened *during* stream (rare but possible),
                // we probably shouldn't auto-retry unless we track state.
                // For now, let's bubble up non-maxToken errors.
                // But wait, my withRetry catches initial connection errors.
                // So if sendMessageStream fails, `withRetry` handles it.
                // If `for await` fails, it falls through to here.
                throw error;
            }
        }
    }
}
