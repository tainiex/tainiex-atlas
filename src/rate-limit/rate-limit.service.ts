import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RateLimitEntry } from './rate-limit.entity';

interface LocalRateLimit {
  points: number;
  expiresAt: number; // Timestamp
  dirty: number; // Pending increments to flush
}

/**
 * Service to handle distributed rate limiting using PostgreSQL + Memory (Write-Behind).
 * Enhanced with IP Blocklist mechanism.
 */
@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private readonly logger = new Logger(RateLimitService.name);

  // In-Memory State
  private localOneStorage = new Map<string, LocalRateLimit>();

  // Blocklist State
  private readonly blockedIPs = new Set<string>();
  private readonly BLOCK_THRESHOLD = 200; // 200 requests per duration -> Block
  private readonly BLOCK_DURATION = 3600000; // 1 Hour

  // Timer for background flushing
  private flushInterval: NodeJS.Timeout;

  constructor(
    @InjectRepository(RateLimitEntry)
    private repo: Repository<RateLimitEntry>,
  ) {
    // Start Background Flush (e.g., every 3 seconds)
    this.flushInterval = setInterval(() => this.flushDirtyCounters(), 3000);
  }

  onModuleDestroy() {
    clearInterval(this.flushInterval);
    this.flushDirtyCounters(); // Force flush on shutdown
  }

  /**
   * Checks if a key is allowed.
   * Use Memory-First approach.
   */
  async isAllowed(
    key: string,
    limit: number,
    durationSeconds: number,
  ): Promise<boolean> {
    // 0. Check Blocklist
    if (this.blockedIPs.has(key)) {
      this.logger.debug(`Blocked IP attempted connection: ${key}`);
      return false;
    }

    const now = Date.now();
    let entry = this.localOneStorage.get(key);

    // 1. Lazy Initialization / Expiry Check
    if (!entry || entry.expiresAt <= now) {
      // Optimization: Start fresh.
      entry = {
        points: 0,
        expiresAt: now + durationSeconds * 1000,
        dirty: 0,
      };
      this.localOneStorage.set(key, entry);
    }

    // 2. Check Limit
    if (entry.points >= limit) {
      // 2.1 Check Block Threshold (Auto-Block)
      if (entry.points >= this.BLOCK_THRESHOLD && !this.blockedIPs.has(key)) {
        this.blockIP(key);
      }
      return false;
    }

    // 3. Increment (Memory Only)
    entry.points++;
    entry.dirty++;

    return true;
  }

  private blockIP(ip: string) {
    this.blockedIPs.add(ip);
    this.logger.warn(
      `IP ${ip} has been blocked for ${this.BLOCK_DURATION / 1000}s (Exceeded ${this.BLOCK_THRESHOLD} requests)`,
    );

    setTimeout(() => {
      this.blockedIPs.delete(ip);
      this.logger.log(`IP ${ip} unblocked`);
    }, this.BLOCK_DURATION);
  }

  /**
   * Background Task: Flush dirty counters to Database.
   * Uses UPSERT to merge local increments into global DB state.
   */
  private async flushDirtyCounters() {
    const batch = Array.from(this.localOneStorage.entries()).filter(
      ([_, val]) => val.dirty > 0,
    );

    if (batch.length === 0) return;

    // Reset dirty flags immediately (optimistic)
    // If flush fails, we might lose these counts, but that's acceptable for rate limiting
    for (const [_, val] of batch) {
      val.dirty = 0;
    }

    this.logger.debug(`Flushing ${batch.length} rate limit counters to DB...`);

    // Process in parallel with error handling
    await Promise.allSettled(
      batch.map(async ([key, val]) => {
        try {
          // SQL: Increment points in DB, update expiry if needed
          await this.repo.manager.query(
            `
                    INSERT INTO rate_limits (key, points, "expiresAt")
                    VALUES ($1, $2, $3)
                    ON CONFLICT (key) DO UPDATE
                    SET 
                        points = GREATEST(rate_limits.points, EXCLUDED.points),
                        "expiresAt" = GREATEST(rate_limits."expiresAt", EXCLUDED."expiresAt")
                `,
            [key, val.points, new Date(val.expiresAt)],
          );
        } catch (err) {
          this.logger.error(`Failed to flush rate limit for ${key}`, err);
          // Ideally, we could add back the dirty count, but for simplicity/performance in RL, we skip.
        }
      }),
    );
  }
}
