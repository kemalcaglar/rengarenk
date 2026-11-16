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
  /** Kaynaktaki seri adı (büyük/küçük harf, boşluk ve tire önemsiz) */
  kaynak: string;
  /** Ana listedeki seri adı (aynı marka) */
  hedef: string;
  /** Tip adında aranır (TSB tip adları büyük harftir); verilmezse serinin bütün tipleri */
  tip?: RegExp;
  /** Yalnızca bu yakıttaki tipler (ör. elektrikli alt seri) */
  yakit?: string;
}
