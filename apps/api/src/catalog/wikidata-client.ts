import {
  type EnwikiProduction,
  infoboxField,
  WIKIDATA_GENERATIONS_QUERY,
  type WikidataGenRow,
  wikidataRows,
} from '@rengarenk/catalog';

/**
 * Wikidata sorgu servisi ve İngilizce Vikipedi API'si. Wikimedia, otomatik istemcilerden açıklayıcı bir kullanıcı
 * ajanı ister. Kişisel veri gönderilmez; yalnızca herkese açık sorgu.
 */
export interface WikidataClient {
  generations(): Promise<WikidataGenRow[]>;
  /** Madde adı → bilgi kutusundaki üretim alanı ve sürüm numarası */
  productions(titles: string[]): Promise<Record<string, EnwikiProduction>>;
}

export const WIKIDATA_CLIENT = Symbol('WIKIDATA_CLIENT');

const HEADERS = { 'user-agent': 'Rengarenk-katalog/1.0 (https://rengarenksite.com)' };
const BATCH = 40;

export class HttpWikidataClient implements WikidataClient {
  constructor(private readonly fetchFn: typeof fetch = fetch) {}

  async generations(): Promise<WikidataGenRow[]> {
    const url = `https://query.wikidata.org/sparql?${new URLSearchParams({
      query: WIKIDATA_GENERATIONS_QUERY,
      format: 'json',
    })}`;
    const r = await this.fetchFn(url, {
      headers: { ...HEADERS, accept: 'application/sparql-results+json' },
      signal: AbortSignal.timeout(120_000),
    });
    if (!r.ok) throw new Error(`Wikidata sorgusu başarısız (${r.status})`);
    const body = (await r.json()) as { results?: { bindings?: Parameters<typeof wikidataRows>[0] } };
    return wikidataRows(body.results?.bindings ?? []);
  }

  async productions(titles: string[]): Promise<Record<string, EnwikiProduction>> {
    const out: Record<string, EnwikiProduction> = {};
    const unique = [...new Set(titles)];
    for (let i = 0; i < unique.length; i += BATCH) {
      const part = unique.slice(i, i + BATCH);
      const url = `https://en.wikipedia.org/w/api.php?${new URLSearchParams({
        action: 'query',
        prop: 'revisions',
        rvprop: 'content|ids',
        rvslots: 'main',
        titles: part.join('|'),
        redirects: '1',
        format: 'json',
        formatversion: '2',
      })}`;
      const r = await this.fetchFn(url, { headers: HEADERS, signal: AbortSignal.timeout(60_000) });
      if (!r.ok) throw new Error(`Vikipedi sorgusu başarısız (${r.status})`);
      const body = (await r.json()) as {
        query?: {
          redirects?: { from: string; to: string }[];
          normalized?: { from: string; to: string }[];
          pages?: { title: string; revisions?: { revid: number; slots: { main: { content: string } } }[] }[];
        };
      };
      // Yönlendirilen ve biçimlenen adlar istenen ada geri bağlanır.
      const back = new Map<string, string>();
      for (const n of body.query?.normalized ?? []) back.set(n.to, n.from);
      for (const rd of body.query?.redirects ?? []) back.set(rd.to, back.get(rd.from) ?? rd.from);
      for (const p of body.query?.pages ?? []) {
        const rev = p.revisions?.[0];
        if (!rev) continue;
        out[back.get(p.title) ?? p.title] = {
          revision: rev.revid,
          production: infoboxField(rev.slots.main.content),
        };
      }
    }
    return out;
  }
}
