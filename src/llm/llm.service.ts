import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as aiplatform from '@google-cloud/aiplatform';
import { GoogleAuth } from 'google-auth-library';
import { ILlmAdapter } from './adapters/llm-adapter.interface';
import { LlmAdapterFactory } from './adapters/llm-adapter.factory';
import { LoggerService } from '../common/logger/logger.service';

@Injectable()
export class LlmService implements OnModuleInit {
    private auth: GoogleAuth;
    private adapter: ILlmAdapter;

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
        const modelName = this.configService.get<string>('VERTEX_MODEL', 'gemini-2.0-flash-001');
        this.adapter = await LlmAdapterFactory.createAdapter(
            modelName,
            this.configService,
            this.auth,
            this.logger
        );
    }

    async listModels(): Promise<any[]> {
        const projectId = this.configService.get<string>('VERTEX_PROJECT_ID');
        const location = this.configService.get<string>('VERTEX_LOCATION', 'us-central1');
        const apiEndpoint = `${location}-aiplatform.googleapis.com`;

        this.logger.debug(`[LlmService] Listing models for Project: ${projectId}, Location: ${location}`);

        try {
            const authClient = await this.auth.getClient();
            const clientOptions: any = {
                apiEndpoint,
                authClient: authClient,
                projectId
            };

            const modelClient = new aiplatform.v1beta1.ModelGardenServiceClient(clientOptions) as any;
            const parent = 'publishers/google';

            const [models] = await modelClient.listPublisherModels({ parent });

            this.logger.debug(`[LlmService] Total models found: ${models.length}`);

            return models
                .map((m: any) => ({
                    name: m.name.split('/').pop(),
                    displayName: m.displayName || m.name,
                    supportedActions: m.supportedActions,
                    versionId: m.versionId,
                }))
                .sort((a, b) => a.name.localeCompare(b.name));
        } catch (error) {
            this.logger.error('[LlmService] Failed to list models:', error);
            throw error;
        }
    }

    async generateContent(prompt: string): Promise<string> {
        return this.adapter.generateContent(prompt);
    }

    async chat(history: any[], message: string): Promise<string> {
        return this.adapter.chat(history, message);
    }

    async *streamChat(history: any[], message: string): AsyncGenerator<string> {
        console.log('[LlmService] streamChat called, adapter:', this.adapter?.constructor?.name || 'undefined');
        if (!this.adapter) {
            console.error('[LlmService] Adapter is not initialized!');
            throw new Error('LLM Adapter not initialized');
        }
        console.log('[LlmService] Delegating to adapter.streamChat...');
        yield* this.adapter.streamChat(history, message);
    }
}
