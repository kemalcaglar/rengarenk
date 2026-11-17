/**
 * Talep açıklamasının biçimi (sahip isteği, 17 Kasım 2026: "özel etiketlerle renklendirilebilir, font boyutu
 * seçilebilir"). Metin düz yazı olarak saklanır; biçim köşeli parantezli etiketlerle yazılır ve web ile uygulama aynı
 * ayrıştırıcıyla çizer (HTML saklanmaz, dışarıdan gelen işaret çalışmaz):
 *
 *   [k]kalın[/k]   [i]italik[/i]   [renk=mavi]renkli[/renk]   [boyut=buyuk]büyük[/boyut]
 *
 * Bilinmeyen ya da kapanışı eşleşmeyen etiket olduğu gibi yazı kalır. Uzunluk sınırı düz metne uygulanır
 * (`aciklamaDuz`); arama, moderasyon ve yapay zekâ düz metni kullanır.
 */

/** Yazı renkleri: beyaz zeminde okunur koyu tonlar (palet renklerinin yazı karşılıkları) */
export const ACIKLAMA_RENKLERI = {
  mavi: { ad: 'Mavi', hex: '#2450C8' },
  yesil: { ad: 'Yeşil', hex: '#11683F' },
  kirmizi: { ad: 'Kırmızı', hex: '#B3261E' },
  turuncu: { ad: 'Turuncu', hex: '#B4530F' },
  mor: { ad: 'Mor', hex: '#6B3FC4' },
  pembe: { ad: 'Pembe', hex: '#B0306A' },
} as const;
export type AciklamaRengi = keyof typeof ACIKLAMA_RENKLERI;

/** Yazı boyutları; oran normal yazıya göre */
export const ACIKLAMA_BOYUTLARI = {
  kucuk: { ad: 'Küçük', oran: 0.875 },
  buyuk: { ad: 'Büyük', oran: 1.2 },
  baslik: { ad: 'Başlık', oran: 1.45 },
} as const;
export type AciklamaBoyutu = keyof typeof ACIKLAMA_BOYUTLARI;

/** Düz metin uzunluğu sınırı (etiketler sayılmaz) ve etiketli metnin en çok uzunluğu */
export const ACIKLAMA_SINIR = 2000;
export const ACIKLAMA_HAM_SINIR = 6000;

export interface AciklamaParca {
  metin: string;
  kalin?: true;
  italik?: true;
  renk?: AciklamaRengi;
  boyut?: AciklamaBoyutu;
}

export type AciklamaEtiketi = 'k' | 'i' | 'renk' | 'boyut';
type Etiket = AciklamaEtiketi;
const ETIKET = /\[(\/?)(k|i|renk|boyut)(?:=([a-z]+))?\]/g;

const gecerli = (e: Etiket, d: string | undefined) =>
  e === 'renk'
    ? d !== undefined && d in ACIKLAMA_RENKLERI
    : e === 'boyut'
      ? d !== undefined && d in ACIKLAMA_BOYUTLARI
      : d === undefined;

/** Etiketli metni biçimli parçalara ayırır (satır sonları metinde kalır) */
export function aciklamaParcala(text: string): AciklamaParca[] {
  const out: AciklamaParca[] = [];
  const yigin: { e: Etiket; d?: string }[] = [];
  const stil = (): Omit<AciklamaParca, 'metin'> => {
    const s: Omit<AciklamaParca, 'metin'> = {};
    for (const { e, d } of yigin) {
      if (e === 'k') s.kalin = true;
      else if (e === 'i') s.italik = true;
      else if (e === 'renk') s.renk = d as AciklamaRengi;
      else s.boyut = d as AciklamaBoyutu;
    }
    return s;
  };
  const ekle = (metin: string) => {
    if (!metin) return;
    const s = stil();
    const son = out.at(-1);
    if (
      son &&
      son.kalin === s.kalin &&
      son.italik === s.italik &&
      son.renk === s.renk &&
      son.boyut === s.boyut
    )
      son.metin += metin;
    else out.push({ metin, ...s });
  };
  let i = 0;
  for (const m of text.matchAll(ETIKET)) {
    const [tam, kapanis, ad, deger] = m as unknown as [string, string, Etiket, string | undefined];
    const at = m.index ?? 0;
    ekle(text.slice(i, at));
    i = at + tam.length;
    if (kapanis) {
      // En yakın aynı adlı açık etiket kapanır; yoksa yazı olarak kalır
      const n = yigin.map((x) => x.e).lastIndexOf(ad);
      if (n === -1 || deger !== undefined) ekle(tam);
      else yigin.splice(n, 1);
    } else if (gecerli(ad, deger)) yigin.push({ e: ad, d: deger });
    else ekle(tam);
  }
  ekle(text.slice(i));
  return out;
}

/** Etiketsiz düz metin (uzunluk, arama, moderasyon, önizleme satırı) */
export function aciklamaDuz(text: string): string {
  return aciklamaParcala(text)
    .map((p) => p.metin)
    .join('');
}

/**
 * Seçili metni etiketle sarar; düzenleyicideki araç çubuğu kullanır. Döner: yeni metin ve imlecin yeni seçimi.
 * Seçim boşsa etiketler imlecin yerine eklenir ve imleç arasına konur.
 */
export function aciklamaSar(
  text: string,
  bas: number,
  son: number,
  etiket: { e: Etiket; d?: string },
): { metin: string; bas: number; son: number } {
  const ac = `[${etiket.e}${etiket.d ? `=${etiket.d}` : ''}]`;
  const kapa = `[/${etiket.e}]`;
  const metin = text.slice(0, bas) + ac + text.slice(bas, son) + kapa + text.slice(son);
  return { metin, bas: bas + ac.length, son: son + ac.length };
}
