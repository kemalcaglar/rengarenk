import { type CommonsCandidate, commonsCandidates, commonsCategoryUrl } from '@rengarenk/catalog';

/**
 * Wikimedia Commons API'si ve dosya sunucusu. Wikimedia açıklayıcı bir kullanıcı ajanı ister; yalnızca herkese
 * açık dosyalar okunur. İndirme yalnızca Wikimedia dosya sunucularından yapılır.
 */
export interface CommonsClient {
  candidates(category: string): Promise<CommonsCandidate[]>;
  download(url: string): Promise<{ body: Uint8Array; contentType: string }>;
}

export const COMMONS_CLIENT = Symbol('COMMONS_CLIENT');

const HEADERS = { 'user-agent': 'Rengarenk-katalog/1.0 (https://rengarenksite.com)' };
const FILE_HOSTS = ['upload.wikimedia.org', 'thumb.wikimedia.org'];
const MAX_BYTES = 15 * 1024 * 1024;

export class HttpCommonsClient implements CommonsClient {
  constructor(private readonly fetchFn: typeof fetch = fetch) {}

  async candidates(category: string): Promise<CommonsCandidate[]> {
    const r = await this.fetchFn(commonsCategoryUrl(category), {
      headers: HEADERS,
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) throw new Error(`Commons sorgusu başarısız (${r.status})`);
    return commonsCandidates((await r.json()) as Parameters<typeof commonsCandidates>[0]);
  }

  async download(url: string) {
    if (!FILE_HOSTS.includes(new URL(url).hostname)) throw new Error('Fotoğraf adresi Wikimedia değil');
    const r = await this.fetchFn(url, {
      headers: HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(60_000),
    });
    if (!r.ok) throw new Error(`Fotoğraf indirilemedi (${r.status})`);
    if (!FILE_HOSTS.includes(new URL(r.url || url).hostname))
      throw new Error('İndirme Wikimedia dışına yönlendi');
    const contentType = r.headers.get('content-type') ?? 'image/jpeg';
    if (!/^image\/(jpeg|png)/.test(contentType)) throw new Error('Dosya JPEG ya da PNG değil');
    const body = new Uint8Array(await r.arrayBuffer());
    if (body.byteLength > MAX_BYTES) throw new Error('Fotoğraf beklenenden büyük');
    return { body, contentType: contentType.split(';')[0] as string };
  }
}
