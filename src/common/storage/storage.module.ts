import { Module, Global } from '@nestjs/common';
import { StorageService } from './storage.service';

/**
 * StorageModule - Global module for GCS file operations.
 * StorageModule - GCS文件操作的全局模块。
 * 
 * This module is marked as Global so it can be used anywhere
 * without needing to import it in every module.
 * 
 * 此模块标记为Global，因此可以在任何地方使用，
 * 无需在每个模块中导入。
 */
@Global()
@Module({
    providers: [StorageService],
    exports: [StorageService],
})
export class StorageModule { }
