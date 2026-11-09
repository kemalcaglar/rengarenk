import { describe, expect, it } from 'vitest';
import { defaultHomeLayout, homeLayoutChanges, homeLayoutSchema, visibleSections } from './home-layout.js';

describe('Ana sayfa düzeni (Karar 46)', () => {
  it('varsayılan düzen tasarımlarla aynı; yeni bölümler kapalı', () => {
    const d = defaultHomeLayout();
    expect(homeLayoutSchema.safeParse(d).success).toBe(true);
    expect(visibleSections(d.ziyaretci.web)).toEqual(['karsi', 'kat', 'vitrin', 'son']);
    expect(visibleSections(d.ziyaretci.mobil)).toEqual(['karsi', 'vitrin', 'son', 'nasil']);
    expect(visibleSections(d.bireysel.web)).toEqual(['karsi', 'duyuru', 'arama', 'kat', 'vitrin', 'son']);
    expect(visibleSections(d.galeri.web)).toEqual(['karsi', 'eslesme', 'duyuru', 'son']);
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
});
