import { describe, expect, it } from 'vitest';
import {
  completeHomeLayout,
  defaultHomeLayout,
  homeLayoutChanges,
  homeLayoutSchema,
  visibleSections,
} from './home-layout.js';

describe('Ana sayfa düzeni (Karar 46)', () => {
  it('varsayılan düzen tasarımlarla aynı; yeni bölümler kapalı', () => {
    const d = defaultHomeLayout();
    expect(homeLayoutSchema.safeParse(d).success).toBe(true);
    expect(visibleSections(d.ziyaretci.web)).toEqual(['karsi', 'kat', 'vitrin', 'son']);
    expect(visibleSections(d.ziyaretci.mobil)).toEqual(['karsi', 'vitrin', 'son', 'nasil']);
    expect(visibleSections(d.bireysel.web)).toEqual(['karsi', 'duyuru', 'arama', 'kat', 'vitrin', 'son']);
    // Anasayfa.dc.html: vitrin galeriye de görünür
    expect(visibleSections(d.galeri.web)).toEqual(['karsi', 'eslesme', 'duyuru', 'vitrin', 'son']);
  });

  it('karşılama en üstte ve açık kalır; bölüm listesi tam olmalı', () => {
    const d = defaultHomeLayout();
    d.bireysel.web.gizli.push('karsi');
    expect(homeLayoutSchema.safeParse(d).success).toBe(false);
    const e = defaultHomeLayout();
    e.galeri.mobil.sira = ['eslesme', 'karsi', 'hak', 'aranan', 'duyuru', 'son'];
    expect(homeLayoutSchema.safeParse(e).success).toBe(false);
    const f = defaultHomeLayout();
    f.galeri.mobil.sira.pop();
    expect(homeLayoutSchema.safeParse(f).success).toBe(false);
  });

  it('sürüm notu değişiklikleri yazar', () => {
    const a = defaultHomeLayout();
    const b = defaultHomeLayout();
    b.bireysel.mobil.gizli = b.bireysel.mobil.gizli.filter((x) => x !== 'mesaj');
    b.bireysel.mobil.sira = ['karsi', 'mesaj', 'taleplerim', 'duyuru', 'arama', 'kat', 'vitrin', 'son'];
    b.ziyaretci.web.gizli.push('son');
    expect(homeLayoutChanges(a, b)).toEqual([
      'Ziyaretçi · web: “Son talepler” kapatıldı',
      'Bireysel üye · mobil: “Gelen ilk mesajlar” açıldı',
      'Bireysel üye · mobil: “Gelen ilk mesajlar” yukarı taşındı',
    ]);
  });

  it('eski yayın sonradan eklenen bölümle tamamlanır; konsolda yapılan düzen korunur', () => {
    const eski = defaultHomeLayout() as unknown as Record<
      string,
      Record<string, { sira: string[]; gizli: string[] }>
    >;
    // Galeride vitrin eklenmeden önceki yayın: "son" kapatılmış, "aranan" açılmış
    eski.galeri = {
      web: { sira: ['karsi', 'eslesme', 'hak', 'aranan', 'duyuru', 'son'], gizli: ['hak', 'son'] },
      mobil: { sira: ['karsi', 'eslesme', 'hak', 'aranan', 'duyuru', 'son', 'eski_bolum'], gizli: ['hak'] },
    };
    expect(homeLayoutSchema.safeParse(eski).success).toBe(false);
    const t = completeHomeLayout(eski);
    const p = homeLayoutSchema.safeParse(t);
    expect(p.success).toBe(true);
    const d = p.data as ReturnType<typeof defaultHomeLayout>;
    expect(visibleSections(d.galeri.web)).toEqual(['karsi', 'eslesme', 'aranan', 'duyuru', 'vitrin']);
    expect(d.galeri.mobil.sira).toEqual(['karsi', 'eslesme', 'hak', 'aranan', 'duyuru', 'vitrin', 'son']);
  });
});
