/** Ana listenin kapsadığı kategoriler: liste bu kategorilerde seri seçeneklerini ve yıllarını belirler. */
export type AnaKategori = 'otomobil' | 'arazi-suv-pickup';

export interface AnaSeri {
  /** Sitede görünen seri adı */
  ad: string;
  kategori: AnaKategori;
  /** Türkiye'deki model yılları, aralık olarak: "1997-2000,2003" */
  yillar: string;
}

export interface AnaMarka {
  marka: string;
  seriler: AnaSeri[];
}

/**
 * Kaynaktaki (TSB, vehicle-makes-models, yerli liste) bir seriyi ana listedeki seriye bağlayan kural. Ad benzerliği
 * yetmeyen durumlar içindir: alt seriye ayırma ("Q5" tiplerinden Sportback olanlar "Q5 Sportback"e) ve farklı adlar
 * ("Ypsilon" → "Y (Ypsilon)"). Kurallar sırayla denenir; ilk tutan uygulanır.
 */
export interface SeriKurali {
  /**
   * Kaynaktaki seri adı (büyük/küçük harf, boşluk ve tire önemsiz). "*": seri adı ne olursa olsun, yalnızca `tip`
   * desenine bakılır (eski TSB yazımları "320I/4"); ad eşleşmesinden sonra denenir.
   */
  kaynak: string;
  /** Yalnızca ilk model yılı bundan büyük olmayan tipler (eski yazımlara sınırlamak için) */
  sonYil?: number;
  /** Ana listedeki seri adı (aynı marka) */
  hedef: string;
  /** Tip adında aranır (TSB tip adları büyük harftir); verilmezse serinin bütün tipleri */
  tip?: RegExp;
  /** Yalnızca bu yakıttaki tipler (ör. elektrikli alt seri) */
  yakit?: string;
  /** Yalnızca ilk model yılı bundan küçük olmayan tipler (ör. Sandero Stepway 2021'den itibaren ayrı seri) */
  ilkYil?: number;
  /** Hedef seri başka bir ana liste markasında (TSB'de Citroen altında yazılan DS3 → DS Automobiles) */
  marka?: string;
}
