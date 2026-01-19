import { SetMetadata } from '@nestjs/common';

// Metadata Key
export const RATE_LIMIT_KEY = 'rate_limit';

/**
 * Interface for Rate Limit Options
 */
export interface RateLimitOptions {
  points: number; // Max requests
  duration: number; // Window in seconds
}

/**
 * Decorator to apply rate limiting to a controller or method.
 * @param points Max requests allowed
 * @param duration Window duration in seconds
 */
export const RateLimit = (points: number, duration: number) =>
  SetMetadata(RATE_LIMIT_KEY, { points, duration } as RateLimitOptions);
