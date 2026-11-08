import {
  colors,
  HELP_TOPICS,
  SUPPORT_TOPIC_KEYS,
  SUPPORT_TOPICS,
  type SupportTopic,
} from '@rengarenk/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ikon } from '../components/ikon';
import { T, TInput } from '../components/t';
import { useOturum } from '../lib/oturum';

interface Talep {
  no: number;
  numara: string;
  konu: string;
  ozet: string;
  durumAd: string;
  okunmamis: boolean;
}

const kart = {
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.line,
  borderRadius: 18,
} as const;

/**
 * Yardım ve destek (web: Yardim.dc.html; Karar 54): konular ve sık sorulanlar, güvenli alışveriş, destek talebi ve
 * destek taleplerim. Destek yalnızca yazılıdır; yanıt bildirim ve e-postayla gelir.
 */
export default function Yardim() {
  const { durum, istek } = useOturum();
  const [konu, setKonu] = useState<string>(HELP_TOPICS[0].key);
  const [acik, setAcik] = useState(0);
  const [talepler, setTalepler] = useState<Talep[]>([]);
  const [form, setForm] = useState<{ konu: SupportTopic; referans: string; metin: string }>({
    konu: 'odeme',
    referans: '',
    metin: '',
  });
  const [gonderildi, setGonderildi] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (durum !== 'uye') return;
      istek<Talep[]>('/support/tickets')
        .then(setTalepler)
        .catch(() => undefined);
    }, [durum, istek]),
  );

  async function gonder() {
    if (form.metin.trim().length < 10) {
      setHata('Açıklamayı en az 10 karakterle yaz.');
      return;
    }
    setHata(null);
    try {
      const r = await istek<{ no: number; numara: string }>('/support/tickets', {
        method: 'POST',
        body: {
          konu: form.konu,
          metin: form.metin.trim(),
          ...(form.referans.trim() ? { referans: form.referans.trim() } : {}),
        },
      });
      setGonderildi(r.numara);
      setForm({ ...form, metin: '', referans: '' });
      setTalepler(await istek<Talep[]>('/support/tickets'));
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  const k = HELP_TOPICS.find((x) => x.key === konu) ?? HELP_TOPICS[0];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <View
        style={{
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
          Yardım ve destek
        </T>
      </View>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 12, paddingBottom: 40, gap: 12 }}
        keyboardShouldPersistTaps="handled"
      >
        {talepler.length ? (
          <View style={kart}>
            <T style={{ fontSize: 15, fontWeight: '800', padding: 14, paddingBottom: 6 }}>
              Destek taleplerim
            </T>
            {talepler.map((t) => (
              <Pressable
                key={t.no}
                accessibilityRole="button"
                onPress={() => router.push(`/destek/${t.no}`)}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderTopWidth: 1,
                  borderTopColor: '#EEF0F5',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <T style={{ fontSize: 12, fontWeight: '800', color: colors.muted }}>
                    {t.numara} · {t.konu}
                  </T>
                  <T
                    style={{
                      fontSize: 12,
                      fontWeight: '800',
                      color: t.okunmamis ? colors.link : colors.muted,
                    }}
                  >
                    {t.okunmamis ? 'Yeni yanıt' : t.durumAd}
                  </T>
                </View>
                <T
                  numberOfLines={1}
                  style={{ fontSize: 14, fontWeight: t.okunmamis ? '800' : '600', marginTop: 3 }}
                >
                  {t.ozet}
                </T>
              </Pressable>
            ))}
          </View>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {HELP_TOPICS.map((t) => {
            const on = t.key === konu;
            return (
              <Pressable
                key={t.key}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => {
                  setKonu(t.key);
                  setAcik(0);
                }}
                style={{
                  width: 170,
                  backgroundColor: colors.surface,
                  borderWidth: on ? 2 : 1,
                  borderColor: on ? t.renk : colors.line,
                  borderRadius: 16,
                  padding: on ? 13 : 14,
                }}
              >
                <View
                  style={{ width: 32, height: 5, borderRadius: 3, backgroundColor: t.renk, marginBottom: 10 }}
                />
                <T style={{ fontSize: 14.5, fontWeight: '800' }}>{t.ad}</T>
                <T style={{ fontSize: 12, color: colors.muted, marginTop: 3 }}>{t.not}</T>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={kart}>
          <T
            accessibilityRole="header"
            style={{ fontSize: 16, fontWeight: '800', padding: 16, paddingBottom: 8 }}
          >
            {k.ad} · sık sorulanlar
          </T>
          {k.sorular.map(([s, c], i) => {
            const on = acik === i;
            return (
              <View key={s} style={{ borderTopWidth: 1, borderTopColor: '#EEF0F5' }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: on }}
                  onPress={() => setAcik(on ? -1 : i)}
                  style={{
                    flexDirection: 'row',
                    gap: 10,
                    alignItems: 'center',
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                  }}
                >
                  <T style={{ flex: 1, fontSize: 14.5, fontWeight: '700' }}>{s}</T>
                  <T style={{ fontSize: 20, fontWeight: '600', color: colors.muted }}>{on ? '−' : '+'}</T>
                </Pressable>
                {on ? (
                  <T
                    style={{
                      paddingHorizontal: 16,
                      paddingBottom: 16,
                      fontSize: 14,
                      lineHeight: 22,
                      color: '#2E3344',
                    }}
                  >
                    {c}
                  </T>
                ) : null}
              </View>
            );
          })}
        </View>

        <View
          style={{
            backgroundColor: '#FFF6DF',
            borderWidth: 1,
            borderColor: '#F4DC9A',
            borderRadius: 18,
            padding: 16,
          }}
        >
          <T style={{ fontSize: 16, fontWeight: '800', marginBottom: 8 }}>Güvenli alışveriş için</T>
          {[
            'Aracı görmeden kapora, ön ödeme veya “rezervasyon ücreti” gönderme.',
            'Mesajla gelen ödeme linklerine tıklama; Rengarenk senden mesajla ödeme istemez.',
            'Satışı noterde yap, ödemeyi satış anında güvenli ödeme sistemiyle tamamla.',
            'Ekspertiz raporunu kendin seçtiğin bir yerde yaptır.',
          ].map((m) => (
            <T key={m} style={{ fontSize: 13.5, lineHeight: 20, color: '#2E3344', marginBottom: 4 }}>
              • {m}
            </T>
          ))}
        </View>

        <View style={{ ...kart, padding: 16 }}>
          <T accessibilityRole="header" style={{ fontSize: 16, fontWeight: '800' }}>
            Destek talebi oluştur
          </T>
          {durum !== 'uye' ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/giris')}
              style={{ marginTop: 8 }}
            >
              <T style={{ fontSize: 14, fontWeight: '700', color: colors.link }}>
                Destek talebi için giriş yap
              </T>
            </Pressable>
          ) : (
            <>
              <T style={{ fontSize: 12.5, color: colors.muted, marginTop: 2, marginBottom: 10 }}>
                Genellikle 1 iş günü içinde yanıtlıyoruz.
              </T>
              {gonderildi ? (
                <View style={{ backgroundColor: '#E7FAF0', borderRadius: 12, padding: 12, marginBottom: 10 }}>
                  <T style={{ fontSize: 13.5, fontWeight: '800', color: '#11683F' }}>
                    Destek talebin alındı · No {gonderildi}
                  </T>
                  <T style={{ fontSize: 13, color: '#11683F', marginTop: 2 }}>
                    Yanıtımız hem e-postana hem de bildirimlerine gelecek.
                  </T>
                </View>
              ) : null}
              <T style={{ fontSize: 13, fontWeight: '700' }}>Konu</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {SUPPORT_TOPIC_KEYS.map((t) => {
                  const on = form.konu === t;
                  return (
                    <Pressable
                      key={t}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      onPress={() => setForm({ ...form, konu: t })}
                      style={{
                        borderWidth: 1.5,
                        borderColor: on ? colors.blue : '#D5DAE5',
                        backgroundColor: on ? '#EEF3FF' : colors.surface,
                        borderRadius: 999,
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                      }}
                    >
                      <T style={{ fontSize: 13, fontWeight: '700' }}>{SUPPORT_TOPICS[t].ad}</T>
                    </Pressable>
                  );
                })}
              </View>
              <T style={{ fontSize: 13, fontWeight: '700', marginTop: 12 }}>Talep veya ödeme no (varsa)</T>
              <TInput
                value={form.referans}
                onChangeText={(v) => setForm({ ...form, referans: v })}
                maxLength={40}
                accessibilityLabel="Talep veya ödeme no"
                style={{
                  marginTop: 6,
                  borderWidth: 1,
                  borderColor: '#D5DAE5',
                  borderRadius: 10,
                  padding: 11,
                  fontSize: 14.5,
                }}
              />
              <T style={{ fontSize: 13, fontWeight: '700', marginTop: 12 }}>Açıklama</T>
              <TInput
                value={form.metin}
                onChangeText={(v) => setForm({ ...form, metin: v })}
                multiline
                maxLength={2000}
                accessibilityLabel="Açıklama"
                style={{
                  marginTop: 6,
                  borderWidth: 1,
                  borderColor: '#D5DAE5',
                  borderRadius: 10,
                  padding: 11,
                  minHeight: 100,
                  fontSize: 14.5,
                  textAlignVertical: 'top',
                }}
              />
              {hata ? (
                <T accessibilityRole="alert" style={{ marginTop: 8, color: '#A3271F', fontWeight: '700' }}>
                  {hata}
                </T>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={gonder}
                style={{
                  marginTop: 12,
                  backgroundColor: colors.blue,
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: 'center',
                }}
              >
                <T style={{ fontSize: 15, fontWeight: '800' }}>Gönder</T>
              </Pressable>
            </>
          )}
        </View>
        <T style={{ fontSize: 12.5, color: colors.muted, paddingHorizontal: 4 }}>
          Acil bir dolandırıcılık durumunda önce bankanı ara, sonra mesajı “Şikayet et” ile bize bildir.
        </T>
      </ScrollView>
    </SafeAreaView>
  );
}
