import { AgentMessage } from './agent.interface';

/**
 * LLM Provider Interface (Framework-agnostic)
 * This abstracts the LLM interaction from the core agent logic
 */
export interface ILlmProvider {
  /**
   * Stream chat with LLM
   * @param history - Conversation history (including system message)
   * @param model - Model name to use
   * @param tools - Optional tool definitions for native function calling
   */
  streamChat(
    history: AgentMessage[],
    model?: string,
    tools?: any[],
    options?: { signal?: AbortSignal },
  ): AsyncGenerator<string>;

  /**
   * Non-streaming chat with LLM
   * @param history - Conversation history (including system message)
   * @param model - Model name to use
   * @param tools - Optional tool definitions for native function calling
   */
  chat(history: AgentMessage[], model?: string, tools?: any[]): Promise<string>;
}
