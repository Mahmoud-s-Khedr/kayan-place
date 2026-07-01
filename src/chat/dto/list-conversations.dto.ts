import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { createOffsetPaginationQueryDto } from '../../common/dto/offset-pagination-query.dto';

const ListConversationsDtoBase = createOffsetPaginationQueryDto({
  defaultLimit: 20,
  maxLimit: 100,
});

export class ListConversationsDto extends ListConversationsDtoBase {
  @ApiPropertyOptional({
    description: 'Filter conversations by context',
    enum: ['all', 'buy', 'sell'],
    example: 'all',
  })
  @IsOptional()
  @IsEnum(['all', 'buy', 'sell'])
  scope?: 'all' | 'buy' | 'sell';

}
