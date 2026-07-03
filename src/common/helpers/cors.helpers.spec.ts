import { buildSharedCorsOptions } from './cors.helpers';

describe('buildSharedCorsOptions', () => {
  it('returns null when no origins are configured', () => {
    expect(buildSharedCorsOptions([])).toBeNull();
  });

  it('supports multiple explicit origins with credentials', () => {
    expect(buildSharedCorsOptions(['https://a.com', 'https://b.com'])).toEqual({
      origin: ['https://a.com', 'https://b.com'],
      credentials: true,
    });
  });

  it('uses permissive origin and disables credentials for wildcard', () => {
    expect(buildSharedCorsOptions(['*'])).toEqual({
      origin: true,
      credentials: false,
    });
  });
});
