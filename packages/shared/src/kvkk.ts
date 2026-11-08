import { z } from 'zod';

/**
 * KVKK başvuruları ve kendi verini indirme (Karar 58; YonetimSistem.dc.html › kvkk, Ayarlar.dc.html › Kişisel
 * verilerim). Başvurular (m.11) en geç 30 gün içinde yanıtlanır (m.13); 7 gün kala ajan uyarır. Ajan türü belirler, kişinin
 * verilerini toplar ve taslak yazar; yanıtı her zaman bir çalışan okuyup gönderir. Hesaptan gelen başvuru ve veri indirme
 * SMS koduyla doğrulanır.
 */

export const KVKK_KINDS = {
  bilgi: 'Bilgi alma',
  duzeltme: 'Düzeltme',
  silme: 'Silme',
  itiraz: 'İtiraz',
} as const;
export type KvkkKind = keyof typeof KVKK_KINDS;
export const KVKK_KIND_KEYS = Object.keys(KVKK_KINDS) as KvkkKind[];

/** Yasal yanıt süresi (KVKK m.13) ve ajanın uyarı eşiği */
export const KVKK_DAYS = 30;
export const KVKK_WARN_DAYS = 7;
/** İndirme bağlantısının geçerliliği ve hazırlık hedefi (Karar 58) */
export const EXPORT_VALID_DAYS = 7;
export const EXPORT_READY_HOURS = 24;

const kod = z.object({ challengeId: z.string().uuid(), code: z.string().regex(/^\d{6}$/) });

export const dataExportSchema = kod.strict();
export const kvkkCreateSchema = kod
  .extend({
    tur: z.enum(KVKK_KIND_KEYS as [KvkkKind, ...KvkkKind[]]),
    metin: z.string().trim().min(10).max(3000),
  })
  .strict();
/** Konsoldan dışarıdan gelen başvuru (e-posta ya da posta): kimliği çalışan doğrular */
export const kvkkExternalSchema = z
  .object({
    ad: z.string().trim().min(2).max(120),
    eposta: z.string().trim().email().max(200),
    tur: z.enum(KVKK_KIND_KEYS as [KvkkKind, ...KvkkKind[]]),
    metin: z.string().trim().min(10).max(3000),
    kanal: z.enum(['eposta', 'posta']),
    kimlikDogrulandi: z.literal(true),
  })
  .strict();
export const kvkkReplySchema = z
  .object({ metin: z.string().trim().min(20).max(6000), okudum: z.literal(true) })
  .strict();

/** Ajanın yanıt taslağı (yapay zekâ taslağı Rengarenk Ajanı ile gelir; şimdilik türe göre şablon) */
export function kvkkDraft(kind: KvkkKind, ad: string, veriler: string[]): string {
  const hitap = `Merhaba ${ad},`;
  const liste = veriler.length ? veriler.join(', ') : 'hesap bilgileriniz';
  switch (kind) {
    case 'bilgi':
      return `${hitap} başvurunuz için teşekkür ederiz. Hakkınızda şu verileri işliyoruz: ${liste}. Verileriniz yalnızca hizmeti sunmak için ödeme kuruluşu, SMS sağlayıcısı ve fatura entegratörüyle paylaşılır ve Türkiye'deki sunucularda saklanır. Saklama süreleri ve haklarınız aydınlatma metnimizde yer alır. Verilerinizin bir kopyasını Ayarlar > Gizlilik ve güvenlik bölümünden "Verilerimi indir" ile alabilirsiniz.`;
    case 'duzeltme':
      return `${hitap} düzeltme başvurunuzu aldık ve ilgili kayıtlarınızı (${liste}) güncelledik. Kesilmiş e-arşiv faturalar değiştirilemediğinden gerekiyorsa düzeltme faturası düzenlenir.`;
    case 'silme':
      return `${hitap} silme başvurunuzu aldık. Hesabınız kapatılıp kişisel verileriniz anonimleştirilecektir. Fatura ve ödeme kayıtları vergi ve ticaret mevzuatı gereği 10 yıl saklanır. Kullanılmamış haklarınız varsa iadesi şirket yöneticimizin onayından sonra yapılır.`;
    case 'itiraz':
      return `${hitap} itirazınızı aldık. Hakkınızdaki işlem bir çalışanımız tarafından yeniden incelenmektedir; sonuç size en geç yasal süre içinde bildirilecektir.`;
  }
}
