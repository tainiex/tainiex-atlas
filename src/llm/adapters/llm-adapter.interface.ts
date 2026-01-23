export type LlmRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ChatMessage {
  role: LlmRole;
  message?: string;
  text?: string;
}

export interface ILlmAdapter {
  /**
   * 初始化适配器
   */
  initialize(): Promise<void>;

  /**
   * 生成单次内容响应
   */
  generateContent(prompt: string): Promise<string>;

  /**
   * 进行对话并返回完整响应
   */
  chat(history: ChatMessage[], message: string): Promise<string>;

  /**
   * 进行流式对话，逐步返回响应内容
   */
  streamChat(history: ChatMessage[], message: string): AsyncGenerator<string>;

  /**
   * 获取文本的向量 Embedding
   */
  getEmbeddings(text: string): Promise<number[]>;
}
