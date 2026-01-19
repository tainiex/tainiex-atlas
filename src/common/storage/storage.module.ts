import { Module, Global } from '@nestjs/common';
import { StorageService } from './storage.service';
import { GcsStorageStrategy } from './gcs.strategy';
import { StorageController } from './storage.controller';

/**
 * StorageModule - Global module for file operations.
 * StorageModule - 文件操作的全局模块。
 *
 * This module is marked as Global so it can be used anywhere
 * without needing to import it in every module.
 *
 * 此模块标记为Global，因此可以在任何地方使用，
 * 无需在每个模块中导入。
 */
@Global()
@Module({
  controllers: [StorageController],
  providers: [
    StorageService,
    {
      provide: 'STORAGE_STRATEGY',
      useClass: GcsStorageStrategy,
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
