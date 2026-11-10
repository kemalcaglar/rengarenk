import { colors, LEGAL_PATHS, type PendingLegal } from '@rengarenk/shared';
import { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, View } from 'react-native';
import { useOturum } from '../lib/oturum';
import { T } from './t';

const WEB = process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:3000';

/**
 * Yasal metin güncellemesi (Karar 46): esaslı değişiklikten sonra girişte yeni sürüm onaylatılır (web ile aynı kural).
 * Zorunlu metinler kabul edilmeden devam edilemez; isteğe bağlı rızalar yeniden seçilir.
 */
export function YasalOnay() {
  const { durum, istek, cikis } = useOturum();
  const [liste, setListe] = useState<PendingLegal[]>([]);
  const [kabul, setKabul] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    if (durum !== 'uye') return;
    istek<PendingLegal[]>('/me/legal/pending')
      .then((l) => {
        setListe(l);
        setKabul(Object.fromEntries(l.map((x) => [x.key, x.zorunlu ? false : Boolean(x.onceki)])));
      })
      .catch(() => undefined);
  }, [durum, istek]);

  if (durum !== 'uye' || !liste.length) return null;
  const hazir = liste.every((x) => !x.zorunlu || kabul[x.key]);

  async function gonder() {
    setBusy(true);
    setHata(null);
    try {
      setListe(
        await istek<PendingLegal[]>('/me/legal/accept', {
          method: 'POST',
          body: {
            onaylar: liste.map((x) => ({ key: x.key, version: x.version, granted: Boolean(kabul[x.key]) })),
          },
        }),
      );
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const secenek = (secili: boolean, yazi: string, bas: () => void, kutu = false) => (
    <Pressable
      accessibilityRole={kutu ? 'checkbox' : 'radio'}
      accessibilityState={kutu ? { checked: secili } : { selected: secili }}
      onPress={bas}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: kutu ? 6 : 10,
          borderWidth: 2,
          borderColor: secili ? colors.blue : '#AEB5C4',
          backgroundColor: secili ? colors.blue : colors.surface,
        }}
      />
      <T style={{ fontSize: 14 }}>{yazi}</T>
    </Pressable>
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => undefined}>
      <View
        style={{ flex: 1, backgroundColor: 'rgba(30,35,51,0.45)', justifyContent: 'center', padding: 16 }}
        accessibilityViewIsModal
      >
        <View style={{ backgroundColor: colors.surface, borderRadius: 18, maxHeight: '90%' }}>
          <ScrollView contentContainerStyle={{ padding: 18 }}>
            <T accessibilityRole="header" style={{ fontSize: 19, fontWeight: '800' }}>
              Metinlerimizi güncelledik
            </T>
            <T
              style={{ fontSize: 13.5, color: colors.muted, marginTop: 4, marginBottom: 12, lineHeight: 19 }}
            >
              Devam etmeden önce güncel sürümleri okuyup onaylaman gerekiyor. Hangi sürümü ne zaman
              onayladığın kaydedilir.
            </T>
            {liste.map((x) => (
              <View
                key={x.key}
                style={{
                  borderWidth: 1,
                  borderColor: colors.line,
                  borderRadius: 14,
                  padding: 12,
                  marginBottom: 10,
                }}
              >
                <T style={{ fontSize: 15, fontWeight: '800' }}>
                  {x.ad} · s.{x.version}
                </T>
                <T style={{ fontSize: 12.5, color: colors.inkSoft, marginTop: 3 }}>Neler değişti: {x.ozet}</T>
                <T
                  accessibilityRole="link"
                  onPress={() => Linking.openURL(`${WEB}/${LEGAL_PATHS[x.key]}`)}
                  style={{ fontSize: 13.5, fontWeight: '700', color: colors.link, marginTop: 6 }}
                >
                  Metni oku
                </T>
                {x.zorunlu
                  ? secenek(
                      Boolean(kabul[x.key]),
                      'Okudum, kabul ediyorum',
                      () => setKabul((k) => ({ ...k, [x.key]: !k[x.key] })),
                      true,
                    )
                  : [true, false].map((v) => (
                      <View key={String(v)}>
                        {secenek(Boolean(kabul[x.key]) === v, v ? 'Onay veriyorum' : 'Onay vermiyorum', () =>
                          setKabul((k) => ({ ...k, [x.key]: v })),
                        )}
                      </View>
                    ))}
              </View>
            ))}
            {hata ? (
              <T accessibilityRole="alert" style={{ color: '#A3271F', fontSize: 13.5, marginBottom: 6 }}>
                {hata}
              </T>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={!hazir || busy}
              onPress={() => void gonder()}
              style={{
                backgroundColor: hazir ? colors.blue : '#C9D3E6',
                borderRadius: 12,
                paddingVertical: 13,
                alignItems: 'center',
                marginTop: 4,
              }}
            >
              <T style={{ fontSize: 15, fontWeight: '800' }}>
                {busy ? 'Kaydediliyor…' : 'Onayla ve devam et'}
              </T>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => void cikis()}
              style={{ paddingVertical: 12, alignItems: 'center' }}
            >
              <T style={{ fontSize: 14, fontWeight: '700', color: colors.muted }}>Çıkış yap</T>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
