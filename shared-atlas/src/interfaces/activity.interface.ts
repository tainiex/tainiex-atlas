export enum ActivityStatus {
    STARTED = 'STARTED',
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
}

export interface ActivityEventPayload {
    sessionId: string;
    activityId: string;
    type: string; // e.g., 'TOOL_EXECUTION', 'MEMORY_RECALL'
    description: string; // e.g., 'Searching weather for Shanghai'
    status: ActivityStatus;
    timestamp: number;
    metadata?: any;
}
