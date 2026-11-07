import { Text, View } from 'react-native';

export default function Screen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 17, fontWeight: '800' }}>Mesajlar</Text>
      <Text style={{ color: '#5A6073', marginTop: 6 }}>Geliştirme planında sırası gelince</Text>
    </View>
  );
}
