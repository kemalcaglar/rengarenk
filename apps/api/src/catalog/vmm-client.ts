/**
 * vehicle-makes-models sürümleri (GitHub). Veri haftalık yenilenir; her sürümde `vehicle-data-csv.zip` içinde
 * `engines.csv` bulunur. Yalnızca GitHub'dan indirilir.
 */
export interface VmmRelease {
  tag: string;
  url: string;
  fileName: string;
}

export interface VmmClient {
  latest(): Promise<VmmRelease>;
  download(url: string): Promise<Uint8Array>;
}

export const VMM_CLIENT = Symbol('VMM_CLIENT');

const REPO = 'gor3a/vehicle-makes-models';
const ASSET = 'vehicle-data-csv.zip';
const MAX_BYTES = 50 * 1024 * 1024;
const HEADERS = { 'user-agent': 'Rengarenk-katalog/1.0' };
const ALLOWED_HOSTS = [
  'github.com',
  'api.github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
];

export class HttpVmmClient implements VmmClient {
  constructor(private readonly fetchFn: typeof fetch = fetch) {}

  async latest(): Promise<VmmRelease> {
    const r = await this.fetchFn(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { ...HEADERS, accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) throw new Error(`vehicle-makes-models sürüm bilgisi alınamadı (${r.status})`);
    const body = (await r.json()) as {
      tag_name?: string;
      assets?: { name: string; browser_download_url: string }[];
    };
    const asset = body.assets?.find((a) => a.name === ASSET);
    if (!body.tag_name || !asset) throw new Error(`Son sürümde ${ASSET} yok`);
    return { tag: body.tag_name, url: asset.browser_download_url, fileName: `${body.tag_name}/${ASSET}` };
  }

  async download(url: string): Promise<Uint8Array> {
    if (!ALLOWED_HOSTS.includes(new URL(url).hostname)) throw new Error('İndirme adresi GitHub değil');
    const r = await this.fetchFn(url, {
      headers: HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(120_000),
    });
    if (!r.ok) throw new Error(`vehicle-makes-models indirilemedi (${r.status})`);
    if (!ALLOWED_HOSTS.includes(new URL(r.url || url).hostname))
      throw new Error('İndirme GitHub dışına yönlendi');
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) throw new Error('vehicle-makes-models dosyası beklenenden büyük');
    return buf;
  }
}
