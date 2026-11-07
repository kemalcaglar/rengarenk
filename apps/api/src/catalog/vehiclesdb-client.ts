/**
 * VehiclesDB sürümleri (GitHub, CC BY 4.0). Her sürümde `vehicles.csv` (veri) ve `ATTRIBUTION.md` (zorunlu atıf
 * metni: üst kaynak tescil kayıtlarının lisans beyanları) bulunur. Yalnızca GitHub'dan indirilir.
 */
export interface VehiclesDbRelease {
  tag: string;
  csvUrl: string;
  attributionUrl: string | null;
}

export interface VehiclesDbClient {
  latest(): Promise<VehiclesDbRelease>;
  download(url: string, maxBytes?: number): Promise<Uint8Array>;
}

export const VEHICLESDB_CLIENT = Symbol('VEHICLESDB_CLIENT');

const REPO = 'vehiclesdb/vehiclesdb';
const HEADERS = { 'user-agent': 'Rengarenk-katalog/1.0' };
const ALLOWED_HOSTS = [
  'github.com',
  'api.github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
];

export class HttpVehiclesDbClient implements VehiclesDbClient {
  constructor(private readonly fetchFn: typeof fetch = fetch) {}

  async latest(): Promise<VehiclesDbRelease> {
    const r = await this.fetchFn(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { ...HEADERS, accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) throw new Error(`VehiclesDB sürüm bilgisi alınamadı (${r.status})`);
    const body = (await r.json()) as {
      tag_name?: string;
      assets?: { name: string; browser_download_url: string }[];
    };
    const csv = body.assets?.find((a) => a.name === 'vehicles.csv');
    if (!body.tag_name || !csv) throw new Error('Son VehiclesDB sürümünde vehicles.csv yok');
    const att = body.assets?.find((a) => a.name === 'ATTRIBUTION.md');
    return {
      tag: body.tag_name,
      csvUrl: csv.browser_download_url,
      attributionUrl: att?.browser_download_url ?? null,
    };
  }

  async download(url: string, maxBytes = 30 * 1024 * 1024): Promise<Uint8Array> {
    if (!ALLOWED_HOSTS.includes(new URL(url).hostname)) throw new Error('İndirme adresi GitHub değil');
    const r = await this.fetchFn(url, {
      headers: HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(120_000),
    });
    if (!r.ok) throw new Error(`VehiclesDB indirilemedi (${r.status})`);
    if (!ALLOWED_HOSTS.includes(new URL(r.url || url).hostname))
      throw new Error('İndirme GitHub dışına yönlendi');
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.byteLength > maxBytes) throw new Error('VehiclesDB dosyası beklenenden büyük');
    return buf;
  }
}
