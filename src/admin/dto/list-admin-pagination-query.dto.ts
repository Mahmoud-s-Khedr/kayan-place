import { createOffsetPaginationQueryDto } from '../../common/dto/offset-pagination-query.dto';

const ListAdminPaginationQueryDtoBase = createOffsetPaginationQueryDto({
  defaultLimit: 20,
  maxLimit: 100,
  maxOffset: 10_000,
});

export class ListAdminPaginationQueryDto extends ListAdminPaginationQueryDtoBase {}
