import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VertexAI, GenerativeModel, Content } from '@google-cloud/vertexai';
import { GoogleAuth } from 'google-auth-library';
import { ILlmAdapter, ChatMessage, LlmRole } from './llm-adapter.interface';
import { ModelClassifier } from './model-classifier';
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

        const metadata = ModelClassifier.getMetadata(this.modelName);
        const maxOutputTokens = metadata.maxOutputTokens;

        const runChat = async (): Promise<string> => {
            return this.withRetry(async () => {
                try {
                    const chat = this.model.startChat({
                        history: formattedHistory,
                        generationConfig: {
                            maxOutputTokens,
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
                    this.logger.error('[GoogleVertexGaAdapter] chat failed:', error);
                    throw error;
                }
            });
        };

        return runChat();
    }

    async *streamChat(history: ChatMessage[], message: string): AsyncGenerator<string> {
        const formattedHistory: Content[] = history.map(h => ({
            role: this.mapRoleToVertex(h.role),
            parts: [{ text: h.message || h.text || '' }]
        }));

        const metadata = ModelClassifier.getMetadata(this.modelName);
        const currentMaxTokens = metadata.maxOutputTokens;

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
                    // With authoritative metadata, we rely on the classifier, but if it fails we might still want safety?
                    // User directive is to remove blind retry. 
                    // Since we use the same metadata logic, we shouldn't dynamically retry tokens anymore.
                    throw error;
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

    async getEmbeddings(text: string): Promise<number[]> {
        return this.withRetry(async () => {
            try {
                // Determine project and location
                const projectId = this.configService.get<string>('VERTEX_PROJECT_ID');
                const location = this.configService.get<string>('VERTEX_LOCATION', 'us-central1');
                const apiEndpoint = `${location}-aiplatform.googleapis.com`;

                // Lazy load PredictionServiceClient to avoid import issues if unused
                const { PredictionServiceClient, helpers } = await import('@google-cloud/aiplatform');

                // Pass the GoogleAuth instance directly
                const client = new PredictionServiceClient({
                    apiEndpoint: apiEndpoint,
                    auth: this.auth as any,
                    projectId: projectId,
                });

                const model = this.configService.get<string>('VERTEX_EMBEDDING_MODEL') || 'text-embedding-004';
                const endpoint = `projects/${projectId}/locations/${location}/publishers/google/models/${model}`;

                const instanceValue = helpers.toValue({
                    content: text,
                    task_type: 'RETRIEVAL_QUERY',
                });

                // Fix TS2488: Don't destructure, handle promise properly
                const predictResult = await client.predict({
                    endpoint,
                    instances: [instanceValue as any], // Fix TS2322: Cast to any
                });
                const response = predictResult[0];

                const predictions = response.predictions;
                if (!predictions || predictions.length === 0) {
                    throw new Error('No predictions returned');
                }

                const embedding = predictions[0].structValue?.fields?.embeddings?.structValue?.fields?.values?.listValue?.values?.map(v => v.numberValue || 0);

                if (!embedding) {
                    // Try alternative structure if above fails
                    const predictionVal = helpers.fromValue(predictions[0] as any) as any;
                    if (predictionVal?.embeddings && Array.isArray(predictionVal.embeddings.values)) {
                        return predictionVal.embeddings.values;
                    }
                    throw new Error('Could not parse embedding from response');
                }

                return embedding;
            } catch (error) {
                this.logger.error('[GoogleVertexGaAdapter] getEmbeddings failed:', error);
                throw error;
            }
        });
    }
}
