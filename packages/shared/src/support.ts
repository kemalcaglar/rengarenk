import { z } from 'zod';

/**
 * Destek (Karar 54; Yardim.dc.html, YonetimPazar.dc.html › destek). Destek yalnızca yazılıdır: uygulama içi sohbet ve
 * e-posta tek kuyrukta. İlk yanıt hedefi mesai içinde 2 saat, mesai dışında ertesi iş günü 11.00; ödeme ve hesap
 * güvenliği konuları öne alınır. Çözümden 24 saat sonra 1–5 memnuniyet sorusu gider.
 */

/** Yardım merkezi konuları ve sık sorulanlar (Yardim.dc.html) */
export const HELP_TOPICS = [
  {
    key: 'talep',
    ad: 'Talep oluşturma',
    not: 'Sihirbaz, süre, uzatma, kapatma',
    renk: '#5B8CFF',
    sorular: [
      [
        'Talebim ne kadar süre yayında kalır?',
        'Talepler 30 gün yayında kalır. Hava araçlarında süre 90 gündür; kiralık araç talepleri teslim tarihinde kendiliğinden kapanır. Süre dolmadan 7, 3 ve 1 gün önce hatırlatma göndeririz.',
      ],
      [
        'Süresi dolan talebimi nasıl uzatırım?',
        'Taleplerim sayfasında talebin altındaki “Uzat” düğmesini kullan. Her talep için bir kez ücretsiz uzatma hakkın var; sonrasında uzatma 99 TL’dir.',
      ],
      [
        'Aracı bulunca ne yapmalıyım?',
        '“Aracı buldum” düğmesine bas. Talebin kapanır, satıcılar sana yeni mesaj gönderemez; açık sohbetlerin ise yerinde kalır.',
      ],
      [
        'Açıklamaya telefon numaramı yazabilir miyim?',
        'Hayır. Açıklamada telefon, IBAN veya bağlantı paylaşılamaz. Telefonunun görünmesini istiyorsan talepteki iletişim tercihlerinden aç.',
      ],
    ],
  },
  {
    key: 'mesaj',
    ad: 'Mesajlaşma ve iletişim',
    not: 'İlk mesaj, telefon, WhatsApp, engelleme',
    renk: '#FF6FB5',
    sorular: [
      [
        'Satıcılar bana kaç kez yazabilir?',
        'Her satıcı talebine bir ilk mesaj gönderebilir. Sen yanıt verirsen sohbet devam eder; yanıt vermezsen aynı satıcı tekrar yazamaz.',
      ],
      [
        'Rahatsız edici bir mesaj aldım, ne yapmalıyım?',
        'Sohbetin sağ üstündeki menüden “Engelle” veya “Şikayet et”i seç. Engellediğin kişi sana yazamaz ve taleplerini göremez.',
      ],
      [
        'Telefon numaram kimlere görünür?',
        'Yalnızca telefon iletişimine izin verdiğin taleplerde ve Ayarlar’da seçtiğin saatler içinde görünür.',
      ],
    ],
  },
  {
    key: 'hak',
    ad: 'Haklar ve ödemeler',
    not: 'Kotalar, öne çıkarma, fatura, iade',
    renk: '#FFC84A',
    sorular: [
      [
        'Uygulamadaki fiyatlar neden farklı?',
        'iPhone ve Android uygulamasında ödeme App Store ve Google Play üzerinden alınır; mağaza komisyonu nedeniyle uygulama fiyatları web’den biraz yüksektir. Hangi kanaldan alırsan al, hakların hesabında her yerde geçerlidir.',
      ],
      [
        'Ücretsiz haklarım neler?',
        'Telefon numaranı doğruladığında 1 ücretsiz talep hakkı ve satıcı olarak günde 5 ücretsiz ilk mesaj hakkı alırsın.',
      ],
      [
        'Satın aldığım hak iade edilir mi?',
        'Ek talep ve mesaj haklarını kullanmadıysan 14 gün içinde iade isteyebilirsin; bir kısmını kullandıysan kalan kısım iade edilir. Öne çıkarma ve uzatma satın aldığın anda başladığı için iade edilmez. Hesabını kapatırsan web’den alıp kullanmadığın haklar ödediğin tutar üzerinden iade edilir. App Store veya Google Play’den yapılan satın alımlarda iade mağaza üzerinden istenir.',
      ],
      [
        'Faturamı nereden indirebilirim?',
        'Haklarım ve ödemeler sayfasındaki ödeme geçmişinden. E-arşiv faturan ayrıca e-postana gönderilir.',
      ],
    ],
  },
  {
    key: 'galeri',
    ad: 'Galeri hesapları',
    not: 'Başvuru, paketler, portföy, çalışanlar',
    renk: '#3DD68C',
    sorular: [
      [
        'Galeri hesabı nasıl açılır?',
        'Giriş ekranındaki “Kurumsal hesap başvurusu” ile başvur. Yetki belgen ve vergi bilgilerin doğrulandıktan sonra hesabın açılır ve 30 günlük deneme başlar.',
      ],
      [
        'Portföyümü toplu yükleyebilir miyim?',
        'Evet. Galeri panelinden Excel veya CSV dosyasıyla, Kurumsal pakette ayrıca API ile yükleyebilirsin. Her araç EİDS doğrulamasından sonra yayına girer.',
      ],
    ],
  },
  {
    key: 'guven',
    ad: 'Güvenli alışveriş',
    not: 'Kapora, sahte link, şikayet',
    renk: '#8B6CFF',
    sorular: [
      [
        'Satıcı kapora istiyor, göndermeli miyim?',
        'Hayır. Aracı görmeden hiçbir ödeme yapma. Kapora isteyen mesajlarda sana bir uyarı bandı gösteririz; mesajı “Şikayet et” ile bildirebilirsin.',
      ],
      [
        'Bana gelen ödeme linki güvenli mi?',
        'Rengarenk mesajla ödeme linki göndermez. Mesajdaki linklere tıklama, kart bilgisi girme.',
      ],
    ],
  },
  {
    key: 'hesap',
    ad: 'Hesap ve gizlilik',
    not: 'Telefon değişikliği, veriler, hesap kapatma',
    renk: '#2EC4B6',
    sorular: [
      [
        'Telefon numaramı nasıl değiştiririm?',
        'Ayarlar > Profil bölümünde “Numarayı değiştir”i seç ve yeni numarana gelen SMS kodunu gir.',
      ],
      [
        'Verilerimin kopyasını alabilir miyim?',
        'Evet. Ayarlar > Gizlilik ve güvenlik bölümünden talep et; en geç 30 gün içinde e-postana gönderilir.',
      ],
    ],
  },
] as const;

/** Destek formundaki konular (Yardim.dc.html); ödeme ve hesap güvenliği öne alınır (Karar 54) */
export const SUPPORT_TOPICS = {
  odeme: { ad: 'Ödeme veya fatura', etiket: 'Ödeme', oncelikli: true },
  talep: { ad: 'Talebim yayınlanmadı', etiket: 'Talep', oncelikli: false },
  dolandiricilik: { ad: 'Dolandırıcılık şüphesi', etiket: 'Güvenlik', oncelikli: true },
  hesap: { ad: 'Hesabım engellendi', etiket: 'Hesap', oncelikli: true },
  diger: { ad: 'Diğer', etiket: 'Diğer', oncelikli: false },
} as const;
export type SupportTopic = keyof typeof SUPPORT_TOPICS;
export const SUPPORT_TOPIC_KEYS = Object.keys(SUPPORT_TOPICS) as SupportTopic[];

export const SUPPORT_CHANNELS = { uygulama: 'Uygulama içi sohbet', eposta: 'E-posta' } as const;
export type SupportChannel = keyof typeof SUPPORT_CHANNELS;
export const SUPPORT_STATUSES = {
  acik: 'Yanıt bekliyor',
  yanitlandi: 'Yanıtlandı',
  cozuldu: 'Çözüldü',
} as const;
export type SupportStatus = keyof typeof SUPPORT_STATUSES;

/** Hazır yanıtlar (konsolda tek tıkla yanıta eklenir; YonetimPazar.dc.html › hazirYanit) */
export const SUPPORT_MACROS = [
  {
    ad: 'Günlük hak yenilenmesi',
    metin:
      'Bireysel üyelerde günlük 5 ücretsiz ilk mesaj hakkı her gece 00.00’da yenilenir. Satın aldığın ek haklar süresizdir; günlük hak bitince kendiliğinden kullanılır. Haklarım sayfasından ikisini birlikte görebilirsin.',
  },
  {
    ad: 'İade süreci',
    metin:
      'İade isteğini inceleyip uygun tutarı hesaplıyoruz; iadeyi şirket yöneticimiz onayladıktan sonra kartına yapılır ve bankana göre birkaç gün içinde hesabına geçer. App Store veya Google Play’den yapılan satın alımlarda iade mağaza üzerinden istenir.',
  },
  {
    ad: 'Kapora uyarısı',
    metin:
      'Aracı görmeden hiçbir ödeme yapma ve mesajla gelen ödeme bağlantılarına tıklama. Satışı noterde yap; ödemeyi satış anında güvenli ödeme sistemiyle tamamla. Şüpheli mesajı sohbetteki “Şikayet et” ile bildirebilirsin.',
  },
  {
    ad: 'Galeri başvuru belgeleri',
    metin:
      'Galeri başvurusu için yetki belgesi, vergi levhası ve MERSİS numarası gerekir. Belgeleri başvuru sayfasından yükleyebilirsin; kontrol genellikle bir iş günü sürer.',
  },
] as const;

/** Mesai: hafta içi 09.00–18.00 (İstanbul). İlk yanıt hedefi mesai içinde 2 saat, dışında ertesi iş günü 11.00 */
export const SUPPORT_HOURS = { bas: 9, bit: 18, ilkYanitSaat: 2, ertesiGunSaat: 11 } as const;

const TR_SAAT = 3 * 3_600_000;
/** İlk yanıtın son zamanı (bayramlar dikkate alınmaz) */
export function firstResponseDue(created: Date): Date {
  const tr = new Date(created.getTime() + TR_SAAT); // İstanbul saatini UTC alanlarında taşır
  const gun = tr.getUTCDay();
  const saat = tr.getUTCHours() + tr.getUTCMinutes() / 60;
  const isGunu = gun >= 1 && gun <= 5;
  if (isGunu && saat >= SUPPORT_HOURS.bas && saat + SUPPORT_HOURS.ilkYanitSaat <= SUPPORT_HOURS.bit) {
    return new Date(created.getTime() + SUPPORT_HOURS.ilkYanitSaat * 3_600_000);
  }
  // Mesai dışı (ya da mesai bitimine 2 saatten az kala): ertesi iş günü 11.00; hafta içi sabah 09.00'dan önce aynı gün
  const d = new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate()));
  if (!(isGunu && saat < SUPPORT_HOURS.bas)) d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return new Date(d.getTime() + SUPPORT_HOURS.ertesiGunSaat * 3_600_000 - TR_SAAT);
}

/**
 * Sık sorulanlardan ve hazır yanıtlardan en uygun yanıt (kelime örtüşmesi; yapay zekâ taslağı Rengarenk Ajanı ile
 * gelir, Karar 41, 54): kullanıcının kelimelerinin adayın soru ve yanıt metninde geçme oranı. Türkçe ekler için ilk 5
 * harf karşılaştırılır.
 */
export function suggestAnswer(
  text: string,
  /** Yayındaki yardım makaleleri (soru, yanıt); verilmezse koddaki sık sorulanlar (ilk kurulumdaki içerik) */
  makaleler?: readonly (readonly [string, string])[],
): { soru: string; cevap: string; skor: number } | null {
  const kok = (w: string) => w.slice(0, 5);
  const kelimeler = (s: string) =>
    new Set(
      s
        .toLocaleLowerCase('tr-TR')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3 && !BOS_KELIME.has(w))
        .map(kok),
    );
  const k = kelimeler(text);
  if (!k.size) return null;
  const adaylar: [string, string][] = [
    ...(makaleler?.map(([s, c]) => [s, c] as [string, string]) ??
      HELP_TOPICS.flatMap((t) => t.sorular.map(([s, c]) => [s, c] as [string, string]))),
    ...SUPPORT_MACROS.map((m) => [m.ad, m.metin] as [string, string]),
  ];
  let en: { soru: string; cevap: string; skor: number } | null = null;
  for (const [soru, cevap] of adaylar) {
    const baslik = kelimeler(soru);
    const govde = kelimeler(cevap);
    let puan = 0;
    for (const w of k) puan += baslik.has(w) || govde.has(w) ? 1 : 0;
    const skor = puan / k.size;
    if (!en || skor > en.skor) en = { soru, cevap, skor };
  }
  return en && en.skor >= 0.3 ? en : null;
}

/** Öneride sayılmayan sık kelimeler */
const BOS_KELIME = new Set([
  'neden',
  'nasıl',
  'merhaba',
  'bugün',
  'şimdi',
  'olarak',
  'için',
  'gibi',
  'daha',
  'kadar',
  'acaba',
]);

export const supportCreateSchema = z
  .object({
    konu: z.enum(SUPPORT_TOPIC_KEYS as [SupportTopic, ...SupportTopic[]]),
    referans: z.string().trim().max(40).optional(),
    metin: z.string().trim().min(10).max(2000),
  })
  .strict();
export const supportMessageSchema = z.object({ metin: z.string().trim().min(1).max(2000) }).strict();
export const supportReplySchema = z
  .object({ metin: z.string().trim().min(1).max(4000), coz: z.boolean().optional() })
  .strict();
export const supportRateSchema = z.object({ puan: z.number().int().min(1).max(5) }).strict();
/** Destek e-postası (posta sunucusunun imzalı bildirimi): gönderen, konu, düz metin */
export const supportInboundSchema = z
  .object({
    kimden: z.string().email().max(200),
    konu: z.string().max(300),
    metin: z.string().min(1).max(20_000),
  })
  .strict();

/** "D-20931" */
export const ticketNo = (no: number) => `D-${no}`;

// ── Yardım makaleleri (konsoldan yönetilir) ─────────────────────────

export const HELP_TOPIC_KEYS = HELP_TOPICS.map((t) => t.key) as [string, ...string[]];
export const HELP_STATUS = { taslak: 'Taslak', yayinda: 'Yayında', arsiv: 'Arşiv' } as const;

/** Konsol: makale ekle ya da düzenle */
export const helpArticleSchema = z
  .object({
    topic: z.enum(HELP_TOPIC_KEYS),
    title: z.string().trim().min(5).max(160),
    body: z.string().trim().min(20).max(5000),
    status: z.enum(['taslak', 'yayinda', 'arsiv']),
  })
  .strict();
export type HelpArticleInput = z.infer<typeof helpArticleSchema>;

/** Yardım merkezi: konu ve yayındaki makaleleri (soru, yanıt) */
export interface PublicHelpTopic {
  key: string;
  ad: string;
  not: string;
  renk: string;
  makaleler: { id: string; soru: string; cevap: string }[];
}
