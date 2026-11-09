/**
 * Türkçe ekler (ajanın yazdığı cümleler için): "İzmir’de", "Antalya’da", "24’ü", "Ekim 2026’da", "eylüle".
 * Sayılarda ek, sayının okunuşundaki son kelimeye göre seçilir.
 */

const KALIN = 'aıou';
const UNLU = 'aeıioöuü';
const SERT = 'fstkçşhp';

const BIRLER = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
const ONLAR = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan'];

/** Sayının okunuşundaki son kelime (24 → dört, 1000 → bin, 2026 → altı) */
export function sayiSonKelime(n: number): string {
  const x = Math.abs(Math.trunc(n));
  if (x === 0) return 'sıfır';
  if (x % 10) return BIRLER[x % 10] as string;
  if (x % 100) return ONLAR[(x % 100) / 10] as string;
  if (x % 1000) return 'yüz';
  if (x % 1_000_000) return 'bin';
  if (x % 1_000_000_000) return 'milyon';
  return 'milyar';
}

const sonUnlu = (w: string) => {
  const k = w.toLocaleLowerCase('tr');
  for (let i = k.length - 1; i >= 0; i--) if (UNLU.includes(k[i] as string)) return k[i] as string;
  return 'e';
};
const unluIleBiter = (w: string) => UNLU.includes(w.toLocaleLowerCase('tr').slice(-1));
const sertIleBiter = (w: string) => SERT.includes(w.toLocaleLowerCase('tr').slice(-1));
const iki = (w: string) => (KALIN.includes(sonUnlu(w)) ? 'a' : 'e');
const dort = (w: string) => {
  const u = sonUnlu(w);
  return u === 'a' || u === 'ı' ? 'ı' : u === 'e' || u === 'i' ? 'i' : u === 'o' || u === 'u' ? 'u' : 'ü';
};

/** Bulunma eki: İzmir → de, Muş → ta, Antalya → da */
export function bulunmaEki(w: string) {
  return `${sertIleBiter(w) ? 't' : 'd'}${iki(w)}`;
}
/** Ayrılma eki: İzmir → den, Muş → tan */
export function ayrilmaEki(w: string) {
  return `${sertIleBiter(w) ? 't' : 'd'}${iki(w)}n`;
}
/** Yönelme eki: eylül → e, Antalya → ya */
export function yonelmeEki(w: string) {
  return `${unluIleBiter(w) ? 'y' : ''}${iki(w)}`;
}
/** İyelik (3. tekil) eki: dört → ü, iki → si */
export function iyelikEki(w: string) {
  return `${unluIleBiter(w) ? 's' : ''}${dort(w)}`;
}

/** Özel ad ya da sayıya kesme işaretiyle ek: ekle('İzmir', 'bulunma') → "İzmir’de", ekle('Ekim 2026', 'bulunma') → "Ekim 2026’da" */
export function ekle(deger: string | number, ek: 'bulunma' | 'ayrilma' | 'yonelme' | 'iyelik') {
  const yazi = typeof deger === 'number' ? new Intl.NumberFormat('tr-TR').format(deger) : deger;
  // "Ekim 2026" gibi yazılarda son kelimeye bakılır; rakamla yazılmışsa okunuşuna
  const son = String(deger).split(/\s+/).pop() ?? '';
  const okunus = /^\d+$/.test(son.replace(/\./g, '')) ? sayiSonKelime(Number(son.replace(/\./g, ''))) : son;
  const f = { bulunma: bulunmaEki, ayrilma: ayrilmaEki, yonelme: yonelmeEki, iyelik: iyelikEki }[ek];
  return `${yazi}’${f(okunus)}`;
}
