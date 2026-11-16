import { ADEME_GUNCEL } from '@rengarenk/catalog';

/**
 * ADEME araç onay verisi (Karar 33): yıllık dosyalar data.gouv.fr'den (zip), güncel liste data.ademe.fr'nin satır
 * API'sinden (sayfalı JSON). Yalnızca bu iki siteden indirilir.
 */
export interface AdemeClient {
  dosya(url: string): Promise<Uint8Array>;
  guncel(): Promise<Record<string, unknown>[]>;
}

export const ADEME_CLIENT = Symbol('ADEME_CLIENT');

const HEADERS = { 'user-agent': 'Rengarenk-katalog/1.0', accept: 'application/json' };
const MAX_BYTES = 30 * 1024 * 1024;
const IZINLI = ['www.data.gouv.fr', 'static.data.gouv.fr', 'data.ademe.fr'];
const izinli = (u: string) => IZINLI.includes(new URL(u).hostname);

export class HttpAdemeClient implements AdemeClient {
  constructor(private readonly fetchFn: typeof fetch = fetch) {}

  /** Sunucu kısa süreli 503 verebilir: üç deneme */
  async dosya(url: string): Promise<Uint8Array> {
    for (let i = 1; ; i++) {
      try {
        return await this.indir(url);
      } catch (err) {
        if (i >= 3 || /beklenmeyen|yönlendi|büyük/.test((err as Error).message)) throw err;
        await new Promise((r) => setTimeout(r, 3000 * i));
      }
    }
  }

  private async indir(url: string): Promise<Uint8Array> {
    if (!izinli(url)) throw new Error('ADEME dosya adresi beklenmeyen bir sitede');
    const r = await this.fetchFn(url, {
      headers: HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(120_000),
    });
    if (!r.ok) throw new Error(`ADEME dosyası indirilemedi (${r.status})`);
    if (!izinli(r.url || url)) throw new Error('ADEME dosyası başka siteye yönlendi');
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) throw new Error('ADEME dosyası beklenenden büyük');
    return buf;
  }

  /** Güncel listenin bütün satırları (sayfa sayfa; en çok 50 sayfa) */
  async guncel(): Promise<Record<string, unknown>[]> {
    const out: Record<string, unknown>[] = [];
    let url: string | undefined = `${ADEME_GUNCEL}?size=1000`;
    for (let sayfa = 0; url && sayfa < 50; sayfa++) {
      if (!izinli(url)) throw new Error('ADEME sayfa adresi beklenmeyen bir sitede');
      const r = await this.fetchFn(url, { headers: HEADERS, signal: AbortSignal.timeout(60_000) });
      if (!r.ok) throw new Error(`ADEME güncel liste alınamadı (${r.status})`);
      const body = (await r.json()) as { results?: Record<string, unknown>[]; next?: string };
      out.push(...(body.results ?? []));
      url = body.results?.length ? body.next : undefined;
    }
    return out;
  }
}
