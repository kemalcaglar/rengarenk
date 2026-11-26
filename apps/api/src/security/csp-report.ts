import { Body, Controller, HttpCode, Logger, Post } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

/** Tarayıcıların CSP ihlal bildirimi türleri: eski report-uri ve Reporting API (report-to) */
const TURLER = ['application/csp-report', 'application/reports+json'] as const;
const SINIR = 64 * 1024;
/** Aynı ihlal (yönerge, engellenen kaynak, sayfa) en çok bu aralıkta bir kez günlüğe yazılır */
const ARALIK_MS = 10 * 60 * 1000;
const EN_COK_ANAHTAR = 1000;

/** CSP bildirimlerinin gövdesi JSON olarak okunur (uygulama başlatılmadan önce çağrılır: bootstrap ve testler) */
export function registerCspReportBody(app: NestFastifyApplication) {
  const fastify = app.getHttpAdapter().getInstance();
  for (const tur of TURLER) {
    if (fastify.hasContentTypeParser(tur)) continue;
    fastify.addContentTypeParser(tur, { parseAs: 'string', bodyLimit: SINIR }, (_req, body, done) => {
      try {
        done(null, JSON.parse(body as string));
      } catch {
        done(null, null);
      }
    });
  }
}

export interface CspIhlali {
  yonerge: string;
  engellenen: string;
  sayfa: string;
}

/** URL'nin yalnızca kaynağı ("https://connect.facebook.net"); inline, eval gibi anahtar sözcükler olduğu gibi */
function kaynak(u: unknown): string {
  const s = typeof u === 'string' ? u : '';
  if (!s) return '';
  try {
    return new URL(s).origin;
  } catch {
    return s.slice(0, 40);
  }
}

/** Sayfanın yalnızca yolu: sorgu ve parça yazılmaz (arama metni, belirteç gibi kişisel veri taşıyabilir) */
function yol(u: unknown): string {
  const s = typeof u === 'string' ? u : '';
  try {
    return new URL(s).pathname.slice(0, 120);
  } catch {
    return '';
  }
}

/** İki biçimi de ortak ihlal listesine çevirir; tanınmayan gövde boş liste */
export function cspIhlalleri(govde: unknown): CspIhlali[] {
  const sonuc: CspIhlali[] = [];
  const ekle = (r: Record<string, unknown> | undefined) => {
    if (!r || typeof r !== 'object') return;
    const yonerge = String(
      r['effective-directive'] ?? r.effectiveDirective ?? r['violated-directive'] ?? '',
    ).slice(0, 40);
    if (!yonerge) return;
    sonuc.push({
      yonerge,
      engellenen: kaynak(r['blocked-uri'] ?? r.blockedURL),
      sayfa: yol(r['document-uri'] ?? r.documentURL),
    });
  };
  if (Array.isArray(govde)) {
    for (const x of govde.slice(0, 20))
      if (x && typeof x === 'object' && (x as { type?: string }).type === 'csp-violation')
        ekle((x as { body?: Record<string, unknown> }).body);
  } else if (govde && typeof govde === 'object')
    ekle((govde as { 'csp-report'?: Record<string, unknown> })['csp-report']);
  return sonuc;
}

/**
 * CSP ihlal bildirimleri (web sitesi önce yalnızca rapor eden modda: Content-Security-Policy-Report-Only). Hiçbir şey
 * engellenmez; kurala uymayan kaynak günlüğe yazılır, kural sıkılaştırılmadan önce buradan bakılır. Herkese açık uç:
 * gövde 64 KB ile sınırlı, aynı ihlal 10 dakikada bir kez yazılır.
 */
@Controller('guvenlik')
export class CspReportController {
  private readonly log = new Logger('CSP');
  private readonly son = new Map<string, number>();

  @Post('csp-rapor')
  @HttpCode(204)
  rapor(@Body() govde: unknown) {
    const simdi = Date.now();
    for (const i of cspIhlalleri(govde)) {
      const anahtar = `${i.yonerge}|${i.engellenen}|${i.sayfa}`;
      const once = this.son.get(anahtar);
      if (once && simdi - once < ARALIK_MS) continue;
      if (this.son.size >= EN_COK_ANAHTAR) this.son.clear();
      this.son.set(anahtar, simdi);
      this.log.warn({ csp: i }, 'CSP ihlali');
    }
  }
}
