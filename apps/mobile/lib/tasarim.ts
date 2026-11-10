import { applyDesignColors, DEFAULT_DESIGN, type PublicDesign, type SeasonalTheme } from '@rengarenk/shared';
import * as Font from 'expo-font';
import { setFontAilesi } from '../components/t';
import { API } from './api';

let tema: SeasonalTheme | null = null;

/** Geçerli mevsimsel tema (ana sayfanın üst bölümü) */
export const aktifTema = () => tema;

/**
 * Yayındaki tasarım değerleri (Karar 46): uygulama açılırken bir kez okunur. Ortak renkler ve köşeler güncellenir
 * (bileşenler çizerken okur), seçilen yazı tipi Google Fonts'tan yüklenir. API'ye 2,5 saniyede ulaşılamazsa ya da yazı
 * tipi yüklenemezse varsayılan (Plus Jakarta Sans) kalır.
 */
export async function tasarimYukle(): Promise<void> {
  try {
    const r = await fetch(`${API}/tasarim`, { signal: AbortSignal.timeout(2500) });
    if (!r.ok) return;
    const t = (await r.json()) as PublicDesign;
    applyDesignColors(t.degerler);
    tema = t.tema;
    const dosyalar = Object.entries(t.font.dosyalar);
    if (t.font.ad === DEFAULT_DESIGN.yaziTipi || !dosyalar.length) return;
    const ad = t.font.ad.replace(/\W/g, '');
    await Promise.race([
      Font.loadAsync(Object.fromEntries(dosyalar.map(([w, url]) => [`${ad}_${w}`, url]))),
      new Promise((_, red) => setTimeout(() => red(new Error('zaman aşımı')), 4000)),
    ]);
    setFontAilesi(Object.fromEntries(dosyalar.map(([w]) => [w, `${ad}_${w}`])));
  } catch {
    // varsayılan değerlerle açılır
  }
}
