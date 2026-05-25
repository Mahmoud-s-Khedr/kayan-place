import { parseAdminSeedInput, seedAdminUser } from './admin-seeder';

describe('admin-seeder', () => {
  it('parses valid env input with email and phone', () => {
    const input = parseAdminSeedInput({
      ADMIN_EMAIL: 'Admin@example.com',
      ADMIN_PHONE: '+201000000000',
      ADMIN_PASSWORD: 'Secret123',
    });

    expect(input).toEqual({ email: 'admin@example.com', phone: '+201000000000', password: 'Secret123' });
  });

  it('accepts email with no phone for backward-compatible environments', () => {
    const input = parseAdminSeedInput({
      ADMIN_EMAIL: 'Admin@example.com',
      ADMIN_PASSWORD: 'Secret123',
    });

    expect(input).toEqual({ email: 'admin@example.com', phone: null, password: 'Secret123' });
  });

  it('throws for invalid env input', () => {
    expect(() =>
      parseAdminSeedInput({
        ADMIN_EMAIL: 'bad-email',
        ADMIN_PHONE: 'invalid',
        ADMIN_PASSWORD: 'short',
      }),
    ).toThrow('ADMIN_EMAIL must be a valid email address');
  });

  it('creates missing admin and returns created=true', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1, email: 'admin@example.com', phone: '+201000000000' }] });

    const result = await seedAdminUser({ query } as any, { email: 'admin@example.com', phone: '+201000000000' }, 'hash');

    expect(result).toEqual({ id: 1, email: 'admin@example.com', phone: '+201000000000', created: true });
  });

  it('updates existing user and returns created=false', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 2, email: 'admin@example.com', phone: '+201000000000' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 2, email: 'admin@example.com', phone: '+201000000000' }] });

    const result = await seedAdminUser({ query } as any, { email: 'admin@example.com', phone: '+201000000000' }, 'hash');

    expect(result).toEqual({ id: 2, email: 'admin@example.com', phone: '+201000000000', created: false });
  });

  it('throws when multiple users match email/phone', async () => {
    const query = jest.fn().mockResolvedValueOnce({
      rowCount: 2,
      rows: [{ id: 2, email: 'admin@example.com', phone: '+201000000000' }, { id: 3, email: 'admin2@example.com', phone: '+201000000000' }],
    });

    await expect(
      seedAdminUser({ query } as any, { email: 'admin@example.com', phone: '+201000000000' }, 'hash'),
    ).rejects.toThrow('Seed conflict: multiple users matched ADMIN_EMAIL/ADMIN_PHONE');
  });

  it('throws when phone belongs to another user', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 8 }] });

    await expect(
      seedAdminUser({ query } as any, { email: 'admin@example.com', phone: '+201000000000' }, 'hash'),
    ).rejects.toThrow('Seed conflict: ADMIN_PHONE belongs to another user');
  });

  it('updates by email when phone is omitted', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 2, email: 'admin@example.com', phone: null }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 2, email: 'admin@example.com', phone: null }] });

    const result = await seedAdminUser({ query } as any, { email: 'admin@example.com', phone: null }, 'hash');

    expect(result).toEqual({ id: 2, email: 'admin@example.com', phone: null, created: false });
  });
});
