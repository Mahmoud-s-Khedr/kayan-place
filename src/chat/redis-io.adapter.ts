import { INestApplication, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { ServerOptions } from 'socket.io';
import { buildSharedCorsOptions } from '../common/helpers/cors.helpers';

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  constructor(
    app: INestApplication,
    private readonly corsOrigins: string[],
  ) {
    super(app);
  }

  async connectToRedis(redisUrl: string): Promise<boolean> {
    const pubClient = new Redis(redisUrl, {
      lazyConnect: true,
      enableReadyCheck: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 1000,
      retryStrategy: () => null,
    });
    const subClient = pubClient.duplicate();

    try {
      await pubClient.connect();
      await subClient.connect();
      this.adapterConstructor = createAdapter(pubClient, subClient);
      this.logger.log('Redis Socket.io adapter connected');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis Socket.io adapter unavailable (${message}); continuing without Redis adapter`);
      pubClient.disconnect(false);
      subClient.disconnect(false);
      this.adapterConstructor = undefined;
      return false;
    }
  }

  createIOServer(port: number, options?: ServerOptions) {
    const corsOptions = buildSharedCorsOptions(this.corsOrigins);
    const server = super.createIOServer(port, {
      ...options,
      cors: corsOptions ?? false,
    });
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
