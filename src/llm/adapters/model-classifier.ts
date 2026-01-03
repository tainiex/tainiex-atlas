/**
 * 模型分类器
 * 根据模型名称判断应使用哪种适配器
 */
export class ModelClassifier {
    /**
     * 判断是否为 Preview 模型
     * Preview 模型需要使用 REST API v1beta1 端点
     */
    static isPreviewModel(modelName: string): boolean {
        const previewPatterns = [
            /^gemini-3-/i,                    // Gemini 3 系列全部为 preview
            /preview/i,                       // 包含 preview 关键字
            /-image/i,                        // 多模态图像模型（通常为 preview）
            /computer-use/i,                  // 计算机使用模型（实验性）
        ];

        return previewPatterns.some(pattern => pattern.test(modelName));
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
}
