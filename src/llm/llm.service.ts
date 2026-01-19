import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as aiplatform from '@google-cloud/aiplatform';
import { GoogleAuth } from 'google-auth-library';
import { ILlmAdapter } from './adapters/llm-adapter.interface';
import { LlmAdapterFactory } from './adapters/llm-adapter.factory';
import { ModelClassifier } from './adapters/model-classifier';
import { LoggerService } from '../common/logger/logger.service';

@Injectable()
export class LlmService implements OnModuleInit {
  private auth: GoogleAuth;
  private adapters: Map<string, ILlmAdapter> = new Map();

  constructor(
    private configService: ConfigService,
    private logger: LoggerService,
  ) {
    const projectId = this.configService.get<string>('VERTEX_PROJECT_ID');

    const authOptions: any = {
      scopes: 'https://www.googleapis.com/auth/cloud-platform',
      projectId: projectId,
    };
    const gsaKeyFile = this.configService.get<string>('GSA_KEY_FILE');
    if (gsaKeyFile) {
      authOptions.keyFile = gsaKeyFile;
    }

    this.auth = new GoogleAuth(authOptions);
  }

  async onModuleInit() {
    // No longer pre-initializing a single adapter.
    // Adapters will be created on demand.
  }

  private async getAdapter(modelName?: string): Promise<ILlmAdapter> {
    // Validate model name via Classifier, default if missing/invalid
    const validatedModel = ModelClassifier.validateModel(modelName);

    if (this.adapters.has(validatedModel)) {
      return this.adapters.get(validatedModel)!;
    }

    const adapter = await LlmAdapterFactory.createAdapter(
      validatedModel,
      this.configService,
      this.auth,
      this.logger,
    );

    this.adapters.set(validatedModel, adapter);
    this.logger.log(
      `[LlmService] Created new Adapter for model '${validatedModel}': ${adapter.constructor.name}`,
    );
    return adapter;
  }

  async listModels(): Promise<any[]> {
    // Now returns the static supported list instead of querying API
    return ModelClassifier.getSupportedModels().map((m) => ({ name: m }));
  }

  /**
   * Fetch the actual list of supported models from Google Vertex AI (Model Garden).
   * CAUTION: This requires valid Google Credentials.
   */
  async listRemoteModels(): Promise<any[]> {
    const projectId = this.configService.get<string>('VERTEX_PROJECT_ID');
    const location = this.configService.get<string>(
      'VERTEX_LOCATION',
      'us-central1',
    );
    const apiEndpoint = `${location}-aiplatform.googleapis.com`;

    this.logger.debug(`[LlmService] listRemoteModels Configuration:`);
    this.logger.debug(`- Project ID: ${projectId}`);
    this.logger.debug(`- Location: ${location}`);
    this.logger.debug(`- API Endpoint: ${apiEndpoint}`);

    try {
      const authClient = await this.auth.getClient();
      const clientOptions: any = {
        apiEndpoint,
        authClient: authClient, // Use the authenticated client
        projectId,
      };

      this.logger.log(
        `[LlmService] Initializing SDK (ModelGardenServiceClient) with options: ${JSON.stringify({ ...clientOptions, authClient: '[AuthClient]' })}`,
      );

      // Use ModelGardenServiceClient to fetch TRUE supported models
      const modelClient = new aiplatform.v1beta1.ModelGardenServiceClient(
        clientOptions,
      ) as any;
      const parent = 'publishers/google'; // Correct parent for Publisher models

      const [response] = await modelClient.listPublisherModels({
        parent,
      });

      return response.map((model: any) => ({
        name: model.name.split('/').pop(), // extract simple name
        version: model.versionId,
        full_name: model.name,
      }));
    } catch (error) {
      this.logger.error('Failed to list remote models via SDK', error);
      throw error;
    }
  }

  async generateContent(prompt: string, modelName?: string): Promise<string> {
    const adapter = await this.getAdapter(modelName);
    this.logger.debug(
      `[LlmService] Generating content using model '${modelName}' via adapter: ${adapter.constructor.name}`,
    );
    return adapter.generateContent(prompt);
  }

  async chat(
    history: any[],
    message: string,
    modelName?: string,
  ): Promise<string> {
    const adapter = await this.getAdapter(modelName);
    this.logger.debug(
      `[LlmService] Chatting using model '${modelName}' via adapter: ${adapter.constructor.name}`,
    );
    return adapter.chat(history, message);
  }

  async *streamChat(
    history: any[],
    message: string,
    modelName?: string,
  ): AsyncGenerator<string> {
    const adapter = await this.getAdapter(modelName);
    console.log(
      `[LlmService] streamChat using model: ${modelName} (Adapter: ${adapter.constructor.name})`,
    );

    yield* adapter.streamChat(history, message);
  }

  async getEmbeddings(text: string): Promise<number[]> {
    // Default to text-embedding-004 which is stable/GA
    const modelName =
      this.configService.get<string>('VERTEX_EMBEDDING_MODEL') ||
      'text-embedding-004';
    const adapter = await this.getAdapter(modelName);
    return adapter.getEmbeddings(text);
  }
}
