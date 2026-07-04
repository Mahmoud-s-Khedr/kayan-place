import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateItemRatingDto, RatingItemType } from './kayan.dto';

describe('CreateItemRatingDto', () => {
  it('allows omitted comment', () => {
    const dto = plainToInstance(CreateItemRatingDto, {
      itemType: RatingItemType.PRODUCT,
      itemId: 9,
      orderId: 12,
      ratingValue: 5,
    });

    expect(validateSync(dto)).toHaveLength(0);
  });

  it('rejects empty comment with string-length validation', () => {
    const dto = plainToInstance(CreateItemRatingDto, {
      itemType: RatingItemType.FAULT,
      itemId: 9,
      ratingValue: 5,
      comment: '',
    });

    const errors = validateSync(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.constraints).toHaveProperty('isLength');
    expect(errors[0]?.constraints).not.toHaveProperty('min');
    expect(errors[0]?.constraints).not.toHaveProperty('max');
  });
});
