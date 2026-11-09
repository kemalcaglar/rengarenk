import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { type Db, PRISMA } from '../database/prisma.js';
import { REDIS, ready } from '../redis/redis.module.js';

/** Botlar, tarayıcı önizlemeleri ve başsız tarayıcılar sayılmaz */
const BOT = /bot|crawl|spider|slurp|headless|preview|lighthouse|monitor|curl|wget|python|java\//i;
const SAKLA_SN = 3 * 86_400;
const DAY = 86_400_000;

/** İstanbul günü ("2026-11-10") */
export const trGun = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(d);
const gunTarihi = (gun: string) => new Date(`${gun}T00:00:00.000Z`);

/**
 * Web analitiği ve arama günlüğü (Raporlar › Huni, En çok aranan modeller; Karar 44). Çerez ve kalıcı kimlik yoktur:
 * ziyaretçi, IP ve tarayıcı bilgisinin o güne özgü rastgele tuzla özetidir; tuz ertesi gün Redis'ten kendiliğinden
 * silinir, özetler yalnızca sayılır (HyperLogLog). Veritabanına yalnızca günlük sayılar yazılır (işçi beş dakikada bir).
 * Aynı kişinin aynı gün aynı modeli araması bir kez sayılır. Redis yoksa hiçbir şey sayılmaz.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Optional() @Inject(REDIS) private readonly redis?: Redis,
  ) {}

  private async kisi(r: Redis, gun: string, ip: string, ua: string) {
    const anahtar = `analitik:tuz:${gun}`;
    await r.set(anahtar, randomBytes(16).toString('hex'), 'EX', 2 * 86_400, 'NX');
    const tuz = await r.get(anahtar);
    return createHash('sha256').update(`${tuz}|${ip}|${ua}`).digest('base64url').slice(0, 22);
  }

  private async baglan(ip?: string, ua?: string): Promise<{ r: Redis; ip: string; ua: string } | null> {
    if (!this.redis || !ip || !ua || BOT.test(ua)) return null;
    try {
      return { r: await ready(this.redis), ip, ua };
    } catch {
      return null;
    }
  }

  /** Web sayfası görüntülendi (istemci yön değişiminde bildirir) */
  async ziyaret(ip?: string, ua?: string, now = new Date()) {
    const b = await this.baglan(ip, ua);
    if (!b) return false;
    const gun = trGun(now);
    try {
      const k = await this.kisi(b.r, gun, b.ip, b.ua);
      await b.r
        .multi()
        .pfadd(`analitik:ziyaretci:${gun}`, k)
        .expire(`analitik:ziyaretci:${gun}`, SAKLA_SN)
        .incr(`analitik:sayfa:${gun}`)
        .expire(`analitik:sayfa:${gun}`, SAKLA_SN)
        .exec();
      return true;
    } catch {
      return false;
    }
  }

  /** Talep araması: marka (ve seri) seçili ya da metinden bulunmuşsa sayılır */
  async arama(model: { make: string; series?: string[] } | null, ip?: string, ua?: string, now = new Date()) {
    if (!model?.make) return 0;
    const b = await this.baglan(ip, ua);
    if (!b) return 0;
    const gun = trGun(now);
    const alanlar = (model.series?.length ? model.series : ['']).map((s) => `${model.make}|${s}`);
    try {
      const k = await this.kisi(b.r, gun, b.ip, b.ua);
      let n = 0;
      for (const alan of alanlar) {
        const yeni = await b.r.set(`analitik:arayan:${gun}:${k}:${alan}`, '1', 'EX', 86_400, 'NX');
        if (yeni !== 'OK') continue;
        await b.r
          .multi()
          .hincrby(`analitik:arama:${gun}`, alan, 1)
          .expire(`analitik:arama:${gun}`, SAKLA_SN)
          .exec();
        n++;
      }
      return n;
    } catch {
      return 0;
    }
  }

  /**
   * Bugünün ve dünün sayıları Redis'ten veritabanına. Redis yeniden başlayıp sayı küçülürse veritabanındaki büyük
   * değer korunur.
   */
  async aktar(now = new Date()) {
    if (!this.redis) return 0;
    const r = await ready(this.redis);
    let n = 0;
    for (const gun of [trGun(new Date(now.getTime() - DAY)), trGun(now)]) {
      const [ziyaretci, sayfa, arama] = await Promise.all([
        r.pfcount(`analitik:ziyaretci:${gun}`),
        r.get(`analitik:sayfa:${gun}`),
        r.hgetall(`analitik:arama:${gun}`),
      ]);
      const day = gunTarihi(gun);
      if (ziyaretci || Number(sayfa)) {
        await this.db.$executeRaw`
          INSERT INTO web_traffic_daily (day, visitors, pageviews, updated_at)
          VALUES (${day}::date, ${ziyaretci}, ${Number(sayfa) || 0}, now())
          ON CONFLICT (day) DO UPDATE SET
            visitors = GREATEST(web_traffic_daily.visitors, EXCLUDED.visitors),
            pageviews = GREATEST(web_traffic_daily.pageviews, EXCLUDED.pageviews),
            updated_at = now()`;
        n++;
      }
      for (const [alan, v] of Object.entries(arama)) {
        const [makeKey = '', seriesKey = ''] = alan.split('|');
        if (!makeKey) continue;
        await this.db.$executeRaw`
          INSERT INTO search_log_daily (day, make_key, series_key, count, updated_at)
          VALUES (${day}::date, ${makeKey}, ${seriesKey}, ${Number(v) || 0}, now())
          ON CONFLICT (day, make_key, series_key) DO UPDATE SET
            count = GREATEST(search_log_daily.count, EXCLUDED.count),
            updated_at = now()`;
        n++;
      }
    }
    return n;
  }

  /** Dönemdeki günlük tekil ziyaretçilerin toplamı; ölçüm hiç başlamadıysa null */
  async ziyaretci(bas: Date, bit: Date): Promise<number | null> {
    if (!(await this.db.webTrafficDaily.findFirst({ select: { day: true } }))) return null;
    const r = await this.db.webTrafficDaily.aggregate({
      where: { day: this.gunAraligi(bas, bit) },
      _sum: { visitors: true },
    });
    return r._sum.visitors ?? 0;
  }

  /** Dönemdeki model aramaları: seri anahtarı (seri seçilmediyse marka anahtarı) → arayan sayısı */
  async aramalar(bas: Date, bit: Date): Promise<Map<string, number> | null> {
    if (!(await this.db.searchLogDaily.findFirst({ select: { day: true } }))) return null;
    const rows = await this.db.searchLogDaily.groupBy({
      by: ['makeKey', 'seriesKey'],
      where: { day: this.gunAraligi(bas, bit) },
      _sum: { count: true },
    });
    const m = new Map<string, number>();
    for (const x of rows) {
      const k = x.seriesKey || x.makeKey;
      m.set(k, (m.get(k) ?? 0) + (x._sum.count ?? 0));
    }
    return m;
  }

  private gunAraligi(bas: Date, bit: Date) {
    return { gte: gunTarihi(trGun(bas)), lte: gunTarihi(trGun(new Date(bit.getTime() - 1))) };
  }
}
