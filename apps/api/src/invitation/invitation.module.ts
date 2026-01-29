import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvitationCode } from './invitation-code.entity';
import { InvitationService } from './invitation.service';

@Module({
    imports: [TypeOrmModule.forFeature([InvitationCode])],
    providers: [InvitationService],
    exports: [InvitationService],
})
export class InvitationModule {}
