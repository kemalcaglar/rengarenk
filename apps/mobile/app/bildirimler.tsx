import { colors } from '@rengarenk/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BosDurum } from '../components/bos-durum';
import { Ikon } from '../components/ikon';
import { T } from '../components/t';
import { bildirimAc } from '../lib/bildirim';
import { useCanli } from '../lib/canli';
import { useOturum } from '../lib/oturum';

interface Bildirim {
  id: string;
  grup: string;
  ikon: string;
  tint: string;
  baslik: string;
  metin: string;
  url: string | null;
  ticari: boolean;
  okundu: boolean;
  zaman: string;
}

const FILTRELER = [
  ['hepsi', 'Tümü'],
  ['mesaj', 'Mesajlar'],
  ['talep', 'Taleplerim'],
] as const;
const DAY = 86_400_000;
const once = (iso: string) => {
  const dk = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (dk < 1) return 'şimdi';
  if (dk < 60) return `${dk} dk`;
  if (dk < 24 * 60) return `${Math.floor(dk / 60)} sa`;
  if (dk < 48 * 60) return 'Dün';
  return `${Math.floor(dk / (24 * 60))} gün`;
};

/**
 * Bildirimler (tasarım: AnasayfaMobil, v.bildirim; Karar 48): geri, başlık, "Tümünü okundu say", süzgeçler, Bugün ve
 * Bu hafta grupları, okunmamış vurgusu, kampanyada "onay verdiğin için" etiketi. Dokununca okundu sayılır ve ilgili
 * ekran açılır. Tasarıma ek: bir haftadan eski bildirimler "Daha önce" grubunda.
 */
export default function Bildirimler() {
  const { durum, istek } = useOturum();
  const [filtre, setFiltre] = useState<'hepsi' | 'mesaj' | 'talep'>('hepsi');
  const [liste, setListe] = useState<Bildirim[] | null>(null);

  const yukle = useCallback(async () => {
    const r = await istek<{ bildirimler: Bildirim[] }>(
      `/notifications${filtre === 'hepsi' ? '' : `?grup=${filtre}`}`,
    );
    setListe(r.bildirimler);
  }, [istek, filtre]);
  useFocusEffect(
    useCallback(() => {
      if (durum === 'uye') yukle().catch(() => setListe([]));
    }, [durum, yukle]),
  );
  useCanli((o) => {
    if (o.tip === 'bildirim') yukle().catch(() => undefined);
  });

  async function ac(b: Bildirim) {
    if (!b.okundu)
      await istek('/notifications/read', { method: 'POST', body: { ids: [b.id] } }).catch(() => undefined);
    setListe((l) => (l ?? []).map((x) => (x.id === b.id ? { ...x, okundu: true } : x)));
    bildirimAc(b.url);
  }

  const bugun = new Date();
  bugun.setHours(0, 0, 0, 0);
  const b0 = bugun.getTime();
  const gruplar = [
    ['Bugün', (t: number) => t >= b0],
    ['Bu hafta', (t: number) => t < b0 && t >= b0 - 6 * DAY],
    ['Daha önce', (t: number) => t < b0 - 6 * DAY],
  ] as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <View
        style={{
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
          paddingVertical: 10,
          paddingHorizontal: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Geri"
          onPress={() => router.back()}
          style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ikon d="geri" />
        </Pressable>
        <T accessibilityRole="header" style={{ flex: 1, fontSize: 18, fontWeight: '800' }}>
          Bildirimler
        </T>
        <Pressable
          accessibilityRole="button"
          onPress={async () => {
            await istek('/notifications/read', { method: 'POST', body: { hepsi: true } }).catch(
              () => undefined,
            );
            setListe((l) => (l ?? []).map((x) => ({ ...x, okundu: true })));
          }}
          style={{ paddingVertical: 10, paddingHorizontal: 6 }}
        >
          <T style={{ fontSize: 13.5, fontWeight: '700', color: colors.link }}>Tümünü okundu say</T>
        </Pressable>
      </View>
      <View
        style={{
          flexDirection: 'row',
          gap: 6,
          paddingTop: 12,
          paddingHorizontal: 12,
          paddingBottom: 4,
          backgroundColor: colors.background,
        }}
      >
        {FILTRELER.map(([k, ad]) => {
          const on = k === filtre;
          return (
            <Pressable
              key={k}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => setFiltre(k)}
              style={{
                borderWidth: on ? 0 : 1,
                borderColor: '#D5DAE5',
                backgroundColor: on ? colors.ink : colors.surface,
                borderRadius: 999,
                paddingVertical: on ? 9 : 8,
                paddingHorizontal: on ? 14 : 13,
              }}
            >
              <T
                style={{ fontSize: 13.5, fontWeight: on ? '800' : '700', color: on ? '#FFFFFF' : colors.ink }}
              >
                {ad}
              </T>
            </Pressable>
          );
        })}
      </View>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingTop: 8, paddingHorizontal: 12, paddingBottom: 40 }}
      >
        {liste === null ? (
          <ActivityIndicator color={colors.blue} style={{ marginTop: 24 }} />
        ) : !liste.length ? (
          <BosDurum
            baslik="Henüz bildirimin yok"
            metin="Talebine mesaj geldiğinde ve talebinin süresi dolarken burada görürsün."
          />
        ) : (
          gruplar.map(([ad, kosul]) => {
            const ogeler = liste.filter((b) => kosul(new Date(b.zaman).getTime()));
            if (!ogeler.length) return null;
            return (
              <View key={ad}>
                <T
                  accessibilityRole="header"
                  style={{
                    marginTop: 14,
                    marginBottom: 8,
                    marginHorizontal: 4,
                    fontSize: 13,
                    fontWeight: '800',
                    color: colors.muted,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  {ad}
                </T>
                <View
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.line,
                    borderRadius: 16,
                    overflow: 'hidden',
                  }}
                >
                  {ogeler.map((b) => (
                    <Pressable
                      key={b.id}
                      accessibilityRole="button"
                      onPress={() => ac(b)}
                      style={{
                        flexDirection: 'row',
                        gap: 12,
                        paddingVertical: 13,
                        paddingHorizontal: 14,
                        borderBottomWidth: 1,
                        borderBottomColor: '#EEF0F5',
                        backgroundColor: b.okundu ? colors.surface : '#F8FAFF',
                      }}
                    >
                      <View
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 12,
                          backgroundColor: b.tint,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <T style={{ fontSize: 16 }}>{b.ikon}</T>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                          <T style={{ flex: 1, fontSize: 14, fontWeight: b.okundu ? '700' : '800' }}>
                            {b.baslik}
                          </T>
                          <T style={{ fontSize: 11.5, color: colors.muted }}>{once(b.zaman)}</T>
                        </View>
                        <T style={{ fontSize: 12.5, color: colors.inkSoft, marginTop: 3, lineHeight: 18 }}>
                          {b.metin}
                        </T>
                        {b.ticari ? (
                          <View
                            style={{
                              alignSelf: 'flex-start',
                              marginTop: 5,
                              paddingVertical: 2,
                              paddingHorizontal: 7,
                              borderRadius: 999,
                              backgroundColor: '#F3F5FA',
                            }}
                          >
                            <T style={{ fontSize: 11, fontWeight: '800', color: colors.muted }}>
                              Kampanya · onay verdiğin için
                            </T>
                          </View>
                        ) : null}
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
