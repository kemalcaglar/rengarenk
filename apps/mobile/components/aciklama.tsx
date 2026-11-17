import { ACIKLAMA_BOYUTLARI, ACIKLAMA_RENKLERI, aciklamaParcala } from '@rengarenk/shared';
import { ScrollView } from 'react-native';
import { T } from './t';

const YAZI = '#2E3344';

/**
 * Biçimli talep açıklaması (sahip isteği, 17 Kasım 2026; etiketler `packages/shared/src/aciklama.ts`). Parçalar iç
 * içe metin olarak yazılır (işaret çalışmaz). `sabit`: talep sayfasında alan uzayabileceği için yükseklik sabittir,
 * fazlası kaydırılır (sayfanın kaydırmasının içinde de çalışır).
 */
export function AciklamaGoster({
  metin,
  sabit = false,
  boyut = 14.5,
  yukseklik = 280,
}: {
  metin: string;
  sabit?: boolean;
  /** Normal yazının boyutu */
  boyut?: number;
  /** `sabit` iken en çok yükseklik */
  yukseklik?: number;
}) {
  const parcalar = aciklamaParcala(metin);
  // Boyutlu parça varsa satır yüksekliği her satırın en büyük yazısına göre kendiliğinden ayarlanır
  const boyutlu = parcalar.some((p) => p.boyut);
  const yazi = (
    <T style={{ fontSize: boyut, lineHeight: boyutlu ? undefined : boyut * 1.52, color: YAZI }}>
      {parcalar.map((p, i) => (
        <T
          // biome-ignore lint/suspicious/noArrayIndexKey: parçalar metnin sırasıdır
          key={i}
          style={{
            color: p.renk ? ACIKLAMA_RENKLERI[p.renk].hex : YAZI,
            fontWeight: p.kalin || p.boyut === 'baslik' ? '700' : undefined,
            fontStyle: p.italik ? 'italic' : undefined,
            fontSize: p.boyut ? boyut * ACIKLAMA_BOYUTLARI[p.boyut].oran : boyut,
          }}
        >
          {p.metin}
        </T>
      ))}
    </T>
  );
  if (!sabit) return yazi;
  return (
    <ScrollView
      accessibilityLabel="Açıklama (kaydırılabilir)"
      style={{ maxHeight: yukseklik }}
      contentContainerStyle={{ paddingRight: 6 }}
      nestedScrollEnabled
      persistentScrollbar
    >
      {yazi}
    </ScrollView>
  );
}
