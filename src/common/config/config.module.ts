import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigurationService } from './configuration.service';

/**
 * Global Configuration Module
 * 全局配置模块 - 提供 ConfigurationService 供所有模块使用
 */
@Global()
@Module({
    imports: [ConfigModule],
    providers: [ConfigurationService],
    exports: [ConfigurationService],
})
export class AppConfigModule { }
