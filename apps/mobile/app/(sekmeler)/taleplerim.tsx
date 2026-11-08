import {
  BIREYSEL_FIYATLAR,
  colors,
  DOTS,
  FOUND_VIA,
  type FoundViaKey,
  fiyatYaz,
  PROMOTION_NAMES,
} from '@rengarenk/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { BosDurum } from '../../components/bos-durum';
import { Ikon } from '../../components/ikon';
import { T } from '../../components/t';
import { useOturum } from '../../lib/oturum';

const SEKMELER = [
  ['yayinda', 'Yayında'],
  ['pasif', 'Pasif'],
  ['taslak', 'Taslak'],
  ['bitti', 'Tamamlanan'],
] as const;
type Sekme = (typeof SEKMELER)[number][0];
const TINTS = ['#EEF3FF', '#FFEEF6', '#FFF6DF', '#E7FAF0', '#F3EFFF', '#FFF0EA'];

interface Talep {
  id: string;
  no: number;
  status: 'DRAFT' | 'PUBLISHED' | 'PASSIVE' | 'CLOSED' | 'COMPLETED';
  baslik: string;
  category: { slug: string; name: string };
  step: number;
  publishedAt: string | null;
  expiresAt: string | null;
  passiveReason: string | null;
  closedAt: string | null;
  freeExtensionUsed: boolean;
  updatedAt: string;
  /** Galeri adına açılmış talep (Karar 12.2) */
  galeri: { ad: string; slug: string } | null;
  /** Hesabın kullanılmamış öne çıkarma hakları (galeri paketi ya da talep seçmeden alınmış hak) */
  oneCikarmaHakki: Partial<Record<'ust_sira' | 'acil' | 'vitrin', number>>;
}

const sekmeOf = (t: Talep): Sekme | null =>
  t.status === 'PUBLISHED'
    ? 'yayinda'
    : t.status === 'PASSIVE'
      ? 'pasif'
      : t.status === 'DRAFT'
        ? 'taslak'
        : t.publishedAt
          ? 'bitti'
          : null;
const gun = (iso: string | null) =>
  Math.max(0, Math.ceil(((iso ? new Date(iso).getTime() : 0) - Date.now()) / 86_400_000));
const tarih = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long' }).format(
        new Date(iso),
      )
    : '';
const doldu = (t: Talep) =>
  t.status === 'PASSIVE' && (t.passiveReason === 'sure_doldu' || gun(t.expiresAt) === 0);
/** Moderasyon kararıyla yayından kaldırıldı (Karar 53): yeniden yayınlanamaz, bildirimden itiraz edilir */
const moderasyon = (t: Talep) => t.status === 'PASSIVE' && t.passiveReason === 'moderasyon';

function sure(t: Talep) {
  if (t.status === 'PUBLISHED') return `${t.category.name} · ${gun(t.expiresAt)} gün kaldı`;
  if (moderasyon(t)) return 'Moderasyon kararıyla yayından kaldırıldı';
  if (t.status === 'PASSIVE') return doldu(t) ? `Süresi ${tarih(t.expiresAt)}’da doldu` : 'Pasife alındı';
  if (t.status === 'DRAFT') return `Taslak · 6 adımın ${Math.max(0, t.step - 1)}’i tamam`;
  return `${t.status === 'COMPLETED' ? 'Tamamlandı' : 'Kapatıldı'} · ${tarih(t.closedAt)}`;
}

/** Taleplerim (tasarım: TaleplerimMobil; Karar 09, 10, 31): durum sekmeleri, talep kartları ve işlemler. */
export default function Taleplerim() {
  const { durum, istek } = useOturum();
  const [sekme, setSekme] = useState<Sekme>('yayinda');
  const [liste, setListe] = useState<Talep[] | null>(null);
  const [islemler, setIslemler] = useState<Talep | null>(null);
  const [bulundu, setBulundu] = useState<Talep | null>(null);
  const [secim, setSecim] = useState<FoundViaKey>('rengarenk');
  const [busy, setBusy] = useState(false);

  const yukle = useCallback(() => {
    if (durum !== 'uye') return;
    istek<{ items: Talep[] }>('/demands/mine')
      .then((m) => setListe(m.items))
      .catch(() => setListe([]));
  }, [durum, istek]);
  useFocusEffect(yukle);

  async function yap(t: Talep, yol: string, body?: unknown, sonraki?: Sekme) {
    setBusy(true);
    try {
      await istek(`/demands/${t.id}/${yol}`, { method: 'POST', body });
      setIslemler(null);
      setBulundu(null);
      yukle();
      if (sonraki) setSekme(sonraki);
    } catch (e) {
      Alert.alert('İşlem yapılamadı', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const sayi = (k: Sekme) => (liste ?? []).filter((t) => sekmeOf(t) === k).length;
  const gorunen = (liste ?? []).filter((t) => sekmeOf(t) === sekme);
  const suresiDolan = (liste ?? []).find((t) => doldu(t) && !t.freeExtensionUsed);
  const ikincil = {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D5DAE5',
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <View
        style={{
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
          paddingTop: 16,
          paddingHorizontal: 16,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T accessibilityRole="header" style={{ fontSize: 22, fontWeight: '800' }}>
            Taleplerim
          </T>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Talep oluştur"
            onPress={() => router.push(durum === 'uye' ? '/talep-olustur' : '/giris')}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: colors.blue,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ikon d="arti" size={20} width={2.4} />
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityRole="tablist"
          style={{ marginTop: 10 }}
        >
          {SEKMELER.map(([k, ad]) => {
            const on = k === sekme;
            return (
              <Pressable
                key={k}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => setSekme(k)}
                style={{
                  paddingTop: 10,
                  paddingHorizontal: 10,
                  paddingBottom: 9,
                  borderBottomWidth: 3,
                  borderBottomColor: on ? colors.blue : 'transparent',
                }}
              >
                <T
                  style={{
                    fontSize: 14.5,
                    fontWeight: on ? '800' : '600',
                    color: on ? colors.ink : colors.muted,
                  }}
                >
                  {ad} {sayi(k)}
                </T>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingVertical: 14, paddingHorizontal: 16, gap: 12 }}
      >
        {durum === 'misafir' ? (
          <BosDurum
            baslik="Taleplerini görmek için giriş yap"
            metin="Aradığın aracı yaz; uygun aracı olan galeriler ve satıcılar sana yazsın. İlk talebin ücretsiz."
          />
        ) : null}
        {suresiDolan && sekme === 'yayinda' ? (
          <View
            style={{
              backgroundColor: '#FFF6DF',
              borderWidth: 1,
              borderColor: '#F4DC9A',
              borderRadius: 14,
              padding: 12,
            }}
          >
            <T style={{ fontSize: 13.5, lineHeight: 19 }}>
              <T style={{ fontWeight: '800' }}>{suresiDolan.baslik}</T> talebinin süresi doldu.{' '}
              <T
                style={{ fontWeight: '700', color: colors.link }}
                onPress={() => yap(suresiDolan, 'extend', undefined, 'yayinda')}
              >
                Ücretsiz uzat
              </T>
            </T>
          </View>
        ) : null}
        {liste && gorunen.length === 0 && durum === 'uye' ? (
          <BosDurum
            baslik={
              sekme === 'yayinda'
                ? 'Yayında talebin yok'
                : `${SEKMELER.find((s) => s[0] === sekme)?.[1]} talebin yok`
            }
            metin="Aradığın aracı yaz; uygun aracı olan galeriler ve satıcılar sana yazsın. İlk talebin ücretsiz."
          />
        ) : null}
        {gorunen.map((t, i) => (
          <View
            key={t.id}
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: 16,
              padding: 14,
            }}
          >
            <Pressable
              accessibilityRole="link"
              onPress={() =>
                t.status === 'DRAFT'
                  ? router.push(`/talep-olustur?id=${t.id}`)
                  : router.push(`/talep/${t.no}`)
              }
              style={{ flexDirection: 'row', gap: 12 }}
            >
              <View
                style={{
                  width: 76,
                  height: 58,
                  borderRadius: 12,
                  backgroundColor: TINTS[i % TINTS.length],
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Svg width={60} height={25} viewBox="0 0 112 46" fill="none">
                  <Path
                    d="M8 34c0-6 4-9 10-10l14-10c4-3 8-4 13-4h22c6 0 10 2 14 6l8 8c8 1 15 3 15 10v4H8z"
                    fill={DOTS[i % DOTS.length]}
                    opacity={0.85}
                  />
                  <Circle cx={30} cy={38} r={7} fill="#1E2333" />
                  <Circle cx={84} cy={38} r={7} fill="#1E2333" />
                  <Circle cx={30} cy={38} r={3} fill="#FFFFFF" />
                  <Circle cx={84} cy={38} r={3} fill="#FFFFFF" />
                </Svg>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row' }}>
                  <T
                    style={{
                      fontSize: 11.5,
                      fontWeight: '800',
                      paddingVertical: 2,
                      paddingHorizontal: 8,
                      borderRadius: 999,
                      overflow: 'hidden',
                      backgroundColor:
                        t.status === 'PUBLISHED'
                          ? '#E7FAF0'
                          : t.status === 'PASSIVE'
                            ? '#FFF6DF'
                            : t.status === 'COMPLETED'
                              ? '#EEF3FF'
                              : '#F3F5FA',
                      color:
                        t.status === 'PUBLISHED'
                          ? '#11683F'
                          : t.status === 'PASSIVE'
                            ? '#7A5300'
                            : t.status === 'COMPLETED'
                              ? '#2450C8'
                              : '#3A4052',
                    }}
                  >
                    {
                      {
                        PUBLISHED: 'Yayında',
                        PASSIVE: 'Pasif',
                        DRAFT: 'Taslak',
                        COMPLETED: 'Tamamlandı',
                        CLOSED: 'Kapatıldı',
                      }[t.status]
                    }
                  </T>
                </View>
                {t.galeri ? (
                  <T style={{ marginTop: 4, fontSize: 12, fontWeight: '800', color: '#7A5300' }}>
                    {t.galeri.ad} adına
                  </T>
                ) : null}
                <T
                  style={{ marginTop: 5, marginBottom: 2, fontSize: 15.5, fontWeight: '800', lineHeight: 20 }}
                >
                  {t.baslik}
                </T>
                <T style={{ fontSize: 12.5, color: t.status === 'PASSIVE' ? '#7A5300' : colors.muted }}>
                  {sure(t)}
                </T>
              </View>
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              {t.status === 'PUBLISHED' ? (
                <>
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => setBulundu(t)}
                    style={{
                      flex: 1,
                      backgroundColor: colors.green,
                      borderRadius: 10,
                      paddingVertical: 11,
                      alignItems: 'center',
                    }}
                  >
                    <T style={{ fontSize: 14, fontWeight: '800' }}>Aracı buldum</T>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push(`/talep-olustur?id=${t.id}`)}
                    style={ikincil}
                  >
                    <T style={{ fontSize: 14, fontWeight: '700' }}>Düzenle</T>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Diğer işlemler"
                    onPress={() => setIslemler(t)}
                    style={{
                      width: 44,
                      borderWidth: 1,
                      borderColor: '#D5DAE5',
                      borderRadius: 10,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <T style={{ fontSize: 18, fontWeight: '800' }}>⋯</T>
                  </Pressable>
                </>
              ) : null}
              {moderasyon(t) ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/bildirimler')}
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: '#D5DAE5',
                    borderRadius: 10,
                    paddingVertical: 11,
                    alignItems: 'center',
                  }}
                >
                  <T style={{ fontSize: 14, fontWeight: '700' }}>Kararı gör, itiraz et</T>
                </Pressable>
              ) : t.status === 'PASSIVE' ? (
                <>
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy || (doldu(t) && t.freeExtensionUsed)}
                    onPress={() => yap(t, doldu(t) ? 'extend' : 'activate', undefined, 'yayinda')}
                    style={{
                      flex: 2,
                      backgroundColor: colors.blue,
                      borderRadius: 10,
                      paddingVertical: 11,
                      alignItems: 'center',
                      opacity: doldu(t) && t.freeExtensionUsed ? 0.55 : 1,
                    }}
                  >
                    <T style={{ fontSize: 14, fontWeight: '800' }}>
                      {!doldu(t)
                        ? 'Yeniden yayınla'
                        : t.freeExtensionUsed
                          ? `Uzat · ${fiyatYaz(BIREYSEL_FIYATLAR.uzatma.mobil)} TL`
                          : 'Ücretsiz uzat · 30 gün'}
                    </T>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Diğer işlemler"
                    onPress={() => setIslemler(t)}
                    style={{
                      width: 44,
                      borderWidth: 1,
                      borderColor: '#D5DAE5',
                      borderRadius: 10,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <T style={{ fontSize: 18, fontWeight: '800' }}>⋯</T>
                  </Pressable>
                </>
              ) : null}
              {t.status === 'DRAFT' ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push(`/talep-olustur?id=${t.id}`)}
                  style={{
                    flex: 1,
                    backgroundColor: colors.blue,
                    borderRadius: 10,
                    paddingVertical: 11,
                    alignItems: 'center',
                  }}
                >
                  <T style={{ fontSize: 14, fontWeight: '800' }}>Kaldığın yerden devam et</T>
                </Pressable>
              ) : null}
              {t.status === 'COMPLETED' || t.status === 'CLOSED' ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/talep-olustur')}
                  style={ikincil}
                >
                  <T style={{ fontSize: 14, fontWeight: '700' }}>Benzerini oluştur</T>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal
        visible={Boolean(islemler)}
        transparent
        animationType="fade"
        onRequestClose={() => setIslemler(null)}
      >
        <Pressable
          accessibilityLabel="Kapat"
          onPress={() => setIslemler(null)}
          style={{ flex: 1, backgroundColor: 'rgba(30,35,51,0.45)', justifyContent: 'flex-end' }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 16,
              paddingBottom: 32,
            }}
          >
            {islemler
              ? [
                  islemler.status === 'PUBLISHED' ? (['Pasife al', 'passivate', 'pasif'] as const) : null,
                  islemler.status === 'PUBLISHED' && gun(islemler.expiresAt) <= 7
                    ? (['Uzat', 'extend', 'yayinda'] as const)
                    : null,
                  islemler.status === 'PASSIVE' ? (['Düzenle', 'duzenle', null] as const) : null,
                  // Hakla öne çıkarma (7 gün): paketin aylık hakkı ya da talep seçmeden alınmış hak
                  ...(['ust_sira', 'acil', 'vitrin'] as const)
                    .filter(
                      (k) => islemler.status === 'PUBLISHED' && (islemler.oneCikarmaHakki?.[k] ?? 0) > 0,
                    )
                    .map(
                      (k) =>
                        [
                          `${PROMOTION_NAMES[k]} · hakkını kullan (${islemler.oneCikarmaHakki[k]})`,
                          `promote:${k}`,
                          null,
                        ] as const,
                    ),
                  ['Talebi kapat', 'close', 'bitti'] as const,
                ]
                  .filter((x): x is NonNullable<typeof x> => x !== null)
                  .map(([ad, yol, sonraki]) => (
                    <Pressable
                      key={yol}
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => {
                        const t = islemler;
                        if (yol === 'duzenle') {
                          setIslemler(null);
                          return router.push(`/talep-olustur?id=${t.id}`);
                        }
                        if (yol === 'close') {
                          return Alert.alert(
                            'Talep kapatılsın mı?',
                            'Kapatılan talep yeniden yayınlanamaz.',
                            [
                              { text: 'Vazgeç', style: 'cancel' },
                              {
                                text: 'Kapat',
                                style: 'destructive',
                                onPress: () => yap(t, 'close', undefined, 'bitti'),
                              },
                            ],
                          );
                        }
                        if (yol.startsWith('promote:')) {
                          return yap(t, 'promote', { tur: yol.slice(8) });
                        }
                        yap(t, yol, undefined, sonraki ?? undefined);
                      }}
                      style={{ paddingVertical: 14 }}
                    >
                      <T
                        style={{
                          fontSize: 15,
                          fontWeight: '700',
                          color: yol === 'close' ? '#A3271F' : colors.ink,
                        }}
                      >
                        {ad}
                      </T>
                    </Pressable>
                  ))
              : null}
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={Boolean(bulundu)}
        transparent
        animationType="fade"
        onRequestClose={() => setBulundu(null)}
      >
        <View
          style={{ flex: 1, backgroundColor: 'rgba(30,35,51,0.45)', justifyContent: 'center', padding: 16 }}
        >
          <View
            accessibilityViewIsModal
            style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 20 }}
          >
            <T accessibilityRole="header" style={{ fontSize: 19, fontWeight: '800', marginBottom: 6 }}>
              Tebrikler! Aracı nereden buldun?
            </T>
            <T style={{ fontSize: 13.5, color: colors.muted, marginBottom: 14 }}>
              {bulundu?.baslik} talebi kapanacak ve satıcılar artık mesaj gönderemeyecek. Mevcut sohbetlerin
              açık kalır.
            </T>
            {FOUND_VIA.map((o) => {
              const on = secim === o.key;
              return (
                <Pressable
                  key={o.key}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => setSecim(o.key)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    borderWidth: on ? 1.5 : 1,
                    borderColor: on ? colors.blue : '#D5DAE5',
                    backgroundColor: on ? '#EEF3FF' : colors.surface,
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 8,
                  }}
                >
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      borderWidth: 2,
                      borderColor: on ? colors.blue : '#AEB5C4',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {on ? (
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.blue }} />
                    ) : null}
                  </View>
                  <T style={{ flex: 1, fontSize: 14.5, fontWeight: '600' }}>{o.ad}</T>
                </Pressable>
              );
            })}
            <T style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
              Bu bilgi yalnızca hizmeti iyileştirmek için kullanılır, satıcıya gösterilmez.
            </T>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setBulundu(null)}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: '#D5DAE5',
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
              >
                <T style={{ fontSize: 14.5, fontWeight: '700' }}>Vazgeç</T>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => bulundu && yap(bulundu, 'complete', { foundVia: secim }, 'bitti')}
                style={{
                  flex: 1,
                  backgroundColor: colors.green,
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
              >
                <T style={{ fontSize: 14.5, fontWeight: '800' }}>Talebi kapat</T>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
