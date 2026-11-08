import { z } from 'zod';

/**
 * Konsol › Kullanıcılar ve galeriler (Karar 40, 43, 52; YonetimPazar.dc.html › kullanici). Kişisel veri maskeli gelir;
 * açmak gerekçe ister ve işlem kaydına girer. Karttan uyarı, askı, kalıcı engelleme önerisi, hak tanımlama, oturumları
 * kapatma ve not; iade yalnızca önerilir.
 */

export const PEOPLE_FILTERS = [
  ['hepsi', 'Hepsi'],
  ['bireysel', 'Bireysel'],
  ['galeri', 'Galeri'],
  ['askida', 'Askıda'],
] as const;
export type PeopleFilter = (typeof PEOPLE_FILTERS)[number][0];

/** Açılan kişisel veri bu kadar süre sonra yeniden maskelenir (tasarım: "5 dakika sonra yeniden maskelenir") */
export const REVEAL_SECONDS = 300;

/** Karttan tanımlanabilen haklar (küçük limit; Karar 40, 52) */
export const GRANT_KINDS = {
  ilk_mesaj: 'Ek ilk mesaj',
  uzatma: 'Ücretsiz uzatma',
  talep: 'Ek talep hakkı',
} as const;
export type GrantKind = keyof typeof GRANT_KINDS;
/** Hazır roller dışındaki çalışan bir hesaba ayda en çok bu kadar hak tanımlar; üstü yönetici işi */
export const GRANT_MONTHLY_LIMIT = 10;

export const revealSchema = z.object({ gerekce: z.string().trim().min(5).max(300) }).strict();
export const staffNoteSchema = z.object({ metin: z.string().trim().min(2).max(1000) }).strict();
export const grantSchema = z
  .object({
    tur: z.enum(Object.keys(GRANT_KINDS) as [GrantKind, ...GrantKind[]]),
    adet: z.number().int().min(1).max(GRANT_MONTHLY_LIMIT),
    gerekce: z.string().trim().min(5).max(300),
  })
  .strict();
/** Karttan karar: uyarı, 24 saat askı, kalıcı engelleme önerisi (moderasyon kaydı olarak açılır) */
export const cardActionSchema = z
  .object({
    karar: z.enum(['uyari', 'aski', 'engel']),
    gerekce: z.string().trim().min(5).max(500),
  })
  .strict();

export const BLOCK_KINDS = { telefon: 'Telefon', iban: 'IBAN', ip: 'IP adresi' } as const;
export type BlockKind = keyof typeof BLOCK_KINDS;
export const blockAddSchema = z
  .object({
    tur: z.enum(Object.keys(BLOCK_KINDS) as [BlockKind, ...BlockKind[]]),
    deger: z.string().trim().min(3).max(64),
    not: z.string().trim().max(300).optional(),
  })
  .strict();

/** Kara liste için değerin biçimi: telefon E.164, IBAN boşluksuz büyük harf, IP olduğu gibi */
export function normalizeBlockValue(tur: BlockKind, deger: string): string | null {
  const v = deger.trim();
  if (tur === 'iban') {
    const i = v.replace(/\s/g, '').toUpperCase();
    return /^TR\d{24}$/.test(i) ? i : null;
  }
  if (tur === 'ip') return /^[0-9a-f:.]{3,45}$/i.test(v) ? v.toLowerCase() : null;
  const d = v.replace(/\D/g, '');
  const yerel = d.startsWith('90') ? d.slice(2) : d.startsWith('0') ? d.slice(1) : d;
  return /^5\d{9}$/.test(yerel) ? `+90${yerel}` : null;
}

/** Metindeki IBAN'lar (kara liste denetimi için) */
export function ibansIn(text: string): string[] {
  return [...text.matchAll(/\bTR\s?\d{2}(?:\s?\d{4}){5}(?:\s?\d{2})\b/gi)].map((m) =>
    m[0].replace(/\s/g, '').toUpperCase(),
  );
}
