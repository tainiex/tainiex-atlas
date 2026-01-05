
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RateLimitEntry } from './rate-limit.entity';
import { RateLimitService } from './rate-limit.service';

@Module({
    imports: [TypeOrmModule.forFeature([RateLimitEntry])],
    providers: [RateLimitService],
    exports: [RateLimitService],
})
export class RateLimitModule { }
