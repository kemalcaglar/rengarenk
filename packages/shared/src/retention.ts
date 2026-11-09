import { z } from 'zod';

/**
 * Saklama, imha, VERBİS, veri ihlali ve resmi makam talepleri (Karar 59; YonetimSistem.dc.html › imha, ihlal).
 *
 * - Periyodik imha 6 ayda bir (1 Ocak ve 1 Temmuz, 03.00). Ajan süresi dolan kayıtları listeler; liste Sahip onayıyla
 *   imha edilir ve tutanağı saklanır. Şikâyeti ya da resmi talebi olan kişinin kaydı bekletilir.
 * - Yalnızca ekleme yapılan tablolar (işlem kaydı, hak defteri, rıza kayıtları) imha sürecinde değiştirilmez; bunlar için
 *   ayrı sahip kararı gerekir.
 * - Veri ihlali öğrenildiği andan itibaren 72 saat içinde Kurul'a bildirilir.
 */

export interface RetentionRule {
  key: string;
  ad: string;
  dayanak: string;
  sure: string;
  sonra: string;
}

/** Saklama süreleri tablosu (tasarımdaki sıra) */
export const RETENTION_RULES: readonly RetentionRule[] = [
  {
    key: 'hesap',
    ad: 'Hesap ve profil',
    dayanak: 'Sözleşmenin ifası',
    sure: 'Hesap açık olduğu sürece',
    sonra: 'Kapatılınca anonimleştirilir',
  },
  {
    key: 'mesaj',
    ad: 'Talepler ve mesajlar',
    dayanak: 'Sözleşmenin ifası',
    sure: 'Kapanıştan 1 yıl',
    sonra: 'Silinir; şikâyet veya resmi talep varsa bekletilir',
  },
  {
    key: 'fatura',
    ad: 'Fatura ve ödeme kayıtları',
    dayanak: 'Vergi ve ticaret mevzuatı',
    sure: '10 yıl',
    sonra: 'Silinir',
  },
  {
    key: 'erisim',
    ad: 'Erişim ve trafik kayıtları',
    dayanak: '5651 sayılı Kanun',
    sure: '2 yıl',
    sonra: 'Silinir',
  },
  {
    key: 'kimlik',
    ad: 'Kimlik ve telefon doğrulama kayıtları',
    dayanak: 'Motorlu Kara Taşıtları Ticareti Yön. m.22',
    sure: '5 yıl',
    sonra: 'Silinir',
  },
  {
    key: 'islem',
    ad: 'Çalışan işlem kaydı',
    dayanak: 'Meşru menfaat · Karar 40',
    sure: '2 yıl',
    sonra: 'Kayıt kalır (yalnızca ekleme); IP adresi dönem anahtarı silinerek okunamaz olur',
  },
  {
    key: 'riza',
    ad: 'Rıza ve İYS kayıtları',
    dayanak: 'İspat yükümlülüğü',
    sure: 'Rıza geri alındıktan 3 yıl',
    sonra: 'Satır kalır (ispat, yalnızca ekleme); hesap kapanınca kişiyle bağı kopar',
  },
  {
    key: 'kvkk',
    ad: 'KVKK başvuruları',
    dayanak: 'İspat yükümlülüğü',
    sure: '3 yıl',
    sonra: 'Silinir',
  },
];

/** Süreler (gün) */
export const RETENTION_DAYS = {
  mesaj: 365,
  destek: 365,
  erisim: 2 * 365,
  kimlik: 5 * 365,
  kvkk: 3 * 365,
  fatura: 10 * 365,
  islem: 2 * 365,
} as const;

/** İmha listesindeki kalemler (konsoldaki sıra) */
export const DISPOSAL_KINDS = {
  sohbet: 'Süresi dolan sohbetler',
  hesap: 'Anonimleştirilecek hesap artığı',
  erisim: '2 yılı dolan erişim kaydı',
  destek: 'Süresi dolan destek talebi',
  kvkk: '3 yılı dolan KVKK başvurusu',
  fatura: '10 yılı dolan fatura bilgisi',
  islem: 'İşlem kaydında 2 yılı dolan IP adresi',
} as const;
export type DisposalKind = keyof typeof DISPOSAL_KINDS;
export const DISPOSAL_KIND_KEYS = Object.keys(DISPOSAL_KINDS) as DisposalKind[];

/** Sıradaki periyodik imha: 1 Ocak ya da 1 Temmuz, İstanbul saatiyle 03.00 (UTC 00.00) */
export function nextDisposalDate(now: Date): Date {
  const y = now.getUTCFullYear();
  const adaylar = [Date.UTC(y, 0, 1), Date.UTC(y, 6, 1), Date.UTC(y + 1, 0, 1)];
  const t = adaylar.find((a) => a > now.getTime()) as number;
  return new Date(t);
}

/** Tutanak numarası: İ-2027-01 (Ocak dönemi) ya da İ-2027-02 (Temmuz dönemi) */
export function disposalNo(at: Date): string {
  return `İ-${at.getUTCFullYear()}-${at.getUTCMonth() < 6 ? '01' : '02'}`;
}

/** VERBİS muafiyet eşikleri (Kurul kararı 2018/87): 50 çalışan, 100 milyon TL yıllık bilanço */
export const VERBIS_THRESHOLDS = { calisan: 50, bilancoTl: 100_000_000 } as const;

/** Veri ihlali (Karar 59): 72 saat içinde Kurul'a bildirim; beş adımlı prosedür */
export const BREACH_HOURS = 72;
export const BREACH_STEPS = [
  {
    key: 'durdur',
    ad: 'Durdur ve kayıt altına al',
    not: 'Etkilenen sistemi ayır, erişim anahtarlarını yenile, kayıtları dondur',
  },
  {
    key: 'kapsam',
    ad: 'Kapsamı belirle',
    not: 'Hangi veriler, kaç kişi, hangi tarih aralığı; ajan etkilenen kayıtları listeler',
  },
  {
    key: 'kurul',
    ad: 'Kurul’a bildir · 72 saat',
    not: 'Hazır bildirim formu; bilgiler eksikse ilk bildirim yapılıp sonra tamamlanır',
  },
  {
    key: 'kisiler',
    ad: 'Etkilenen kişilere bildir',
    not: 'Hazır e-posta ve uygulama içi şablon; ne olduğu ve ne yapmaları gerektiği',
  },
  {
    key: 'kapat',
    ad: 'Kapat ve rapor yaz',
    not: 'Neden, alınan önlemler, tekrarını önleme; tutanak saklanır',
  },
] as const;
export type BreachStep = (typeof BREACH_STEPS)[number]['key'];
export const BREACH_STEP_KEYS = BREACH_STEPS.map((s) => s.key) as BreachStep[];

/** Kurul'a bildirim formunun başlıkları (Kişisel Veri İhlali Bildirim Formu) ve kişilere bildirim taslağı */
export const BREACH_FORM_FIELDS = [
  'İhlalin gerçekleştiği ve öğrenildiği tarih ve saat',
  'İhlalin nasıl gerçekleştiği ve kaynağı',
  'Etkilenen kişisel veri kategorileri ve yaklaşık kişi sayısı',
  'İhlalin olası sonuçları',
  'Alınan ve alınması önerilen tedbirler',
  'İrtibat kişisi',
] as const;
export const BREACH_PERSON_NOTICE =
  'Rengarenk hesabınla ilgili kişisel verilerinin bir kısmı {{tarih}} tarihinde yetkisiz erişime maruz kalmış olabilir. ' +
  'Etkilenen bilgiler: {{veriler}}. Sorunu durdurduk ve Kişisel Verileri Koruma Kurulu’na bildirdik. ' +
  'Hesabının güvenliği için açık oturumlarını Ayarlar › Gizlilik ve güvenlik bölümünden kontrol et; sana kimse SMS kodu ' +
  'sormaz. Soruların için Yardım › Destek’ten bize yazabilirsin.';

export const breachStartSchema = z
  .object({
    tatbikat: z.boolean(),
    ogrenildi: z.string().datetime().optional(),
    ozet: z.string().trim().min(5).max(2000),
  })
  .strict();
export const breachStepSchema = z.object({ not: z.string().trim().max(2000).optional() }).strict();
export const breachCloseSchema = z.object({ rapor: z.string().trim().min(20).max(10_000) }).strict();

/** Resmi makam talepleri (Karar 59): yalnız sahip ve yönetici görür; verilen her veri kaydedilir */
export const OFFICIAL_STATUSES = {
  belge_bekleniyor: 'Belge bekleniyor',
  inceleniyor: 'İnceleniyor',
  yanitlandi: 'Yanıtlandı',
  reddedildi: 'Reddedildi',
} as const;
export type OfficialStatus = keyof typeof OFFICIAL_STATUSES;

export const officialCreateSchema = z
  .object({
    makam: z.string().trim().min(3).max(200),
    konu: z.string().trim().min(5).max(500),
    /** Talebin ilgili olduğu kişi ya da galeri (kullanıcı kartındaki kimlik) */
    kisi: z.string().uuid().optional(),
    galeri: z.string().uuid().optional(),
    /** Talep yazısı kullanıcıya bildirimi yasaklıyor mu */
    bildirimYasak: z.boolean().default(false),
  })
  .strict();
export const officialGiveSchema = z.object({ ne: z.string().trim().min(3).max(500) }).strict();
export const officialReplySchema = z
  .object({ durum: z.enum(['yanitlandi', 'reddedildi']), not: z.string().trim().min(5).max(2000) })
  .strict();
