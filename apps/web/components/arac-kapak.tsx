import { kapakHarfleri, kapakTonu } from '@rengarenk/shared';
import type { CSSProperties } from 'react';
import { colors } from '../lib/renk';
import stil from './arac-kapak.module.css';

/** Paletin rengi ve kart zeminiyle karışmış açık tonu (tasarım değerleri değişince kapak da değişir) */
const ton = (renk: string) => ({ renk, acik: `color-mix(in srgb, ${renk} 14%, ${colors.surface})` });
const TON = {
  blue: ton(colors.blue),
  pink: ton(colors.pink),
  yellow: ton(colors.yellow),
  green: ton(colors.green),
} as const;

const OLCU = {
  /** Talep sayfasının üstü (560 × 206) */
  buyuk: { marka: 13, seri: 34, alt: 14, harf: 220, bosluk: 22 },
  /** Vitrin ve liste kartı */
  kart: { marka: 10, seri: 16, alt: 10.5, harf: 110, bosluk: 10 },
  /** Liste satırındaki küçük görsel (96 × 64) */
  mini: { marka: 8.5, seri: 12.5, alt: 0, harf: 64, bosluk: 7 },
} as const;

/**
 * Marka ve model kapağı (sahip isteği, 17 Kasım 2026): katalogda aracın fotoğrafı seçilene kadar görsel alanı boş
 * kalmaz; markanın renginde (marka adından sabit ton) büyük harfler ve araç adıyla dolu bir kapak gösterilir. Fotoğraf
 * seçilince yerini fotoğraf alır. Bulunduğu kutuyu doldurur; ölçüyü kapsayan öğe verir.
 */
export function AracKapak({
  marka,
  seri,
  bilgi = [],
  boyut = 'kart',
  style,
}: {
  marka?: string | null;
  seri?: string | null;
  /** Yıllar, kasa ve paket ("2019–2023", "G20 makyajsız", "M Sport"): büyük kapakta etiket, kartta tek satır */
  bilgi?: readonly (string | null | undefined)[];
  boyut?: keyof typeof OLCU;
  style?: CSSProperties;
}) {
  const t = TON[kapakTonu(marka ?? seri)];
  const o = OLCU[boyut];
  const harf = kapakHarfleri(marka) || kapakHarfleri(seri);
  const ad = [marka, seri].filter(Boolean).join(' ');
  const satir = bilgi.filter((x): x is string => Boolean(x));
  return (
    <span
      role="img"
      aria-label={ad ? `${ad} kapak görseli` : 'Araç kapak görseli'}
      // Telefonda büyük kapağın yazıları küçülür (telefon.css: kutu 16:9 daralınca etiketler sığsın)
      className={boyut === 'buyuk' ? 'rr-kapak-buyuk' : undefined}
      style={{
        position: 'relative',
        display: 'block',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: `linear-gradient(135deg, ${t.acik} 0%, color-mix(in srgb, ${t.renk} 38%, ${t.acik}) 100%)`,
        ...style,
      }}
    >
      {/* Yol çizgileri: kapağı boş göstermeyen hafif desen */}
      <span
        aria-hidden="true"
        className={stil.metin1}
        style={{
          background: `repeating-linear-gradient(90deg, transparent 0 ${o.bosluk * 3}px, color-mix(in srgb, ${t.renk} 22%, transparent) ${o.bosluk * 3}px ${o.bosluk * 3 + 2}px)`,
        }}
      />
      {harf ? (
        <span
          aria-hidden="true"
          className={stil.metin2}
          style={{ fontSize: o.harf, color: `color-mix(in srgb, ${t.renk} 55%, transparent)` }}
        >
          {harf}
        </span>
      ) : null}
      <span className={stil.metin3} style={{ left: o.bosluk + 2, right: o.bosluk, bottom: o.bosluk }}>
        {marka ? (
          <span className={stil.metin4} style={{ fontSize: o.marka }}>
            {/* Marka adı Latin büyük harfle ("HYUNDAI", Türkçe "İ" değil) */}
            {marka.toUpperCase()}
          </span>
        ) : null}
        <span className={`rr-kapak-seri ${stil.metin5}`} style={{ fontSize: o.seri }}>
          {seri ?? marka ?? 'Araç'}
        </span>
        {satir.length && boyut === 'buyuk' ? (
          <span className={`rr-kapak-etiketler ${stil.metin6}`}>
            {satir.map((x) => (
              <span key={x} className={stil.metin7} style={{ fontSize: o.alt }}>
                {x}
              </span>
            ))}
          </span>
        ) : satir.length && o.alt ? (
          <span className={stil.metin8} style={{ fontSize: o.alt }}>
            {satir.join(' · ')}
          </span>
        ) : null}
      </span>
    </span>
  );
}
