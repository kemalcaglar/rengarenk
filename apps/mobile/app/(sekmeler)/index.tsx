import { colors, VEHICLE_CATEGORIES } from '@rengarenk/shared';
import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BARS = [colors.blue, colors.pink, colors.yellow, colors.green];

export default function Home() {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 12, gap: 14 }}>
        <View style={s.brand}>
          {BARS.map((c) => (
            <View key={c} style={[s.bar, { backgroundColor: c }]} />
          ))}
          <Text style={s.brandText}>rengarenk</Text>
        </View>
        <View style={s.hero}>
          <Text style={s.heroText}>Aradığın aracı yaz, satıcılar sana gelsin.</Text>
          <Link href="/giris" asChild>
            <Pressable style={s.cta} accessibilityRole="button">
              <Text style={s.ctaText}>Talep oluştur</Text>
            </Pressable>
          </Link>
        </View>
        <Text style={s.h2}>Kategoriler</Text>
        <View style={s.card}>
          {VEHICLE_CATEGORIES.map((c) => (
            <Text key={c.slug} style={s.row}>
              {c.name}
            </Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 4 },
  bar: { width: 7, height: 16, borderRadius: 4 },
  brandText: { marginLeft: 6, fontSize: 18, fontWeight: '800', color: colors.ink },
  hero: {
    backgroundColor: colors.ink,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroText: { flex: 1, color: '#fff', fontWeight: '800', fontSize: 15 },
  cta: { backgroundColor: colors.blue, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 12 },
  ctaText: { fontWeight: '800', color: colors.ink },
  h2: { fontSize: 17, fontWeight: '800', color: colors.ink },
  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: colors.line },
  row: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF0F5',
    fontSize: 15,
    color: colors.ink,
  },
});
