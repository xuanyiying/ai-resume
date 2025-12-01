import { IsNotEmpty, IsString } from 'class-validator';

export class EndSessionDto {
  @IsNotEmpty()
  @IsString()
  sessionId: string;
}
