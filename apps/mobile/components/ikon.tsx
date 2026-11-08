import Svg, { Path } from 'react-native-svg';

/** Tasarımdaki çizgi ikonları (AnasayfaMobil, HesapMobil): 24 birimlik görüş alanı, yuvarlak uçlar. */
export const IKON = {
  ana: 'M4 11l8-7 8 7v9h-5v-6h-6v6H4z',
  talepler: 'M8 4h8M6 8h12M5 12h14v8H5z',
  arti: 'M12 5v14M5 12h14',
  mesaj: 'M4 5h16v11H9l-5 4z',
  hesap: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  zil: 'M6 9a6 6 0 1 1 12 0c0 6 2 7 2 7H4s2-1 2-7M10 20a2 2 0 0 0 4 0',
  ara: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5',
  kapat: 'M6 6l12 12M18 6L6 18',
  geri: 'M15 5l-7 7 7 7',
  onay: 'M5 12l5 5 9-10',
  kalp: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
} as const;

export function Ikon({
  d,
  size = 22,
  color = '#1E2333',
  width = 2.2,
  fill = 'none',
}: {
  d: keyof typeof IKON;
  size?: number;
  color?: string;
  width?: number;
  /** Dolu ikon (ör. favorideki kalp) */
  fill?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      <Path
        d={IKON[d]}
        fill={fill}
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
