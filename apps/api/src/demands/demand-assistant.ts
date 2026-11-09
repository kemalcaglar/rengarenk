import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  type AssistantParse,
  type CategoryField,
  type FlagPlatform,
  fieldValueSchema,
  kelimeVar,
  parseDemandText,
} from '@rengarenk/shared';
import { AiGateway } from '../ai/ai-gateway.service.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { FeatureFlagService } from '../flags/feature-flag.service.js';
import { DemandService } from './demand.service.js';

type Values = Record<string, unknown>;
interface Veri {
  alanlar: Values;
  alternatifler: Values[];
}
interface Model {
  make: string;
  series?: string;
  model?: string;
}

const kucuk = (s: string) => s.toLocaleLowerCase('tr-TR');
/** Yazılışı farklı sık marka adları */
const MARKA_DIGER: Record<string, string> = {
  vw: 'volkswagen',
  mercedes: 'mercedes-benz',
  merso: 'mercedes-benz',
  reno: 'renault',
  pejo: 'peugeot',
};
const sayi = (n: number) => new Intl.NumberFormat('tr-TR').format(n);

/**
 * Talep asistanı (Karar 42): serbest metinden taslağı doldurur, alıcı kontrol edip kendisi yayınlar. Sayılar ve seçenekler
 * kurallardan, marka/seri/model katalogdan gelir; yapay zekâ (maskeli istekle) aynı biçimde öneri verirse o da şemayla
 * ve katalogla doğrulanır. Şemada olmayan alan, seçenek ya da katalogda olmayan araç yazılmaz. Özellik anahtarı:
 * `talep_asistani`.
 */
@Injectable()
export class DemandAssistant {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly demands: DemandService,
    private readonly flags: FeatureFlagService,
    private readonly ai: AiGateway,
  ) {}

  acik(userId: string, platform?: FlagPlatform) {
    return this.flags.isOn('talep_asistani', { userId, platform });
  }

  /** Metindeki marka, seri ve modeli kategorinin kataloğundan bulur (en uzun ad önce) */
  async katalog(metin: string, kategori: string): Promise<Model | null> {
    const t = kucuk(metin);
    const markalar = await this.db.catalogMake.findMany({
      where: { series: { some: { categories: { has: kategori } } } },
      select: { id: true, key: true, name: true },
    });
    const adlar = (m: { name: string }) => {
      const n = kucuk(m.name);
      const diger = Object.entries(MARKA_DIGER)
        .filter(([, v]) => v === n)
        .map(([k]) => k);
      return [n, ...(n.includes('-') ? [n.split('-')[0] as string] : []), ...diger];
    };
    const marka = markalar
      .map((m) => ({ m, ad: adlar(m).find((a) => a.length >= 2 && kelimeVar(t, a)) }))
      .filter((x) => x.ad)
      .sort((a, b) => (b.ad?.length ?? 0) - (a.ad?.length ?? 0))[0]?.m;

    const seriBul = async (makeId?: string) => {
      const seriler = await this.db.catalogSeries.findMany({
        where: { categories: { has: kategori }, ...(makeId ? { makeId } : {}) },
        select: { id: true, key: true, name: true, make: { select: { key: true } } },
      });
      const uyan = seriler
        .filter((s) => {
          const n = kucuk(s.name);
          return (
            n.length >= (makeId ? 1 : 4) && (kelimeVar(t, n) || kelimeVar(t, n.replace(/\s*serisi$/, '')))
          );
        })
        .sort((a, b) => b.name.length - a.name.length);
      // Markasız aramada aynı ad birden çok markada varsa seçilmez
      if (!makeId && new Set(uyan.map((s) => s.make.key)).size > 1) return null;
      return uyan[0] ?? null;
    };
    const seri = marka ? await seriBul(marka.id) : await seriBul();
    if (!marka && !seri) return null;
    const makeId =
      marka?.id ?? (await this.db.catalogSeries.findUnique({ where: { id: seri?.id as string } }))?.makeId;
    const modeller = await this.db.catalogModel.findMany({
      where: { makeId, ...(seri ? { seriesId: seri.id } : {}) },
      select: { key: true, name: true, series: { select: { key: true } } },
    });
    const model = modeller
      .filter((m) => m.name.length >= 2 && kelimeVar(t, kucuk(m.name)))
      .sort((a, b) => b.name.length - a.name.length)[0];
    const makeKey = marka?.key ?? seri?.make.key;
    if (!makeKey) return null;
    return {
      make: makeKey,
      ...(seri ? { series: seri.key } : model?.series ? { series: model.series.key } : {}),
      ...(model ? { model: model.key } : {}),
    };
  }

  /** Öneriyi şemaya göre doğrular ve taslağın verisine yerleştirir; yazılan alanları döner */
  private yerlestir(alanlar: CategoryField[], veri: Veri, oneri: Record<string, unknown>) {
    const yazilan: CategoryField[] = [];
    const alt = { ...(veri.alternatifler[0] ?? {}) };
    const talep = { ...veri.alanlar };
    for (const [k, v] of Object.entries(oneri)) {
      if (v === undefined || v === null || (Array.isArray(v) && v.length === 0)) continue;
      const f = alanlar.find((x) => x.key === k);
      if (!f || !fieldValueSchema(f).safeParse(v).success) continue;
      if (f.scope === 'talep') talep[k] = v;
      else alt[k] = v;
      yazilan.push(f);
    }
    return {
      veri: { alanlar: talep, alternatifler: [alt, ...veri.alternatifler.slice(1)] },
      yazilan,
    };
  }

  private async bicim(f: CategoryField, v: unknown): Promise<string> {
    if (f.type === 'catalog') {
      const m = v as Model;
      const [mk, sr, md] = await Promise.all([
        this.db.catalogMake.findUnique({ where: { key: m.make }, select: { name: true } }),
        m.series
          ? this.db.catalogSeries.findUnique({ where: { key: m.series }, select: { name: true } })
          : null,
        m.model ? this.db.catalogModel.findUnique({ where: { key: m.model }, select: { name: true } }) : null,
      ]);
      return [mk?.name, sr?.name, md?.name].filter(Boolean).join(' ');
    }
    if (f.type === 'location') {
      const l = v as { il: string; ilce?: string };
      return [l.il, l.ilce].filter(Boolean).join(', ');
    }
    if (f.type === 'range') {
      const r = v as { min?: number; max?: number };
      const b = f.unit ? ` ${f.unit}` : '';
      const s = (n: number) => (f.key === 'yil' ? String(n) : sayi(n));
      if (r.min !== undefined && r.max !== undefined)
        return r.min === r.max ? `${s(r.min)}${b}` : `${s(r.min)} – ${s(r.max)}${b}`;
      return r.min !== undefined ? `en az ${s(r.min)}${b}` : `en çok ${s(r.max as number)}${b}`;
    }
    if (f.type === 'number') return `en çok ${sayi(v as number)}${f.unit ? ` ${f.unit}` : ''}`;
    if (f.type === 'boolean') return v ? 'Evet' : 'Hayır';
    const ad = (x: unknown) => f.options?.find((o) => o.value === x)?.label ?? String(x);
    return Array.isArray(v) ? v.map(ad).join(', ') : ad(v);
  }

  /** Yapay zekânın JSON önerisi (maskeli metinden); okunamazsa kural önerisi kalır */
  private yzOnerisi(text: string): Record<string, unknown> | null {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      const j = JSON.parse(m[0]) as unknown;
      return j && typeof j === 'object' && !Array.isArray(j) ? (j as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }

  async doldur(userId: string, id: string, metin: string, platform?: FlagPlatform) {
    if (!(await this.acik(userId, platform))) throw new ForbiddenException('Talep asistanı şu an kapalı');
    const d = await this.demands.ownerDetail(userId, id);
    if (d.status !== 'DRAFT' || !d.schema)
      throw new ConflictException('Asistan yalnızca taslak talepte kullanılır');
    const alanlar = d.schema.fields;
    const kural: AssistantParse & { model?: Model } = parseDemandText(metin);
    const model = await this.katalog(metin, d.category.slug);
    if (model) kural.model = model;

    const r = await this.ai.run({
      task: 'talep_asistani',
      promptVersion: 'talep-asistani-v1',
      size: 'kucuk',
      system: `Alıcının aradığı aracı anlatan Türkçe metinden talep formu alanlarını JSON olarak çıkar. Yalnızca şu anahtarları kullan: ${alanlar
        .filter((f) => f.type !== 'catalog' && f.type !== 'paint')
        .map(
          (f) =>
            `${f.key} (${f.type}${f.options?.length ? `: ${f.options.map((o) => o.value).join('|')}` : ''})`,
        )
        .join(
          ', ',
        )}. Aralıklar {"min":..,"max":..}, çoklu seçim dizi. Metinde olmayanı yazma. Taslaktaki değerleri koru, yalnızca eksikleri ekle. Sadece JSON döndür.`,
      prompt: metin,
      taslak: JSON.stringify(kural),
      maxOutputTokens: 400,
    });
    // Yapay zekâ yalnızca kuralın bulamadığı alanları ekler; araç her zaman katalogdan
    const yz = r.kaynak === 'yz' ? this.yzOnerisi(r.text) : null;
    const oneri: Record<string, unknown> = { ...(yz ?? {}), ...kural };
    delete oneri.model;
    if (model) oneri.model = model;

    const veri = (d.data ?? { alanlar: {}, alternatifler: [{}] }) as Veri;
    const { veri: yeni, yazilan } = this.yerlestir(
      alanlar,
      { alanlar: veri.alanlar ?? {}, alternatifler: veri.alternatifler?.length ? veri.alternatifler : [{}] },
      oneri,
    );
    if (yazilan.length)
      await this.demands.update(userId, id, {
        data: yeni as unknown as Parameters<DemandService['update']>[2]['data'],
      });

    const doldurulan = await Promise.all(
      yazilan.map(async (f) => ({
        alan: f.label,
        deger: await this.bicim(
          f,
          f.scope === 'talep' ? yeni.alanlar[f.key] : yeni.alternatifler[0]?.[f.key],
        ),
      })),
    );
    const dolu = (f: CategoryField) => {
      const v = f.scope === 'talep' ? yeni.alanlar[f.key] : yeni.alternatifler[0]?.[f.key];
      return v !== undefined && v !== null && v !== '';
    };
    return {
      doldurulan,
      eksik: alanlar.filter((f) => f.required && !dolu(f)).map((f) => f.label),
      kaynak: yz ? 'yz' : 'kural',
    };
  }
}
