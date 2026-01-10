import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemoryService } from './memory.service';
import { SemanticMemory } from './entities/memory.entity';
import { PgVectorStoreAdapter } from './adapters/pg-vector-store.adapter';
import { LlmModule } from '../../llm/llm.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([SemanticMemory]),
        LlmModule
    ],
    providers: [
        MemoryService,
        {
            provide: 'IVectorStore',
            useClass: PgVectorStoreAdapter
        }
    ],
    exports: [MemoryService]
})
export class MemoryModule { }
