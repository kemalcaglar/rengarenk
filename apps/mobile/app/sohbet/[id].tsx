import { colors, MESSAGE_MAX } from '@rengarenk/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { type ComponentRef, useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { PuanVer } from '../../components/puan-ver';
import { Sikayet } from '../../components/sikayet';
import { T } from '../../components/t';
import { API } from '../../lib/api';
import { useCanli } from '../../lib/canli';
import { useOturum } from '../../lib/oturum';

interface Mesaj {
  id: string;
  tip: 'metin' | 'kart' | 'sistem';
  yon: 'gelen' | 'giden' | 'sistem';
  metin: string;
  zaman: string;
  gonderen: string | null;
  kart: { no: number; ad: string; ozet: string; fiyat: number; foto: string | null; satista: boolean } | null;
  uyari: { baslik: string; metin: string } | null;
  /** Moderasyon gizledi (Karar 53) */
  gizli?: boolean;
}
interface Sohbet {
  id: string;
  taraf: 'alici' | 'satici';
  durum: 'WAITING' | 'OPEN' | 'DECLINED';
  karsi: {
    ad: string;
    bas: string;
    alt: string;
    galeri: { slug: string } | null;
    telefon: string | null;
    rozetler: { key: string; ad: string; bg: string; renk: string }[];
  };
  puan: { uygun: boolean; verilen: number | null };
  talep: { no: number; baslik: string } | null;
  arac: { no: number; ad: string } | null;
  numaraPaylasildi: boolean;
  engelli: boolean;
  ilkMesajBekliyor: boolean;
  yazabilir: boolean;
  /** Karşı taraf hesabını kapattı (Karar 31) */
  kapali?: boolean;
  mesajlar: Mesaj[];
}

const saat = (iso: string) =>
  new Date(iso).toLocaleTimeString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    minute: '2-digit',
  });
const gun = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' });
function gunAdi(iso: string) {
  if (gun(iso) === gun(new Date().toISOString())) return 'Bugün';
  if (gun(iso) === gun(new Date(Date.now() - 86_400_000).toISOString())) return 'Dün';
  return new Date(iso).toLocaleDateString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: 'numeric',
    month: 'long',
  });
}
const binlik = (n: number) => new Intl.NumberFormat('tr-TR').format(n);

/**
 * Sohbet (tasarım: MesajMobil.dc.html; Karar 08, 11, 25, 26). Üstte karşı taraf ve diğer işlemler (numaramı paylaş,
 * engelle; şikayet moderasyonla gelir), altında talep ya da araç bağlantısı. Satıcının şüpheli mesajının altında
 * alıcıya kırmızı uyarı bandı. Yeni mesajlar WebSocket ile gelir.
 */
export default function SohbetEkrani() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { istek } = useOturum();
  const [s, setS] = useState<Sohbet | null>(null);
  const [metin, setMetin] = useState('');
  const [yanitla, setYanitla] = useState(false);
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [puanAcik, setPuanAcik] = useState(false);
  const [sikayet, setSikayet] = useState<string | null>(null);
  const kaydir = useRef<ComponentRef<typeof ScrollView>>(null);

  const yukle = useCallback(() => {
    istek<Sohbet>(`/conversations/${id}`)
      .then(setS)
      .catch((e: Error) => setHata(e.message));
  }, [id, istek]);
  useEffect(yukle, [yukle]);
  useCanli((o) => {
    if (o.tip === 'sohbet' && o.id === id) yukle();
  });

  async function islem(fn: () => Promise<Sohbet>) {
    setMesgul(true);
    setHata(null);
    try {
      setS(await fn());
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setMesgul(false);
    }
  }
  const gonder = () =>
    islem(() => istek<Sohbet>(`/conversations/${id}/messages`, { method: 'POST', body: { metin } })).then(
      () => {
        setMetin('');
        setYanitla(false);
      },
    );

  function diger() {
    if (!s) return;
    const secenekler: [string, () => void, boolean?][] = [];
    if (s.puan.uygun) secenekler.push(['Puan ver', () => setPuanAcik(true)]);
    if (s.taraf === 'alici' && s.durum === 'OPEN' && !s.numaraPaylasildi) {
      secenekler.push([
        'Numaramı paylaş',
        () => islem(() => istek<Sohbet>(`/conversations/${id}/share-phone`, { method: 'POST' })),
      ]);
    }
    if (s.karsi.galeri && s.taraf === 'alici') {
      secenekler.push(['Galeri profili', () => router.push(`/galeri/${s.karsi.galeri?.slug}`)]);
    }
    if (s.taraf === 'alici') {
      secenekler.push([
        s.engelli ? 'Engeli kaldır' : 'Engelle',
        () =>
          islem(() => istek<Sohbet>(`/conversations/${id}/block`, { method: s.engelli ? 'DELETE' : 'POST' })),
        !s.engelli,
      ]);
    }
    // Şikayet (Karar 53): karşı tarafın son mesajı; tek tek mesaj için mesajın altındaki "Şikayet et"
    const son = [...s.mesajlar].reverse().find((m) => m.yon === 'gelen' && m.tip === 'metin' && !m.gizli);
    if (son) secenekler.push(['Şikayet et', () => setSikayet(son.id), true]);
    if (!secenekler.length) return;
    Alert.alert(s.karsi.ad, undefined, [
      ...secenekler.map(([t, f, d]) => ({
        text: t,
        onPress: f,
        style: d ? ('destructive' as const) : undefined,
      })),
      { text: 'Vazgeç', style: 'cancel' as const },
    ]);
  }

  const besteci = s?.yazabilir && (!s.ilkMesajBekliyor || yanitla);
  let sonGun = '';
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View
          style={{
            borderBottomWidth: 1,
            borderBottomColor: colors.line,
            paddingTop: 8,
            paddingHorizontal: 8,
            paddingBottom: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Geri"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/mesajlar'))}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path
                d="M15 5l-7 7 7 7"
                stroke={colors.ink}
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: s?.karsi.galeri ? '#FFF6DF' : '#E7FAF0',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <T style={{ fontWeight: '800', fontSize: 13 }}>{s?.karsi.bas ?? ''}</T>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T numberOfLines={1} style={{ fontSize: 15.5, fontWeight: '800' }}>
              {s?.karsi.ad ?? ''}
            </T>
            <T numberOfLines={1} style={{ fontSize: 12, color: colors.muted }}>
              {s ? `${s.karsi.alt}${s.karsi.telefon ? ` · ${s.karsi.telefon}` : ''}` : ''}
            </T>
            {s?.karsi.rozetler.some((r) => r.key !== 'onay') || s?.puan.verilen ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 3 }}>
                {s.karsi.rozetler
                  .filter((r) => r.key !== 'onay')
                  .map((r) => (
                    <T
                      key={r.key}
                      style={{
                        fontSize: 10.5,
                        fontWeight: '800',
                        paddingVertical: 2,
                        paddingHorizontal: 7,
                        borderRadius: 999,
                        overflow: 'hidden',
                        backgroundColor: r.bg,
                        color: r.renk,
                      }}
                    >
                      {r.ad}
                    </T>
                  ))}
                {s.puan.verilen ? (
                  <T style={{ fontSize: 10.5, fontWeight: '800', color: '#7A5300' }}>
                    {'★'.repeat(s.puan.verilen)} verdin
                  </T>
                ) : null}
              </View>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Diğer işlemler: engelle, şikayet et"
            onPress={diger}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill={colors.ink}>
              <Circle cx={12} cy={5} r={1.8} />
              <Circle cx={12} cy={12} r={1.8} />
              <Circle cx={12} cy={19} r={1.8} />
            </Svg>
          </Pressable>
        </View>

        {s?.talep || s?.arac ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push(s.talep ? `/talep/${s.talep.no}` : `/arac/${s.arac?.no}`)}
            style={{
              marginTop: 10,
              marginHorizontal: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              backgroundColor: '#F6F8FD',
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: 12,
              paddingVertical: 8,
              paddingHorizontal: 10,
            }}
          >
            <View
              style={{
                width: 52,
                height: 34,
                borderRadius: 8,
                backgroundColor: '#EEF3FF',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View style={{ width: 44, height: 16, borderRadius: 10, backgroundColor: '#D7DEEB' }} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T style={{ fontSize: 11.5, color: colors.muted }}>
                {s.talep ? (s.taraf === 'alici' ? 'Talebin' : 'Talep') : 'Portföy aracı'}
              </T>
              <T numberOfLines={1} style={{ fontSize: 13, fontWeight: '700' }}>
                {s.talep?.baslik ?? s.arac?.ad}
              </T>
            </View>
          </Pressable>
        ) : null}

        <ScrollView
          ref={kaydir}
          onContentSizeChange={() => kaydir.current?.scrollToEnd({ animated: false })}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingVertical: 14,
            paddingHorizontal: 12,
            gap: 10,
            flexGrow: 1,
            justifyContent: 'flex-end',
          }}
        >
          {(s?.mesajlar ?? []).map((m) => {
            const g = gunAdi(m.zaman);
            const ayrac = g !== sonGun;
            sonGun = g;
            return (
              <View key={m.id} style={{ gap: 10 }}>
                {ayrac ? (
                  <T
                    style={{
                      alignSelf: 'center',
                      fontSize: 11.5,
                      fontWeight: '700',
                      color: colors.muted,
                      backgroundColor: '#F3F5FA',
                      paddingVertical: 4,
                      paddingHorizontal: 11,
                      borderRadius: 999,
                      overflow: 'hidden',
                    }}
                  >
                    {g}
                  </T>
                ) : null}
                <MesajBalonu m={m} sikayet={() => setSikayet(m.id)} />
              </View>
            );
          })}
        </ScrollView>

        {s?.ilkMesajBekliyor && !yanitla ? (
          <View
            style={{
              marginHorizontal: 12,
              marginBottom: 12,
              backgroundColor: '#FFF6DF',
              borderRadius: 16,
              padding: 14,
            }}
          >
            <T style={{ fontSize: 13.5, lineHeight: 20, color: '#4A3500' }}>
              <T style={{ fontSize: 13.5, fontWeight: '800', color: '#4A3500' }}>
                Bu satıcı sana ilk mesajını gönderdi.
              </T>{' '}
              Yanıtlarsan sohbet açılır. Yanıtlamazsan bu satıcı aynı talebine tekrar yazamaz.
            </T>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setYanitla(true)}
                style={{
                  backgroundColor: colors.blue,
                  borderRadius: 12,
                  paddingVertical: 11,
                  paddingHorizontal: 18,
                }}
              >
                <T style={{ fontSize: 14.5, fontWeight: '800' }}>Yanıtla</T>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={mesgul}
                onPress={() => islem(() => istek<Sohbet>(`/conversations/${id}/decline`, { method: 'POST' }))}
                style={{
                  borderWidth: 1,
                  borderColor: '#D9C48A',
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  paddingVertical: 11,
                  paddingHorizontal: 16,
                }}
              >
                <T style={{ fontSize: 14, fontWeight: '700', color: '#4A3500' }}>İlgilenmiyorum</T>
              </Pressable>
            </View>
          </View>
        ) : null}

        {s && !s.yazabilir ? (
          <T
            style={{
              borderTopWidth: 1,
              borderTopColor: colors.line,
              padding: 14,
              fontSize: 13,
              color: colors.muted,
            }}
          >
            {s.kapali
              ? 'Bu hesap kapatıldı; sohbet yalnızca okunabilir.'
              : s.durum === 'DECLINED'
                ? 'Bu sohbet kapandı; alıcı ilgilenmediğini belirtti.'
                : s.durum === 'WAITING'
                  ? 'İlk mesajın gönderildi. Alıcı yanıt verene kadar ikinci mesaj atamazsın.'
                  : 'Alıcı bu hesaptan mesaj almak istemiyor.'}
          </T>
        ) : null}
        {hata ? (
          <T
            accessibilityRole="alert"
            style={{ marginHorizontal: 14, marginBottom: 6, fontSize: 13, color: '#A3271F' }}
          >
            {hata}
          </T>
        ) : null}

        {besteci ? (
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: colors.line,
              paddingTop: 10,
              paddingHorizontal: 12,
              paddingBottom: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              <TextInput
                accessibilityLabel="Mesaj yaz"
                multiline
                maxLength={MESSAGE_MAX}
                value={metin}
                onChangeText={setMetin}
                placeholder="Mesajını yaz…"
                placeholderTextColor={colors.muted}
                style={{
                  flex: 1,
                  minWidth: 0,
                  maxHeight: 120,
                  borderWidth: 1,
                  borderColor: '#D5DAE5',
                  borderRadius: 22,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  fontSize: 15,
                  fontFamily: 'PlusJakartaSans_400Regular',
                  color: colors.ink,
                }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Gönder"
                disabled={mesgul || !metin.trim()}
                onPress={gonder}
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  backgroundColor: colors.blue,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: mesgul || !metin.trim() ? 0.55 : 1,
                }}
              >
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M4 12l16-8-6 16-2-7z"
                    stroke={colors.ink}
                    strokeWidth={2.2}
                    strokeLinejoin="round"
                  />
                </Svg>
              </Pressable>
            </View>
            <T style={{ marginTop: 6, marginHorizontal: 4, fontSize: 11.5, color: colors.muted }}>
              Yalnızca metin. Kapora istemeyin ve vermeyin.
            </T>
          </View>
        ) : null}
      </KeyboardAvoidingView>
      {s ? (
        <PuanVer
          acik={puanAcik}
          sohbet={s.id}
          ad={s.karsi.ad}
          bas={s.karsi.bas}
          alt={s.talep ? `${s.talep.baslik} talebin` : (s.arac?.ad ?? '')}
          kapat={() => setPuanAcik(false)}
          verildi={(n) => setS((x) => (x ? { ...x, puan: { uygun: false, verilen: n } } : x))}
        />
      ) : null}
      <Sikayet acik={!!sikayet} hedef="mesaj" id={sikayet ?? ''} kapat={() => setSikayet(null)} />
    </SafeAreaView>
  );
}

function MesajBalonu({ m, sikayet }: { m: Mesaj; sikayet: () => void }) {
  if (m.tip === 'sistem') {
    return (
      <T
        style={{
          alignSelf: 'center',
          maxWidth: '85%',
          textAlign: 'center',
          fontSize: 12.5,
          color: '#3A4052',
          backgroundColor: '#EEF3FF',
          borderRadius: 12,
          overflow: 'hidden',
          paddingVertical: 9,
          paddingHorizontal: 12,
        }}
      >
        {m.metin}
      </T>
    );
  }
  if (m.tip === 'kart' && m.kart) {
    const k = m.kart;
    return (
      <View
        style={{
          alignSelf: m.yon === 'giden' ? 'flex-end' : 'flex-start',
          width: 260,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: 14,
          overflow: 'hidden',
          backgroundColor: colors.surface,
        }}
      >
        <View
          style={{
            backgroundColor: '#FFF6DF',
            height: k.foto ? 130 : undefined,
            padding: k.foto ? 0 : 10,
            alignItems: 'center',
          }}
        >
          {k.foto ? (
            <Image source={{ uri: `${API}${k.foto}` }} style={{ width: '100%', height: '100%' }} />
          ) : (
            <View style={{ width: 150, height: 55, borderRadius: 10, backgroundColor: '#E5D8B5' }} />
          )}
        </View>
        <View style={{ paddingVertical: 10, paddingHorizontal: 12 }}>
          <T
            style={{
              alignSelf: 'flex-start',
              fontSize: 11,
              fontWeight: '700',
              paddingVertical: 3,
              paddingHorizontal: 8,
              borderRadius: 999,
              overflow: 'hidden',
              backgroundColor: k.satista ? '#E7FAF0' : '#F3F5FA',
              color: k.satista ? '#11683F' : colors.muted,
            }}
          >
            {k.satista ? 'EİDS doğrulandı' : 'Bu araç artık satışta değil'}
          </T>
          <T style={{ fontSize: 14, fontWeight: '800', marginTop: 6 }}>{k.ad}</T>
          <T style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{k.ozet}</T>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 8,
            }}
          >
            <T style={{ fontSize: 15, fontWeight: '800', color: colors.link }}>{binlik(k.fiyat)} TL</T>
            {k.satista ? (
              <T
                accessibilityRole="link"
                onPress={() => router.push(`/arac/${k.no}`)}
                style={{ fontSize: 13, fontWeight: '700', color: colors.link, paddingVertical: 6 }}
              >
                Portföyde gör
              </T>
            ) : null}
          </View>
        </View>
      </View>
    );
  }
  const giden = m.yon === 'giden';
  if (m.gizli) {
    return (
      <View
        style={{
          alignSelf: giden ? 'flex-end' : 'flex-start',
          maxWidth: '82%',
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: '#AEB5C4',
          borderRadius: 16,
          paddingVertical: 10,
          paddingHorizontal: 13,
        }}
      >
        <T style={{ fontSize: 13, color: colors.muted, fontStyle: 'italic' }}>
          Bu mesaj güvenlik kuralları nedeniyle moderasyon tarafından gizlendi.
        </T>
      </View>
    );
  }
  return (
    <View style={{ gap: 10 }}>
      <View style={{ alignSelf: giden ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
        <View
          style={{
            backgroundColor: giden ? colors.blue : '#F3F5FA',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            borderBottomLeftRadius: giden ? 16 : 4,
            borderBottomRightRadius: giden ? 4 : 16,
            paddingVertical: 11,
            paddingHorizontal: 13,
          }}
        >
          <T style={{ fontSize: 14, lineHeight: 21 }}>{m.metin}</T>
        </View>
        <T style={{ fontSize: 11, color: colors.muted, marginTop: 3, textAlign: giden ? 'right' : 'left' }}>
          {saat(m.zaman)}
          {m.gonderen ? ` · ${m.gonderen}` : ''}
          {!giden && m.tip === 'metin' ? (
            <>
              {' · '}
              <T
                accessibilityRole="button"
                onPress={sikayet}
                style={{ fontSize: 11, fontWeight: '700', color: '#A3271F' }}
              >
                Şikayet et
              </T>
            </>
          ) : null}
        </T>
      </View>
      {m.uyari ? (
        <View
          accessibilityRole="alert"
          style={{
            flexDirection: 'row',
            gap: 10,
            alignItems: 'flex-start',
            backgroundColor: '#FDECEC',
            borderRadius: 14,
            padding: 12,
          }}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 3l9 16H3z"
              stroke="#A3271F"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path d="M12 10v4M12 17h.01" stroke="#A3271F" strokeWidth={2.2} strokeLinecap="round" />
          </Svg>
          <T style={{ flex: 1, fontSize: 13, lineHeight: 19, color: '#6E1A15' }}>
            <T style={{ fontSize: 13, fontWeight: '800', color: '#6E1A15' }}>{m.uyari.baslik}</T>{' '}
            {m.uyari.metin}{' '}
            <T
              accessibilityRole="button"
              onPress={sikayet}
              style={{ fontSize: 13, fontWeight: '800', color: '#A3271F', textDecorationLine: 'underline' }}
            >
              Şikayet et
            </T>
          </T>
        </View>
      ) : null}
    </View>
  );
}
