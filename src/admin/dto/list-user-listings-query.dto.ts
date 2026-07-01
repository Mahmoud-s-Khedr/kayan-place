import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { createOffsetPaginationQueryDto } from '../../common/dto/offset-pagination-query.dto';

const ListUserListingsQueryDtoBase = createOffsetPaginationQueryDto({
  defaultLimit: 20,
  maxLimit: 100,
  maxOffset: 10_000,
});

export class ListUserListingsQueryDto extends ListUserListingsQueryDtoBase {
  @ApiPropertyOptional({
    description: 'Filter user listings by status for admin view',
    enum: ['available', 'sold'],
    example: 'available',
  })
  @IsOptional()
  @IsEnum(['available', 'sold'])
  status?: 'available' | 'sold';

}
