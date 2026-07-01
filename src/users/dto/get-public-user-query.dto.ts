import { createOffsetPaginationQueryDto } from '../../common/dto/offset-pagination-query.dto';

const GetPublicUserQueryDtoBase = createOffsetPaginationQueryDto({
  defaultLimit: 20,
  maxLimit: 50,
});

export class GetPublicUserQueryDto extends GetPublicUserQueryDtoBase {}
