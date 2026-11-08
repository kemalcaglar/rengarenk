import { colors, DOTS } from '@rengarenk/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useKategoriler } from '../lib/kategoriler';
import { basHarf, useOturum } from '../lib/oturum';
import { Ikon } from './ikon';
import { Logo } from './logo';
import { T } from './t';

const WEB = process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:3000';
/** Kategori kareleri: tasarımdaki TINTS sırası (AnasayfaMobil) */
const TINTS = ['#EEF3FF', '#FFEEF6', '#FFF6DF', '#E7FAF0', '#F3EFFF', '#FFF0EA'];

const baslik = {
  fontSize: 12.5,
  fontWeight: '800',
  color: colors.muted,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
} as const;

/**
 * Menü ve kategoriler çekmecesi (tasarım: AnasayfaMobil, menuAcik): kullanıcı kartı, vasıta kategorileri (renkli
 * kare ve nokta), Diğer · Yakında, alt bağlantılar ve yasal metinler. Talep sayıları talep modülüyle gelir.
 */
export function MenuCekmecesi({ acik, kapat }: { acik: boolean; kapat: () => void }) {
  const { durum, me } = useOturum();
  const [vasita, setVasita] = useState(true);
  const kategoriler = useKategoriler().filter((c) => c.vertical === 'vasita');
  const git = (yol: '/giris' | '/(sekmeler)/hesabim') => {
    kapat();
    router.push(yol);
  };
  return (
    <Modal visible={acik} transparent animationType="fade" onRequestClose={kapat}>
      <Pressable
        accessibilityLabel="Menüyü kapat"
        onPress={kapat}
        style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(30,35,51,0.45)' }}
      />
      <SafeAreaView
        accessibilityLabel="Menü ve kategoriler"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 324,
          backgroundColor: colors.surface,
          shadowColor: colors.ink,
          shadowOpacity: 0.18,
          shadowRadius: 24,
          shadowOffset: { width: 8, height: 0 },
          elevation: 12,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 10,
            paddingBottom: 10,
            paddingLeft: 16,
            paddingRight: 8,
            borderBottomWidth: 1,
            borderBottomColor: '#EEF0F5',
          }}
        >
          <Logo gap={6} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Menüyü kapat"
            onPress={kapat}
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ikon d="kapat" />
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="link"
          onPress={() => git(durum === 'uye' ? '/(sekmeler)/hesabim' : '/giris')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            marginTop: 12,
            marginHorizontal: 12,
            marginBottom: 4,
            paddingVertical: 10,
            paddingHorizontal: 12,
            backgroundColor: colors.background,
            borderRadius: 14,
          }}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: '#FFEEF6',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <T style={{ fontSize: 13, fontWeight: '800' }}>
              {durum === 'uye' ? basHarf(me?.displayName) : '?'}
            </T>
          </View>
          <View style={{ flex: 1 }}>
            <T style={{ fontSize: 14.5, fontWeight: '800' }}>
              {durum === 'uye' ? (me?.displayName ?? 'Hesabım') : 'Giriş yap veya üye ol'}
            </T>
            <T style={{ fontSize: 12, color: colors.muted }}>
              {durum === 'uye' ? 'Hesabım ve taleplerim' : 'İlk talebin ücretsiz'}
            </T>
          </View>
          <T style={{ fontSize: 18, color: '#AEB5C4' }}>›</T>
        </Pressable>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 6 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: vasita }}
            onPress={() => setVasita(!vasita)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 10,
              paddingBottom: 6,
              paddingHorizontal: 16,
            }}
          >
            <T style={baslik}>Vasıta kategorileri</T>
            <T style={{ fontSize: 12.5, fontWeight: '700', color: colors.link }}>
              {vasita ? 'Gizle' : 'Göster'}
            </T>
          </Pressable>
          {vasita ? (
            <>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 11,
                  paddingHorizontal: 16,
                }}
              >
                <T style={{ fontSize: 14.5, fontWeight: '800' }}>Tüm vasıta talepleri</T>
              </View>
              {kategoriler.map((c, i) => (
                <View
                  key={c.slug}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                  }}
                >
                  <View
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 9,
                      // Kare, noktanın renginin açık tonu (DOTS ile TINTS aynı sırada)
                      backgroundColor:
                        TINTS[(DOTS as readonly string[]).indexOf(c.color)] ?? TINTS[i % TINTS.length],
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.color }} />
                  </View>
                  <T style={{ flex: 1, fontSize: 14.5, fontWeight: '600' }}>{c.name}</T>
                </View>
              ))}
            </>
          ) : null}
          <T style={[baslik, { marginTop: 10, marginHorizontal: 16, marginBottom: 4 }]}>Diğer</T>
          {['Emlak', 'İkinci el alışveriş'].map((ad) => (
            <View
              key={ad}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 10,
                paddingHorizontal: 16,
              }}
            >
              <T style={{ fontSize: 14.5, fontWeight: '600', color: colors.muted }}>{ad}</T>
              <T
                style={{
                  fontSize: 11,
                  fontWeight: '800',
                  paddingVertical: 3,
                  paddingHorizontal: 8,
                  borderRadius: 999,
                  overflow: 'hidden',
                  backgroundColor: '#F3F5FA',
                  color: colors.muted,
                }}
              >
                Yakında
              </T>
            </View>
          ))}
        </ScrollView>

        <View style={{ borderTopWidth: 1, borderTopColor: '#EEF0F5', paddingTop: 8, paddingBottom: 24 }}>
          <Pressable
            accessibilityRole="link"
            onPress={kapat}
            style={{ paddingVertical: 9, paddingHorizontal: 16 }}
          >
            <T style={{ fontSize: 14, fontWeight: '700' }}>Nasıl çalışır?</T>
          </Pressable>
          <T style={{ marginTop: 6, marginHorizontal: 16, fontSize: 11.5, color: colors.muted }}>
            <T
              style={{ fontSize: 11.5, color: colors.muted }}
              onPress={() => Linking.openURL(`${WEB}/kullanim-kosullari`)}
            >
              Kullanım koşulları
            </T>
            {' · '}
            <T style={{ fontSize: 11.5, color: colors.muted }} onPress={() => Linking.openURL(`${WEB}/kvkk`)}>
              Aydınlatma metni
            </T>
            {' · '}
            <T
              style={{ fontSize: 11.5, color: colors.muted }}
              onPress={() => Linking.openURL(`${WEB}/cerez-aydinlatma`)}
            >
              Çerezler
            </T>
          </T>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
