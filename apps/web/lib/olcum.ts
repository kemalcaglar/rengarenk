'use client';

import {
  AD_EVENTS,
  type AdEventName,
  adEventId,
  izinsizTemas,
  type Touch,
  touchFromUrl,
} from '@rengarenk/shared';
import { API, erisim, istek } from './istemci';

/**
 * Reklam ölçümü (Karar 35). Meta Pixel ve Google etiketi yalnızca çerez bandında "Reklam ölçümü" (Google için
 * "Analiz" de) izni verilince yüklenir; izinden önce hiçbir şey gönderilmez (Consent Mode v2 temel mod). Temaslar
 * (UTM, açılış sayfası, yönlendiren site) birinci taraf çerezinde tutulur; tıklama kimlikleri (gclid, fbclid) ve Meta
 * çerezleri izin verilene kadar yalnızca bu sekmenin oturum belleğinde bekler, izin verilmezse atılır. Üye girişinden
 * sonra temaslar API'ye bildirilir. Tarayıcı olayları sunucu olaylarıyla aynı kimliği taşır (Meta tek sayar).
 */

export interface CerezTercihi {
  analiz: boolean;
  reklam: boolean;
}

const CEREZ = 'rr_cerez';
const TEMAS = 'rr_temas';
const BEKLEYEN = 'rr_tiklama';
const TEMAS_GUN = 90;

const PIXEL = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? '';
const GTAG = process.env.NEXT_PUBLIC_GOOGLE_TAG_ID ?? '';

declare global {
  interface Window {
    fbq?: ((...a: unknown[]) => void) & {
      callMethod?: unknown;
      queue?: unknown[];
      loaded?: boolean;
      version?: string;
      push?: unknown;
    };
    _fbq?: unknown;
    dataLayer?: unknown[];
    gtag?: (...a: unknown[]) => void;
  }
}

function cerezOku(ad: string) {
  if (typeof document === 'undefined') return null;
  const raw = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${ad}=`))
    ?.slice(ad.length + 1);
  return raw ? decodeURIComponent(raw) : null;
}

function cerezYaz(ad: string, deger: string, gun: number) {
  // biome-ignore lint/suspicious/noDocumentCookie: birinci taraf çerezi; Cookie Store API her tarayıcıda yok
  document.cookie = `${ad}=${encodeURIComponent(deger)}; path=/; max-age=${gun * 86_400}; samesite=lax`;
}

export function cerezTercihi(): CerezTercihi | null {
  const raw = cerezOku(CEREZ);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as CerezTercihi;
    return { analiz: Boolean(v.analiz), reklam: Boolean(v.reklam) };
  } catch {
    return null;
  }
}

/** Çerez bandı tercih kaydedince çağırır */
export function tercihDegisti(t: CerezTercihi) {
  const once = yuklendi;
  if (!t.reklam) {
    try {
      sessionStorage.removeItem(BEKLEYEN);
    } catch {
      /* oturum belleği kapalı */
    }
    temasYaz(okuTemas(), false);
    // Ölçüm çerezleri silinir; yüklenmiş etiketler sayfa yenilenince gider
    for (const c of document.cookie.split('; ')) {
      const ad = c.split('=')[0] ?? '';
      if (/^(_fbp|_fbc|_ga|_gcl_|_gid)/.test(ad)) {
        // biome-ignore lint/suspicious/noDocumentCookie: ölçüm çerezlerini silmek
        document.cookie = `${ad}=; path=/; max-age=0`;
        // biome-ignore lint/suspicious/noDocumentCookie: alan adına yazılmış hâli
        document.cookie = `${ad}=; path=/; domain=.${location.hostname.replace(/^www\./, '')}; max-age=0`;
      }
    }
    if (once) location.reload();
  } else {
    bekleyeniBirlestir();
    etiketleriYukle(t);
  }
  void temasGonder();
}

// ── Temas ──────────────────────────────────────────────────────

interface Temaslar {
  ilk: Touch | null;
  son: Touch | null;
}

function okuTemas(): Temaslar {
  try {
    const v = JSON.parse(cerezOku(TEMAS) ?? 'null') as Temaslar | null;
    return { ilk: v?.ilk ?? null, son: v?.son ?? null };
  } catch {
    return { ilk: null, son: null };
  }
}

function temasYaz(t: Temaslar, reklam: boolean) {
  const temiz = (x: Touch | null) => (x && !reklam ? izinsizTemas(x) : x);
  cerezYaz(TEMAS, JSON.stringify({ ilk: temiz(t.ilk), son: temiz(t.son) }), TEMAS_GUN);
}

/** İzinden önce gelen tıklama kimlikleri izin verilince temaslara eklenir */
function bekleyeniBirlestir() {
  let b: Touch | null = null;
  try {
    b = JSON.parse(sessionStorage.getItem(BEKLEYEN) ?? 'null') as Touch | null;
    sessionStorage.removeItem(BEKLEYEN);
  } catch {
    return;
  }
  if (!b) return;
  const t = okuTemas();
  const ekle = (x: Touch | null) => (x && x.at === b?.at ? { ...x, ...b } : x);
  temasYaz({ ilk: ekle(t.ilk), son: ekle(t.son) }, true);
}

/** Sayfa açılışında: adreste kampanya bilgisi ya da dış yönlendirme varsa temas */
export function temasYakala() {
  const t = touchFromUrl(location.href, document.referrer, new Date());
  if (!t) return false;
  const mevcut = okuTemas();
  const ayni = (x: Touch | null) =>
    x &&
    x.utm_source === t.utm_source &&
    x.utm_campaign === t.utm_campaign &&
    x.gclid === t.gclid &&
    x.fbclid === t.fbclid &&
    x.ref === t.ref;
  if (ayni(mevcut.son)) return false;
  const tercih = cerezTercihi();
  const izin = Boolean(tercih?.reklam);
  if (!izin && tercih === null && (t.gclid || t.fbclid)) {
    // Tercih henüz yapılmadı: tıklama kimlikleri bu sekmede bekler
    try {
      sessionStorage.setItem(BEKLEYEN, JSON.stringify(t));
    } catch {
      /* oturum belleği kapalı */
    }
  }
  temasYaz({ ilk: mevcut.ilk ?? t, son: t }, izin);
  return true;
}

/** Üyeyse temasları API'ye bildirir (girişten sonra, yeni temasta ve tercih değişince) */
export async function temasGonder() {
  const t = okuTemas();
  if (!t.ilk && !t.son) return;
  const token = await erisim().catch(() => null);
  if (!token) return;
  const reklam = Boolean(cerezTercihi()?.reklam);
  // Meta çerezi (_fbp) Pixel yüklendiyse vardır; son temasa eklenir
  const fbp = reklam ? cerezOku('_fbp') : null;
  const son = t.son && fbp ? { ...t.son, fbp } : t.son;
  await istek('/me/temas', { method: 'POST', body: { ilk: t.ilk, son, reklam } }).catch(() => undefined);
}

// ── Etiketler ──────────────────────────────────────────────────

let yuklendi = false;

function betik(src: string) {
  const s = document.createElement('script');
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

/** Pixel ve Google etiketi: yalnızca izinle ve kimlik tanımlıysa (yerelde tanımlı değil) */
export function etiketleriYukle(t: CerezTercihi | null = cerezTercihi()) {
  if (!t || yuklendi) return;
  if (t.reklam && PIXEL && !window.fbq) {
    const f = ((...a: unknown[]) => {
      f.callMethod ? (f.callMethod as (...x: unknown[]) => void)(...a) : f.queue?.push(a);
    }) as NonNullable<Window['fbq']>;
    // Meta'nın yükleyici kodundaki kuyruk alanları
    f.queue = [];
    f.loaded = true;
    f.version = '2.0';
    f.push = f;
    window.fbq = f;
    window._fbq = f;
    betik('https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', PIXEL);
    yuklendi = true;
  }
  if ((t.reklam || t.analiz) && GTAG && !window.gtag) {
    window.dataLayer = window.dataLayer ?? [];
    window.gtag = (...a: unknown[]) => {
      window.dataLayer?.push(a);
    };
    // Temel mod: etiket izinden sonra yüklenir; izin verilen amaçlar açılır
    window.gtag('consent', 'default', {
      ad_storage: t.reklam ? 'granted' : 'denied',
      ad_user_data: t.reklam ? 'granted' : 'denied',
      ad_personalization: 'denied',
      analytics_storage: t.analiz ? 'granted' : 'denied',
    });
    window.gtag('js', new Date());
    window.gtag('config', GTAG, { send_page_view: false });
    betik(`https://www.googletagmanager.com/gtag/js?id=${GTAG}`);
    yuklendi = true;
  }
}

/**
 * Sayfa görüntüleme (yön değişiminde). Kendi web analitiğimize (Raporlar › Huni) her zaman gider: çerez ve gövde yok,
 * sunucu yalnızca günlük sayıyı tutar. Pixel ve Google etiketi yalnızca izin verilip yüklendiyse.
 */
export function sayfaGoruntulendi() {
  fetch(`${API}/analitik/ziyaret`, { method: 'POST', keepalive: true }).catch(() => undefined);
  window.fbq?.('track', 'PageView');
  window.gtag?.('event', 'page_view', { page_path: location.pathname });
}

/**
 * Dönüşüm olayı: sunucudaki olayla aynı kimlik (`adEventId`). Mesaj, talep açıklaması, plaka ve şasi gönderilmez;
 * yalnızca değer ve para birimi.
 */
export function olcumOlayi(ad: AdEventName, ref: string, degerKurus?: number) {
  const tanim = AD_EVENTS[ad];
  if (!tanim.tarayici) return;
  const deger = degerKurus ? { currency: 'TRY', value: degerKurus / 100 } : {};
  window.fbq?.('track', ad, deger, { eventID: adEventId(ad, ref) });
  if (tanim.ga) window.gtag?.('event', tanim.ga, { ...deger, transaction_id: adEventId(ad, ref) });
}

/** "Çerez tercihleri" bağlantısı: bandı yeniden açar */
export const cerezTercihleriniAc = () => window.dispatchEvent(new Event('rr-cerez-ac'));
