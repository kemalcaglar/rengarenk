import { colors } from '@rengarenk/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ikon } from '../components/ikon';
import { T } from '../components/t';

const API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Source {
  key: string;
  name: string;
  license: string;
  attribution: string | null;
  url: string | null;
  notice: string | null;
}

/** Atıf metninden okunur satırlar: HTML yorumu, başlık işareti ve biçim karakterleri atılır. */
const noticeLines = (text: string) =>
  text
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .map((l) =>
      l
        .replace(/^#+\s*/, '')
        .replace(/^>\s?/, '')
        .replace(/^\s*[-*]\s/, '• ')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
        .replace(/[`*]/g, '')
        .trim(),
    )
    .filter((l) => l && !/^<.*>$/.test(l));

/**
 * Veri kaynakları (Teknik tasarım §5): katalog kaynaklarının lisansı ve atfı. Uygulamada atıf bu ekrandadır
 * (VehiclesDB ve diğer açık kaynakların koşulu).
 */
export default function VeriKaynaklari() {
  const [list, setList] = useState<Source[] | null | 'hata'>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    fetch(`${API}/catalog/attributions`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('alınamadı'))))
      .then((d: Source[]) => setList(d))
      .catch(() => setList('hata'));
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <View
        style={{
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
          padding: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
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
        <T accessibilityRole="header" style={{ fontSize: 18, fontWeight: '800' }}>
          Veri kaynakları
        </T>
      </View>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 12, paddingBottom: 24 }}
      >
        <T style={{ color: colors.muted, marginHorizontal: 4, fontSize: 13.5 }}>
          Araç kataloğundaki bilgiler aşağıdaki kaynaklardan derlenir. Kasko değerleri saklanmaz ve
          gösterilmez.
        </T>
        {list === null ? <T style={{ marginTop: 16 }}>Yükleniyor…</T> : null}
        {list === 'hata' ? <T style={{ marginTop: 16 }}>Kaynak listesi şu an alınamadı.</T> : null}
        {Array.isArray(list)
          ? list.map((s) => (
              <View
                key={s.key}
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.line,
                  borderRadius: 16,
                  padding: 16,
                  marginTop: 12,
                }}
              >
                <T
                  accessibilityRole={s.url ? 'link' : 'text'}
                  onPress={s.url ? () => Linking.openURL(s.url as string) : undefined}
                  style={{ fontSize: 16, fontWeight: '800', color: s.url ? colors.link : colors.ink }}
                >
                  {s.attribution ?? s.name}
                </T>
                <T style={{ color: colors.muted, marginTop: 4, fontSize: 13 }}>
                  {s.name} · Lisans: {s.license}
                </T>
                {s.notice ? (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: open === s.key }}
                      onPress={() => setOpen(open === s.key ? null : s.key)}
                      style={{ marginTop: 10 }}
                    >
                      <T style={{ fontWeight: '700', color: colors.ink }}>
                        {open === s.key ? 'Atıf metnini gizle' : 'Kaynağın atıf metni'}
                      </T>
                    </Pressable>
                    {open === s.key ? (
                      <T style={{ fontSize: 12.5, lineHeight: 19, color: '#3A4052', marginTop: 6 }}>
                        {noticeLines(s.notice).join('\n')}
                      </T>
                    ) : null}
                  </>
                ) : null}
              </View>
            ))
          : null}
      </ScrollView>
    </SafeAreaView>
  );
}
