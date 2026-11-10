import { colors, MESSAGE_MAX, radii } from '@rengarenk/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useOturum } from '../lib/oturum';
import { T } from './t';

interface Durum {
  kendi?: boolean;
  yazildi?: string | null;
  hesap?: string;
  hesaplar: { id: string; ad: string; galeri: boolean }[];
  gunluk: { toplam: number; kalan: number } | null;
  ek: number;
  engel: string | null;
}

/**
 * İlk mesaj (tasarım: GaleriMobil.dc.html › İlk mesaj): alttan açılan pencere. Galeri adına yazılıyorsa araç kartı
 * eklenir. Pencere açılınca taslak gelir (Karar 42): galeride eşleştirmenin en uygun bulduğu araç önerilir; "✦ Taslağı
 * yeniden yaz" başka bir taslak getirir. Gönderen her zaman satıcıdır.
 */
export function IlkMesaj({
  acik,
  talepNo,
  talepBaslik,
  sahip,
  hesap,
  arac,
  kapat,
  gonderildi,
}: {
  acik: boolean;
  talepNo: number;
  talepBaslik: string;
  sahip?: string;
  hesap?: string;
  arac?: { id: string; ad: string } | null;
  kapat: () => void;
  gonderildi: (sohbetId: string) => void;
}) {
  const { istek } = useOturum();
  const [d, setD] = useState<Durum | null>(null);
  const [metin, setMetin] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const [secArac, setSecArac] = useState(arac ?? null);
  const [sira, setSira] = useState(0);
  const [yaziyor, setYaziyor] = useState(false);
  const elle = useRef(false);

  useEffect(() => {
    if (!acik) return;
    setHata(null);
    istek<Durum>(`/talepler/${talepNo}/mesaj${hesap ? `?hesap=${hesap}` : ''}`)
      .then(setD)
      .catch((e: Error) => setHata(e.message));
  }, [acik, talepNo, hesap, istek]);

  const galeri = d?.hesaplar.find((h) => h.id === (hesap ?? d.hesap))?.galeri ?? false;
  const taslakGetir = useCallback(
    async (n: number, zorla = false) => {
      if (!d || d.kendi || d.yazildi || (elle.current && !zorla)) return;
      setYaziyor(true);
      try {
        const r = await istek<{ metin: string; arac: { id: string; ad: string } | null }>(
          `/talepler/${talepNo}/mesaj/taslak`,
          {
            method: 'POST',
            body: {
              sira: n,
              ...(galeri && hesap ? { hesap } : {}),
              ...(galeri && secArac ? { aracId: secArac.id } : {}),
            },
          },
        );
        setMetin(r.metin);
        elle.current = false;
        if (r.arac && !secArac) setSecArac(r.arac);
      } catch {
        // Taslak gelmezse kişi kendisi yazar
      } finally {
        setYaziyor(false);
      }
    },
    [d, galeri, hesap, secArac, talepNo, istek],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: pencere ve hesap durumu gelince bir kez
  useEffect(() => {
    if (acik) taslakGetir(0);
  }, [acik, d]);

  const hakVar = (d?.gunluk?.kalan ?? 0) > 0 || (d?.ek ?? 0) > 0;
  const pasif = mesgul || !metin.trim() || !d || !!d.engel || !hakVar;

  async function gonder() {
    setMesgul(true);
    setHata(null);
    try {
      const r = await istek<{ id: string }>(`/talepler/${talepNo}/mesaj`, {
        method: 'POST',
        body: {
          metin,
          ...(galeri && hesap ? { hesap } : {}),
          ...(galeri && secArac ? { aracId: secArac.id } : {}),
        },
      });
      setMetin('');
      gonderildi(r.id);
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setMesgul(false);
    }
  }

  return (
    <Modal visible={acik} transparent animationType="slide" onRequestClose={kapat}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable
          accessibilityLabel="Kapat"
          onPress={kapat}
          style={{ flex: 1, backgroundColor: 'rgba(30,35,51,0.45)' }}
        />
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 10,
            paddingHorizontal: 18,
            paddingBottom: 26,
            maxHeight: '88%',
          }}
        >
          <View
            style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#D5DAE5' }}
          />
          <ScrollView keyboardShouldPersistTaps="handled">
            <T accessibilityRole="header" style={{ fontSize: 18, fontWeight: '800', marginTop: 12 }}>
              İlk mesaj
            </T>
            <T style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
              {[talepBaslik, sahip].filter(Boolean).join(' · ')}
            </T>
            {galeri && secArac ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  marginTop: 12,
                  backgroundColor: '#FFF6DF',
                  borderRadius: radii.buton,
                  padding: 10,
                }}
              >
                <View style={{ width: 52, height: 34, borderRadius: 8, backgroundColor: '#E5D8B5' }} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T numberOfLines={1} style={{ fontSize: 14, fontWeight: '800' }}>
                    {secArac.ad}
                  </T>
                  <T style={{ fontSize: 12, color: '#7A5300', marginTop: 1 }}>
                    Araç kartı mesaja eklenir · EİDS doğrulandı
                  </T>
                </View>
              </View>
            ) : null}
            <T style={{ fontSize: 13.5, fontWeight: '700', marginTop: 14, marginBottom: 6 }}>Mesajın</T>
            <TextInput
              accessibilityLabel="Mesajın"
              multiline
              maxLength={MESSAGE_MAX}
              value={metin}
              onChangeText={(s) => {
                elle.current = true;
                setMetin(s);
              }}
              placeholder="Merhaba, aradığınız kriterlere uyan aracım var…"
              placeholderTextColor={colors.muted}
              style={{
                minHeight: 120,
                borderWidth: 1,
                borderColor: '#D5DAE5',
                borderRadius: radii.buton,
                padding: 12,
                fontSize: 14.5,
                lineHeight: 21,
                textAlignVertical: 'top',
                fontFamily: 'PlusJakartaSans_400Regular',
                color: colors.ink,
              }}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <Pressable
                accessibilityRole="button"
                disabled={yaziyor}
                onPress={() => {
                  const n = sira + 1;
                  setSira(n);
                  taslakGetir(n, true);
                }}
                style={{ paddingVertical: 6 }}
              >
                <T style={{ fontSize: 13, fontWeight: '700', color: '#2450C8' }}>
                  {yaziyor ? 'Yazılıyor…' : '✦ Taslağı yeniden yaz'}
                </T>
              </Pressable>
              <T style={{ fontSize: 12, color: colors.muted, paddingVertical: 6 }}>
                {metin.length} / {MESSAGE_MAX}
              </T>
            </View>
            <T style={{ fontSize: 12, color: colors.muted, lineHeight: 17, marginTop: 4 }}>
              Yalnızca metin. Telefon, IBAN, bağlantı yazma ve kapora isteme. Alıcı cevap verene kadar ikinci
              mesaj atılamaz.
            </T>
            {d?.gunluk ? (
              <T style={{ fontSize: 12.5, color: '#3A4052', marginTop: 8 }}>
                {galeri ? 'Bugün kalan ilk mesaj hakkın' : 'Bugün kalan ücretsiz mesaj hakkın'}:{' '}
                <T style={{ fontSize: 12.5, fontWeight: '800' }}>
                  {d.gunluk.kalan} / {d.gunluk.toplam}
                </T>
                {d.ek ? ` · ek hak ${d.ek}` : ''}
                {!hakVar ? ' · Bugünkü hakkın bitti.' : ''}
              </T>
            ) : null}
            {hata || d?.engel ? (
              <T accessibilityRole="alert" style={{ fontSize: 13, color: '#A3271F', marginTop: 8 }}>
                {hata ?? d?.engel}
              </T>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Pressable
                accessibilityRole="button"
                onPress={kapat}
                style={{
                  backgroundColor: '#F3F5FA',
                  borderRadius: radii.buton,
                  paddingVertical: 14,
                  paddingHorizontal: 18,
                }}
              >
                <T style={{ fontSize: 15, fontWeight: '700' }}>Vazgeç</T>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: pasif }}
                disabled={pasif}
                onPress={gonder}
                style={{
                  flex: 1,
                  backgroundColor: colors.blue,
                  borderRadius: radii.buton,
                  paddingVertical: 14,
                  alignItems: 'center',
                  opacity: pasif ? 0.55 : 1,
                }}
              >
                <T style={{ fontSize: 15, fontWeight: '800' }}>
                  {mesgul ? 'Gönderiliyor…' : 'Gönder · 1 hak kullanılır'}
                </T>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
