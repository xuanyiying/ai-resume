import { ApiProperty } from '@nestjs/swagger';
import { SubscriptionTier } from '@prisma/client';

export class SubscriptionResponseDto {
  @ApiProperty({
    description: 'Current subscription tier',
    enum: SubscriptionTier,
  })
  tier: SubscriptionTier;

  @ApiProperty({
    description: 'Subscription status (active, canceled, past_due, etc.)',
    required: false,
  })
  status?: string;

  @ApiProperty({
    description: 'Subscription expiration date',
    required: false,
  })
  expiresAt?: Date;

  @ApiProperty({
    description:
      'Whether the subscription will cancel at the end of the period',
    required: false,
  })
  cancelAtPeriodEnd?: boolean;

  @ApiProperty({
    description: 'Current period end date',
    required: false,
  })
  currentPeriodEnd?: Date;
}
