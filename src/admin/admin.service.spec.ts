import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  const databaseService = {
    query: jest.fn(),
  };

  const redisService = {
    del: jest.fn().mockResolvedValue(undefined),
  };

  const service = new AdminService(databaseService as any, redisService as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects warning creation when target user does not exist', async () => {
    databaseService.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await expect(
      service.createWarning(
        { sub: 1, phone: '+201000000001', isAdmin: true },
        { targetUserId: 99, message: 'warning text' },
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('lists users with published products count', async () => {
    databaseService.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        id: 12,
        name: 'Counted User',
        phone: '+201000000012',
        status: 'active',
        is_admin: false,
        published_products_count: 7,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      }],
    });

    const result = await service.listUsers({ limit: 20, offset: 0 });

    expect(result).toEqual({
      users: [{
        id: 12,
        name: 'Counted User',
        phone: '+201000000012',
        email: '',
        profileState: 'active',
        is_admin: false,
        published_products_count: 7,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      }],
    });
  });

  it('defaults listUsers counts to zero', async () => {
    databaseService.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        id: 13,
        name: 'Zero Counts User',
        phone: '+201000000013',
        status: 'active',
        is_admin: false,
        published_products_count: null,
        created_at: '2026-01-03T00:00:00.000Z',
        updated_at: '2026-01-04T00:00:00.000Z',
      }],
    });

    const result = await service.listUsers({});

    expect(result).toEqual({
      users: [{
        id: 13,
        name: 'Zero Counts User',
        phone: '+201000000013',
        email: '',
        profileState: 'active',
        is_admin: false,
        published_products_count: 0,
        created_at: '2026-01-03T00:00:00.000Z',
        updated_at: '2026-01-04T00:00:00.000Z',
      }],
    });
  });

  it('lists admins only', async () => {
    databaseService.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        id: 2,
        name: 'Admin',
        phone: '+201000000002',
        status: 'active',
        is_admin: true,
        created_at: '2026-01-05T00:00:00.000Z',
        updated_at: '2026-01-06T00:00:00.000Z',
      }],
    });

    const result = await service.listAdmins({});

    expect(result).toEqual({
      admins: [{ id: 2, name: 'Admin', phone: '+201000000002', email: '', profileState: 'active', is_admin: true, created_at: '2026-01-05T00:00:00.000Z', updated_at: '2026-01-06T00:00:00.000Z' }],
    });
  });

  it('promotes a regular user to admin', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 7, is_admin: false }] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id: 7,
          name: 'User',
          phone: '+201000000007',
          status: 'active',
          is_admin: true,
          token_version: 1,
          created_at: '2026-01-07T00:00:00.000Z',
          updated_at: '2026-01-08T00:00:00.000Z',
        }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const result = await service.promoteAdmin(
      { sub: 1, phone: '+201000000001', isAdmin: true },
      7,
    );

    expect(result).toEqual({
      user: {
        id: 7,
        name: 'User',
        phone: '+201000000007',
        email: '',
        profileState: 'active',
        is_admin: true,
        token_version: 1,
        created_at: '2026-01-07T00:00:00.000Z',
        updated_at: '2026-01-08T00:00:00.000Z',
      },
    });
  });

  it('rejects promote when user is already admin', async () => {
    databaseService.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 7, is_admin: true }] });

    await expect(
      service.promoteAdmin({ sub: 1, phone: '+201000000001', isAdmin: true }, 7),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects demote for self-demotion', async () => {
    await expect(
      service.demoteAdmin({ sub: 1, phone: '+201000000001', isAdmin: true }, 1),
    ).rejects.toThrow(BadRequestException);
  });

  it('demotes another admin', async () => {
    databaseService.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 8, is_admin: true }] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id: 8,
          name: 'Other Admin',
          phone: '+201000000008',
          status: 'active',
          is_admin: false,
          token_version: 4,
          created_at: '2026-01-09T00:00:00.000Z',
          updated_at: '2026-01-10T00:00:00.000Z',
        }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const result = await service.demoteAdmin(
      { sub: 1, phone: '+201000000001', isAdmin: true },
      8,
    );

    expect(result).toEqual({
      user: {
        id: 8,
        name: 'Other Admin',
        phone: '+201000000008',
        email: '',
        profileState: 'active',
        is_admin: false,
        token_version: 4,
        created_at: '2026-01-09T00:00:00.000Z',
        updated_at: '2026-01-10T00:00:00.000Z',
      },
    });
  });

  it('gets user details for admin moderation view', async () => {
    databaseService.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        id: 5,
        name: 'Target User',
        phone: '+201000000005',
        status: 'active',
        is_admin: false,
        avatar_file_id: 10,
        contact_info: '+201000000005',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      }],
    });

    const result = await service.getUserDetails(5);
    expect(result).toEqual({
      user: {
        id: 5,
        name: 'Target User',
        phone: '+201000000005',
        email: '',
        profileState: 'active',
        status: 'active',
        avatar_file_id: 10,
        contactInfo: '+201000000005',
        is_admin: false,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      },
    });
  });

});
