import { Module } from '@nestjs/common';
import { InMemoryJobQueue } from './in-memory-job.queue';

@Module({
    providers: [
        {
            provide: 'IJobQueue',
            useClass: InMemoryJobQueue,
        },
    ],
    exports: ['IJobQueue'],
})
export class JobQueueModule {}
