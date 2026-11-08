import { describe, expect, it } from 'vitest';
import { VEHICLE_CATEGORIES } from './categories.js';
import { DEFAULT_CATEGORIES } from './category-defaults.js';
import {
  type CategoryDefinition,
  categoryDefinitionSchema,
  demandJsonSchema,
  demandSchema,
  diffDefinitions,
  effectiveFields,
  fieldKeyFor,
  matchLabel,
  sourceLabel,
} from './category-schema.js';
import {
  budgetFit,
  catalogFit,
  kmFit,
  locationFit,
  matchScore,
  packageFit,
  weightsOf,
  yearFit,
} from './matching.js';

/** Testte var olduğu bilinen öğe (yoksa test düşer) */
function must<T>(v: T | undefined): T {
  if (v === undefined) throw new Error('beklenen öğe yok');
  return v;
}

const byslug = (slug: string) => {
  const c = DEFAULT_CATEGORIES.find((x) => x.slug === slug);
  if (!c) throw new Error(slug);
  return structuredClone(c.definition);
};

describe('başlangıç kategorileri', () => {
  it('her tanım şema kurallarına uyar', () => {
    for (const c of DEFAULT_CATEGORIES) {
      const r = categoryDefinitionSchema.safeParse(c.definition);
      expect(r.success, `${c.slug}: ${r.success ? '' : r.error.issues[0]?.message}`).toBe(true);
    }
  });

  it('14 vasıta kategorisi (Karar 19) üst düzeyde, alt kategorilerin üstü var', () => {
    const slugs = DEFAULT_CATEGORIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const top = DEFAULT_CATEGORIES.filter((c) => !c.parent).map((c) => c.slug);
    expect(top).toEqual(VEHICLE_CATEGORIES.map((c) => c.slug));
    for (const c of DEFAULT_CATEGORIES.filter((x) => x.parent)) expect(slugs).toContain(c.parent);
    expect(DEFAULT_CATEGORIES.find((c) => c.slug === 'ticari-hat-plaka')?.enabled).toBe(false);
    expect(byslug('hava').rules.listingDays).toBe(90);
  });

  it('otomobil ağırlıkları tasarımdaki eşleştirme ayarıyla aynı', () => {
    const w = Object.fromEntries(weightsOf(byslug('otomobil')).map((x) => [x.name, x.weight]));
    expect(w).toEqual({
      'Marka, seri, model': 30,
      'Bütçe uyumu': 20,
      'Model yılı': 15,
      'Konum yakınlığı': 12,
      Kilometre: 10,
      'Kasa ve makyaj': 8,
      Yakıt: 8,
      'Donanım paketi': 6,
      'Hasar kaydı': 6,
      Renk: 3,
    });
  });
});

describe('tanım doğrulama', () => {
  it('taban koduyla çakışan, tekrarlanan ve seçeneksiz alanı reddeder', () => {
    const d = byslug('otomobil');
    d.fields.push({ ...must(d.fields[0]), key: 'butce' });
    d.fields.push({ ...must(d.fields[1]), key: 'kasa' });
    d.fields.push({
      key: 'sunroof',
      label: 'Sunroof tipi',
      type: 'select',
      required: false,
      filter: true,
      hard: 'no',
      weight: 2,
      source: 'liste',
      step: 'kriterler',
      scope: 'alternatif',
    });
    const r = categoryDefinitionSchema.safeParse(d);
    expect(r.success).toBe(false);
    const msgs = r.success ? [] : r.error.issues.map((i) => i.message).join(' | ');
    expect(msgs).toContain('taban şemadaki');
    expect(msgs).toContain('aynı kodla iki alan');
    expect(msgs).toContain('en az iki seçenek');
  });

  it('koşul alanı önce gelmeli ve bilinen seçeneğe bağlanmalı', () => {
    const d = byslug('arazi-suv-pickup');
    const i = d.fields.findIndex((f) => f.key === 'pickupKabin');
    d.fields[i] = { ...must(d.fields[i]), when: { field: 'kasaTipi', in: ['ucak'] } };
    expect(categoryDefinitionSchema.safeParse(d).success).toBe(false);
  });
});

const otomobilTalebi = () => ({
  alanlar: {
    model: { make: 'bmw', series: 'bmw/3-serisi', model: 'bmw/3-serisi/320i' },
    konum: { il: 'İstanbul', ilce: 'Kadıköy' },
    boya: { limit: 2, parts: { tavan: 'orijinal', onTampon: 'lokal' } },
    islemKabul: [],
  } as Record<string, unknown>,
  alternatifler: [
    {
      butce: { min: 1_750_000, max: 2_050_000 },
      yil: { min: 2020, max: 2023 },
      km: 60_000,
      vites: ['otomatik'],
      yakit: ['benzin'],
    } as Record<string, unknown>,
  ],
});

describe('talep doğrulayıcı', () => {
  const schema = demandSchema(byslug('otomobil'));

  it('geçerli talebi kabul eder', () => {
    const t = otomobilTalebi();
    delete t.alanlar.islemKabul;
    expect(schema.safeParse(t).success).toBe(true);
  });

  it('zorunlu alan, bilinmeyen alan ve ters aralığı reddeder', () => {
    const t = otomobilTalebi();
    delete t.alanlar.islemKabul;
    delete t.alanlar.konum;
    must(t.alternatifler[0]).uydurma = 1;
    must(t.alternatifler[0]).yil = { min: 2024, max: 2020 };
    const r = schema.safeParse(t);
    expect(r.success).toBe(false);
    const msgs = r.success ? '' : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' | ');
    expect(msgs).toContain('alanlar.konum');
    expect(msgs).toContain('alternatifler.0');
  });

  it('boş çoklu seçim ve listede olmayan seçenek geçmez', () => {
    const t = otomobilTalebi();
    must(t.alternatifler[0]).yakit = ['kerosen'];
    expect(schema.safeParse(t).success).toBe(false);
  });

  it('koşullu alan yalnızca koşul sağlanınca girilir', () => {
    const s = demandSchema(byslug('arazi-suv-pickup'));
    const t = otomobilTalebi();
    delete t.alanlar.islemKabul;
    must(t.alternatifler[0]).pickupKabin = ['cift'];
    expect(s.safeParse(t).success).toBe(false);
    must(t.alternatifler[0]).kasaTipi = ['pickup'];
    expect(s.safeParse(t).success).toBe(true);
  });

  it('karavan: çekme karavanda km girilmez, talep alanına bağlı koşul alternatifte çalışır', () => {
    const s = demandSchema(byslug('karavan'));
    const t = {
      alanlar: { tip: 'cekme', konum: { il: 'Muğla' } },
      alternatifler: [{ butce: { max: 900_000 }, yil: { min: 2018 }, km: 10_000 }],
    };
    expect(s.safeParse(t).success).toBe(false);
    delete (t.alternatifler[0] as Record<string, unknown>).km;
    expect(s.safeParse(t).success).toBe(true);
  });

  it('JSON Schema üretir', () => {
    const js = demandJsonSchema(byslug('otomobil')) as {
      properties: Record<string, { properties?: object }>;
    };
    expect(Object.keys(js.properties.alanlar?.properties ?? {})).toContain('model');
  });
});

describe('sürüm farkı ve gösterim', () => {
  it('eklenen alanı, filtre değişikliğini, ağırlığı ve kuralı yazar', () => {
    const a = byslug('otomobil');
    const b: CategoryDefinition = structuredClone(a);
    const km = must(b.fields.find((f) => f.key === 'km'));
    km.filter = true;
    must(b.fields.find((f) => f.key === 'renk')).weight = 5;
    b.baseWeights.butce = 22;
    b.rules.listingDays = 45;
    b.fields.push({
      key: 'garanti',
      label: 'Garantisi devam ediyor',
      type: 'boolean',
      required: false,
      filter: true,
      hard: 'no',
      weight: 4,
      source: 'alici',
      step: 'kriterler',
      scope: 'alternatif',
    });
    const d = diffDefinitions(a, b);
    expect(d.changes).toEqual([
      'Kilometre (en çok) · filtrede: hayır → evet',
      'Renk ağırlığı 3 → 5',
      'Garantisi devam ediyor alanı eklendi',
      'Bütçe uyumu ağırlığı 20 → 22',
      'Yayın süresi: 30 gün → 45 gün',
    ]);
    expect(d.fields.garanti?.status).toBe('yeni');
    expect(d.fields.km?.notes).toEqual(['Filtrede: hayır → evet']);
    expect(diffDefinitions(a, structuredClone(a)).changes).toEqual([]);
  });

  it('eşleşme ve kaynak etiketleri tasarımdaki gibi', () => {
    const f = effectiveFields(byslug('otomobil'));
    const by = (k: string) => must(f.find((x) => x.key === k));
    expect(matchLabel(by('butce'))).toBe('Sert koşul + ağırlık 20');
    expect(matchLabel(by('vites'))).toBe('Sert koşul (“kesin” ise)');
    expect(matchLabel(by('aciklama'))).toBe('—');
    expect(sourceLabel(by('model'))).toBe('Katalog · TSB ve açık kaynaklar');
    expect(sourceLabel(by('yil'))).toBe('Alıcı girer');
  });

  it('alan kodu üretir', () => {
    expect(fieldKeyFor('Garantisi devam ediyor', [])).toBe('garantisiDevamEdiyor');
    expect(fieldKeyFor('Şarj soketi', ['sarjSoketi'])).toBe('sarjSoketi2');
    expect(fieldKeyFor('Bütçe', [])).toBe('butce2');
    expect(fieldKeyFor('4x4', [])).toBe('alan4x4');
  });
});

describe('eşleşme skoru', () => {
  it('uyum kuralları (Teknik tasarım §6)', () => {
    const want = { make: 'bmw', series: 'bmw/3', model: 'bmw/3/320i' };
    expect(catalogFit(want, want)).toBe(1);
    expect(catalogFit(want, { make: 'bmw', series: 'bmw/3', model: 'bmw/3/318i' })).toBe(0.7);
    expect(catalogFit(want, { make: 'bmw', series: 'bmw/5' })).toBe(0.3);
    expect(catalogFit(want, { make: 'audi' })).toBe(0);
    expect(yearFit({ min: 2020, max: 2023 }, 2018)).toBeCloseTo(0.6);
    expect(budgetFit({ min: 100, max: 200 }, 205)).toBeCloseTo(0.75);
    expect(budgetFit({ min: 100, max: 200 }, 220)).toBe(0);
    expect(budgetFit({ min: 100, max: 200 }, 90)).toBe(0.9);
    expect(kmFit(60_000, 66_000)).toBeCloseTo(0.8);
    expect(packageFit(['sport'], 'msport', ['standart', 'sport', 'msport'])).toBe(0.6);
    expect(packageFit(['sport'], 'standart', ['standart', 'sport', 'msport'])).toBe(0.2);
    expect(locationFit({ il: 'İstanbul', ilce: 'Kadıköy' }, { il: 'İstanbul', ilce: 'Üsküdar' })).toBe(0.8);
    expect(locationFit({ il: 'İstanbul' }, { il: 'Kocaeli' }, () => ['Kocaeli'])).toBe(0.5);
  });

  it('ağırlıklı uyumun yüzdesi; bilinmeyen ölçüt 1 sayılır', () => {
    expect(matchScore({ a: 30, b: 10 }, { a: 1, b: 0 })).toBe(75);
    expect(matchScore({ a: 30, b: 10 }, { a: 1 })).toBe(100);
    expect(matchScore({}, {})).toBe(0);
  });
});
