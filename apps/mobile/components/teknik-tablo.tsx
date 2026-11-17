import { colors, TEKNIK_KAYNAK, type TeknikOzet, teknikBolumleri } from '@rengarenk/shared';
import { useState } from 'react';
import { View } from 'react-native';
import { T } from './t';
import { Cip } from './talep/ortak';

/**
 * Talep sayfasında aracın ayrıntılı teknik özellikleri (sahip isteği, 17 Kasım 2026; web `TeknikTablo` ile aynı):
 * motor sürümü başına bölüm bölüm (motor, performans, şanzıman ve çekiş, tüketim ve emisyon, ölçüler ve ağırlık,
 * lastik ve fren). Değerler Türkiye'de satılan sürümlerle eşleşen kayıtlardan; sürümler arasında farklıysa aralık.
 */
export function TeknikTablo({
  motorlar,
  not,
}: {
  motorlar: { ad: string; ozet: TeknikOzet }[];
  /** Başlık altı açıklama (ör. "G20 makyajsız kasa, 2019–2022") */
  not?: string | null;
}) {
  const [secili, setSecili] = useState(0);
  if (!motorlar.length) {
    return (
      <T style={{ fontSize: 14, lineHeight: 20, color: colors.muted }}>
        Bu araç için katalogda teknik bilgi bulunamadı. Motor ya da kasa seçilince ayrıntı genişler.
      </T>
    );
  }
  const sira = Math.min(secili, motorlar.length - 1);
  const m = motorlar[sira] as (typeof motorlar)[number];
  const bolumler = teknikBolumleri(m.ozet);
  return (
    <View>
      {motorlar.length > 1 ? (
        <View
          accessibilityLabel="Motor seçenekleri"
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}
        >
          {motorlar.map((x, i) => (
            <Cip key={x.ad} on={i === sira} onPress={() => setSecili(i)}>
              {x.ad}
            </Cip>
          ))}
        </View>
      ) : (
        <T style={{ fontSize: 15, fontWeight: '800' }}>{m.ad}</T>
      )}
      {not ? (
        <T style={{ fontSize: 12.5, color: colors.muted, marginTop: 8, lineHeight: 17 }}>{not}</T>
      ) : null}
      {bolumler.map((b) => (
        <View key={b.baslik} accessibilityLabel={b.baslik} style={{ marginTop: 16 }}>
          <T
            accessibilityRole="header"
            style={{
              fontSize: 12.5,
              fontWeight: '800',
              letterSpacing: 0.3,
              color: colors.muted,
              marginBottom: 4,
            }}
          >
            {/* Türkçe büyük harf ("çekiş" → "ÇEKİŞ"); textTransform dile göre çevirmez */}
            {b.baslik.toLocaleUpperCase('tr-TR')}
          </T>
          {b.satirlar.map(([etiket, deger]) => (
            <View
              key={etiket}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                gap: 12,
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderBottomColor: colors.line,
              }}
            >
              <T style={{ fontSize: 13.5, color: colors.muted }}>{etiket}</T>
              <T style={{ flex: 1, fontSize: 13.5, fontWeight: '700', textAlign: 'right' }}>{deger}</T>
            </View>
          ))}
        </View>
      ))}
      <T style={{ fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 14 }}>
        {TEKNIK_KAYNAK}. Değerler pakete ve model yılına göre değişebilir.
      </T>
    </View>
  );
}
