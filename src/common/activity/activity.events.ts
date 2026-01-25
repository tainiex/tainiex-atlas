import { ActivityEventPayload } from '@tainiex/shared-atlas';

export class ActivityEvent {
  constructor(
    public readonly userId: string,
    public readonly sessionId: string,
    public readonly payload: ActivityEventPayload,
  ) {}
}
