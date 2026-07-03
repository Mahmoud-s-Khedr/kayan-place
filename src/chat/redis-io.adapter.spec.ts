import { IoAdapter } from '@nestjs/platform-socket.io';
import { RedisIoAdapter } from './redis-io.adapter';

describe('RedisIoAdapter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('passes multiple explicit origins with credentials enabled', () => {
    const server = { adapter: jest.fn() };
    const createIOServerSpy = jest.spyOn(IoAdapter.prototype as any, 'createIOServer').mockReturnValue(server);
    const adapter = new RedisIoAdapter({} as any, ['https://a.com', 'https://b.com']);

    adapter.createIOServer(3000);

    expect(createIOServerSpy).toHaveBeenCalledWith(3000, expect.objectContaining({
      cors: {
        origin: expect.any(Function),
        credentials: true,
      },
    }));
  });

  it('matches localhost and 127.0.0.1 aliases in websocket CORS', () => {
    const server = { adapter: jest.fn() };
    const createIOServerSpy = jest.spyOn(IoAdapter.prototype as any, 'createIOServer').mockReturnValue(server);
    const adapter = new RedisIoAdapter({} as any, ['http://localhost:8080']);

    adapter.createIOServer(3000);

    const callOptions = createIOServerSpy.mock.calls[0][1] as {
      cors?: { origin?: unknown } | boolean;
    } | undefined;
    const originMatcher = callOptions?.cors && typeof callOptions.cors !== 'boolean' ? callOptions.cors.origin : undefined;

    expect(originMatcher).toEqual(expect.any(Function));

    const callback = jest.fn();
    (originMatcher as (origin: string, callback: (error: Error | null, allow?: boolean) => void) => void)(
      'http://127.0.0.1:8080',
      callback,
    );

    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('uses wildcard-compatible CORS for websocket server', () => {
    const server = { adapter: jest.fn() };
    const createIOServerSpy = jest.spyOn(IoAdapter.prototype as any, 'createIOServer').mockReturnValue(server);
    const adapter = new RedisIoAdapter({} as any, ['*']);

    adapter.createIOServer(3000);

    expect(createIOServerSpy).toHaveBeenCalledWith(3000, expect.objectContaining({
      cors: {
        origin: true,
        credentials: false,
      },
    }));
  });
});
