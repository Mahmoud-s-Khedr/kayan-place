import { BadRequestException } from '@nestjs/common';
import { KayanService } from './kayan.service';
import { ItemType, OrderStatus } from './kayan.dto';

describe('KayanService', () => {
  const databaseService = {
    query: jest.fn(),
    withTransaction: jest.fn(),
  };

  const service = new KayanService(databaseService as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('applies product filters/sorting and includes assets', async () => {
    databaseService.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            title: 'Chair',
            description: 'Wooden chair',
            amount: 4,
            price: '200.00',
            details: null,
            is_active: true,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            product_id: 1,
            file_id: 50,
            asset_type: 'image',
            sort_order: 0,
            object_key: 'products/1/a.jpg',
            original_filename: 'a.jpg',
            mime_type: 'image/jpeg',
            status: 'uploaded',
          },
        ],
      });

    const result = await service.listProducts({
      query: 'chair',
      minPrice: 100,
      maxPrice: 300,
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
      sortBy: 'price' as any,
      sortDirection: 'asc' as any,
    });

    expect(result).toEqual({
      items: [
        expect.objectContaining({
          id: 1,
          images: [
            expect.objectContaining({
              file_id: 50,
              object_key: 'products/1/a.jpg',
            }),
          ],
          files: [],
        }),
      ],
    });

    const [queryText, params] = databaseService.query.mock.calls[0];
    expect(queryText).toContain('title ILIKE');
    expect(queryText).toContain('price >= $2');
    expect(queryText).toContain('price <= $3');
    expect(queryText).toContain('created_at >= $4');
    expect(queryText).toContain('created_at <= $5');
    expect(queryText).toContain('ORDER BY price ASC, id DESC');
    expect(params).toEqual(['%chair%', 100, 300, '2026-01-01', '2026-01-31']);
  });

  it('adds cart items and returns expanded cart data', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ amount: 5, is_active: true }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            product_id: 3,
            quantity: 2,
            created_at: '2026-01-02T00:00:00.000Z',
            updated_at: '2026-01-02T00:00:00.000Z',
            title: 'Lamp',
            description: 'Desk lamp',
            amount: 5,
            price: '150.00',
            is_active: true,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            product_id: 3,
            file_id: 88,
            asset_type: 'image',
            sort_order: 0,
            object_key: 'products/3/lamp.jpg',
            original_filename: 'lamp.jpg',
            mime_type: 'image/jpeg',
            status: 'uploaded',
          },
        ],
      });

    const result = await service.addCartItem(
      { sub: 7, phone: '+201000000007', isAdmin: false },
      { productId: 3, quantity: 2 },
    );

    expect(result).toEqual({
      items: [
        expect.objectContaining({
          id: 10,
          product_id: 3,
          quantity: 2,
          product: expect.objectContaining({
            id: 3,
            title: 'Lamp',
            images: [
              expect.objectContaining({
                file_id: 88,
              }),
            ],
          }),
        }),
      ],
    });
  });

  it('creates a direct order and returns expanded items', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ id: 91 }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 4, amount: 3, price: '50.00', is_active: true }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] })
        .mockResolvedValueOnce({
          rows: [{ order_id: 91, id: 1, product_id: 4, quantity: 2, unit_price: '50.00', title: 'Box', is_active: true }],
        }),
    };
    databaseService.withTransaction.mockImplementationOnce((callback: any) => callback(client));

    const result = await service.createOrder(
      { sub: 2, phone: '+201000000002', isAdmin: false },
      { deliveryAddress: 'Nasr City', items: [{ productId: 4, quantity: 2 }] },
    );

    expect(result).toEqual({
      order: expect.objectContaining({
        status: OrderStatus.RECEIVED,
        item_count: 1,
        items: [
          expect.objectContaining({
            product: expect.objectContaining({ id: 4, title: 'Box' }),
          }),
        ],
      }),
    });
  });

  it('checks out cart inside one transaction and clears cart rows', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1, product_id: 9, quantity: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 55 }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 9, amount: 2, price: '500.00', is_active: true }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] })
        .mockResolvedValueOnce({
          rows: [{ order_id: 55, id: 3, product_id: 9, quantity: 1, unit_price: '500.00', title: 'Sofa', is_active: true }],
        })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] }),
    };
    databaseService.withTransaction.mockImplementationOnce((callback: any) => callback(client));

    const result = await service.checkoutCart(
      { sub: 12, phone: '+201000000012', isAdmin: false },
      { deliveryAddress: 'Maadi' },
    );

    expect(result).toEqual({
      order: expect.objectContaining({
        item_count: 1,
      }),
    });
    expect(client.query).toHaveBeenLastCalledWith('DELETE FROM cart_items WHERE user_id = $1', [12]);
  });

  it('lists my orders with filters and embedded items', async () => {
    databaseService.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 15,
            user_id: 3,
            delivery_address: 'Giza',
            status: 'received',
            created_at: '2026-02-01T00:00:00.000Z',
            updated_at: '2026-02-01T00:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ order_id: 15, id: 5, product_id: 7, quantity: 1, unit_price: '40.00', title: 'Fan', is_active: true }],
      });

    const result = await service.listMyOrders(
      { sub: 3, phone: '+201000000003', isAdmin: false },
      { status: OrderStatus.RECEIVED, fromDate: '2026-02-01', sortDirection: 'asc' as any },
    );

    expect(result).toEqual({
      items: [
        expect.objectContaining({
          id: 15,
          item_count: 1,
          items: [expect.objectContaining({ product_id: 7 })],
        }),
      ],
    });

    const [queryText, params] = databaseService.query.mock.calls[0];
    expect(queryText).toContain('po.status = $2');
    expect(queryText).toContain('po.created_at >= $3');
    expect(queryText).toContain('ORDER BY po.created_at ASC, po.id DESC');
    expect(params).toEqual([3, OrderStatus.RECEIVED, '2026-02-01']);
  });

  it('lists admin orders with user information', async () => {
    databaseService.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 20,
            user_id: 9,
            delivery_address: 'Heliopolis',
            status: 'delivered',
            created_at: '2026-03-01T00:00:00.000Z',
            updated_at: '2026-03-02T00:00:00.000Z',
            user_name: 'Sara',
            user_email: 'sara@example.com',
            user_phone: '+201000000009',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ order_id: 20, id: 2, product_id: 4, quantity: 1, unit_price: '80.00', title: 'Mirror', is_active: true }],
      });

    const result = await service.adminListOrders();

    expect(result).toEqual({
      items: [
        expect.objectContaining({
          user: expect.objectContaining({
            id: 9,
            name: 'Sara',
          }),
        }),
      ],
    });
  });

  it('creates a product rating only for delivered ordered products', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 4, status: OrderStatus.DELIVERED }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 99 }] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 1, user_id: 4, order_id: 6, product_id: 2, rating_value: 5, created_at: '2026-04-01T00:00:00.000Z' }],
      });

    const result = await service.createItemRating(
      { sub: 4, phone: '+201000000004', isAdmin: false },
      { itemType: ItemType.ORDER, orderId: 6, productId: 2, ratingValue: 5 },
    );

    expect(result).toEqual({
      rating: expect.objectContaining({
        order_id: 6,
        product_id: 2,
        rating_value: 5,
      }),
    });
  });

  it('rejects duplicate product ratings', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 4, status: OrderStatus.DELIVERED }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 99 }] })
      .mockRejectedValueOnce({ code: '23505' });

    await expect(
      service.createItemRating(
        { sub: 4, phone: '+201000000004', isAdmin: false },
        { itemType: ItemType.ORDER, orderId: 6, productId: 2, ratingValue: 5 },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('lists public gallery items as active-only with rich images', async () => {
    databaseService.query
      .mockResolvedValueOnce({
        rows: [
          { id: 1, title: 'Living Room', description: 'Modern', is_active: true, created_at: '2026-05-01T00:00:00.000Z' },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            gallery_item_id: 1,
            file_id: 101,
            sort_order: 0,
            object_key: 'gallery/1/a.jpg',
            original_filename: 'a.jpg',
            mime_type: 'image/jpeg',
            status: 'uploaded',
          },
        ],
      });

    const result = await service.listGallery();

    expect(result).toEqual({
      items: [
        expect.objectContaining({
          id: 1,
          title: 'Living Room',
          images: [
            expect.objectContaining({
              file_id: 101,
              object_key: 'gallery/1/a.jpg',
              mime_type: 'image/jpeg',
            }),
          ],
        }),
      ],
    });
    expect(databaseService.query.mock.calls[0][0]).toContain('is_active = true');
  });

  it('lists admin gallery items including inactive entries', async () => {
    databaseService.query
      .mockResolvedValueOnce({
        rows: [
          { id: 2, title: 'Kitchen', description: 'Wood', is_active: false, created_at: '2026-05-02T00:00:00.000Z' },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            gallery_item_id: 2,
            file_id: 202,
            sort_order: 0,
            object_key: 'gallery/2/a.jpg',
            original_filename: 'k.jpg',
            mime_type: 'image/jpeg',
            status: 'uploaded',
          },
        ],
      });

    const result = await service.adminListGallery();

    expect(result).toEqual({
      items: [
        expect.objectContaining({
          id: 2,
          is_active: false,
          images: [expect.objectContaining({ file_id: 202 })],
        }),
      ],
    });
    expect(databaseService.query.mock.calls[0][0]).not.toContain('is_active = true');
    expect(databaseService.query.mock.calls[0][0]).toContain('deleted_at IS NULL');
  });

  it('creates a gallery item and returns rich images', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ id: 9 }] }) // insert gallery item
        .mockResolvedValueOnce({ rowCount: 1, rows: [] }) // delete gallery assets
        .mockResolvedValueOnce({ rowCount: 1, rows: [] }) // insert gallery asset #1
        .mockResolvedValueOnce({ rowCount: 1, rows: [] }) // insert gallery asset #2
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: 9, title: 'Hall', description: 'Bright', is_active: true, created_at: '2026-05-03T00:00:00.000Z' }],
        }) // select gallery item (same tx)
        .mockResolvedValueOnce({
          rows: [
            {
              gallery_item_id: 9,
              file_id: 301,
              sort_order: 0,
              object_key: 'gallery/9/hall.jpg',
              original_filename: 'hall.jpg',
              mime_type: 'image/jpeg',
              status: 'uploaded',
            },
          ],
        }), // select gallery assets (same tx)
    };
    databaseService.withTransaction.mockImplementationOnce((callback: any) => callback(client));

    const result = await service.adminCreateGalleryItem(
      { sub: 1, phone: '+201000000001', isAdmin: true },
      { title: 'Hall', description: 'Bright', imageFileIds: [301, 302] },
    );

    expect(result).toEqual({
      item: expect.objectContaining({
        id: 9,
        images: [expect.objectContaining({ file_id: 301, object_key: 'gallery/9/hall.jpg' })],
      }),
    });
    expect(databaseService.query).not.toHaveBeenCalled();
  });

  it('updates a gallery item and returns rich images', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 11 }] }) // update gallery item
        .mockResolvedValueOnce({ rowCount: 1, rows: [] }) // delete gallery assets
        .mockResolvedValueOnce({ rowCount: 1, rows: [] }) // insert gallery asset
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: 11, title: 'Before', description: 'Desc', is_active: true, created_at: '2026-05-04T00:00:00.000Z' }],
        }) // select gallery item (same tx)
        .mockResolvedValueOnce({
          rows: [
            {
              gallery_item_id: 11,
              file_id: 401,
              sort_order: 0,
              object_key: 'gallery/11/after.jpg',
              original_filename: 'after.jpg',
              mime_type: 'image/jpeg',
              status: 'uploaded',
            },
          ],
        }), // select gallery assets (same tx)
    };
    databaseService.withTransaction.mockImplementationOnce((callback: any) => callback(client));

    const result = await service.adminUpdateGalleryItem(
      { sub: 1, phone: '+201000000001', isAdmin: true },
      11,
      { title: 'After', imageFileIds: [401] },
    );

    expect(result).toEqual({
      item: expect.objectContaining({
        id: 11,
        images: [expect.objectContaining({ file_id: 401 })],
      }),
    });
    expect(databaseService.query).not.toHaveBeenCalled();
  });

  it('regression: create uses transaction visibility when pool-level read would miss row', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ id: 15 }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: 15, title: 'Tx Item', description: 'Visible in tx', is_active: true, created_at: '2026-05-05T00:00:00.000Z' }],
        })
        .mockResolvedValueOnce({ rows: [] }),
    };
    databaseService.withTransaction.mockImplementationOnce((callback: any) => callback(client));

    const result = await service.adminCreateGalleryItem(
      { sub: 1, phone: '+201000000001', isAdmin: true },
      { title: 'Tx Item', description: 'Visible in tx', imageFileIds: [] },
    );

    expect(result).toEqual({
      item: expect.objectContaining({
        id: 15,
        title: 'Tx Item',
        images: [],
      }),
    });
  });

  it('soft deletes gallery item and hides it from subsequent list', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 12 }] })
      .mockResolvedValueOnce({ rows: [] });

    const deletion = await service.adminDeleteGalleryItem(
      { sub: 1, phone: '+201000000001', isAdmin: true },
      12,
    );
    const listed = await service.listGallery();

    expect(deletion).toEqual({ message: 'Gallery item deleted' });
    expect(listed).toEqual({ items: [] });
    expect(databaseService.query.mock.calls[0][0]).toContain('SET deleted_at = NOW()');
  });
});
