export interface WorkerTask<T = any> {
    taskName: string;
    data: T;
}

export interface DistillationConfig {
    VERTEX_PROJECT_ID: string;
    VERTEX_LOCATION: string;
    GSA_KEY_FILE?: string;
    MEMORY_DISTILLATION_MODEL?: string;
    DB_HOST?: string;
    DB_PORT?: string;
    DB_USERNAME?: string;
    DB_PASSWORD?: string;
    DB_NAME?: string;
    DB_SSL?: string;
}

export interface DistillationPayload {
    config: DistillationConfig;
    prompt: string;
    modelName?: string;
}

export interface DistillationResult {
    result?: any[];
    error?: string;
}
