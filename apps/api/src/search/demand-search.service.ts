import { Inject, Injectable, Logger } from '@nestjs/common';
import { type CategoryDefinition, effectiveFields } from '@rengarenk/shared';
import { ENV, type Env } from '../config/env.js';
import { type Db, PRISMA } from '../database/prisma.js';

type Values = Record<string, unknown>;

/** Liste ve arama filtreleri (GET /talepler) */
export interface DemandQuery {
  kategori?: string;
  marka?: string;
  seri?: string[];
  model?: string;
  makyaj?: string[];
  paket?: string[];
  yilMin?: number;
  yilMax?: number;
  butceMin?: number;
  butceMax?: number;
  il?: string;
  ilce?: string;
  telefon?: boolean;
  q?: string;
  sira?: 'onerilen' | 'yeni' | 'butce_azalan' | 'butce_artan';
  sayfa?: number;
  boyut?: number;
  /** Yalnızca bu tarihten sonra yayınlananlar (kayıtlı aramada "N yeni") */
  yayinSonra?: Date;
}

export interface DemandHit {
  no: number;
  baslik: string;
  arac: string;
  kategori: { slug: string; name: string };
  yilMin: number | null;
  yilMax: number | null;
  kmMax: number | null;
  butceMin: number | null;
  butceMax: number | null;
  il: string | null;
  ilce: string | null;
  alternatifler: number;
  telefon: boolean;
  yayin: string;
  /** Temsilî nesil fotoğrafı (Karar 24, 34): API'deki yolu */
  foto: string | null;
}

/** İndeks belgesinin alanları ve Türkçe çözümleyici (Teknik tasarım §12) */
const MAPPING = {
  settings: { number_of_shards: 1, number_of_replicas: 0 },
  mappings: {
    dynamic: 'strict',
    properties: {
      no: { type: 'long' },
      baslik: { type: 'text', analyzer: 'turkish', fields: { k: { type: 'keyword' } } },
      arac: { type: 'text', analyzer: 'turkish' },
      kategori: { type: 'keyword' },
      kategoriAd: { type: 'keyword', index: false },
      ustKategori: { type: 'keyword' },
      marka: { type: 'keyword' },
      markaAd: { type: 'text', analyzer: 'turkish' },
      markaEtiket: { type: 'keyword' },
      seri: { type: 'keyword' },
      seriAd: { type: 'keyword' },
      seriAdMetin: { type: 'text', analyzer: 'turkish' },
      model: { type: 'keyword' },
      modelAd: { type: 'text', analyzer: 'turkish' },
      makyaj: { type: 'keyword' },
      paket: { type: 'keyword' },
      secim: { type: 'keyword' },
      il: { type: 'keyword' },
      ilce: { type: 'keyword' },
      yilMin: { type: 'integer' },
      yilMax: { type: 'integer' },
      kmMax: { type: 'integer' },
      butceMin: { type: 'long' },
      butceMax: { type: 'long' },
      alternatifler: { type: 'integer' },
      telefon: { type: 'boolean' },
      yayin: { type: 'date' },
      bitis: { type: 'date' },
      /** Seçilmiş nesil fotoğrafının kimliği (vitrin ve liste kartları) */
      foto: { type: 'keyword' },
    },
  },
} as const;

const hit = (s: Record<string, unknown>): DemandHit =>
  ({
    no: s.no,
    baslik: s.baslik,
    arac: s.arac,
    kategori: { slug: s.kategori, name: s.kategoriAd },
    yilMin: s.yilMin,
    yilMax: s.yilMax,
    kmMax: s.kmMax,
    butceMin: s.butceMin,
    butceMax: s.butceMax,
    il: s.il,
    ilce: s.ilce,
    alternatifler: s.alternatifler,
    telefon: s.telefon,
    yayin: s.yayin,
    foto: s.foto ? `/catalog/images/${s.foto}` : null,
  }) as DemandHit;

/**
 * Talep araması (Karar 06.1, 06.3; Teknik tasarım §12). Yalnızca yayındaki talepler indekstedir; indeks talep
 * olaylarıyla (outbox → işçi) güncellenir, her gece tamamı yeniden kurulur. Kategori ve seri gibi çoklu seçimli
 * filtrelerin sayıları, kendi seçimi dışındaki filtrelerle hesaplanır.
 */
@Injectable()
export class DemandSearchService {
  private readonly log = new Logger(DemandSearchService.name);
  private readonly index: string;
  private ready = false;

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
  ) {
    this.index = `${env.OPENSEARCH_PREFIX}_talepler`;
  }

  private async os<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    const r = await fetch(`${this.env.OPENSEARCH_URL}/${this.index}${path}`, {
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await r.json().catch(() => ({}))) as T & { error?: unknown };
    if (!r.ok && !(method === 'DELETE' && r.status === 404)) {
      throw new Error(
        `OpenSearch ${method} ${path}: ${r.status} ${JSON.stringify(data.error ?? data).slice(0, 300)}`,
      );
    }
    return data;
  }

  /** İndeks yoksa kurar. */
  async ensureIndex() {
    if (this.ready) return;
    const head = await fetch(`${this.env.OPENSEARCH_URL}/${this.index}`, { method: 'HEAD' });
    if (head.status === 404) await this.os('PUT', '', MAPPING);
    // Var olan indekse yeni alanlar eklenir (alan silme ya da tür değişikliği yeniden kurulum ister)
    else await this.os('PUT', '/_mapping', { properties: MAPPING.mappings.properties });
    this.ready = true;
  }

  /** Talebin indeks kaydını günceller: yayındaysa yazar, değilse siler. */
  async sync(demandId: string, refresh = false) {
    await this.ensureIndex();
    const doc = await this.document(demandId);
    const q = refresh ? '?refresh=true' : '';
    if (doc) await this.os('PUT', `/_doc/${demandId}${q}`, doc);
    else await this.os('DELETE', `/_doc/${demandId}${q}`);
  }

  /** Bütün yayındaki talepleri yeniden yazar ve indekste artakalanları siler (gecelik tutarlılık). */
  async reindexAll(): Promise<number> {
    await this.ensureIndex();
    const ids = (await this.db.demand.findMany({ where: { status: 'PUBLISHED' }, select: { id: true } })).map(
      (d) => d.id,
    );
    for (const id of ids) await this.sync(id);
    await this.os('POST', '/_delete_by_query?refresh=true', {
      query: { bool: { must_not: { ids: { values: ids } } } },
    });
    return ids.length;
  }

  private async document(id: string) {
    const d = await this.db.demand.findUnique({
      where: { id },
      include: { category: { include: { parent: { select: { slug: true } } } } },
    });
    if (d?.status !== 'PUBLISHED' || !d.schemaVersion) return null;
    const v = await this.db.categorySchemaVersion.findUnique({
      where: { categoryId_version: { categoryId: d.categoryId, version: d.schemaVersion } },
    });
    const def = v?.definition as unknown as CategoryDefinition | undefined;
    const data = d.data as unknown as { alanlar: Values; alternatifler: Values[] };
    const alts = data.alternatifler ?? [];
    const [make, series, model] = await Promise.all([
      d.makeKey
        ? this.db.catalogMake.findUnique({ where: { key: d.makeKey }, select: { name: true } })
        : null,
      d.seriesKey
        ? this.db.catalogSeries.findUnique({ where: { key: d.seriesKey }, select: { name: true } })
        : null,
      d.modelKey
        ? this.db.catalogModel.findUnique({ where: { key: d.modelKey }, select: { name: true } })
        : null,
    ]);
    const kasa = [...new Set(alts.flatMap((a) => (a.kasa as string[] | undefined) ?? []))];
    const paketKey = [...new Set(alts.flatMap((a) => (a.paket as string[] | undefined) ?? []))];
    const paketler = paketKey.length
      ? await this.db.catalogTrim.findMany({
          where: { key: { in: paketKey } },
          select: { key: true, name: true },
        })
      : [];
    // "G20:1" → makyajlı; kodsuz kuşakta makyaj bilinmez
    const makyaj = [
      ...new Set(
        kasa
          .map((k) => /^[^:/]+:(\d+)$/.exec(k)?.[1])
          .filter((x): x is string => x !== undefined)
          .map((f) => (f === '0' ? 'makyajsiz' : 'makyajli')),
      ),
    ];
    // Filtrede işaretli seçim alanları: "yakit:benzin", "vites:otomatik"
    const secim = new Set<string>();
    for (const f of def ? effectiveFields(def) : []) {
      if (!f.filter || !['select', 'multiselect', 'boolean'].includes(f.type) || f.source === 'katalog')
        continue;
      for (const src of [data.alanlar, ...alts]) {
        const val = src?.[f.key];
        for (const x of Array.isArray(val) ? val : val === undefined ? [] : [val]) {
          secim.add(`${f.key}:${typeof x === 'boolean' ? (x ? 'evet' : 'hayir') : String(x)}`);
        }
      }
    }
    const kms = alts.map((a) => a.km).filter((x): x is number => typeof x === 'number');
    const ilk = alts[0] ?? {};
    const kasaAd = ((ilk.kasa as string[] | undefined) ?? []).map((k) => {
      const m = /^([^:/]+):(\d+)$/.exec(k);
      return m ? `${m[1]} ${m[2] === '0' ? 'makyajsız' : 'makyajlı'}` : null;
    });
    const ilkPaket = paketler
      .filter((p) => ((ilk.paket as string[] | undefined) ?? []).includes(p.key))
      .map((p) => p.name);
    const arac = [
      [make?.name, series?.name, model?.name].filter(Boolean).join(' '),
      kasaAd.filter(Boolean).join(' veya '),
      ilkPaket.length ? ilkPaket.join(' veya ') : kasaAd.length ? 'paket fark etmez' : '',
    ]
      .filter(Boolean)
      .join(' · ');
    // Temsilî fotoğraf: alternatiflerdeki ilk kasa kodunun seçilmiş Commons fotoğrafı (talep sayfasıyla aynı kural)
    const kodlar = [
      ...new Set(
        alts.flatMap((a) =>
          ((a.kasa as string[] | undefined) ?? [])
            .map((k) => /^([^:/]+):\d+$/.exec(k)?.[1])
            .filter((x): x is string => x !== undefined),
        ),
      ),
    ];
    const fotolar =
      d.seriesKey && kodlar.length
        ? await this.db.catalogImage.findMany({
            where: {
              status: 'secildi',
              generation: { source: 'wikidata', code: { in: kodlar }, series: { key: d.seriesKey } },
            },
            select: { id: true, generation: { select: { code: true } } },
          })
        : [];
    const wikidataAcik = fotolar.length
      ? Boolean(await this.db.catalogSource.findFirst({ where: { key: 'wikidata', active: true } }))
      : false;
    const foto = wikidataAcik
      ? (kodlar.map((k) => fotolar.find((f) => f.generation.code === k)).find(Boolean)?.id ?? null)
      : null;
    return {
      no: Number(d.no),
      baslik: d.headline || d.title || d.category.name,
      arac,
      kategori: d.category.slug,
      kategoriAd: d.category.name,
      ustKategori: d.category.parent?.slug ?? null,
      marka: d.makeKey,
      markaAd: make?.name ?? null,
      markaEtiket: make?.name ?? null,
      seri: d.seriesKey,
      seriAd: series?.name ?? null,
      seriAdMetin: series?.name ?? null,
      model: d.modelKey,
      modelAd: model?.name ?? null,
      makyaj,
      paket: paketler.map((p) => p.name),
      secim: [...secim],
      il: d.il,
      ilce: d.ilce,
      yilMin: d.yearMin,
      yilMax: d.yearMax,
      kmMax: kms.length ? Math.max(...kms) : null,
      butceMin: d.budgetMin === null ? null : Number(d.budgetMin),
      butceMax: d.budgetMax === null ? null : Number(d.budgetMax),
      alternatifler: alts.length,
      telefon: d.phoneVisible,
      yayin: d.publishedAt?.toISOString(),
      bitis: d.expiresAt?.toISOString(),
      foto,
    };
  }

  async search(q: DemandQuery) {
    await this.ensureIndex();
    const filter: unknown[] = [];
    if (q.kategori) {
      filter.push({
        bool: {
          should: [{ term: { kategori: q.kategori } }, { term: { ustKategori: q.kategori } }],
          minimum_should_match: 1,
        },
      });
    }
    if (q.marka) filter.push({ term: { marka: q.marka } });
    if (q.model) filter.push({ term: { model: q.model } });
    // Aralık örtüşmesi: talebin yıl/bütçe aralığı aranan aralıkla kesişiyorsa
    if (q.yilMin !== undefined) filter.push({ range: { yilMax: { gte: q.yilMin } } });
    if (q.yilMax !== undefined) filter.push({ range: { yilMin: { lte: q.yilMax } } });
    if (q.butceMin !== undefined) filter.push({ range: { butceMax: { gte: q.butceMin } } });
    if (q.butceMax !== undefined) filter.push({ range: { butceMin: { lte: q.butceMax } } });
    if (q.il) filter.push({ term: { il: q.il } });
    if (q.ilce) filter.push({ term: { ilce: q.ilce } });
    if (q.telefon) filter.push({ term: { telefon: true } });
    if (q.yayinSonra) filter.push({ range: { yayin: { gt: q.yayinSonra.toISOString() } } });
    const must: unknown[] = [];
    const text = q.q?.trim();
    if (text) {
      must.push({
        bool: {
          should: [
            ...(/^\d{5,9}$/.test(text) ? [{ term: { no: Number(text) } }] : []),
            {
              multi_match: {
                query: text,
                fields: ['baslik^3', 'markaAd^2', 'seriAdMetin^2', 'modelAd^2', 'arac'],
                operator: 'and',
                // Kısa sözcüklerde (320i, 520i, A3) bulanık eşleşme yok; uzun sözcüklerde yazım hatası hoş görülür
                fuzziness: 'AUTO:5,8',
              },
            },
          ],
          minimum_should_match: 1,
        },
      });
    }
    // Çoklu seçimli filtreler sonradan uygulanır; her birinin sayıları diğerleriyle hesaplanır
    const post: Record<string, unknown> = {};
    if (q.seri?.length) post.seri = { terms: { seri: q.seri } };
    if (q.makyaj?.length) post.makyaj = { terms: { makyaj: q.makyaj } };
    if (q.paket?.length) post.paket = { terms: { paket: q.paket } };
    const others = (k: string) => ({
      bool: {
        filter: Object.entries(post)
          .filter(([x]) => x !== k)
          .map(([, v]) => v),
      },
    });
    const size = Math.min(q.boyut ?? 20, 50);
    const from = (Math.max(q.sayfa ?? 1, 1) - 1) * size;
    const sort =
      q.sira === 'butce_azalan'
        ? [{ butceMax: { order: 'desc', missing: '_last' } }, { yayin: 'desc' }]
        : q.sira === 'butce_artan'
          ? [{ butceMin: { order: 'asc', missing: '_last' } }, { yayin: 'desc' }]
          : // Önerilen: metin aranıyorsa ilgiye göre, değilse en yeni (öne çıkarma ödeme modülüyle üste alınacak)
            text && q.sira !== 'yeni'
            ? ['_score', { yayin: 'desc' }]
            : [{ yayin: 'desc' }];
    const r = await this.os<{
      hits: { total: { value: number }; hits: { _source: Record<string, unknown> }[] };
      aggregations: Record<
        string,
        { b?: { buckets: { key: string; doc_count: number; ad?: { buckets: { key: string }[] } }[] } }
      >;
    }>('POST', '/_search', {
      from,
      size,
      track_total_hits: true,
      query: { bool: { filter, must } },
      post_filter: { bool: { filter: Object.values(post) } },
      sort,
      aggs: {
        marka: {
          filter: { bool: { filter: Object.values(post) } },
          aggs: {
            b: {
              terms: { field: 'marka', size: 60 },
              aggs: { ad: { terms: { field: 'markaEtiket', size: 1 } } },
            },
          },
        },
        seri: {
          filter: others('seri'),
          aggs: {
            b: { terms: { field: 'seri', size: 60 }, aggs: { ad: { terms: { field: 'seriAd', size: 1 } } } },
          },
        },
        makyaj: { filter: others('makyaj'), aggs: { b: { terms: { field: 'makyaj', size: 5 } } } },
        paket: { filter: others('paket'), aggs: { b: { terms: { field: 'paket', size: 30 } } } },
        il: {
          filter: { bool: { filter: Object.values(post) } },
          aggs: { b: { terms: { field: 'il', size: 81 } } },
        },
      },
    });
    const buckets = (k: string) => r.aggregations[k]?.b?.buckets ?? [];
    return {
      toplam: r.hits.total.value,
      sayfa: Math.floor(from / size) + 1,
      boyut: size,
      sonuclar: r.hits.hits.map(({ _source: s }) => hit(s)),
      filtreler: {
        marka: buckets('marka').map((b) => ({
          key: b.key,
          ad: b.ad?.buckets[0]?.key ?? b.key,
          n: b.doc_count,
        })),
        seri: buckets('seri').map((b) => ({
          key: b.key,
          ad: b.ad?.buckets[0]?.key ?? b.key,
          n: b.doc_count,
        })),
        makyaj: buckets('makyaj').map((b) => ({ key: b.key, n: b.doc_count })),
        paket: buckets('paket').map((b) => ({ ad: b.key, n: b.doc_count })),
        il: buckets('il').map((b) => ({ ad: b.key, n: b.doc_count })),
      },
    };
  }

  /**
   * Ana sayfa vitrini (Karar 12.6, 46): sıra her açılışta karışır. Ücretli vitrin ödeme modülüyle (Aşama 6) gelince
   * önce o talepler gösterilecek; boş yerler yayındaki taleplerle dolar, fotoğraflı olanlar önce.
   */
  async vitrin(boyut: number) {
    await this.ensureIndex();
    const r = await this.os<{
      hits: { total: { value: number }; hits: { _source: Record<string, unknown> }[] };
    }>('POST', '/_search', {
      size: Math.min(boyut, 50),
      track_total_hits: true,
      query: {
        function_score: {
          query: { match_all: {} },
          functions: [
            { random_score: { seed: Date.now(), field: '_seq_no' } },
            { filter: { exists: { field: 'foto' } }, weight: 2 },
          ],
          score_mode: 'sum',
          boost_mode: 'replace',
        },
      },
    });
    return { toplam: r.hits.total.value, sonuclar: r.hits.hits.map(({ _source: s }) => hit(s)) };
  }

  /** İndeks erişilemiyorsa listeyi düşürmemek için günlüğe yazılır (işçi yeniden dener). */
  warn(err: unknown) {
    this.log.warn(`arama indeksi: ${(err as Error).message}`);
  }
}
