import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuth } from 'google-auth-library';
import { ILlmAdapter, ChatMessage, LlmRole } from './llm-adapter.interface';
import { ModelClassifier } from './model-classifier';
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
    modelName: string,
  ) {
    this.modelName = modelName;
  }

  initialize(): Promise<void> {
    this.logger.info(
      `[GoogleVertexPreviewAdapter] Initialized model: ${this.modelName}`,
    );
    return Promise.resolve();
  }

  /**
   * Generic retry wrapper for network operations
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    retries = 3,
    delay = 1000,
  ): Promise<T> {
    let lastError: unknown;

    for (let i = 0; i < retries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const err = error as Error & { code?: string };
        const isNetworkError =
          err.message?.includes('fetch failed') ||
          err.message?.includes('ConnectTimeoutError') ||
          err.message?.includes('socket hang up') ||
          err.message?.includes('exception posting request') ||
          err.code === 'UND_ERR_CONNECT_TIMEOUT' ||
          err.code === 'ETIMEDOUT';

        if (isNetworkError && i < retries - 1) {
          const waitTime = delay * Math.pow(2, i); // Exponential backoff
          this.logger.warn(
            `[GoogleVertexPreviewAdapter] Network error: ${err.message}. Retrying in ${waitTime}ms... (${i + 1}/${retries})`,
          );
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  async generateContent(prompt: string): Promise<string> {
    const projectId = this.configService.get<string>('VERTEX_PROJECT_ID');
    const location = this.configService.get<string>(
      'VERTEX_LOCATION',
      'us-central1',
    );

    const url = `https://aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${location}/publishers/google/models/${this.modelName}:generateContent`;

    const requestBody = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    };

    try {
      const client = await this.auth.getClient();
      const token = await client.getAccessToken();

      const response = await this.withRetry(async () => {
        return fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Vertex AI Error: ${response.statusText} - ${errorText}`,
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const data = await response.json();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return (text as string) || '';
    } catch (error) {
      this.logger.error(
        '[GoogleVertexPreviewAdapter] generateContent failed:',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        error,
      );
      throw error;
    }
  }

  private mapRoleToVertex(role: LlmRole): string {
    switch (role) {
      case 'user':
        return 'user';
      case 'assistant':
        return 'model';
      case 'system':
        return 'user'; // Fallback
      default:
        this.logger.warn(
          `[GoogleVertexPreviewAdapter] Unknown role encountered: ${role as string}. Defaulting to 'user'.`,
        );
        return 'user';
    }
  }

  async chat(history: ChatMessage[], message: string): Promise<string> {
    const projectId = this.configService.get<string>('VERTEX_PROJECT_ID');
    const location = this.configService.get<string>(
      'VERTEX_LOCATION',
      'us-central1',
    );

    const url = `https://aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${location}/publishers/google/models/${this.modelName}:generateContent`;

    const requestBodyBase = {
      contents: [
        ...history.map((h) => ({
          role: this.mapRoleToVertex(h.role),
          parts: [{ text: h.message || h.text || '' }],
        })),
        { role: 'user', parts: [{ text: message }] },
      ],
    };

    const metadata = ModelClassifier.getMetadata(this.modelName);
    const maxOutputTokens = metadata.maxOutputTokens;

    const requestBody = {
      ...requestBodyBase,
      generationConfig: {
        maxOutputTokens,
        temperature: 0.9,
        topP: 0.95,
        topK: 40,
      },
    };

    try {
      const client = await this.auth.getClient();
      const token = await client.getAccessToken();

      const response = await this.withRetry(async () => {
        return fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Vertex AI Error: ${response.statusText} - ${errorText}`,
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const data = await response.json();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return (text as string) || '';
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      this.logger.error('[GoogleVertexPreviewAdapter] chat failed:', error);
      throw error;
    }
  }

  async *streamChat(
    history: ChatMessage[],
    message: string,
  ): AsyncGenerator<string> {
    this.logger.log('[GoogleVertexPreviewAdapter] streamChat called');
    const projectId = this.configService.get<string>('VERTEX_PROJECT_ID');
    const location = this.configService.get<string>(
      'VERTEX_LOCATION',
      'us-central1',
    );

    const url = `https://aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${location}/publishers/google/models/${this.modelName}:streamGenerateContent`;

    const metadata = ModelClassifier.getMetadata(this.modelName);
    const currentMaxTokens = metadata.maxOutputTokens;

    const requestBody = {
      generationConfig: {
        temperature: 0.9,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: currentMaxTokens,
      },
      contents: [
        ...history.map((h) => ({
          role: this.mapRoleToVertex(h.role),
          parts: [{ text: h.message || h.text || '' }],
        })),
        { role: 'user', parts: [{ text: message }] },
      ],
    };

    console.log(
      '[GoogleVertexPreviewAdapter] Request Body:',
      JSON.stringify(requestBody, null, 2),
    );

    try {
      const client = await this.auth.getClient();
      const token = await client.getAccessToken();

      const response = await this.withRetry(async () => {
        return fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Vertex AI Stream Error: ${response.statusText} - ${errorText}`,
        );
      }

      if (!response.body) throw new Error('Response body is null');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      console.log(
        '[GoogleVertexPreviewAdapter] Starting JSON stream parsing...',
      );

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
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const data = JSON.parse(jsonStr);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              yield text;
            }
          } catch (e) {
            this.logger.error('[GoogleVertexPreviewAdapter] JSON parse error:', e);
          }

          startIdx = objEnd + 1;
        }

        buffer = buffer.substring(startIdx);
      }

      this.logger.log('[GoogleVertexPreviewAdapter] Stream complete');
    } catch (error) {
      this.logger.error(
        '[GoogleVertexPreviewAdapter] streamChat failed:',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        error,
      );
      throw error;
    }
  }

  getEmbeddings(_text: string): Promise<number[]> {
    throw new Error(
      'Method not implemented in Preview Adapter. Use GA Adapter for embeddings.',
    );
  }
}
