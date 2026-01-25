import { Module } from '@nestjs/common';
import { ToolsService } from './tools.service';
import { WeatherTool, SearchTool, WikipediaTool, StockTool } from './providers';
import { CacheModule } from '@nestjs/cache-manager';
import { ActivityModule } from '../common/activity/activity.module';

@Module({
  imports: [
    CacheModule.register({
      ttl: 60000, // Default 1 min global TTL, can be overridden per tool usage
    }),
    ActivityModule,
  ],
  providers: [
    ToolsService,
    // Register Tools as Providers
    WeatherTool,
    SearchTool,
    WikipediaTool,
    StockTool,
  ],
  exports: [ToolsService],
})
export class ToolsModule {}
