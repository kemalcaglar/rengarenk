import { HttpException, HttpStatus, Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ENV, type Env } from '../config/env.js';

/**
 * Sabit pencereli hız sınırı (Redis). Anahtar başına pencere içinde en fazla `limit` istek.
 * Redis'e ulaşılamazsa isteği engellemez (giriş akışı Redis yüzünden durmasın), uyarı yazar.
 */
@Injectable()
export class RateLimiter implements OnModuleDestroy {
  private readonly redis: Redis;
  constructor(@Inject(ENV) env: Env) {
    this.redis = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    this.redis.on('error', () => {});
  }

  /** Sınır aşıldıysa 429 fırlatır. */
  async hit(key: string, limit: number, windowSeconds: number): Promise<void> {
    let count: number;
    try {
      if (this.redis.status === 'wait') await this.redis.connect();
      const k = `rl:${key}:${Math.floor(Date.now() / 1000 / windowSeconds)}`;
      const r = await this.redis.multi().incr(k).expire(k, windowSeconds).exec();
      count = Number(r?.[0]?.[1] ?? 0);
    } catch {
      return;
    }
    if (count > limit) {
      throw new HttpException('Çok fazla istek, biraz sonra tekrar dene', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  async onModuleDestroy() {
    this.redis.disconnect();
  }
}
