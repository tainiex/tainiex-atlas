/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/require-await */
import { Injectable } from '@nestjs/common';
import { LlmService } from '../../llm/llm.service';
import { ReactAgentEngine } from '../../agent-core/react-engine';
import { ILlmProvider } from '../../agent-core/interfaces/llm-provider.interface';
import { AgentMessage } from '../../agent-core/interfaces/agent.interface';
import { ToolRegistryService } from './tool-registry.service';
import { IToolProvider } from '../interfaces/tool-provider.interface';

@Injectable()
export class AgentFactory {
  constructor(
    private readonly toolRegistry: ToolRegistryService,
    private readonly llmService: LlmService,
  ) {}

  /**
   * Create a new Agent Engine instance
   */
  createAgent(): ReactAgentEngine {
    // Create LLM Adapter
    const llmAdapter: ILlmProvider = {
      chat: async (history: AgentMessage[], model?: string, tools?: any[]) => {
        console.log(
          '[AgentFactory.LLMAdapter] chat called with',
          history.length,
          'messages',
        );
        const lastMessage = history[history.length - 1];
        const historyWithoutLast = history.slice(0, -1);
        console.log(
          '[AgentFactory.LLMAdapter] Tools count:',
          tools?.length || 0,
        );

        const llmMessages = historyWithoutLast.map((m) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          message: m.content,
        }));

        return this.llmService.chat(
          llmMessages,
          lastMessage.content,
          model,
          tools,
        );
      },
      streamChat: async function* (
        history: AgentMessage[],
        model?: string,
        tools?: any[],
      ) {
        console.log(
          '[AgentFactory.LLMAdapter] streamChat called with',
          history.length,
          'messages',
        );
        const lastMessage = history[history.length - 1];
        console.log('[AgentFactory.LLMAdapter] Last message:', {
          role: lastMessage.role,
          content: lastMessage.content.substring(0, 100),
        });
        const historyWithoutLast = history.slice(0, -1);
        console.log(
          '[AgentFactory.LLMAdapter] History length after pop:',
          historyWithoutLast.length,
        );
        console.log(
          '[AgentFactory.LLMAdapter] Tools count:',
          tools?.length || 0,
        );
        console.log(
          '[AgentFactory.LLMAdapter] Content to send:',
          lastMessage.content.substring(0, 100),
        );

        const llmMessages = historyWithoutLast.map((m) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          message: m.content,
        }));

        yield* this.llmService.streamChat(
          llmMessages,
          lastMessage.content,
          model,
          tools,
        );
      }.bind(this),
    };

    return new ReactAgentEngine(llmAdapter);
  }

  getTools(scope: string = 'global'): IToolProvider[] {
    // Delegate to ToolRegistryService which has already done validation
    this.toolRegistry.getToolsDefinitions([scope]);
    // Convert tool definitions back to providers by looking them up
    // Actually, we need direct access to providers, not just definitions
    // Let's add a new method to ToolRegistryService or access the map
    // For now, assume ToolRegistryService exposes getToolProviders()
    return this.toolRegistry.getToolProviders([scope]);
  }
}
