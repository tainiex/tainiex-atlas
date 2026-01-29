import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ActivityPublisher } from '../interfaces/activity-publisher.interface';
import { ActivityEventPayload } from '@tainiex/shared-atlas';
import { ActivityEvent } from '../activity.events';

@Injectable()
export class LocalActivityPublisher extends ActivityPublisher {
    private readonly logger = new Logger(LocalActivityPublisher.name);

    constructor(private eventEmitter: EventEmitter2) {
        super();
    }

    publish(sessionId: string, payload: ActivityEventPayload): Promise<void> {
        // In local implementation, we just emit an internal event that the Gateway listens to.
        // We map strictly to ActivityEvent which is the internal carrier.
        const event = new ActivityEvent('unknown', sessionId, payload); // UserID might be needed here or in payload
        this.eventEmitter.emit('activity.status', event);
        this.logger.debug(`Published local activity: ${payload.type} for session ${sessionId}`);
        return Promise.resolve();
    }
}
