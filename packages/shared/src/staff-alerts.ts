import { z } from 'zod';
import type { BuiltinRole, Permission } from './staff.js';

/**
 * Çalışan uyarıları (Karar 03, 40, 41, 57, 58, 59; YonetimRapor.dc.html › Zamanlanmış raporlar ve uyarılar).
 * Olay ya da dönemsel denetim → uyarı → alıcılar (Sahip her zaman, ayrıca yetkiye ya da role göre) → konsol ve e-posta.
 *
 * Uyarı metni kişisel veri taşımaz: e-posta şirket hesabına (Google Workspace) gider ve
 * kişisel veri gerekmedikçe kopyalanmaz. Metinde kullanıcı adı, telefon, e-posta, IBAN yoktur; ayrıntı konsolda, yetkiyle açılır.
 */

export interface StaffAlertRule {
  ad: string;
  /** Konsolda "Kritik uyarılar" bölümünde koşul cümlesi */
  kosul: string;
  /** Kritik uyarı kapatılamaz ve "Kritik" rozetiyle gelir */
  kritik: boolean;
  /** Sahip her zaman alır; buradaki yetkiye (herhangi bir düzeyde) ya da role sahip etkin çalışanlar da alır */
  izin?: Permission;
  roller?: BuiltinRole[];
  /** Konsoldaki ilgili ekran */
  yol: string;
}

export const STAFF_ALERT_RULES = {
  // Güvenlik (Karar 40)
  yeni_cihaz: {
    ad: 'Yeni cihazdan çalışan girişi',
    kosul: 'Bir çalışan yeni bir cihazdan giriş yaparsa',
    kritik: true,
    yol: '/islem-kaydi',
  },
  kurtarma_kodu: {
    ad: 'Kurtarma koduyla giriş',
    kosul: 'Bir çalışan doğrulama uygulaması yerine kurtarma koduyla girerse',
    kritik: true,
    yol: '/islem-kaydi',
  },
  // KVKK ve uyum (Karar 58, 59)
  ihlal: {
    ad: 'Kişisel veri ihlali kaydı',
    kosul: 'Gerçek bir veri ihlali kaydı açılırsa (72 saat başlar)',
    kritik: true,
    izin: 'kvkk.yanitla',
    yol: '/ihlal',
  },
  kvkk_sure: {
    ad: 'KVKK başvurusunda 7 gün kaldı',
    kosul: 'Yanıtlanmamış KVKK başvurusunun yasal süresine 7 gün kalırsa',
    kritik: false,
    izin: 'kvkk.yanitla',
    yol: '/kvkk',
  },
  imha_onayi: {
    ad: 'İmha listesi onay bekliyor',
    kosul: 'Periyodik imhaya 14 gün kala liste onaylanmamışsa',
    kritik: false,
    yol: '/imha',
  },
  imha_yapildi: {
    ad: 'Periyodik imha yapıldı',
    kosul: 'Onaylı imha listesi dönem gününde uygulanınca',
    kritik: false,
    izin: 'kvkk.yanitla',
    yol: '/imha',
  },
  verbis: {
    ad: 'VERBİS eşiği',
    kosul: 'Çalışan sayısı ya da yıllık bilanço VERBİS muafiyet eşiğinin %80’ine ulaşır ya da aşarsa',
    kritik: false,
    yol: '/imha',
  },
  // Ödemeler ve iade (Karar 39, Teknik tasarım §7)
  iade_onayi: {
    ad: 'Onayını bekleyen iade',
    kosul: 'Bir iade önerisi açılınca (iadeyi yalnızca sen onaylarsın)',
    kritik: false,
    yol: '/onaylar',
  },
  iade_sonucu: {
    ad: 'İade sonucu',
    kosul: 'Onayladığın iade yürütülür ya da yürütülemezse',
    kritik: false,
    izin: 'iade',
    yol: '/odemeler',
  },
  iade_belirsiz: {
    ad: 'Sonucu belirsiz iade',
    kosul: 'Ödeme kuruluşu iadenin sonucunu bildirmezse (yeniden denenmez)',
    kritik: true,
    yol: '/odemeler',
  },
  odeme_hatasi: {
    ad: 'Ödeme hatası oranı',
    kosul: 'Ödeme hatası oranı bir saatte %5’i aşarsa',
    kritik: true,
    izin: 'iade',
    yol: '/odemeler',
  },
  odeme_inceleme: {
    ad: 'İnceleme isteyen ödeme',
    kosul:
      'Tutar uyuşmazsa, mağaza iadesi ya da tanınmayan satış gelirse, otomatik çekimin bildirimi gelmezse',
    kritik: false,
    izin: 'iade',
    yol: '/odemeler',
  },
  // Ajan ve yapay zekâ (Karar 03, 41, 57)
  ajan_ozet: {
    ad: 'Ajanın günlük özeti',
    kosul: 'Her gün 09.00’dan sonra: dünün özeti, dikkat isteyenler, ajanın yaptıkları',
    kritik: false,
    roller: ['ADMIN'],
    yol: '/ajan',
  },
  ajan_galeri: {
    ad: 'Ajanın onayladığı galeri',
    kosul: 'Kontrollerin hepsi geçti ve ajan bir galeri başvurusunu onayladıysa',
    kritik: false,
    yol: '/galeri-basvurulari',
  },
  ajan_durdu: {
    ad: 'Ajan durduruldu ya da başladı',
    kosul: 'Rengarenk Ajanı durdurulur ya da yeniden başlatılırsa',
    kritik: false,
    roller: ['ADMIN'],
    yol: '/ajan',
  },
  ana_olcu: {
    ad: 'Ana ölçü',
    kosul: 'Ana ölçü (48 saatte ilk mesaj alan talep oranı) 24 saatte 5 puandan fazla düşerse',
    kritik: false,
    roller: ['ADMIN'],
    yol: '/ajan',
  },
  hedef_sapma: {
    ad: 'Hedeften sapma',
    kosul: 'Aylık hedeflerden biri ayın geçen kısmına göre %10’dan fazla geride kalırsa (ayda bir kez)',
    kritik: false,
    roller: ['ADMIN'],
    yol: '/panel',
  },
  ajan_geri_alma: {
    ad: 'Ajanın geri alınan işlemleri',
    kosul: 'Ajanın geri alınan işlem oranı haftalık %5’i aşarsa',
    kritik: false,
    yol: '/ajan',
  },
  yz_butce: {
    ad: 'Yapay zekâ bütçesi',
    kosul: 'Aylık harcama sınırın %80’ine ya da sınıra ulaşırsa',
    kritik: true,
    yol: '/yapay-zeka',
  },
  deney: {
    ad: 'A/B testinde kazanan',
    kosul: 'Bir A/B testinde kazanan belli olursa (her kolda en az 100 kişi, güven %95)',
    kritik: false,
    izin: 'kampanya.hazirla',
    yol: '/raporlar',
  },
  // Bildirim ve katalog (Karar 49, 50; Teknik tasarım §5)
  ticari_durdu: {
    ad: 'Ticari e-posta durdu',
    kosul: 'E-posta itibarı sınırı aşılır ve ticari gönderim kendiliğinden durursa',
    kritik: false,
    izin: 'kampanya.hazirla',
    yol: '/bildirim-merkezi',
  },
  katalog: {
    ad: 'Katalog kaynağı',
    kosul: 'Bir katalog kaynağı 48 saat güncellenemez ya da dosyası kalite kontrolünden geçmezse',
    kritik: false,
    izin: 'kategori.ayarla',
    yol: '/entegrasyonlar/katalog',
  },
} as const satisfies Record<string, StaffAlertRule>;

export type StaffAlertKey = keyof typeof STAFF_ALERT_RULES;
export const STAFF_ALERT_KEYS = Object.keys(STAFF_ALERT_RULES) as StaffAlertKey[];

/** Dönemsel denetim eşikleri (YonetimRapor › Kritik uyarılar) */
export const STAFF_ALERT_LIMITS = {
  /** Ödeme hatası oranı bir saatte; en az bu kadar deneme varsa bakılır */
  odemeHataOrani: 0.05,
  odemeEnAzDeneme: 20,
  /** Ajanın geri alınan işlemleri son 7 günde; en az bu kadar geri alınabilir işlem varsa bakılır */
  ajanGeriAlmaOrani: 0.05,
  ajanEnAzIslem: 10,
  /** Ana ölçü (Karar 44): 24 saatte puan düşüşü; iki günün her birinde en az bu kadar talep varsa bakılır */
  anaOlcuPuan: 5,
  anaOlcuEnAz: 20,
  kvkkKalanGun: 7,
  imhaKalanGun: 14,
  verbisOrani: 0.8,
} as const;

export const staffAlertReadSchema = z
  .object({ ids: z.array(z.uuid()).max(200).optional(), hepsi: z.boolean().optional() })
  .strict()
  .refine((v) => v.hepsi || (v.ids && v.ids.length > 0), { message: 'ids ya da hepsi gerekli' });

export const staffAlertSwitchSchema = z.object({ enabled: z.boolean() }).strict();
