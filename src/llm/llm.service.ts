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
        private logger: LoggerService
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
            this.logger
        );

        this.adapters.set(validatedModel, adapter);
        return adapter;
    }

    async listModels(): Promise<any[]> {
        // Now returns the static supported list instead of querying API
        // This matches the requirement to only restrict to specific models
        return ModelClassifier.getSupportedModels().map(m => ({ name: m }));
    }

    async generateContent(prompt: string, modelName?: string): Promise<string> {
        const adapter = await this.getAdapter(modelName);
        return adapter.generateContent(prompt);
    }

    async chat(history: any[], message: string, modelName?: string): Promise<string> {
        const adapter = await this.getAdapter(modelName);
        return adapter.chat(history, message);
    }

    async *streamChat(history: any[], message: string, modelName?: string): AsyncGenerator<string> {
        const adapter = await this.getAdapter(modelName);
        console.log(`[LlmService] streamChat using model: ${modelName} (Adapter: ${adapter.constructor.name})`);

        yield* adapter.streamChat(history, message);
    }
}
