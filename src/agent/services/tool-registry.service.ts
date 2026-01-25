
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import {
    IToolProvider,
} from '../interfaces/tool-provider.interface';
import {
    AGENT_TOOL_METADATA,
    AgentToolOptions,
} from '../decorators/agent-tool.decorator';
import { Tool } from '../../agent-core/interfaces/tool.interface';

@Injectable()
export class ToolRegistryService implements OnModuleInit {
    private readonly logger = new Logger(ToolRegistryService.name);
    private toolsMap = new Map<string, { provider: IToolProvider; options: AgentToolOptions }>();

    constructor(
        private readonly discoveryService: DiscoveryService,
        private readonly scanner: MetadataScanner,
        private readonly reflector: Reflector,
    ) { }

    onModuleInit() {
        this.scanAndRegisterTools();
    }

    private scanAndRegisterTools() {
        this.logger.log('Scanning for Agent Tools...');

        const providers = this.discoveryService.getProviders();

        providers.forEach((wrapper) => {
            const { instance } = wrapper;
            if (!instance || typeof instance !== 'object') {
                return;
            }

            // Check if the class has the AgentTool decorator metadata
            const toolMetadata = this.reflector.get<AgentToolOptions>(
                AGENT_TOOL_METADATA,
                instance.constructor,
            );

            if (toolMetadata) {
                // Verify it implements IToolProvider structure (runtime check)
                if (
                    typeof (instance as any).execute === 'function' &&
                    (instance as any).name &&
                    (instance as any).description &&
                    (instance as any).parameters
                ) {
                    this.registerTool(instance as IToolProvider, toolMetadata);
                } else {
                    this.logger.warn(
                        `Class ${instance.constructor.name} has @AgentTool but does not implement IToolProvider correctly.`,
                    );
                }
            }
        });
    }

    registerTool(tool: IToolProvider, options: AgentToolOptions) {
        if (this.toolsMap.has(tool.name)) {
            this.logger.warn(`Duplicate tool registered: ${tool.name}. Overwriting.`);
        }
        this.toolsMap.set(tool.name, { provider: tool, options });
        this.logger.log(`Registered tool: ${tool.name} (Scope: ${options.scope || 'global'})`);
    }

    getTool(name: string): IToolProvider | undefined {
        return this.toolsMap.get(name)?.provider;
    }

    /**
     * Get tool definitions for LLM (JSON Schema)
     * 获取用于 LLM 的工具定义
     * @param scopes List of scopes to include (e.g., ['global', 'chat'])
     */
    getToolsDefinitions(scopes: string[] = ['global']): any[] {
        const definitions: any[] = [];

        this.toolsMap.forEach(({ provider, options }) => {
            const toolScope = options.scope || 'global';
            if (scopes.includes(toolScope)) {
                definitions.push({
                    name: provider.name,
                    description: provider.description,
                    parameters: provider.parameters,
                });
            }
        });

        return definitions;
    }

    /**
     * Get actual tool provider instances (for Agent execution)
     */
    getToolProviders(scopes: string[] = ['global']): IToolProvider[] {
        const providers: IToolProvider[] = [];

        this.toolsMap.forEach(({ provider, options }) => {
            const toolScope = options.scope || 'global';
            if (scopes.includes(toolScope)) {
                providers.push(provider);
            }
        });

        return providers;
    }
}
