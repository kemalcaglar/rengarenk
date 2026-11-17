import {
  colors,
  kartOran,
  radii,
  SIHIRBAZ_TANITIM,
  type SihirbazAdimi,
  TANITIM_ANAHTARLARI,
  tanitimAnahtari,
} from '@rengarenk/shared';
import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useOturum } from '../../lib/oturum';
import { T } from '../t';

/**
 * Sihirbaz adımlarının tanıtımı (sahip isteği, 17 Kasım 2026; web `SihirbazTanitimi` ile aynı): üye bir adıma ilk kez
 * geldiğinde o adımı anlatan pencere açılır; "Anladım" denince sunucuya yazılır (`POST /me/tanitim`) ve bir daha
 * gösterilmez (her cihazda). Görülenler okunamazsa gösterilmez (sihirbazı engellemesin).
 */
export function SihirbazTanitimi({
  adim,
  sira,
  toplam,
  acik,
}: {
  adim: SihirbazAdimi;
  sira: number;
  toplam: number;
  /** Sihirbaz hazır (taslak yüklendi ya da kategori adımı) */
  acik: boolean;
}) {
  const { durum, istek } = useOturum();
  const [gorulen, setGorulen] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (durum !== 'uye') return;
    istek<{ tanitim?: string[] }>('/me')
      .then((m) => setGorulen(new Set(m.tanitim ?? [])))
      .catch(() => setGorulen(new Set(TANITIM_ANAHTARLARI)));
  }, [durum, istek]);

  const anahtar = tanitimAnahtari(adim);
  const goster = acik && gorulen !== null && !gorulen.has(anahtar);
  const t = SIHIRBAZ_TANITIM[adim];
  const kapat = () => {
    setGorulen((g) => new Set([...(g ?? []), anahtar]));
    istek('/me/tanitim', { method: 'POST', body: { anahtar } }).catch(() => undefined);
  };

  return (
    <Modal visible={goster} transparent animationType="fade" onRequestClose={kapat}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(30, 35, 51, 0.45)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            width: '100%',
            maxWidth: 460,
            backgroundColor: colors.surface,
            borderRadius: kartOran(20),
            paddingTop: 22,
            paddingHorizontal: 20,
            paddingBottom: 18,
          }}
        >
          <T
            style={{
              alignSelf: 'flex-start',
              fontSize: 12.5,
              fontWeight: '800',
              color: colors.onBlue,
              backgroundColor: colors.blue,
              borderRadius: radii.etiket,
              overflow: 'hidden',
              paddingVertical: 4,
              paddingHorizontal: 10,
            }}
          >
            Adım {sira} / {toplam}
          </T>
          <T
            accessibilityRole="header"
            style={{ marginTop: 14, marginBottom: 8, fontSize: 20, fontWeight: '800' }}
          >
            {t.baslik}
          </T>
          <T style={{ fontSize: 14.5, lineHeight: 22, color: colors.muted }}>{t.metin}</T>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20 }}>
            <Pressable
              accessibilityRole="button"
              onPress={kapat}
              style={{
                backgroundColor: colors.blue,
                borderRadius: radii.buton,
                paddingVertical: 12,
                paddingHorizontal: 24,
              }}
            >
              <T style={{ color: colors.onBlue, fontSize: 15, fontWeight: '800' }}>Anladım</T>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
