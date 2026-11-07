/** Gökkuşağı paleti ve temel renkler (tasarım dosyasıyla aynı). */
export const colors = {
  blue: '#5B8CFF',
  pink: '#FF6FB5',
  yellow: '#FFC84A',
  green: '#3DD68C',
  purple: '#A78BFA',
  orange: '#FF8A5B',
  ink: '#1E2333',
  inkSoft: '#3A4052',
  muted: '#5A6073',
  line: '#E3E6EF',
  surface: '#FFFFFF',
  background: '#F6F8FD',
  link: '#2450C8',
} as const;

export const fontFamily = "'Plus Jakarta Sans', system-ui, sans-serif";

/** Gökkuşağı açık zeminleri (adım kartları, kayıtlı arama rozetleri; tasarım: TINTS) */
export const tints = { blue: '#EEF3FF', pink: '#FFEEF6', yellow: '#FFF6DF', green: '#E7FAF0' } as const;

/** Kategori ve liste noktaları: tasarımdaki sırayla altı renk döner (Anasayfa.dc.html, DOTS). */
export const DOTS = [
  colors.blue,
  colors.pink,
  colors.yellow,
  colors.green,
  colors.purple,
  colors.orange,
] as const;
export const dotColor = (index: number) => DOTS[index % DOTS.length] as string;
