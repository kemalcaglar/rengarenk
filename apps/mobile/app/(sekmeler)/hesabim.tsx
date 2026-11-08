import { colors } from '@rengarenk/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { T } from '../../components/t';
import { basHarf, useOturum } from '../../lib/oturum';

const WEB = process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:3000';

/** "+905321234567" → "+90 5XX XXX XX 67" (tasarım: HesapMobil) */
const maskele = (p?: string) => (p ? `+90 5XX XXX XX ${p.slice(-2)}` : '');

/** Menü (tasarım: HesapMobil, menuler). Sayılar talep, favori ve ödeme modülleriyle gelir. */
const MENU: {
  ad: string;
  ogeler: { ikon: string; tint: string; ad: string; alt: string; git?: () => void }[];
}[] = [
  {
    ad: 'Alıcı',
    ogeler: [
      {
        ikon: '📝',
        tint: '#EEF3FF',
        ad: 'Taleplerim',
        alt: 'Yayındaki, pasif ve taslak taleplerin',
        git: () => router.push('/(sekmeler)/taleplerim'),
      },
      {
        ikon: '♥',
        tint: '#FFEEF6',
        ad: 'Favoriler ve aramalar',
        alt: 'Favori talepler ve kayıtlı aramalar',
        git: () => router.push('/favoriler'),
      },
      { ikon: '🎟️', tint: '#FFF6DF', ad: 'Haklarım ve ödemeler', alt: '1 ücretsiz talep · faturalar' },
    ],
  },
  {
    ad: 'Satıcı',
    ogeler: [
      { ikon: '🏢', tint: '#E7FAF0', ad: 'Kurumsal hesap başvurusu', alt: 'Galeriysen 30 gün ücretsiz dene' },
    ],
  },
  {
    ad: 'Hesap',
    ogeler: [
      { ikon: '⚙️', tint: '#F3F5FA', ad: 'Ayarlar', alt: 'Bildirimler, giriş, iletişim tercihleri' },
      { ikon: '🔒', tint: '#F3F5FA', ad: 'Kişisel verilerim', alt: 'Verilerimi indir, KVKK başvurusu' },
      { ikon: '💬', tint: '#F3F5FA', ad: 'Yardım ve destek', alt: 'Asistan ve destek kaydı' },
      {
        ikon: '📚',
        tint: '#F3F5FA',
        ad: 'Veri kaynakları',
        alt: 'Vehicle data by VehiclesDB',
        git: () => router.push('/veri-kaynaklari'),
      },
    ],
  },
];

const kart = { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line } as const;

/**
 * Hesabım (tasarım: HesapMobil): üst bölümde ad, maskeli numara ve hesap türü, özet kutuları, Alıcı / Satıcı /
 * Hesap menüleri. Giriş yapılmamışsa giriş kartı gösterilir. "Veri kaynakları" ve "Çıkış yap" tasarımda yok;
 * lisans atfı ve oturum kapatma gerektirdiği için aynı biçimle eklendi.
 */
export default function Hesabim() {
  const { durum, me, cikis, istek } = useOturum();
  const [sayilar, setSayilar] = useState<Record<string, number>>({});
  // Özet kutuları: aktif talep ve favori sayısı; sohbet sayısı mesajlaşmayla gelir
  useFocusEffect(
    useCallback(() => {
      if (durum !== 'uye') return;
      Promise.all([istek<{ items: { status: string }[] }>('/demands/mine'), istek<unknown[]>('/favorites')])
        .then(([m, f]) =>
          setSayilar({
            'Aktif talep': m.items.filter((x) => x.status === 'PUBLISHED').length,
            Favori: f.length,
          }),
        )
        .catch(() => undefined);
    }, [durum, istek]),
  );
  if (durum !== 'uye') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
        <View style={{ flex: 1, backgroundColor: colors.background, padding: 12, paddingTop: 18 }}>
          <View style={{ ...kart, borderRadius: 18, padding: 18 }}>
            <T accessibilityRole="header" style={{ fontSize: 19, fontWeight: '800' }}>
              Hesabım
            </T>
            <T style={{ marginTop: 6, fontSize: 14, color: colors.muted }}>
              Taleplerini, mesajlarını ve haklarını görmek için giriş yap.
            </T>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/giris')}
              style={{
                marginTop: 16,
                backgroundColor: colors.blue,
                borderRadius: 14,
                paddingVertical: 15,
                alignItems: 'center',
              }}
            >
              <T style={{ fontSize: 16, fontWeight: '800' }}>Giriş yap veya üye ol</T>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }
  const bireysel = me?.memberships.some((m) => m.account.kind === 'INDIVIDUAL') ?? true;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <View
        style={{
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
          paddingTop: 18,
          paddingHorizontal: 16,
          paddingBottom: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <View
          style={{
            width: 54,
            height: 54,
            borderRadius: 27,
            backgroundColor: '#FFEEF6',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <T style={{ fontSize: 17, fontWeight: '800' }}>{basHarf(me?.displayName)}</T>
        </View>
        <View style={{ flex: 1 }}>
          <T accessibilityRole="header" style={{ fontSize: 19, fontWeight: '800' }}>
            {me?.displayName ?? 'Adın'}
          </T>
          <T style={{ fontSize: 12.5, color: colors.muted, marginTop: 2 }}>
            {maskele(me?.phone)} · {bireysel ? 'Bireysel' : 'Kurumsal'}
          </T>
        </View>
      </View>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 12, paddingTop: 14, paddingBottom: 24 }}
      >
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {['Aktif talep', 'Sohbet', 'Favori'].map((k) => (
            <View
              key={k}
              style={{
                ...kart,
                flex: 1,
                borderRadius: 14,
                paddingVertical: 12,
                paddingHorizontal: 10,
                alignItems: 'center',
              }}
            >
              <T style={{ fontSize: 20, fontWeight: '800' }}>{sayilar[k] ?? 0}</T>
              <T style={{ fontSize: 11.5, color: colors.muted, marginTop: 2 }}>{k}</T>
            </View>
          ))}
        </View>
        {MENU.map((g) => (
          <View key={g.ad}>
            <T
              accessibilityRole="header"
              style={{
                marginTop: 18,
                marginHorizontal: 6,
                marginBottom: 8,
                fontSize: 12.5,
                fontWeight: '800',
                color: colors.muted,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {g.ad}
            </T>
            <View style={{ ...kart, borderRadius: 16, overflow: 'hidden' }}>
              {g.ogeler.map((o, i) => (
                <Pressable
                  key={o.ad}
                  accessibilityRole="link"
                  accessibilityState={{ disabled: !o.git }}
                  onPress={o.git}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 13,
                    paddingHorizontal: 14,
                    borderTopWidth: i ? 1 : 0,
                    borderTopColor: '#EEF0F5',
                  }}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      backgroundColor: o.tint,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <T style={{ fontSize: 15 }}>{o.ikon}</T>
                  </View>
                  <View style={{ flex: 1 }}>
                    <T style={{ fontSize: 14.5, fontWeight: '700' }}>{o.ad}</T>
                    <T style={{ fontSize: 12, color: colors.muted, marginTop: 1 }}>{o.alt}</T>
                  </View>
                  <T style={{ fontSize: 18, color: '#AEB5C4' }}>›</T>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={cikis}
          style={{ ...kart, marginTop: 18, borderRadius: 16, paddingVertical: 14, alignItems: 'center' }}
        >
          <T style={{ fontSize: 14.5, fontWeight: '700', color: '#A11B1B' }}>Çıkış yap</T>
        </Pressable>
        <T style={{ marginTop: 18, textAlign: 'center', fontSize: 12, color: colors.muted }}>
          Rengarenk 1.0.0 ·{' '}
          <T
            style={{ fontSize: 12, color: colors.muted }}
            onPress={() => Linking.openURL(`${WEB}/kullanim-kosullari`)}
          >
            Kullanım koşulları
          </T>{' '}
          ·{' '}
          <T style={{ fontSize: 12, color: colors.muted }} onPress={() => Linking.openURL(`${WEB}/kvkk`)}>
            Aydınlatma metni
          </T>
        </T>
      </ScrollView>
    </SafeAreaView>
  );
}
