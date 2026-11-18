import type { DonanimGrubu, TeknikDuzeltme } from '@rengarenk/shared';
import type { Db } from '../database/prisma.js';

export interface MotorDonanimi {
  /** Pakete özel kayıtsa paketin adı; boşsa bütün paketler */
  paket: string | null;
  gruplar: DonanimGrubu[];
}

/** Etkin bir elle giriş kaydı (konsol › Teknik özellikler) */
export interface ElleKayit {
  modelId: string;
  trimId: string | null;
  paket: string | null;
  gearbox: string | null;
  values: TeknikDuzeltme;
  equipment: DonanimGrubu[] | null;
}

/**
 * Konsoldan elle girilen teknik değerler ve donanım (sahip isteği, 17 ve 18 Kasım 2026): motor sürümlerinin (model)
 * etkin kayıtları, yıl aralığı talebin ya da seçilen kasanın yıllarıyla örtüşenler. Yıl bilinmiyorsa yalnızca yılı
 * yazılmamış kayıtlar gelir. Pakete özel kayıt yalnızca o paket seçildiyse gelir (`paketKeys`). Sıra: genelden özele
 * (paketsiz ve vitessiz önce), aynı özgüllükte eskiden yeniye; böylece `kayitlariSec` sonrakini öncekinin üstüne yazar.
 */
export async function elleKayitlari(
  db: Db,
  modelIds: readonly string[],
  aralik: [number, number] | null,
  paketKeys: readonly string[] = [],
): Promise<ElleKayit[]> {
  if (!modelIds.length) return [];
  const rows = await db.catalogSpecOverride.findMany({
    where: {
      modelId: { in: [...new Set(modelIds)] },
      status: 'aktif',
      OR: [{ trimId: null }, ...(paketKeys.length ? [{ trim: { key: { in: [...paketKeys] } } }] : [])],
      ...(aralik
        ? {
            AND: [
              { OR: [{ yearFrom: null }, { yearFrom: { lte: aralik[1] } }] },
              { OR: [{ yearTo: null }, { yearTo: { gte: aralik[0] } }] },
            ],
          }
        : { yearFrom: null, yearTo: null }),
    },
    select: {
      modelId: true,
      values: true,
      equipment: true,
      trimId: true,
      gearbox: true,
      createdAt: true,
      trim: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  const ozgul = (r: { trimId: string | null; gearbox: string | null }) =>
    (r.trimId ? 1 : 0) + (r.gearbox ? 1 : 0);
  return rows
    .sort((a, b) => ozgul(a) - ozgul(b) || a.createdAt.getTime() - b.createdAt.getTime())
    .map((r) => ({
      modelId: r.modelId,
      trimId: r.trimId,
      paket: r.trim?.name ?? null,
      gearbox: r.gearbox,
      values: r.values as TeknikDuzeltme,
      equipment: (r.equipment as DonanimGrubu[] | null) ?? null,
    }));
}

/**
 * Bir motor sürümünün tip grubuna uyan kayıtlar: vitese özel kayıt yalnızca vitesi aynı olan tipe uygulanır
 * (`vitesler`: grubun vitesleri; boş ya da null ise yalnızca vitessiz kayıtlar). Teknik değerler sırayla
 * (`duzeltmeUygula`); donanımda paket başına en özel ve en yeni liste geçerlidir.
 */
export function kayitlariSec(
  kayitlar: readonly ElleKayit[],
  modelId: string,
  vitesler: readonly string[] | null,
): { degerler: TeknikDuzeltme[]; donanim: MotorDonanimi[] } {
  const uyan = kayitlar.filter(
    (k) => k.modelId === modelId && (!k.gearbox || (vitesler ?? []).includes(k.gearbox)),
  );
  const degerler = uyan.map((k) => k.values).filter((v) => Object.keys(v).length);
  const paketBasina = new Map<string, MotorDonanimi>();
  for (const k of uyan)
    if (k.equipment?.length) paketBasina.set(k.trimId ?? '', { paket: k.paket, gruplar: k.equipment });
  // Bütün paketlerin listesi önce, sonra paketler adıyla
  const donanim = [...paketBasina.values()].sort((a, b) =>
    a.paket === null ? -1 : b.paket === null ? 1 : a.paket.localeCompare(b.paket, 'tr'),
  );
  return { degerler, donanim };
}

/** Yalnızca teknik değerler, vitessiz kayıtlar (sihirbazdaki seri ayrıntısı; pakete özel kayıtlar uygulanmaz) */
export async function duzeltmeleri(
  db: Db,
  modelIds: readonly string[],
  aralik: [number, number] | null,
): Promise<Map<string, TeknikDuzeltme[]>> {
  const kayitlar = await elleKayitlari(db, modelIds, aralik);
  return new Map(modelIds.map((id) => [id, kayitlariSec(kayitlar, id, null).degerler]));
}
