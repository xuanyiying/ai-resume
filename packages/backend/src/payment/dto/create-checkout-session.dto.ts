import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCheckoutSessionDto {
  @ApiProperty({
    description: 'The Stripe Price ID for the subscription plan',
    example: 'price_1234567890',
  })
  @IsString()
  @IsNotEmpty()
  priceId: string;
}
