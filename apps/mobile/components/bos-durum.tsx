import { colors, kartOran } from '@rengarenk/shared';
import { View } from 'react-native';
import { T } from './t';

/**
 * Boş liste kartı. Tasarımda boş durumlar çizilmedi; kart, tasarımın liste kartı ölçüleriyle (beyaz, ince kenar,
 * 16 px köşe) yazıldı.
 */
export function BosDurum({ baslik, metin }: { baslik: string; metin: string }) {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: kartOran(16),
        padding: 18,
      }}
    >
      <T style={{ fontSize: 15.5, fontWeight: '800' }}>{baslik}</T>
      <T style={{ fontSize: 13.5, color: colors.muted, marginTop: 4, lineHeight: 19 }}>{metin}</T>
    </View>
  );
}
