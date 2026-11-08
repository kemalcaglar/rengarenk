import { describe, expect, it } from 'vitest';
import { galleryAccess } from './gallery.js';
import {
  addMonths,
  planChangeKind,
  planNetKurus,
  prorateKurus,
  subscriptionCheckoutSchema,
  withVat,
} from './subscriptions.js';

describe('galeri abonelikleri (Karar 12.2, 12.5, 39)', () => {
  it('fiyat KDV hariç; faturaya %20 KDV eklenir; yıllıkta 2 ay ücretsiz', () => {
    expect(planNetKurus('profesyonel', 'aylik')).toBe(349_000);
    expect(withVat(planNetKurus('baslangic', 'aylik'))).toBe(178_800);
    expect(planNetKurus('kurumsal', 'yillik')).toBe(planNetKurus('kurumsal', 'aylik') * 10);
  });

  it('takvim ayı eklenir; ay sonu taşmaz', () => {
    expect(addMonths(new Date('2026-01-31T10:00:00Z'), 1).toISOString()).toBe('2026-02-28T10:00:00.000Z');
    expect(addMonths(new Date('2026-11-08T09:00:00Z'), 12).toISOString()).toBe('2027-11-08T09:00:00.000Z');
  });

  it('üst pakete geçişte kalan sürenin farkı; alt paket ve dönem değişikliği sonraki dönemde', () => {
    const start = new Date('2026-11-01T00:00:00Z');
    const end = new Date('2026-12-01T00:00:00Z');
    const yari = new Date('2026-11-16T00:00:00Z');
    expect(prorateKurus(349_000, 749_000, start, end, yari)).toBe(200_000);
    expect(prorateKurus(749_000, 349_000, start, end, yari)).toBe(0);
    const cur = { plan: 'profesyonel', donem: 'aylik' as const, etkin: true };
    expect(planChangeKind(null, { plan: 'baslangic', donem: 'aylik' })).toBe('yeni');
    expect(planChangeKind(cur, { plan: 'kurumsal', donem: 'aylik' })).toBe('yukseltme');
    expect(planChangeKind(cur, { plan: 'baslangic', donem: 'aylik' })).toBe('sonraki_donem');
    expect(planChangeKind(cur, { plan: 'profesyonel', donem: 'yillik' })).toBe('sonraki_donem');
    expect(planChangeKind(cur, { plan: 'profesyonel', donem: 'aylik' })).toBe('ayni');
  });

  it('sözleşme ve otomatik yenileme onayı ayrı ayrı zorunlu', () => {
    const t = { plan: 'profesyonel', donem: 'aylik', eposta: 'a@b.com' };
    expect(
      subscriptionCheckoutSchema.safeParse({ ...t, onay: { sozlesme: true, yenileme: true } }).success,
    ).toBe(true);
    expect(subscriptionCheckoutSchema.safeParse({ ...t, onay: { sozlesme: true } }).success).toBe(false);
  });

  it('denemesi biten ya da paketi sona eren galeri salt okunur', () => {
    const now = new Date('2026-11-08T00:00:00Z');
    expect(
      galleryAccess({ plan: 'deneme', trialEndsAt: new Date('2026-11-20T00:00:00Z') }, now),
    ).toMatchObject({
      saltOkunur: false,
      ozellik: { eslesme: true, gunlukMesaj: 10 },
    });
    expect(
      galleryAccess({ plan: 'deneme', trialEndsAt: new Date('2026-11-01T00:00:00Z') }, now),
    ).toMatchObject({
      saltOkunur: true,
      ozellik: { gunlukMesaj: 0 },
    });
    expect(galleryAccess({ plan: 'pasif', trialEndsAt: null }, now)).toMatchObject({
      saltOkunur: true,
      ad: 'Paket yok',
    });
    expect(galleryAccess({ plan: 'baslangic', trialEndsAt: null }, now)).toMatchObject({
      saltOkunur: false,
      ozellik: { eslesme: false, portfoy: 25 },
    });
  });
});
