import { kapakHarfleri, kapakTonu } from '@rengarenk/shared';
import type { CSSProperties } from 'react';
import { colors } from '../lib/renk';

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
        style={{
          position: 'absolute',
          inset: '-40% -10%',
          transform: 'rotate(-14deg)',
          background: `repeating-linear-gradient(90deg, transparent 0 ${o.bosluk * 3}px, color-mix(in srgb, ${t.renk} 22%, transparent) ${o.bosluk * 3}px ${o.bosluk * 3 + 2}px)`,
          maskImage: 'linear-gradient(90deg, transparent 0%, #000 55%, #000 100%)',
          WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 55%, #000 100%)',
          opacity: 0.55,
        }}
      />
      {harf ? (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: '-0.06em',
            bottom: '-0.24em',
            fontSize: o.harf,
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: '-0.04em',
            color: `color-mix(in srgb, ${t.renk} 55%, transparent)`,
            whiteSpace: 'nowrap',
            userSelect: 'none',
          }}
        >
          {harf}
        </span>
      ) : null}
      <span
        style={{
          position: 'absolute',
          left: o.bosluk + 2,
          right: o.bosluk,
          bottom: o.bosluk,
          display: 'block',
          textAlign: 'left',
        }}
      >
        {marka ? (
          <span
            style={{
              display: 'block',
              fontSize: o.marka,
              fontWeight: 800,
              letterSpacing: '0.08em',
              color: colors.muted,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {/* Marka adı Latin büyük harfle ("HYUNDAI", Türkçe "İ" değil) */}
            {marka.toUpperCase()}
          </span>
        ) : null}
        <span
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            fontSize: o.seri,
            fontWeight: 900,
            lineHeight: 1.1,
            color: colors.ink,
            marginTop: 2,
          }}
        >
          {seri ?? marka ?? 'Araç'}
        </span>
        {satir.length && boyut === 'buyuk' ? (
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, paddingRight: '28%' }}>
            {satir.map((x) => (
              <span
                key={x}
                style={{
                  fontSize: o.alt,
                  fontWeight: 700,
                  color: colors.ink,
                  background: `color-mix(in srgb, ${colors.surface} 82%, transparent)`,
                  padding: '4px 10px',
                  borderRadius: 'var(--rr-etiket-kose)',
                  whiteSpace: 'nowrap',
                }}
              >
                {x}
              </span>
            ))}
          </span>
        ) : satir.length && o.alt ? (
          <span
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              fontSize: o.alt,
              fontWeight: 700,
              lineHeight: 1.3,
              color: colors.inkSoft,
              marginTop: 3,
            }}
          >
            {satir.join(' · ')}
          </span>
        ) : null}
      </span>
    </span>
  );
}
