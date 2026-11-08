import { colors } from '@rengarenk/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BosDurum } from '../../components/bos-durum';
import { Ikon } from '../../components/ikon';
import { T } from '../../components/t';
import { useOturum } from '../../lib/oturum';

const SEKMELER = ['Yayında', 'Pasif', 'Taslak', 'Tamamlanan'] as const;

/**
 * Taleplerim (tasarım: TaleplerimMobil): başlık ve "+" düğmesi, durum sekmeleri. Talep kartları talep modülüyle
 * (Sprint 8) gelir; o zamana kadar boş liste kartı.
 */
export default function Taleplerim() {
  const [sekme, setSekme] = useState<(typeof SEKMELER)[number]>('Yayında');
  const { durum } = useOturum();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <View
        style={{
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
          paddingTop: 16,
          paddingHorizontal: 16,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T accessibilityRole="header" style={{ fontSize: 22, fontWeight: '800' }}>
            Taleplerim
          </T>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Talep oluştur"
            onPress={() => router.push(durum === 'uye' ? '/talep-olustur' : '/giris')}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: colors.blue,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ikon d="arti" size={20} width={2.4} />
          </Pressable>
        </View>
        <View accessibilityRole="tablist" style={{ flexDirection: 'row', marginTop: 10 }}>
          {SEKMELER.map((s) => {
            const on = s === sekme;
            return (
              <Pressable
                key={s}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => setSekme(s)}
                style={{
                  paddingTop: 10,
                  paddingHorizontal: 10,
                  paddingBottom: 9,
                  borderBottomWidth: 3,
                  borderBottomColor: on ? colors.blue : 'transparent',
                }}
              >
                <T
                  style={{
                    fontSize: 14.5,
                    fontWeight: on ? '800' : '600',
                    color: on ? colors.ink : colors.muted,
                  }}
                >
                  {s} 0
                </T>
              </Pressable>
            );
          })}
        </View>
      </View>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingVertical: 14, paddingHorizontal: 16 }}
      >
        <BosDurum
          baslik={sekme === 'Yayında' ? 'Yayında talebin yok' : `${sekme} talebin yok`}
          metin="Aradığın aracı yaz; uygun aracı olan galeriler ve satıcılar sana yazsın. İlk talebin ücretsiz."
        />
      </ScrollView>
    </SafeAreaView>
  );
}
