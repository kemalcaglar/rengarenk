import { Inject, Injectable } from '@nestjs/common';
import {
  COLORS,
  FUELS,
  GEARBOXES,
  kelimeVar,
  type PortfolioVehicleData,
  scanMessage,
} from '@rengarenk/shared';
import { AiGateway } from '../ai/ai-gateway.service.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { FeatureFlagService } from '../flags/feature-flag.service.js';

const kucuk = (s: string) => s.trim().toLocaleLowerCase('tr-TR');
/** Karşılaştırma için sade biçim: "3.20i" → "320i", "Mercedes-Benz" → "mercedesbenz" */
export const sade = (s: string) => kucuk(s).replace(/[^\p{L}\d]+/gu, '');
const MARKA_DIGER: Record<string, string> = {
  vw: 'volkswagen',
  mercedes: 'mercedesbenz',
  merso: 'mercedesbenz',
  benz: 'mercedesbenz',
  reno: 'renault',
  pejo: 'peugeot',
  toyata: 'toyota',
  hyundai: 'hyundai',
  hundai: 'hyundai',
  wolkswagen: 'volkswagen',
  folksvagen: 'volkswagen',
};
const AD = (list: readonly { key: string; ad: string }[], k?: string) => list.find((x) => x.key === k)?.ad;
const sayi = (n: number) => new Intl.NumberFormat('tr-TR').format(n);
const ACIKLAMA_YZ_EN_COK = 40;

/**
 * Toplu yükleme yardımı (Karar 42; özellik anahtarı `toplu_portfoy`): galerinin Excel'indeki karışık araç adlarını
 * kataloğa bağlar ("VW passat" → Volkswagen Passat, "3.20i" → 320i, model sütununda "BMW 320i") ve açıklaması boş
 * araçlara açıklama taslağı yazar. Eşleştirme kurallarla yapılır (kişisel veri dışarı çıkmaz); açıklamalar yapay zekâ
 * açıksa tek istekte (maskeli, plaka ve şasi gönderilmez) iyileştirilir, güvenlik kuralına takılan metin kullanılmaz.
 */
@Injectable()
export class BulkAssist {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly flags: FeatureFlagService,
    private readonly ai: AiGateway,
  ) {}

  acik(userId: string) {
    return this.flags.isOn('toplu_portfoy', { userId });
  }

  async marka(ad: string, birlesik: string) {
    const markalar = await this.db.catalogMake.findMany({ select: { id: true, key: true, name: true } });
    const hedef = sade(ad);
    const esit = (n: string) => {
      const s = sade(n);
      return hedef && (s === hedef || MARKA_DIGER[hedef] === s || sade(n.split('-')[0] ?? '') === hedef);
    };
    const m = markalar.find((x) => esit(x.name));
    if (m) return m;
    // Marka sütunu boş ya da tanınmıyorsa birleşik metinde marka adı aranır ("BMW 320i")
    const t = kucuk(birlesik);
    return (
      markalar
        .filter((x) => x.name.length >= 2 && kelimeVar(t, kucuk(x.name)))
        .sort((a, b) => b.name.length - a.name.length)[0] ??
      markalar.find((x) =>
        Object.entries(MARKA_DIGER).some(([k, v]) => v === sade(x.name) && kelimeVar(t, k)),
      ) ??
      null
    );
  }

  async seri(makeId: string, ad: string, birlesik: string) {
    const seriler = await this.db.catalogSeries.findMany({
      where: { makeId },
      select: { id: true, key: true, name: true },
    });
    const hedef = sade(ad);
    const esit = seriler.find(
      (s) => hedef && (sade(s.name) === hedef || sade(s.name.replace(/\s*serisi$/i, '')) === hedef),
    );
    if (esit) return esit;
    const t = kucuk(birlesik);
    return (
      seriler
        .filter((s) => {
          // "3 Serisi" → "3" tek başına aranmaz (yıl ve km sayılarıyla karışır); model adı seriyi verir
          const kisa = kucuk(s.name.replace(/\s*serisi$/i, ''));
          return kelimeVar(t, kucuk(s.name)) || (!/^\d+$/.test(kisa) && kelimeVar(t, kisa));
        })
        .sort((a, b) => b.name.length - a.name.length)[0] ?? null
    );
  }

  async model(makeId: string, seriesId: string | undefined, ad: string, birlesik: string) {
    const modeller = await this.db.catalogModel.findMany({
      where: { makeId, ...(seriesId ? { seriesId } : {}) },
      select: { key: true, name: true, seriesId: true },
    });
    const hedef = sade(ad);
    const esit = modeller.find((m) => hedef && sade(m.name) === hedef);
    if (esit) return esit;
    const t = sade(birlesik);
    return (
      modeller
        .filter((m) => sade(m.name).length >= 3 && t.includes(sade(m.name)))
        .sort((a, b) => b.name.length - a.name.length)[0] ?? null
    );
  }

  /** Kural taslağı: "2020 BMW 3 Serisi 320i · 62.000 km, benzinli, otomatik, beyaz. Takasa uygun." */
  taslak(ad: string, v: PortfolioVehicleData) {
    const ozellik = [
      `${sayi(Number(v.km))} km`,
      AD(FUELS, v.yakit)?.toLocaleLowerCase('tr-TR'),
      AD(GEARBOXES, v.vites)?.toLocaleLowerCase('tr-TR'),
      AD(COLORS, v.renk)?.toLocaleLowerCase('tr-TR'),
    ]
      .filter(Boolean)
      .join(', ');
    const tramer = Number(v.hasar?.tramer ?? 0);
    return [
      `${ad} · ${ozellik}.`,
      tramer ? `Tramer kaydı ${sayi(tramer)} TL.` : 'Tramer kaydı yok.',
      v.takas ? 'Takasa uygun.' : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  /** Açıklama taslaklarını yapay zekâyla iyileştirir (tek istek); okunamayan ya da kurala takılan taslak kalır */
  async iyilestir(liste: { satir: number; taslak: string }[]): Promise<Map<number, string>> {
    const out = new Map(liste.map((x) => [x.satir, x.taslak]));
    const parca = liste.slice(0, ACIKLAMA_YZ_EN_COK);
    if (parca.length === 0) return out;
    const r = await this.ai.run({
      task: 'toplu_yukleme',
      promptVersion: 'toplu-aciklama-v1',
      size: 'kucuk',
      system:
        'Galeri portföyündeki her araç için verilen taslaktan kısa, akıcı bir ilan açıklaması yaz. Taslaktaki bilgileri koru, yeni bilgi uydurma; telefon, IBAN, bağlantı ve fiyat yazma. Yalnızca JSON dizisi döndür: [{"satir":2,"metin":"..."}].',
      prompt: `${parca.length} araç`,
      taslak: JSON.stringify(parca.map((x) => ({ satir: x.satir, metin: x.taslak }))),
      maxOutputTokens: 60 * parca.length,
    });
    if (r.kaynak !== 'yz') return out;
    try {
      const j = JSON.parse(r.text.match(/\[[\s\S]*\]/)?.[0] ?? '[]') as {
        satir?: unknown;
        metin?: unknown;
      }[];
      for (const x of j) {
        if (typeof x.satir !== 'number' || typeof x.metin !== 'string' || !out.has(x.satir)) continue;
        const m = x.metin.trim();
        if (m.length >= 20 && m.length <= 1000 && scanMessage(m).length === 0) out.set(x.satir, m);
      }
    } catch {
      // Taslaklar kalır
    }
    return out;
  }
}
