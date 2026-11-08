import { colors, REPORT_REASONS, type ReportTarget, reasonsFor } from '@rengarenk/shared';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useOturum } from '../lib/oturum';
import { T, TInput } from './t';

const BASLIK: Record<ReportTarget, string> = {
  mesaj: 'Bu mesajı şikayet et',
  talep: 'Bu talebi şikayet et',
  arac: 'Bu ilanı şikayet et',
};

/**
 * Şikayet penceresi (Karar 13.2, 53): alttan açılır; neden ve isteğe bağlı açıklama. Şikayet edilen kişi şikayet edeni
 * görmez; sonuç bildirimle gelir.
 */
export function Sikayet({
  acik,
  hedef,
  id,
  kapat,
}: {
  acik: boolean;
  hedef: ReportTarget;
  id: string;
  kapat: () => void;
}) {
  const { istek } = useOturum();
  const [neden, setNeden] = useState<string | null>(null);
  const [aciklama, setAciklama] = useState('');
  const [no, setNo] = useState<number | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);

  const kapa = () => {
    setNeden(null);
    setAciklama('');
    setNo(null);
    setHata(null);
    kapat();
  };
  async function gonder() {
    if (!neden || mesgul) return;
    setMesgul(true);
    setHata(null);
    try {
      const r = await istek<{ no: number }>('/reports', {
        method: 'POST',
        body: { hedef, id, neden, ...(aciklama.trim() ? { aciklama: aciklama.trim() } : {}) },
      });
      setNo(r.no);
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setMesgul(false);
    }
  }

  return (
    <Modal visible={acik} transparent animationType="slide" onRequestClose={kapa}>
      <Pressable
        accessibilityLabel="Kapat"
        onPress={kapa}
        style={{ flex: 1, backgroundColor: 'rgba(30,35,51,0.45)' }}
      />
      <View
        accessibilityViewIsModal
        style={{
          backgroundColor: colors.surface,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingTop: 10,
          paddingHorizontal: 20,
          paddingBottom: 28,
          maxHeight: '85%',
        }}
      >
        <View
          style={{
            alignSelf: 'center',
            width: 40,
            height: 5,
            borderRadius: 3,
            backgroundColor: '#D5DAE5',
            marginBottom: 14,
          }}
        />
        {no === null ? (
          <ScrollView keyboardShouldPersistTaps="handled">
            <T accessibilityRole="header" style={{ fontSize: 18, fontWeight: '800' }}>
              {BASLIK[hedef]}
            </T>
            <T style={{ fontSize: 13, color: colors.muted, marginTop: 4, marginBottom: 14, lineHeight: 19 }}>
              Şikayetini moderatörlerimiz inceler. Şikayet ettiğin kişi kimin şikayet ettiğini görmez.
            </T>
            <View accessibilityRole="radiogroup" accessibilityLabel="Neden" style={{ gap: 6 }}>
              {reasonsFor(hedef).map((k) => {
                const on = neden === k;
                return (
                  <Pressable
                    key={k}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    onPress={() => setNeden(k)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      borderWidth: 1.5,
                      borderColor: on ? colors.blue : '#E3E6EF',
                      backgroundColor: on ? '#EEF3FF' : colors.surface,
                      borderRadius: 12,
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        borderWidth: on ? 5 : 2,
                        borderColor: on ? colors.blue : '#AEB5C4',
                      }}
                    />
                    <T style={{ fontSize: 14.5, fontWeight: '700' }}>{REPORT_REASONS[k].ad}</T>
                  </Pressable>
                );
              })}
            </View>
            <T style={{ fontSize: 13, fontWeight: '700', marginTop: 12 }}>Açıklama (isteğe bağlı)</T>
            <TInput
              value={aciklama}
              onChangeText={setAciklama}
              maxLength={500}
              multiline
              placeholder="Ne oldu? Kısaca yaz."
              accessibilityLabel="Açıklama"
              style={{
                marginTop: 6,
                borderWidth: 1,
                borderColor: '#D5DAE5',
                borderRadius: 12,
                padding: 12,
                minHeight: 72,
                fontSize: 14.5,
                textAlignVertical: 'top',
              }}
            />
            {hata ? (
              <T
                accessibilityRole="alert"
                style={{ marginTop: 8, fontSize: 13, color: '#A3271F', fontWeight: '700' }}
              >
                {hata}
              </T>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <Pressable
                accessibilityRole="button"
                onPress={kapa}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: '#D5DAE5',
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: 'center',
                }}
              >
                <T style={{ fontSize: 15, fontWeight: '700' }}>Vazgeç</T>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !neden }}
                onPress={gonder}
                style={{
                  flex: 1,
                  backgroundColor: neden ? '#E5484D' : '#F3C9C7',
                  borderRadius: 14,
                  paddingVertical: 15,
                  alignItems: 'center',
                }}
              >
                <T style={{ fontSize: 15.5, fontWeight: '800', color: '#FFFFFF' }}>Şikayet et</T>
              </Pressable>
            </View>
          </ScrollView>
        ) : (
          <View>
            <T accessibilityRole="header" style={{ fontSize: 18, fontWeight: '800' }}>
              Şikayetin alındı
            </T>
            <T style={{ fontSize: 14, color: '#3A4052', marginTop: 8, lineHeight: 21 }}>
              S-{no} numarasıyla inceleniyor. Sonuçlanınca sana bildirim göndereceğiz.
            </T>
            <Pressable
              accessibilityRole="button"
              onPress={kapa}
              style={{
                marginTop: 16,
                backgroundColor: colors.blue,
                borderRadius: 14,
                paddingVertical: 15,
                alignItems: 'center',
              }}
            >
              <T style={{ fontSize: 15.5, fontWeight: '800' }}>Tamam</T>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}
