import type { Redis } from 'ioredis';

/**
 * İstek özeti (Karar 56; Sistem sağlığı › hata oranı ve yanıt süresi): her API isteği dakika başına bir Redis özetine
 * yazılır (sayı, 5xx sayısı, süre dilimleri). Birden çok API kopyası aynı özete yazar; yeniden başlamada kaybolmaz.
 * 26 saat tutulur. Kişisel veri yok (yol, kişi, IP yazılmaz).
 */
export const SURE_DILIMLERI = [25, 50, 100, 250, 500, 1000, 2500, 5000] as const;
const TUT_SN = 26 * 3600;
const dakika = (t: Date) => t.toISOString().slice(0, 16).replace(/[-:T]/g, '');
const anahtar = (t: Date) => `saglik:istek:${dakika(t)}`;

/** Redis tembel bağlanır (lazyConnect, çevrimdışı kuyruk kapalı): ilk kullanan bağlantıyı açar */
export async function redisHazir(redis: Redis) {
  if (redis.status === 'wait') await redis.connect().catch(() => undefined);
}

export async function istekKaydet(redis: Redis, status: number, ms: number, t = new Date()) {
  await redisHazir(redis);
  const k = anahtar(t);
  const dilim = SURE_DILIMLERI.findIndex((s) => ms <= s);
  const p = redis.pipeline();
  p.hincrby(k, 'n', 1);
  if (status >= 500) p.hincrby(k, 'e', 1);
  p.hincrby(k, `b${dilim === -1 ? SURE_DILIMLERI.length : dilim}`, 1);
  p.expire(k, TUT_SN);
  return p.exec();
}

/** Son `saat` saatin özeti: istek, 5xx, hata oranı ve p95 (dilim üst sınırı, ms) */
export async function istekOzeti(redis: Redis, now = new Date(), saat = 24) {
  await redisHazir(redis);
  const anahtarlar: string[] = [];
  for (let i = 0; i < saat * 60; i++) anahtarlar.push(anahtar(new Date(now.getTime() - i * 60_000)));
  const p = redis.pipeline();
  for (const k of anahtarlar) p.hgetall(k);
  const sonuc = (await p.exec()) ?? [];
  let n = 0;
  let e = 0;
  const dilim = new Array<number>(SURE_DILIMLERI.length + 1).fill(0);
  for (const [, h] of sonuc) {
    const x = (h ?? {}) as Record<string, string>;
    n += Number(x.n ?? 0);
    e += Number(x.e ?? 0);
    for (let i = 0; i < dilim.length; i++) dilim[i] = (dilim[i] ?? 0) + Number(x[`b${i}`] ?? 0);
  }
  let p95: number | null = null;
  if (n) {
    let birikim = 0;
    for (let i = 0; i < dilim.length; i++) {
      birikim += dilim[i] ?? 0;
      if (birikim >= n * 0.95) {
        p95 = SURE_DILIMLERI[i] ?? 10_000;
        break;
      }
    }
  }
  return { istek: n, hata: e, oran: n ? e / n : null, p95 };
}
