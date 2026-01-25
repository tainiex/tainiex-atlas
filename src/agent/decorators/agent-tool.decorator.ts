import { SetMetadata, Injectable } from '@nestjs/common';

export const AGENT_TOOL_METADATA = 'AGENT_TOOL_METADATA';

export interface AgentToolOptions {
  name: string;
  description: string;
  scope?: string;
}

/**
 * Decorator to mark a class as an Agent Tool.
 * 标记类为 Agent 工具的装饰器。
 * This will automatically register it in the ToolRegistryService.
 */
export function AgentTool(options: AgentToolOptions): ClassDecorator {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  return (target: Function) => {
    SetMetadata(AGENT_TOOL_METADATA, options)(target);
    Injectable()(target); // Automatically ensure it's injectable
  };
}
