/**
 * Message in the agent conversation
 */
export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  metadata?: Record<string, any>;
}

/**
 * Events emitted by the agent during execution
 */
export type AgentEvent =
  | { type: 'thought'; content: string }
  | { type: 'tool_call'; tool: string; args: any }
  | { type: 'tool_result'; tool: string; result: any }
  | { type: 'answer_chunk'; content: string }
  | { type: 'final_answer'; content: string }
  | { type: 'error'; message: string };

/**
 * Configuration for a single execution run
 */
export interface AgentRunConfig {
  input: string;
  history?: AgentMessage[];
  systemPrompt?: string;
  tools?: any[];
  maxLoops?: number;
  model?: string;
  speculativeModel?: string; // Model to use for fast intent detection (e.g., 'gemini-2.5-flash')
  enableSpeculative?: boolean;
  context?: any;
}

/**
 * Core Agent Engine Interface
 */
export interface IAgentEngine {
  execute(config: AgentRunConfig): AsyncGenerator<AgentEvent>;
}
