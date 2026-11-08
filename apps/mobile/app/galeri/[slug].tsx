import { colors } from '@rengarenk/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Share, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Ikon } from '../../components/ikon';
import { T } from '../../components/t';
import { API } from '../../lib/api';
import { basHarf } from '../../lib/oturum';

interface Profil {
  slug: string;
  ad: string;
  isletmeAdi: string;
  yetkiNo: string | null;
  tur: string;
  il: string;
  ilce: string;
  adres: string;
  hakkinda: string | null;
  calismaSaatleri: string | null;
  uyelik: string;
  satisTemsilcisi: number;
  portfoy: { toplam: number };
}

/** Yıla gelen ek: 2026’dan, 2027’den */
function yilEki(yil: number) {
  const birler = ['', 'den', 'den', 'ten', 'ten', 'ten', 'dan', 'den', 'den', 'dan'];
  const onlar = ['den', 'dan', 'den', 'dan', 'tan', 'den', 'tan', 'ten', 'den', 'dan'];
  return yil % 10 ? birler[yil % 10] : onlar[Math.floor(yil / 10) % 10];
}

/**
 * Galeri profili (tasarım: GaleriProfilMobil.dc.html; Karar 07, 17). İşletme adı ve yetki belgesi profilde görünür
 * (yönetmelik m.21). Portföy Sprint 10'da; hızlı yanıt ve güvenilir satıcı rozetleri puan modülüyle (Karar 55).
 */
export default function GaleriProfili() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [p, setP] = useState<Profil | null | 'yok'>(null);
  const [araclar, setAraclar] = useState<
    { no: number; ad: string; ozellik: string; fiyat: number; foto: string | null }[]
  >([]);
  useEffect(() => {
    fetch(`${API}/galeriler/${encodeURIComponent(slug)}/araclar`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setAraclar)
      .catch(() => undefined);
  }, [slug]);
  useEffect(() => {
    fetch(`${API}/galeriler/${encodeURIComponent(slug)}`)
      .then((r): Promise<Profil | 'yok'> => (r.ok ? (r.json() as Promise<Profil>) : Promise.resolve('yok')))
      .then((x) => setP(x))
      .catch(() => setP('yok'));
  }, [slug]);

  const profil = p && p !== 'yok' ? p : null;
  const uyelik = profil
    ? `${new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', month: 'long', year: 'numeric' }).format(new Date(profil.uyelik))}’${yilEki(new Date(profil.uyelik).getFullYear())} beri Rengarenk’te`
    : '';

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
        <T numberOfLines={1} accessibilityRole="header" style={{ flex: 1, fontSize: 16, fontWeight: '800' }}>
          {profil?.ad ?? 'Galeri'}
        </T>
        {profil ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Paylaş"
            onPress={() =>
              Share.share({ message: `${profil.ad} · https://rengarenk.com.tr/galeri/${profil.slug}` }).catch(
                () => undefined,
              )
            }
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 15V3M7 8l5-5 5 5M5 13v7h14v-7"
                stroke={colors.ink}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {p === 'yok' ? <T style={{ margin: 16, color: colors.muted }}>Galeri bulunamadı.</T> : null}
        {p === null ? <T style={{ margin: 16, color: colors.muted }}>Yükleniyor…</T> : null}
        {profil ? (
          <>
            <View
              style={{
                backgroundColor: colors.surface,
                borderBottomWidth: 1,
                borderBottomColor: colors.line,
                padding: 16,
              }}
            >
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 18,
                    backgroundColor: '#FFF6DF',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <T style={{ color: '#7A5300', fontSize: 20, fontWeight: '800' }}>{basHarf(profil.ad)}</T>
                </View>
                <View style={{ flex: 1 }}>
                  <T style={{ fontSize: 21, fontWeight: '800' }}>{profil.ad}</T>
                  <T style={{ fontSize: 12.5, color: colors.muted, marginTop: 3 }}>{uyelik}</T>
                </View>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                <T
                  style={{
                    fontSize: 12,
                    fontWeight: '800',
                    paddingVertical: 4,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    overflow: 'hidden',
                    backgroundColor: '#E7FAF0',
                    color: '#11683F',
                  }}
                >
                  ✓ Onaylı {profil.tur.toLocaleLowerCase('tr-TR')}
                </T>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                {[
                  [String(profil.portfoy.toplam), 'yayında araç'],
                  ['—', 'ortalama yanıt'],
                  [String(profil.satisTemsilcisi), 'satış temsilcisi'],
                ].map(([d, k]) => (
                  <View
                    key={k}
                    style={{
                      flex: 1,
                      backgroundColor: '#F6F8FD',
                      borderRadius: 12,
                      padding: 10,
                      alignItems: 'center',
                    }}
                  >
                    <T style={{ fontSize: 17, fontWeight: '800' }}>{d}</T>
                    <T style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>{k}</T>
                  </View>
                ))}
              </View>
              <T style={{ marginTop: 12, fontSize: 12.5, color: '#3A4052', lineHeight: 19 }}>
                {profil.il}, {profil.ilce} · {profil.adres}
                {profil.calismaSaatleri ? `\n${profil.calismaSaatleri}` : ''}
              </T>
              <T
                accessibilityRole="link"
                onPress={() =>
                  Linking.openURL(
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${profil.adres}, ${profil.ilce}, ${profil.il}`)}`,
                  )
                }
                style={{ marginTop: 8, fontSize: 13, fontWeight: '700', color: colors.link }}
              >
                Haritada aç
              </T>
            </View>

            <T
              accessibilityRole="header"
              style={{
                marginTop: 16,
                marginHorizontal: 16,
                marginBottom: 8,
                fontSize: 16,
                fontWeight: '800',
              }}
            >
              Portföy · {profil.portfoy.toplam} araç
            </T>
            {araclar.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12 }}>
                {araclar.map((a) => (
                  <Pressable
                    key={a.no}
                    accessibilityRole="link"
                    onPress={() => router.push(`/arac/${a.no}`)}
                    style={{
                      width: '48.5%',
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.line,
                      borderRadius: 16,
                      overflow: 'hidden',
                    }}
                  >
                    <View style={{ height: 96, backgroundColor: '#DCE3F0' }}>
                      {a.foto ? (
                        <Image
                          source={{ uri: `${API}${a.foto}` }}
                          style={{ width: '100%', height: '100%' }}
                        />
                      ) : null}
                    </View>
                    <View style={{ paddingTop: 8, paddingHorizontal: 10, paddingBottom: 10 }}>
                      <T numberOfLines={2} style={{ fontSize: 13, fontWeight: '800', lineHeight: 17 }}>
                        {a.ad}
                      </T>
                      <T numberOfLines={1} style={{ fontSize: 11.5, color: colors.muted, marginTop: 3 }}>
                        {a.ozellik}
                      </T>
                      <T style={{ fontSize: 13.5, fontWeight: '800', color: colors.link, marginTop: 5 }}>
                        {new Intl.NumberFormat('tr-TR').format(a.fiyat)} TL
                      </T>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View
                style={{
                  marginHorizontal: 12,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: '#C9CFDB',
                  borderRadius: 16,
                  padding: 20,
                  alignItems: 'center',
                }}
              >
                <T style={{ fontSize: 13.5, color: colors.muted }}>Bu galerinin henüz yayında aracı yok.</T>
              </View>
            )}

            <View
              style={{
                marginTop: 16,
                marginHorizontal: 12,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.line,
                borderRadius: 16,
                padding: 14,
              }}
            >
              <T style={{ fontSize: 15, fontWeight: '800', marginBottom: 6 }}>Hakkında</T>
              {profil.hakkinda ? (
                <T style={{ fontSize: 13, color: '#3A4052', lineHeight: 20 }}>{profil.hakkinda}</T>
              ) : null}
              <T
                style={{
                  marginTop: profil.hakkinda ? 10 : 0,
                  fontSize: 12,
                  color: colors.muted,
                  lineHeight: 18,
                }}
              >
                Ticari unvan: {profil.isletmeAdi}
                {profil.yetkiNo
                  ? ` · Yetki belgesi no ${profil.yetkiNo} · Bakanlık sisteminden doğrulandı`
                  : ''}
              </T>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
