import { colors, MESSAGE_MAX, PAINT_STATES } from '@rengarenk/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ikon } from '../../components/ikon';
import { Sikayet } from '../../components/sikayet';
import { T } from '../../components/t';
import { API } from '../../lib/api';
import { useOturum } from '../../lib/oturum';

interface Arac {
  no: number;
  ad: string;
  baslik: string;
  galeri: { slug: string; ad: string; isletmeAdi: string; yetkiNo: string | null };
  temsilci: string | null;
  fotolar: string[];
  bilgiler: [string, string][];
  hasar: {
    ozet: string;
    parcalar: { key: string; ad: string; durum: string }[];
    durumlar: { key: string; ad: string; renk: string; sayi: number }[];
    satirlar: [string, string, boolean][];
  };
  ekspertiz: { tarih: string; url: string } | null;
  aciklama: string | null;
  fiyat: number;
  dogrulamalar: string[];
}

const DURUM_AD: Record<string, string> = {
  orijinal: 'Orijinal',
  lokal: 'Lokal boyalı',
  boya: 'Boyalı',
  degisen: 'Değişen',
};
const tarih = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
const kart = {
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.line,
  borderRadius: 16,
} as const;

/**
 * Portföy aracı (tasarım: GaleriProfilMobil.dc.html › araç; Karar 07, 17, 27): yalnızca yayındaki araç. "Bu araç
 * için mesaj gönder" galeriyle araç kartıyla başlayan sohbet açar (alıcıya ücretsiz); WhatsApp ve telefon girişli
 * kullanıcıya temsilcinin numarasıyla açılır. Şikayet Aşama 8'de.
 */
export default function AracEkrani() {
  const { no } = useLocalSearchParams<{ no: string }>();
  const [sikayet, setSikayet] = useState(false);
  const { durum, istek } = useOturum();
  const [a, setA] = useState<Arac | null | 'yok'>(null);
  const [foto, setFoto] = useState(0);
  const [yaz, setYaz] = useState(false);
  const [metin, setMetin] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);
  async function gonder() {
    setMesgul(true);
    setHata(null);
    try {
      const r = await istek<{ id: string }>(`/araclar/${no}/mesaj`, { method: 'POST', body: { metin } });
      setYaz(false);
      setMetin('');
      router.push(`/sohbet/${r.id}`);
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setMesgul(false);
    }
  }
  const genislik = Dimensions.get('window').width;

  useEffect(() => {
    fetch(`${API}/araclar/${no}`)
      .then((r): Promise<Arac | 'yok'> => (r.ok ? (r.json() as Promise<Arac>) : Promise.resolve('yok')))
      .then((x) => setA(x))
      .catch(() => setA('yok'));
  }, [no]);

  async function whatsapp() {
    if (durum !== 'uye') {
      router.push('/giris');
      return;
    }
    const t = await istek<{ phone: string | null }>(`/araclar/${no}/iletisim`).catch(() => null);
    if (t?.phone) Linking.openURL(`https://wa.me/${t.phone.replace(/\D/g, '')}`);
  }

  const arac = a && a !== 'yok' ? a : null;
  const ozel = arac?.hasar.parcalar.filter((p) => p.durum !== 'orijinal') ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top', 'bottom']}>
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
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ikon d="geri" />
        </Pressable>
        <T numberOfLines={1} accessibilityRole="header" style={{ flex: 1, fontSize: 16, fontWeight: '800' }}>
          {arac?.galeri.ad ?? 'Araç'}
        </T>
      </View>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {a === 'yok' ? (
          <T style={{ margin: 16, color: colors.muted }}>Araç bulunamadı ya da yayından kalktı.</T>
        ) : null}
        {a === null ? <T style={{ margin: 16, color: colors.muted }}>Yükleniyor…</T> : null}
        {arac ? (
          <>
            <View style={{ height: 250, backgroundColor: '#DCE3F0' }}>
              <FlatList
                data={arac.fotolar}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(f) => f}
                onMomentumScrollEnd={(e) => setFoto(Math.round(e.nativeEvent.contentOffset.x / genislik))}
                renderItem={({ item, index }) => (
                  <Image
                    source={{ uri: `${API}${item}` }}
                    accessibilityLabel={`${arac.ad}, fotoğraf ${index + 1}`}
                    style={{ width: genislik, height: 250 }}
                    resizeMode="cover"
                  />
                )}
              />
              <T
                style={{
                  position: 'absolute',
                  right: 12,
                  top: 12,
                  fontSize: 12,
                  fontWeight: '800',
                  paddingVertical: 4,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  overflow: 'hidden',
                  backgroundColor: 'rgba(30,35,51,0.72)',
                  color: '#FFFFFF',
                }}
              >
                {foto + 1} / {arac.fotolar.length}
              </T>
              <T
                style={{
                  position: 'absolute',
                  left: 12,
                  bottom: 10,
                  fontSize: 11.5,
                  color: '#3A4052',
                  backgroundColor: 'rgba(255,255,255,0.85)',
                  paddingHorizontal: 6,
                  borderRadius: 6,
                  overflow: 'hidden',
                }}
              >
                Galerinin yüklediği fotoğraf
              </T>
            </View>
            <View
              style={{
                backgroundColor: colors.surface,
                borderBottomWidth: 1,
                borderBottomColor: colors.line,
                paddingVertical: 14,
                paddingHorizontal: 16,
              }}
            >
              <T style={{ fontSize: 19, fontWeight: '800', lineHeight: 25 }}>{arac.ad}</T>
              <T style={{ marginTop: 4, fontSize: 13, color: colors.muted }}>
                {arac.baslik.split(' · ').slice(1).join(' · ')} · Portföy no {arac.no}
              </T>
              <T style={{ marginTop: 10, fontSize: 22, fontWeight: '800', color: colors.link }}>
                {new Intl.NumberFormat('tr-TR').format(arac.fiyat)} TL
              </T>
              <T
                accessibilityRole="link"
                onPress={() => router.push(`/galeri/${arac.galeri.slug}`)}
                style={{ marginTop: 8, fontSize: 13, fontWeight: '700', color: colors.link }}
              >
                {arac.galeri.ad}
                {arac.temsilci ? ` · Satış temsilcisi ${arac.temsilci}` : ''}
              </T>
            </View>

            <View style={{ ...kart, marginTop: 12, marginHorizontal: 12, overflow: 'hidden' }}>
              <T
                style={{
                  paddingTop: 14,
                  paddingHorizontal: 14,
                  paddingBottom: 6,
                  fontSize: 15,
                  fontWeight: '800',
                }}
              >
                Araç bilgileri
              </T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {arac.bilgiler.map(([k, v]) => (
                  <View
                    key={k}
                    style={{
                      width: '50%',
                      paddingVertical: 9,
                      paddingHorizontal: 14,
                      borderTopWidth: 1,
                      borderTopColor: '#EEF0F5',
                    }}
                  >
                    <T style={{ fontSize: 11.5, color: colors.muted }}>{k}</T>
                    <T style={{ marginTop: 2, fontSize: 13.5, fontWeight: '700' }}>{v}</T>
                  </View>
                ))}
              </View>
            </View>

            <View style={{ ...kart, marginTop: 10, marginHorizontal: 12, padding: 14 }}>
              <T style={{ fontSize: 15, fontWeight: '800', marginBottom: 8 }}>Boya, değişen ve hasar</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 6 }}>
                {arac.hasar.durumlar.map((d) => (
                  <View
                    key={d.key}
                    style={{ width: '50%', flexDirection: 'row', alignItems: 'center', gap: 8 }}
                  >
                    <View
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 4,
                        backgroundColor: PAINT_STATES.find((s) => s.key === d.key)?.renk,
                      }}
                    />
                    <T style={{ fontSize: 12.5, fontWeight: '700' }}>
                      {DURUM_AD[d.key]} · {d.sayi || 'yok'}
                    </T>
                  </View>
                ))}
              </View>
              <T style={{ marginTop: 10, fontSize: 12.5, color: '#3A4052', lineHeight: 18 }}>
                {[
                  ...ozel.map((p) => `${p.ad} ${DURUM_AD[p.durum]?.toLocaleLowerCase('tr-TR')}`),
                  ...arac.hasar.satirlar
                    .filter(([, , iyi]) => !iyi)
                    .map(([k, v]) => `${k.toLocaleLowerCase('tr-TR')} ${v}`),
                ].join(' · ') || 'Boya, değişen ve hasar kaydı yok'}
              </T>
              {arac.ekspertiz ? (
                <Pressable
                  accessibilityRole="link"
                  onPress={() => Linking.openURL(`${API}${arac.ekspertiz?.url}`)}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginTop: 10,
                    paddingVertical: 11,
                    paddingHorizontal: 12,
                    borderWidth: 1,
                    borderColor: colors.line,
                    borderRadius: 12,
                  }}
                >
                  <T style={{ fontSize: 13, fontWeight: '700' }}>
                    Ekspertiz raporu · {tarih(arac.ekspertiz.tarih)}
                  </T>
                  <T style={{ fontSize: 13, fontWeight: '700', color: colors.link }}>PDF’i aç</T>
                </Pressable>
              ) : null}
              <T style={{ marginTop: 8, fontSize: 11.5, color: colors.muted, lineHeight: 17 }}>
                Bilgiler galerinin beyanıdır; ekspertiz raporuyla karşılaştır.
              </T>
            </View>

            {arac.aciklama ? (
              <View style={{ ...kart, marginTop: 10, marginHorizontal: 12, padding: 14 }}>
                <T style={{ fontSize: 15, fontWeight: '800', marginBottom: 6 }}>Galerinin açıklaması</T>
                <T style={{ fontSize: 13, color: '#3A4052', lineHeight: 20 }}>{arac.aciklama}</T>
              </View>
            ) : null}

            <View style={{ ...kart, marginTop: 10, marginHorizontal: 12, padding: 14 }}>
              <T style={{ fontSize: 15, fontWeight: '800', marginBottom: 8 }}>Doğrulamalar</T>
              {arac.dogrulamalar.map((d) => (
                <T key={d} style={{ marginBottom: 6, fontSize: 12.5, color: '#11683F', lineHeight: 18 }}>
                  ✓ {d}
                </T>
              ))}
              <T
                style={{
                  marginTop: 4,
                  paddingTop: 10,
                  borderTopWidth: 1,
                  borderTopColor: '#EEF0F5',
                  fontSize: 12,
                  color: colors.muted,
                  lineHeight: 17,
                }}
              >
                Aracı görmeden kapora veya ön ödeme gönderme. Ödemeyi noterde satış sırasında yap.
              </T>
            </View>
            <T
              accessibilityRole="button"
              onPress={() => (durum === 'uye' ? setSikayet(true) : router.push('/giris'))}
              style={{
                marginTop: 12,
                marginHorizontal: 16,
                fontSize: 13.5,
                fontWeight: '700',
                color: '#A3271F',
                paddingVertical: 6,
              }}
            >
              Bu ilanı şikayet et
            </T>
            <Sikayet acik={sikayet} hedef="arac" id={String(arac.no)} kapat={() => setSikayet(false)} />
          </>
        ) : null}
      </ScrollView>
      {arac ? (
        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            paddingTop: 12,
            paddingHorizontal: 16,
            paddingBottom: 12,
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.line,
          }}
        >
          <Pressable
            accessibilityRole="button"
            onPress={whatsapp}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: '#D5DAE5',
              borderRadius: 14,
              paddingVertical: 14,
              alignItems: 'center',
            }}
          >
            <T style={{ fontSize: 14.5, fontWeight: '700' }}>WhatsApp</T>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => (durum === 'uye' ? setYaz(true) : router.push('/giris'))}
            style={{
              flex: 2,
              backgroundColor: '#5B8CFF',
              borderRadius: 14,
              paddingVertical: 15,
              paddingHorizontal: 8,
              alignItems: 'center',
            }}
          >
            <T style={{ fontSize: 15, fontWeight: '800' }}>Bu araç için mesaj gönder</T>
          </Pressable>
        </View>
      ) : null}
      <Modal visible={yaz} transparent animationType="slide" onRequestClose={() => setYaz(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Pressable
            accessibilityLabel="Kapat"
            onPress={() => setYaz(false)}
            style={{ flex: 1, backgroundColor: 'rgba(30,35,51,0.45)' }}
          />
          <View
            accessibilityViewIsModal
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 16,
              paddingHorizontal: 18,
              paddingBottom: 26,
            }}
          >
            <T accessibilityRole="header" style={{ fontSize: 18, fontWeight: '800' }}>
              Galeriye mesaj
            </T>
            <T style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
              {arac ? `${arac.ad} · ${arac.galeri.ad}` : ''}
            </T>
            <TextInput
              accessibilityLabel="Mesajın"
              multiline
              maxLength={MESSAGE_MAX}
              value={metin}
              onChangeText={setMetin}
              placeholder="Merhaba, araç hâlâ satışta mı? Görmeye gelebilir miyim?"
              placeholderTextColor={colors.muted}
              style={{
                minHeight: 110,
                marginTop: 12,
                borderWidth: 1,
                borderColor: '#D5DAE5',
                borderRadius: 14,
                padding: 12,
                fontSize: 14.5,
                textAlignVertical: 'top',
                fontFamily: 'PlusJakartaSans_400Regular',
                color: colors.ink,
              }}
            />
            <T style={{ fontSize: 12, color: colors.muted, lineHeight: 17, marginTop: 6 }}>
              Sohbet bu aracın kartıyla başlar. Yalnızca metin. Kapora istemeyin ve vermeyin.
            </T>
            {hata ? (
              <T accessibilityRole="alert" style={{ fontSize: 13, color: '#A3271F', marginTop: 6 }}>
                {hata}
              </T>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={mesgul || !metin.trim()}
              onPress={gonder}
              style={{
                marginTop: 14,
                backgroundColor: '#5B8CFF',
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: 'center',
                opacity: mesgul || !metin.trim() ? 0.55 : 1,
              }}
            >
              <T style={{ fontSize: 15, fontWeight: '800' }}>{mesgul ? 'Gönderiliyor…' : 'Gönder'}</T>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
