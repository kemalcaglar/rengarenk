import { colors } from '@rengarenk/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BosDurum } from '../../components/bos-durum';
import { T } from '../../components/t';
import { useCanli } from '../../lib/canli';
import { useOturum } from '../../lib/oturum';

interface Satir {
  id: string;
  taraf: 'alici' | 'satici';
  ad: string;
  bas: string;
  galeri: boolean;
  talep: { no: number; baslik: string } | null;
  arac: { no: number; ad: string } | null;
  son: string;
  zaman: string;
  durum: 'WAITING' | 'OPEN' | 'DECLINED';
  ilkMesaj: boolean;
  bekliyor: boolean;
  uyari: boolean;
  numara: boolean;
  okunmamis: number;
}

const AV = ['#FFF6DF', '#EEF3FF', '#FFEEF6', '#E7FAF0', '#F3EFFF'];
const R = {
  ilk: { ad: 'İlk mesaj', bg: '#EEF3FF', renk: '#2450C8' },
  bireysel: { ad: 'Bireysel', bg: '#F3F5FA', renk: '#3A4052' },
  galeri: { ad: 'Galeri', bg: '#FFF6DF', renk: '#7A5200' },
  numara: { ad: 'Numaran paylaşıldı', bg: '#E7FAF0', renk: '#11683F' },
  uyari: { ad: 'Güvenlik uyarısı', bg: '#FFEEEE', renk: '#A11B1B' },
  bekliyor: { ad: 'Yanıt bekleniyor', bg: '#FFF6DF', renk: '#7A5300' },
  kapandi: { ad: 'Kapandı', bg: '#F3F5FA', renk: '#5A6073' },
};

const zamanYaz = (iso: string) => {
  const d = new Date(iso);
  const gun = (x: Date) => x.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' });
  if (gun(d) === gun(new Date())) {
    return d.toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });
  }
  if (gun(d) === gun(new Date(Date.now() - 86_400_000))) return 'Dün';
  return d.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', weekday: 'short' });
};

/**
 * Mesajlar (tasarım: MesajlarMobil.dc.html): sohbetler talebe göre gruplanır; okunmamış sayısı, rozetler, süzgeçler
 * (Tümü, Okunmamış, talep başına, Arşiv). Yeni mesaj WebSocket ile gelir. Puan verme kartı yıldız ve rozetlerle
 * (Karar 55) gelecek.
 */
export default function Mesajlar() {
  const { durum, istek } = useOturum();
  const [liste, setListe] = useState<Satir[] | null>(null);
  const [filtre, setFiltre] = useState('hepsi');

  const yukle = useCallback(() => {
    istek<Satir[]>('/conversations')
      .then(setListe)
      .catch(() => setListe([]));
  }, [istek]);
  useFocusEffect(
    useCallback(() => {
      if (durum === 'uye') yukle();
    }, [durum, yukle]),
  );
  useCanli((o) => {
    if (o.tip === 'sohbet') yukle();
  });

  const grupAnahtar = (m: Satir) => (m.talep ? `t${m.talep.no}` : m.arac ? `a${m.arac.no}` : m.id);
  const talepler = [
    ...new Map(
      (liste ?? [])
        .filter((m) => m.talep && m.taraf === 'alici')
        .map((m) => [grupAnahtar(m), m.talep?.baslik ?? '']),
    ),
  ];
  const F: [string, string][] = [
    ['hepsi', 'Tümü'],
    ['okunmamis', 'Okunmamış'],
    ...talepler.map(([k, ad]) => [k, ad.length > 22 ? `${ad.slice(0, 22)}…` : ad] as [string, string]),
    ['arsiv', 'Arşiv'],
  ];
  const gorunen = (liste ?? []).filter((m) =>
    filtre === 'hepsi'
      ? m.durum !== 'DECLINED'
      : filtre === 'okunmamis'
        ? m.okunmamis > 0
        : filtre === 'arsiv'
          ? m.durum === 'DECLINED'
          : grupAnahtar(m) === filtre,
  );
  const gruplar = [...new Set(gorunen.map(grupAnahtar))].map((k) => {
    const satirlar = gorunen.filter((m) => grupAnahtar(m) === k);
    const ilk = satirlar[0] as Satir;
    const tumu = (liste ?? []).filter((m) => grupAnahtar(m) === k).length;
    return {
      k,
      ad: ilk.talep?.baslik ?? ilk.arac?.ad ?? '',
      ozet:
        ilk.taraf === 'alici' ? (ilk.talep ? `${tumu} satıcı yazdı` : 'Galeriye yazdın') : 'Senin yazdığın',
      satirlar,
    };
  });
  const okunmamis = (liste ?? []).reduce((t, m) => t + m.okunmamis, 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <View
        style={{
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
          paddingTop: 12,
          paddingHorizontal: 16,
          paddingBottom: 10,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T accessibilityRole="header" style={{ fontSize: 22, fontWeight: '800' }}>
            Mesajlar
          </T>
          <T style={{ fontSize: 12.5, fontWeight: '700', color: colors.muted }}>{okunmamis} okunmamış</T>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, marginTop: 10 }}
        >
          {F.map(([k, ad]) => {
            const on = k === filtre;
            return (
              <Pressable
                key={k}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setFiltre(k)}
                style={{
                  borderWidth: 1,
                  borderColor: on ? colors.ink : '#D5DAE5',
                  backgroundColor: on ? colors.ink : colors.surface,
                  borderRadius: 999,
                  paddingVertical: 8,
                  paddingHorizontal: 13,
                }}
              >
                <T style={{ fontSize: 13.5, fontWeight: '700', color: on ? '#FFFFFF' : colors.ink }}>{ad}</T>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingTop: 10, paddingHorizontal: 12, paddingBottom: 24 }}
      >
        {liste && !gruplar.length ? (
          <BosDurum
            baslik={liste.length ? 'Bu süzgeçte sohbet yok' : 'Henüz mesajın yok'}
            metin="Talebine satıcılar yazdığında sohbetler burada görünür."
          />
        ) : null}
        {gruplar.map((g) => (
          <View key={g.k}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 10,
                marginHorizontal: 4,
                marginBottom: 8,
                gap: 8,
              }}
            >
              <T
                accessibilityRole="header"
                numberOfLines={1}
                style={{ flex: 1, fontSize: 13.5, fontWeight: '800' }}
              >
                {g.ad}
              </T>
              <T style={{ fontSize: 12, color: colors.muted }}>{g.ozet}</T>
            </View>
            <View
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.line,
                borderRadius: 16,
                overflow: 'hidden',
              }}
            >
              {g.satirlar.map((m, i) => {
                const yeni = m.okunmamis > 0;
                const rozetler = [
                  m.ilkMesaj && m.taraf === 'alici' && m.bekliyor ? R.ilk : null,
                  m.taraf === 'alici' ? (m.galeri ? R.galeri : R.bireysel) : null,
                  m.numara && m.taraf === 'alici' ? R.numara : null,
                  m.uyari ? R.uyari : null,
                  m.bekliyor && m.taraf === 'satici' ? R.bekliyor : null,
                  m.durum === 'DECLINED' ? R.kapandi : null,
                ].filter((x): x is (typeof R)[keyof typeof R] => Boolean(x));
                return (
                  <Pressable
                    key={m.id}
                    accessibilityRole="link"
                    onPress={() => router.push(`/sohbet/${m.id}`)}
                    style={{
                      flexDirection: 'row',
                      gap: 12,
                      paddingVertical: 12,
                      paddingHorizontal: 14,
                      borderBottomWidth: 1,
                      borderBottomColor: '#EEF0F5',
                      backgroundColor: yeni ? '#F8FAFF' : colors.surface,
                    }}
                  >
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: AV[i % AV.length],
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <T style={{ fontSize: 13.5, fontWeight: '800' }}>{m.bas}</T>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                        <T
                          numberOfLines={1}
                          style={{ flex: 1, fontSize: 14.5, fontWeight: yeni ? '800' : '700' }}
                        >
                          {m.ad}
                        </T>
                        <T style={{ fontSize: 11.5, color: colors.muted }}>{zamanYaz(m.zaman)}</T>
                      </View>
                      {rozetler.length ? (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 3 }}>
                          {rozetler.map((r) => (
                            <T
                              key={r.ad}
                              style={{
                                fontSize: 10.5,
                                fontWeight: '800',
                                paddingVertical: 2,
                                paddingHorizontal: 7,
                                borderRadius: 999,
                                overflow: 'hidden',
                                backgroundColor: r.bg,
                                color: r.renk,
                              }}
                            >
                              {r.ad}
                            </T>
                          ))}
                        </View>
                      ) : null}
                      <T numberOfLines={1} style={{ fontSize: 13, color: '#3A4052', marginTop: 4 }}>
                        {m.son}
                      </T>
                    </View>
                    {yeni ? (
                      <View
                        accessibilityLabel={`${m.okunmamis} okunmamış mesaj`}
                        style={{
                          alignSelf: 'center',
                          minWidth: 20,
                          height: 20,
                          paddingHorizontal: 5,
                          borderRadius: 999,
                          backgroundColor: '#5B8CFF',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <T style={{ fontSize: 11, fontWeight: '800' }}>{m.okunmamis}</T>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
        <T style={{ marginTop: 14, marginHorizontal: 6, fontSize: 12, color: colors.muted, lineHeight: 18 }}>
          Satıcı numaranı yalnızca sen “numaramı paylaş” dersen görür. Kapora isteyen, ödeme bağlantısı
          gönderen satıcıyı şikayet et; mesaj hemen gizlenir.
        </T>
      </ScrollView>
    </SafeAreaView>
  );
}
