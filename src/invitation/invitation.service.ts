import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvitationCode } from './invitation-code.entity';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../users/user.entity';

@Injectable()
export class InvitationService implements OnModuleInit {
  constructor(
    @InjectRepository(InvitationCode)
    private invitationRepository: Repository<InvitationCode>,
  ) {}

  async onModuleInit() {
    await this.ensureInvitationCodes();
  }

  private async ensureInvitationCodes() {
    const count = await this.invitationRepository.count({
      where: { isUsed: false },
    });
    if (count < 100) {
      const needed = 100 - count;
      console.log(
        `[InvitationService] Generating ${needed} new invitation codes...`,
      );
      const codes: InvitationCode[] = [];

      for (let i = 0; i < needed; i++) {
        const code = this.generateCode();
        const invitation = this.invitationRepository.create({
          code,
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        });
        codes.push(invitation);
      }

      await this.invitationRepository.save(codes);
      console.log(`[InvitationService] Generated ${codes.length} codes.`);
    }
  }

  private generateCode(): string {
    // Simple random 8-char code
    return uuidv4().split('-')[0].toUpperCase();
  }

  async validateCode(code: string): Promise<boolean> {
    const invitation = await this.invitationRepository.findOne({
      where: { code },
    });
    if (!invitation) {
      console.log(`[InvitationService] Code not found: ${code}`);
      return false;
    }
    if (invitation.isUsed) {
      console.log(`[InvitationService] Code already used: ${code}`);
      return false;
    }
    if (new Date() > invitation.expiresAt) {
      console.log(
        `[InvitationService] Code expired: ${code}, expiresAt: ${invitation.expiresAt.toISOString()}`,
      );
      return false;
    }
    return true;
  }

  /**
   * Atomically consumes an invitation code.
   * Returns true if successful, false if code is invalid, expired, or already used.
   * This prevents race conditions where multiple users could use the same code simultaneously.
   */
  async consumeCode(code: string, user: User): Promise<boolean> {
    const result = await this.invitationRepository
      .createQueryBuilder()
      .update(InvitationCode)
      .set({
        isUsed: true,
        usedByUserId: user.id,
      })
      .where('code = :code', { code })
      .andWhere('isUsed = :isUsed', { isUsed: false })
      .andWhere('expiresAt > :now', { now: new Date() })
      .execute();

    return result.affected !== undefined && result.affected > 0;
  }

  // Deprecated: Use consumeCode instead for atomic safety
  async markAsUsed(code: string, user: User): Promise<void> {
    await this.consumeCode(code, user);
  }
}
