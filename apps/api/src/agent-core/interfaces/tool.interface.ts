/**
 * Core Tool Interface
 * 核心工具接口
 * Framework agnostic - does not depend on NestJS
 */
export interface Tool {
    /** Unqiue name of the tool */
    name: string;

    /** Human readable description for LLM */
    description: string;

    /** JSON Schema for parameters */
    parameters: Record<string, any>;

    /** Execute the tool */
    execute(args: any, context?: any): Promise<any>;

    /**
     * Check if the tool is available (e.g. has valid API keys).
     * If false, the tool will NOT be registered.
     */
    isAvailable?(): boolean;
}
