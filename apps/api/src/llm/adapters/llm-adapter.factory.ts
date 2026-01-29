import { ConfigService } from '@nestjs/config';
import { GoogleAuth } from 'google-auth-library';
import { ILlmAdapter } from './llm-adapter.interface';
import { ModelClassifier, LlmProvider } from './model-classifier';
import { GoogleVertexGaAdapter } from './google-vertex-ga.adapter';
import { GoogleVertexPreviewAdapter } from './google-vertex-preview.adapter';
import { MistralAiAdapter } from './mistral-ai.adapter';
import { OpenRouterAdapter } from './openrouter.adapter';
import { ZaiAdapter } from './zai.adapter';
import { LoggerService } from '../../common/logger/logger.service';

/**
 * LLM 适配器工厂
 * 根据模型名称自动选择并创建合适的适配器
 */
export class LlmAdapterFactory {
    static async createAdapter(
        modelName: string,
        configService: ConfigService,
        auth: GoogleAuth,
        logger: LoggerService
    ): Promise<ILlmAdapter> {
        const category = ModelClassifier.getModelCategory(modelName);
        const description = ModelClassifier.getModelDescription(modelName);

        logger.info(
            `[LlmAdapterFactory] Creating adapter for model: ${modelName} (${description})`
        );

        let adapter: ILlmAdapter;

        if (category === LlmProvider.MISTRAL) {
            adapter = new MistralAiAdapter(configService, logger, modelName);
        } else if (category === LlmProvider.OPENROUTER) {
            adapter = new OpenRouterAdapter(configService, logger, modelName);
        } else if (category === LlmProvider.ZAI) {
            adapter = new ZaiAdapter(configService, logger, modelName);
        } else if (category === 'preview') {
            adapter = new GoogleVertexPreviewAdapter(configService, auth, logger, modelName);
        } else {
            adapter = new GoogleVertexGaAdapter(configService, auth, logger, modelName);
        }

        await adapter.initialize();
        return adapter;
    }
}
