import { Inject, Injectable } from '@nestjs/common';
import { type CategoryDefinition, effectiveFields, fieldVisible } from '@rengarenk/shared';
import { ENV, type Env } from '../config/env.js';

/** Portföy aracının arama belgesi: yalnızca sert koşullarda kullanılan alanlar (kişisel veri yok) */
export interface VehicleDoc {
  hesap: string;
  kategori: string;
  marka: string | null;
  il: string;
  ilce: string | null;
  fiyat: number;
  sasi: boolean;
  podye: boolean;
  airbag: boolean;
  agir: boolean;
}

const VEHICLE_PROPS = {
  hesap: { type: 'keyword' },
  kategori: { type: 'keyword' },
  marka: { type: 'keyword' },
  il: { type: 'keyword' },
  ilce: { type: 'keyword' },
  fiyat: { type: 'long' },
  sasi: { type: 'boolean' },
  podye: { type: 'boolean' },
  airbag: { type: 'boolean' },
  agir: { type: 'boolean' },
} as const;

const SETTINGS = { number_of_shards: 1, number_of_replicas: 0 };

type Query = Record<string, unknown>;

const ISLEM_ALAN = { sasi: 'sasi', podye: 'podye', airbag: 'airbag', agir: 'agir' } as const;

/**
 * Talebin sert koşulları OpenSearch sorgusu olarak (Teknik tasarım §6, T04): kategori, alıcının ili, seçilen marka,
 * alıcının kabul etmediği işlemler ve alternatiflerden en az birinin bütçe üst sınırı (+%5). Aynı sorgu iki yönde
 * kullanılır: talepten araçlara arama ve araçtan taleplere kayıtlı sorgu (percolator). Skoru `evaluateMatch` verir.
 * "Kimden" yalnızca sahibinden ise galeriyle eşleşme olmaz (`null`).
 */
export function demandQuery(
  def: CategoryDefinition,
  categoryId: string,
  data: { alanlar: Record<string, unknown>; alternatifler: Record<string, unknown>[] },
): Query | null {
  const alanlar = data.alanlar ?? {};
  const kimden = alanlar.kimden;
  if (Array.isArray(kimden) && kimden.length && !kimden.includes('galeri')) return null;
  const filter: Query[] = [{ term: { kategori: categoryId } }];
  const konum = alanlar.konum as { il?: string } | undefined;
  if (konum?.il) filter.push({ term: { il: konum.il } });
  const fields = effectiveFields(def);
  const model = fields.find((f) => f.type === 'catalog');
  const make = model ? (alanlar[model.key] as { make?: string } | undefined)?.make : undefined;
  if (make) filter.push({ term: { marka: make } });
  const mustNot: Query[] = [];
  const islem = fields.find((f) => f.key === 'islemKabul');
  if (islem && fieldVisible(islem, alanlar)) {
    const kabul = Array.isArray(alanlar.islemKabul) ? (alanlar.islemKabul as string[]) : [];
    for (const [k, alan] of Object.entries(ISLEM_ALAN)) {
      if (!kabul.includes(k)) mustNot.push({ term: { [alan]: true } });
    }
  }
  const alts = data.alternatifler?.length ? data.alternatifler : [{}];
  const should = alts.map((a) => {
    const max = (a.butce as { max?: number } | undefined)?.max;
    return max === undefined ? { match_all: {} } : { range: { fiyat: { lte: Math.floor(max * 1.05) } } };
  });
  return { bool: { filter, must_not: mustNot, should, minimum_should_match: 1 } };
}

/**
 * Eşleştirme indeksleri: yayındaki portföy araçları ve yayındaki taleplerin kayıtlı sorguları. İşçi olaylarla günceller,
 * her gece yeniden kurar. Yazmalar `refresh=wait_for` ile görünür olduktan sonra döner; böylece aynı anda yayına giren
 * talep ve araç birbirini kaçırmaz.
 */
@Injectable()
export class MatchIndexService {
  private readonly vehicles: string;
  private readonly queries: string;
  private ready = false;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.vehicles = `${env.OPENSEARCH_PREFIX}_portfoy`;
    this.queries = `${env.OPENSEARCH_PREFIX}_talep_sorgu`;
  }

  private async os<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    const r = await fetch(`${this.env.OPENSEARCH_URL}/${path}`, {
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await r.json().catch(() => ({}))) as T & { error?: unknown };
    if (!r.ok && !(method === 'DELETE' && r.status === 404)) {
      throw new Error(
        `OpenSearch ${method} ${path}: ${r.status} ${JSON.stringify(data.error ?? data).slice(0, 300)}`,
      );
    }
    return data;
  }

  async ensure() {
    if (this.ready) return;
    const kur = async (index: string, properties: Record<string, unknown>) => {
      const head = await fetch(`${this.env.OPENSEARCH_URL}/${index}`, { method: 'HEAD' });
      if (head.status === 404) {
        // Başka süreç (API ya da işçi) aynı anda kurmuş olabilir: "zaten var" hatası yok sayılıp eşleme güncellenir
        try {
          await this.os('PUT', index, { settings: SETTINGS, mappings: { dynamic: 'strict', properties } });
          return;
        } catch (e) {
          if (!(e as Error).message.includes('resource_already_exists_exception')) throw e;
        }
      }
      await this.os('PUT', `${index}/_mapping`, { properties });
    };
    await kur(this.vehicles, VEHICLE_PROPS);
    await kur(this.queries, { ...VEHICLE_PROPS, talep: { type: 'keyword' }, sorgu: { type: 'percolator' } });
    this.ready = true;
  }

  /** Gecelik yeniden kurulum için iki indeksi siler */
  async reset() {
    await this.os('DELETE', this.vehicles);
    await this.os('DELETE', this.queries);
    this.ready = false;
    await this.ensure();
  }

  async putVehicle(id: string, doc: VehicleDoc) {
    await this.ensure();
    await this.os('PUT', `${this.vehicles}/_doc/${id}?refresh=wait_for`, doc);
  }

  async removeVehicle(id: string) {
    await this.ensure();
    await this.os('DELETE', `${this.vehicles}/_doc/${id}?refresh=wait_for`);
  }

  async putDemand(id: string, query: Query) {
    await this.ensure();
    await this.os('PUT', `${this.queries}/_doc/${id}?refresh=wait_for`, { talep: id, sorgu: query });
  }

  async removeDemand(id: string) {
    await this.ensure();
    await this.os('DELETE', `${this.queries}/_doc/${id}?refresh=wait_for`);
  }

  /** Talepten araçlara: sert koşullara uyan yayındaki araçlar */
  async searchVehicles(query: Query, size = 1000): Promise<string[]> {
    await this.ensure();
    const r = await this.os<{ hits: { hits: { _id: string }[] } }>('POST', `${this.vehicles}/_search`, {
      query,
      size,
      _source: false,
    });
    return r.hits.hits.map((h) => h._id);
  }

  /** Araçtan taleplere: aracı kabul eden kayıtlı sorgular (percolator) */
  async percolate(doc: VehicleDoc, size = 1000): Promise<string[]> {
    await this.ensure();
    const r = await this.os<{ hits: { hits: { _id: string }[] } }>('POST', `${this.queries}/_search`, {
      query: { percolate: { field: 'sorgu', document: doc } },
      size,
      _source: false,
    });
    return r.hits.hits.map((h) => h._id);
  }
}
