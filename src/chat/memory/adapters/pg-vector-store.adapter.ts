import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IVectorStore, IVectorStoreRecord } from '../../../../shared-atlas/src/interfaces/vector-store.interface';
import { SemanticMemory, MemorySource, MemoryType } from '../entities/memory.entity';

@Injectable()
export class PgVectorStoreAdapter implements IVectorStore {
    constructor(
        @InjectRepository(SemanticMemory)
        private memoryRepository: Repository<SemanticMemory>
    ) { }

    async add(collection: string, records: IVectorStoreRecord[]): Promise<void> {
        // "collection" parameter maps to 'userId' scoping in our case
        // But our interface is generic. Let's assume the caller passes userId in metadata or we adapt.
        // Actually, for this specific adapter, strictly tailored to our SemanticMemory entity:
        // We expect records to contain the necessary metadata fields.

        const entities = records.map(record => {
            return this.memoryRepository.create({
                userId: record.metadata.userId,
                sourceType: record.metadata.sourceType,
                sourceId: record.metadata.sourceId,
                content: record.content,
                embedding: record.embedding,
                type: record.metadata.type,
                entities: record.metadata.entities,
                tags: record.metadata.tags,
                importance: record.metadata.importance
            });
        });

        await this.memoryRepository.save(entities);
    }

    async search(collection: string, vector: number[], limit: number, filter?: any): Promise<IVectorStoreRecord[]> {
        // collection is usually the userId in our context
        const userId = collection;

        // Build query using TypeORM
        const queryBuilder = this.memoryRepository.createQueryBuilder('memory');

        // Basic filtering
        queryBuilder.where('memory.user_id = :userId', { userId });

        if (filter) {
            if (filter.type) {
                queryBuilder.andWhere('memory.type = :type', { type: filter.type });
            }
            if (filter.sourceType) {
                queryBuilder.andWhere('memory.source_type = :sourceType', { sourceType: filter.sourceType });
            }
        }

        // Vector Search using <-> (Euclidean) or <=> (Cosine). 
        // We used vector_cosine_ops, so <=> is correct for distance.
        // ORDER BY embedding <=> '[...]' LIMIT N
        // distance is 1 - cosine_similarity (for normalized vectors)

        // Note: pgvector parameters need string formatting
        const vectorStr = `[${vector.join(',')}]`;

        queryBuilder
            .orderBy(`memory.embedding <=> '${vectorStr}'`)
            .limit(limit);

        const results = await queryBuilder.getMany();

        return results.map(memory => ({
            id: memory.id,
            content: memory.content,
            embedding: memory.embedding,
            metadata: {
                userId: memory.userId,
                type: memory.type,
                sourceType: memory.sourceType,
                sourceId: memory.sourceId,
                entities: memory.entities,
                tags: memory.tags,
                importance: memory.importance,
                createdAt: memory.createdAt,
                lastAccessedAt: memory.lastAccessedAt
            }
        }));
    }

    async delete(collection: string, ids: string[]): Promise<void> {
        await this.memoryRepository.delete(ids);
    }

    async update(collection: string, records: IVectorStoreRecord[]): Promise<void> {
        // Batch update is complex with varying fields. Simple loop for now.
        for (const record of records) {
            // Assuming we update content or importance primarily
            await this.memoryRepository.update(record.id, {
                content: record.content,
                embedding: record.embedding, // Re-embed if content changed
                entities: record.metadata.entities,
                importance: record.metadata.importance,
                lastAccessedAt: new Date() // Updates access time
            });
        }
    }
}
