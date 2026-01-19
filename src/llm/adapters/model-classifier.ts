/**
 * 模型分类器
 * 根据模型名称判断应使用哪种适配器
 */
export interface ModelMetadata {
  maxOutputTokens: number;
  description: string;
}

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
   * 获取模型类别
   */
  static getModelCategory(modelName: string): 'preview' | 'ga' {
    return this.isPreviewModel(modelName) ? 'preview' : 'ga';
  }

  /**
   * 获取模型的可读描述
   */
  static getModelDescription(modelName: string): string {
    const category = this.getModelCategory(modelName);
    return category === 'preview'
      ? 'Preview model (v1beta1 API)'
      : 'GA model (VertexAI SDK)';
  }

  // Unified Model Configuration
  private static readonly _MODELS = [
    { name: 'gemini-2.5-pro', maxOutputTokens: 5734 },
    { name: 'gemini-2.5-flash', maxOutputTokens: 5734 },
    { name: 'gemini-3-flash-preview', maxOutputTokens: 45875 },
    { name: 'gemini-3-pro-preview', maxOutputTokens: 45875 },
  ];

  /**
   * 获取模型元数据
   * Get model metadata including token limits
   */
  static getMetadata(modelName: string): ModelMetadata {
    const validatedName = this.validateModel(modelName);
    const description = this.getModelDescription(validatedName);

    const modelDef = this._MODELS.find((m) => m.name === validatedName);
    const maxOutputTokens = modelDef?.maxOutputTokens || 5734;

    return {
      maxOutputTokens,
      description,
    };
  }

  private static readonly DEFAULT_MODEL = 'gemini-2.5-flash';

  /**
   * 获取所有支持的模型列表
   */
  static getSupportedModels(): string[] {
    return this._MODELS.map((m) => m.name);
  }

  /**
   * 验证模型名称，如果无效则返回默认模型
   */
  static validateModel(modelName?: string): string {
    const supported = this.getSupportedModels();
    if (!modelName || !supported.includes(modelName)) {
      return this.DEFAULT_MODEL;
    }
    return modelName;
  }
}
