import type { CategoryDefinition, CategoryField, CategoryRules, FieldOption } from './category-schema.js';

/**
 * Kategori ağacının ve şemalarının ilk hali (Karar 19, 23, 45; docs/kapsam/04-kategori-semalari.md).
 * Veritabanında kategori yoksa bu tanımlar 1. sürüm olarak yayına girer; sonraki her değişiklik konsoldan,
 * taslak ve dört göz onayıyla yapılır. Buradaki değişiklik var olan kategorileri etkilemez.
 */

type FieldInput = Partial<CategoryField> & Pick<CategoryField, 'key' | 'label' | 'type'>;

const field = (f: FieldInput): CategoryField => ({
  required: false,
  filter: true,
  hard: 'no',
  weight: 0,
  source: 'alici',
  step: 'kriterler',
  scope: 'alternatif',
  ...f,
});

/** "benzin:Benzin" biçiminden seçenek listesi */
const opts = (...items: string[]): FieldOption[] =>
  items.map((s) => {
    const [value, label, hex] = s.split(':') as [string, string, string?];
    return hex ? { value, label, hex: `#${hex}` } : { value, label };
  });

const liste = (f: FieldInput) => field({ source: 'liste', ...f });

// ── Ortak alanlar ─────────────────────────────────────────────

const model = (label = 'Marka, seri, model', sourceNote?: string, required = true) =>
  field({
    key: 'model',
    label,
    type: 'catalog',
    required,
    weight: 30,
    source: 'katalog',
    sourceNote,
    step: 'ana_arac',
    scope: 'talep',
  });
const kasa = () =>
  field({
    key: 'kasa',
    label: 'Kasa ve makyaj',
    type: 'multiselect',
    filter: true,
    weight: 8,
    source: 'katalog',
  });
const paket = () =>
  field({ key: 'paket', label: 'Donanım paketi', type: 'multiselect', weight: 6, source: 'katalog' });
const yil = (label = 'Model yılı', weight = 15) =>
  field({ key: 'yil', label, type: 'range', required: true, weight, min: 1900, max: 2100 });
const km = (weight = 10, filter = true) =>
  field({
    key: 'km',
    label: 'Kilometre (en çok)',
    matchName: 'Kilometre',
    type: 'number',
    weight,
    filter,
    unit: 'km',
    min: 0,
    max: 3_000_000,
  });
const YAKIT = opts(
  'benzin:Benzin',
  'dizel:Dizel',
  'lpg_benzin:LPG & Benzin',
  'hibrit:Hibrit',
  'elektrik:Elektrik',
);
const yakit = (options = YAKIT, weight = 8) =>
  liste({ key: 'yakit', label: 'Yakıt', type: 'multiselect', weight, hard: 'strict', options });
const vites = (options = opts('manuel:Manuel', 'otomatik:Otomatik', 'yari_otomatik:Yarı otomatik')) =>
  liste({ key: 'vites', label: 'Vites', type: 'multiselect', hard: 'strict', options });
const hasar = (weight = 6) =>
  liste({
    key: 'hasar',
    label: 'Hasar kaydı',
    type: 'select',
    weight,
    options: opts('yok:Hasar kaydı olmasın', 'kucuk:Küçük hasar kaydı olabilir', 'fark_etmez:Fark etmez'),
  });
const RENK = opts(
  'beyaz:Beyaz:FFFFFF',
  'gri:Gri:A3A9B6',
  'siyah:Siyah:2B2F3A',
  'mavi:Mavi:5B8CFF',
  'kirmizi:Kırmızı:E5484D',
  'gumus:Gümüş:C9CED8',
  'lacivert:Lacivert:24315E',
  'yesil:Yeşil:3E8E5E',
  'kahverengi:Kahverengi:7A5236',
  'bej:Bej:D9C7A7',
  'sari:Sarı:FFC84A',
  'turuncu:Turuncu:FF8A5B',
  'bordo:Bordo:7A1F2B',
);
const renk = (weight = 3) =>
  liste({ key: 'renk', label: 'Renk', type: 'multiselect', weight, options: RENK });
const durum = () =>
  liste({
    key: 'durum',
    label: 'Durum',
    type: 'multiselect',
    options: opts('sifir:Sıfır', 'ikinci_el:İkinci el'),
  });
const kimden = () =>
  liste({
    key: 'kimden',
    label: 'Kimden',
    type: 'multiselect',
    scope: 'talep',
    options: opts('galeri:Galeriden', 'sahibinden:Sahibinden'),
  });
const takas = () =>
  field({
    key: 'takas',
    label: 'Takas teklifine açığım',
    type: 'boolean',
    scope: 'talep',
    step: 'konum_iletisim',
  });
const cekis = (options = opts('onden:Önden', 'arkadan:Arkadan', 'dort:4x4 / AWD'), weight = 0) =>
  liste({ key: 'cekis', label: 'Çekiş', type: 'multiselect', weight, options });
const motorGucu = () =>
  field({
    key: 'motorGucu',
    label: 'Motor gücü',
    type: 'range',
    filter: false,
    unit: 'hp',
    min: 0,
    max: 2000,
  });
const motorHacmi = () =>
  field({
    key: 'motorHacmi',
    label: 'Motor hacmi',
    type: 'range',
    filter: false,
    unit: 'cc',
    min: 0,
    max: 20_000,
  });
const tramer = () =>
  field({
    key: 'tramer',
    label: 'Tramer tutarı (en çok)',
    type: 'number',
    filter: false,
    unit: 'TL',
    min: 0,
    max: 100_000_000,
  });
const boya = () =>
  field({
    key: 'boya',
    label: 'Boya ve değişen',
    type: 'paint',
    filter: false,
    step: 'boya_hasar',
    scope: 'talep',
    help: 'Her parça için kabul ettiğin en fazla işlemi seç; en çok kaç parçada işlem olabileceğini belirle.',
  });
const islemKabul = () =>
  liste({
    key: 'islemKabul',
    label: 'Kabul ettiğin işlemler',
    type: 'multiselect',
    filter: false,
    step: 'boya_hasar',
    scope: 'talep',
    options: opts('sasi:Şasi işlemi', 'podye:Podye işlemi', 'airbag:Airbag açılmış', 'agir:Ağır hasar kaydı'),
    help: 'Seçmediğin işlemlerden biri olan araçlar sana yazamaz.',
  });

/** Binek uzantısı (04-kategori-semalari: Otomobil; Arazi, SUV & Pickup; Elektrikli; Minivan & Panelvan) */
const binek = (
  kasaTipleri: FieldOption[],
  extra: CategoryField[] = [],
  elektrikli = false,
): CategoryField[] => [
  model('Marka, seri, model', elektrikli ? 'açık kaynaklar ve TSB' : 'TSB ve açık kaynaklar'),
  kasa(),
  paket(),
  yil(),
  km(10, false),
  ...(elektrikli ? [] : [yakit()]),
  vites(),
  hasar(),
  renk(),
  liste({ key: 'kasaTipi', label: 'Kasa tipi', type: 'multiselect', options: kasaTipleri }),
  ...extra,
  ...(elektrikli ? [] : [motorHacmi()]),
  motorGucu(),
  tramer(),
  durum(),
  kimden(),
  takas(),
  boya(),
  islemKabul(),
];

// ── Kurallar ──────────────────────────────────────────────────

const rules = (r: Partial<CategoryRules> = {}): CategoryRules => ({
  listingDays: 30,
  tariff: 'genel',
  legalNotice: null,
  verifications: ['yetki_belgesi', 'vergi_levhasi', 'mersis'],
  catalog: 'tsb',
  freeFirstMessages: 5,
  matchThreshold: 80,
  ...r,
});

const def = (fields: CategoryField[], r: Partial<CategoryRules> = {}): CategoryDefinition => ({
  fields,
  rules: rules(r),
  baseWeights: { konum: 12, butce: 20 },
});

const ATV_UYARI =
  'Tescilsiz ATV ve UTV trafikte kullanılamaz. Motosiklet olarak tescilliyse A, traktör olarak tescilliyse en az F sınıfı ehliyet gerekir.';

const atvAlanlari = (): CategoryField[] => [
  model('Marka, model', 'VehiclesDB ve kullanıcı girdileri'),
  yil(),
  liste({
    key: 'tescil',
    label: 'Tescil durumu',
    type: 'multiselect',
    required: true,
    hard: 'yes',
    weight: 10,
    options: opts('motosiklet:Motosiklet olarak', 'traktor:Traktör (T3) olarak', 'tescilsiz:Tescilsiz'),
    help: 'Tescilsiz araç trafikte kullanılamaz.',
  }),
  field({ key: 'hacim', label: 'Motor hacmi', type: 'range', weight: 8, unit: 'cc', min: 0, max: 3000 }),
  liste({
    key: 'cekis',
    label: 'Çekiş',
    type: 'multiselect',
    weight: 6,
    options: opts('x42:4x2', 'x44:4x4'),
  }),
  km(6),
  field({ key: 'vinc', label: 'Vinç', type: 'boolean' }),
  renk(0),
  kimden(),
  takas(),
];

// ── Ağaç ──────────────────────────────────────────────────────

export interface DefaultCategory {
  slug: string;
  name: string;
  /** Üst kategori (ör. Ticari Araçlar'ın alt kategorileri) */
  parent?: string;
  /** Kapalı kategori menüde görünmez, talep açılamaz */
  enabled: boolean;
  definition: CategoryDefinition;
}

const ticariTaban = (): CategoryField[] => [
  model('Marka, model', 'TSB (hafif ticari) ve kullanıcı girdileri'),
  yil(),
];

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  {
    slug: 'otomobil',
    name: 'Otomobil',
    enabled: true,
    definition: def(
      binek(
        opts(
          'sedan:Sedan',
          'hatchback:Hatchback',
          'station_wagon:Station wagon',
          'coupe:Coupe',
          'cabrio:Cabrio',
          'mpv:MPV',
        ),
        [cekis()],
      ),
    ),
  },
  {
    slug: 'arazi-suv-pickup',
    name: 'Arazi, SUV & Pickup',
    enabled: true,
    definition: def(
      binek(opts('arazi:Arazi', 'suv:SUV', 'crossover:Crossover', 'pickup:Pickup'), [
        liste({
          key: 'pickupKabin',
          label: 'Pickup kabini',
          type: 'multiselect',
          options: opts('tek:Tek', 'bucuk:Buçuk', 'cift:Çift'),
          when: { field: 'kasaTipi', in: ['pickup'] },
        }),
        field({
          key: 'yukKasasi',
          label: 'Yük kasası uzunluğu',
          type: 'range',
          filter: false,
          unit: 'cm',
          min: 0,
          max: 400,
          when: { field: 'kasaTipi', in: ['pickup'] },
        }),
        cekis(
          opts(
            'onden:Önden',
            'arkadan:Arkadan',
            'surekli:Sürekli 4x4',
            'sonradan:Sonradan devreye giren 4x4',
            'awd:AWD',
          ),
          6,
        ),
        field({ key: 'cekiDemiri', label: 'Çeki demiri', type: 'boolean' }),
      ]),
    ),
  },
  {
    slug: 'elektrikli',
    name: 'Elektrikli Araçlar',
    enabled: true,
    definition: def(
      binek(
        opts(
          'sedan:Sedan',
          'hatchback:Hatchback',
          'suv:SUV',
          'crossover:Crossover',
          'station_wagon:Station wagon',
          'mpv:MPV',
        ),
        [
          field({
            key: 'menzil',
            label: 'WLTP menzili (en az)',
            type: 'number',
            weight: 8,
            unit: 'km',
            min: 0,
            max: 2000,
          }),
          field({
            key: 'batarya',
            label: 'Batarya kapasitesi (en az)',
            type: 'number',
            weight: 5,
            unit: 'kWh',
            min: 0,
            max: 300,
          }),
          field({
            key: 'dcSarj',
            label: 'DC şarj gücü (en az)',
            type: 'number',
            weight: 4,
            unit: 'kW',
            min: 0,
            max: 1000,
          }),
          field({
            key: 'acSarj',
            label: 'AC şarj gücü (en az)',
            type: 'number',
            filter: false,
            unit: 'kW',
            min: 0,
            max: 50,
          }),
          field({
            key: 'sarjSuresi',
            label: '%10–80 DC şarj süresi (en çok)',
            type: 'number',
            filter: false,
            unit: 'dk',
            min: 0,
            max: 300,
          }),
          field({ key: 'bataryaGaranti', label: 'Batarya garantisi devam ediyor', type: 'boolean' }),
          field({
            key: 'bataryaSagligi',
            label: 'Batarya sağlığı (en az)',
            type: 'number',
            unit: '%',
            min: 0,
            max: 100,
          }),
          liste({
            key: 'soket',
            label: 'Şarj soketi',
            type: 'multiselect',
            filter: false,
            options: opts('type2:Type 2', 'ccs2:CCS2', 'chademo:CHAdeMO', 'gbt:GB/T'),
          }),
          field({ key: 'isiPompasi', label: 'Isı pompası', type: 'boolean', filter: false }),
          cekis(),
        ],
        true,
      ),
      { catalog: 'acik' },
    ),
  },
  {
    slug: 'motosiklet',
    name: 'Motosiklet',
    enabled: true,
    definition: def(
      [
        model('Marka, model', 'TSB ve VehiclesDB'),
        liste({
          key: 'tip',
          label: 'Tip (naked, scooter, touring…)',
          type: 'multiselect',
          weight: 10,
          options: opts(
            'scooter:Scooter',
            'naked:Naked',
            'sport:Sport',
            'touring:Touring',
            'enduro:Enduro',
            'cross:Cross',
            'chopper:Chopper / Cruiser',
            'adventure:Adventure',
            'moped:Moped',
            'sepetli:Sepetli',
          ),
        }),
        field({
          key: 'hacim',
          label: 'Motor hacmi',
          type: 'range',
          weight: 10,
          unit: 'cc',
          min: 0,
          max: 3000,
        }),
        yil(),
        liste({
          key: 'ehliyet',
          label: 'Ehliyet sınıfı',
          type: 'multiselect',
          hard: 'yes',
          options: opts('a1:A1', 'a2:A2', 'a:A'),
        }),
        km(8),
        liste({
          key: 'zaman',
          label: 'Motor tipi',
          type: 'multiselect',
          filter: false,
          options: opts('iki:2 zamanlı', 'dort:4 zamanlı'),
        }),
        liste({
          key: 'sogutma',
          label: 'Soğutma',
          type: 'multiselect',
          filter: false,
          options: opts('hava:Hava', 'sivi:Sıvı', 'yag:Yağ'),
        }),
        field({ key: 'silindir', label: 'Silindir sayısı', type: 'range', filter: false, min: 1, max: 8 }),
        vites(opts('manuel:Manuel', 'otomatik:Otomatik', 'yari_otomatik:Yarı otomatik')),
        field({ key: 'abs', label: 'ABS', type: 'boolean' }),
        liste({
          key: 'hasarNotu',
          label: 'Hasar',
          type: 'select',
          options: opts('hasarsiz:Hasarsız olsun', 'fark_etmez:Fark etmez'),
        }),
        renk(0),
        durum(),
        kimden(),
        takas(),
      ],
      { catalog: 'motosiklet' },
    ),
  },
  {
    slug: 'minivan-panelvan',
    name: 'Minivan & Panelvan',
    enabled: true,
    definition: def(
      binek(opts('minivan:Minivan', 'panelvan:Panelvan', 'kombi:Kombi', 'camli_van:Camlı van'), [
        liste({
          key: 'koltuk',
          label: 'Koltuk sayısı',
          type: 'multiselect',
          weight: 8,
          options: opts('k2:2', 'k3:3', 'k5:5', 'k7:7', 'k8:8+1'),
        }),
        liste({
          key: 'ruhsat',
          label: 'Ruhsat cinsi',
          type: 'multiselect',
          weight: 6,
          options: opts('otomobil:Otomobil', 'kamyonet:Kamyonet'),
        }),
        liste({
          key: 'tavan',
          label: 'Tavan',
          type: 'multiselect',
          filter: false,
          options: opts('normal:Normal', 'yuksek:Yüksek'),
        }),
        liste({
          key: 'sasi',
          label: 'Şasi',
          type: 'multiselect',
          filter: false,
          options: opts('kisa:Kısa', 'orta:Orta', 'uzun:Uzun'),
        }),
        field({ key: 'surguluKapi', label: 'Sürgülü kapı', type: 'boolean', filter: false }),
      ]),
    ),
  },
  {
    slug: 'ticari',
    name: 'Ticari Araçlar',
    enabled: true,
    // Talep alt kategoriden açılır; alanlar alt kategoride (04-kategori-semalari: alanlar alt kategoriye göre değişir)
    definition: def([], { catalog: 'ticari' }),
  },
  {
    slug: 'kamyon-cekici',
    name: 'Kamyon & Çekici',
    parent: 'ticari',
    enabled: true,
    definition: def(
      [
        ...ticariTaban(),
        km(),
        yakit(opts('dizel:Dizel', 'lng:LNG', 'elektrik:Elektrik')),
        field({
          key: 'azamiAgirlik',
          label: 'Azami yüklü ağırlık',
          type: 'range',
          weight: 8,
          unit: 'ton',
          min: 0,
          max: 100,
        }),
        field({
          key: 'kapasite',
          label: 'Taşıma kapasitesi',
          type: 'range',
          filter: false,
          unit: 'ton',
          min: 0,
          max: 100,
        }),
        liste({
          key: 'aks',
          label: 'Aks düzeni',
          type: 'multiselect',
          weight: 8,
          options: opts('x42:4x2', 'x62:6x2', 'x64:6x4', 'x84:8x4'),
        }),
        liste({
          key: 'kabin',
          label: 'Kabin',
          type: 'multiselect',
          options: opts('yatakli:Yataklı', 'gunluk:Günlük'),
        }),
        liste({
          key: 'euro',
          label: 'Euro normu',
          type: 'multiselect',
          options: opts('euro3:Euro 3', 'euro4:Euro 4', 'euro5:Euro 5', 'euro6:Euro 6'),
        }),
        field({ key: 'retarder', label: 'Retarder', type: 'boolean', filter: false }),
        field({ key: 'pto', label: 'PTO', type: 'boolean', filter: false }),
        hasar(),
        kimden(),
        takas(),
      ],
      { catalog: 'ticari' },
    ),
  },
  {
    slug: 'kamyonet',
    name: 'Kamyonet',
    parent: 'ticari',
    enabled: true,
    definition: def(
      [
        ...ticariTaban(),
        km(),
        yakit(),
        vites(),
        liste({
          key: 'kasaTipi',
          label: 'Kasa tipi',
          type: 'multiselect',
          options: opts('acik:Açık kasa', 'kapali:Kapalı kasa', 'frigorifik:Frigorifik', 'damperli:Damperli'),
        }),
        field({
          key: 'kapasite',
          label: 'Taşıma kapasitesi (en az)',
          type: 'number',
          weight: 8,
          unit: 'kg',
          min: 0,
          max: 10_000,
        }),
        hasar(),
        renk(0),
        kimden(),
        takas(),
      ],
      { catalog: 'ticari' },
    ),
  },
  {
    slug: 'otobus-minibus-midibus',
    name: 'Otobüs, Minibüs & Midibüs',
    parent: 'ticari',
    enabled: true,
    definition: def(
      [
        ...ticariTaban(),
        field({ key: 'koltuk', label: 'Koltuk sayısı', type: 'range', weight: 10, min: 8, max: 120 }),
        liste({
          key: 'kullanim',
          label: 'Kullanım',
          type: 'multiselect',
          weight: 6,
          options: opts('sehir_ici:Şehir içi', 'sehirlerarasi:Şehirlerarası'),
        }),
        km(),
        yakit(opts('dizel:Dizel', 'cng:CNG', 'elektrik:Elektrik', 'hibrit:Hibrit')),
        vites(),
        field({ key: 'ayakta', label: 'Ayakta yolcu', type: 'boolean', filter: false }),
        field({ key: 'klima', label: 'Klima', type: 'boolean' }),
        field({ key: 'rampa', label: 'Engelli rampası', type: 'boolean' }),
        hasar(),
        kimden(),
        takas(),
      ],
      { catalog: 'ticari' },
    ),
  },
  {
    slug: 'dorse-romork',
    name: 'Dorse & Römork',
    parent: 'ticari',
    enabled: true,
    definition: def(
      [
        liste({
          key: 'tip',
          label: 'Tip',
          type: 'multiselect',
          required: true,
          weight: 20,
          options: opts(
            'tenteli:Tenteli',
            'damperli:Damperli',
            'frigorifik:Frigorifik',
            'lowbed:Lowbed',
            'silobas:Silobas',
            'tanker:Tanker',
            'konteyner:Konteyner',
          ),
        }),
        model('Marka, model', 'kullanıcı girdileri', false),
        yil('Yapım yılı'),
        liste({
          key: 'aks',
          label: 'Aks sayısı',
          type: 'multiselect',
          weight: 8,
          options: opts('a1:1', 'a2:2', 'a3:3', 'a4:4 ve üstü'),
        }),
        field({ key: 'uzunluk', label: 'Uzunluk', type: 'range', weight: 6, unit: 'm', min: 0, max: 30 }),
        field({ key: 'dingil', label: 'Dingil markası', type: 'text', filter: false }),
        kimden(),
        takas(),
      ],
      { catalog: 'kullanici' },
    ),
  },
  {
    slug: 'karoser-ust-yapi',
    name: 'Karoser & Üst Yapı',
    parent: 'ticari',
    enabled: true,
    definition: def(
      [
        liste({
          key: 'ustYapi',
          label: 'Üst yapı tipi',
          type: 'multiselect',
          required: true,
          weight: 20,
          options: opts(
            'damper:Damper',
            'kapali:Kapalı kasa',
            'acik:Açık kasa',
            'frigorifik:Frigorifik kasa',
            'tanker:Tanker',
            'cop:Çöp kasası',
            'vidanjor:Vidanjör',
            'diger:Diğer',
          ),
        }),
        model('Marka, model', 'kullanıcı girdileri', false),
        yil('Yapım yılı'),
        field({ key: 'olcu', label: 'Kasa ölçüleri', type: 'text', filter: false }),
        kimden(),
      ],
      { catalog: 'kullanici' },
    ),
  },
  {
    slug: 'oto-kurtarici-tasiyici',
    name: 'Oto Kurtarıcı & Taşıyıcı',
    parent: 'ticari',
    enabled: true,
    definition: def(
      [
        liste({
          key: 'tip',
          label: 'Tip',
          type: 'multiselect',
          required: true,
          weight: 15,
          options: opts(
            'kayar:Kayar kasa',
            'ahtapot:Ahtapot',
            'sabit:Sabit platform',
            'coklu:Çoklu taşıyıcı',
          ),
        }),
        ...ticariTaban(),
        field({
          key: 'platform',
          label: 'Platform kapasitesi (en az)',
          type: 'number',
          weight: 8,
          unit: 'ton',
          min: 0,
          max: 60,
        }),
        field({
          key: 'vinc',
          label: 'Vinç tonajı (en az)',
          type: 'number',
          filter: false,
          unit: 'ton',
          min: 0,
          max: 60,
        }),
        km(),
        kimden(),
        takas(),
      ],
      { catalog: 'ticari' },
    ),
  },
  {
    slug: 'ticari-hat-plaka',
    name: 'Ticari Hat & Plaka',
    parent: 'ticari',
    // Karar 19: avukat görüşü alınana kadar kapalı
    enabled: false,
    definition: def(
      [
        liste({
          key: 'plaka',
          label: 'Plaka türü',
          type: 'multiselect',
          required: true,
          hard: 'yes',
          weight: 20,
          step: 'ana_arac',
          scope: 'talep',
          options: opts('taksi:Taksi', 'dolmus:Dolmuş', 'servis:Servis', 'minibus:Minibüs hattı'),
        }),
        field({ key: 'guzergah', label: 'Güzergâh', type: 'text', filter: false, scope: 'talep' }),
      ],
      { catalog: 'yok', legalNotice: 'Ticari plaka ve hat devri belediye ve UKOME kurallarına tabidir.' },
    ),
  },
  {
    slug: 'kiralik',
    name: 'Kiralık Araçlar',
    enabled: true,
    definition: def(
      [
        field({
          key: 'tarih',
          label: 'Alış ve iade tarihi',
          type: 'daterange',
          required: true,
          hard: 'yes',
          step: 'ana_arac',
          scope: 'talep',
        }),
        liste({
          key: 'alisYeri',
          label: 'Alış yeri',
          type: 'select',
          required: true,
          weight: 10,
          scope: 'talep',
          options: opts('sube:Şube', 'havalimani:Havalimanı', 'adres:Adrese teslim'),
        }),
        field({ key: 'tekYon', label: 'Tek yön iade', type: 'boolean', scope: 'talep' }),
        liste({
          key: 'segment',
          label: 'Segment',
          type: 'multiselect',
          weight: 20,
          options: opts(
            'ekonomik:Ekonomik',
            'orta:Orta',
            'ust:Üst',
            'suv:SUV',
            'minivan:Minivan',
            'luks:Lüks',
          ),
        }),
        model('Marka, model', 'TSB', false),
        vites(),
        yakit(),
        field({ key: 'kisi', label: 'Kişi sayısı', type: 'number', weight: 6, min: 1, max: 20 }),
        field({ key: 'bagaj', label: 'Bagaj sayısı', type: 'number', filter: false, min: 0, max: 20 }),
        field({
          key: 'surucuYas',
          label: 'Sürücü yaşı',
          type: 'number',
          required: true,
          hard: 'yes',
          min: 18,
          max: 99,
          scope: 'talep',
        }),
        field({
          key: 'ehliyetYil',
          label: 'Ehliyet yılı',
          type: 'number',
          required: true,
          hard: 'yes',
          min: 0,
          max: 80,
          scope: 'talep',
        }),
        field({ key: 'ekSurucu', label: 'Ek sürücü', type: 'boolean', filter: false, scope: 'talep' }),
        liste({
          key: 'kiralamaTipi',
          label: 'Kiralama tipi',
          type: 'select',
          scope: 'talep',
          options: opts('gunluk:Günlük', 'haftalik:Haftalık', 'aylik:Aylık (uzun dönem)'),
        }),
        liste({
          key: 'ekTalep',
          label: 'Ek talepler',
          type: 'multiselect',
          filter: false,
          scope: 'talep',
          options: opts('cocuk_koltugu:Çocuk koltuğu', 'kis_lastigi:Kış lastiği', 'soforlu:Şoförlü'),
        }),
      ],
      {
        listingNote: 'Alış tarihine kadar, en fazla 30 gün',
        tariff: 'kiralik',
        verifications: ['kiralama_yetki', 'vergi_levhasi', 'mersis'],
        legalNotice:
          'Depozito yalnızca kart provizyonuyla alınır: 6 güne kadar en fazla 3 günlük, 7–29 gün en fazla 7 günlük kira. Günlük km sınırı 1–6 günde en az 150, 7–29 günde en az 100 km.',
      },
    ),
  },
  {
    slug: 'deniz',
    name: 'Deniz Araçları',
    enabled: true,
    definition: def(
      [
        liste({
          key: 'tip',
          label: 'Tip (motoryat, yelkenli, bot…)',
          type: 'select',
          required: true,
          weight: 25,
          sourceNote: 'kullanıcı girdileriyle büyür',
          step: 'ana_arac',
          scope: 'talep',
          options: opts(
            'motoryat:Motorlu yat',
            'yelkenli:Yelkenli',
            'gulet:Gulet',
            'surat:Sürat teknesi',
            'balikci:Balıkçı teknesi',
            'sisme:Şişme bot / RIB',
            'jetski:Jet ski',
            'motor:Deniz motoru',
            'kano:Kano, kayak, SUP',
          ),
        }),
        field({
          key: 'boy',
          label: 'Boy (metre)',
          type: 'range',
          required: true,
          weight: 15,
          unit: 'm',
          min: 0,
          max: 100,
        }),
        field({
          key: 'motorSaati',
          label: 'Motor saati (en çok)',
          type: 'number',
          weight: 8,
          unit: 'saat',
          min: 0,
          max: 100_000,
        }),
        liste({ key: 'liman', label: 'Bağlama limanı', type: 'location', weight: 10 }),
        liste({
          key: 'bayrak',
          label: 'Bayrak ve ruhsat',
          type: 'select',
          filter: false,
          options: opts(
            'turk:Türk bayraklı, bağlama kütüğüne kayıtlı',
            'yabanci:Yabancı bayraklı',
            'fark_etmez:Fark etmez',
          ),
        }),
        model('Tersane / marka, model', 'kullanıcı girdileri', false),
        yil('Yapım yılı', 10),
        liste({
          key: 'malzeme',
          label: 'Malzeme',
          type: 'multiselect',
          weight: 6,
          options: opts(
            'grp:GRP',
            'ahsap:Ahşap',
            'aluminyum:Alüminyum',
            'celik:Çelik',
            'pvc:PVC',
            'hypalon:Hypalon',
          ),
        }),
        field({
          key: 'kabin',
          label: 'Kabin sayısı (en az)',
          type: 'number',
          weight: 4,
          min: 0,
          max: 30,
          when: { field: 'tip', in: ['motoryat', 'yelkenli', 'gulet'] },
        }),
        field({
          key: 'motorGucu',
          label: 'Motor gücü',
          type: 'range',
          weight: 4,
          unit: 'hp',
          min: 0,
          max: 10_000,
        }),
        field({
          key: 'kisi',
          label: 'Kişi kapasitesi (en az)',
          type: 'number',
          filter: false,
          min: 1,
          max: 500,
        }),
        liste({
          key: 'ce',
          label: 'CE tasarım kategorisi',
          type: 'multiselect',
          filter: false,
          options: opts('a:A · açık deniz', 'b:B · denizde', 'c:C · kıyıya yakın', 'd:D · korunaklı su'),
        }),
        kimden(),
        takas(),
      ],
      {
        catalog: 'kullanici',
        verifications: ['vergi_levhasi', 'mersis'],
        legalNotice:
          "2,5 metre ve üzeri özel tekneler bağlama kütüğüne kayıtlı olmalıdır. Devir Liman Başkanlığı'nda veya noterde yapılmazsa hükümsüzdür; haciz ve ipotek kaydını ayrıca kontrol et.",
      },
    ),
  },
  {
    slug: 'hasarli',
    name: 'Hasarlı Araçlar',
    enabled: true,
    definition: def(
      [
        liste({
          key: 'aracTuru',
          label: 'Araç türü',
          type: 'select',
          required: true,
          hard: 'yes',
          step: 'ana_arac',
          scope: 'talep',
          options: opts(
            'otomobil:Otomobil',
            'arazi:Arazi, SUV & Pickup',
            'elektrikli:Elektrikli',
            'motosiklet:Motosiklet',
            'minivan:Minivan & Panelvan',
            'ticari:Ticari',
          ),
        }),
        model('Marka, seri, model', 'ana kategorinin kataloğu'),
        yil(),
        liste({
          key: 'hasarTuru',
          label: 'Hasar türü',
          type: 'multiselect',
          required: true,
          weight: 15,
          options: opts('pert:Pert', 'agir:Ağır', 'orta:Orta', 'hafif:Hafif'),
        }),
        field({ key: 'calisir', label: 'Çalışır durumda', type: 'boolean', weight: 8 }),
        field({ key: 'yurur', label: 'Yürür durumda', type: 'boolean', weight: 4 }),
        liste({
          key: 'belge',
          label: 'Belge durumu',
          type: 'multiselect',
          weight: 8,
          options: opts('hurda:Hurda tescil', 'cekme:Trafikten çekme', 'ruhsatli:Ruhsatlı'),
        }),
        liste({
          key: 'hasarKaynagi',
          label: 'Hasar kaynağı',
          type: 'multiselect',
          filter: false,
          options: opts('kaza:Kaza', 'sel:Sel', 'yangin:Yangın', 'dolu:Dolu', 'deprem:Deprem'),
        }),
        liste({
          key: 'airbag',
          label: 'Airbag durumu',
          type: 'select',
          filter: false,
          options: opts('acilmamis:Açılmamış olsun', 'fark_etmez:Fark etmez'),
        }),
        km(6),
        kimden(),
      ],
      {
        catalog: 'ana',
        legalNotice:
          "Onarım bedeli piyasa değerinin %60'ını aşan araç ağır hasarlı sayılır; pert araç hurda tescillidir ve trafiğe çıkamaz. Hasar kaydını ve tescil durumunu satın almadan önce doğrula.",
      },
    ),
  },
  {
    slug: 'karavan',
    name: 'Karavan',
    enabled: true,
    definition: def(
      [
        liste({
          key: 'tip',
          label: 'Karavan tipi',
          type: 'select',
          required: true,
          hard: 'yes',
          step: 'ana_arac',
          scope: 'talep',
          options: opts('motokaravan:Motokaravan', 'cekme:Çekme karavan'),
        }),
        liste({
          key: 'motoTip',
          label: 'Motokaravan tipi',
          type: 'multiselect',
          weight: 10,
          options: opts('alkov:Alkov', 'yari_entegre:Yarı entegre', 'entegre:Entegre', 'campervan:Campervan'),
          when: { field: 'tip', in: ['motokaravan'] },
        }),
        liste({
          key: 'agirlik',
          label: 'Azami ağırlık',
          type: 'multiselect',
          weight: 8,
          options: opts('o1:750 kg altı (O1)', 'o2:750 kg üstü (O2)'),
          when: { field: 'tip', in: ['cekme'] },
        }),
        model('Marka, model', 'kullanıcı girdileri; motokaravanın baz aracı TSB', false),
        yil(),
        field({ key: 'yatak', label: 'Yatak sayısı (en az)', type: 'number', weight: 10, min: 1, max: 12 }),
        field({ key: 'uzunluk', label: 'Uzunluk', type: 'range', filter: false, unit: 'm', min: 0, max: 15 }),
        field({
          key: 'temizSu',
          label: 'Temiz su tankı (en az)',
          type: 'number',
          filter: false,
          unit: 'L',
          min: 0,
          max: 1000,
        }),
        field({
          key: 'atikSu',
          label: 'Atık su tankı (en az)',
          type: 'number',
          filter: false,
          unit: 'L',
          min: 0,
          max: 1000,
        }),
        field({ key: 'gunesPaneli', label: 'Güneş paneli', type: 'boolean' }),
        field({ key: 'banyo', label: 'Banyo / WC', type: 'boolean' }),
        field({ key: 'isitici', label: 'Isıtıcı', type: 'boolean', filter: false }),
        liste({
          key: 'ehliyet',
          label: 'Gereken ehliyet',
          type: 'multiselect',
          hard: 'yes',
          weight: 6,
          options: opts('b:B', 'be:BE', 'c:C'),
        }),
        { ...km(6), when: { field: 'tip', in: ['motokaravan'] } },
        {
          ...yakit(opts('dizel:Dizel', 'benzin:Benzin', 'elektrik:Elektrik'), 0),
          when: { field: 'tip', in: ['motokaravan'] },
        },
        kimden(),
        takas(),
      ],
      {
        catalog: 'kullanici',
        legalNotice:
          "Çekme karavanların tescili 1 Temmuz 2025'ten beri zorunludur; tescil noterde yapılır ve muayeneye tabidir.",
      },
    ),
  },
  {
    slug: 'klasik',
    name: 'Klasik Araçlar',
    enabled: true,
    definition: def(
      [
        model('Marka, model', 'Wikidata, vehicle-makes-models, yerli klasikler'),
        yil(),
        liste({
          key: 'restorasyon',
          label: 'Restorasyon',
          type: 'multiselect',
          weight: 10,
          options: opts('orijinal:Orijinal', 'kismi:Kısmi', 'tam:Tam'),
        }),
        field({ key: 'numara', label: 'Numaralar eşleşiyor', type: 'boolean', weight: 4 }),
        field({
          key: 'orijinallik',
          label: 'Parça orijinallik oranı (en az)',
          type: 'number',
          filter: false,
          unit: '%',
          min: 0,
          max: 100,
        }),
        field({ key: 'belge', label: 'Belge ve geçmiş dosyası var', type: 'boolean', filter: false }),
        liste({
          key: 'mense',
          label: 'Menşe',
          type: 'multiselect',
          options: opts('ithal:İthal', 'yerli:Yerli'),
        }),
        field({ key: 'calisir', label: 'Çalışır durumda', type: 'boolean', weight: 6 }),
        km(4),
        renk(),
        kimden(),
        takas(),
      ],
      { catalog: 'klasik' },
    ),
  },
  {
    slug: 'hava',
    name: 'Hava Araçları',
    enabled: true,
    definition: def(
      [
        liste({
          key: 'tip',
          label: 'Tip',
          type: 'select',
          required: true,
          weight: 25,
          step: 'ana_arac',
          scope: 'talep',
          options: opts(
            'ucak:Uçak',
            'helikopter:Helikopter',
            'planor:Planör, balon, ultra hafif',
            'iha:İHA (drone)',
          ),
        }),
        model('Marka, model', 'FAA ve ICAO'),
        yil('Üretim yılı'),
        field({
          key: 'govdeSaati',
          label: 'Toplam gövde saati (en çok)',
          type: 'number',
          weight: 10,
          unit: 'saat',
          min: 0,
          max: 100_000,
          when: { field: 'tip', in: ['ucak', 'helikopter', 'planor'] },
        }),
        field({
          key: 'motorSaati',
          label: 'Motor saati (en çok)',
          type: 'number',
          weight: 8,
          unit: 'saat',
          min: 0,
          max: 100_000,
          when: { field: 'tip', in: ['ucak', 'helikopter'] },
        }),
        field({
          key: 'tbo',
          label: "TBO'ya kalan süre (en az)",
          type: 'number',
          filter: false,
          unit: 'saat',
          min: 0,
          max: 10_000,
          when: { field: 'tip', in: ['ucak', 'helikopter'] },
        }),
        field({
          key: 'rotor',
          label: 'Rotor ve şanzıman saati (en çok)',
          type: 'number',
          filter: false,
          unit: 'saat',
          min: 0,
          max: 100_000,
          when: { field: 'tip', in: ['helikopter'] },
        }),
        field({
          key: 'koltuk',
          label: 'Koltuk sayısı (en az)',
          type: 'number',
          weight: 6,
          min: 1,
          max: 50,
          when: { field: 'tip', in: ['ucak', 'helikopter', 'planor'] },
        }),
        field({
          key: 'avionik',
          label: 'Avionik',
          type: 'text',
          filter: false,
          when: { field: 'tip', in: ['ucak', 'helikopter'] },
        }),
        liste({
          key: 'ihaSinifi',
          label: 'Ağırlık sınıfı',
          type: 'multiselect',
          options: opts('k250:250 g altı', 'k4:250 g – 4 kg', 'k25:4 – 25 kg', 'k25p:25 kg üstü'),
          when: { field: 'tip', in: ['iha'] },
        }),
        kimden(),
      ],
      {
        listingDays: 90,
        catalog: 'hava',
        verifications: ['vergi_levhasi', 'mersis'],
        legalNotice:
          "Hava aracının devri SHGM siciline tescil edilmeden üçüncü kişilere karşı ileri sürülemez. İHA'lar İHATTYS üzerinden kaydedilmelidir.",
      },
    ),
  },
  {
    slug: 'atv',
    name: 'ATV',
    enabled: true,
    definition: def(atvAlanlari(), { catalog: 'motosiklet', legalNotice: ATV_UYARI }),
  },
  {
    slug: 'utv',
    name: 'UTV',
    enabled: true,
    definition: def(
      [
        ...atvAlanlari(),
        liste({
          key: 'kisi',
          label: 'Kişi kapasitesi',
          type: 'multiselect',
          weight: 8,
          options: opts('k2:2', 'k4:4', 'k6:6'),
        }),
        field({
          key: 'yukKapasite',
          label: 'Yük kasası kapasitesi (en az)',
          type: 'number',
          filter: false,
          unit: 'kg',
          min: 0,
          max: 2000,
        }),
      ],
      { catalog: 'kullanici', legalNotice: ATV_UYARI },
    ),
  },
];
