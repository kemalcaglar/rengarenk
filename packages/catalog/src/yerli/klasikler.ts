/**
 * Türkiye'ye özgü eski modeller: kaynaklı başlangıç listesi (sahip kararı, 7 Kasım 2026).
 *
 * TSB yalnızca 2006 sonrasını, açık veri setleri ise bu modelleri hiç kapsamıyor; Wikidata'da da üretim yılları
 * girilmemiş. Bu yüzden değerler Türkçe Vikipedi maddelerinden bir kez derlendi. Karar 33'ün "kimse elle veri
 * girmez" ilkesine sınırlı bir istisnadır: liste küçüktür, her kayıt kaynağını (madde ve sürüm numarası) taşır,
 * ayrı kaynak olarak tutulur ve konsoldan kapatılabilir. Maddede yazmayan değer (ör. kasa) boş bırakılmıştır.
 * Yıllar maddedeki üretim yıllarıdır.
 */

export interface YerliKaynak {
  /** Vikipedi maddesinin adresi */
  url: string;
  /** Değerlerin okunduğu madde sürümü */
  surum: number;
}

export interface YerliSurum {
  /** Motor sürümü (katalogda "model"); maddede motor yazmıyorsa seri adı */
  model: string;
  /** Donanım paketi (maddedeki alt model adı: S, SLX, Kargo …) */
  paket?: string;
  baslangic: number;
  bitis: number;
  kasa?: string;
  motorL?: number;
  yakit?: 'benzin' | 'dizel';
}

export interface YerliNesil {
  ad: string;
  baslangic: number;
  bitis: number;
}

export interface YerliModel {
  marka: string;
  seri: string;
  kategori: 'otomobil' | 'ticari';
  kaynak: YerliKaynak;
  nesiller?: YerliNesil[];
  surumler: YerliSurum[];
}

/** Liste her değiştiğinde artar; katalog bu sürümle yeniden işlenir. */
export const YERLI_SURUM = '2026-11-07';

const KUS: YerliKaynak = { url: 'https://tr.wikipedia.org/wiki/Tofa%C5%9F_Ku%C5%9F_Serisi', surum: 38225471 };
const MURAT124: YerliKaynak = {
  url: 'https://tr.wikipedia.org/wiki/Tofa%C5%9F_Murat_124/Ser%C3%A7e',
  surum: 37048885,
};
const FIAT131: YerliKaynak = { url: 'https://tr.wikipedia.org/wiki/Fiat_131', surum: 38448989 };
const R12: YerliKaynak = { url: 'https://tr.wikipedia.org/wiki/Renault_12', surum: 38167538 };
const TOROS: YerliKaynak = { url: 'https://tr.wikipedia.org/wiki/Renault_Toros', surum: 36387345 };
const ANADOL: YerliKaynak = { url: 'https://tr.wikipedia.org/wiki/Anadol', surum: 36272186 };

/** Kuş Serisi'nin iki nesli: 1981'de Murat 131'in alt modelleri olarak, 1988'de kendi başlarına (Tofaş Kuş Serisi) */
const KUS_NESIL: YerliNesil[] = [
  { ad: 'Birinci nesil (Murat 131 Şahin/Kartal/Doğan)', baslangic: 1981, bitis: 1987 },
  { ad: 'İkinci nesil', baslangic: 1988, bitis: 2002 },
];

export const YERLI_KLASIKLER: YerliModel[] = [
  // ── Tofaş ────────────────────────────────────────────────
  {
    marka: 'Tofaş',
    seri: 'Murat 124',
    kategori: 'otomobil',
    kaynak: MURAT124,
    surumler: [{ model: 'Murat 124', baslangic: 1971, bitis: 1976 }],
  },
  {
    marka: 'Tofaş',
    seri: 'Serçe',
    kategori: 'otomobil',
    kaynak: KUS,
    surumler: [{ model: 'Serçe', baslangic: 1984, bitis: 1995 }],
  },
  {
    // Aralık 1976'da üretime başladı, Şubat 1977'de satışa sunuldu; 1978'de station wagon eklendi; Türkiye'de
    // üretimi 1987 sonuna kadar sürdü (Fiat 131 maddesi).
    marka: 'Tofaş',
    seri: 'Murat 131',
    kategori: 'otomobil',
    kaynak: FIAT131,
    surumler: [
      { model: 'Murat 131', baslangic: 1977, bitis: 1987, kasa: 'Sedan' },
      { model: 'Murat 131', baslangic: 1978, bitis: 1987, kasa: 'Station wagon' },
    ],
  },
  {
    marka: 'Tofaş',
    seri: 'Şahin',
    kategori: 'otomobil',
    kaynak: KUS,
    nesiller: KUS_NESIL,
    surumler: [
      { model: 'Şahin', paket: 'Murat 131 Şahin', baslangic: 1981, bitis: 1987, kasa: 'Sedan' },
      { model: '1.6', baslangic: 1988, bitis: 1994, kasa: 'Sedan', motorL: 1.6, yakit: 'benzin' },
      {
        model: '1.9 Dizel',
        paket: 'D',
        baslangic: 1989,
        bitis: 1991,
        kasa: 'Sedan',
        motorL: 1.9,
        yakit: 'dizel',
      },
      { model: '1.6', paket: 'S', baslangic: 1995, bitis: 1999, kasa: 'Sedan', motorL: 1.6, yakit: 'benzin' },
      { model: '1.4', baslangic: 1997, bitis: 1999, kasa: 'Sedan', motorL: 1.4, yakit: 'benzin' },
      { model: '1.4 ie', baslangic: 1999, bitis: 2002, kasa: 'Sedan', motorL: 1.4, yakit: 'benzin' },
      { model: '1.6 ie', baslangic: 1999, bitis: 2002, kasa: 'Sedan', motorL: 1.6, yakit: 'benzin' },
    ],
  },
  {
    // 131 Doğan sınıflandırması 1982'de başladı (Fiat 131 maddesi); alt modeller Kuş Serisi maddesinden.
    marka: 'Tofaş',
    seri: 'Doğan',
    kategori: 'otomobil',
    kaynak: KUS,
    nesiller: [
      { ad: 'Birinci nesil (Murat 131 Doğan)', baslangic: 1982, bitis: 1987 },
      KUS_NESIL[1] as YerliNesil,
    ],
    surumler: [
      { model: 'Doğan', paket: 'Murat 131 Doğan', baslangic: 1982, bitis: 1987, kasa: 'Sedan' },
      { model: '1.6', baslangic: 1988, bitis: 1990, kasa: 'Sedan', motorL: 1.6, yakit: 'benzin' },
      { model: 'Doğan', paket: 'L', baslangic: 1990, bitis: 1992, kasa: 'Sedan' },
      {
        model: '1.6',
        paket: 'SL',
        baslangic: 1992,
        bitis: 1992,
        kasa: 'Sedan',
        motorL: 1.6,
        yakit: 'benzin',
      },
      { model: 'Doğan', paket: 'SLX', baslangic: 1993, bitis: 1997, kasa: 'Sedan' },
      { model: 'Doğan', paket: 'S', baslangic: 1993, bitis: 1999, kasa: 'Sedan' },
      {
        model: '1.6 ie',
        paket: 'SLX',
        baslangic: 1997,
        bitis: 1999,
        kasa: 'Sedan',
        motorL: 1.6,
        yakit: 'benzin',
      },
      { model: '1.6 ie', baslangic: 1999, bitis: 2002, kasa: 'Sedan', motorL: 1.6, yakit: 'benzin' },
    ],
  },
  {
    marka: 'Tofaş',
    seri: 'Kartal',
    kategori: 'otomobil',
    kaynak: KUS,
    nesiller: KUS_NESIL,
    surumler: [
      { model: 'Kartal', paket: 'Murat 131 Kartal', baslangic: 1981, bitis: 1987, kasa: 'Station wagon' },
      { model: 'Kartal', baslangic: 1988, bitis: 2002, kasa: 'Station wagon' },
      {
        model: '1.9 Dizel',
        paket: 'D',
        baslangic: 1989,
        bitis: 1991,
        kasa: 'Station wagon',
        motorL: 1.9,
        yakit: 'dizel',
      },
      { model: 'Kartal', paket: 'L', baslangic: 1990, bitis: 1992, kasa: 'Station wagon' },
      {
        model: '1.6',
        paket: 'SL',
        baslangic: 1992,
        bitis: 1992,
        kasa: 'Station wagon',
        motorL: 1.6,
        yakit: 'benzin',
      },
      { model: 'Kartal', paket: 'SLX', baslangic: 1993, bitis: 1997, kasa: 'Station wagon' },
      { model: 'Kartal', paket: 'S', baslangic: 1993, bitis: 1999, kasa: 'Station wagon' },
      { model: 'Kartal', paket: 'Kargo', baslangic: 1998, bitis: 1999, kasa: 'Panelvan' },
      {
        model: '1.6 ie',
        paket: 'SLX',
        baslangic: 1997,
        bitis: 1999,
        kasa: 'Station wagon',
        motorL: 1.6,
        yakit: 'benzin',
      },
      { model: '1.6 ie', baslangic: 1999, bitis: 2002, kasa: 'Station wagon', motorL: 1.6, yakit: 'benzin' },
    ],
  },

  // ── Renault (Oyak-Renault, Bursa) ────────────────────────
  {
    // Türkiye'de 1971'de Bursa'da üretime başladı; TS, TX, TSW modellemesi 1989'da sona erdi; GTS 1983–1984.
    marka: 'Renault',
    seri: '12',
    kategori: 'otomobil',
    kaynak: R12,
    surumler: [
      { model: '12', baslangic: 1971, bitis: 1989 },
      { model: '12', paket: 'GTS', baslangic: 1983, bitis: 1984 },
    ],
  },
  {
    // 1989'da 4 ve 5 vitesli Toros ile Toros SW; 4 vitesliler 1991'de durdu; üretim 2000'de bitti.
    marka: 'Renault',
    seri: 'Toros',
    kategori: 'otomobil',
    kaynak: TOROS,
    surumler: [
      { model: 'Toros', paket: '4 vites', baslangic: 1989, bitis: 1991, kasa: 'Sedan' },
      { model: 'Toros', paket: '4 vites', baslangic: 1989, bitis: 1991, kasa: 'Station wagon' },
      { model: 'Toros', paket: '5 vites', baslangic: 1989, bitis: 2000, kasa: 'Sedan' },
      { model: 'Toros', paket: '5 vites', baslangic: 1989, bitis: 2000, kasa: 'Station wagon' },
    ],
  },

  // ── Anadol (Otosan) ──────────────────────────────────────
  {
    // Üretim Aralık 1966, satış 1967; coupé olarak başladı, 1973 sonundan itibaren sedan ve estate.
    marka: 'Anadol',
    seri: 'A1',
    kategori: 'otomobil',
    kaynak: ANADOL,
    surumler: [
      { model: 'A1', baslangic: 1967, bitis: 1975, kasa: 'Coupe' },
      { model: 'A1', baslangic: 1974, bitis: 1975, kasa: 'Sedan' },
      { model: 'A1', baslangic: 1974, bitis: 1975, kasa: 'Station wagon' },
    ],
  },
  {
    marka: 'Anadol',
    seri: 'A2',
    kategori: 'otomobil',
    kaynak: ANADOL,
    surumler: [
      { model: 'A2', baslangic: 1970, bitis: 1975, kasa: 'Sedan' },
      { model: 'A2', paket: 'SL', baslangic: 1976, bitis: 1981, kasa: 'Sedan' },
    ],
  },
  {
    marka: 'Anadol',
    seri: 'STC-16',
    kategori: 'otomobil',
    kaynak: ANADOL,
    surumler: [{ model: 'STC-16', baslangic: 1973, bitis: 1975, kasa: 'Coupe' }],
  },
  {
    marka: 'Anadol',
    seri: 'SV-1600',
    kategori: 'otomobil',
    kaynak: ANADOL,
    surumler: [
      { model: '1.6', baslangic: 1973, bitis: 1982, kasa: 'Station wagon', motorL: 1.6, yakit: 'benzin' },
    ],
  },
  {
    marka: 'Anadol',
    seri: 'Böcek',
    kategori: 'otomobil',
    kaynak: ANADOL,
    surumler: [{ model: 'Böcek', baslangic: 1975, bitis: 1977 }],
  },
  {
    marka: 'Anadol',
    seri: 'A8-16',
    kategori: 'otomobil',
    kaynak: ANADOL,
    surumler: [
      { model: '1.6', baslangic: 1981, bitis: 1982, kasa: 'Sedan', motorL: 1.6, yakit: 'benzin' },
      {
        model: '1.6',
        paket: 'Saloon 16',
        baslangic: 1983,
        bitis: 1984,
        kasa: 'Sedan',
        motorL: 1.6,
        yakit: 'benzin',
      },
    ],
  },
  {
    marka: 'Anadol',
    seri: 'Kamyonet',
    kategori: 'ticari',
    kaynak: ANADOL,
    surumler: [
      { model: 'Kamyonet', paket: 'Otosan 500 / 600D', baslangic: 1971, bitis: 1991, kasa: 'Kamyonet' },
    ],
  },
];
