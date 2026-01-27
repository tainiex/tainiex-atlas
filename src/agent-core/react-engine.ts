/**
 * This file contains intentional use of `any` types in the tool system.
 * The tool interface uses `any` for flexibility across different tool implementations.
 * These are design decisions, not oversights.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  IAgentEngine,
  AgentRunConfig,
  AgentEvent,
  AgentMessage,
} from './interfaces/agent.interface';
import { ILlmProvider } from './interfaces/llm-provider.interface';

/**
 * ReAct Agent Engine (Core Implementation)
 *
 * Features:
 * - Pure TypeScript (No framework dependencies)
 * - Speculative Execution (Flash -> Pro fallback)
 * - Generator-based Streaming
 * - Tool Deduplication
 */
export class ReactAgentEngine implements IAgentEngine {
  constructor(private llm: ILlmProvider) {}

  async *execute(config: AgentRunConfig): AsyncGenerator<AgentEvent> {
    const {
      input,
      history = [],
      systemPrompt,
      tools = [],
      maxLoops = 5,
      enableSpeculative = true,
      context = {},
    } = config;

    // System Prompt - NO longer includes tool definitions (using native tools parameter instead)
    console.log('[ReactAgentEngine] Tools count:', tools.length);
    console.log('[ReactAgentEngine] Will pass tools natively to LLM');

    // Build basic system prompt (no tool descriptions)
    const basicSystemPrompt = systemPrompt || '';

    console.log(
      '[ReactAgentEngine] System Prompt (without tools):',
      basicSystemPrompt.substring(0, 300) + '...',
    );

    const currentHistory: AgentMessage[] = [
      { role: 'system', content: basicSystemPrompt },
      ...history,
      { role: 'user', content: input },
    ];

    console.log(
      '[ReactAgentEngine] History length (including system):',
      currentHistory.length,
    );

    let loopCount = 0;
    let speculativeRetries = 0;
    const MAX_SPECULATIVE_RETRIES = 2; // Limit speculative retries

    while (loopCount < maxLoops) {
      loopCount++;
      console.log(
        `[ReactAgentEngine] ===== Loop ${loopCount}/${maxLoops} =====`,
      );

      // --- Speculative Execution Logic ---
      const preferredModel = config.model || 'gemini-1.5-pro';
      const speculativeModel = config.speculativeModel || 'gemini-2.5-flash';
      let effectiveModel = preferredModel;
      let isSpeculative = false;

      // Fast intent detection: Always use speculativeModel for first loop if enabled
      if (
        enableSpeculative &&
        loopCount === 1 &&
        speculativeRetries < MAX_SPECULATIVE_RETRIES
      ) {
        effectiveModel = speculativeModel;
        isSpeculative = true;
        console.log(
          `[ReactAgentEngine] Using speculative execution with ${effectiveModel} (retry ${speculativeRetries}/${MAX_SPECULATIVE_RETRIES})`,
        );
      } else {
        console.log(
          `[ReactAgentEngine] Using model: ${effectiveModel}, speculative: ${isSpeculative}`,
        );
      }

      // Start Stream
      let accumulatedResponse = '';

      // Convert tools to format expected by LLM (will be transformed to Vertex AI format by adapter)
      const toolsForLLM = tools.map((t) => ({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        name: t.name,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        description: t.description,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        parameters: t.parameters,
      }));

      console.log(
        '[ReactAgentEngine] Calling LLM with',
        toolsForLLM.length,
        'tools',
      );

      // Prepare messages for LLM
      let messagesForLLM = currentHistory;
      if (isSpeculative) {
        // Clone array to avoid mutating currentHistory references where it matters
        messagesForLLM = [...currentHistory];

        const constraintPrompt =
          '\n\n[SYSTEM ADVISORY: INTENT DETECTION MODE]\n' +
          'You are a high-speed Intent Classifier. You are NOT a chatbot. \n' +
          "TASK: Determine if the user's last message requires using a tool.\n" +
          'OUTPUT FORMAT RULES:\n' +
          '- If YES (needs tool): Output ONLY the JSON for the tool call.\n' +
          "- If NO (no tool needed, e.g. general chat, questions): Output EXACTLY and ONLY the word 'PASS'.\n" +
          '\n' +
          'CRITICAL CONSTRAINTS:\n' +
          '- DO NOT answer the question.\n' +
          '- DO NOT provide explanations.\n' +
          "- DO NOT output anything else after 'PASS'.\n" +
          "- If you output 'PASS', the response must end immediately. STOP GENERATING.";

        if (messagesForLLM.length > 0 && messagesForLLM[0].role === 'system') {
          const originalSystem = messagesForLLM[0];
          messagesForLLM[0] = {
            ...originalSystem,
            content: originalSystem.content + constraintPrompt,
          };
        } else {
          messagesForLLM.unshift({
            role: 'system',
            content: constraintPrompt,
          });
        }
      }

      const llmStream = this.llm.streamChat(
        messagesForLLM,
        effectiveModel,
        toolsForLLM,
      );

      // Stream-first approach: Start streaming immediately, detect tool calls on the fly
      console.log('[ReactAgentEngine] Starting LLM stream...');
      let isFirstChunk = true;
      let hasToolCall = false;

      for await (const chunk of llmStream) {
        accumulatedResponse += chunk;

        // On first chunk, check if it's a native function call (JSON format)
        if (isFirstChunk) {
          isFirstChunk = false;
          // Native function calling returns JSON in first chunk
          if (chunk.trim().startsWith('{')) {
            console.log(
              '[ReactAgentEngine] First chunk looks like JSON tool call, will buffer to parse',
            );
            hasToolCall = true;
            continue; // Continue buffering
          } else {
            // It's a normal text response
            if (!isSpeculative) {
              console.log(
                '[ReactAgentEngine] First chunk is text, streaming to user...',
              );
              yield { type: 'answer_chunk', content: chunk };
            } else {
              console.log(
                '[ReactAgentEngine] First chunk is text (speculative), buffering only...',
              );
            }
          }
        } else if (hasToolCall) {
          // Continue buffering for tool call parsing
          continue;
        } else {
          // Stream subsequent chunks directly
          if (!isSpeculative) {
            yield { type: 'answer_chunk', content: chunk };
          }
        }
      }

      console.log(
        '[ReactAgentEngine] Stream complete, length:',
        accumulatedResponse.length,
        hasToolCall ? '(tool call)' : '(text response)',
      );

      const trimmedResponse = accumulatedResponse.trim();
      console.log(
        '[ReactAgentEngine] LLM Response preview:',
        trimmedResponse.substring(0, 200) + '...',
      );

      // Only parse for tool calls if we detected potential JSON
      let toolCall: { tool: string; parameters: any } | null = null;
      if (hasToolCall) {
        console.log(
          '[ReactAgentEngine] Parsing buffered JSON for tool call...',
        );
        toolCall = this.parseToolCall(trimmedResponse);
        console.log(
          '[ReactAgentEngine] parseToolCall result:',
          toolCall ? `Tool: ${toolCall.tool}` : 'null (invalid JSON)',
        );
      } else {
        console.log(
          '[ReactAgentEngine] Skipping tool call parsing (text response)',
        );
      }

      // Speculative Logic Refined:
      // If Speculative Model (Flash) finds NO tool call, it means the user's intent is likely just "Chat".
      // In this case, we MUST switch to the "Preferred Model" (GLM/Pro) to generate the actual high-quality response.
      // We should NOT use Flash's response as the final answer unless they are the same model.

      if (isSpeculative && !toolCall) {
        if (effectiveModel !== preferredModel) {
          console.log(
            `[ReactAgentEngine] ⚠️  Speculative model (${effectiveModel}) detected no tool. Switching to preferred model (${preferredModel}) for response.`,
          );
          // Disable speculative execution for the retry (handoff to preferred)
          speculativeRetries = MAX_SPECULATIVE_RETRIES;
          loopCount--; // Retry this loop iteration
          continue;
        }
        // If effectiveModel IS preferredModel, then we just proceed to output answer.
      }

      // If we are here, either:
      // 1. Speculative success (Tool call found)
      // 2. Normal execution (Tool call or Answer)

      if (toolCall) {
        console.log(
          `[ReactAgentEngine] ✓ Tool call detected: ${toolCall.tool}`,
        );
        console.log(
          '[ReactAgentEngine] Tool parameters:',
          JSON.stringify(toolCall.parameters),
        );
        yield { type: 'thought', content: trimmedResponse };
        yield {
          type: 'tool_call',
          tool: toolCall.tool,
          args: toolCall.parameters,
        };

        // Execute Tool
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const toolInstance = tools.find((t: any) => t.name === toolCall.tool);
        let result: any;

        if (toolInstance) {
          console.log(
            `[ReactAgentEngine] ✓ Tool "${toolCall.tool}" found in registry, executing...`,
          );
          try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            result = await toolInstance.execute(toolCall.parameters, context);
            console.log('[ReactAgentEngine] ✓ Tool execution successful');
            console.log(
              '[ReactAgentEngine] Tool result:',
              JSON.stringify(result).substring(0, 200),
            );
          } catch (e) {
            console.log(
              '[ReactAgentEngine] ✗ Tool execution error:',
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              e.message,
            );
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            result = `Error executing tool: ${e.message}`;
          }
        } else {
          console.log(
            `[ReactAgentEngine] ✗ ERROR: Tool "${toolCall.tool}" not found in registry!`,
          );
          console.log(
            '[ReactAgentEngine] Available tools:',
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            tools.map((t: any) => t.name).join(', '),
          );
          result = `Error: Tool "${toolCall.tool}" not found.`;
        }

        const resultStr = JSON.stringify(result);

        yield { type: 'tool_result', tool: toolCall.tool, result: result };

        // Update History
        currentHistory.push({ role: 'assistant', content: trimmedResponse });
        currentHistory.push({ role: 'tool', content: resultStr });
        console.log(
          '[ReactAgentEngine] History updated, continuing to next iteration...',
        );

        // Loop continues to process observation
      } else {
        // Final Answer
        console.log(
          '[ReactAgentEngine] ✓ No tool call - treating as final answer',
        );
        console.log(
          '[ReactAgentEngine] Final answer preview:',
          trimmedResponse.substring(0, 200),
        );
        if (isSpeculative) {
          console.log(
            '[ReactAgentEngine] ⚠️  WARNING: Reached final answer in speculative mode - this should not happen!',
          );
        }

        // Chunks were already streamed during buffering, so we're done
        console.log('[ReactAgentEngine] Exiting loop');
        break;
      }
    }
  }

  private parseToolCall(
    response: string,
  ): { tool: string; parameters: any } | null {
    // 1. Try Code Block
    const codeBlock = response.match(/```json\n([\s\S]*?)\n```/);
    if (codeBlock) {
      try {
        return JSON.parse(codeBlock[1]);
      } catch {
        // Ignore parse error
      }
    }

    // 2. Try raw JSON
    try {
      // Find first { and last }
      const start = response.indexOf('{');
      const end = response.lastIndexOf('}');
      if (start >= 0 && end > start) {
        const json = response.substring(start, end + 1);
        const parsed = JSON.parse(json);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (parsed.tool && parsed.parameters) {
          return parsed;
        }
      }
    } catch {
      // Ignore parse error
    }

    return null;
  }
}
