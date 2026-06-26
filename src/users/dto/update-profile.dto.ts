import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Length } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Display name (2–150 chars)', example: 'Ahmed Ali', minLength: 2, maxLength: 150 })
  @IsOptional()
  @IsString()
  @Length(2, 150)
  name?: string;

  @ApiPropertyOptional({ description: 'File ID of the uploaded avatar image, or null to remove avatar', example: 7, nullable: true })
  @IsOptional()
  @IsNumber()
  avatarFileId?: number | null;

  @ApiPropertyOptional({ description: 'Public contact information string (or null to clear)', example: '+201012345678', nullable: true, minLength: 1, maxLength: 255 })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  contactInfo?: string | null;

  @ApiPropertyOptional({ description: 'Phone number (7–32 chars)', example: '+201001234567', minLength: 7, maxLength: 32 })
  @IsOptional()
  @IsString()
  @Length(7, 32)
  phone?: string;

  @ApiPropertyOptional({ description: 'Address (optional)', example: '123 Main St, Cairo', maxLength: 500, nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  address?: string | null;
}
