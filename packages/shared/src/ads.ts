import { z } from 'zod';

/**
 * Reklam ölçümü (Karar 35). Ölçüm olayları tarayıcıdan (Meta Pixel, Google etiketi; yalnızca çerez izninden sonra) ve
 * sunucudan (Conversions API; yalnızca üyelikte "reklam ölçümü" onayı veren kullanıcılar için) gönderilir. İkisi aynı
 * olay kimliğiyle (`adEventId`) tekilleştirilir. Her kullanıcının ilk ve son teması (UTM, gclid, fbclid, fbp, fbc,
 * açılış sayfası) izin durumuyla saklanır. Mesaj içeriği, talep açıklaması, plaka ve şasi numarası hiçbir zaman
 * gönderilmez: olaylar yalnızca ad, değer ve kategori taşır.
 */

export const AD_EVENTS = {
  CompleteRegistration: { ad: 'Üyelik', kisa: 'uyelik', tarayici: true, google: false, ga: 'sign_up' },
  Lead: { ad: 'Talep yayınlandı', kisa: 'talep', tarayici: true, google: false, ga: 'generate_lead' },
  SubmitApplication: {
    ad: 'Galeri başvurusu',
    kisa: 'basvuru',
    tarayici: true,
    google: false,
    ga: 'submit_application',
  },
  /** Yalnızca sunucudan; Google'a çevrimdışı dönüşüm */
  DealerApproved: { ad: 'Galeri onaylandı', kisa: 'galeri', tarayici: false, google: true, ga: null },
  /** Google'a çevrimdışı dönüşüm */
  Subscribe: { ad: 'Galeri aboneliği', kisa: 'abonelik', tarayici: true, google: true, ga: 'purchase' },
  Purchase: { ad: 'Hak veya öne çıkarma', kisa: 'satin', tarayici: true, google: false, ga: 'purchase' },
} as const;
export type AdEventName = keyof typeof AD_EVENTS;
export const AD_EVENT_NAMES = Object.keys(AD_EVENTS) as AdEventName[];

/**
 * Olay kimliği: olay ve kayıttan (talep, sipariş, kullanıcı) belirlenir; tarayıcı ve sunucu aynı kimliği üretir, Meta
 * ikisini tek sayar.
 */
export const adEventId = (name: AdEventName, ref: string) => `${AD_EVENTS[name].kisa}-${ref}`;

const parca = (max: number) => z.string().trim().min(1).max(max);

/** Bir temas: reklam ya da yönlendirme ile gelen ziyaret */
export const touchSchema = z
  .object({
    utm_source: parca(100).optional(),
    utm_medium: parca(100).optional(),
    utm_campaign: parca(150).optional(),
    utm_content: parca(150).optional(),
    utm_term: parca(150).optional(),
    /** Tıklama kimlikleri ve Meta çerezleri: yalnızca reklam çerezi izniyle */
    gclid: parca(200).optional(),
    fbclid: parca(500).optional(),
    fbp: parca(200).optional(),
    fbc: parca(600).optional(),
    /** Yönlendiren sitenin alan adı (adresin geri kalanı saklanmaz) */
    ref: parca(120).optional(),
    /** Açılış sayfasının yolu (sorgusuz) */
    sayfa: z.string().trim().max(200).regex(/^\//, 'Yol / ile başlamalı'),
    at: z.iso.datetime(),
  })
  .strict();
export type Touch = z.output<typeof touchSchema>;

export const touchReportSchema = z
  .object({
    ilk: touchSchema.nullable().default(null),
    son: touchSchema.nullable().default(null),
    /** Çerez tercihi: reklam ölçümüne izin */
    reklam: z.boolean().default(false),
  })
  .strict();
export type TouchReport = z.output<typeof touchReportSchema>;

export const TIKLAMA_ALANLARI = ['gclid', 'fbclid', 'fbp', 'fbc'] as const;

/** İzin yoksa tıklama kimlikleri ve Meta çerezleri atılır */
export function izinsizTemas(t: Touch): Touch {
  const { gclid: _g, fbclid: _f, fbp: _p, fbc: _c, ...kalan } = t;
  return kalan;
}

/** Meta'nın tıklama çerezi biçimi (fbclid varsa) */
export const fbcOf = (fbclid: string, ms: number) => `fb.1.${ms}.${fbclid}`;

/**
 * Adresten temas: UTM ya da tıklama kimliği varsa ya da başka bir siteden gelindiyse. Doğrudan girişte (ve site içi
 * gezintide) temas yoktur, son temas değişmez.
 */
export function touchFromUrl(url: string, referrer: string, now: Date): Touch | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const q = u.searchParams;
  const al = (k: string, max: number) => {
    const v = q.get(k)?.trim();
    return v ? v.slice(0, max) : undefined;
  };
  let ref: string | undefined;
  try {
    const r = referrer ? new URL(referrer) : null;
    if (r?.hostname && r.hostname !== u.hostname) ref = r.hostname.replace(/^www\./, '').slice(0, 120);
  } catch {
    ref = undefined;
  }
  const fbclid = al('fbclid', 500);
  const t: Touch = {
    utm_source: al('utm_source', 100),
    utm_medium: al('utm_medium', 100),
    utm_campaign: al('utm_campaign', 150),
    utm_content: al('utm_content', 150),
    utm_term: al('utm_term', 150),
    gclid: al('gclid', 200),
    fbclid,
    fbc: fbclid ? fbcOf(fbclid, now.getTime()) : undefined,
    ref,
    sayfa: u.pathname.slice(0, 200) || '/',
    at: now.toISOString(),
  };
  for (const k of Object.keys(t) as (keyof Touch)[]) if (t[k] === undefined) delete t[k];
  const kampanya = t.utm_source || t.utm_medium || t.utm_campaign || t.gclid || t.fbclid;
  return kampanya || t.ref ? t : null;
}

export type Kanal = 'reklam' | 'bildirim' | 'organik';
export const KANAL_ADI: Record<Kanal, string> = {
  reklam: 'Reklam',
  bildirim: 'Bildirim ve e-posta',
  organik: 'Organik',
};

const UCRETLI = new Set(['cpc', 'ppc', 'paid', 'paid_social', 'paidsocial', 'cpm', 'display', 'ads']);
const BILDIRIM = new Set(['email', 'e-posta', 'eposta', 'push', 'bildirim', 'sms']);

/** Temasın kanalı: tıklama kimliği ya da ücretli araç reklam, e-posta ve bildirim kendi kanalımız, gerisi organik */
export function kanalOf(
  t: Pick<Touch, 'gclid' | 'fbclid' | 'utm_medium' | 'utm_source'> | null | undefined,
): Kanal {
  if (!t) return 'organik';
  const m = t.utm_medium?.toLowerCase() ?? '';
  if (t.gclid || t.fbclid || UCRETLI.has(m)) return 'reklam';
  if (BILDIRIM.has(m) || t.utm_source?.toLowerCase() === 'rengarenk') return 'bildirim';
  return 'organik';
}

/** Raporda kampanya adı: utm_campaign; yoksa kaynak, yoksa kanal */
export function kampanyaAdi(
  t: Pick<Touch, 'utm_campaign' | 'utm_source' | 'ref'> | null | undefined,
  k: Kanal,
) {
  return t?.utm_campaign ?? (t?.utm_source ? `${t.utm_source} (kampanyasız)` : (t?.ref ?? KANAL_ADI[k]));
}

/** Reklam ağının adı (rapor satırının alt yazısı) */
export function agAdi(t: Pick<Touch, 'utm_source' | 'gclid' | 'fbclid'> | null | undefined) {
  const s = t?.utm_source?.toLowerCase() ?? '';
  if (t?.fbclid || ['meta', 'facebook', 'fb', 'instagram', 'ig'].includes(s)) return 'Meta';
  if (t?.gclid || ['google', 'youtube'].includes(s)) return 'Google';
  return t?.utm_source ?? null;
}
