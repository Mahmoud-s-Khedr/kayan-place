import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { KayanService } from './kayan.service';
import { FaultStatus, ItemType, OrderStatus, RatingItemType, ServiceStatus, ServiceType } from './kayan.dto';

describe('KayanService', () => {
  const databaseService = {
    query: jest.fn(),
    withTransaction: jest.fn(),
  };

  const service = new KayanService(databaseService as any, {
    buildReadUrl: jest.fn().mockReturnValue('https://cdn.example.test/avatar.jpg'),
  } as any);

  beforeEach(() => {
    jest.resetAllMocks();
    databaseService.query.mockResolvedValue({ rows: [] });
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

    expect(result).toMatchObject({
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
    expect(queryText).toContain('cp.created_at >= $4');
    expect(queryText).toContain("cp.created_at < ($5::date + INTERVAL '1 day')");
    expect(queryText).toContain('ORDER BY price ASC, cp.id DESC');
    expect(queryText).toContain('LIMIT $6 OFFSET $7');
    expect(params).toEqual(['%chair%', 100, 300, '2026-01-01', '2026-01-31', 20, 0]);
  });

  it('lists products as active-only for public callers by default', async () => {
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
            rate: '0',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    await service.listProducts();

    const [queryText] = databaseService.query.mock.calls[0];
    expect(queryText).toContain('deleted_at IS NULL AND is_active = true');
  });

  it('includes the current user review in product listings for authenticated callers', async () => {
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
            rate: '4.5',
            review: { id: 12, user_id: 7, rating_value: 5 },
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const result = await service.listProducts(
      { query: 'chair' },
      { sub: 7, phone: '+201000000007', isAdmin: false },
    );

    expect(result).toMatchObject({
      items: [expect.objectContaining({ review: expect.objectContaining({ id: 12, user_id: 7 }) })],
    });

    const [queryText, params] = databaseService.query.mock.calls[0];
    expect(queryText).toContain('r.user_id = $2');
    expect(params).toEqual(['%chair%', 7, 20, 0]);
  });

  it('ignores inactive/all availability filters for public and non-admin callers', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await service.listProducts({ availability: 'all' as any });
    await service.listProducts({ availability: 'inactive' as any }, { sub: 9, phone: '+201000000009', isAdmin: false });

    const [publicQueryText] = databaseService.query.mock.calls[0];
    const [memberQueryText] = databaseService.query.mock.calls[1];
    expect(publicQueryText).toContain('deleted_at IS NULL AND is_active = true');
    expect(memberQueryText).toContain('deleted_at IS NULL AND is_active = true');
    expect(publicQueryText).not.toContain('is_active = false');
    expect(memberQueryText).not.toContain('is_active = false');
  });

  it('lists all non-deleted products for admin callers by default', async () => {
    databaseService.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 2,
            title: 'Cabinet',
            description: 'Storage',
            amount: 2,
            price: '300.00',
            details: null,
            is_active: false,
            created_at: '2026-01-02T00:00:00.000Z',
            updated_at: '2026-01-02T00:00:00.000Z',
            rate: '0',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    await service.listProducts({}, { sub: 1, phone: '+201000000001', isAdmin: true });

    const [queryText] = databaseService.query.mock.calls[0];
    expect(queryText).toContain('WHERE deleted_at IS NULL');
    expect(queryText).not.toContain('is_active = true');
    expect(queryText).not.toContain('is_active = false');
  });

  it('honors availability filters for admin callers', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await service.listProducts({ availability: 'active' as any }, { sub: 1, phone: '+201000000001', isAdmin: true });
    await service.listProducts({ availability: 'inactive' as any }, { sub: 1, phone: '+201000000001', isAdmin: true });
    await service.listProducts({ availability: 'all' as any }, { sub: 1, phone: '+201000000001', isAdmin: true });

    const productListQueries = databaseService.query.mock.calls
      .map(([queryText]) => queryText)
      .filter((queryText) => typeof queryText === 'string' && queryText.includes('FROM catalog_products cp'));
    const [activeQueryText, inactiveQueryText, allQueryText] = productListQueries;
    expect(activeQueryText).toContain('deleted_at IS NULL AND is_active = true');
    expect(inactiveQueryText).toContain('deleted_at IS NULL AND is_active = false');
    expect(allQueryText).toContain('WHERE deleted_at IS NULL');
    expect(allQueryText).not.toContain('is_active = true');
    expect(allQueryText).not.toContain('is_active = false');
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

    expect(result).toMatchObject({
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

  it('lists cart items with embedded product objects', async () => {
    databaseService.query
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

    const result = await service.listCart({ sub: 7, phone: '+201000000007', isAdmin: false });

    expect(result).toMatchObject({
      items: [
        expect.objectContaining({
          id: 10,
          product_id: 3,
          product: expect.objectContaining({
            id: 3,
            title: 'Lamp',
            images: [expect.objectContaining({ file_id: 88 })],
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
        .mockResolvedValueOnce({ rows: [{ name: 'User', email: 'user@test.com', phone: '+2' }] })
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
        .mockResolvedValueOnce({ rows: [{ name: 'User', email: 'user@test.com', phone: '+2' }] })
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
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ id: 3, name: 'Mona', email: 'mona@example.com', phone: '+201000000003', address: 'Giza', status: 'active', rate: '4.50', contact_info: '+201000000003', avatar_file_id: null }],
      });

    const result = await service.listMyOrders(
      { sub: 3, phone: '+201000000003', isAdmin: false },
      { status: OrderStatus.RECEIVED, fromDate: '2026-02-01', sortDirection: 'asc' as any, page: 2, limit: 5 },
    );

    expect(result).toMatchObject({
      items: [
        expect.objectContaining({
          id: 15,
          user: expect.objectContaining({ address: 'Giza', status: 'active', rate: '4.50', avatar: null }),
          item_count: 1,
          items: [
            expect.objectContaining({
              product_id: 7,
              product: expect.objectContaining({ id: 7, title: 'Fan' }),
            }),
          ],
        }),
      ],
    });

    const [queryText, params] = databaseService.query.mock.calls[0];
    expect(queryText).toContain('po.status = $2');
    expect(queryText).toContain('po.created_at >= $3');
    expect(queryText).toContain('ORDER BY po.created_at ASC, po.id DESC');
    expect(queryText).toContain('LIMIT $4 OFFSET $5');
    expect(params).toEqual([3, OrderStatus.RECEIVED, '2026-02-01', 5, 5]);
    expect(databaseService.query.mock.calls[1][0]).toContain('pr.order_id = oi.order_id AND pr.product_id = oi.product_id');
  });

  it('lists my orders with search and price filters', async () => {
    databaseService.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 25,
            user_id: 3,
            delivery_address: 'Nasr City',
            status: 'received',
            created_at: '2026-02-03T00:00:00.000Z',
            updated_at: '2026-02-03T00:00:00.000Z',
            user_name: 'Mona',
            user_email: 'mona@example.com',
            user_phone: '+201000000003',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ order_id: 25, id: 6, product_id: 8, quantity: 2, unit_price: '75.00', title: 'Shelf', is_active: true }],
      });

    const result = await service.listMyOrders(
      { sub: 3, phone: '+201000000003', isAdmin: false },
      { search: 'Mona', minPrice: 100, maxPrice: 200, sortBy: 'price' as any, sortDirection: 'asc' as any },
    );

    expect(result).toMatchObject({
      items: [
        expect.objectContaining({
          user: expect.objectContaining({ id: 3, name: 'Mona' }),
        }),
      ],
    });

    const [queryText, params] = databaseService.query.mock.calls[0];
    expect(queryText).toContain('u.name ILIKE $2');
    expect(queryText).toContain('>= $3');
    expect(queryText).toContain('<= $4');
    expect(queryText).toContain('ORDER BY (SELECT COALESCE(SUM(oi.unit_price * oi.quantity), 0) FROM order_items oi WHERE oi.order_id = po.id) ASC, po.id DESC');
    expect(params).toEqual([3, '%Mona%', 100, 200, 20, 0]);
  });

  it('prefers explicit offset over page in my faults list', async () => {
    databaseService.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            user_id: 9,
            title: 'Leak',
            description: 'Pipe leak',
            severity: 'normal',
            address: 'Cairo',
            status: 'received',
            cancelled_at: null,
            created_at: '2026-02-01T00:00:00.000Z',
            updated_at: '2026-02-01T00:00:00.000Z',
            rate: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    await service.listMyFaults(
      { sub: 9, phone: '+201000000009', isAdmin: false },
      { page: 3, limit: 10, offset: 4 },
    );

    const [queryText, params] = databaseService.query.mock.calls[0];
    expect(queryText).toContain('LIMIT $2 OFFSET $3');
    expect(params).toEqual([9, 10, 4]);
  });

  it('lists admin orders with user information', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ count: '1' }] })
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

    expect(result).toMatchObject({
      items: [
        expect.objectContaining({
          user: expect.objectContaining({
            id: 9,
            name: 'Sara',
          }),
          items: [
            expect.objectContaining({
              product_id: 4,
              product: expect.objectContaining({ id: 4, title: 'Mirror' }),
            }),
          ],
        }),
      ],
    });
  });

  it('lists admin orders with search filters using the same joined count query', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ count: '1' }] })
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

    const result = await service.adminListOrders({ search: 'Sara' });

    expect(result).toMatchObject({
      total: 1,
      items: [expect.objectContaining({ user: expect.objectContaining({ id: 9, name: 'Sara' }) })],
    });

    const [countQueryText, countParams] = databaseService.query.mock.calls[0];
    const [listQueryText, listParams] = databaseService.query.mock.calls[1];
    expect(countQueryText).toContain('FROM product_orders po');
    expect(countQueryText).toContain('LEFT JOIN users u ON u.id = po.user_id');
    expect(countQueryText).toContain('u.name ILIKE $1');
    expect(countParams).toEqual(['%Sara%']);
    expect(listQueryText).toContain('LEFT JOIN users u ON u.id = po.user_id');
    expect(listParams).toEqual(['%Sara%', 20, 0]);
  });

  it('lists admin orders with aggregated price filters and sorting', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ count: '1' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 31,
            user_id: 10,
            delivery_address: 'Zamalek',
            status: 'received',
            created_at: '2026-03-05T00:00:00.000Z',
            updated_at: '2026-03-05T00:00:00.000Z',
            user_name: 'Nour',
            user_email: 'nour@example.com',
            user_phone: '+201000000010',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ order_id: 31, id: 8, product_id: 11, quantity: 2, unit_price: '120.00', title: 'Table', is_active: true }],
      });

    await service.adminListOrders({ minPrice: 200, maxPrice: 300, sortBy: 'price' as any, sortDirection: 'asc' as any });

    const [countQueryText, countParams] = databaseService.query.mock.calls[0];
    const [listQueryText, listParams] = databaseService.query.mock.calls[1];
    expect(countQueryText).toContain('SELECT COUNT(*)::text AS count');
    expect(countQueryText).toContain('>= $1');
    expect(countQueryText).toContain('<= $2');
    expect(countParams).toEqual([200, 300]);
    expect(listQueryText).toContain('ORDER BY (SELECT COALESCE(SUM(oi.unit_price * oi.quantity), 0) FROM order_items oi WHERE oi.order_id = po.id) ASC, po.id DESC');
    expect(listParams).toEqual([200, 300, 20, 0]);
  });

  it('gets a product with the current user review using query parameters', async () => {
    databaseService.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 4,
            title: 'Desk',
            description: 'Office desk',
            amount: 2,
            price: '500.00',
            details: null,
            is_active: true,
            created_at: '2026-03-10T00:00:00.000Z',
            updated_at: '2026-03-10T00:00:00.000Z',
            rate: '4.0',
            review: { id: 3, user_id: 7, rating_value: 4 },
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const result = await service.getProduct(4, 7);

    expect(result).toMatchObject({
      product: expect.objectContaining({
        id: 4,
        review: expect.objectContaining({ id: 3, user_id: 7 }),
      }),
    });

    const [queryText, params] = databaseService.query.mock.calls[0];
    expect(queryText).toContain('r.user_id = $2');
    expect(params).toEqual([4, 7]);
  });

  it('gets a product with null review when the current user has not rated it', async () => {
    databaseService.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 4,
            title: 'Desk',
            description: 'Office desk',
            amount: 2,
            price: '500.00',
            details: null,
            is_active: true,
            created_at: '2026-03-10T00:00:00.000Z',
            updated_at: '2026-03-10T00:00:00.000Z',
            rate: '4.0',
            review: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const result = await service.getProduct(4, 7);

    expect(result).toMatchObject({
      product: expect.objectContaining({
        id: 4,
        review: null,
      }),
    });
  });

  it('gets a single order with embedded product objects', async () => {
    databaseService.query
      .mockResolvedValueOnce({
        rowCount: 1,
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
        rows: [
          { order_id: 20, id: 2, product_id: 4, quantity: 1, unit_price: '80.00', title: 'Mirror', is_active: true },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const result = await service.getOrderForUser(9, 20);

    expect(result).toMatchObject({
      order: expect.objectContaining({
        id: 20,
        user: expect.objectContaining({ id: 9, name: 'Sara' }),
        items: [
          expect.objectContaining({
            product_id: 4,
            product: expect.objectContaining({ id: 4, title: 'Mirror' }),
          }),
        ],
      }),
    });
  });

  it('lists my services with filters and sorting', async () => {
    databaseService.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ count: '1' }] })
      .mockResolvedValueOnce({
      rows: [
        {
          id: 51,
          user_id: 6,
          service_type: ServiceType.MAINTENANCE,
          description: 'Fix AC',
          address: 'Cairo',
          status: ServiceStatus.NOT_STARTED,
          created_at: '2026-03-01T00:00:00.000Z',
          updated_at: '2026-03-01T00:00:00.000Z',
        },
      ],
    })
      .mockResolvedValueOnce({
        rows: [{ id: 6, name: 'Mona', email: 'mona@example.com', phone: '+201000000006', address: 'Cairo', status: 'active', rate: '4.50', contact_info: '+201000000006', avatar_file_id: null }],
      });

    const result = await service.listMyServices(
      { sub: 6, phone: '+201000000006', isAdmin: false },
      {
        serviceType: ServiceType.MAINTENANCE,
        fromDate: '2026-03-01',
        toDate: '2026-03-31',
        sortDirection: 'asc' as any,
        sortBy: 'createdAt' as any,
      },
    );

    expect(result).toMatchObject({
      items: [
        expect.objectContaining({
          id: 51,
          service_type: ServiceType.MAINTENANCE,
          user: expect.objectContaining({ id: 6, address: 'Cairo', rate: '4.50', avatar: null }),
        }),
      ],
    });

    const [queryText, params] = databaseService.query.mock.calls[1];
    expect(queryText).toContain('so.user_id = $1');
    expect(queryText).toContain('so.service_type = $2');
    expect(queryText).toContain('so.created_at >= $3');
    expect(queryText).toContain("so.created_at < ($4::date + INTERVAL '1 day')");
    expect(queryText).toContain('ORDER BY so.created_at ASC, so.id DESC');
    expect(params).toEqual([6, ServiceType.MAINTENANCE, '2026-03-01', '2026-03-31', 20, 0]);
  });

  it('lists my services with the current user rate object when already rated', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ count: '1' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 51,
            user_id: 6,
            service_type: ServiceType.MAINTENANCE,
            description: 'Fix AC',
            address: 'Cairo',
            status: ServiceStatus.FINISHED,
            created_at: '2026-03-01T00:00:00.000Z',
            updated_at: '2026-03-01T00:00:00.000Z',
          rate: { id: 14, user_id: 6, item_type: RatingItemType.SERVICE, item_id: 51, rating_value: 5 },
        },
      ],
    })
      .mockResolvedValueOnce({
        rows: [{ id: 6, name: 'Mona', email: 'mona@example.com', phone: '+201000000006', address: 'Cairo', status: 'active', rate: '4.50', contact_info: '+201000000006', avatar_file_id: null }],
      });

    const result = await service.listMyServices(
      { sub: 6, phone: '+201000000006', isAdmin: false },
      {},
    );

    expect(result).toMatchObject({
      items: [
        expect.objectContaining({
          id: 51,
          rate: expect.objectContaining({ id: 14, user_id: 6, item_type: RatingItemType.SERVICE, item_id: 51 }),
          user: expect.objectContaining({ id: 6, address: 'Cairo', rate: '4.50', avatar: null }),
        }),
      ],
      total: 1,
    });
  });

  it('lists admin services with filters and user information', async () => {
    databaseService.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ count: '1' }] })
      .mockResolvedValueOnce({
      rows: [
        {
          id: 61,
          user_id: 12,
          service_type: ServiceType.DESIGNING,
          description: 'Design living room',
          address: 'Giza',
          status: ServiceStatus.IN_PROGRESS,
          created_at: '2026-04-01T00:00:00.000Z',
          updated_at: '2026-04-01T00:00:00.000Z',
          user_name: 'Laila',
          user_email: 'laila@example.com',
          user_phone: '+201000000012',
        },
      ],
    })
      .mockResolvedValueOnce({
        rows: [{ id: 12, name: 'Laila', email: 'laila@example.com', phone: '+201000000012', address: 'Giza', status: 'active', rate: '4.00', contact_info: '+201000000012', avatar_file_id: null }],
      });

    const result = await service.adminListServices({
      serviceType: ServiceType.DESIGNING,
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      sortDirection: 'desc' as any,
      sortBy: 'createdAt' as any,
    });

    expect(result).toMatchObject({
      items: [
        expect.objectContaining({
          id: 61,
          user: expect.objectContaining({
            id: 12,
            name: 'Laila',
            email: 'laila@example.com',
            phone: '+201000000012',
            address: 'Giza',
            rate: '4.00',
            avatar: null,
          }),
        }),
      ],
    });

    const [queryText, params] = databaseService.query.mock.calls[1];
    expect(queryText).not.toContain('LEFT JOIN users u ON u.id = so.user_id');
    expect(queryText).toContain('so.service_type = $1');
    expect(queryText).toContain('so.created_at >= $2');
    expect(queryText).toContain("so.created_at < ($3::date + INTERVAL '1 day')");
    expect(queryText).toContain('ORDER BY so.created_at DESC, so.id DESC');
    expect(params).toEqual([ServiceType.DESIGNING, '2026-04-01', '2026-04-30', 20, 0]);
  });

  it('applies search and status filters in services list', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    await service.listMyServices(
      { sub: 6, phone: '+201000000006', isAdmin: false },
      {
        serviceType: ServiceType.MAINTENANCE,
        status: ServiceStatus.NOT_STARTED,
        search: 'AC',
        limit: 10,
        offset: 5,
      },
    );

    const [queryText, params] = databaseService.query.mock.calls[1];
    expect(queryText).toContain('so.status = $3');
    expect(queryText).toContain("so.description ILIKE $4 ESCAPE '\\'");
    expect(params).toEqual([6, ServiceType.MAINTENANCE, ServiceStatus.NOT_STARTED, '%AC%', 10, 5]);
  });

  it('scopes the general services list to the caller unless the caller is an admin', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    await service.publicListServices({ sub: 6, phone: '+201000000006', isAdmin: false }, {});

    expect(databaseService.query.mock.calls[0][0]).toContain('so.user_id = $1');
    expect(databaseService.query.mock.calls[1][0]).toContain('so.user_id = $1');

    databaseService.query.mockReset()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    await service.publicListServices({ sub: 1, phone: '+201000000001', isAdmin: true }, {});

    expect(databaseService.query.mock.calls[0][0]).not.toContain('so.user_id = $1');
    expect(databaseService.query.mock.calls[1][0]).not.toContain('so.user_id = $1');
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
      { itemType: RatingItemType.PRODUCT, itemId: 2, orderId: 6, ratingValue: 5 },
    );

    expect(result).toEqual({
      rating: expect.objectContaining({
        item_type: RatingItemType.PRODUCT,
        item_id: 2,
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
        { itemType: RatingItemType.PRODUCT, itemId: 2, orderId: 6, ratingValue: 5 },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns product reviews from product_ratings when itemType=product', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ count: '1' }] })
      .mockResolvedValueOnce({
        rows: [{
          id: 11,
          user_id: 4,
          item_type: RatingItemType.PRODUCT,
          item_id: 2,
          order_id: 6,
          product_id: 2,
          rating_value: 5,
          comment: 'Excellent',
          created_at: '2026-04-01T00:00:00.000Z',
        }],
      });

    const result = await service.getItemReviews(2, { itemType: RatingItemType.PRODUCT });

    expect(result).toEqual({
      items: [
        expect.objectContaining({
          item_type: RatingItemType.PRODUCT,
          item_id: 2,
          order_id: 6,
          product_id: 2,
        }),
      ],
      total: 1,
    });
    expect(databaseService.query.mock.calls[0][0]).toContain('FROM product_ratings');
    expect(databaseService.query.mock.calls[1][0]).toContain('FROM product_ratings');
  });

  it('admin item review lookup reuses the public product review query', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ count: '1' }] })
      .mockResolvedValueOnce({
        rows: [{
          id: 11,
          user_id: 4,
          item_type: RatingItemType.PRODUCT,
          item_id: 2,
          order_id: 6,
          product_id: 2,
          rating_value: 5,
          comment: 'Excellent',
          created_at: '2026-04-01T00:00:00.000Z',
        }],
      });

    const result = await service.adminGetItemReviews(2, { itemType: RatingItemType.PRODUCT });

    expect(result).toEqual({
      items: [expect.objectContaining({ item_type: RatingItemType.PRODUCT, item_id: 2 })],
      total: 1,
    });
  });

  it('admin item review lookup returns fault reviews from item_ratings', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ count: '1' }] })
      .mockResolvedValueOnce({
        rows: [{
          id: 12,
          user_id: 5,
          item_type: RatingItemType.FAULT,
          item_id: 44,
          rating_value: 4,
          comment: 'Handled well',
          created_at: '2026-04-02T00:00:00.000Z',
        }],
      });

    const result = await service.adminGetItemReviews(44, { itemType: RatingItemType.FAULT });

    expect(result).toEqual({
      items: [expect.objectContaining({ item_type: RatingItemType.FAULT, item_id: 44 })],
      total: 1,
    });
    expect(databaseService.query.mock.calls[0][0]).toContain('FROM item_ratings');
    expect(databaseService.query.mock.calls[1][0]).toContain('FROM item_ratings');
  });

  it('admin user review lookup returns only reviews on the user owned faults and services', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 7 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ count: '2' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 21,
            user_id: 9,
            item_type: RatingItemType.FAULT,
            item_id: 41,
            order_id: null,
            product_id: null,
            rating_value: 5,
            comment: 'Great follow-up',
            created_at: '2026-04-03T00:00:00.000Z',
          },
          {
            id: 22,
            user_id: 10,
            item_type: RatingItemType.SERVICE,
            item_id: 51,
            order_id: null,
            product_id: null,
            rating_value: 4,
            comment: 'Resolved',
            created_at: '2026-04-02T00:00:00.000Z',
          },
        ],
      });

    const result = await service.adminGetUserReceivedReviews(7, {});

    expect(result).toEqual({
      items: [
        expect.objectContaining({ item_type: RatingItemType.FAULT, item_id: 41 }),
        expect.objectContaining({ item_type: RatingItemType.SERVICE, item_id: 51 }),
      ],
      total: 2,
    });
    expect(databaseService.query.mock.calls[1][0]).toContain('fault_reports fr');
    expect(databaseService.query.mock.calls[1][0]).toContain('service_orders so');
  });

  it('admin user review lookup excludes product reviews and honors item type filters', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 7 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ count: '1' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 22,
            user_id: 10,
            item_type: RatingItemType.SERVICE,
            item_id: 51,
            order_id: null,
            product_id: null,
            rating_value: 4,
            comment: 'Resolved',
            created_at: '2026-04-02T00:00:00.000Z',
          },
        ],
      });

    const result = await service.adminGetUserReceivedReviews(7, { itemType: RatingItemType.SERVICE as any });

    expect(result).toEqual({
      items: [expect.objectContaining({ item_type: RatingItemType.SERVICE, item_id: 51 })],
      total: 1,
    });
    expect(databaseService.query.mock.calls[1][1]).toEqual([7, RatingItemType.SERVICE]);
  });

  it('admin user review lookup rejects unknown users', async () => {
    databaseService.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await expect(service.adminGetUserReceivedReviews(999, {})).rejects.toThrow('User not found');
  });

  it('admin global review list returns mixed product, fault, and service reviews', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ count: '3' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 11,
            user_id: 4,
            item_type: RatingItemType.PRODUCT,
            item_id: 2,
            order_id: 6,
            product_id: 2,
            rating_value: 5,
            comment: 'Excellent',
            created_at: '2026-04-05T00:00:00.000Z',
          },
          {
            id: 12,
            user_id: 5,
            item_type: RatingItemType.FAULT,
            item_id: 44,
            order_id: null,
            product_id: null,
            rating_value: 4,
            comment: 'Handled well',
            created_at: '2026-04-04T00:00:00.000Z',
          },
          {
            id: 13,
            user_id: 6,
            item_type: RatingItemType.SERVICE,
            item_id: 55,
            order_id: null,
            product_id: null,
            rating_value: 3,
            comment: 'Okay',
            created_at: '2026-04-03T00:00:00.000Z',
          },
        ],
      });

    const result = await service.adminListRatings({});

    expect(result).toEqual({
      items: [
        expect.objectContaining({ item_type: RatingItemType.PRODUCT, order_id: 6, product_id: 2 }),
        expect.objectContaining({ item_type: RatingItemType.FAULT }),
        expect.objectContaining({ item_type: RatingItemType.SERVICE }),
      ],
      total: 3,
    });
    expect(databaseService.query.mock.calls[0][0]).toContain('UNION ALL');
    expect(databaseService.query.mock.calls[1][0]).toContain('ORDER BY r.created_at DESC, r.id DESC');
  });

  it('admin global review list applies filters and pagination', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [] });

    await service.adminListRatings({
      itemType: RatingItemType.FAULT,
      userId: 5,
      ratingValue: 4,
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      search: 'handled',
      limit: 10,
      offset: 20,
    });

    const [countQuery, countParams] = databaseService.query.mock.calls[0];
    const [listQuery, listParams] = databaseService.query.mock.calls[1];
    expect(countQuery).toContain('r.item_type = $1');
    expect(countQuery).toContain('r.user_id = $2');
    expect(countQuery).toContain('r.rating_value = $3');
    expect(countQuery).toContain('r.created_at >= $4::date');
    expect(countQuery).toContain("r.created_at < ($5::date + INTERVAL '1 day')");
    expect(countQuery).toContain("COALESCE(r.comment, '') ILIKE $6 ESCAPE '\\'");
    expect(countParams).toEqual([RatingItemType.FAULT, 5, 4, '2026-04-01', '2026-04-30', '%handled%']);
    expect(listQuery).toContain('LIMIT $7 OFFSET $8');
    expect(listParams).toEqual([RatingItemType.FAULT, 5, 4, '2026-04-01', '2026-04-30', '%handled%', 10, 20]);
  });

  it('admin global review list returns empty items with zero total', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await service.adminListRatings({ itemType: RatingItemType.SERVICE });

    expect(result).toEqual({ items: [], total: 0 });
  });

  it('rejects service rating before service is finished', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 7 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ status: ServiceStatus.IN_PROGRESS }] });

    await expect(
      service.createItemRating(
        { sub: 7, phone: '+201000000007', isAdmin: false },
        { itemType: RatingItemType.SERVICE, itemId: 77, ratingValue: 5 },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects duplicate service ratings', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 7 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ status: ServiceStatus.FINISHED }] })
      .mockRejectedValueOnce({ code: '23505' });

    await expect(
      service.createItemRating(
        { sub: 7, phone: '+201000000007', isAdmin: false },
        { itemType: RatingItemType.SERVICE, itemId: 77, ratingValue: 5 },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('blocks service update after processing starts', async () => {
    databaseService.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ status: ServiceStatus.IN_PROGRESS }],
    });

    await expect(
      service.updateService(
        { sub: 9, phone: '+201000000009', isAdmin: false },
        88,
        { description: 'Updated description' },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('blocks service cancel after processing starts', async () => {
    databaseService.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ status: ServiceStatus.IN_PROGRESS }],
    });

    await expect(
      service.cancelService(
        { sub: 9, phone: '+201000000009', isAdmin: false },
        89,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('lists my faults with filters, severity sorting, and assets', async () => {
    databaseService.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 31,
            user_id: 5,
            title: 'Leak',
            description: 'Ceiling leak',
            severity: 'urgent',
            address: 'Cairo',
            status: 'assigned',
            cancelled_at: null,
            created_at: '2026-02-01T00:00:00.000Z',
            updated_at: '2026-02-01T00:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            fault_id: 31,
            file_id: 901,
            sort_order: 0,
            object_key: 'faults/31/a.jpg',
            original_filename: 'a.jpg',
            mime_type: 'image/jpeg',
            status: 'uploaded',
          },
        ],
      });

    const result = await service.listMyFaults(
      { sub: 5, phone: '+201000000005', isAdmin: false },
      { status: FaultStatus.ASSIGNED, severity: 'urgent' as any, fromDate: '2026-01-01', sortBy: 'severity' as any, sortDirection: 'asc' as any },
    );

    expect(result).toMatchObject({
      items: [
        expect.objectContaining({
          id: 31,
          severity: 'urgent',
          images: [expect.objectContaining({ file_id: 901 })],
        }),
      ],
    });
    const [queryText, params] = databaseService.query.mock.calls[0];
    expect(queryText).toContain('fr.status = $2');
    expect(queryText).toContain('fr.severity = $3');
    expect(queryText).toContain('fr.created_at >= $4');
    expect(queryText).toContain("WHEN 'normal' THEN 1");
    expect(queryText).toContain('END ASC');
    expect(queryText).toContain('LIMIT $5 OFFSET $6');
    expect(params).toEqual([5, FaultStatus.ASSIGNED, 'urgent', '2026-01-01', 20, 0]);
  });

  it('gets a fault with the current user rate object when already rated', async () => {
    databaseService.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id: 42,
          user_id: 7,
          title: 'Road issue',
          description: 'Pothole',
          severity: 'normal',
          address: 'Nasr City',
          status: FaultStatus.FINISHED,
          cancelled_at: null,
          created_at: '2026-03-05T00:00:00.000Z',
          updated_at: '2026-03-06T00:00:00.000Z',
          user_name: 'User',
          user_email: 'user@example.com',
          user_phone: '+201000000007',
          rate: { id: 15, user_id: 7, item_type: RatingItemType.FAULT, item_id: 42, rating_value: 4 },
        }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const result = await service.getFaultForUser(7, 42, false);

    expect(result).toMatchObject({
      fault: expect.objectContaining({
        id: 42,
        rate: expect.objectContaining({ id: 15, user_id: 7, item_type: RatingItemType.FAULT, item_id: 42 }),
      }),
    });
  });

  it('gets a service with null rate when the current user has not rated it', async () => {
    databaseService.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        id: 52,
        user_id: 6,
        service_type: ServiceType.MAINTENANCE,
        description: 'Fix AC',
        address: 'Cairo',
        status: ServiceStatus.FINISHED,
        cancelled_at: null,
        created_at: '2026-03-01T00:00:00.000Z',
        updated_at: '2026-03-01T00:00:00.000Z',
        rate: null,
      }],
    });

    const result = await service.getServiceForUser(6, 52, false);

    expect(result).toMatchObject({
      service: expect.objectContaining({
        id: 52,
        rate: null,
      }),
    });
  });

  it('enriches admin fault list with user and images', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ count: '1' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 41,
            user_id: 11,
            title: 'No power',
            description: 'Street outage',
            severity: 'high',
            address: 'Giza',
            status: 'received',
            cancelled_at: null,
            created_at: '2026-03-01T00:00:00.000Z',
            updated_at: '2026-03-01T00:00:00.000Z',
            user_name: 'Mona',
            user_email: 'mona@example.com',
            user_phone: '+201000000011',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ fault_id: 41, file_id: 902, sort_order: 0, object_key: 'faults/41/a.jpg', original_filename: 'a.jpg', mime_type: 'image/jpeg', status: 'uploaded' }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 11, name: 'Mona', email: 'mona@example.com', phone: '+201000000011', address: 'Giza', status: 'active', rate: '4.25', contact_info: '+201000000011', avatar_file_id: null }],
      });

    const result = await service.adminListFaults();
    expect(result).toMatchObject({
      items: [
        expect.objectContaining({
          id: 41,
          user: expect.objectContaining({ id: 11, name: 'Mona', address: 'Giza', rate: '4.25', avatar: null }),
          images: [expect.objectContaining({ file_id: 902 })],
        }),
      ],
    });
  });

  it('rejects invalid admin fault status transitions', async () => {
    databaseService.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ status: FaultStatus.RECEIVED }] });
    await expect(
      service.adminUpdateFaultStatus(
        { sub: 1, phone: '+201000000001', isAdmin: true },
        42,
        { status: FaultStatus.FINISHED },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts valid admin fault status transition and records history', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ status: FaultStatus.RECEIVED }] }) // current
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 42 }] }) // update status
      .mockResolvedValueOnce({ rowCount: 1, rows: [] }) // insert history
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id: 42,
          user_id: 7,
          title: 'Road issue',
          description: 'Pothole',
          severity: 'normal',
          address: 'Nasr City',
          status: 'assigned',
          cancelled_at: null,
          created_at: '2026-03-05T00:00:00.000Z',
          updated_at: '2026-03-06T00:00:00.000Z',
        }],
      }) // getFaultForUser
      .mockResolvedValueOnce({ rows: [] }); // attachFaultAssets

    const result = await service.adminUpdateFaultStatus(
      { sub: 1, phone: '+201000000001', isAdmin: true },
      42,
      { status: FaultStatus.ASSIGNED },
    );
    expect(result).toEqual({
      fault: expect.objectContaining({ id: 42, status: 'assigned' }),
    });
  });

  it('rejects invalid fault image files on create', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ id: 777 }] }) // insert fault
        .mockResolvedValueOnce({ rows: [{ id: 10, purpose: 'document', status: 'uploaded', mime_type: 'application/pdf' }] }), // files check
    };
    databaseService.withTransaction.mockImplementationOnce((callback: any) => callback(client));

    await expect(
      service.createFault(
        { sub: 2, phone: '+201000000002', isAdmin: false },
        { title: 'Broken tile', description: 'Kitchen', severity: 'normal' as any, address: 'Maadi', imageFileIds: [10] },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('regression: create fault uses transaction visibility for read-back', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ id: 778 }] }) // insert fault
        .mockResolvedValueOnce({ rowCount: 1, rows: [] }) // delete fault assets
        .mockResolvedValueOnce({ rowCount: 1, rows: [] }) // insert status history
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{
            id: 778,
            user_id: 2,
            title: 'Leak',
            description: 'Bathroom leak',
            severity: 'normal',
            address: 'Cairo',
            status: 'received',
            cancelled_at: null,
            created_at: '2026-05-01T00:00:00.000Z',
            updated_at: '2026-05-01T00:00:00.000Z',
          }],
        }) // select fault in tx
        .mockResolvedValueOnce({ rows: [] }), // fault assets in tx
    };
    databaseService.withTransaction.mockImplementationOnce((callback: any) => callback(client));

    const result = await service.createFault(
      { sub: 2, phone: '+201000000002', isAdmin: false },
      { title: 'Leak', description: 'Bathroom leak', severity: 'normal' as any, address: 'Cairo', imageFileIds: [] },
    );

    expect(result).toEqual({
      fault: expect.objectContaining({
        id: 778,
        status: 'received',
        images: [],
      }),
    });
    expect(databaseService.query).not.toHaveBeenCalled();
  });

  it('regression: update fault uses transaction visibility for read-back', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ status: 'received' }] }) // select current
        .mockResolvedValueOnce({ rowCount: 1, rows: [] }) // update fault
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{
            id: 779,
            user_id: 2,
            title: 'Leak updated',
            description: 'Updated desc',
            severity: 'high',
            address: 'Giza',
            status: 'received',
            cancelled_at: null,
            created_at: '2026-05-02T00:00:00.000Z',
            updated_at: '2026-05-02T01:00:00.000Z',
          }],
        }) // select updated fault in tx
        .mockResolvedValueOnce({ rows: [] }), // fault assets in tx
    };
    databaseService.withTransaction.mockImplementationOnce((callback: any) => callback(client));

    const result = await service.updateFault(
      { sub: 2, phone: '+201000000002', isAdmin: false },
      779,
      { title: 'Leak updated', description: 'Updated desc', severity: 'high' as any, address: 'Giza' },
    );

    expect(result).toEqual({
      fault: expect.objectContaining({
        id: 779,
        title: 'Leak updated',
        images: [],
      }),
    });
    expect(databaseService.query).not.toHaveBeenCalled();
  });

  it('getFaultForUser returns not found for missing fault', async () => {
    databaseService.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    await expect(service.getFaultForUser(2, 999999, false)).rejects.toThrow('Fault not found');
  });

  it('lists followup steps for item owner ordered by sort_order then id', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 7 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ count: '1' }] })
      .mockResolvedValueOnce({
        rows: [
          { id: 2, item_type: 'order', item_id: 50, title: 'Delivered', state: false, sort_order: 1, created_at: '2026-05-01T00:00:00.000Z' },
          { id: 3, item_type: 'order', item_id: 50, title: 'Installed', state: true, sort_order: 2, created_at: '2026-05-01T01:00:00.000Z' },
        ],
      });

    const result = await service.listFollowupSteps(
      { sub: 7, phone: '+201000000007', isAdmin: false },
      ItemType.ORDER,
      50,
    );

    expect(result).toMatchObject({
      items: [
        expect.objectContaining({ id: 2, state: false, sort_order: 1 }),
        expect.objectContaining({ id: 3, state: true, sort_order: 2 }),
      ],
    });
    expect(databaseService.query.mock.calls[2][0]).toContain('ORDER BY sort_order ASC, id ASC');
  });

  it('rejects followup steps listing for non-owner user', async () => {
    databaseService.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 9 }] });

    await expect(
      service.listFollowupSteps(
        { sub: 7, phone: '+201000000007', isAdmin: false },
        ItemType.ORDER,
        50,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects followup steps listing when item does not exist even for admin', async () => {
    databaseService.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await expect(
      service.listFollowupSteps(
        { sub: 1, phone: '+201000000001', isAdmin: true },
        ItemType.ORDER,
        999,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates followup step for valid item', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 7 }] })
      .mockResolvedValueOnce({
        rows: [{ id: 70, item_type: 'order', item_id: 50, title: 'Packed', step_image_file_id: 11, state: false, sort_order: 0 }],
      });

    const result = await service.adminCreateFollowupStep(
      { sub: 1, phone: '+201000000001', isAdmin: true },
      { itemType: ItemType.ORDER, itemId: 50, title: 'Packed', stepImageFileId: 11 },
    );

    expect(result).toEqual({
      step: expect.objectContaining({ id: 70, title: 'Packed', state: false }),
    });
  });

  it('creates followup step with explicit state', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 7 }] })
      .mockResolvedValueOnce({
        rows: [{ id: 71, item_type: 'order', item_id: 50, title: 'Packed', step_image_file_id: null, state: true, sort_order: 0 }],
      });

    const result = await service.adminCreateFollowupStep(
      { sub: 1, phone: '+201000000001', isAdmin: true },
      { itemType: ItemType.ORDER, itemId: 50, title: 'Packed', state: true },
    );

    expect(result).toEqual({
      step: expect.objectContaining({ id: 71, state: true }),
    });
  });

  it('creates followup step with explicit false state', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 7 }] })
      .mockResolvedValueOnce({
        rows: [{ id: 72, item_type: 'order', item_id: 50, title: 'Queued', step_image_file_id: null, state: false, sort_order: 3 }],
      });

    const result = await service.adminCreateFollowupStep(
      { sub: 1, phone: '+201000000001', isAdmin: true },
      { itemType: ItemType.ORDER, itemId: 50, title: 'Queued', state: false, sortOrder: 3 },
    );

    expect(result).toEqual({
      step: expect.objectContaining({ id: 72, state: false, sort_order: 3 }),
    });
  });

  it('updates followup step state without changing other fields', async () => {
    databaseService.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: 70, item_type: 'order', item_id: 50, title: 'Packed', step_image_file_id: 11, state: true, sort_order: 0 }],
    });

    const result = await service.adminUpdateFollowupStep(70, { state: true });

    expect(result).toEqual({
      step: expect.objectContaining({ id: 70, state: true }),
    });
    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining('state = COALESCE($4,state)'),
      [null, null, null, true, 70],
    );
  });

  it('leaves followup step state unchanged when omitted on update', async () => {
    databaseService.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: 70, item_type: 'order', item_id: 50, title: 'Packed updated', step_image_file_id: 11, state: false, sort_order: 1 }],
    });

    const result = await service.adminUpdateFollowupStep(70, { title: 'Packed updated' });

    expect(result).toEqual({
      step: expect.objectContaining({ id: 70, title: 'Packed updated', state: false }),
    });
    expect(databaseService.query).toHaveBeenCalledWith(
      expect.any(String),
      ['Packed updated', null, null, null, 70],
    );
  });

  it('rejects followup step creation when target item is missing', async () => {
    databaseService.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await expect(
      service.adminCreateFollowupStep(
        { sub: 1, phone: '+201000000001', isAdmin: true },
        { itemType: ItemType.ORDER, itemId: 404, title: 'Packed' },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates followup conversation with fallback admin when requester owns item', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 7 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 2 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 2 }] })
      .mockResolvedValueOnce({ rows: [{ id: 81, item_type: 'order', item_id: 50, user_id: 7, admin_id: 2 }] });

    const result = await service.createFollowupConversation(
      { sub: 7, phone: '+201000000007', isAdmin: false },
      { itemType: ItemType.ORDER, itemId: 50 },
    );

    expect(result).toEqual({
      conversation: expect.objectContaining({ id: 81, admin_id: 2 }),
    });
  });

  it('rejects followup conversation when provided adminId is not an active admin', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 7 }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await expect(
      service.createFollowupConversation(
        { sub: 7, phone: '+201000000007', isAdmin: false },
        { itemType: ItemType.ORDER, itemId: 50, adminId: 77 },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects followup conversation when no admin account is available', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 7 }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await expect(
      service.createFollowupConversation(
        { sub: 7, phone: '+201000000007', isAdmin: false },
        { itemType: ItemType.ORDER, itemId: 50 },
      ),
    ).rejects.toThrow('No admin account available');
  });

  it('lists followup messages only for participants', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 7, admin_id: 2 }] })
      .mockResolvedValueOnce({ rows: [{ id: 1, conversation_id: 81, sender_id: 7, message_text: 'Ping', sent_at: '2026-05-01T10:00:00.000Z' }] });

    const result = await service.listFollowupMessages(
      { sub: 7, phone: '+201000000007', isAdmin: false },
      81,
    );

    expect(result).toMatchObject({
      items: [expect.objectContaining({ id: 1, message_text: 'Ping' })],
    });
  });

  it('rejects sending followup messages for non-participants', async () => {
    databaseService.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 7, admin_id: 2 }] });

    await expect(
      service.sendFollowupMessage(
        { sub: 99, phone: '+201000000099', isAdmin: false },
        81,
        { messageText: 'Ping' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects listing followup messages when route item scope does not match conversation scope', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 7, admin_id: 2 }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await expect(
      service.listFollowupMessages(
        { sub: 7, phone: '+201000000007', isAdmin: false },
        81,
        ItemType.ORDER,
        500,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects sending followup message when route item scope does not match conversation scope', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 7, admin_id: 2 }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await expect(
      service.sendFollowupMessage(
        { sub: 7, phone: '+201000000007', isAdmin: false },
        81,
        { messageText: 'Ping' },
        ItemType.ORDER,
        500,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists public gallery items as active-only with rich images', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ count: '1' }] })
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

    expect(result).toMatchObject({
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
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ count: '1' }] })
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

    expect(result).toMatchObject({
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
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 12 }] })
      .mockResolvedValueOnce({ rows: [] });

    const deletion = await service.adminDeleteGalleryItem(
      { sub: 1, phone: '+201000000001', isAdmin: true },
      12,
    );
    const listed = await service.listGallery();

    expect(deletion).toEqual({ message: 'Gallery item deleted' });
    expect(listed).toMatchObject({
      items: [] });
    expect(databaseService.query.mock.calls[0][0]).toContain('SET deleted_at = NOW()');
  });
});
