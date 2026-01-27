/**
 * LLM Provider Enum
 */
export enum LlmProvider {
  GOOGLE = 'Google',
  MISTRAL = 'Mistral',
  OPENROUTER = 'OpenRouter',
  ZAI = 'Zai',
}

/**
 * Model Metadata Interface
 */
export interface ModelMetadata {
  maxOutputTokens: number;
  description: string;
  provider: LlmProvider;
}

/**
 * Model Configuration Map (Single Source of Truth)
 */
export const MODEL_CONFIG = {
  // Google Models
  'gemini-2.5-pro': {
    maxOutputTokens: 5734,
    provider: LlmProvider.GOOGLE,
    description: 'GA model (VertexAI SDK)',
  },
  'gemini-2.5-flash': {
    maxOutputTokens: 5734,
    provider: LlmProvider.GOOGLE,
    description: 'GA model (VertexAI SDK)',
  },
  'gemini-3-flash-preview': {
    maxOutputTokens: 45875,
    provider: LlmProvider.GOOGLE,
    description: 'Preview model (v1beta1 API)',
  },
  'gemini-3-pro-preview': {
    maxOutputTokens: 45875,
    provider: LlmProvider.GOOGLE,
    description: 'Preview model (v1beta1 API)',
  },

  // Mistral Models
  'mistral-medium-latest': {
    maxOutputTokens: 32000,
    provider: LlmProvider.MISTRAL,
    description: 'Mistral AI Model',
  },
  'mistral-small-latest': {
    maxOutputTokens: 32000,
    provider: LlmProvider.MISTRAL,
    description: 'Mistral AI Model',
  },

  // OpenRouter Models
  'z-ai/glm-4.5-air:free': {
    maxOutputTokens: 128000,
    provider: LlmProvider.OPENROUTER,
    description: 'OpenRouter Model',
  },
  'glm-4.7-flash': {
    maxOutputTokens: 128000,
    provider: LlmProvider.ZAI,
    description: 'Z.ai GLM-4.7 Flash',
  },
} as const satisfies Record<string, ModelMetadata>;

/**
 * Type definition for Model Names derived from configuration
 */
export type LlmModelName = keyof typeof MODEL_CONFIG;

export class ModelClassifier {
  /**
   * 判断是否为 Preview 模型
   * Preview 模型需要使用 REST API v1beta1 端点
   */
  static isPreviewModel(modelName: string): boolean {
    const previewPatterns = [
      /^gemini-3-/i, // Gemini 3 系列全部为 preview
      /preview/i, // 包含 preview 关键字
      /-image/i, // 多模态图像模型（通常为 preview）
      /computer-use/i, // 计算机使用模型（实验性）
    ];

    return previewPatterns.some((pattern) => pattern.test(modelName));
  }

  /**
   * 判断是否为 Mistral 模型
   */
  static isMistralModel(modelName: string): boolean {
    const config = this.getConfig(modelName);
    if (config && config.provider === LlmProvider.MISTRAL) {
      return true;
    }
    return (
      modelName.startsWith('mistral-') || modelName.startsWith('codestral-')
    );
  }

  /**
   * 判断是否为 OpenRouter 模型
   */
  static isOpenRouterModel(modelName: string): boolean {
    const config = this.getConfig(modelName);
    if (config && config.provider === LlmProvider.OPENROUTER) {
      return true;
    }
    return false;
  }

  /**
   * 获取模型配置 helper
   * Returns undefined if modelName is not found
   */
  private static getConfig(modelName: string): ModelMetadata | undefined {
    if (Object.prototype.hasOwnProperty.call(MODEL_CONFIG, modelName)) {
      return MODEL_CONFIG[modelName as LlmModelName];
    }
    return undefined;
  }

  /**
   * 获取模型元数据
   */
  static getMetadata(modelName: string): ModelMetadata {
    const validatedName = this.validateModel(modelName);
    // Safe because validatedName is guaranteed to be a key of MODEL_CONFIG
    const config = MODEL_CONFIG[validatedName];

    return {
      maxOutputTokens: config.maxOutputTokens,
      description: config.description,
      provider: config.provider,
    };
  }

  private static readonly DEFAULT_MODEL: LlmModelName = 'gemini-2.5-flash';

  /**
   * 获取所有支持的模型列表
   */
  static getSupportedModels(): LlmModelName[] {
    return Object.keys(MODEL_CONFIG) as LlmModelName[];
  }

  /**
   * 验证模型名称，如果无效则返回默认模型
   */
  static validateModel(modelName?: string): LlmModelName {
    if (
      modelName &&
      Object.prototype.hasOwnProperty.call(MODEL_CONFIG, modelName)
    ) {
      return modelName as LlmModelName;
    }
    return this.DEFAULT_MODEL;
  }

  /**
   * 获取模型类别
   */
  static getModelCategory(modelName: string): 'preview' | 'ga' | LlmProvider {
    const config = this.getConfig(modelName);

    if (config) {
      if (config.provider === LlmProvider.OPENROUTER)
        return LlmProvider.OPENROUTER;
      if (config.provider === LlmProvider.MISTRAL) return LlmProvider.MISTRAL;
      if (config.provider === LlmProvider.ZAI) return LlmProvider.ZAI;
    }

    // Fallback logic
    if (this.isMistralModel(modelName)) {
      return LlmProvider.MISTRAL;
    }
    return this.isPreviewModel(modelName) ? 'preview' : 'ga';
  }

  /**
   * 获取模型的可读描述 - now mainly wrapping metadata or fallback
   */
  static getModelDescription(modelName: string): string {
    const config = this.getConfig(modelName);
    if (config?.description) {
      return config.description;
    }
    return this.generateFallbackDescription(modelName);
  }

  private static generateFallbackDescription(modelName: string): string {
    const category = this.getModelCategory(modelName);
    if (category === LlmProvider.OPENROUTER) {
      return 'OpenRouter Model';
    }
    if (category === LlmProvider.MISTRAL) {
      return 'Mistral AI Model';
    }
    if (category === LlmProvider.ZAI) {
      return 'Z.ai Model';
    }
    return category === 'preview'
      ? 'Preview model (v1beta1 API)'
      : 'GA model (VertexAI SDK)';
  }
}
