import { describe, expect, it } from 'vitest';
import { changeText, goalStatus } from './dashboard.js';

describe('kontrol paneli hedefleri (Karar 44)', () => {
  it('aylık birikenlerde ilerleme ayın geçen kısmıyla karşılaştırılır; %10 sapma geride sayılır', () => {
    expect(goalStatus('talep', 870, 4500, 0.2).durum).toBe('yolunda');
    expect(goalStatus('talep', 700, 4500, 0.2)).toMatchObject({ durum: 'geride' });
    // Ayın başında sapma ölçülmez
    expect(goalStatus('talep', 0, 4500, 0.03).durum).toBe('yolunda');
    // Ücretli galeri: ay başındaki sayıdan hedefe
    expect(goalStatus('ucretli_galeri', 251, 300, 0.2, 238).ilerleme).toBeCloseTo(13 / 62);
    // Ana ölçü: 3 puan içi yakın
    expect(goalStatus('ana_olcu', 78, 80, 0.2).durum).toBe('yakin');
    expect(goalStatus('ana_olcu', 70, 80, 0.2).durum).toBe('geride');
    expect(goalStatus('ana_olcu', 81, 80, 0.2).durum).toBe('yolunda');
  });

  it('değişim yazısı', () => {
    expect(changeText(112, 100)).toEqual({ metin: '▲ %12', artis: true });
    expect(changeText(95, 100)).toEqual({ metin: '▼ %5', artis: false });
    expect(changeText(3, 0)).toEqual({ metin: 'yeni', artis: true });
  });
});
