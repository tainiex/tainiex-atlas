import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { IJobQueue } from './job-queue.interface';

@Injectable()
export class InMemoryJobQueue<T> implements IJobQueue<T>, OnModuleDestroy {
    private queue: T[] = [];
    private isProcessing = false;
    private handler: ((job: T) => Promise<void>) | null = null;
    private logger = new Logger(InMemoryJobQueue.name);
    private activeJobs = 0;

    async add(job: T): Promise<void> {
        this.queue.push(job);
        this.logger.debug(`Job added using InMemoryQueue. Queue length: ${this.queue.length}`);
        this.processNext();
    }

    process(handler: (job: T) => Promise<void>): void {
        this.handler = handler;
        this.processNext();
    }

    private async processNext() {
        if (this.isProcessing) return;

        if (this.queue.length === 0 || !this.handler) {
            return;
        }

        this.isProcessing = true;
        this.activeJobs++;
        const job = this.queue.shift();

        try {
            if (job) {
                // this.logger.debug(`Processing job... remaining in queue: ${this.queue.length}`);
                await this.handler(job);
            }
        } catch (error) {
            this.logger.error('Job processing failed', error);
        } finally {
            this.isProcessing = false;
            this.activeJobs--;
            // Recursively process next
            if (this.queue.length > 0) {
                this.processNext();
            }
        }
    }

    async onModuleDestroy() {
        this.logger.log(`Shutting down job queue... (${this.queue.length} pending, ${this.activeJobs} active)`);
        // Wait specifically for active jobs? 
        // For simple in-memory, we just log and let Node loop finish or kill.
        // If we want to block shutdown, we can perform a loop here, but NestJS shutdown limit is usually short.
    }
}
