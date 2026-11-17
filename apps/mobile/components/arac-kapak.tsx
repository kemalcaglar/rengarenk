import { colors, kapakHarfleri, kapakTonu, radii } from '@rengarenk/shared';
import { View } from 'react-native';
import { T } from './t';

/** İki rengi karıştırır (`oran` birinci rengin payı); tasarım değerleri değişince kapak da değişir */
function karistir(a: string, b: string, oran: number): string {
  const hex = (h: string) => {
    const x = h.replace('#', '');
    const t = x.length === 3 ? [...x].map((c) => c + c).join('') : x.slice(0, 6);
    return [0, 2, 4].map((i) => Number.parseInt(t.slice(i, i + 2), 16) || 0);
  };
  const [p, q] = [hex(a), hex(b)];
  return `#${p
    .map((v, i) => Math.round(v * oran + (q[i] as number) * (1 - oran)))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`;
}

const OLCU = {
  /** Talep sayfasının üstü */
  buyuk: { marka: 11, seri: 26, alt: 12, harf: 150, bosluk: 14 },
  /** Vitrin kartı */
  kart: { marka: 8.5, seri: 13, alt: 9, harf: 70, bosluk: 7 },
  /** Son talepler satırındaki kare görsel */
  mini: { marka: 7.5, seri: 11.5, alt: 0, harf: 54, bosluk: 6 },
} as const;

/**
 * Marka ve model kapağı (sahip isteği, 17 Kasım 2026): katalogda aracın fotoğrafı seçilene kadar görsel alanı boş
 * kalmaz; markanın renginde (marka adından sabit ton) büyük harfler ve araç adıyla dolu bir kapak. Web'deki
 * `AracKapak` ile aynı kural. Bulunduğu kutuyu doldurur.
 */
export function AracKapak({
  marka,
  seri,
  bilgi = [],
  boyut = 'kart',
}: {
  marka?: string | null;
  seri?: string | null;
  /** Yıllar, kasa ve paket: büyük kapakta etiket, kartta tek satır */
  bilgi?: readonly (string | null | undefined)[];
  boyut?: keyof typeof OLCU;
}) {
  const renk = colors[kapakTonu(marka ?? seri)];
  const acik = karistir(renk, colors.surface, 0.14);
  const orta = karistir(renk, colors.surface, 0.38);
  const o = OLCU[boyut];
  const harf = kapakHarfleri(marka) || kapakHarfleri(seri);
  const ad = [marka, seri].filter(Boolean).join(' ');
  const satir = bilgi.filter((x): x is string => Boolean(x));
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={ad ? `${ad} kapak görseli` : 'Araç kapak görseli'}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: acik,
        overflow: 'hidden',
      }}
    >
      {/* Köşeden yükselen koyu ton ve yol çizgileri: kapağı boş göstermeyen hafif desen */}
      <View
        style={{
          position: 'absolute',
          width: '150%',
          height: '150%',
          left: '35%',
          top: '20%',
          backgroundColor: orta,
          opacity: 0.7,
          transform: [{ rotate: '-14deg' }],
        }}
      />
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: '-30%',
            bottom: '-30%',
            left: `${48 + i * 13}%`,
            width: 1.5,
            backgroundColor: renk,
            opacity: 0.18,
            transform: [{ rotate: '-14deg' }],
          }}
        />
      ))}
      {harf ? (
        <T
          numberOfLines={1}
          style={{
            position: 'absolute',
            right: -o.harf * 0.04,
            bottom: -o.harf * 0.26,
            fontSize: o.harf,
            lineHeight: o.harf * 1.1,
            fontWeight: '800',
            letterSpacing: -o.harf * 0.04,
            color: renk,
            opacity: 0.45,
          }}
        >
          {harf}
        </T>
      ) : null}
      <View style={{ position: 'absolute', left: o.bosluk + 1, right: o.bosluk, bottom: o.bosluk }}>
        {marka ? (
          <T
            numberOfLines={1}
            style={{
              fontSize: o.marka,
              fontWeight: '800',
              letterSpacing: o.marka * 0.08,
              color: colors.muted,
            }}
          >
            {marka.toUpperCase()}
          </T>
        ) : null}
        <T
          numberOfLines={2}
          style={{
            fontSize: o.seri,
            lineHeight: o.seri * 1.15,
            fontWeight: '800',
            color: colors.ink,
            marginTop: 1,
          }}
        >
          {seri ?? marka ?? 'Araç'}
        </T>
        {satir.length && boyut === 'buyuk' ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8, paddingRight: '22%' }}>
            {satir.map((x) => (
              <T
                key={x}
                style={{
                  fontSize: o.alt,
                  fontWeight: '700',
                  color: colors.ink,
                  backgroundColor: colors.surface,
                  opacity: 0.92,
                  paddingVertical: 3,
                  paddingHorizontal: 8,
                  borderRadius: Math.min(radii.etiket, 10),
                  overflow: 'hidden',
                }}
              >
                {x}
              </T>
            ))}
          </View>
        ) : satir.length && o.alt ? (
          <T
            numberOfLines={2}
            style={{
              fontSize: o.alt,
              lineHeight: o.alt * 1.3,
              fontWeight: '700',
              color: colors.inkSoft,
              marginTop: 2,
            }}
          >
            {satir.join(' · ')}
          </T>
        ) : null}
      </View>
    </View>
  );
}
