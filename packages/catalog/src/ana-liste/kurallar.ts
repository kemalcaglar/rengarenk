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
  // Eski TSB listelerinde (1993–2005 ve "öncesi" listeleri) üretici/ithalatçı birlikte yazılmış marka adları
  fiattofas: 'Fiat',
  fordotosan: 'Ford',
  chryslerjeep: 'Jeep',
  peugeotkarsan: 'Peugeot',
  mercuryford: 'Mercury',
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
  Acura: [{ kaynak: 'RSX TYPE-S', hedef: 'RSX' }],
  'Alfa Romeo': [
    { kaynak: '156 Sportwagon', hedef: '156' },
    { kaynak: '33 Sport', hedef: '33' },
    { kaynak: 'Junior', hedef: 'Junior Elettrica', tip: /ELETTRICA/ },
    { kaynak: 'Junior', hedef: 'Junior Ibrida', tip: /IBRIDA|HYBRID/ },
    { kaynak: 'Giulia', hedef: 'Giulia Quadrifoglio', tip: /QUADRIFOGLIO/ },
    // TSB yazım hatası
    { kaynak: 'Stevio', hedef: 'Stelvio' },
  ],
  'Aston Martin': [
    // TSB "CG 1.3": Cygnet
    { kaynak: 'CG', hedef: 'Cygnet' },
    { kaynak: 'DB7 Volante', hedef: 'DB7' },
    { kaynak: 'DB9 Volante', hedef: 'DB9' },
    { kaynak: 'V12', hedef: 'Vantage', tip: /VANTAGE/ },
    { kaynak: 'V8 Vantage', hedef: 'Vantage' },
    { kaynak: 'Vanquish S', hedef: 'Vanquish' },
    { kaynak: 'Virage Volante', hedef: 'Virage' },
  ],
  Audi: [
    { kaynak: '100/ 200', hedef: '100 Serisi' },
    { kaynak: '80/ 90', hedef: '80 Serisi' },
    { kaynak: '80 Avant RS2', hedef: 'RS' },
    ...['80 Avant S2', '80 S2', 'Coupe S2'].map((kaynak) => ({ kaynak, hedef: 'S Serisi' })),
    { kaynak: 'A4 DTM Edition', hedef: 'A4' },
    { kaynak: 'A6', hedef: 'A6 E-Tron', tip: /E-TRON/ },
    { kaynak: 'A6 Allroad SUV', hedef: 'A6' },
    { kaynak: 'Allroad', hedef: 'A6' },
    { kaynak: 'A8L', hedef: 'A8' },
    { kaynak: 'E-Tron', hedef: 'E-Tron Sportback', tip: /SPORTBACK/ },
    { kaynak: 'Q3', hedef: 'Q3 Sportback', tip: /SPORTBACK/ },
    { kaynak: 'Q4', hedef: 'Q4 E-tron Sportback', tip: /SPORTBACK/ },
    { kaynak: 'Q4', hedef: 'Q4 E-tron' },
    { kaynak: 'Q4 E-tron', hedef: 'Q4 E-tron Sportback', tip: /SPORTBACK/ },
    { kaynak: 'Q5', hedef: 'Q5 Sportback', tip: /SPORTBACK/ },
    { kaynak: 'Q6', hedef: 'Q6 E-tron Sportback', tip: /SPORTBACK/ },
    { kaynak: 'Q6', hedef: 'Q6 E-tron' },
    { kaynak: 'Q8', hedef: 'Q8 E-tron Sportback', tip: /SPORTBACK E-TRON/ },
    { kaynak: 'Q8 E-tron', hedef: 'Q8 E-tron Sportback', tip: /SPORTBACK/ },
    { kaynak: 'RS', hedef: 'RS Q3', tip: /^RS ?Q3/ },
    { kaynak: 'RS', hedef: 'RS Q8', tip: /^RS ?Q8/ },
    ...['RS3', 'RS 4', 'RS4', 'RS5', 'RS6', 'RS7'].map((kaynak) => ({ kaynak, hedef: 'RS' })),
    ...['S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'SQ5', 'SQ7', 'SQ8'].map((kaynak) => ({
      kaynak,
      hedef: 'S Serisi',
    })),
    // TT Roadster ve TT RS
    { kaynak: 'TTR', hedef: 'TT' },
    { kaynak: 'TTRS', hedef: 'TT' },
  ],
  Bentley: [{ kaynak: 'Continental Flying Spur', hedef: 'Flying Spur' }],
  BMW: [
    ...['i3', 'i4', 'i5', 'i7', 'i8'].map((kaynak) => ({ kaynak, hedef: 'i Serisi' })),
    ...['Z1', 'Z3', 'Z4', 'Z8'].map((kaynak) => ({ kaynak, hedef: 'Z Serisi' })),
    { kaynak: '1M', hedef: '1 Serisi' },
  ],
  Bugatti: [{ kaynak: 'EB 110', hedef: 'EB Serisi' }],
  BYD: [
    { kaynak: 'Atto', hedef: 'Atto 2', tip: /ATTO 2/ },
    { kaynak: 'Atto 3', hedef: 'Atto 3 EV' },
    { kaynak: 'Seal U', hedef: 'Seal U DM-i', tip: /DM-I/i },
    { kaynak: 'Seal U', hedef: 'Seal U EV', tip: /\bEV\b/ },
  ],
  Cadillac: [
    { kaynak: 'CTS V-Series', hedef: 'CTS' },
    { kaynak: 'Escalade ESV', hedef: 'Escalade' },
    { kaynak: 'Escalade EXT', hedef: 'Escalade' },
  ],
  Chery: [
    { kaynak: 'Omoda 5', hedef: 'Omoda 5 Pro', tip: /\bPRO\b/ },
    { kaynak: 'Tiggo 7', hedef: 'Tiggo 7 Pro Max', tip: /\bPRO MAX\b/ },
    { kaynak: 'Tiggo 7', hedef: 'Tiggo 7 Pro', tip: /\bPRO\b/ },
    { kaynak: 'Tiggo 8', hedef: 'Tiggo 8 Pro Max', tip: /\bPRO MAX\b/ },
    { kaynak: 'Tiggo 8', hedef: 'Tiggo 8 Pro', tip: /\bPRO\b/ },
    { kaynak: 'Tiggo', hedef: 'Tiggo 3', tip: /TIGGO 3/ },
  ],
  Chevrolet: [
    // vehicle-makes-models: "Nubira / Lacetti", "Matiz / Spark"
    { kaynak: 'Nubira', hedef: 'Lacetti' },
    { kaynak: 'Matiz', hedef: 'Spark' },
  ],
  Chrysler: [
    { kaynak: '300', hedef: '300 C', tip: /^300 C/ },
    { kaynak: '300', hedef: '300 M', tip: /^300 M/ },
    { kaynak: 'Pacificia', hedef: 'Pacifica' },
  ],
  Citroen: [
    // TSB bazı yıllarda paketi seri adına yapıştırır ("C3AIRCROSSSHINE", "C5AIRCROSSFEELADVENTURE")
    ...['C3AIRCROSSEXCLUSIVE', 'C3AIRCROSSSHINE'].map((kaynak) => ({ kaynak, hedef: 'C3 AirCross' })),
    ...['C5AIRCROSSFEELADVENTURE', 'C5AIRCROSSSELECTIONBUSINESS', 'C5AIRCROSSSHINEBOLD'].map((kaynak) => ({
      kaynak,
      hedef: 'C5 AirCross',
    })),
    { kaynak: 'C-Ellyse', hedef: 'C-Elysée' },
    { kaynak: 'Grand', hedef: 'C4 Grand Picasso', tip: /PICASSO|C4 S(PACE|PORT)TOURER/ },
    // Grand C4 Picasso 2018'de C4 SpaceTourer adını aldı
    { kaynak: 'C4 SpaceTourer', hedef: 'C4 Grand Picasso' },
    { kaynak: 'C3 Pluriel', hedef: 'C3' },
    { kaynak: 'Xsara Picasso', hedef: 'Xsara' },
    { kaynak: 'e-C4', hedef: 'e-C4 X', tip: /^E-C4 X\b/ },
    // 2010–2017 DS modelleri TSB'de Citroen altında
    { kaynak: 'DS3', hedef: 'DS 3', marka: 'DS Automobiles' },
    { kaynak: 'DS4', hedef: 'DS 4', marka: 'DS Automobiles' },
    { kaynak: 'DS5', hedef: 'DS 5', marka: 'DS Automobiles' },
  ],
  Dacia: [
    { kaynak: 'Logan', hedef: 'Logan Pickup', tip: /PICK ?UP/ },
    { kaynak: 'Sandero', hedef: 'Sandero Stepway', tip: /STEPWAY/, ilkYil: 2021 },
    { kaynak: 'Solenzo', hedef: 'Solenza' },
    { kaynak: '1310/1410 Sport', hedef: '1310' },
    { kaynak: 'SuperNova', hedef: 'Nova' },
  ],
  Daewoo: [
    // Lacetti Nubira'nın devamı, Cielo Nexia'nın ihracat adı
    { kaynak: 'Lacetti', hedef: 'Nubira' },
    { kaynak: 'Cielo', hedef: 'Nexia' },
  ],
  Daihatsu: [
    { kaynak: 'Feroza Hardtop', hedef: 'Feroza' },
    { kaynak: 'Feroza Softtop', hedef: 'Feroza' },
    { kaynak: 'Sirion 2', hedef: 'Sirion' },
  ],
  Dodge: [
    { kaynak: 'Challanger', hedef: 'Challenger' },
    { kaynak: 'Magnum SRT8', hedef: 'Magnum' },
  ],
  'DS Automobiles': [
    { kaynak: 'DS 3', hedef: 'DS 3 Crossback', tip: /CROSSBACK/ },
    { kaynak: 'DS 7', hedef: 'DS 7 Crossback' },
    { kaynak: 'N°4', hedef: 'No4' },
    { kaynak: 'N°7', hedef: 'No7' },
    { kaynak: 'N°8', hedef: 'No8' },
  ],
  Ferrari: [
    { kaynak: 'F', hedef: '430', tip: /^F 430/ },
    { kaynak: 'F430', hedef: '430' },
    { kaynak: '456 GT', hedef: '456' },
    { kaynak: '550/575M Maranello', hedef: '550' },
    { kaynak: '550 Barchetta/575M Superamerica', hedef: '550' },
    { kaynak: '360 Modena', hedef: '360' },
    { kaynak: '360 Challenge Stradale', hedef: '360' },
    { kaynak: '612 Scaglietti', hedef: '612' },
    { kaynak: 'SF', hedef: 'SF90', tip: /^SF ?90/ },
    { kaynak: 'Testarossa/512 TR/512M', hedef: '512' },
  ],
  Ford: [
    { kaynak: 'C', hedef: 'C-Max', tip: /^C MAX/ },
    { kaynak: 'Crown', hedef: 'Crown Victoria' },
    { kaynak: 'Contour/Mondeo', hedef: 'Mondeo' },
    { kaynak: 'Bronco', hedef: 'Bronco Sport', tip: /BRONCO SPORT/ },
    { kaynak: 'Explorer', hedef: 'Explorer-E', tip: /EXPLORER[- ]E\b|\bEV\b|ELEKTR/ },
    { kaynak: 'Explorer Sport', hedef: 'Explorer' },
    { kaynak: 'Explorer Sport Trac', hedef: 'Explorer' },
    { kaynak: 'Puma', hedef: 'Puma-E', tip: /GEN-E|PUMA-E/ },
    { kaynak: 'Ranger', hedef: 'Ranger Raptor', tip: /RAPTOR/ },
    { kaynak: 'Ranger Regular Cab', hedef: 'Ranger' },
    { kaynak: 'Ranger Super Cab', hedef: 'Ranger' },
    // F serisi (F-150)
    ...['F150', 'F-150 Regular Cab', 'F-150 Super Cab', 'F-150 Super Crew'].map((kaynak) => ({
      kaynak,
      hedef: 'F',
    })),
    { kaynak: 'Escort Clipper', hedef: 'Escort' },
    { kaynak: 'Focus RS', hedef: 'Focus' },
    { kaynak: 'Fusion European', hedef: 'Fusion' },
    { kaynak: 'Maverick LWB', hedef: 'Maverick' },
    { kaynak: 'Maverick SWB', hedef: 'Maverick' },
    { kaynak: 'SportKa', hedef: 'Ka' },
    { kaynak: 'StreetKa', hedef: 'Ka' },
    // TSB'de Ford altında "LINCOLN TOWN CAR"
    { kaynak: 'Lincoln', hedef: 'Town Car', tip: /TOWN CAR/, marka: 'Lincoln' },
  ],
  Foton: [
    { kaynak: 'Tunland', hedef: 'Tunland G7', tip: /\bG7\b/ },
    { kaynak: 'Tunland', hedef: 'Tunland V9', tip: /\bV9\b/ },
  ],
  Geely: [
    { kaynak: 'CK', hedef: 'Echo' },
    { kaynak: 'MK', hedef: 'Familia', tip: /FAMILIA/ },
  ],
  Honda: [
    ...['Accord Euro', 'Accord Tourer', 'Accord Type R'].map((kaynak) => ({ kaynak, hedef: 'Accord' })),
    { kaynak: 'Civic Aero Deck', hedef: 'Civic' },
    { kaynak: 'Civic Shuttle', hedef: 'Civic' },
    { kaynak: 'Civic CRX', hedef: 'CRX' },
    { kaynak: 'CRX Del Sol', hedef: 'CRX' },
    { kaynak: 'Civic Type-R', hedef: 'Civic' },
    { kaynak: 'Type-R', hedef: 'Civic' },
  ],
  Hummer: [
    ...['H1 2 Door Hardtop', 'H1 4 Door', 'H1 4 Door Hardtop', 'H1 4 Door Opentop', 'H2', 'H2 SUT', 'H3'].map(
      (kaynak) => ({ kaynak, hedef: 'H Serisi' }),
    ),
  ],
  Infiniti: [
    ...['G35', 'G37', 'GS'].map((kaynak) => ({ kaynak, hedef: 'G' })),
    { kaynak: 'M30D', hedef: 'M' },
    { kaynak: 'QX70', hedef: 'QX' },
    { kaynak: 'QX80', hedef: 'QX' },
    // vehicle-makes-models "I": I30 / I35
    { kaynak: 'I', hedef: 'I30' },
  ],
  Isuzu: [{ kaynak: 'Rodeo', hedef: 'D-Max' }],
  Jaecoo: [{ kaynak: '7', hedef: 'J7' }],
  Jaguar: [
    { kaynak: 'S-Type R', hedef: 'S-Type' },
    { kaynak: 'XJ8', hedef: 'XJ' },
    { kaynak: 'XK', hedef: 'XK8' },
  ],
  Jeep: [
    { kaynak: 'Avenger', hedef: 'Avenger Electric', yakit: 'elektrik' },
    { kaynak: 'Cherokee/Liberty', hedef: 'Cherokee' },
    // Liberty, Cherokee'nin (KJ) Kuzey Amerika adı
    { kaynak: 'Liberty', hedef: 'Cherokee' },
    { kaynak: 'G.cherokee', hedef: 'Grand Cherokee' },
    { kaynak: 'Wrangler Unlimited', hedef: 'Wrangler' },
    // Eski "CHRYSLER/JEEP" listesinde seri adı "JEEP": "JEEP CHEROKEE (4000)"
    { kaynak: 'Jeep', hedef: 'Cherokee', tip: /^JEEP CHEROKEE\b/ },
  ],
  'KGM SsangYong': [
    { kaynak: 'Musso', hedef: 'Musso EV', tip: /\bEV\b/ },
    { kaynak: 'Musso Sports', hedef: 'Musso' },
    { kaynak: 'Torres', hedef: 'Torres EVX', tip: /\bEVX\b/ },
  ],
  Kia: [{ kaynak: 'Niro', hedef: 'Niro EV', yakit: 'elektrik' }],
  Lada: [
    // Lada 110/111/112 Türkiye'de "Vega" adıyla satıldı; TSB'de VAZ kodlarıyla (21102 …)
    ...['110', '111', '112', '21102', '21103', '21110', '21113', '21120', '21122'].map((kaynak) => ({
      kaynak,
      hedef: 'Vega',
    })),
    { kaynak: '4X4', hedef: 'Niva' },
  ],
  Lamborghini: [{ kaynak: '140', hedef: 'Gallardo', tip: /GALLARDO/ }],
  Lancia: [
    { kaynak: 'Ypsilon', hedef: 'Y (Ypsilon)' },
    { kaynak: 'Dedra Station', hedef: 'Dedra' },
    { kaynak: 'Delta HPE', hedef: 'Delta' },
  ],
  'Land Rover': [
    { kaynak: 'Defender 110', hedef: 'Defender' },
    { kaynak: 'Defender 90', hedef: 'Defender' },
  ],
  Lexus: [
    { kaynak: 'GSF', hedef: 'GS' },
    { kaynak: 'LS600HL', hedef: 'LS' },
    { kaynak: 'RCF', hedef: 'RC' },
    { kaynak: 'LC', hedef: 'LC Convertible', tip: /CONVERTIBLE|CABRIO/ },
    { kaynak: 'RX', hedef: 'RX L', tip: /^RX ?\d+H? L\b/i },
  ],
  Lincoln: [{ kaynak: 'Town', hedef: 'Town Car', tip: /TOWN CAR/ }],
  Mahindra: [{ kaynak: 'Scorpio', hedef: 'Goa' }],
  Maserati: [
    { kaynak: 'Coupe', hedef: 'Cambiocorsa', tip: /COMBICORSA|CAMBIOCORSA/ },
    // Maserati Coupé = 4200 GT
    { kaynak: 'Coupe', hedef: 'GT' },
    { kaynak: 'Gran', hedef: 'GranSport', tip: /GRAN SPORT/ },
    { kaynak: 'GranCabrio', hedef: 'GranCabrio E', tip: /FOLGORE/ },
    { kaynak: 'GranTurismo', hedef: 'GranTurismo E', tip: /FOLGORE/ },
    { kaynak: 'Quattroprte', hedef: 'Quattroporte' },
  ],
  Mazda: [
    { kaynak: '323 Station', hedef: '323' },
    { kaynak: '626 Station', hedef: '626' },
    { kaynak: 'B-2500', hedef: 'B Serisi' },
    { kaynak: 'BT-50', hedef: 'B Serisi' },
    ...['MX-3', 'MX-5', 'MX5', 'MX-6'].map((kaynak) => ({ kaynak, hedef: 'MX' })),
    ...['RX-7', 'RX-8', 'RX8'].map((kaynak) => ({ kaynak, hedef: 'RX' })),
  ],
  'Mercedes-Benz': [
    { kaynak: 'GLC', hedef: 'GLC Coupe', tip: /COUPE/ },
    { kaynak: 'GLE', hedef: 'GLE Coupe', tip: /COUPE/ },
    { kaynak: 'Maybach', hedef: 'GLS', tip: /\bGLS\b/ },
    { kaynak: 'Maybach', hedef: 'Maybach S', tip: /MAYBACH S ?\d/ },
    { kaynak: 'S Serisi', hedef: 'Maybach S', tip: /MAYBACH S ?\d/ },
    { kaynak: 'SLS', hedef: 'SLS AMG' },
    // vehicle-makes-models "M-Klasse"
    { kaynak: 'M Serisi', hedef: 'ML' },
  ],
  MG: [
    { kaynak: 'ZS', hedef: 'ZS EV', yakit: 'elektrik' },
    { kaynak: 'Marvel', hedef: 'Marvel R' },
    { kaynak: 'F/ TF', hedef: 'F' },
    { kaynak: 'ZT-T', hedef: 'ZT' },
  ],
  // MINI: TSB kasa adlarını seri yazar (Cabrio, Coupe, Roadster); ana listede Cooper, Cooper S, John Cooper, One
  MINI: [
    { kaynak: 'Clubman', hedef: 'Cooper Clubman' },
    { kaynak: 'Countryman', hedef: 'Countryman E', yakit: 'elektrik' },
    ...['Cooper', 'Cabrio', 'Coupe', 'Roadster', 'Hatch', 'Convertible'].flatMap((kaynak) => [
      { kaynak, hedef: 'John Cooper', tip: /JOHN COOPER|\bJCW\b/i },
      { kaynak, hedef: 'Cooper Electric', tip: /COOPER SE\b|ELEKTR|ELECTRIC/i },
      { kaynak, hedef: 'Cooper S', tip: /COOPER S\b|COOPER SD\b/i },
      { kaynak, hedef: 'One', tip: /\bONE\b/i },
      { kaynak, hedef: 'Cooper' },
    ]),
  ],
  Mitsubishi: [
    { kaynak: 'Galant Station', hedef: 'Galant' },
    { kaynak: 'L200KAMYONET', hedef: 'L 200' },
    { kaynak: 'Pajero Pinin', hedef: 'Pajero' },
  ],
  Nissan: [
    { kaynak: '350', hedef: '350 Z', tip: /^350 ?Z/ },
    { kaynak: '100 NX', hedef: 'NX Coupe' },
    { kaynak: 'Almera Tino', hedef: 'Almera' },
    { kaynak: 'Bluebird Traveller', hedef: 'Bluebird' },
    { kaynak: 'Sunny Traveller', hedef: 'Sunny' },
    { kaynak: 'Micra C+C', hedef: 'Micra' },
    { kaynak: 'Patrol LWB', hedef: 'Patrol' },
    { kaynak: 'Patrol SWB', hedef: 'Patrol' },
    { kaynak: 'Qashqai', hedef: 'Qashqai+2', tip: /QASHQAI ?\+ ?2/ },
    // Pick-up (D22) ve NP300: Türkiye'de paket adıyla satıldı (Skystar, Country, Rally Raid)
    ...['Pick', 'NP', 'NP300'].flatMap((kaynak) => [
      { kaynak, hedef: 'Rally Raid', tip: /RALLY RAID/ },
      { kaynak, hedef: 'Skystar', tip: /SKYSTAR/ },
      { kaynak, hedef: 'Country', tip: /COUNTRY/ },
    ]),
  ],
  Opel: [
    ...['Astra Caravan', 'Astra OPC'].map((kaynak) => ({ kaynak, hedef: 'Astra' })),
    { kaynak: 'Kadett Caravan', hedef: 'Kadett' },
    { kaynak: 'Omega Caravan', hedef: 'Omega' },
    { kaynak: 'Rekord Caravan', hedef: 'Rekord' },
    ...['Vectra Caravan', 'Vectra OPC'].map((kaynak) => ({ kaynak, hedef: 'Vectra' })),
    { kaynak: 'Insigniasporttourer', hedef: 'Insignia' },
    { kaynak: 'GT', hedef: 'GT (Roadster)' },
    { kaynak: 'Grandland', hedef: 'Grandland X', tip: /GRANDLAND X\b/ },
    { kaynak: 'Grandland', hedef: 'Grandland-e', yakit: 'elektrik' },
    { kaynak: 'Mokka', hedef: 'Mokka X', tip: /MOKKA X\b/ },
  ],
  Peugeot: [{ kaynak: '3008ACTIVELIFE', hedef: '3008' }],
  Porsche: [
    ...[
      '911 Carrera',
      '911CARRERA',
      '911 Carrera 4',
      '911 Carrera 4S',
      '911 Carrera RS',
      '911 Carrera S',
      '911 GT2',
      '911 GT3',
      '911 GT3 RS',
      '911 Targa',
      '911 Turbo',
      '911 Turbo S',
    ].map((kaynak) => ({ kaynak, hedef: '911' })),
    ...['928 GT', '928 GTS', '928 S'].map((kaynak) => ({ kaynak, hedef: '928' })),
    { kaynak: 'Cayenne', hedef: 'Cayenne Coupe Elektrik', tip: /COUPE.*ELECTRIC/ },
    { kaynak: 'Cayenne', hedef: 'Cayenne Elektrik', tip: /ELECTRIC/ },
    { kaynak: 'Cayenne', hedef: 'Cayenne Coupe', tip: /COUPE/ },
    { kaynak: 'Cayenne S', hedef: 'Cayenne' },
    { kaynak: 'Cayenne Turbo', hedef: 'Cayenne' },
    { kaynak: 'Macan', hedef: 'Macan Elektrik', tip: /ELECTRIC|ELEKTR/ },
    { kaynak: 'Macan', hedef: 'Macan Elektrik', yakit: 'elektrik' },
    { kaynak: 'Taycan', hedef: 'Taycan Elektrik' },
    { kaynak: '968 Turbo S', hedef: '968' },
    { kaynak: 'Boxster S', hedef: 'Boxster' },
    { kaynak: 'Carrera', hedef: '911' },
    { kaynak: 'Cayman S', hedef: 'Cayman' },
    { kaynak: 'Panemera', hedef: 'Panamera' },
    // 718 Spyder
    { kaynak: 'Spyder', hedef: '718' },
  ],
  Proton: [
    { kaynak: 'Gen', hedef: 'Gen-2', tip: /^GEN ?-?2/ },
    { kaynak: 'Savy', hedef: 'Savvy' },
  ],
  'Rolls-Royce': [
    ...['Silver Dawn', 'Silver Seraph', 'Silver Spirit', 'Silver Spur'].map((kaynak) => ({
      kaynak,
      hedef: 'Silver',
    })),
  ],
  // Rover 100 (Metro): 111 ve 114
  Rover: [{ kaynak: '100', hedef: '111' }],
  Saab: [
    { kaynak: '9-3 Sport', hedef: '9-3' },
    { kaynak: '9-3 SportCombi', hedef: '9-3' },
    { kaynak: '9-5 SportCombi', hedef: '9-5' },
  ],
  SEAT: [
    { kaynak: 'Alhamra', hedef: 'Alhambra' },
    ...['Cordoba Cupra', 'Cordoba SX', 'Cordoba Vario'].map((kaynak) => ({ kaynak, hedef: 'Cordoba' })),
    { kaynak: 'Ibiza Cupra', hedef: 'Ibiza' },
    ...['Leon Cupra', 'Leon Cupra R', 'Leon FR'].map((kaynak) => ({ kaynak, hedef: 'Leon' })),
  ],
  Skoda: [
    { kaynak: 'Fabia RS', hedef: 'Fabia' },
    { kaynak: 'Octavia RS', hedef: 'Octavia' },
    { kaynak: 'Octavia Combi RS', hedef: 'Octavia' },
    { kaynak: 'Enyaq', hedef: 'Enyaq Coupe', tip: /COUPE/ },
    { kaynak: 'Felicia', hedef: 'Felicia Pickup', tip: /PICK/i },
  ],
  Smart: [
    { kaynak: 'EQ', hedef: 'Forfour', tip: /FORFOUR/ },
    { kaynak: 'EQ', hedef: 'Fortwo', tip: /FORTWO/ },
    { kaynak: 'forfour Brabus', hedef: 'Forfour' },
    { kaynak: 'fortwo Brabus', hedef: 'Fortwo' },
    { kaynak: 'fortwo Cabrio Brabus', hedef: 'Fortwo' },
    { kaynak: 'Roadstar', hedef: 'Roadster' },
  ],
  Subaru: [
    { kaynak: 'B9', hedef: 'Tribeca (B9)' },
    { kaynak: 'Tribeca', hedef: 'Tribeca (B9)' },
    { kaynak: 'Impreza WRX STi', hedef: 'Impreza' },
  ],
  Suzuki: [
    // vehicle-makes-models: "Aerio / Liana", "Escudo / Grand Vitara" (1988–1998 kuşağı Vitara)
    { kaynak: 'Aerio', hedef: 'Liana' },
    { kaynak: 'Escudo', hedef: 'Vitara' },
  ],
  SWM: [
    { kaynak: 'G01', hedef: 'G01 Pro', tip: /\bPRO\b/ },
    { kaynak: 'G01', hedef: 'G01F' },
  ],
  // "TATA DICOR 3.0": Safari Dicor
  Tata: [{ kaynak: 'Dicor', hedef: 'Safari' }],
  Tofaş: [
    { kaynak: 'Murat 124', hedef: 'Murat' },
    { kaynak: 'Murat 131', hedef: 'Murat' },
  ],
  Volvo: [
    { kaynak: '244', hedef: '240' },
    { kaynak: '245', hedef: '240' },
    // TSB 2006–2011: "S 80", "V 70", "XC 60" (boşluklu)
    { kaynak: 'S', hedef: 'S80', tip: /^S ?80/ },
    { kaynak: 'V', hedef: 'V70', tip: /^V ?70/ },
    { kaynak: 'XC', hedef: 'XC60', tip: /^XC ?60/ },
    { kaynak: 'XC', hedef: 'XC70', tip: /^XC ?70/ },
    { kaynak: 'XC', hedef: 'XC90', tip: /^XC ?90/ },
    { kaynak: 'EX30', hedef: 'EX30 Cross Country', tip: /CROSS COUNTRY/ },
  ],
};

/**
 * Eski TSB yazımları (2006–2019 listeleri ve "15 model yılından eski araçlar" listeleri, 16 Kasım 2026): kısaltma,
 * yazım hatası ve başka marka altında yazılan seriler. Yalnızca hedefi ana listede olan ve tip adından kesin anlaşılanlar;
 * listede olmayan eski araçlar (Buick Electra, Chevrolet Impala …) kendi serileriyle kalır.
 */
const ESKI_KURALLAR: Record<string, SeriKurali[]> = {
  'Alfa Romeo': [{ kaynak: 'Alfa', hedef: '146', tip: /^ALFA 146\b/ }],
  Audi: [{ kaynak: 'C4', hedef: '100 Serisi', tip: /^C4 100\b/ }],
  BMW: [
    // "320I/4", "316/2I", "325TDA/4", "318tiA COMPACT", "328iA/4 E46": 3 Serisi (kapı sayısı / ile)
    {
      kaynak: '*',
      hedef: '3 Serisi',
      tip: /^3(?:1[68]|2[0358])(?:I|IA|IS|TD|TDA|TDS|TI|TIA|CI)?(?:\/[24])?I?\b/i,
      sonYil: 2005,
    },
    { kaynak: '*', hedef: '5 Serisi', tip: /^525(?:IXA|TDSA)\b/i, sonYil: 2005 },
    { kaynak: '*', hedef: '8 Serisi', tip: /^850CSI\b/i, sonYil: 2005 },
    { kaynak: 'L7', hedef: '7 Serisi' },
  ],
  Buick: [
    { kaynak: 'Custom', hedef: 'Le Sabre', tip: /LE SABRE/ },
    { kaynak: 'Sabre', hedef: 'Le Sabre' },
    { kaynak: 'Park', hedef: 'Park Avenue', tip: /^PARK AVEN/ },
  ],
  Cadillac: [
    { kaynak: 'Sedan', hedef: 'DeVille', tip: /DE ?VILLE/ },
    { kaynak: 'Coupe', hedef: 'DeVille', tip: /DE ?VILLE/ },
  ],
  Chevrolet: [
    { kaynak: 'Berette', hedef: 'Beretta' },
    { kaynak: 'Stringray', hedef: 'Corvette', tip: /CORVETTE/ },
    { kaynak: 'K', hedef: 'Blazer', tip: /BLAZER/ },
    { kaynak: 'KS', hedef: 'Blazer', tip: /BLAZER/ },
  ],
  Chrysler: [
    { kaynak: 'Grand Cherokee', hedef: 'Grand Cherokee', marka: 'Jeep' },
    { kaynak: 'Dodge', hedef: 'Ram', marka: 'Dodge', tip: /\bRAM\b/ },
  ],
  Daewoo: [{ kaynak: 'Super', hedef: 'Super Saloon', tip: /^SUPER SALON/ }],
  Daihatsu: [{ kaynak: 'Cuorre', hedef: 'Cuore' }],
  Dodge: [{ kaynak: 'Cahellenger', hedef: 'Challenger' }],
  Ferrari: [
    { kaynak: '456M', hedef: '456' },
    { kaynak: 'F456', hedef: '456' },
    { kaynak: 'F512', hedef: '512' },
  ],
  Fiat: [
    // Tofaş modelleri eski listelerde FIAT altında
    { kaynak: 'Dogan', hedef: 'Doğan', marka: 'Tofaş' },
    { kaynak: 'Kartal', hedef: 'Kartal', marka: 'Tofaş' },
    { kaynak: 'Kartal1.6', hedef: 'Kartal', marka: 'Tofaş' },
    { kaynak: '131', hedef: 'Kartal', marka: 'Tofaş', tip: /KARTAL/ },
    { kaynak: 'Sahin', hedef: 'Şahin', marka: 'Tofaş' },
    { kaynak: 'Murat', hedef: 'Murat', marka: 'Tofaş' },
  ],
  Ford: [
    { kaynak: 'Escord', hedef: 'Escort' },
    { kaynak: 'Sport', hedef: 'Mustang', tip: /MUSTANG/ },
    { kaynak: 'Mach', hedef: 'Mustang', tip: /^MACH 1\b/ },
    { kaynak: 'Lincoln', hedef: 'Continental', marka: 'Lincoln', tip: /CONTINENTAL/ },
  ],
  Honda: [{ kaynak: 'Acura', hedef: 'RSX', marka: 'Acura', tip: /\bRSX\b/ }],
  Hyundai: [{ kaynak: 'Excell', hedef: 'Excel' }],
  Infiniti: [{ kaynak: 'QX4', hedef: 'QX' }],
  Isuzu: [{ kaynak: 'Tropper', hedef: 'Trooper' }],
  Jaguar: [
    { kaynak: 'Sovereing', hedef: 'Sovereign' },
    { kaynak: 'XJ6,Sovereign', hedef: 'XJ6' },
    { kaynak: 'XJSC', hedef: 'XJS' },
  ],
  Lada: [
    { kaynak: '2110', hedef: 'Vega', tip: /VEGA/ },
    { kaynak: '2112', hedef: 'Vega', tip: /VEGA/ },
    { kaynak: '2121Arazi', hedef: 'Niva', tip: /NIVA/ },
  ],
  Lancia: [
    { kaynak: 'K', hedef: 'Kappa', tip: /KAPPA/ },
    { kaynak: 'Tehema', hedef: 'Thema' },
  ],
  'Land Rover': [
    // 1983'ten sonraki 90, 110, 130 "One Ten" serisi 1990'da Defender adını aldı
    { kaynak: '*', hedef: 'Defender', tip: /^(?:90|110|130)[-. ]?\d{0,3}\b/, ilkYil: 1983, sonYil: 2005 },
    { kaynak: 'V8I', hedef: 'Discovery', tip: /DISCOVERY/ },
  ],
  Maserati: [
    { kaynak: 'Quatroporte', hedef: 'Quattroporte' },
    { kaynak: '3200', hedef: 'GT', tip: /^3200 GT\b/ },
  ],
  Mazda: [{ kaynak: 'B-2200', hedef: 'B Serisi' }],
  'Mercedes-Benz': [
    { kaynak: '190D', hedef: '190' },
    { kaynak: '200D', hedef: '200' },
    { kaynak: '220D', hedef: '220' },
    { kaynak: '220S', hedef: '220' },
    { kaynak: '230/4', hedef: '230' },
    { kaynak: '230/6', hedef: '230' },
    { kaynak: '250/6', hedef: '250' },
    { kaynak: '290', hedef: 'G Serisi', tip: /^290 GD\b/ },
    { kaynak: '350', hedef: 'G Serisi', tip: /^350 GD\b/ },
  ],
  Mitsubishi: [
    // Montero: Pajero'nun Amerika adı; GTO: 3000GT'nin Japonya adı
    { kaynak: 'Montero', hedef: 'Pajero' },
    { kaynak: 'Evo', hedef: 'Lancer Evolution' },
    { kaynak: 'Gto', hedef: '3000GT', tip: /^GTO 3000\b/ },
  ],
  Nissan: [
    { kaynak: 'Blubird', hedef: 'Bluebird' },
    { kaynak: '3000', hedef: '300 ZX', tip: /^3000 ZX\b/ },
    { kaynak: 'Infinity', hedef: 'QX', marka: 'Infiniti', tip: /QX4/i },
  ],
  Opel: [
    { kaynak: 'Record', hedef: 'Rekord' },
    { kaynak: 'Speedstar', hedef: 'Speedster' },
    { kaynak: '4B4', hedef: 'Vectra', tip: /VECTRA/ },
  ],
  Pontiac: [
    // Trans Am ve Formula, Firebird'ün paketleri
    { kaynak: 'Transam', hedef: 'Firebird' },
    { kaynak: 'Formula', hedef: 'Firebird' },
    { kaynak: '350', hedef: 'Firebird', tip: /FIREBI/ },
  ],
  Porsche: [{ kaynak: 'P', hedef: '928', tip: /^P 928\b/ }],
  Renault: [
    { kaynak: 'R', hedef: 'R 12', tip: /12 TX TOROS/ },
    { kaynak: 'Reno', hedef: 'R 9', tip: /^RENO 9\b/ },
    // Türkiye'de Renault 9'un 1996–2000 adı
    { kaynak: 'Broadway', hedef: 'R 9' },
    { kaynak: 'Escape', hedef: 'Espace' },
  ],
  Rover: [
    { kaynak: 'MG', hedef: 'ZR', marka: 'MG', tip: /^MG ZR\b/ },
    { kaynak: 'MG', hedef: 'F', marka: 'MG', tip: /^MG TF\b/ },
    // 1995–2001 arasında MG'nin tek otomobili MGF (1.8i ve 1.8i VVC)
    { kaynak: 'MG', hedef: 'F', marka: 'MG', tip: /^MG 1\.8I/i, sonYil: 2001 },
  ],
  Skoda: [{ kaynak: 'Pick', hedef: 'Felicia Pickup', tip: /^PICK UP/, ilkYil: 1996 }],
  Smart: [
    // city-coupé ve cabrio 2004'te fortwo adını aldı
    { kaynak: 'City', hedef: 'Fortwo', tip: /^CITY COUPE/ },
    { kaynak: 'Cabrio', hedef: 'Fortwo' },
    { kaynak: 'Passion', hedef: 'Fortwo', tip: /^SMART PASSION$/ },
    { kaynak: 'Pulse', hedef: 'Fortwo', tip: /^SMART PULSE$/ },
    { kaynak: 'Pure', hedef: 'Fortwo', tip: /^PURE$/ },
  ],
  Subaru: [{ kaynak: 'Legasy', hedef: 'Legacy' }],
  Suzuki: [{ kaynak: 'Samurai', hedef: 'SJ' }],
  Toyota: [
    { kaynak: 'Land', hedef: 'Land Cruiser', tip: /^LAND CRUISE/ },
    { kaynak: 'FJ80', hedef: 'Land Cruiser' },
    { kaynak: 'FJ80L', hedef: 'Land Cruiser' },
    { kaynak: 'J8', hedef: 'Land Cruiser', tip: /LAND CRUISER/ },
    { kaynak: 'GX', hedef: 'Land Cruiser', tip: /LAND CRUISER/ },
    { kaynak: 'RA6', hedef: 'Celica', tip: /C[ER]LICA/ },
    { kaynak: 'LS', hedef: 'LS', marka: 'Lexus', tip: /^LS 400\b/ },
  ],
  // VW 1300, 1302, 1303: Beetle
  Volkswagen: [
    { kaynak: '1300', hedef: 'Beetle', tip: /^1300$/ },
    { kaynak: '1.3', hedef: 'Beetle', tip: /^1303\b/ },
  ],
};

for (const [marka, kurallar] of Object.entries(ESKI_KURALLAR))
  SERI_KURALLARI[marka] = [...(SERI_KURALLARI[marka] ?? []), ...kurallar];
