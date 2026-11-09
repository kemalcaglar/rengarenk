import { ekle, GALLERY_REPORT_MIN_DEMANDS, GALLERY_REPORT_MODELS } from '@rengarenk/shared';
import type { Db } from '../database/prisma.js';

const DAY = 86_400_000;

export interface AramaGalerisi {
  accountId: string;
  displayName: string;
  il: string;
}

/**
 * Bölgende aranan modeller (Karar 44, 46): galerinin ilinde son 30 günde en çok talep edilen modeller (ilde yeterli talep
 * yoksa Türkiye geneli), galerinin portföyündeki araç sayısı ve ajanın kural tabanlı önerisi. Kişisel veri yok.
 * Zamanlanmış galeri raporu ve galerinin ana sayfası kullanır.
 */
export async function arananModeller(db: Db, galeriler: AramaGalerisi[], now = new Date()) {
  if (!galeriler.length) return [];
  const talepler = await db.demand.findMany({
    where: { publishedAt: { gte: new Date(now.getTime() - 30 * DAY), lt: now } },
    select: { il: true, data: true },
  });
  const genel = new Map<string, number>();
  const ilde = new Map<string, Map<string, number>>();
  for (const d of talepler) {
    const m = (d.data as { alanlar?: { model?: { make?: string; series?: string } } })?.alanlar?.model;
    const key = m?.series;
    if (!key) continue;
    genel.set(key, (genel.get(key) ?? 0) + 1);
    if (!d.il) continue;
    const x = ilde.get(d.il) ?? new Map<string, number>();
    x.set(key, (x.get(key) ?? 0) + 1);
    ilde.set(d.il, x);
  }
  const ilk = (m: Map<string, number>) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, GALLERY_REPORT_MODELS);
  const keys = new Set<string>();
  const secim = galeriler.map((g) => {
    const il = ilde.get(g.il);
    const toplam = il ? [...il.values()].reduce((t, v) => t + v, 0) : 0;
    const yerel = toplam >= GALLERY_REPORT_MIN_DEMANDS;
    const liste = ilk(yerel && il ? il : genel);
    for (const [k] of liste) keys.add(k);
    return { g, yerel, liste };
  });
  const [seriler, portfoy] = await Promise.all([
    db.catalogSeries.findMany({
      where: { key: { in: [...keys] } },
      select: { key: true, name: true, make: { select: { name: true } } },
    }),
    db.portfolioVehicle.groupBy({
      by: ['accountId', 'seriesKey'],
      where: {
        status: 'PUBLISHED',
        seriesKey: { in: [...keys] },
        accountId: { in: galeriler.map((g) => g.accountId) },
      },
      _count: true,
    }),
  ]);
  const ad = new Map(seriler.map((s) => [s.key, `${s.make.name} ${s.name}`]));
  const elde = new Map(portfoy.map((p) => [`${p.accountId}|${p.seriesKey}`, p._count]));
  return secim
    .filter((s) => s.liste.length > 0)
    .map(({ g, yerel, liste }) => {
      const bolge = yerel ? ekle(g.il, 'bulunma') : 'Türkiye genelinde';
      const modeller = liste.map(([key, n], i) => {
        const arac = elde.get(`${g.accountId}|${key}`) ?? 0;
        return { sira: i + 1, ad: ad.get(key) ?? key, talep: n, arac };
      });
      const eksik = modeller.find((m) => m.arac === 0 && m.talep >= 2);
      return {
        accountId: g.accountId,
        galeri: g.displayName,
        bolge,
        modeller,
        oneri: eksik
          ? `${eksik.ad} için ${bolge} son 30 günde ${eksik.talep} talep açıldı; portföyünde yok. Bu modelden araç eklersen talep sahipleriyle eşleşirsin.`
          : 'En çok aranan modellerin portföyünde var; fiyat ve fotoğrafları güncel tutmak eşleşmeleri artırır.',
      };
    });
}
