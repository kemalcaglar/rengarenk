import { colors } from '@rengarenk/shared';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

export default function Screen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 17, fontWeight: '800' }}>Hesabım</Text>
      <Text style={{ color: '#5A6073', marginTop: 6 }}>Geliştirme planında sırası gelince</Text>
      <Link href="/veri-kaynaklari" asChild>
        <Pressable accessibilityRole="link" style={{ marginTop: 24 }}>
          <Text style={{ color: colors.blue, fontWeight: '700' }}>Veri kaynakları</Text>
        </Pressable>
      </Link>
      <Text style={{ color: '#5A6073', marginTop: 4, fontSize: 12 }}>Vehicle data by VehiclesDB</Text>
    </View>
  );
}
