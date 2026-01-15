import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import {
    Note,
    Block,
    BlockVersion,
    NoteSnapshot,
    NoteTemplate,
    DocumentState,
} from './entities';

import { NotesService } from './notes.service';
import { BlocksService } from './blocks.service';
import { PresenceService } from './presence.service';
import { YjsService } from './yjs.service';
import { VersionsService } from './versions.service';
import { SearchService } from './search.service';
import { ExportService } from './export.service';
import { YjsTransformerService } from './yjs-transformer.service';

// Gateways
import { CollaborationGateway } from './collaboration.gateway';

// Controllers
import { NotesController } from './notes.controller';
import { BlocksController } from './blocks.controller';
import { UploadController } from './upload.controller';
import { VersionsController } from './versions.controller';
import { SearchController } from './search.controller';
import { ExportController } from './export.controller';

/**
 * NotesModule - Core module for notes system.
 * NotesModule - Notes系统核心模块。
 * 
 * Provides note and block management functionality with:
 * - CRUD operations for notes and blocks
 * - Block-level version control
 * - Full-text search support
 * - Multi-user access control
 * 
 * 提供笔记和块管理功能：
 * - 笔记和块的CRUD操作
 * - 块级版本控制
 * - 全文搜索支持
 * - 多用户访问控制
 * 
 * TODO: Add ScheduleModule.forRoot() for scheduled snapshot tasks when @nestjs/schedule is installed
 */
@Module({
    imports: [
        TypeOrmModule.forFeature([
            Note,
            Block,
            BlockVersion,
            NoteSnapshot,
            NoteTemplate,
            DocumentState,
        ]),
    ],
    controllers: [
        NotesController,
        BlocksController,
        UploadController,
        VersionsController,
        SearchController,
        ExportController,
    ],
    providers: [
        NotesService,
        BlocksService,
        PresenceService,
        YjsService,
        VersionsService,
        SearchService,
        SearchService,
        ExportService,
        YjsTransformerService,
        CollaborationGateway,
    ],
    exports: [
        NotesService,
        BlocksService,
        PresenceService,
        YjsService,
        VersionsService,
        SearchService,
        ExportService,
        YjsTransformerService,
    ],
})
export class NotesModule { }
