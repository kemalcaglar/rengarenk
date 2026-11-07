import type { Env } from '../config/env.js';

/**
 * TSB sitesinden en son kasko değer listesi dosyası. Sitenin indirme düğmesinin kullandığı adres:
 * `/InsuranceData/GetLatestExcelFile` → `{ Result: "/content/InsuranceExcelFiles/202610R2.xlsx", Message: "Ekim" }`.
 * Bu, belgelenmiş bir API değildir ve değişebilir; sahip kararıyla (7 Kasım 2026) konsoldan yüklemenin yanında
 * kullanılır. Kırılırsa kalite kontrolü yayını durdurur ve dosya konsoldan yüklenir.
 */
export interface TsbLatest {
  fileName: string;
  url: string;
  monthLabel: string;
}

export interface TsbClient {
  latest(): Promise<TsbLatest>;
  /** Geçmiş bir ayın dosyası (sitedeki "Kasko Değer Listesi Arşivi"); yoksa null. TSB arşivi Nisan 2020'den başlar. */
  archive(year: number, month: number): Promise<TsbLatest | null>;
  download(url: string): Promise<Uint8Array>;
}

export const TSB_CLIENT = Symbol('TSB_CLIENT');

const MAX_BYTES = 30 * 1024 * 1024;
// HTTP başlıkları yalnızca ASCII kabul eder (Türkçe harf hatası olmaz).
const HEADERS = { 'user-agent': 'Rengarenk-katalog/1.0', 'x-requested-with': 'XMLHttpRequest' };

export class HttpTsbClient implements TsbClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async latest(): Promise<TsbLatest> {
    const r = await this.fetchFn(`${this.baseUrl}/InsuranceData/GetLatestExcelFile`, {
      headers: { ...HEADERS, accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) throw new Error(`TSB son dosya bilgisi alınamadı (${r.status})`);
    const body = (await r.json()) as { HasError?: boolean; Message?: string; Result?: string | null };
    if (body.HasError || !body.Result) throw new Error('TSB son dosya bilgisi boş döndü');
    return this.fileInfo(body.Result, body.Message ?? '');
  }

  async archive(year: number, month: number): Promise<TsbLatest | null> {
    // Sitedeki ay kimlikleri Ocak = 2 … Aralık = 13 (GetMonthList).
    const q = new URLSearchParams({ Year: String(year), MonthId: String(month + 1) });
    const r = await this.fetchFn(`${this.baseUrl}/InsuranceData/GetInsuranceDataArchiveFile?${q}`, {
      headers: { ...HEADERS, accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) throw new Error(`TSB arşiv bilgisi alınamadı (${r.status})`);
    const path = (await r.json()) as string | null;
    if (!path) return null;
    return this.fileInfo(path, `${year}-${String(month).padStart(2, '0')}`);
  }

  private fileInfo(path: string, monthLabel: string): TsbLatest {
    const url = new URL(path, this.baseUrl).toString();
    if (new URL(url).origin !== new URL(this.baseUrl).origin)
      throw new Error('TSB dosya adresi beklenmeyen bir sitede');
    const fileName = decodeURIComponent(url.split('/').pop() ?? '');
    if (!/\.xlsx$/i.test(fileName)) throw new Error(`TSB dosyası xlsx değil: ${fileName}`);
    return { fileName, url, monthLabel };
  }

  async download(url: string): Promise<Uint8Array> {
    const r = await this.fetchFn(url, { headers: HEADERS, signal: AbortSignal.timeout(120_000) });
    if (!r.ok) throw new Error(`TSB dosyası indirilemedi (${r.status})`);
    const size = Number(r.headers.get('content-length') ?? 0);
    if (size > MAX_BYTES) throw new Error('TSB dosyası beklenenden büyük');
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) throw new Error('TSB dosyası beklenenden büyük');
    return buf;
  }
}

export const createTsbClient = (env: Env): TsbClient => new HttpTsbClient(env.TSB_BASE_URL);
