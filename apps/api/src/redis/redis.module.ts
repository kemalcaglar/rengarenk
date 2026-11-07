import { Global, Inject, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ENV, type Env } from '../config/env.js';

export const REDIS = Symbol('REDIS');

/**
 * Önbellek için ortak Redis bağlantısı. Redis'e ulaşılamazsa komutlar hemen hata verir (kuyrukta
 * beklemez); kullanan kod veritabanına düşer.
 */
@Injectable()
class RedisLifecycle implements OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}
  onModuleDestroy() {
    this.redis.disconnect();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ENV],
      useFactory: (env: Env) => {
        const r = new Redis(env.REDIS_URL, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
        });
        r.on('error', () => {});
        return r;
      },
    },
    RedisLifecycle,
  ],
  exports: [REDIS],
})
export class RedisModule {}

/** Bağlantı kurulmamışsa kurar; Redis yoksa hata fırlatır. */
export async function ready(r: Redis): Promise<Redis> {
  if (r.status === 'wait') await r.connect();
  return r;
}
