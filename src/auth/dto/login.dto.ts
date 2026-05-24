import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: 'User email address', example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'User password (8–64 chars)', example: 'Secret123', minLength: 8, maxLength: 64 })
  @IsString()
  @Length(8, 64)
  password!: string;
}
