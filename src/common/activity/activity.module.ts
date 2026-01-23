import { Module, Global } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ActivityGateway } from './activity.gateway';
import { ActivityPublisher } from './interfaces/activity-publisher.interface';
import { LocalActivityPublisher } from './publishers/local-activity.publisher';
import { ContextModule } from '../context/context.module';

@Global()
@Module({
  imports: [EventEmitterModule.forRoot(), ContextModule],
  providers: [
    ActivityGateway,
    {
      provide: ActivityPublisher,
      useClass: LocalActivityPublisher, // Strategy: Use Local by default
    },
  ],
  exports: [ActivityPublisher], // Export Publisher so other modules can inject it
})
export class ActivityModule {}
