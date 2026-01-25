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
    modelName: string,
  ) {
    this.modelName = modelName;
  }

  /**
   * 初始化 VertexAI SDK
   */
  async initialize(): Promise<void> {
    const projectId = this.configService.get<string>('VERTEX_PROJECT_ID');
    const location = this.configService.get<string>(
      'VERTEX_LOCATION',
      'us-central1',
    );

    const authClient = await this.auth.getClient();

    const vertexOptions: any = {
      project: projectId,
      location: location,
      googleAuthOptions: {
        authClient: authClient,
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    this.vertexAI = new VertexAI(vertexOptions);
    this.model = this.vertexAI.getGenerativeModel({ model: this.modelName });
    this.logger.info(
      `[GoogleVertexGaAdapter] Initialized model: ${this.modelName}`,
    );
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
            `[GoogleVertexGaAdapter] Network error: ${err.message}. Retrying in ${waitTime}ms... (${i + 1}/${retries})`,
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
    return this.withRetry(async () => {
      try {
        const result = await this.model.generateContent(prompt);
        const response = result.response;
        const text = response.candidates?.[0].content.parts[0].text;
        return text || '';
      } catch (error) {
        this.logger.error(
          '[GoogleVertexGaAdapter] generateContent failed:',
          (error as Error).message,
        );
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
        this.logger.warn(
          `[GoogleVertexGaAdapter] Unknown role encountered: ${role as string}. Defaulting to 'user'.`,
        );
        return 'user';
    }
  }

  async chat(history: ChatMessage[], message: string, tools?: any[]): Promise<string> {
    // Extract System Prompt
    const systemMessage = history.find(h => h.role === 'system');
    const systemInstruction = systemMessage ? (systemMessage.message || systemMessage.text) : undefined;

    const formattedHistory: Content[] = history
      .filter(h => h.role !== 'system')
      .map((h) => ({
        role: this.mapRoleToVertex(h.role),
        parts: [{ text: h.message || h.text || '' }],
      }));

    const metadata = ModelClassifier.getMetadata(this.modelName);
    const maxOutputTokens = metadata.maxOutputTokens;
    const vertexTools = tools && tools.length > 0 ? tools : undefined;

    const runChat = async (): Promise<string> => {
      return this.withRetry(async () => {
        try {
          const chat = this.model.startChat({
            history: formattedHistory,
            systemInstruction: systemInstruction ? { role: 'system', parts: [{ text: systemInstruction }] } : undefined,
            tools: vertexTools, // Native function calling
            generationConfig: {
              maxOutputTokens,
              temperature: 0.9,
              topP: 0.95,
              topK: 40,
            },
          });

          const result = await chat.sendMessage(message);
          const response = result.response;

          // Check for function call
          const functionCall = response.candidates?.[0]?.content?.parts?.[0]?.functionCall;
          if (functionCall) {
            this.logger.debug('[GoogleVertexGaAdapter] ✓ Function call detected:', functionCall.name);
            return JSON.stringify({ tool: functionCall.name, parameters: functionCall.args || {} });
          }

          const text = response.candidates?.[0].content.parts[0].text;
          return text || '';
        } catch (error) {
          this.logger.error(
            '[GoogleVertexGaAdapter] chat failed:',
            (error as Error).message,
          );
          throw error;
        }
      });
    };

    return runChat();
  }

  async *streamChat(
    history: ChatMessage[],
    message: string,
    tools?: any[],
  ): AsyncGenerator<string> {
    // Extract System Prompt
    const systemMessage = history.find(h => h.role === 'system');
    const systemInstruction = systemMessage ? (systemMessage.message || systemMessage.text) : undefined;

    const formattedHistory: Content[] = history
      .filter(h => h.role !== 'system')
      .map((h) => ({
        role: this.mapRoleToVertex(h.role),
        parts: [{ text: h.message || h.text || '' }],
      }));

    // Convert tools to Vertex AI format
    let vertexTools: any[] | undefined = undefined;
    if (tools && tools.length > 0) {
      vertexTools = [{
        functionDeclarations: tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }))
      }];
      console.log('[GoogleVertexGaAdapter] ✓ Configured native function calling with', tools.length, 'tools');
    }

    const metadata = ModelClassifier.getMetadata(this.modelName);
    const currentMaxTokens = metadata.maxOutputTokens;

    while (true) {
      try {
        const chatConfig: any = {
          history: formattedHistory,
          generationConfig: {
            maxOutputTokens: currentMaxTokens,
            temperature: 0.9,
            topP: 0.95,
            topK: 40,
          },
        };

        if (systemInstruction) {
          chatConfig.systemInstruction = { role: 'system', parts: [{ text: systemInstruction }] };
        }

        if (vertexTools) {
          chatConfig.tools = vertexTools;
        }

        const chat = this.model.startChat(chatConfig);

        // Wrap the initial network request (sendMessageStream) with retry
        const result = await this.withRetry(async () => {
          return await chat.sendMessageStream(message);
        });

        let chunkCount = 0;
        for await (const chunk of result.stream) {
          chunkCount++;

          // Check for function call
          const functionCall = chunk.candidates?.[0]?.content?.parts?.[0]?.functionCall;
          if (functionCall) {
            console.log('[GoogleVertexGaAdapter] ✓ Function call detected:', functionCall.name);
            const toolCallJson = JSON.stringify({ tool: functionCall.name, parameters: functionCall.args || {} });
            yield toolCallJson;
            return; // Stop after function call
          }

          const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            console.log(
              `[GoogleVertexGaAdapter] Yielding chunk ${chunkCount}: "${text.substring(0, 20)}..."`,
            );
            yield text;
          }
        }
        console.log(
          `[GoogleVertexGaAdapter] Stream finished with ${chunkCount} chunks`,
        );
        return; // Success, exit loop
      } catch (error) {
        const err = error as Error & { code?: string };
        const isNetworkError =
          err.message?.includes('fetch failed') ||
          err.message?.includes('ConnectTimeoutError') ||
          err.message?.includes('exception posting request') ||
          err.code === 'UND_ERR_CONNECT_TIMEOUT';

        if (isNetworkError) {
          // Ideally we should check if we yielded anything.
          // If we haven't yielded yet, we can retry safe.
          // If we yielded, restarting might be messy but better than crash?
          // Let's just log and throw for now, relying on withRetry for the INITIAL connection which is the main issue.
          // Wait, if I want to support retrying the connection establishment, existing withRetry does that.
          // If the stream breaks, proper resumption is hard.
          // Let's assume the user's issue is INITIAL connection timeout.
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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
        const location = this.configService.get<string>(
          'VERTEX_LOCATION',
          'us-central1',
        );
        const apiEndpoint = `${location}-aiplatform.googleapis.com`;

        // Lazy load PredictionServiceClient to avoid import issues if unused

        const { PredictionServiceClient, helpers } =
          await import('@google-cloud/aiplatform');

        // Pass the GoogleAuth instance directly

        const client = new PredictionServiceClient({
          apiEndpoint: apiEndpoint,
          auth: this.auth,
          projectId: projectId,
        });

        const model =
          this.configService.get<string>('VERTEX_EMBEDDING_MODEL') ||
          'text-embedding-004';
        const endpoint = `projects/${projectId}/locations/${location}/publishers/google/models/${model}`;

        const instanceValue = helpers.toValue({
          content: text,
          task_type: 'RETRIEVAL_QUERY',
        });

        // Fix TS2488: Don't destructure, handle promise properly

        const predictResult = await client.predict({
          endpoint,

          instances: [instanceValue as any],
        });

        const response = predictResult[0];

        const predictions = response.predictions;

        if (!predictions || predictions.length === 0) {
          throw new Error('No predictions returned');
        }

        const embedding =
          predictions[0].structValue?.fields?.embeddings?.structValue?.fields?.values?.listValue?.values?.map(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            (v: any) => (v.numberValue as number) || 0,
          );

        if (!embedding) {
          // Try alternative structure if above fails
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          const predictionVal = helpers.fromValue(predictions[0] as any) as {
            embeddings?: { values?: number[] };
          };

          if (
            predictionVal?.embeddings &&
            Array.isArray(predictionVal.embeddings.values)
          ) {
            return predictionVal.embeddings.values;
          }
          throw new Error('Could not parse embedding from response');
        }

        return embedding;
      } catch (error) {
        this.logger.error(
          '[GoogleVertexGaAdapter] getEmbeddings failed:',
          (error as Error).message,
        );
        throw error;
      }
    });
  }
}
