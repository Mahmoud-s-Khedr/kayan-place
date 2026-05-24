import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListConversationsDto {
  @ApiPropertyOptional({
    description: 'Filter conversations by context',
    enum: ['all', 'buy', 'sell'],
    example: 'all',
  })
  @IsOptional()
  @IsEnum(['all', 'buy', 'sell'])
  scope?: 'all' | 'buy' | 'sell';

  @ApiPropertyOptional({ description: 'Page size (1–100, default 20)', example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Pagination offset (default 0)', example: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}
