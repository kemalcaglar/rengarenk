import { z } from 'zod';

/**
 * Mesajlaşma (Karar 08.3, 11, 25, 26, 27). Mesajlar yalnızca metindir; tek istisna galerinin EİDS doğrulanmış portföy
 * aracını araç kartı olarak eklemesidir. Satıcı bir talebe tek ilk mesaj atar; alıcı yanıtlarsa sohbet açılır.
 */

/** İlk mesaj ve sohbet mesajı en çok bu kadar karakter (GaleriMobil.dc.html: "168 / 600") */
export const MESSAGE_MAX = 600;
/** Alıcının portföy araçlarına günde en çok bu kadar farklı araç için ilk mesajı (Karar 27; konsoldan ayarlanacak) */
export const VEHICLE_MESSAGE_DAILY = 10;

export const CONVERSATION_STATUSES = ['WAITING', 'OPEN', 'DECLINED'] as const;
export type ConversationStatusKey = (typeof CONVERSATION_STATUSES)[number];

export const messageBodySchema = z
  .string()
  .trim()
  .min(1, 'Mesaj boş olamaz')
  .max(MESSAGE_MAX, `En çok ${MESSAGE_MAX} karakter`);

/** Talebe ilk mesaj: galeri adına yazılıyorsa `hesap` galerinin hesabıdır; araç kartı yalnızca galeride */
export const firstMessageSchema = z
  .object({
    metin: messageBodySchema,
    hesap: z.uuid().optional(),
    aracId: z.uuid().optional(),
  })
  .strict();

export const vehicleMessageSchema = z.object({ metin: messageBodySchema }).strict();

export const chatMessageSchema = z
  .object({
    metin: messageBodySchema,
    aracId: z.uuid().optional(),
  })
  .strict();

// ── Mesaj güvenliği (Karar 25, Teknik tasarım §8) ─────────────

export const MESSAGE_FLAGS = ['kapora', 'odeme', 'iban', 'telefon', 'baglanti'] as const;
export type MessageFlag = (typeof MESSAGE_FLAGS)[number];

/** Uyarı bandının başlığı (Mesajlar.dc.html: "Dikkat: bu mesajda kapora isteği var.") */
export const FLAG_TITLES: Record<MessageFlag, string> = {
  kapora: 'Dikkat: bu mesajda kapora isteği var.',
  odeme: 'Dikkat: bu mesajda ödeme isteği var.',
  iban: 'Dikkat: bu mesajda IBAN var.',
  telefon: 'Dikkat: bu mesajda telefon numarası var.',
  baglanti: 'Dikkat: bu mesajda platform dışı bir bağlantı var.',
};
export const SECURITY_WARNING =
  'Aracı görmeden ve noterde Güvenli Ödeme Sistemi dışında ödeme yapmayın. Şüpheleniyorsan satıcıyı şikayet et.';
/** Mesaj kutusunun altındaki sabit not (Karar 25) */
export const DEPOSIT_NOTE =
  'Yalnızca metin gönderilebilir. Kapora istemeyin ve vermeyin; ödemeyi noterde Güvenli Ödeme Sistemi ile yapın.';

const KURALLAR: [MessageFlag, RegExp][] = [
  ['kapora', /kapora|kaparo|ön\s*ödeme|on\s*odeme|peşinat|pesinat|depozito/i],
  [
    'odeme',
    /(?:para|ödeme|odeme|ücret|ucret|tutar|bedel)\S*\s+(?:\S+\s+)?(?:gönder|gonder|yolla|yatır|yatir|transfer)|havale|\beft\b|fast\s+ile|papara|ödeme\s+(?:bağlantı|baglanti|link)/i,
  ],
  ['iban', /\biban\b|\bTR\s?\d{2}(?:\s?\d{4}){4,5}(?:\s?\d{1,4})?/i],
  ['telefon', /(?:\+?90[\s.-]?|\b0)?\(?5\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b/],
  [
    'baglanti',
    /https?:\/\/|www\.|\b[a-z0-9-]{2,}\.(?:com|net|org|ly|me|io|co|link|site|xyz|info|biz|app|shop)(?:\.tr)?\b|\bwa\.me\b|\bt\.me\b/i,
  ],
];

/** Anında kurallar: mesajdaki şüpheli kalıplar. Yapay zekâ sınıflandırması sonra eklenir (Karar 41, 42). */
export function scanMessage(text: string): MessageFlag[] {
  return KURALLAR.filter(([, re]) => re.test(text)).map(([k]) => k);
}
