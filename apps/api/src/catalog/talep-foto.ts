import type { Db } from '../database/prisma.js';
import { type FotoHedef, type FotoNesil, type FotoYakin, talepFotosu } from './photo-pick.js';

/**
 * Talep görselinin veritabanı tarafı (sahip isteği, 17 Kasım 2026; Karar 34). Talep sayfası, arama dizini (liste ve
 * vitrin kartı) ve konsoldaki "Görsel bekleyen talepler" kuyruğu aynı kuralı kullanır (`talepFotosu`).
 */

export const FOTO_ALANLARI = {
  id: true,
  generationId: true,
  seriesId: true,
  facelift: true,
  yearFrom: true,
  yearTo: true,
  author: true,
  license: true,
  licenseUrl: true,
  pageUrl: true,
  width: true,
  height: true,
  edited: true,
  sha256: true,
  origin: true,
} as const;

export interface FotoSatiri {
  id: string;
  generationId: string | null;
  seriesId: string | null;
  facelift: number | null;
  yearFrom: number | null;
  yearTo: number | null;
  author: string;
  license: string;
  licenseUrl: string | null;
  pageUrl: string;
  width: number;
  height: number;
  edited: boolean;
  sha256: string | null;
  origin: string;
}

export interface FotoVerisi {
  seriesId: string;
  gens: FotoNesil[];
  fotolar: FotoSatiri[];
}

/** Serinin nesil ve kuşakları (açık kaynaklardan) ile seçili fotoğrafları */
export async function fotoVerisi(db: Db, seriesKey: string): Promise<FotoVerisi | null> {
  const series = await db.catalogSeries.findUnique({ where: { key: seriesKey }, select: { id: true } });
  if (!series) return null;
  const sources = (await db.catalogSource.findMany({ where: { active: true }, select: { key: true } })).map(
    (x) => x.key,
  );
  const gens = await db.catalogGeneration.findMany({
    where: { seriesId: series.id, source: { in: sources } },
    select: {
      id: true,
      key: true,
      code: true,
      facelift: true,
      source: true,
      startYear: true,
      endYear: true,
    },
  });
  const fotolar = await db.catalogImage.findMany({
    where: {
      status: 'secildi',
      OR: [{ generationId: { in: gens.map((g) => g.id) } }, { seriesId: series.id }],
    },
    select: FOTO_ALANLARI,
  });
  return { seriesId: series.id, gens, fotolar };
}

/** Talep ya da alternatif yılları: "2019 ve sonrası" → [2019, bu yıl]; "2015 ve öncesi" → [2015, 2015] */
export function yilAraligi(
  min: number | null | undefined,
  max: number | null | undefined,
  buYil = new Date().getFullYear(),
): [number, number] | null {
  if (!min && !max) return null;
  const a = min ?? (max as number);
  return [a, Math.max(a, max ?? buYil)];
}

export interface TalepFotoSonucu {
  foto?: FotoSatiri;
  yakin: FotoYakin;
  hedef: FotoHedef;
}

/**
 * Talebin alternatif başına görseli. Her alternatifte önce kasalar sırayla denenir, kasa yoksa yıllar. `ana`: kartta
 * gösterilen (fotoğraflı ilk alternatif); hiçbirinde yoksa ilk alternatifin hedefiyle fotoğrafsız sonuç.
 */
export function talepFotolari(
  v: FotoVerisi,
  talep: { yearMin: number | null; yearMax: number | null },
  alternatifler: readonly Record<string, unknown>[],
): { alternatifler: { ilk: TalepFotoSonucu; kasa: Map<string, TalepFotoSonucu> }[]; ana: TalepFotoSonucu } {
  const sec = (kasa: string | null, yillar: [number, number] | null) =>
    talepFotosu(v.gens, v.fotolar, v.seriesId, kasa, yillar);
  const alts = (alternatifler.length ? alternatifler : [{}]).map((a) => {
    const y = a.yil as { min?: number; max?: number } | undefined;
    const yillar = yilAraligi(y?.min ?? talep.yearMin, y?.max ?? talep.yearMax);
    const kasalar = (a.kasa as string[] | undefined) ?? [];
    const kasa = new Map(kasalar.map((k) => [k, sec(k, yillar)] as const));
    const ilk = [...kasa.values()].find((r) => r.foto) ?? kasa.values().next().value ?? sec(null, yillar);
    return { ilk, kasa };
  });
  const ana = alts.find((a) => a.ilk.foto)?.ilk ?? (alts[0]?.ilk as TalepFotoSonucu);
  return { alternatifler: alts, ana };
}

/**
 * Yayına giren talebin görseli yoksa uyarı bilgisi (işçi; konsolda "Talep görselsiz yayına girdi"). Metinde kişisel
 * veri yok: talep numarası ve aracın marka/model adı.
 */
export async function gorselsizTalep(db: Db, demandId: string) {
  const d = await db.demand.findUnique({
    where: { id: demandId },
    select: {
      no: true,
      status: true,
      seriesKey: true,
      makeKey: true,
      yearMin: true,
      yearMax: true,
      data: true,
    },
  });
  if (d?.status !== 'PUBLISHED' || !d.seriesKey) return null;
  const v = await fotoVerisi(db, d.seriesKey);
  if (!v) return null;
  const alts = (d.data as { alternatifler?: Record<string, unknown>[] } | null)?.alternatifler ?? [];
  if (talepFotolari(v, d, alts).ana.foto) return null;
  const s = await db.catalogSeries.findUnique({
    where: { id: v.seriesId },
    select: { name: true, make: { select: { name: true } } },
  });
  return { no: Number(d.no), arac: s ? `${s.make.name} ${s.name}` : d.seriesKey };
}
