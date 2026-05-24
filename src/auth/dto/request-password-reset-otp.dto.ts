import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class RequestPasswordResetOtpDto {
  @ApiProperty({ description: 'Registered email to receive the reset OTP', example: 'user@example.com' })
  @IsEmail()
  email!: string;
}
