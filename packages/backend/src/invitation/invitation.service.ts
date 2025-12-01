import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class InvitationService {
  private readonly logger = new Logger(InvitationService.name);
  private readonly CODE_TTL = 30 * 24 * 60 * 60; // 30 days in seconds
  private readonly USED_CODE_TTL = 90 * 24 * 60 * 60; // 90 days in seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService
  ) {}

  /**
   * Generate invitation codes and store in Redis
   */
  async generateCodes(count: number, createdBy: string) {
    const codes: string[] = [];
    const timestamp = new Date().toISOString();

    for (let i = 0; i < count; i++) {
      let code: string;
      let attempts = 0;
      const maxAttempts = 10;

      // Generate unique code with collision handling
      do {
        code = Math.random().toString(36).substring(2, 8).toUpperCase();
        attempts++;

        if (attempts >= maxAttempts) {
          this.logger.error(
            `Failed to generate unique code after ${maxAttempts} attempts`
          );
          throw new BadRequestException(
            'Failed to generate unique invitation code'
          );
        }
      } while (await this.redis.exists(`invitation:code:${code}`));

      // Store in Redis as hash
      const codeKey = `invitation:code:${code}`;
      await this.redis.getClient().hset(codeKey, {
        code,
        createdBy,
        createdAt: timestamp,
        isUsed: 'false',
      });

      // Set TTL for auto-expiration
      await this.redis.expire(codeKey, this.CODE_TTL);

      codes.push(code);
    }

    // Async database write for audit trail (non-blocking)
    this.writeToAuditTrail(codes, createdBy, timestamp).catch((error) => {
      this.logger.error(
        'Failed to write invitation codes to audit trail',
        error
      );
    });

    return { count: codes.length, codes };
  }

  /**
   * Validate if invitation code exists and is unused
   */
  async validateCode(code: string): Promise<boolean> {
    const codeKey = `invitation:code:${code}`;

    // Check if code exists in Redis
    const exists = await this.redis.exists(codeKey);
    if (!exists) {
      return false;
    }

    // Check if code is already used
    const isUsed = await this.redis.getClient().hget(codeKey, 'isUsed');
    if (isUsed === 'true') {
      return false;
    }

    return true;
  }

  /**
   * Mark invitation code as used
   */
  async markAsUsed(code: string, userId: string) {
    const codeKey = `invitation:code:${code}`;

    // Check if code exists
    const exists = await this.redis.exists(codeKey);
    if (!exists) {
      throw new NotFoundException('Invitation code not found');
    }

    // Check if already used
    const isUsed = await this.redis.getClient().hget(codeKey, 'isUsed');
    if (isUsed === 'true') {
      throw new BadRequestException('Invitation code already used');
    }

    const usedAt = new Date().toISOString();

    // Update Redis hash
    await this.redis.getClient().hset(codeKey, {
      isUsed: 'true',
      usedBy: userId,
      usedAt,
    });

    // Add to used codes set with longer TTL
    const usedKey = `invitation:used:${code}`;
    await this.redis.set(usedKey, `${userId}:${usedAt}`, this.USED_CODE_TTL);

    // Async database update for audit trail (non-blocking)
    this.updateAuditTrail(code, userId, usedAt).catch((error) => {
      this.logger.error(
        'Failed to update invitation code in audit trail',
        error
      );
    });

    return {
      code,
      isUsed: true,
      usedBy: userId,
      usedAt,
    };
  }

  /**
   * Write generated codes to database for audit trail
   */
  private async writeToAuditTrail(
    codes: string[],
    createdBy: string,
    createdAt: string
  ): Promise<void> {
    const data = codes.map((code) => ({
      code,
      createdBy,
      createdAt: new Date(createdAt),
    }));

    await this.prisma.invitationCode.createMany({
      data,
      skipDuplicates: true,
    });
  }

  /**
   * Update database when code is used (for audit trail)
   */
  private async updateAuditTrail(
    code: string,
    userId: string,
    usedAt: string
  ): Promise<void> {
    await this.prisma.invitationCode.update({
      where: { code },
      data: {
        isUsed: true,
        usedBy: userId,
        usedAt: new Date(usedAt),
      },
    });
  }
}
