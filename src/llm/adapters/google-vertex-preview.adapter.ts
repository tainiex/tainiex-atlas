import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuth } from 'google-auth-library';
import { ILlmAdapter, ChatMessage } from './llm-adapter.interface';
import { LoggerService } from '../../common/logger/logger.service';

/**
 * Preview 模型适配器
 * 使用 REST API v1beta1 端点调用预览版本的模型
 * Vertex AI 返回的是 JSON 数组流，不是 SSE
 */
@Injectable()
export class GoogleVertexPreviewAdapter implements ILlmAdapter {
    private modelName: string;

    constructor(
        private configService: ConfigService,
        private auth: GoogleAuth,
        private logger: LoggerService,
        modelName: string
    ) {
        this.modelName = modelName;
    }

    async initialize(): Promise<void> {
        this.logger.info(`[GoogleVertexPreviewAdapter] Initialized model: ${this.modelName}`);
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
                    this.logger.warn(`[GoogleVertexPreviewAdapter] Network error: ${error.message}. Retrying in ${waitTime}ms... (${i + 1}/${retries})`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }
                throw error;
            }
        }
        throw lastError;
    }

    async generateContent(prompt: string): Promise<string> {
        const projectId = this.configService.get<string>('VERTEX_PROJECT_ID');
        const location = this.configService.get<string>('VERTEX_LOCATION', 'us-central1');

        const url = `https://aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${location}/publishers/google/models/${this.modelName}:generateContent`;

        const requestBody = {
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        };

        try {
            const client = await this.auth.getClient();
            const token = await client.getAccessToken();

            const response = await this.withRetry(async () => {
                return fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token.token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody)
                });
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Vertex AI Error: ${response.statusText} - ${errorText}`);
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            return text || '';
        } catch (error) {
            this.logger.error('[GoogleVertexPreviewAdapter] generateContent failed:', error);
            throw error;
        }
    }

    async chat(history: ChatMessage[], message: string): Promise<string> {
        const projectId = this.configService.get<string>('VERTEX_PROJECT_ID');
        const location = this.configService.get<string>('VERTEX_LOCATION', 'us-central1');

        const url = `https://aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${location}/publishers/google/models/${this.modelName}:generateContent`;

        const requestBodyBase = {
            contents: [
                ...history.map(h => ({
                    role: h.role === 'algo' ? 'model' : 'user',
                    parts: [{ text: h.message || h.text || '' }]
                })),
                { role: 'user', parts: [{ text: message }] }
            ]
        };

        const runChat = async (maxOutputTokens: number): Promise<string> => {
            const requestBody = {
                ...requestBodyBase,
                generationConfig: {
                    maxOutputTokens, // Dynamic
                    temperature: 0.9,
                    topP: 0.95,
                    topK: 40,
                }
            };

            try {
                const client = await this.auth.getClient();
                const token = await client.getAccessToken();

                const response = await this.withRetry(async () => {
                    return fetch(url, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token.token}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(requestBody)
                    });
                });

                if (!response.ok) {
                    const errorText = await response.text();

                    // Check for maxOutputTokens error
                    if (maxOutputTokens > 8192 && errorText.includes('maxOutputTokens')) {
                        this.logger.warn(`[GoogleVertexPreviewAdapter] chat failed with ${maxOutputTokens} tokens. Retrying with 8192...`);
                        return runChat(8192); // Recurse
                    }

                    throw new Error(`Vertex AI Error: ${response.statusText} - ${errorText}`);
                }

                const data = await response.json();
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                return text || '';
            } catch (error) {
                // If it's a re-throw from recursion, catch it here or let it bubble?
                // The recursive call awaits, so if it throws, we catch it here unless we return directly.
                // But if we return runChat(8192), we are returning the Promise.
                // The error logging is best done at the top level catch if desired, but here we can log generic errors.
                // Since this is a helper, we let errors bubble up if they are final.
                this.logger.error('[GoogleVertexPreviewAdapter] chat failed:', error);
                throw error;
            }
        };

        // Optimistic default
        return runChat(65536);
    }

    async *streamChat(history: ChatMessage[], message: string): AsyncGenerator<string> {
        console.log('[GoogleVertexPreviewAdapter] streamChat called');
        const projectId = this.configService.get<string>('VERTEX_PROJECT_ID');
        const location = this.configService.get<string>('VERTEX_LOCATION', 'us-central1');

        const url = `https://aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${location}/publishers/google/models/${this.modelName}:streamGenerateContent`;

        let currentMaxTokens = 65536; // Initial optimistic limit

        try {
            while (true) {
                const requestBody = {
                    generationConfig: {
                        temperature: 0.9,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: currentMaxTokens, // Dynamic
                    },
                    contents: [
                        ...history.map(h => ({
                            role: h.role === 'algo' ? 'model' : 'user',
                            parts: [{ text: h.message || h.text || '' }]
                        })),
                        { role: 'user', parts: [{ text: message }] }
                    ]
                };

                console.log('[GoogleVertexPreviewAdapter] Request Body:', JSON.stringify(requestBody, null, 2));

                try {
                    const client = await this.auth.getClient();
                    const token = await client.getAccessToken();

                    const response = await this.withRetry(async () => {
                        return fetch(url, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${token.token}`,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(requestBody)
                        });
                    });

                    if (!response.ok) {
                        const errorText = await response.text();

                        // Check for maxOutputTokens error
                        if (currentMaxTokens > 8192 && errorText.includes('maxOutputTokens')) {
                            this.logger.warn(`[GoogleVertexPreviewAdapter] streamChat failed with ${currentMaxTokens} tokens. Retrying with 8192...`);
                            currentMaxTokens = 8192;
                            continue; // Retry with lower limit
                        }

                        throw new Error(`Vertex AI Stream Error: ${response.statusText} - ${errorText}`);
                    }

                    if (!response.body) throw new Error('Response body is null');

                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();

                    console.log('[GoogleVertexPreviewAdapter] Starting JSON stream parsing...');

                    let buffer = '';
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        const chunk = decoder.decode(value, { stream: true });
                        buffer += chunk;

                        // Parse JSON array stream: [{...},{...},{...}]
                        let startIdx = 0;
                        while (startIdx < buffer.length) {
                            const objStart = buffer.indexOf('{', startIdx);
                            if (objStart === -1) break;

                            let braceCount = 0;
                            let objEnd = -1;
                            let inString = false;
                            let escape = false;

                            for (let i = objStart; i < buffer.length; i++) {
                                const char = buffer[i];

                                if (escape) {
                                    escape = false;
                                    continue;
                                }

                                if (char === '\\') {
                                    escape = true;
                                    continue;
                                }

                                if (char === '"' && !escape) {
                                    inString = !inString;
                                }

                                if (!inString) {
                                    if (char === '{') braceCount++;
                                    if (char === '}') {
                                        braceCount--;
                                        if (braceCount === 0) {
                                            objEnd = i;
                                            break;
                                        }
                                    }
                                }
                            }

                            if (objEnd === -1) break;

                            const jsonStr = buffer.substring(objStart, objEnd + 1);
                            try {
                                const data = JSON.parse(jsonStr);
                                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                                if (text) {
                                    yield text;
                                }
                            } catch (e) {
                                console.error('[GoogleVertexPreviewAdapter] JSON parse error:', e);
                            }

                            startIdx = objEnd + 1;
                        }

                        buffer = buffer.substring(startIdx);
                    }
                    return; // Success, exit outer loop
                } catch (error: any) {
                    // Start of the inner try block catches fetch/setup errors
                    // But if we are already inside the stream logic (fetching body), usually response.ok is true.
                    // The retry logic target is specifically for !response.ok errors thrown above.
                    // If error is re-thrown (non-retryable), it bubbles to outer catch.
                    if (currentMaxTokens > 8192 && error.message?.includes('maxOutputTokens') === false) {
                        // If it's NOT the specific error we want to retry (or we already retried), throw it.
                        // Wait, logic: if it IS the error, we already handled it via `continue` above inside the !response.ok block? 
                        // No, `throw new Error` inside `!response.ok` brings us here.
                        // Actually, catching the error we just threw is redundant if we handle it inline.
                        // Let's refactor slightly to be cleaner:
                        // The `if (!response.ok)` block above handles the detection and `continue`.
                        // BUT `continue` only works if we are inside a loop. We are inside `while(true)`.
                        // However, we are inside `try...catch` inside `while(true)`. `continue` inside `try` will work to restart the `while` loop.
                        // So the `throw` inside `!response.ok` is only for NON-recoverable errors.
                        // Recoverable errors trigger `continue` directly.
                        throw error;
                    }
                    // If we are here, it means we caught an error that was NOT thrown by our check above?
                    // Or logic flaw. 
                    // Let's look at the !response.ok block again.
                    // It says: if recoverble -> continue.
                    // Else -> throw.
                    // So if we are here in catch, it's either network error (fetch failed) or the thrown error.
                    // Network errors are generally not retryable by lowering tokens.
                    throw error;
                }
            }

            console.log('[GoogleVertexPreviewAdapter] Stream complete');

        } catch (error) {
            this.logger.error('[GoogleVertexPreviewAdapter] streamChat failed:', error);
            throw error;
        }
    }
}
