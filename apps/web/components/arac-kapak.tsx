import { kapakHarfleri, kapakTonu } from '@rengarenk/shared';
import { cx } from '../lib/cx';
import stil from './arac-kapak.module.css';

/**
 * Marka ve model kapağı (sahip isteği, 17 Kasım 2026): katalogda aracın fotoğrafı seçilene kadar görsel alanı boş
 * kalmaz; markanın renginde (marka adından sabit ton) büyük harfler ve araç adıyla dolu bir kapak gösterilir. Fotoğraf
 * seçilince yerini fotoğraf alır. Bulunduğu kutuyu doldurur; ölçüyü kapsayan öğe verir. Renk ve ölçüler
 * arac-kapak.module.css'te (ton ve boyut sınıfları).
 */
export function AracKapak({
  marka,
  seri,
  bilgi = [],
  boyut = 'kart',
}: {
  marka?: string | null;
  seri?: string | null;
  /** Yıllar, kasa ve paket ("2019–2023", "G20 makyajsız", "M Sport"): büyük kapakta etiket, kartta tek satır */
  bilgi?: readonly (string | null | undefined)[];
  boyut?: 'buyuk' | 'kart' | 'mini';
}) {
  const harf = kapakHarfleri(marka) || kapakHarfleri(seri);
  const ad = [marka, seri].filter(Boolean).join(' ');
  const satir = bilgi.filter((x): x is string => Boolean(x));
  return (
    <span
      role="img"
      aria-label={ad ? `${ad} kapak görseli` : 'Araç kapak görseli'}
      // Telefonda büyük kapağın yazıları küçülür (telefon.css: kutu 16:9 daralınca etiketler sığsın)
      className={cx(
        stil.kapak,
        stil[kapakTonu(marka ?? seri)],
        stil[boyut],
        boyut === 'buyuk' && 'rr-kapak-buyuk',
      )}
    >
      <span aria-hidden="true" className={stil.desen} />
      {harf ? (
        <span aria-hidden="true" className={stil.harf}>
          {harf}
        </span>
      ) : null}
      <span className={stil.yazi}>
        {marka ? (
          <span className={stil.marka}>
            {/* Marka adı Latin büyük harfle ("HYUNDAI", Türkçe "İ" değil) */}
            {marka.toUpperCase()}
          </span>
        ) : null}
        <span className={`rr-kapak-seri ${stil.seri}`}>{seri ?? marka ?? 'Araç'}</span>
        {satir.length && boyut === 'buyuk' ? (
          <span className={`rr-kapak-etiketler ${stil.etiketler}`}>
            {satir.map((x) => (
              <span key={x} className={stil.etiket}>
                {x}
              </span>
            ))}
          </span>
        ) : satir.length && boyut !== 'mini' ? (
          <span className={stil.bilgi}>{satir.join(' · ')}</span>
        ) : null}
      </span>
    </span>
  );
}
