import { z } from 'zod';

/**
 * Bildirim katmanı (Karar 30, 48, 49, 50; Teknik tasarım §9). Sistemin her parçası "bu kişiye bu olayı bildir" der;
 * kanal seçimi, tercih ve rıza, sıklık sınırı, sessiz saat ve teslim kaydı bu katmanda yapılır. Kanal sırası maliyete
 * göre: uygulama içi ve push, sonra e-posta (bildirim okunmadıysa gecikmeyle), en son SMS.
 */

/** Ayarlar ekranındaki kanallar; "Uygulama" uygulama içi bildirim ve push'u birlikte açar */
export const PREF_CHANNELS = ['uygulama', 'eposta', 'sms'] as const;
export type PrefChannel = (typeof PREF_CHANNELS)[number];
export const PREF_CHANNEL_NAMES: Record<PrefChannel, string> = {
  uygulama: 'Uygulama',
  eposta: 'E-posta',
  sms: 'SMS',
};

export type IletiTuru = 'islemsel' | 'ticari';

export interface NotifyTopic {
  ad: string;
  not: string;
  tur: IletiTuru;
  /** Varsayılan: uygulama, e-posta, SMS (Ayarlar.dc.html) */
  varsayilan: Record<PrefChannel, boolean>;
  /** Kapatılamayan kanallar */
  kilitli: PrefChannel[];
  /** Yalnızca galeri üyelerine gösterilir */
  galeri?: true;
}

/** Ayarlar › Bildirimler satırları (Ayarlar.dc.html); galeri satırı yalnızca galeri üyelerinde */
export const NOTIFY_TOPICS = {
  mesaj: {
    ad: 'Yeni mesaj',
    not: 'Biri talebine veya sohbetine yazdığında',
    tur: 'islemsel',
    varsayilan: { uygulama: true, eposta: true, sms: false },
    kilitli: [],
  },
  arama: {
    ad: 'Kayıtlı aramana uyan yeni talep',
    not: 'Her aramada ayrıca anlık veya günlük seçebilirsin',
    tur: 'islemsel',
    varsayilan: { uygulama: true, eposta: true, sms: false },
    kilitli: [],
  },
  sure: {
    ad: 'Talep süresi hatırlatması',
    not: 'Süre dolmadan 7, 3 ve 1 gün önce',
    tur: 'islemsel',
    varsayilan: { uygulama: true, eposta: true, sms: true },
    kilitli: [],
  },
  odeme: {
    ad: 'Ödeme ve fatura',
    not: 'Kapatılamaz',
    tur: 'islemsel',
    varsayilan: { uygulama: true, eposta: true, sms: false },
    kilitli: ['uygulama', 'eposta'],
  },
  kampanya: {
    ad: 'Kampanya ve duyurular',
    not: 'Ticari ileti onayı gerekir',
    tur: 'ticari',
    varsayilan: { uygulama: false, eposta: false, sms: false },
    kilitli: [],
  },
  galeri: {
    ad: 'Galeri: portföyüne uyan talepler ve ekip',
    not: 'Eşleşme, deneme süresi, ekip daveti',
    tur: 'islemsel',
    varsayilan: { uygulama: true, eposta: true, sms: false },
    kilitli: [],
    galeri: true,
  },
} as const satisfies Record<string, NotifyTopic>;
export type TopicKey = keyof typeof NOTIFY_TOPICS;
export const TOPIC_KEYS = Object.keys(NOTIFY_TOPICS) as TopicKey[];

/**
 * Şablonun konusu: ayardaki konulardan biri, `guvenlik` (hesap güvenliği; uygulama ve e-posta her zaman, kritik
 * durumda SMS) ya da `genel` (yalnızca uygulama içi; ör. talebin yayında).
 */
export type TemplateTopic = TopicKey | 'guvenlik' | 'genel';

/** Bildirim listesindeki süzgeç ve simge grubu (AnasayfaMobil.dc.html › bildirimler) */
export type NotifyGroup = 'mesaj' | 'talep' | 'guvenlik' | 'kampanya' | 'odeme' | 'galeri';
export const NOTIFY_GROUP_STYLE: Record<NotifyGroup, { ikon: string; tint: string }> = {
  mesaj: { ikon: '💬', tint: '#FFEEF6' },
  talep: { ikon: '⏳', tint: '#FFF6DF' },
  guvenlik: { ikon: '🛡️', tint: '#E7FAF0' },
  kampanya: { ikon: '🏷️', tint: '#EEF3FF' },
  odeme: { ikon: '🧾', tint: '#E7FAF0' },
  galeri: { ikon: '🚗', tint: '#EEF3FF' },
};

/**
 * Bildirim şablonu (Karar 48: tek şablondan uygulama içi, push, e-posta ve SMS metni). Metinlerde `{{degisken}}`
 * kullanılır; e-posta gövdesi paragraflar halindedir ve kurumsal e-posta düzenine (MJML) yerleştirilir.
 */
export interface NotifyTemplate {
  ad: string;
  konu: TemplateTopic;
  grup: NotifyGroup;
  /** Uygulama içi ve push */
  baslik: string;
  metin: string;
  /** Uygulama içinde açılacak adres (web yolu; mobil aynı yolu karşılar) */
  url?: string;
  eposta?: { konu: string; paragraflar: string[]; dugme?: { yazi: string; url: string } };
  /** SMS (Türkçe karakter kullanılabilir; 160 karakteri aşmamalı) */
  sms?: string;
  /** E-posta, bildirim bu kadar dakika okunmadıysa gider (0: hemen) */
  epostaGecikmeDk?: number;
  /** SMS yalnızca bu koşulda: `son_gun` (gun ≤ 1) */
  smsKosul?: 'son_gun';
  /** Aynı konuda okunmamış bildirimi güncelle (ör. sohbet başına tek bildirim): `{{conversationId}}` gibi */
  tekil?: string;
  /** Uygulama içi bildirim yazılmaz (ör. e-posta doğrulama) */
  yalnizcaEposta?: true;
  /** Galeri ekibine mi gider (hesabın sahip ve yöneticileri) */
  ekip?: true;
}

export const NOTIFY_TEMPLATES = {
  'talep.suresi_doluyor': {
    ad: 'Talep süresi doluyor (7, 3, 1 gün)',
    konu: 'sure',
    grup: 'talep',
    baslik: 'Talebin {{gun}} gün sonra doluyor',
    metin: '{{talep}} · {{yazan}} satıcı yazdı. Tek dokunuşla uzatabilirsin.',
    url: '/taleplerim',
    eposta: {
      konu: 'Talebin {{gun}} gün sonra doluyor',
      paragraflar: [
        'Merhaba {{ad}},',
        '“{{talep}}” talebinin süresi {{gun}} gün sonra doluyor. Şu ana kadar {{yazan}} satıcı yazdı.',
        'Aradığın aracı henüz bulmadıysan talebini uzatabilirsin; süresi dolan talep satıcılara görünmez.',
      ],
      dugme: { yazi: 'Taleplerime git', url: '/taleplerim' },
    },
    sms: 'Rengarenk: "{{talepKisa}}" talebin yarin doluyor. Uzatmak icin: {{link}}',
    smsKosul: 'son_gun',
  },
  'talep.suresi_doldu': {
    ad: 'Talep süresi doldu',
    konu: 'sure',
    grup: 'talep',
    baslik: 'Talebinin süresi doldu',
    metin: '{{talep}} pasife alındı. Uzatarak yeniden yayına alabilirsin.',
    url: '/taleplerim',
    eposta: {
      konu: 'Talebinin süresi doldu',
      paragraflar: [
        'Merhaba {{ad}},',
        '“{{talep}}” talebinin süresi doldu ve pasife alındı. Satıcılar artık göremez.',
        'Hâlâ arıyorsan talebini uzatarak yeniden yayına alabilirsin.',
      ],
      dugme: { yazi: 'Talebini uzat', url: '/taleplerim' },
    },
  },
  'talep.yayinlandi': {
    ad: 'Talep yayında',
    konu: 'genel',
    grup: 'talep',
    baslik: 'Talebin yayında',
    metin: '{{talep}} · uygun aracı olan satıcılara bildirildi.',
    url: '/taleplerim',
  },
  'mesaj.ilk': {
    ad: 'Talebe ilk mesaj',
    konu: 'mesaj',
    grup: 'mesaj',
    baslik: '{{satici}} talebine yazdı',
    metin: '{{talep}} · mesajı okumak için dokun.',
    url: '/mesajlarim?sohbet={{conversationId}}',
    tekil: 'sohbet:{{conversationId}}',
    epostaGecikmeDk: 15,
    eposta: {
      konu: '{{satici}} talebine yazdı',
      paragraflar: [
        'Merhaba {{ad}},',
        '{{satici}}, “{{talep}}” talebine bir mesaj gönderdi.',
        'Güvenliğin için mesajlaşmayı Rengarenk içinde sürdür; aracı görmeden kapora ya da ödeme gönderme.',
      ],
      dugme: { yazi: 'Mesajı oku', url: '/mesajlarim?sohbet={{conversationId}}' },
    },
  },
  'mesaj.geldi': {
    ad: 'Sohbette yeni mesaj',
    konu: 'mesaj',
    grup: 'mesaj',
    baslik: '{{gonderen}} yazdı',
    metin: '{{konu}} · yeni mesajın var.',
    url: '/mesajlarim?sohbet={{conversationId}}',
    tekil: 'sohbet:{{conversationId}}',
    epostaGecikmeDk: 30,
    eposta: {
      konu: '{{gonderen}} sana yazdı',
      paragraflar: [
        'Merhaba {{ad}},',
        '{{gonderen}} “{{konu}}” sohbetinde sana yazdı. Mesajın 30 dakikadır okunmadı.',
      ],
      dugme: { yazi: 'Mesajı oku', url: '/mesajlarim?sohbet={{conversationId}}' },
    },
  },
  'mesaj.uyari': {
    ad: 'Güvenlik uyarısı (mesaj)',
    konu: 'guvenlik',
    grup: 'guvenlik',
    baslik: 'Güvenlik uyarısı',
    metin: 'Bir mesajda {{neden}} geçiyor. Aracı görmeden ödeme yapma, kapora gönderme.',
    url: '/mesajlarim?sohbet={{conversationId}}',
  },
  'eslesme.bulundu': {
    ad: 'Portföye uyan talep (galeri)',
    konu: 'galeri',
    grup: 'galeri',
    baslik: 'Portföyündeki araca uyan talep',
    metin: '{{arac}} · {{talep}} talebine %{{skor}} uyuyor.',
    url: '/galeri-paneli?bolum=eslesme',
    ekip: true,
    eposta: {
      konu: 'Portföyündeki {{arac}} bir talebe uyuyor',
      paragraflar: [
        'Merhaba {{ad}},',
        '{{galeri}} portföyündeki {{arac}}, “{{talep}}” talebine %{{skor}} uyuyor.',
        'Araç kartıyla ilk mesajı göndererek alıcıya ulaşabilirsin.',
      ],
      dugme: { yazi: 'Eşleşmeleri gör', url: '/galeri-paneli?bolum=eslesme' },
    },
  },
  'takip.ozet': {
    ad: 'Takip ettiğin galeriden yeni araç',
    konu: 'arama',
    grup: 'galeri',
    baslik: '{{galeri}} talebine uyan araç ekledi',
    metin: '{{sayi}} yeni araç · görmek için dokun.',
    url: '/galeri/{{slug}}',
  },
  'arama.yeni_talep': {
    ad: 'Kayıtlı aramaya uyan talep',
    konu: 'arama',
    grup: 'talep',
    baslik: '“{{arama}}” aramana uyan yeni talep',
    metin: '{{talep}} · {{yer}}',
    url: '/talep/{{no}}',
    epostaGecikmeDk: 0,
    eposta: {
      konu: '“{{arama}}” aramana uyan yeni talep',
      paragraflar: [
        'Merhaba {{ad}},',
        'Kayıtlı aramana uyan yeni bir talep yayınlandı: “{{talep}}” ({{yer}}).',
      ],
      dugme: { yazi: 'Talebi gör', url: '/talep/{{no}}' },
    },
  },
  'arama.gunluk_ozet': {
    ad: 'Kayıtlı aramalar günlük özet',
    konu: 'arama',
    grup: 'talep',
    baslik: 'Kayıtlı aramalarına uyan {{sayi}} yeni talep',
    metin: '{{aramalar}}',
    url: '/favoriler',
    eposta: {
      konu: 'Kayıtlı aramalarına uyan {{sayi}} yeni talep',
      paragraflar: [
        'Merhaba {{ad}},',
        'Dün kayıtlı aramalarına uyan {{sayi}} yeni talep yayınlandı: {{aramalar}}.',
      ],
      dugme: { yazi: 'Aramalarıma git', url: '/favoriler' },
    },
  },
  'odeme.alindi': {
    ad: 'Ödeme alındı',
    konu: 'odeme',
    grup: 'odeme',
    baslik: 'Ödemen alındı',
    metin: '{{kalem}} · {{tutar}}. Faturan hazırlanınca indirebilirsin.',
    url: '/haklarim',
    eposta: {
      konu: 'Ödemen alındı · {{tutar}}',
      paragraflar: [
        'Merhaba {{ad}},',
        '{{siparis}} numaralı siparişin için {{tutar}} ödemen alındı: {{kalem}}.',
        'E-arşiv faturan kesilince Haklarım ve ödemeler sayfasından indirebilirsin. Ön bilgilendirme formu ve sözleşme de aynı sayfada.',
      ],
      dugme: { yazi: 'Haklarım ve ödemeler', url: '/haklarim' },
    },
  },
  'abonelik.odeme_basarisiz': {
    ad: 'Galeri yenileme ödemesi alınamadı',
    konu: 'odeme',
    grup: 'odeme',
    baslik: 'Yenileme ödemesi alınamadı',
    metin: '{{neden}}. Kartın yeniden denenecek; ödeme alınamazsa paketin askıya alınır.',
    url: '/galeri-paneli?bolum=paket',
    ekip: true,
    eposta: {
      konu: 'Paketinin yenileme ödemesi alınamadı',
      paragraflar: [
        'Merhaba {{ad}},',
        '{{galeri}} paketinin yenileme ödemesi alınamadı ({{neden}}).',
        'Kayıtlı kartın 3 gün içinde yeniden denenecek. Kartını güncellemek için Paket ve faturalar sayfasını kullanabilirsin.',
      ],
      dugme: { yazi: 'Kartı güncelle ve öde', url: '/galeri-paneli?bolum=paket' },
    },
    sms: 'Rengarenk: {{galeriKisa}} paket yenileme odemesi alinamadi. Karti guncellemek icin: {{link}}',
  },
  'abonelik.yenileme_yaklasti': {
    ad: 'Paket yenileme hatırlatması',
    konu: 'odeme',
    grup: 'odeme',
    baslik: 'Paketin {{tarih}} tarihinde yenilenecek',
    metin: '{{tutar}} kayıtlı kartından çekilecek.',
    url: '/galeri-paneli?bolum=paket',
    ekip: true,
    eposta: {
      konu: 'Paketin {{tarih}} tarihinde yenilenecek',
      paragraflar: [
        'Merhaba {{ad}},',
        '{{galeri}} paketi {{tarih}} tarihinde kendiliğinden yenilenecek ve kayıtlı kartından {{tutar}} çekilecek.',
        'Yenilenmesini istemiyorsan dönem bitmeden iptal edebilirsin; paket dönem sonuna kadar açık kalır.',
      ],
      dugme: { yazi: 'Paket ve faturalar', url: '/galeri-paneli?bolum=paket' },
    },
  },
  'abonelik.bitti': {
    ad: 'Galeri paketi sona erdi',
    konu: 'odeme',
    grup: 'odeme',
    baslik: 'Paketin sona erdi',
    metin: 'Paket seçene kadar yalnızca portföyünü görüntüleyebilirsin.',
    url: '/galeri-paneli?bolum=paket',
    ekip: true,
    eposta: {
      konu: 'Galeri paketin sona erdi',
      paragraflar: [
        'Merhaba {{ad}},',
        '{{galeri}} paketi sona erdi. Paket seçene kadar yalnızca portföyünü görüntüleyebilirsin.',
      ],
      dugme: { yazi: 'Paket seç', url: '/galeri-paneli?bolum=paket' },
    },
  },
  'iade.yurutuldu': {
    ad: 'İade yapıldı',
    konu: 'odeme',
    grup: 'odeme',
    baslik: 'İaden yapıldı',
    metin: '{{siparis}} · {{tutar}} kartına iade edildi.',
    url: '/haklarim',
    eposta: {
      konu: 'İaden yapıldı · {{tutar}}',
      paragraflar: [
        'Merhaba {{ad}},',
        '{{siparis}} numaralı siparişin için {{tutar}} kartına iade edildi. Bankana göre hesabına geçmesi birkaç gün sürebilir.',
      ],
      dugme: { yazi: 'Ödeme geçmişi', url: '/haklarim' },
    },
  },
  'galeri.onaylandi': {
    ad: 'Galeri başvurusu onaylandı',
    konu: 'galeri',
    grup: 'galeri',
    baslik: 'Galeri hesabın açıldı',
    metin: '{{galeri}} onaylandı. 30 günlük ücretsiz denemen başladı.',
    url: '/galeri-paneli',
    eposta: {
      konu: 'Galeri hesabın açıldı',
      paragraflar: [
        'Merhaba {{ad}},',
        '{{galeri}} başvurun onaylandı. 30 günlük ücretsiz denemen başladı; kart bilgisi istenmez.',
        'Portföyüne araç ekleyerek alıcı taleplerine uyan araçlarını görebilirsin.',
      ],
      dugme: { yazi: 'Galeri paneline git', url: '/galeri-paneli' },
    },
  },
  'galeri.reddedildi': {
    ad: 'Galeri başvurusu reddedildi',
    konu: 'galeri',
    grup: 'galeri',
    baslik: 'Galeri başvurun onaylanmadı',
    metin: 'Gerekçeyi başvuru sayfasında görebilirsin.',
    url: '/kurumsal-basvuru',
    eposta: {
      konu: 'Galeri başvurun onaylanmadı',
      paragraflar: [
        'Merhaba {{ad}},',
        'Galeri başvurun onaylanmadı. Gerekçeyi ve yapabileceklerini başvuru sayfasında görebilirsin.',
      ],
      dugme: { yazi: 'Başvuruma git', url: '/kurumsal-basvuru' },
    },
  },
  'galeri.belge_istendi': {
    ad: 'Galeri başvurusu için belge istendi',
    konu: 'galeri',
    grup: 'galeri',
    baslik: 'Başvurun için ek belge gerekiyor',
    metin: 'Başvuru sayfasından belgeyi yükleyebilirsin.',
    url: '/kurumsal-basvuru',
    eposta: {
      konu: 'Galeri başvurun için ek belge gerekiyor',
      paragraflar: [
        'Merhaba {{ad}},',
        'Başvurunu tamamlamak için ek belge gerekiyor. Açıklamayı başvuru sayfasında görebilirsin.',
      ],
      dugme: { yazi: 'Belgeyi yükle', url: '/kurumsal-basvuru' },
    },
  },
  'galeri.deneme_bitiyor': {
    ad: 'Galeri denemesi bitiyor',
    konu: 'galeri',
    grup: 'galeri',
    baslik: 'Denemen {{gun}} gün sonra bitiyor',
    metin: 'Paket seçmezsen yalnızca portföyünü görüntüleyebileceksin.',
    url: '/galeri-paneli?bolum=paket',
    ekip: true,
    eposta: {
      konu: 'Ücretsiz denemen {{gun}} gün sonra bitiyor',
      paragraflar: [
        'Merhaba {{ad}},',
        '{{galeri}} için ücretsiz denemen {{gun}} gün sonra bitiyor. Deneme kendiliğinden ücretli pakete geçmez.',
        'Paket seçmezsen portföyünü yalnızca görüntüleyebileceksin.',
      ],
      dugme: { yazi: 'Paketleri gör', url: '/galeri-paneli?bolum=paket' },
    },
  },
  'galeri.deneme_bitti': {
    ad: 'Galeri denemesi bitti',
    konu: 'galeri',
    grup: 'galeri',
    baslik: 'Ücretsiz denemen bitti',
    metin: 'Paket seçene kadar yalnızca portföyünü görüntüleyebilirsin.',
    url: '/galeri-paneli?bolum=paket',
    ekip: true,
  },
  'portfoy.eids_reddedildi': {
    ad: 'EİDS doğrulaması reddedildi',
    konu: 'galeri',
    grup: 'galeri',
    baslik: 'Aracın EİDS doğrulamasından geçmedi',
    metin: '{{arac}} alıcılara görünmüyor. Ayrıntı portföyünde.',
    url: '/galeri-paneli?bolum=portfoy',
    ekip: true,
  },
  'kampanya.duyuru': {
    ad: 'Kampanya ve duyuru (ticari)',
    konu: 'kampanya',
    grup: 'kampanya',
    baslik: '{{baslik}}',
    metin: '{{metin}}',
    url: '{{url}}',
    eposta: {
      konu: '{{baslik}}',
      paragraflar: ['Merhaba {{ad}},', '{{metin}}'],
      dugme: { yazi: '{{dugme}}', url: '{{url}}' },
    },
  },
  'akis.hosgeldin': {
    ad: 'Akış: hoş geldin',
    konu: 'genel',
    grup: 'talep',
    baslik: 'Rengarenk’e hoş geldin',
    metin: 'Aradığın aracı yaz, uygun aracı olan satıcılar sana gelsin. İlk talebin ücretsiz.',
    url: '/talep-olustur',
  },
  'akis.ilk_talep': {
    ad: 'Akış: ilk talebini oluştur',
    konu: 'kampanya',
    grup: 'kampanya',
    baslik: 'İlk talebin ücretsiz',
    metin: 'Aradığın aracı 2 dakikada yaz; satıcılar sana gelsin.',
    url: '/talep-olustur',
    eposta: {
      konu: 'İlk talebin ücretsiz',
      paragraflar: [
        'Merhaba {{ad}},',
        'Aradığın aracı birkaç adımda yazarsan uygun aracı olan galeriler ve satıcılar sana yazar. İlk talebin ücretsiz.',
      ],
      dugme: { yazi: 'Talep oluştur', url: '/talep-olustur' },
    },
  },
  'akis.okumadin': {
    ad: 'Akış: ilk mesajı okumadın',
    konu: 'mesaj',
    grup: 'mesaj',
    baslik: '{{satici}} mesajı hâlâ okunmadı',
    metin: '{{talep}} · satıcı yanıtını bekliyor.',
    url: '/mesajlarim?sohbet={{conversationId}}',
    eposta: {
      konu: '{{satici}} mesajı hâlâ okunmadı',
      paragraflar: ['Merhaba {{ad}},', '{{satici}} dün “{{talep}}” talebine yazdı; mesaj henüz okunmadı.'],
      dugme: { yazi: 'Mesajı oku', url: '/mesajlarim?sohbet={{conversationId}}' },
    },
  },
  'akis.galeri_sessiz': {
    ad: 'Akış: galeri 7 gündür mesaj göndermedi',
    konu: 'galeri',
    grup: 'galeri',
    baslik: 'Portföyüne uyan {{sayi}} talep seni bekliyor',
    metin: '7 gündür ilk mesaj göndermedin. Araç kartıyla alıcılara ulaş.',
    url: '/galeri-paneli?bolum=eslesme',
    ekip: true,
    eposta: {
      konu: 'Portföyüne uyan {{sayi}} talep seni bekliyor',
      paragraflar: [
        'Merhaba {{ad}},',
        '{{galeri}} 7 gündür ilk mesaj göndermedi. Bu sürede portföyüne uyan {{sayi}} talep yayınlandı.',
      ],
      dugme: { yazi: 'Eşleşmeleri gör', url: '/galeri-paneli?bolum=eslesme' },
    },
  },
  'eposta.dogrulama': {
    ad: 'E-posta doğrulama',
    konu: 'guvenlik',
    grup: 'guvenlik',
    baslik: 'E-posta adresini doğrula',
    metin: '',
    yalnizcaEposta: true,
    eposta: {
      konu: 'E-posta adresini doğrula',
      paragraflar: [
        'Merhaba {{ad}},',
        'Bu adresi Rengarenk hesabına eklemek için aşağıdaki düğmeye bas. Bağlantı 24 saat geçerlidir.',
        'Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.',
      ],
      dugme: { yazi: 'E-postamı doğrula', url: '/eposta-dogrula?kod={{kod}}' },
    },
  },
  'moderasyon.karar': {
    ad: 'Moderasyon kararı (hakkında)',
    konu: 'guvenlik',
    grup: 'guvenlik',
    baslik: 'Hesabınla ilgili moderasyon kararı',
    metin: '{{karar}}. Gerekçeyi görebilir, 7 gün içinde itiraz edebilirsin.',
    url: '/itiraz/{{rapor}}',
    eposta: {
      konu: 'Hesabınla ilgili moderasyon kararı',
      paragraflar: [
        'Merhaba {{ad}},',
        'Bir şikâyet üzerine içeriğini inceledik ve şu kararı verdik: {{karar}}.',
        'Gerekçe: {{gerekce}}',
        'Karara katılmıyorsan 7 gün içinde itiraz edebilirsin. İtirazını kararı veren dışında bir moderatör inceler.',
      ],
      dugme: { yazi: 'Kararı gör, itiraz et', url: '/itiraz/{{rapor}}' },
    },
  },
  'moderasyon.aski': {
    ad: 'Hesap incelemeye alındı (ajan)',
    konu: 'guvenlik',
    grup: 'guvenlik',
    baslik: 'Hesabın incelemeye alındı',
    metin: 'Bir mesajın güvenlik kurallarına takıldı; 24 saat mesaj gönderemezsin. Moderatör inceleyecek.',
    url: '/mesajlarim',
    eposta: {
      konu: 'Hesabın incelemeye alındı',
      paragraflar: [
        'Merhaba {{ad}},',
        'Gönderdiğin bir mesaj kapora ya da ödeme isteği içerdiği için gizlendi ve hesabın 24 saat mesaj gönderemeyecek.',
        'Bir moderatör durumu inceleyip karar verecek; karar sana bildirilecek ve 7 gün içinde itiraz edebileceksin.',
      ],
    },
  },
  'moderasyon.sikayet_sonuc': {
    ad: 'Şikâyetin sonuçlandı',
    konu: 'guvenlik',
    grup: 'guvenlik',
    baslik: 'Şikâyetin sonuçlandı',
    metin: '{{sonuc}}',
    eposta: {
      konu: 'Şikâyetin sonuçlandı',
      paragraflar: [
        'Merhaba {{ad}},',
        'S-{{no}} numaralı şikâyetin için: {{sonuc}}',
        'Bildirdiğin için teşekkür ederiz.',
      ],
    },
  },
  'moderasyon.itiraz_sonuc': {
    ad: 'İtirazın sonuçlandı',
    konu: 'guvenlik',
    grup: 'guvenlik',
    baslik: 'İtirazın sonuçlandı',
    metin: '{{sonuc}}',
    url: '/itiraz/{{rapor}}',
    eposta: {
      konu: 'İtirazın sonuçlandı',
      paragraflar: ['Merhaba {{ad}},', '{{sonuc}}'],
      dugme: { yazi: 'Ayrıntıyı gör', url: '/itiraz/{{rapor}}' },
    },
  },
} as const satisfies Record<string, NotifyTemplate>;
export type TemplateKey = keyof typeof NOTIFY_TEMPLATES;
export const templateOf = (key: string): NotifyTemplate | undefined =>
  (NOTIFY_TEMPLATES as Record<string, NotifyTemplate>)[key];

/** Ayarlar › Bildirimler kaydı: değişen hücreler; kilitli kanallar ve ticari onaysız kampanya sunucuda reddedilir */
export const notifyPrefsSchema = z
  .object({
    tercihler: z
      .array(
        z
          .object({
            konu: z.enum(TOPIC_KEYS as [TopicKey, ...TopicKey[]]),
            kanal: z.enum(PREF_CHANNELS),
            acik: z.boolean(),
          })
          .strict(),
      )
      .min(1)
      .max(40),
  })
  .strict();

export const pushTokenSchema = z
  .object({ token: z.string().min(20).max(4096), platform: z.enum(['ios', 'android', 'web']) })
  .strict();

export const emailSetSchema = z
  .object({ eposta: z.email('Geçerli bir e-posta adresi yaz').max(120) })
  .strict();

/** Gösterim için maskeli e-posta: "ay***@ornek.com" */
export const maskEposta = (e: string) => {
  const [u = '', d = ''] = e.split('@');
  return `${u.slice(0, 2)}***@${d}`;
};

/**
 * Otomatik akışlar (Karar 51; YonetimKampanya.dc.html › akışlar). Adımlar kodda tanımlıdır; konsoldan açılıp kapanır.
 * Tetikleyici olaysa olayla, zamanlıysa işçinin günlük denetimiyle çalışır.
 */
export interface Automation {
  ad: string;
  tur: 'İşlemsel' | 'Ticari';
  /** Gönderdiği şablonlar (istatistik bunlardan) */
  sablonlar: readonly string[];
  varsayilan: boolean;
  adimlar: readonly { tip: string; baslik: string; detay: string }[];
}

export const AUTOMATIONS = {
  hosgeldin: {
    ad: 'Hoş geldin',
    tur: 'İşlemsel',
    sablonlar: ['akis.hosgeldin'],
    varsayilan: true,
    adimlar: [
      { tip: 'Tetikleyici', baslik: 'Yeni üyelik', detay: 'Telefonla kayıt tamamlanınca' },
      { tip: 'İleti', baslik: 'Uygulama içi: “Rengarenk’e hoş geldin”', detay: 'İlk talebin ücretsiz' },
      { tip: 'Hedef', baslik: 'İlk talep yayınlandı', detay: 'Akıştan çıkış' },
    ],
  },
  ilk_talep: {
    ad: 'İlk talebini oluştur',
    tur: 'Ticari',
    sablonlar: ['akis.ilk_talep'],
    varsayilan: true,
    adimlar: [
      { tip: 'Tetikleyici', baslik: 'Üyeliğin 3. günü, talep yok', detay: 'Her gün 09.30’da kontrol edilir' },
      { tip: 'Koşul', baslik: 'Ticari ileti onayı var mı?', detay: 'Yoksa akış durur (Karar 49)' },
      {
        tip: 'İleti',
        baslik: 'Uygulama içi ve e-posta: “İlk talebin ücretsiz”',
        detay: 'Haftada 2 ve sessiz saat kuralıyla',
      },
      { tip: 'Hedef', baslik: 'Talep yayınlandı', detay: 'Akıştan çıkış' },
    ],
  },
  doluyor: {
    ad: 'Talebin 3 gün sonra doluyor',
    tur: 'İşlemsel',
    sablonlar: ['talep.suresi_doluyor'],
    varsayilan: true,
    adimlar: [
      {
        tip: 'Tetikleyici',
        baslik: 'Talebin bitmesine 7, 3 ve 1 gün kaldı',
        detay: 'İşçi süre dolumlarıyla birlikte kontrol eder',
      },
      {
        tip: 'İleti',
        baslik: 'Uygulama içi ve push: “Talebin N gün sonra doluyor”',
        detay: 'Satıcı sayısıyla',
      },
      {
        tip: 'Koşul ve ileti',
        baslik: 'E-posta; son gün SMS',
        detay: 'Kişinin tercihine göre (Ayarlar › Bildirimler)',
      },
      { tip: 'Hedef', baslik: 'Talep uzatıldı', detay: 'Akıştan çıkış' },
    ],
  },
  okumadin: {
    ad: 'İlk mesajı okumadın',
    tur: 'İşlemsel',
    sablonlar: ['akis.okumadin'],
    varsayilan: false,
    adimlar: [
      {
        tip: 'Tetikleyici',
        baslik: 'Talebe gelen ilk mesaj 24 saattir okunmadı',
        detay: 'Her gün 09.30’da kontrol edilir',
      },
      { tip: 'İleti', baslik: 'Uygulama içi ve e-posta hatırlatması', detay: 'Sohbet başına bir kez' },
      { tip: 'Hedef', baslik: 'Mesaj okundu', detay: 'Akıştan çıkış' },
    ],
  },
  galeri7: {
    ad: 'Galeri 7 gündür mesaj göndermedi',
    tur: 'İşlemsel',
    sablonlar: ['akis.galeri_sessiz'],
    varsayilan: true,
    adimlar: [
      {
        tip: 'Tetikleyici',
        baslik: 'Paketli galeri 7 gündür ilk mesaj göndermedi',
        detay: 'Portföyüne uyan yeni talep varsa',
      },
      {
        tip: 'İleti',
        baslik: 'Uygulama içi ve e-posta: “Portföyüne uyan N talep”',
        detay: 'Galeri sahibi ve yöneticilerine',
      },
      { tip: 'Hedef', baslik: 'İlk mesaj gönderildi', detay: 'Akıştan çıkış · 7 gün sonra yeniden' },
    ],
  },
  deneme: {
    ad: 'Deneme bitiyor',
    tur: 'İşlemsel',
    sablonlar: ['galeri.deneme_bitiyor', 'galeri.deneme_bitti'],
    varsayilan: true,
    adimlar: [
      { tip: 'Tetikleyici', baslik: 'Denemenin bitmesine 7, 3 ve 1 gün kaldı', detay: 'Karar 12.5' },
      {
        tip: 'İleti',
        baslik: 'Uygulama içi ve e-posta: paket seç',
        detay: 'Kart istenmez, kendiliğinden ücretliye geçmez',
      },
      { tip: 'Hedef', baslik: 'Paket alındı', detay: 'Akıştan çıkış' },
    ],
  },
  odeme: {
    ad: 'Ödeme başarısız',
    tur: 'İşlemsel',
    sablonlar: ['abonelik.odeme_basarisiz'],
    varsayilan: true,
    adimlar: [
      {
        tip: 'Tetikleyici',
        baslik: 'Abonelik yenileme ödemesi alınamadı',
        detay: '3 gün günde bir yeniden denenir',
      },
      {
        tip: 'İleti',
        baslik: 'Uygulama içi, e-posta ve SMS: kartı güncelle',
        detay: 'Ödeme sorunu kritik sayılır (Karar 49)',
      },
      { tip: 'Hedef', baslik: 'Ödeme alındı', detay: 'Akıştan çıkış; alınamazsa paket askıya alınır' },
    ],
  },
} as const satisfies Record<string, Automation>;
export type AutomationKey = keyof typeof AUTOMATIONS;
export const AUTOMATION_KEYS = Object.keys(AUTOMATIONS) as AutomationKey[];

/** Şablonu gönderen akış (kapalıysa gönderilmez) */
export const automationOf = (sablon: string): AutomationKey | undefined =>
  AUTOMATION_KEYS.find((k) => (AUTOMATIONS[k].sablonlar as readonly string[]).includes(sablon));

/** Şablon metnindeki değişkenler: {{ad}}, {{talep}} … */
export function templateVariables(t: NotifyTemplate): string[] {
  const metinler = [
    t.baslik,
    t.metin,
    t.url ?? '',
    t.sms ?? '',
    t.eposta?.konu ?? '',
    ...(t.eposta?.paragraflar ?? []),
    t.eposta?.dugme?.yazi ?? '',
    t.eposta?.dugme?.url ?? '',
  ];
  return [
    ...new Set(metinler.flatMap((m) => [...m.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((x) => x[1] as string))),
  ];
}

/** Konsolda şablonun yeni sürümü: yalnızca metinler değişir; konu, kanal kuralları ve akış kodda */
export const templateEditSchema = z
  .object({
    baslik: z.string().trim().min(2).max(120),
    metin: z.string().trim().max(400),
    sms: z.string().trim().max(320).optional(),
    eposta: z
      .object({
        konu: z.string().trim().min(2).max(160),
        paragraflar: z.array(z.string().trim().min(1).max(1000)).min(1).max(8),
        dugme: z
          .object({ yazi: z.string().trim().min(2).max(60), url: z.string().trim().min(1).max(300) })
          .optional(),
      })
      .optional(),
  })
  .strict();
export type TemplateEdit = z.infer<typeof templateEditSchema>;
