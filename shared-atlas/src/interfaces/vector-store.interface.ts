export interface IVectorStoreRecord {
    id: string;
    content: string;
    embedding: number[];
    metadata: Record<string, any>;
}

export interface IVectorStore {
    add(collection: string, records: IVectorStoreRecord[]): Promise<void>;
    search(collection: string, vector: number[], limit: number, filter?: any): Promise<IVectorStoreRecord[]>;
    delete(collection: string, ids: string[]): Promise<void>;
    update(collection: string, records: IVectorStoreRecord[]): Promise<void>;
}
