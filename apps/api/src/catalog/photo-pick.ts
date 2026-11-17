/**
 * Makyaja göre temsilî fotoğraf (Karar 34: nesil ve makyaj başına). Önce istenen makyajın fotoğrafı, yoksa nesil
 * geneli, o da yoksa aynı neslin en erken makyajı. Talep sayfası, liste ve seri ayrıntısı aynı kuralı kullanır.
 */
export function makyajFoto<T extends { facelift: number | null }>(
  list: readonly T[],
  makyaj: number | null | undefined,
): T | undefined {
  if (!list.length) return undefined;
  const m = makyaj ?? 0;
  return (
    list.find((f) => f.facelift === m) ??
    list.find((f) => f.facelift === null) ??
    [...list].sort((a, b) => (a.facelift ?? 0) - (b.facelift ?? 0))[0]
  );
}

/**
 * Nesilde seçili fotoğraf yoksa aynı serideki en yakın neslin fotoğrafı (Karar 34: "o da yoksa en yakın neslin
 * fotoğrafı 'önceki nesil' etiketiyle"). Önce hedeften önce başlayan en yakın nesil (son makyajı), yoksa sonra başlayan
 * en yakın nesil (ilk makyajı). `nesiller`: serinin nesil kodu satırları.
 */
export function nesilFoto<T extends { facelift: number | null; generationId: string }>(
  nesiller: readonly { id: string; startYear: number }[],
  fotolar: readonly T[],
  hedef: { id?: string; startYear: number | null },
  makyaj: number | null | undefined,
): { foto: T; yakin: 'onceki' | 'sonraki' | null } | undefined {
  const kendi = hedef.id
    ? makyajFoto(
        fotolar.filter((f) => f.generationId === hedef.id),
        makyaj,
      )
    : undefined;
  if (kendi) return { foto: kendi, yakin: null };
  const bas = hedef.startYear;
  if (bas === null) return undefined;
  const fotolu = nesiller.filter((n) => n.id !== hedef.id && fotolar.some((f) => f.generationId === n.id));
  const onceki = fotolu.filter((n) => n.startYear < bas).sort((a, b) => b.startYear - a.startYear)[0];
  if (onceki) {
    const list = fotolar.filter((f) => f.generationId === onceki.id);
    const foto =
      list.find((f) => f.facelift === null) ??
      [...list].sort((a, b) => (b.facelift ?? 0) - (a.facelift ?? 0))[0];
    if (foto) return { foto, yakin: 'onceki' };
  }
  const sonraki = fotolu.filter((n) => n.startYear >= bas).sort((a, b) => a.startYear - b.startYear)[0];
  if (sonraki) {
    const foto = makyajFoto(
      fotolar.filter((f) => f.generationId === sonraki.id),
      0,
    );
    if (foto) return { foto, yakin: 'sonraki' };
  }
  return undefined;
}

/** Talep görseli seçiminde kullanılan katalog satırları (`TalepFotoService.veri`) */
export interface FotoNesil {
  id: string;
  key: string;
  code: string | null;
  facelift: number | null;
  source: string;
  startYear: number;
  endYear: number | null;
}
export interface FotoSecili {
  generationId: string | null;
  seriesId: string | null;
  facelift: number | null;
  yearFrom: number | null;
  yearTo: number | null;
}
/** null: tam yerinde; onceki/sonraki: en yakın nesil; seri: model geneli fotoğraf */
export type FotoYakin = 'onceki' | 'sonraki' | 'seri' | null;
export interface FotoHedef {
  tur: 'nesil' | 'kusak' | 'seri';
  id: string;
  makyaj: number | null;
}

const ortusme = (a: [number, number], b: [number, number]) =>
  Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0]) + 1);
const uzaklik = (a: [number, number], b: [number, number]) =>
  ortusme(a, b) > 0 ? 0 : Math.min(Math.abs(a[0] - b[1]), Math.abs(b[0] - a[1]));

/**
 * Talep görseli (sahip isteği, 17 Kasım 2026; Karar 34). Kasa ya da yıla göre sırayla:
 *  1. kodlu kasa ("G20:1") → nesil ve makyaj fotoğrafı, yoksa en yakın neslin fotoğrafı ("önceki nesil");
 *  2. kodsuz kasa kuşağı → kuşağın fotoğrafı;
 *  3. yıllar (kasanın ya da talebin) → yılları en çok örtüşen nesil ya da kuşağın fotoğrafı;
 *  4. model geneli (seri) fotoğrafı, yıl aralığı en yakın olan;
 *  5. yıl yoksa serinin en yeni neslinin fotoğrafı.
 * Bulunamazsa undefined: arayüz marka ve model kapağını gösterir, talep konsolda "görsel bekleyen" listesine düşer.
 * `hedef`: fotoğraf bulunamadığında konsolda yükleme ya da seçimin gideceği yer (kasa varsa kasa, yoksa seri).
 */
export function talepFotosu<T extends FotoSecili>(
  gens: readonly FotoNesil[],
  fotolar: readonly T[],
  seriesId: string,
  kasa: string | null,
  yillar: [number, number] | null,
  buYil = new Date().getFullYear(),
): { foto?: T; yakin: FotoYakin; hedef: FotoHedef } {
  const kodlu = gens.filter((g) => g.source === 'wikidata');
  const genFoto = (id: string) => fotolar.filter((f) => f.generationId === id);
  const araligi = (g: FotoNesil): [number, number] => [g.startYear, g.endYear ?? buYil];
  let hedef: FotoHedef = { tur: 'seri', id: seriesId, makyaj: null };
  let aralik = yillar;

  const m = kasa ? /^([^:/]+):(\d+)$/.exec(kasa) : null;
  if (m) {
    const makyaj = Number(m[2]);
    const kod = kodlu.find((g) => g.code === m[1]);
    const grup = gens.filter(
      (g) => g.source !== 'wikidata' && g.code === m[1] && (g.facelift ?? 0) === makyaj,
    );
    const bas = grup.length ? Math.min(...grup.map((g) => g.startYear)) : (kod?.startYear ?? null);
    if (bas !== null) aralik = [bas, grup.length ? Math.max(...grup.map((g) => g.endYear ?? buYil)) : buYil];
    if (kod) hedef = { tur: 'nesil', id: kod.id, makyaj };
    const s = nesilFoto(
      kodlu,
      fotolar as readonly (T & { generationId: string })[],
      { id: kod?.id, startYear: bas },
      makyaj,
    );
    if (s) return { foto: s.foto, yakin: s.yakin, hedef };
  } else if (kasa) {
    const g = gens.find((x) => x.key === kasa);
    if (g) {
      hedef = { tur: 'kusak', id: g.id, makyaj: null };
      aralik = araligi(g);
      const f = makyajFoto(genFoto(g.id), null);
      if (f) return { foto: f, yakin: null, hedef };
    }
  }

  const fotolu = gens.filter((g) => genFoto(g.id).length > 0);
  if (aralik) {
    const a = aralik;
    const en = fotolu
      .map((g) => ({ g, o: ortusme(araligi(g), a) }))
      .filter((x) => x.o > 0)
      .sort((x, y) => y.o - x.o || y.g.startYear - x.g.startYear)[0];
    if (en) {
      const f = makyajFoto(genFoto(en.g.id), null);
      if (f) return { foto: f, yakin: null, hedef };
    }
    // Kodsuz talepte hedef, yılları örtüşen nesil (varsa)
    if (hedef.tur === 'seri') {
      const n = kodlu
        .map((g) => ({ g, o: ortusme(araligi(g), a) }))
        .filter((x) => x.o > 0)
        .sort((x, y) => y.o - x.o)[0];
      if (n) hedef = { tur: 'nesil', id: n.g.id, makyaj: null };
    }
  }

  const seri = fotolar.filter((f) => f.seriesId === seriesId);
  if (seri.length) {
    const a = aralik;
    const f = a
      ? [...seri].sort(
          (x, y) =>
            uzaklik([x.yearFrom ?? 1900, x.yearTo ?? buYil], a) -
              uzaklik([y.yearFrom ?? 1900, y.yearTo ?? buYil], a) ||
            Number(x.yearFrom === null) - Number(y.yearFrom === null),
        )[0]
      : (seri.find((x) => x.yearFrom === null && x.yearTo === null) ?? seri[0]);
    if (f) return { foto: f, yakin: 'seri', hedef };
  }

  // Yıl bilinmiyorsa (ya da hiçbir yıl tutmadıysa) en yakın nesil
  const sirali = [...fotolu].sort((x, y) =>
    aralik
      ? uzaklik(araligi(x), aralik) - uzaklik(araligi(y), aralik) || y.startYear - x.startYear
      : y.startYear - x.startYear,
  );
  const yakin = sirali[0];
  if (yakin) {
    const f = makyajFoto(genFoto(yakin.id), null);
    if (f)
      return {
        foto: f,
        yakin: aralik ? (yakin.startYear < aralik[0] ? 'onceki' : 'sonraki') : null,
        hedef,
      };
  }
  return { yakin: null, hedef };
}
