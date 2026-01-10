import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RateLimitEntry } from './rate-limit.entity';

interface LocalRateLimit {
    points: number;
    expiresAt: number; // Timestamp
    dirty: number;     // Pending increments to flush
}

/**
 * Service to handle distributed rate limiting using PostgreSQL + Memory (Write-Behind).
 * 
 * Strategy: **Write-Behind Caching (异步回写)**
 * - **Read**: Check In-Memory Map (Fast).
 * - **Write**: Update In-Memory Map immediately.
 * - **Persist**: Async Flush dirty counters to DB every few seconds.
 * 
 * Assumption: **Session Stickiness (会话粘滞)**
 * We assume the Load Balancer routes the same user/IP to the same instance.
 * Even if it fails, eventually the DB update ensures other instances see the usage (Eventual Consistency).
 */
@Injectable()
export class RateLimitService implements OnModuleDestroy {
    private readonly logger = new Logger(RateLimitService.name);

    // In-Memory State
    private localOneStorage = new Map<string, LocalRateLimit>();

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
    async isAllowed(key: string, limit: number, durationSeconds: number): Promise<boolean> {
        const now = Date.now();
        let entry = this.localOneStorage.get(key);

        // 1. Lazy Initialization / Expiry Check
        if (!entry || entry.expiresAt <= now) {
            // Optimization: Start fresh.
            entry = {
                points: 0,
                expiresAt: now + durationSeconds * 1000,
                dirty: 0
            };
            this.localOneStorage.set(key, entry);
        }

        // 2. Check Limit
        if (entry.points >= limit) {
            return false;
        }

        // 3. Increment (Memory Only)
        entry.points++;
        entry.dirty++;

        return true;
    }

    /**
     * Background Task: Flush dirty counters to Database.
     * Uses UPSERT to merge local increments into global DB state.
     */
    private async flushDirtyCounters() {
        const batch = Array.from(this.localOneStorage.entries()).filter(([_, val]) => val.dirty > 0);

        if (batch.length === 0) return;

        // Reset dirty flags immediately
        for (const [_, val] of batch) {
            val.dirty = 0;
        }

        this.logger.debug(`Flushing ${batch.length} rate limit counters to DB...`);

        // Process in parallel
        await Promise.all(batch.map(async ([key, val]) => {
            try {
                // SQL: Increment points in DB, update expiry if needed
                await this.repo.manager.query(`
                    INSERT INTO rate_limits (key, points, "expiresAt")
                    VALUES ($1, $2, $3)
                    ON CONFLICT (key) DO UPDATE
                    SET 
                        points = GREATEST(rate_limits.points, EXCLUDED.points),
                        "expiresAt" = GREATEST(rate_limits."expiresAt", EXCLUDED."expiresAt")
                `, [key, val.points, new Date(val.expiresAt)]);

            } catch (err) {
                this.logger.error(`Failed to flush rate limit for ${key}`, err);
            }
        }));
    }
}
