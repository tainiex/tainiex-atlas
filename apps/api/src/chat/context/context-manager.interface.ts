import { ChatMessage } from '../chat-message.entity';

export interface IContextManager {
  /**
   * Retrieves the strictly managed context for a session, ensuring it fits within token limits.
   * @param sessionId The ID of the chat session
   * @param options Configuration options (e.g., maxTokens)
   */
  getContext(
    sessionId: string,
    options?: { maxTokens?: number },
  ): Promise<ChatMessage[]>;
}
