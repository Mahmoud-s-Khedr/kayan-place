import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GetPublicUserQueryDto } from './get-public-user-query.dto';

describe('GetPublicUserQueryDto', () => {
  it('rejects invalid pagination values', async () => {
    const dto = plainToInstance(GetPublicUserQueryDto, { page: 0, limit: 0, offset: -1 });
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts valid pagination values', async () => {
    const dto = plainToInstance(GetPublicUserQueryDto, { page: 2, limit: 20, offset: 0 });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});
