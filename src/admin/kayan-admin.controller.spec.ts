import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RatingItemType } from '../kayan/kayan.dto';
import { KayanAdminController } from './kayan-admin.controller';

describe('KayanAdminController', () => {
  const kayanService = {
    adminGetItemReviews: jest.fn(),
    adminGetUserReceivedReviews: jest.fn(),
    adminListRatings: jest.fn(),
  };

  const controller = new KayanAdminController(kayanService as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is protected by JWT and admin guards at the controller level', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, KayanAdminController) as Array<new (...args: any[]) => unknown>;

    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, AdminGuard]));
  });

  it('maps admin item ratings route to the item review service', async () => {
    kayanService.adminGetItemReviews.mockResolvedValueOnce({ items: [], total: 0 });

    const result = await controller.listItemRatings(
      { itemId: 12 },
      { itemType: RatingItemType.PRODUCT },
    );

    expect(result).toEqual({ items: [], total: 0 });
    expect(kayanService.adminGetItemReviews).toHaveBeenCalledWith(12, { itemType: RatingItemType.PRODUCT });

    expect(Reflect.getMetadata(PATH_METADATA, KayanAdminController.prototype.listItemRatings)).toBe('ratings/items/:itemId');
    expect(Reflect.getMetadata(METHOD_METADATA, KayanAdminController.prototype.listItemRatings)).toBe(RequestMethod.GET);
  });

  it('maps admin user ratings route to the received review service', async () => {
    kayanService.adminGetUserReceivedReviews.mockResolvedValueOnce({ items: [], total: 0 });

    const result = await controller.listUserRatings(
      { id: 7 },
      { itemType: RatingItemType.FAULT as any },
    );

    expect(result).toEqual({ items: [], total: 0 });
    expect(kayanService.adminGetUserReceivedReviews).toHaveBeenCalledWith(7, { itemType: RatingItemType.FAULT });

    expect(Reflect.getMetadata(PATH_METADATA, KayanAdminController.prototype.listUserRatings)).toBe('ratings/users/:id');
    expect(Reflect.getMetadata(METHOD_METADATA, KayanAdminController.prototype.listUserRatings)).toBe(RequestMethod.GET);
  });

  it('maps admin global ratings route to the moderation list service', async () => {
    kayanService.adminListRatings.mockResolvedValueOnce({ items: [], total: 0 });

    const result = await controller.listRatings({ userId: 5, ratingValue: 4 });

    expect(result).toEqual({ items: [], total: 0 });
    expect(kayanService.adminListRatings).toHaveBeenCalledWith({ userId: 5, ratingValue: 4 });

    expect(Reflect.getMetadata(PATH_METADATA, KayanAdminController.prototype.listRatings)).toBe('ratings');
    expect(Reflect.getMetadata(METHOD_METADATA, KayanAdminController.prototype.listRatings)).toBe(RequestMethod.GET);
  });
});
