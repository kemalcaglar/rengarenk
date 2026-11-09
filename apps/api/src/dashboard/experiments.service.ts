import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@rengarenk/db';
import { type AbResult, abTest, armOf, guvenYaz, type Variant } from '@rengarenk/shared';
import { type Db, PRISMA } from '../database/prisma.js';

const DAY = 86_400_000;
const yuzde = (x: number | null, b = 1) =>
  x === null ? '—' : `%${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: b }).format(x * 100)}`;
const sayi = (n: number) => new Intl.NumberFormat('tr-TR').format(n);
const puan = (x: number) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(Math.abs(x));

export interface Deney {
  id: string;
  tur: 'banner' | 'kampanya';
  ad: string;
  durum: string;
  bg: string;
  fg: string;
  olcu: string;
  kollar: { ad: string; deger: string; w: number; renk: string }[];
  sonuc: string;
  kazanan: 'A' | 'B' | null;
  /** Bannerda kazananı herkese açma */
  eylem: { kol: 'A' | 'B'; yazi: string } | null;
  bitti: boolean;
}

/**
 * A/B sonuçları (Karar 44, 46, 51; YonetimRapor.dc.html › deney). Banner: kol başına gösterim ve tıklama (günlük
 * toplam). Kampanya: kol başına gönderilen ve uygulamada okunan bildirim; kol kişinin kimliğinden hesaplanır, ayrıca
 * saklanmaz. Kişisel veri dışarı verilmez, yalnızca sayılar.
 */
@Injectable()
export class ExperimentService {
  constructor(@Inject(PRISMA) private readonly db: Db) {}

  async bannerSonuc(ids: string[]) {
    if (!ids.length) return new Map<string, AbResult>();
    const st = await this.db.bannerStat.groupBy({
      by: ['bannerId', 'arm'],
      where: { bannerId: { in: ids } },
      _sum: { views: true, clicks: true },
    });
    const out = new Map<string, AbResult>();
    for (const id of ids) {
      const kol = (k: string) => st.find((x) => x.bannerId === id && x.arm === k)?._sum;
      const a = kol('A');
      const b = kol('B');
      out.set(id, abTest(a?.views ?? 0, a?.clicks ?? 0, b?.views ?? 0, b?.clicks ?? 0));
    }
    return out;
  }

  async kampanyaSonuc(id: string) {
    const rows = await this.db.notification.findMany({
      where: { campaignId: id },
      select: { userId: true, readAt: true },
    });
    const n = { A: 0, B: 0 };
    const x = { A: 0, B: 0 };
    for (const r of rows) {
      const k = armOf(r.userId, id);
      n[k]++;
      if (r.readAt) x[k]++;
    }
    return abTest(n.A, x.A, n.B, x.B);
  }

  private kart(
    base: { id: string; tur: 'banner' | 'kampanya'; ad: string; a: string; b: string; olcu: string },
    r: AbResult,
    durum: { suruyor: boolean; kalanGun: number | null; bitti: boolean; kazanan: string | null },
  ): Deney {
    const sonucHazir = !durum.bitti && r.kazanan !== null;
    const etiket = durum.bitti
      ? { durum: 'Tamamlandı', bg: '#E7FAF0', fg: '#11683F' }
      : sonucHazir
        ? { durum: 'Sonuç hazır', bg: '#E7FAF0', fg: '#11683F' }
        : durum.suruyor
          ? {
              durum: durum.kalanGun !== null ? `Sürüyor · ${durum.kalanGun} gün kaldı` : 'Sürüyor',
              bg: '#EEF3FF',
              fg: '#2450C8',
            }
          : { durum: 'Veri bekleniyor', bg: '#F3F5FA', fg: '#5A6073' };
    const enCok = Math.max(r.a.oran ?? 0, r.b.oran ?? 0, 0.0001);
    const onde = r.b.oran !== null && r.a.oran !== null ? (r.b.oran >= r.a.oran ? 'B' : 'A') : null;
    return {
      id: base.id,
      tur: base.tur,
      ad: base.ad,
      ...etiket,
      olcu: `${base.olcu} · ${sayi(r.a.n + r.b.n)} kişi`,
      kollar: [
        {
          ad: `A · ${base.a}`,
          deger: yuzde(r.a.oran),
          w: ((r.a.oran ?? 0) / enCok) * 100,
          renk: onde === 'A' ? '#5B8CFF' : '#AEB5C4',
        },
        {
          ad: `B · ${base.b}`,
          deger: yuzde(r.b.oran),
          w: ((r.b.oran ?? 0) / enCok) * 100,
          renk: onde === 'B' ? '#5B8CFF' : '#AEB5C4',
        },
      ],
      sonuc:
        r.farkPuan === null || r.guven === null
          ? 'Her iki kolda da veri birikiyor'
          : r.kazanan
            ? `${r.kazanan} kolu ${puan(r.farkPuan)} puan önde · güven ${guvenYaz(r.guven)}`
            : `${onde ?? 'B'} önde · fark henüz anlamlı değil · güven ${guvenYaz(r.guven)}`,
      kazanan: r.kazanan,
      eylem:
        base.tur === 'banner' && sonucHazir && r.kazanan
          ? { kol: r.kazanan, yazi: r.kazanan === 'B' ? 'B’yi herkese aç' : 'A’da kal, testi bitir' }
          : null,
      bitti: durum.bitti,
    };
  }

  /** Raporlar › Deneyler: banner ve kampanya A/B testleri (en yeni önce) */
  async liste(now = new Date()): Promise<Deney[]> {
    const [bannerlar, kampanyalar] = await Promise.all([
      this.db.banner.findMany({
        where: { variantB: { not: Prisma.AnyNull }, published: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.db.campaign.findMany({
        where: { variantB: { not: Prisma.AnyNull }, status: { in: ['gonderildi', 'gonderiliyor'] } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    const bs = await this.bannerSonuc(bannerlar.map((b) => b.id));
    const out: Deney[] = [];
    for (const b of bannerlar) {
      // Kazanan B açılınca bannerın içeriği B olur; ilk sürüm (A) varyantın içinde saklanır
      const v = b.variantB as unknown as Variant & { a?: Variant };
      const bitti = Boolean(b.abEndedAt) || b.stoppedAt !== null || (b.endsAt !== null && b.endsAt <= now);
      out.push(
        this.kart(
          {
            id: b.id,
            tur: 'banner',
            ad: `Banner: “${b.title}”`,
            a: v.a?.baslik ?? b.title,
            b: v.baslik,
            olcu: 'Ölçü: bannera tıklama oranı',
          },
          bs.get(b.id) as AbResult,
          {
            suruyor: !bitti && b.startsAt !== null && b.startsAt <= now,
            kalanGun: b.endsAt ? Math.max(0, Math.ceil((b.endsAt.getTime() - now.getTime()) / DAY)) : null,
            bitti,
            kazanan: b.abWinner,
          },
        ),
      );
    }
    for (const c of kampanyalar) {
      const v = c.variantB as unknown as Variant;
      const r = await this.kampanyaSonuc(c.id);
      out.push(
        this.kart(
          {
            id: c.id,
            tur: 'kampanya',
            ad: `Kampanya: ${c.name}`,
            a: c.title,
            b: v.baslik,
            olcu: 'Ölçü: bildirimi uygulamada açanların oranı',
          },
          r,
          // Kampanya bir kez gider; ölçüm okunmayla sürer, 7 gün sonra tamamlanır
          {
            suruyor: true,
            kalanGun: c.sentAt
              ? Math.max(0, 7 - Math.floor((now.getTime() - c.sentAt.getTime()) / DAY))
              : null,
            bitti: c.sentAt !== null && now.getTime() - c.sentAt.getTime() > 7 * DAY,
            kazanan: null,
          },
        ),
      );
    }
    return out;
  }
}
