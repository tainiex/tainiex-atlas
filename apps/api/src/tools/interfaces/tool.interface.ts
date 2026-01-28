/**
 * Tool system interfaces with intentional use of `any` for parameter flexibility
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { Logger } from '@nestjs/common';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export abstract class Tool<T = any> {
  abstract name: string;
  abstract description: string;
  abstract schema: z.ZodType<T>;

  protected readonly logger = new Logger(this.constructor.name);

  // Production settings with defaults
  timeoutMs: number = 10000; // 10s default
  cacheTtlSeconds?: number;

  protected abstract executeImpl(args: T): Promise<any>;

  /**
   * Template method ensuring validation, logging, and error handling.
   * This is the "Industrial-Grade" wrapper.
   */
  async execute(args: unknown): Promise<any> {
    const start = Date.now();
    try {
      this.logger.log(`[ToolStart] ${this.name}`);

      // 1. Validation (Zod)
      // "strict" ensures no extra arguments are passed which might confuse some implementations
      const parseResult = this.schema.safeParse(args);

      if (!parseResult.success) {
        throw new Error(
          `Invalid arguments for tool ${this.name}: ${parseResult.error.message}`,
        );
      }

      const validArgs = parseResult.data;

      // 2. Timeout Handling
      const result = await this.runWithTimeout(this.executeImpl(validArgs));

      const duration = Date.now() - start;
      this.logger.log(`[ToolEnd] ${this.name} Duration=${duration}ms`);

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.logger.error(
        `[ToolError] ${this.name} Duration=${duration}ms Error=${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(
        `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private runWithTimeout(promise: Promise<any>): Promise<any> {
    let timeoutHandle: NodeJS.Timeout;

    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(
          new Error(`Tool ${this.name} timed out after ${this.timeoutMs}ms`),
        );
      }, this.timeoutMs);
    });

    return Promise.race([
      promise.then((res) => {
        clearTimeout(timeoutHandle);
        return res;
      }),
      timeoutPromise,
    ]);
  }

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: zodToJsonSchema(this.schema as any, { name: this.name }) as Record<
        string,
        any
      >,
    };
  }
}
