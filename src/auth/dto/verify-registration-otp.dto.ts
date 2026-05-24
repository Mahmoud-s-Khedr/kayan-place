import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

export class VerifyRegistrationOtpDto {
  @ApiProperty({ description: 'Email address', example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'One-time password sent via email (4–8 digits)', example: '000000', minLength: 4, maxLength: 8 })
  @IsString()
  @Length(4, 8)
  otp!: string;
}
