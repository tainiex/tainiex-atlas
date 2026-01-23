import { Inject } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { ActivityPublisher } from './interfaces/activity-publisher.interface';
import { ActivityStatus } from '@tainiex/shared-atlas';
import { v4 as uuidv4 } from 'uuid';

/**
 * Decorator to track activity start/end and publish events.
 * Uses CLS to implicitly get sessionId.
 */
export function TrackActivity(metadata: { type: string; description: string }) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // 1. Resolve Dependencies (Service Locator pattern for Decorators)
      // Note: The target instance MUST have activityPublisher and clsService injected.
      // We assume the class using this decorator extends a Base class or has these properties.
      // Alternatively, we can use ModuleRef, but that's complex in decorators.
      // A common pattern in NestJS is to assume property injection or specific names.

      const publisher: ActivityPublisher = this.activityPublisher;
      const cls: ClsService = this.cls;

      if (!publisher || !cls) {
        // If not available, just run original method (Safety fallback)
        return originalMethod.apply(this, args);
      }

      // 2. Get Context
      const sessionId = cls.get('sessionId');
      // If no session context, we might skip tracking or log warning
      if (!sessionId) {
        return originalMethod.apply(this, args);
      }

      const activityId = uuidv4();
      const timestamp = Date.now();

      // 3. Emit START
      try {
        await publisher.publish(sessionId, {
          sessionId,
          activityId,
          type: metadata.type,
          description: metadata.description,
          status: ActivityStatus.STARTED,
          timestamp,
        });
      } catch (e) {
        /* ignore publishing errors */
      }

      try {
        // 4. Execute Method
        const result = await originalMethod.apply(this, args);

        // 5. Emit COMPLETED
        await publisher
          .publish(sessionId, {
            sessionId,
            activityId,
            type: metadata.type,
            description: metadata.description,
            status: ActivityStatus.COMPLETED,
            timestamp: Date.now(),
          })
          .catch(() => {});

        return result;
      } catch (error) {
        // 6. Emit FAILED
        await publisher
          .publish(sessionId, {
            sessionId,
            activityId,
            type: metadata.type,
            description: metadata.description,
            status: ActivityStatus.FAILED,
            timestamp: Date.now(),
            metadata: {
              error: error instanceof Error ? error.message : String(error),
            },
          })
          .catch(() => {});
        throw error;
      }
    };

    return descriptor;
  };
}
