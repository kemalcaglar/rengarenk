import { ACIKLAMA_BOYUTLARI, ACIKLAMA_RENKLERI, aciklamaParcala } from '@rengarenk/shared';
import type { CSSProperties } from 'react';

/**
 * Biçimli talep açıklaması (sahip isteği, 17 Kasım 2026; etiketler `packages/shared/src/aciklama.ts`). Metin React
 * ile yazılır (HTML çalışmaz). `sabit`: talep sayfasında alan uzayabileceği için yükseklik sabittir, fazlası yandaki
 * kaydırma çubuğuyla ya da fareyle kaydırılır.
 */
export function AciklamaGoster({
  metin,
  sabit = false,
  style,
}: {
  metin: string;
  sabit?: boolean;
  style?: CSSProperties;
}) {
  // Kaydırılan bölgeye klavyeyle de ulaşılsın
  const kaydir = sabit
    ? { role: 'region' as const, tabIndex: 0, 'aria-label': 'Açıklama (kaydırılabilir)' }
    : {};
  return (
    <div
      {...kaydir}
      style={{
        margin: 0,
        fontSize: 15,
        lineHeight: 1.65,
        color: '#2E3344',
        whiteSpace: 'pre-line',
        overflowWrap: 'anywhere',
        ...(sabit
          ? {
              maxHeight: 300,
              overflowY: 'auto',
              paddingRight: 8,
              overscrollBehavior: 'contain',
            }
          : {}),
        ...style,
      }}
    >
      {aciklamaParcala(metin).map((p, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: parçalar metnin sırasıdır
          key={i}
          style={{
            fontWeight: p.kalin || p.boyut === 'baslik' ? 700 : undefined,
            fontStyle: p.italik ? 'italic' : undefined,
            color: p.renk ? ACIKLAMA_RENKLERI[p.renk].hex : undefined,
            fontSize: p.boyut ? `${ACIKLAMA_BOYUTLARI[p.boyut].oran}em` : undefined,
            lineHeight: p.boyut ? 1.45 : undefined,
          }}
        >
          {p.metin}
        </span>
      ))}
    </div>
  );
}
