import { ApiProperty } from '@nestjs/swagger';
import { SubscriptionTier, Role } from '@prisma/client';

export class AuthResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  user!: {
    id: string;
    email: string;
    username?: string;
    subscriptionTier: SubscriptionTier;
    role: Role;
    emailVerified: boolean;
  };
}
