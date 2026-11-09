import { Inject, Injectable } from '@nestjs/common';
import { ekle, ILLER, yonelmeEki } from '@rengarenk/shared';
import { AiGateway } from '../ai/ai-gateway.service.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { trDayStart } from './agent.service.js';

const DAY = 86_400_000;
const TR = 3 * 3_600_000;
const AYLAR = [
  'ocak',
  'şubat',
  'mart',
  'nisan',
  'mayıs',
  'haziran',
  'temmuz',
  'ağustos',
  'eylül',
  'ekim',
  'kasım',
  'aralık',
];
/** Ay adına yönelme eki: eylüle, ocağa, aralığa */
const yonelme = (ay: string) =>
  ay.endsWith('k') ? `${ay.slice(0, -1)}ğ${yonelmeEki(ay)}` : `${ay}${yonelmeEki(ay)}`;
const buyuk = (s: string) => s.charAt(0).toLocaleUpperCase('tr') + s.slice(1);
const sayi = (n: number) => new Intl.NumberFormat('tr-TR').format(n);
const tl = (kurus: number) =>
  new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(kurus / 100);

type Olcu = 'ilk_mesaj' | 'talep' | 'buldu' | 'gelir' | 'galeri' | 'sikayet';

interface Donem {
  start: Date;
  end: Date;
  /** Cümle başı: "Ekim 2026’da", "Son 30 günde", "Dün" */
  ad: string;
  /** Karşılaştırma: "eylüle göre", "önceki haftaya göre" */
  kiyas: string;
  onceki: { start: Date; end: Date };
}

/** Sorudaki dönem: geçen ay, bu ay, dün, bugün, bu hafta, geçen hafta, "Ekim 2026", son N gün (varsayılan son 30 gün) */
export function donemBul(soru: string, now: Date): Donem {
  const q = soru.toLocaleLowerCase('tr');
  const ayDonemi = (y: number, m: number): Donem => {
    const start = new Date(Date.UTC(y, m, 1) - TR);
    const end = new Date(Date.UTC(y, m + 1, 1) - TR);
    const oy = m === 0 ? y - 1 : y;
    const om = m === 0 ? 11 : m - 1;
    const onceAd = AYLAR[om] as string;
    return {
      start,
      end: end > now ? now : end,
      ad: ekle(`${buyuk(AYLAR[m] as string)} ${y}`, 'bulunma'),
      kiyas: `${yonelme(onceAd)} göre`,
      onceki: { start: new Date(Date.UTC(oy, om, 1) - TR), end: start },
    };
  };
  const tr = new Date(now.getTime() + TR);
  const y = tr.getUTCFullYear();
  const m = tr.getUTCMonth();
  if (q.includes('geçen ay') || q.includes('gecen ay'))
    return ayDonemi(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1);
  if (q.includes('bu ay')) return ayDonemi(y, m);
  const ayIndex = AYLAR.findIndex((a) => new RegExp(`(^|[^\\p{L}])${a}`, 'u').test(q));
  if (ayIndex >= 0) {
    const yil = Number(q.match(/(20\d{2})/)?.[1] ?? (ayIndex > m ? y - 1 : y));
    return ayDonemi(yil, ayIndex);
  }
  const gun = trDayStart(now);
  const aralik = (start: Date, end: Date, ad: string, kiyas: string): Donem => ({
    start,
    end,
    ad,
    kiyas,
    onceki: { start: new Date(start.getTime() - (end.getTime() - start.getTime())), end: start },
  });
  if (q.includes('dün') || q.includes('dun '))
    return aralik(new Date(gun.getTime() - DAY), gun, 'Dün', 'önceki güne göre');
  if (q.includes('bugün')) return aralik(gun, now, 'Bugün', 'dünün aynı saatine göre');
  const haftaBasi = new Date(gun.getTime() - ((new Date(gun.getTime() + TR).getUTCDay() + 6) % 7) * DAY);
  if (q.includes('geçen hafta'))
    return aralik(new Date(haftaBasi.getTime() - 7 * DAY), haftaBasi, 'Geçen hafta', 'önceki haftaya göre');
  if (q.includes('bu hafta')) return aralik(haftaBasi, now, 'Bu hafta', 'geçen haftanın aynı dönemine göre');
  const son = Number(q.match(/son\s+(\d{1,3})\s+gün/)?.[1] ?? 30);
  return aralik(new Date(now.getTime() - son * DAY), now, `Son ${son} günde`, `önceki ${son} güne göre`);
}

function olcuBul(soru: string): Olcu | null {
  const q = soru.toLocaleLowerCase('tr');
  if (q.includes('ilk mesaj') || q.includes('mesaj gönder') || q.includes('yazdı')) return 'ilk_mesaj';
  if (q.includes('buldu')) return 'buldu';
  if (q.includes('gelir') || q.includes('ciro') || q.includes('kazan')) return 'gelir';
  if (q.includes('şikâyet') || q.includes('şikayet') || q.includes('kapora')) return 'sikayet';
  if (q.includes('talep')) return 'talep';
  if (q.includes('galeri')) return 'galeri';
  return null;
}

function ilBul(soru: string) {
  const q = soru.toLocaleLowerCase('tr');
  return (
    ILLER.find((i) => new RegExp(`(^|[^\\p{L}])${i.ad.toLocaleLowerCase('tr')}`, 'u').test(q))?.ad ?? null
  );
}

/**
 * Ajana sor (Karar 41, 44): doğal dille sorulan rapor sorusu. Sayılar veritabanından kurallarla hesaplanır, kişisel
 * veri kullanılmaz; yapay zekâ yalnızca cümleyi kurar (sağlayıcı yoksa kural metni döner).
 */
@Injectable()
export class AgentAsk {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly ai: AiGateway,
  ) {}

  private oran(simdi: number, once: number) {
    if (!once) return null;
    const p = Math.round(((simdi - once) / once) * 100);
    return p === 0 ? 'aynı' : `%${Math.abs(p)} ${p > 0 ? 'fazla' : 'az'}`;
  }

  private async hesapla(olcu: Olcu, d: { start: Date; end: Date }, il: string | null) {
    const zaman = { gte: d.start, lt: d.end };
    switch (olcu) {
      case 'ilk_mesaj': {
        const sohbetler = await this.db.conversation.findMany({
          where: {
            origin: 'talep',
            createdAt: zaman,
            ...(il ? { sellerAccount: { gallery: { il } } } : {}),
          },
          select: { sellerAccountId: true },
        });
        return { toplam: sohbetler.length, yazan: new Set(sohbetler.map((s) => s.sellerAccountId)).size };
      }
      case 'talep':
        return {
          toplam: await this.db.demand.count({ where: { publishedAt: zaman, ...(il ? { il } : {}) } }),
        };
      case 'buldu':
        return {
          toplam: await this.db.demand.count({
            where: { foundVia: 'rengarenk', closedAt: zaman, ...(il ? { il } : {}) },
          }),
        };
      case 'gelir': {
        const s = await this.db.order.aggregate({
          where: { status: 'PAID', paidAt: zaman },
          _sum: { totalKurus: true },
        });
        return { toplam: Number(s._sum.totalKurus ?? 0n) };
      }
      case 'galeri':
        return {
          toplam: await this.db.gallery.count({ where: { approvedAt: zaman, ...(il ? { il } : {}) } }),
        };
      case 'sikayet': {
        const [toplam, kapora] = await Promise.all([
          this.db.report.count({ where: { createdAt: zaman } }),
          this.db.report.count({ where: { createdAt: zaman, reason: 'kapora' } }),
        ]);
        return { toplam, kapora };
      }
    }
  }

  async sor(soru: string, now = new Date()) {
    const olcu = olcuBul(soru);
    if (!olcu) {
      return {
        cevap:
          'Bu soruyu henüz yanıtlayamıyorum. Talep, ilk mesaj, aracı buldum, gelir, yeni galeri ve şikâyet sayılarını il ve dönemle sorabilirsin (ör. “Geçen ay İzmir’de kaç galeri ilk mesaj gönderdi?”).',
        kaynak: 'Kişisel veri kullanılmadı',
        yz: false,
      };
    }
    const d = donemBul(soru, now);
    const il = olcu === 'gelir' || olcu === 'sikayet' ? null : ilBul(soru);
    const [bu, once] = await Promise.all([this.hesapla(olcu, d, il), this.hesapla(olcu, d.onceki, il)]);
    const kiyas = this.oran(bu.toplam, once.toplam);
    const kiyasCumle = kiyas
      ? kiyas === 'aynı'
        ? ` Bu, ${d.kiyas} aynı.`
        : ` Bu, ${d.kiyas} ${kiyas}.`
      : '';
    const yer = il ? `${ekle(il, 'bulunma')}ki ` : '';
    let taslak: string;
    let kaynak: string;
    if (olcu === 'ilk_mesaj') {
      const galeriSayisi = await this.db.gallery.count({
        where: { approvedAt: { lt: d.end }, account: { status: { not: 'CLOSED' } }, ...(il ? { il } : {}) },
      });
      const b = bu as { toplam: number; yazan: number };
      taslak = !galeriSayisi
        ? `${d.ad} ${il ? `${ekle(il, 'bulunma')} ` : ''}onaylı galeri yoktu; ilk mesaj gönderilmedi.`
        : !b.yazan
          ? `${d.ad} ${yer}${sayi(galeriSayisi)} galeriden hiçbiri ilk mesaj göndermedi.${kiyasCumle}`
          : `${d.ad} ${yer}${sayi(galeriSayisi)} galeriden ${ekle(b.yazan, 'iyelik')} en az bir ilk mesaj gönderdi; toplam ${sayi(b.toplam)} ilk mesaj.${kiyasCumle}`;
      if (b.yazan && galeriSayisi > b.yazan)
        taslak += ` ${sayi(galeriSayisi - b.yazan)} galeri bu dönemde hiç yazmadı.`;
      kaynak = 'Kaynak: mesaj ve galeri tabloları · kişisel veri kullanılmadı';
    } else if (olcu === 'talep') {
      taslak = `${d.ad} ${il ? `${ekle(il, 'bulunma')} ` : ''}${sayi(bu.toplam)} talep yayına girdi.${kiyasCumle}`;
      kaynak = 'Kaynak: talep tablosu · kişisel veri kullanılmadı';
    } else if (olcu === 'buldu') {
      taslak = `${d.ad} ${il ? `${ekle(il, 'bulunma')} ` : ''}${sayi(bu.toplam)} alıcı aracını Rengarenk’te bulduğunu bildirdi.${kiyasCumle}`;
      kaynak = 'Kaynak: talep kapanış nedenleri · kişisel veri kullanılmadı';
    } else if (olcu === 'gelir') {
      taslak = `${d.ad} ödenen siparişlerden ${tl(bu.toplam)} TL gelir (KDV dahil) elde edildi.${kiyasCumle}`;
      kaynak = 'Kaynak: sipariş tablosu · il kırılımı yok · kişisel veri kullanılmadı';
    } else if (olcu === 'galeri') {
      taslak = `${d.ad} ${yer}${sayi(bu.toplam)} yeni galeri onaylandı.${kiyasCumle}`;
      kaynak = 'Kaynak: galeri tablosu · kişisel veri kullanılmadı';
    } else {
      const b = bu as { toplam: number; kapora: number };
      taslak = `${d.ad} ${sayi(b.toplam)} şikâyet açıldı; ${sayi(b.kapora)} tanesi kapora.${kiyasCumle}`;
      kaynak = 'Kaynak: şikâyet tablosu · kişisel veri kullanılmadı';
    }
    const r = await this.ai.run({
      task: 'rapor',
      promptVersion: 'ajana-sor-v1',
      size: 'kucuk',
      system:
        'Rengarenk yönetim konsolunda çalışanın rapor sorusunu yanıtla. Yalnızca verilen olguları kullan, sayıları değiştirme, en çok üç cümle, Türkçe.',
      prompt: `Soru: ${soru}`,
      taslak,
    });
    return { cevap: r.text, kaynak, yz: r.kaynak === 'yz' };
  }
}
