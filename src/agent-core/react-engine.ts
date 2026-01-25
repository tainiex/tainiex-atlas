import { IAgentEngine, AgentRunConfig, AgentEvent, AgentMessage } from './interfaces/agent.interface';
import { Tool } from './interfaces/tool.interface';
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
    constructor(private llm: ILlmProvider) { }

    async *execute(config: AgentRunConfig): AsyncGenerator<AgentEvent> {
        const {
            input,
            history = [],
            systemPrompt,
            tools = [],
            maxLoops = 5,
            enableSpeculative = true,
            context = {}
        } = config;

        // System Prompt - NO longer includes tool definitions (using native tools parameter instead)
        console.log('[ReactAgentEngine] Tools count:', tools.length);
        console.log('[ReactAgentEngine] Will pass tools natively to LLM');

        // Build basic system prompt (no tool descriptions)
        const basicSystemPrompt = systemPrompt || '';

        console.log('[ReactAgentEngine] System Prompt (without tools):', basicSystemPrompt.substring(0, 300) + '...');

        const currentHistory: AgentMessage[] = [
            { role: 'system', content: basicSystemPrompt },
            ...history,
            { role: 'user', content: input }
        ];

        console.log('[ReactAgentEngine] History length (including system):', currentHistory.length);

        let loopCount = 0;
        let speculativeRetries = 0;
        const MAX_SPECULATIVE_RETRIES = 2; // Limit speculative retries

        while (loopCount < maxLoops) {
            loopCount++;
            console.log(`[ReactAgentEngine] ===== Loop ${loopCount}/${maxLoops} =====`);

            // --- Speculative Execution Logic ---
            const preferredModel = config.model || 'gemini-1.5-pro';
            const speculativeModel = config.speculativeModel || 'gemini-2.5-flash';
            let effectiveModel = preferredModel;
            let isSpeculative = false;

            // Fast intent detection: Always use speculativeModel for first loop if enabled
            if (enableSpeculative && loopCount === 1 && speculativeRetries < MAX_SPECULATIVE_RETRIES) {
                effectiveModel = speculativeModel;
                isSpeculative = true;
                console.log(`[ReactAgentEngine] Using speculative execution with ${effectiveModel} (retry ${speculativeRetries}/${MAX_SPECULATIVE_RETRIES})`);
            } else {
                console.log(`[ReactAgentEngine] Using model: ${effectiveModel}, speculative: ${isSpeculative}`);
            }

            // Start Stream
            let accumulatedResponse = '';

            // Convert tools to format expected by LLM (will be transformed to Vertex AI format by adapter)
            const toolsForLLM = tools.map(t => ({
                name: t.name,
                description: t.description,
                parameters: t.parameters
            }));

            console.log('[ReactAgentEngine] Calling LLM with', toolsForLLM.length, 'tools');
            const llmStream = this.llm.streamChat(currentHistory, effectiveModel, toolsForLLM);

            // CRITICAL: Always buffer the response first to detect tool calls!
            // We cannot stream directly to user if there might be a tool call,
            // because we need to parse the full response before deciding.
            console.log('[ReactAgentEngine] Buffering LLM response for tool detection...');
            for await (const chunk of llmStream) {
                accumulatedResponse += chunk;
            }
            console.log('[ReactAgentEngine] Buffer complete, length:', accumulatedResponse.length);

            const trimmedResponse = accumulatedResponse.trim();
            console.log('[ReactAgentEngine] LLM Response:', trimmedResponse.substring(0, 300) + '...');
            console.log('[ReactAgentEngine] Parsing for tool calls...');
            const toolCall = this.parseToolCall(trimmedResponse);
            console.log('[ReactAgentEngine] parseToolCall result:', toolCall ? `Tool: ${toolCall.tool}` : 'null (no tool)');

            // Speculative Fallback: If Flash thought it was just chat (no tool), but maybe Pro would use a tool?
            // Or if Flash failed to produce valid JSON?
            // Current logic: If Flash didn't call a tool, assume it's a chat response.
            // BUT, if user INTENDED a complex task that Flash missed, we might want to fallback?
            // For now, let's trust Flash for "Intent Detection".
            // (Optional: If Flash response is very short or ambiguous, we could retry)

            // Refined Speculative Logic from original ChatService:
            // if (isSpeculative && !toolCall) -> Retry with Pro.
            if (isSpeculative && !toolCall) {
                speculativeRetries++;

                if (speculativeRetries >= MAX_SPECULATIVE_RETRIES) {
                    console.log(`[ReactAgentEngine] Max speculative retries (${MAX_SPECULATIVE_RETRIES}) reached. Treating response as final answer.`);
                    // Treat as final answer
                    yield { type: 'answer_chunk', content: trimmedResponse };
                    break;
                }

                console.log(`[ReactAgentEngine] ⚠️  Speculative miss - Flash didn't detect tool call, retrying (${speculativeRetries}/${MAX_SPECULATIVE_RETRIES})...`);
                // Discard Flash response
                isSpeculative = false;
                loopCount--; // Retry this loop iteration
                continue;
            }

            // If we are here, either:
            // 1. Speculative success (Tool call found)
            // 2. Normal execution (Tool call or Answer)

            if (toolCall) {
                console.log(`[ReactAgentEngine] ✓ Tool call detected: ${toolCall.tool}`);
                console.log('[ReactAgentEngine] Tool parameters:', JSON.stringify(toolCall.parameters));
                yield { type: 'thought', content: trimmedResponse };
                yield { type: 'tool_call', tool: toolCall.tool, args: toolCall.parameters };

                // Execute Tool
                const toolInstance = tools.find(t => t.name === toolCall.tool);
                let result: any;

                if (toolInstance) {
                    console.log(`[ReactAgentEngine] ✓ Tool "${toolCall.tool}" found in registry, executing...`);
                    try {
                        result = await toolInstance.execute(toolCall.parameters, context);
                        console.log('[ReactAgentEngine] ✓ Tool execution successful');
                        console.log('[ReactAgentEngine] Tool result:', JSON.stringify(result).substring(0, 200));
                    } catch (e) {
                        console.log('[ReactAgentEngine] ✗ Tool execution error:', e.message);
                        result = `Error executing tool: ${e.message}`;
                    }
                } else {
                    console.log(`[ReactAgentEngine] ✗ ERROR: Tool "${toolCall.tool}" not found in registry!`);
                    console.log('[ReactAgentEngine] Available tools:', tools.map(t => t.name).join(', '));
                    result = `Error: Tool "${toolCall.tool}" not found.`;
                }

                const resultStr = JSON.stringify(result);
                yield { type: 'tool_result', tool: toolCall.tool, result: result };

                // Update History
                currentHistory.push({ role: 'assistant', content: trimmedResponse });
                currentHistory.push({ role: 'tool', content: resultStr });
                console.log('[ReactAgentEngine] History updated, continuing to next iteration...');

                // Loop continues to process observation
            } else {
                // Final Answer
                console.log('[ReactAgentEngine] ✓ No tool call - treating as final answer');
                console.log('[ReactAgentEngine] Final answer preview:', trimmedResponse.substring(0, 200));
                if (isSpeculative) {
                    console.log('[ReactAgentEngine] ⚠️  WARNING: Reached final answer in speculative mode - this should not happen!');
                }

                // Yield the answer as chunks for streaming UX
                yield { type: 'answer_chunk', content: trimmedResponse };

                console.log('[ReactAgentEngine] Exiting loop');
                break;
            }
        }
    }

    private parseToolCall(response: string): { tool: string; parameters: any } | null {
        // 1. Try Code Block
        const codeBlock = response.match(/```json\n([\s\S]*?)\n```/);
        if (codeBlock) {
            try {
                return JSON.parse(codeBlock[1]);
            } catch { }
        }

        // 2. Try raw JSON
        try {
            // Find first { and last }
            const start = response.indexOf('{');
            const end = response.lastIndexOf('}');
            if (start >= 0 && end > start) {
                const json = response.substring(start, end + 1);
                const parsed = JSON.parse(json);
                if (parsed.tool && parsed.parameters) {
                    return parsed;
                }
            }
        } catch { }

        return null;
    }
}
