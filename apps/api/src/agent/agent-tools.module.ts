import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CacheModule } from '@nestjs/cache-manager';
import { WeatherTool } from '../tools/providers/weather.tool';
import { SearchTool } from '../tools/providers/search.tool';
import { WikipediaTool } from '../tools/providers/wikipedia.tool';
import { StockTool } from '../tools/providers/stock.tool';

/**
 * Agent Tools Module
 *
 * STRICT RULE: This module MUST NOT import any business logic modules
 * (like ChatModule, UsersModule, AuthModule) to prevent circular dependencies.
 *
 * Tools defined here should only depend on:
 * 1. External Services (HttpModule)
 * 2. Database Repositories (TypeOrmModule)
 * 3. Configuration (ConfigModule)
 * 4. Stateless Utilities
 */
@Module({
    imports: [HttpModule, CacheModule.register()],
    providers: [WeatherTool, SearchTool, WikipediaTool, StockTool],
    exports: [WeatherTool, SearchTool, WikipediaTool, StockTool],
})
export class AgentToolsModule {}
