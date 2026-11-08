import { colors, tints } from '@rengarenk/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ikon } from '../../components/ikon';
import { Logo } from '../../components/logo';
import { MenuCekmecesi } from '../../components/menu-cekmecesi';
import { T, TInput } from '../../components/t';
import { useOturum } from '../../lib/oturum';

const ADIMLAR = [
  {
    no: '1',
    renk: tints.blue,
    baslik: 'Talebini yaz',
    metin: 'Marka, model, paket, bütçe ve konumunu seç. 3 dakika sürer.',
  },
  {
    no: '2',
    renk: tints.pink,
    baslik: 'Satıcılar sana yazsın',
    metin: 'Uygun aracı olan galeriler ve satıcılar ilk mesajı gönderir.',
  },
  {
    no: '3',
    renk: tints.green,
    baslik: 'Sen seç',
    metin: 'Numaran sen izin verene kadar gizli kalır. Aracı görmeden ödeme yapma.',
  },
];

/**
 * Ana sayfa (tasarım: AnasayfaMobil, v.ana): beyaz üst bölüm (menü, logo, bildirimler, arama), tanıtım kartı ve
 * "Nasıl çalışır?". Vitrin ve son talepler talep modülüyle gelir.
 */
export default function Home() {
  const [menu, setMenu] = useState(false);
  const { durum } = useOturum();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <View
        style={{
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
          paddingTop: 10,
          paddingHorizontal: 12,
          paddingBottom: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Menü ve kategoriler"
              accessibilityState={{ expanded: menu }}
              onPress={() => setMenu(true)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ikon d="menu" />
            </Pressable>
            <Logo />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Bildirimler"
            onPress={() => router.push('/bildirimler')}
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: '#F3F5FA',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ikon d="zil" size={21} width={2} />
          </Pressable>
        </View>
        <View
          accessibilityRole="search"
          style={{
            marginTop: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: '#F3F5FA',
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: 12,
            paddingHorizontal: 12,
          }}
        >
          <Ikon d="ara" size={18} width={2} color={colors.muted} />
          <TInput
            accessibilityLabel="Talep ara"
            placeholder="Marka, model veya talep no ile ara"
            returnKeyType="search"
            onSubmitEditing={(e) =>
              router.push({ pathname: '/talepler', params: { q: e.nativeEvent.text.trim() } })
            }
            style={{ flex: 1, fontSize: 15, paddingVertical: 12 }}
          />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingTop: 10, paddingBottom: 24 }}
      >
        <View
          style={{
            marginHorizontal: 12,
            backgroundColor: colors.ink,
            borderRadius: 16,
            paddingVertical: 10,
            paddingRight: 10,
            paddingLeft: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <T
            accessibilityRole="header"
            style={{ flex: 1, fontSize: 14.5, fontWeight: '800', lineHeight: 19, color: '#FFFFFF' }}
          >
            Aradığın aracı yaz, satıcılar sana gelsin.
          </T>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(durum === 'uye' ? '/talep-olustur' : '/giris')}
            style={{
              backgroundColor: colors.blue,
              borderRadius: 12,
              paddingVertical: 11,
              paddingHorizontal: 12,
              alignItems: 'center',
            }}
          >
            <T style={{ fontSize: 13.5, fontWeight: '800', lineHeight: 16 }}>Talep oluştur</T>
            <T style={{ fontSize: 10.5, fontWeight: '700', lineHeight: 13 }}>ilk talep ücretsiz</T>
          </Pressable>
        </View>

        <View
          style={{
            marginTop: 22,
            marginHorizontal: 12,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: 18,
            padding: 16,
          }}
        >
          <T accessibilityRole="header" style={{ marginBottom: 10, fontSize: 16, fontWeight: '800' }}>
            Nasıl çalışır?
          </T>
          {ADIMLAR.map((a) => (
            <View key={a.no} style={{ flexDirection: 'row', gap: 12, paddingVertical: 8 }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: a.renk,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <T style={{ fontSize: 13, fontWeight: '800' }}>{a.no}</T>
              </View>
              <View style={{ flex: 1 }}>
                <T style={{ fontSize: 14, fontWeight: '800' }}>{a.baslik}</T>
                <T style={{ fontSize: 12.5, color: colors.muted, marginTop: 2 }}>{a.metin}</T>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      <MenuCekmecesi acik={menu} kapat={() => setMenu(false)} />
    </SafeAreaView>
  );
}
