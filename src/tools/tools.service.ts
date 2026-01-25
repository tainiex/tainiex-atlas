import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ToolDefinition } from './interfaces/tool.interface';
import { IToolProvider } from '../agent/interfaces/tool-provider.interface';
import { WeatherTool, SearchTool, WikipediaTool, StockTool } from './providers';
import { ActivityPublisher } from '../common/activity/interfaces/activity-publisher.interface';
import { ClsService } from 'nestjs-cls';
import { TrackActivity } from '../common/activity/track-activity.decorator';

@Injectable()
export class ToolsService implements OnModuleInit {
    private readonly logger = new Logger(ToolsService.name);
    private toolsMap = new Map<string, IToolProvider>();

    constructor(
        private readonly weatherTool: WeatherTool,
        private readonly searchTool: SearchTool,
        private readonly wikipediaTool: WikipediaTool,
        private readonly stockTool: StockTool,
        // Injected for @TrackActivity decorator usage
        public readonly activityPublisher: ActivityPublisher,
        public readonly cls: ClsService,
    ) { }

    onModuleInit() {
        this.registerTool(this.weatherTool);
        this.registerTool(this.searchTool);
        this.registerTool(this.wikipediaTool);
        this.registerTool(this.stockTool);
    }

    private registerTool(tool: IToolProvider) {
        if (this.toolsMap.has(tool.name)) {
            this.logger.warn(`Duplicate tool registered: ${tool.name}. Overwriting.`);
        }
        this.toolsMap.set(tool.name, tool);
        this.logger.log(`Registered tool: ${tool.name}`);
    }

    getToolsDefinitions(): ToolDefinition[] {
        return Array.from(this.toolsMap.values()).map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
        }));
    }

    @TrackActivity({
        type: 'TOOL_EXECUTION',
        description: 'Executing AI Tool',
    })
    async executeTool(name: string, args: any): Promise<any> {
        const tool = this.toolsMap.get(name);
        if (!tool) {
            throw new Error(`Tool not found: ${name}`);
        }
        return tool.execute(args);
    }
}
