import { describe, expect, it } from 'vitest';
import {
  ANA_LISTE,
  adAnahtari,
  anaListe,
  anaYerlestir,
  MARKA_ADI,
  SERI_KURALLARI,
  yillariAc,
} from './index.js';

describe('ana liste (sahip kararı, 16 Kasım 2026)', () => {
  it('her markada seri adları ad anahtarıyla tekil; yıllar 1970–2026 arasında', () => {
    for (const m of ANA_LISTE) {
      const gorulen = new Map<string, string>();
      for (const s of m.seriler) {
        const k = `${adAnahtari(s.ad)}|${s.kategori}`;
        expect(gorulen.get(k) ?? s.ad, `${m.marka}: ${s.ad}`).toBe(s.ad);
        gorulen.set(k, s.ad);
        const y = yillariAc(s.yillar);
        expect(y.length, `${m.marka} ${s.ad}`).toBeGreaterThan(0);
        expect(y[0]).toBeGreaterThanOrEqual(1970);
        expect(y.at(-1)).toBeLessThanOrEqual(2026);
      }
    }
  });

  it('kurallar ve marka adları listede var olan seriye ve markaya bağlanır', () => {
    const markalar = new Set(ANA_LISTE.map((m) => m.marka));
    for (const ad of Object.values(MARKA_ADI)) expect(markalar.has(ad), ad).toBe(true);
    for (const [marka, kurallar] of Object.entries(SERI_KURALLARI)) {
      const seriler = (m: string) => new Set(ANA_LISTE.find((x) => x.marka === m)?.seriler.map((s) => s.ad));
      expect(seriler(marka).size, marka).toBeGreaterThan(0);
      for (const k of kurallar)
        expect(seriler(k.marka ?? marka).has(k.hedef), `${marka}: ${k.marka ?? ''} ${k.hedef}`).toBe(true);
    }
  });

  it('yıllar aralıktan açılır; iki kategorideki seri birleşir', () => {
    expect(yillariAc('1997-2000,2003')).toEqual([1997, 1998, 1999, 2000, 2003]);
    expect(adAnahtari('C-Elysée')).toBe(adAnahtari('C-Elysee'));
    expect(adAnahtari('5 Serisi')).toBe('5');
    expect(adAnahtari('L 200')).toBe(adAnahtari('L200'));
    const liste = anaListe([
      {
        marka: 'Deneme',
        seriler: [
          { ad: 'X', kategori: 'otomobil', yillar: '2001-2002' },
          { ad: 'X', kategori: 'arazi-suv-pickup', yillar: '2004' },
        ],
      },
    ]);
    expect(liste).toEqual([
      {
        marka: 'Deneme',
        seri: 'X',
        kategoriler: ['otomobil', 'arazi-suv-pickup'],
        yillar: [2001, 2002, 2004],
      },
    ]);
  });

  it('kaynaktaki marka ve seri ana listedeki ada yerleşir; listede olmayan seri olduğu gibi kalır', () => {
    expect(anaYerlestir({ make: 'Mitsubishi', series: 'L200', categories: ['arazi-suv-pickup'] })).toEqual({
      make: 'Mitsubishi',
      series: 'L 200',
      ana: true,
    });
    expect(anaYerlestir({ make: 'DS', series: 'DS 7', categories: ['otomobil'] }).make).toBe(
      'DS Automobiles',
    );
    expect(
      anaYerlestir({ make: 'SsangYong', series: 'Korando', categories: ['arazi-suv-pickup'] }).make,
    ).toBe('KGM SsangYong');
    expect(anaYerlestir({ make: 'Toyota', series: 'Hilux Uydurma', categories: ['otomobil'] })).toEqual({
      make: 'Toyota',
      series: 'Hilux Uydurma',
      ana: false,
    });
    // Ana liste otomobil ve SUV içindir; motosiklet serisine dokunmaz
    expect(anaYerlestir({ make: 'BMW', series: 'X5', categories: ['motosiklet'] }).ana).toBe(false);
  });

  it('eski TSB yazımları: desen kuralı, başka marka ve baştaki kelimeler (2006–2019 ve eski araç listeleri)', () => {
    const oto = (make: string, series: string, raw: string, years = [1995]) =>
      anaYerlestir({ make, series, raw, categories: ['otomobil'], years });
    expect(oto('BMW', '320I/4', '320I/4')).toMatchObject({ series: '3 Serisi', ana: true });
    expect(oto('BMW', '318TIA', '318tiA COMPACT')).toMatchObject({ series: '3 Serisi' });
    // "30 CSL" ve "2002" 3 ya da 2 Serisi değildir
    expect(oto('BMW', '30', '30 CSL (2985)', [1972]).ana).toBe(false);
    expect(oto('BMW', '2002', '2002 (1598)', [1974]).ana).toBe(false);
    expect(oto('Fiat', 'Dogan', 'DOGAN 1.6 i.e.')).toEqual({ make: 'Tofaş', series: 'Doğan', ana: true });
    expect(oto('Buick', 'LE', 'LE SABRE (1600)', [1980])).toMatchObject({ series: 'Le Sabre', ana: true });
    expect(oto('Toyota', '4', '4 RUNNER')).toMatchObject({ series: '4Runner' });
    expect(oto('Land Rover', '110-83', '110-83 2495', [1987])).toMatchObject({ series: 'Defender' });
    // 1983 öncesi "88" Land Rover serisidir, Defender değil
    expect(oto('Land Rover', '88', '88 2286', [1984]).ana).toBe(false);
  });
});
