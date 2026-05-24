import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Email associated with the account', example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'One-time password received via email (4–8 digits)', example: '000000', minLength: 4, maxLength: 8 })
  @IsString()
  @Length(4, 8)
  otp!: string;

  @ApiProperty({ description: 'New password — must contain letters and numbers (8–64 chars)', example: 'NewSecret123', minLength: 8, maxLength: 64 })
  @IsString()
  @Length(8, 64)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'Password must contain letters and numbers',
  })
  newPassword!: string;

  @ApiProperty({ description: 'Must match newPassword', example: 'NewSecret123', minLength: 8, maxLength: 64 })
  @IsString()
  @Length(8, 64)
  confirmPassword!: string;
}
