import { describe, expect, it } from 'vitest';
import {
  damageSummary,
  formatPlate,
  normalizePlate,
  portfolioRules,
  portfolioVehicleSchema,
} from './portfolio';

describe('plaka', () => {
  it('biçimler', () => {
    expect(normalizePlate('34 abc 123')).toBe('34ABC123');
    expect(normalizePlate('06-A-1234')).toBe('06A1234');
    expect(normalizePlate('35 AB 123')).toBe('35AB123');
    expect(normalizePlate('82 AB 123')).toBeNull();
    expect(normalizePlate('34 A 12')).toBeNull();
    expect(normalizePlate('00 AB 123')).toBeNull();
    expect(formatPlate('34ABC123')).toBe('34 ABC 123');
  });
});

describe('portföy kuralları (Karar 17)', () => {
  const now = new Date('2026-11-08T12:00:00+03:00');
  const arac = { yil: 2025, km: 4000, fiyat: 1_500_000, fiyatBeyani: true, ilkTescil: '2026-08-01' };

  it('6 ay / 6.000 km: ikisi de dolmalı; 2027 başından sonra uygulanmaz', () => {
    const r = portfolioRules(arac, { rootSlug: 'otomobil', now });
    expect(r.find((x) => x.key === 'alti_ay')).toMatchObject({ ok: false, engel: true });
    const ok = portfolioRules({ ...arac, km: 8000, ilkTescil: '2026-01-10' }, { rootSlug: 'otomobil', now });
    expect(ok.find((x) => x.key === 'alti_ay')?.ok).toBe(true);
    const sonra = portfolioRules(arac, { rootSlug: 'otomobil', now: new Date('2027-02-01T12:00:00+03:00') });
    expect(sonra.find((x) => x.key === 'alti_ay')).toBeUndefined();
    // Tekne ve kiralık kurala tabi değil
    expect(portfolioRules(arac, { rootSlug: 'deniz', now }).find((x) => x.key === 'alti_ay')).toBeUndefined();
  });

  it('üretici fiyatı: yazılırsa karşılaştırılır, yazılmazsa beyan istenir', () => {
    const ust = portfolioRules({ ...arac, ureticiFiyati: 1_400_000 }, { rootSlug: 'otomobil', now });
    expect(ust.find((x) => x.key === 'uretici_fiyat')).toMatchObject({ ok: false, engel: true });
    const beyansiz = portfolioRules({ ...arac, fiyatBeyani: false }, { rootSlug: 'otomobil', now });
    expect(beyansiz.find((x) => x.key === 'uretici_fiyat')?.engel).toBe(true);
  });

  it('ekspertiz (m.16) uyarıdır, engel değildir', () => {
    const r = portfolioRules(arac, { rootSlug: 'otomobil', now, ekspertizTarihi: new Date('2026-10-01') });
    expect(r.find((x) => x.key === 'ekspertiz')).toMatchObject({ ok: false, engel: false });
    const taze = portfolioRules(arac, { rootSlug: 'otomobil', now, ekspertizTarihi: new Date('2026-11-05') });
    expect(taze.find((x) => x.key === 'ekspertiz')?.ok).toBe(true);
  });
});

describe('araç şeması', () => {
  it('marka katalogdan ya da yazıyla; plaka biçimi; hasar varsayılanı', () => {
    expect(
      portfolioVehicleSchema.safeParse({ kategori: 'otomobil', yil: 2020, km: 1, fiyat: 5000 }).success,
    ).toBe(false);
    const r = portfolioVehicleSchema.parse({
      kategori: 'deniz',
      markaAd: 'Beneteau',
      yil: 2018,
      km: 0,
      fiyat: 3_000_000,
    });
    expect(r.hasar.tramer).toBe(0);
    expect(
      portfolioVehicleSchema.safeParse({
        kategori: 'otomobil',
        marka: 'bmw',
        yil: 2020,
        km: 1,
        fiyat: 5000,
        plaka: 'XX',
      }).success,
    ).toBe(false);
  });
  it('hasar özeti', () => {
    expect(
      damageSummary({
        parcalar: { solArkaCamurluk: 'lokal' },
        tramer: 12000,
        sasiIslem: false,
        podyeIslem: false,
        airbagAcildi: false,
        agirHasar: false,
      }),
    ).toBe('1 lokal boya, değişen yok');
  });
});
