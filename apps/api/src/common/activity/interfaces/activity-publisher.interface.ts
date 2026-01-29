import { ActivityEventPayload } from '@tainiex/shared-atlas';

export abstract class ActivityPublisher {
    /**
     * Publishes an activity event to the subscriber (e.g., WebSocket Gateway)
     */
    abstract publish(sessionId: string, payload: ActivityEventPayload): Promise<void>;
}
