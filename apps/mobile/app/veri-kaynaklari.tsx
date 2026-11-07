import { colors } from '@rengarenk/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ marginBottom: 12 }}>
          <Text style={{ color: colors.blue, fontWeight: '700' }}>‹ Geri</Text>
        </Pressable>
        <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: '800', color: colors.ink }}>
          Veri kaynakları
        </Text>
        <Text style={{ color: colors.muted, marginTop: 6 }}>
          Araç kataloğundaki bilgiler aşağıdaki kaynaklardan derlenir. Kasko değerleri saklanmaz ve
          gösterilmez.
        </Text>
        {list === null ? <Text style={{ marginTop: 16 }}>Yükleniyor…</Text> : null}
        {list === 'hata' ? <Text style={{ marginTop: 16 }}>Kaynak listesi şu an alınamadı.</Text> : null}
        {Array.isArray(list)
          ? list.map((s) => (
              <View
                key={s.key}
                style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginTop: 14 }}
              >
                <Text
                  accessibilityRole={s.url ? 'link' : 'text'}
                  onPress={s.url ? () => Linking.openURL(s.url as string) : undefined}
                  style={{ fontSize: 16, fontWeight: '800', color: s.url ? colors.blue : colors.ink }}
                >
                  {s.attribution ?? s.name}
                </Text>
                <Text style={{ color: colors.muted, marginTop: 4, fontSize: 13 }}>
                  {s.name} · Lisans: {s.license}
                </Text>
                {s.notice ? (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: open === s.key }}
                      onPress={() => setOpen(open === s.key ? null : s.key)}
                      style={{ marginTop: 10 }}
                    >
                      <Text style={{ fontWeight: '700', color: colors.ink }}>
                        {open === s.key ? 'Atıf metnini gizle' : 'Kaynağın atıf metni'}
                      </Text>
                    </Pressable>
                    {open === s.key ? (
                      <Text style={{ fontSize: 12.5, lineHeight: 19, color: '#3A4052', marginTop: 6 }}>
                        {noticeLines(s.notice).join('\n')}
                      </Text>
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
