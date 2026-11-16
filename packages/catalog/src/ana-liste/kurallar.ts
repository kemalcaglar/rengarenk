import type { SeriKurali } from './tipler.js';

/**
 * Kaynaktaki marka adı → ana listedeki marka adı (ad anahtarıyla). Büyük/küçük harf farkı (MINI / Mini) kendiliğinden
 * eşleşir; burada yalnızca adı gerçekten farklı olanlar var.
 */
export const MARKA_ADI: Record<string, string> = {
  ds: 'DS Automobiles',
  // SsangYong 2023'te KGM adını aldı; ana listede tek marka
  ssangyong: 'KGM SsangYong',
  kgm: 'KGM SsangYong',
  // Dongfeng Motor; Dongfeng Sokon (DFSK) ayrı marka
  dongfeng: 'DFM',
};

/**
 * Seri kuralları, ana listedeki marka adına göre. Aynı adlı seriler (ad anahtarı eşit) kural gerekmeden eşleşir.
 * Yeni kural eklerken ANA_LISTE_SURUM'u artır.
 */
export const SERI_KURALLARI: Record<string, SeriKurali[]> = {
  Fiat: [
    { kaynak: '124', hedef: '124 Spider' },
    // 500 ailesi tek seri; 500X ayrı (ad anahtarıyla "500 X"e eşleşir)
    ...['500', '500C', '500e', '500L', 'Abarth', 'Abart'].map((kaynak) => ({ kaynak, hedef: '500 Ailesi' })),
    { kaynak: 'G.punto', hedef: 'Punto' },
    { kaynak: 'Grande Punto', hedef: 'Punto' },
    { kaynak: 'Egea', hedef: 'Egea Cross', tip: /\bCROSS\b/ },
    { kaynak: 'Grande Panda', hedef: 'Grande Panda Electric', tip: /\bBEV\b|ELECTRIC/ },
    { kaynak: 'Panda 4X4', hedef: 'Panda' },
    { kaynak: 'Stilo Multi', hedef: 'Stilo' },
  ],
  Hyundai: [
    { kaynak: 'i20', hedef: 'i20 Active', tip: /\bACTIVE\b/i },
    { kaynak: 'i20', hedef: 'i20 N', tip: /^I20 N\b/i },
    { kaynak: 'i20', hedef: 'i20 Troy', tip: /\bTROY\b/i },
    { kaynak: 'Ioniq', hedef: 'Ioniq 3', tip: /^IONIQ 3\b/ },
    { kaynak: 'Ioniq', hedef: 'Ioniq 6', tip: /^IONIQ 6\b/ },
    { kaynak: 'Ioniq', hedef: 'Ioniq 9', tip: /^IONIQ 9\b/ },
    { kaynak: 'Ioniq 5', hedef: 'Ioniq 5 N', tip: /^IONIQ 5 N\b/ },
    { kaynak: 'Kona', hedef: 'Kona Elektrik', tip: /ELEKTR|ELECTRIC/ },
    { kaynak: 'Atos Multi', hedef: 'Atos' },
    { kaynak: 'Atos Spirit', hedef: 'Atos' },
    // Avrupa adları: Lantra = Elantra, Pony = Excel, XG ve Azera = Grandeur
    { kaynak: 'Lantra', hedef: 'Elantra' },
    { kaynak: 'Pony', hedef: 'Excel' },
    { kaynak: 'XG', hedef: 'Grandeur' },
    { kaynak: 'Azera', hedef: 'Grandeur' },
  ],
  Renault: [
    ...['5', '9', '11', '12', '19', '21', '25'].map((n) => ({ kaynak: n, hedef: `R ${n}` })),
    // TSB'de "C. SYMBOL" ve vehicle-makes-models'ta "Clio Symbol / Thalia"
    { kaynak: 'C.', hedef: 'Symbol' },
    { kaynak: 'Clio Symbol', hedef: 'Symbol' },
    { kaynak: 'Latitute', hedef: 'Latitude' },
    { kaynak: 'Grand Espace', hedef: 'Espace' },
    { kaynak: 'Fluence', hedef: 'Fluence Z.E.', tip: /\bZE\b|Z\.E\./ },
    // Elektrikli E-Tech tipleri batarya kodu taşır (EV60, EV87); hibrit E-Tech'ler taşımaz
    { kaynak: 'Megane', hedef: 'Megane E-Tech', tip: /E-TECH.*\bEV\d/ },
    { kaynak: 'Scenic', hedef: 'Scenic EV', tip: /E-TECH.*\bEV\d/ },
    { kaynak: 'Scenic', hedef: 'Scenic RX4', tip: /RX4/ },
    // TSB'de "R5 E-TECH ELEKTRIKLI": ad anahtarı 1980'lerin R 5'iyle aynı
    { kaynak: 'R5', hedef: 'R5 E-Tech', tip: /E-TECH/ },
  ],
  Toyota: [
    { kaynak: 'FJ', hedef: 'FJ Cruiser' },
    { kaynak: 'RAV', hedef: 'RAV4' },
    { kaynak: 'GR', hedef: 'Yaris', tip: /YARIS/ },
    { kaynak: 'Land Cruiser', hedef: 'Land Cruiser Prado', tip: /PRADO/ },
    { kaynak: 'Land Cruiser V8 and predecessors', hedef: 'Land Cruiser' },
    { kaynak: 'Corolla Verso', hedef: 'Verso' },
  ],
  Volkswagen: [
    { kaynak: 'CC', hedef: 'VW CC' },
    { kaynak: 'N.', hedef: 'Beetle' },
    // ABD'de Golf'ün adı Rabbit
    { kaynak: 'Rabbit', hedef: 'Golf' },
    { kaynak: 'Golf GTI', hedef: 'Golf' },
    { kaynak: 'Golf R', hedef: 'Golf' },
    { kaynak: 'Golf Plus', hedef: 'Golf' },
    { kaynak: 'Polo GTI', hedef: 'Polo' },
    { kaynak: 'Cross', hedef: 'Polo', tip: /CROSS POLO/ },
    { kaynak: 'Touraeg', hedef: 'Touareg' },
    { kaynak: 'Passat', hedef: 'Passat Variant', tip: /\bVARIANT\b/ },
    { kaynak: 'Passat', hedef: 'Passat Alltrack', tip: /\bALLTRACK\b/ },
  ],
};
