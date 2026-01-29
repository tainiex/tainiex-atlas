import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
    protected getTracker(req: Record<string, any>): Promise<string> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (req.user && req.user.id) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            return Promise.resolve(req.user.id);
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return Promise.resolve(req.ips.length ? req.ips[0] : req.ip); // Fallback to IP
    }
}
