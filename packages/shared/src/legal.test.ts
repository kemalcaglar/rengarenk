import { describe, expect, it } from 'vitest';
import { legalDiff, legalDiffSummary } from './legal.js';

describe('yasal metin karşılaştırması (Karar 46)', () => {
  it('silinen ve eklenen paragrafları bölüm başlığıyla verir; aynı kalanları vermez', () => {
    const eski =
      '## 1. Taraflar\n\nPlatform Rengarenk’tir.\n\n## 7. Ödemeler\n\nSatın alınan haklar iade edilmez.\n\nFatura e-postayla gelir.';
    const yeni =
      '## 1. Taraflar\n\nPlatform Rengarenk’tir.\n\n## 7. Ödemeler\n\nKullanılmamış haklar 14 gün içinde iade edilebilir.\n\nFatura e-postayla gelir.';
    const d = legalDiff(eski, yeni);
    expect(d).toEqual([
      { tip: 'sil', metin: 'Satın alınan haklar iade edilmez.', bolum: '7. Ödemeler' },
      { tip: 'ekle', metin: 'Kullanılmamış haklar 14 gün içinde iade edilebilir.', bolum: '7. Ödemeler' },
    ]);
    expect(legalDiffSummary(d)).toBe('1 paragraf eklendi, 1 paragraf çıkarıldı · bölüm: 7. Ödemeler');
    expect(legalDiff(eski, eski)).toEqual([]);
    expect(legalDiffSummary([])).toBe('Metinde değişiklik yok');
  });
});
