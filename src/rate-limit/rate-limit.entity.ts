
import { Entity, Column, PrimaryColumn } from 'typeorm';

/**
 * Represents a rate limiting record in the database.
 * 用于存储速率限制状态的实体。
 * 
 * Logic: Fixed Window Counter (固定窗口计数器)
 * - The window starts when the first request comes in.
 * - `expiresAt` marks the end of that window.
 * - `points` counts requests within that window.
 */
@Entity('rate_limits')
export class RateLimitEntry {
    /** 
     * The unique identifier for the subject being limited.
     * 通常是 IP 地址 (e.g. "::1") 或 用户 ID (UUID)。
     */
    @PrimaryColumn()
    key: string;

    /**
     * Current usage count in the active window (Accumulator).
     * 当前窗口内的已消耗点数（计数器）。
     * 
     * - Default: 0 (DB schema default).
     * - Start: 1 (Upon first request insertion).
     * - Increment: +1 per request (handled by Service).
     * - Unit: 1 point = 1 request / connection attempt.
     */
    @Column({ type: 'int', default: 0 })
    points: number;

    /**
     * When the current rate limit window expires.
     * After this timestamp, the `points` will be reset to 1 (for the new request).
     * 当前窗口的过期时间。过期后计数重置。
     */
    @Column({ type: 'timestamp' })
    expiresAt: Date;
}
