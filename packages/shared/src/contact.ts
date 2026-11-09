import { z } from 'zod';
import { phoneSchema } from './auth.js';
import { ILLER } from './iller.js';

/**
 * Ayarlar › Profil ve İletişim (Ayarlar.dc.html; Karar 29). Görünen ad tam ya da soyadının baş harfiyle; telefon ve
 * WhatsApp izni ve aranabilir saatler. Yeni talepler bu tercihlerle açılır, her talepte ayrıca değişir. Aranabilir
 * saatler dışında telefon numarası ve WhatsApp düğmesi talep sayfasında gizlenir; uygulama içi mesaj her zaman açıktır.
 */

export const NAME_MODES = ['tam', 'kisa'] as const;
export type NameMode = (typeof NAME_MODES)[number];

/** Varsayılan aranabilir saatler: 09.00–21.00 (Karar 29) */
export const CALL_HOURS_DEFAULT = { bas: 9, bit: 21 } as const;
/** "9" → "09.00" */
export const saatYaz = (h: number) => `${String(h).padStart(2, '0')}.00`;

/** Türkiye saatiyle şu anki saat (0–23); Türkiye yaz saati uygulamaz */
export function trSaat(now = new Date()): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Istanbul',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(now),
  );
}

/** Şu an aranabilir saatler içinde mi: bas ≤ saat < bit */
export const aranabilir = (bas: number, bit: number, now = new Date()) => {
  const h = trSaat(now);
  return h >= bas && h < bit;
};

export const contactPrefsSchema = z
  .object({
    phoneVisible: z.boolean(),
    whatsappVisible: z.boolean(),
    callFrom: z.number().int().min(0).max(23),
    callTo: z.number().int().min(1).max(24),
  })
  .strict()
  .refine((v) => !v.whatsappVisible || v.phoneVisible, {
    message: 'WhatsApp için telefon numaranın görünmesine izin ver',
    path: ['whatsappVisible'],
  })
  .refine((v) => v.callFrom < v.callTo, {
    message: 'Bitiş saati başlangıçtan sonra olmalı',
    path: ['callTo'],
  });
export type ContactPrefs = z.output<typeof contactPrefsSchema>;

/** Profildeki il ve ilçe: il listede, ilçe o ilin ilçelerinden (ilçe ilsiz yazılmaz) */
export const profileLocationFields = {
  il: z.string().trim().max(40).nullable().optional(),
  ilce: z.string().trim().max(60).nullable().optional(),
  nameMode: z.enum(NAME_MODES).optional(),
};
export function ilIlceKontrol(v: { il?: string | null; ilce?: string | null }, ctx: z.RefinementCtx) {
  const il = v.il ? ILLER.find((i) => i.ad === v.il) : null;
  if (v.il && !il) ctx.addIssue({ code: 'custom', message: 'İl listede yok', path: ['il'] });
  if (v.ilce && !il?.ilceler.includes(v.ilce))
    ctx.addIssue({ code: 'custom', message: 'İlçe bu ilde yok', path: ['ilce'] });
}

/** Numarayı değiştir (Yardim.dc.html: "yeni numarana gelen SMS kodunu gir") */
export const phoneChangeRequestSchema = z.object({ phone: phoneSchema }).strict();
export const phoneChangeVerifySchema = z
  .object({ challengeId: z.uuid(), code: z.string().regex(/^\d{6}$/, '6 haneli kodu gir') })
  .strict();
