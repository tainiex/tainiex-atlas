import { Module, Global } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { AgentFactory } from './services/agent-factory.service';
import { ToolRegistryService } from './services/tool-registry.service';
import { AgentToolsModule } from './agent-tools.module';
import { LlmModule } from '../llm/llm.module';

@Global()
@Module({
    imports: [
        DiscoveryModule,
        LlmModule,
        AgentToolsModule // Import the isolated tools module
    ],
    providers: [
        AgentFactory,
        ToolRegistryService
    ],
    exports: [
        AgentFactory,
        ToolRegistryService
    ]
})
export class AgentModule { }
