import {
  COLORS,
  colors,
  type Damage,
  FUELS,
  GEARBOXES,
  PHOTO_MAX,
  PHOTO_MIN,
  type PortfolioVehicleInput,
  portfolioRules,
  portfolioVehicleSchema,
  type RuleResult,
} from '@rengarenk/shared';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ikon } from '../components/ikon';
import { T, TInput } from '../components/t';
import { girdiStil, kartStil, ParcaSecimi, Secici } from '../components/talep/ortak';
import { API } from '../lib/api';
import { useKatalog } from '../lib/katalog';
import { useKategoriler } from '../lib/kategoriler';
import { useOturum } from '../lib/oturum';

interface Detay {
  id: string;
  no: number;
  ad: string;
  durum: string;
  durumAd: string;
  not: string | null;
  eidsGerekli: boolean;
  veri: PortfolioVehicleInput & { hasar: Damage };
  fotolar: { id: string; url: string }[];
  ekspertiz: { ad: string; tarih: string } | null;
  kurallar: RuleResult[];
}

const BOS_HASAR: Damage = {
  parcalar: {},
  tramer: 0,
  sasiIslem: false,
  podyeIslem: false,
  airbagAcildi: false,
  agirHasar: false,
};
const binlik = (n?: number | null) => (n ? new Intl.NumberFormat('tr-TR').format(n) : '');
const sayi = (s: string) => Number(s.replace(/\D/g, '')) || 0;

function Etiketli({ ad, children, tam }: { ad: string; children: React.ReactNode; tam?: boolean }) {
  return (
    <View style={{ width: tam ? '100%' : '48.5%' }}>
      <T style={{ fontSize: 12, fontWeight: '700', color: colors.muted, marginBottom: 4 }}>{ad}</T>
      {children}
    </View>
  );
}

/**
 * Araç ekle ve düzenle (tasarım: GaleriMobil.dc.html › Araç ekle; Karar 07, 17): 1 · Araç, 2 · Plaka, km ve fiyat,
 * 3 · Fotoğraf ve ekspertiz. Tasarıma ek: ilk tescil tarihi ve fiyat beyanı (6 ay / 6.000 km ve üretici fiyatı
 * kuralları), boya ve hasar beyanı (eşleştirme için).
 */
export default function GaleriArac() {
  const { accountId, id: ilkId } = useLocalSearchParams<{ accountId: string; id?: string }>();
  const { istek } = useOturum();
  const kategoriler = useKategoriler();
  const [id, setId] = useState<string | undefined>(ilkId);
  const [d, setD] = useState<Detay | null>(null);
  const [v, setV] = useState<PortfolioVehicleInput & { hasar: Damage }>({
    kategori: 'otomobil',
    yil: new Date().getFullYear() - 3,
    km: 0,
    fiyat: 0,
    hasar: BOS_HASAR,
  });
  const [hata, setHata] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [hasarAcik, setHasarAcik] = useState(false);
  const base = `/gallery/${accountId}/portfolio`;

  useEffect(() => {
    if (!ilkId) return;
    istek<Detay>(`${base}/${ilkId}`)
      .then((x) => {
        setD(x);
        setV(x.veri);
      })
      .catch((e: Error) => setHata(e.message));
  }, [ilkId, base, istek]);

  const set = <K extends keyof typeof v>(k: K, x: (typeof v)[K]) => setV((o) => ({ ...o, [k]: x }));
  const kat = kategoriler.find((c) => c.slug === v.kategori || c.children.some((x) => x.slug === v.kategori));
  const kok = kat?.slug ?? v.kategori;
  const katalogsuz = ['deniz', 'hava'].includes(kok);
  const eidsYok = katalogsuz || kok === 'kiralik';
  const k = useKatalog(
    katalogsuz ? undefined : kok,
    v.marka ? { make: v.marka, series: v.seri, model: v.model } : undefined,
  );
  const kurallar = (() => {
    const r = portfolioVehicleSchema.safeParse(v);
    return r.success
      ? portfolioRules(r.data, {
          rootSlug: kok,
          ekspertizTarihi: d?.ekspertiz ? new Date(d.ekspertiz.tarih) : null,
        })
      : (d?.kurallar ?? []);
  })();
  const yayinda = d && !['DRAFT', 'REJECTED'].includes(d.durum);

  async function kaydet(): Promise<Detay | null> {
    const r = portfolioVehicleSchema.safeParse(v);
    if (!r.success) {
      setHata(r.error.issues[0]?.message ?? 'Bilgileri kontrol et');
      return null;
    }
    const x = id
      ? await istek<Detay>(`${base}/${id}`, { method: 'PUT', body: v })
      : await istek<Detay>(base, { method: 'POST', body: v });
    setId(x.id);
    setD(x);
    return x;
  }

  async function calis(ad: string, fn: () => Promise<unknown>) {
    setBusy(ad);
    setHata(null);
    try {
      await fn();
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const yukle = (uri: string, tip: string, yol: string, ad = 'foto.jpg') =>
    calis('foto', async () => {
      const x = id ? d : await kaydet();
      if (!x) return;
      const blob = await (await fetch(uri)).blob();
      setD(await istek<Detay>(`${base}/${x.id}/${yol}`, { dosya: { blob, tur: tip, ad } }));
    });

  function fotoEkle() {
    Alert.alert('Fotoğraf ekle', `En az ${PHOTO_MIN}, en fazla ${PHOTO_MAX} fotoğraf`, [
      {
        text: 'Kamerayla çek',
        onPress: async () => {
          const izin = await ImagePicker.requestCameraPermissionsAsync();
          if (!izin.granted) return Alert.alert('Kamera izni gerekli');
          const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
          const a = r.canceled ? null : r.assets[0];
          if (a) await yukle(a.uri, a.mimeType ?? 'image/jpeg', 'photos');
        },
      },
      {
        text: 'Galeriden seç',
        onPress: async () => {
          const r = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.7,
            allowsMultipleSelection: true,
            selectionLimit: 10,
          });
          for (const a of r.canceled ? [] : r.assets)
            await yukle(a.uri, a.mimeType ?? 'image/jpeg', 'photos');
        },
      },
      { text: 'Vazgeç', style: 'cancel' },
    ]);
  }

  async function raporEkle() {
    const r = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    const a = r.canceled ? null : r.assets[0];
    if (!a) return;
    const bugun = new Date().toISOString().slice(0, 10);
    await yukle(a.uri, 'application/pdf', `report?tarih=${bugun}`, a.name);
  }

  const kutu = { ...kartStil, marginTop: 10 } as const;
  const ikili = { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' } as const;

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
        <T accessibilityRole="header" numberOfLines={1} style={{ flex: 1, fontSize: 16, fontWeight: '800' }}>
          {d ? d.ad : 'Araç ekle'}
        </T>
      </View>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <T style={{ marginHorizontal: 4, marginBottom: 10, fontSize: 13, color: colors.muted }}>
          {d && d.durum !== 'DRAFT'
            ? `${d.durumAd}${d.not ? ` · ${d.not}` : ''}`
            : 'Katalogdan seç, plakayı gir, fotoğrafları çek. 3 dakika sürer.'}
        </T>
        {hata ? (
          <T
            style={{
              marginBottom: 10,
              backgroundColor: '#FFF0EE',
              color: '#A3271F',
              borderRadius: 12,
              padding: 12,
            }}
          >
            {hata}
          </T>
        ) : null}

        <View style={kartStil}>
          <T style={{ fontSize: 14, fontWeight: '800', marginBottom: 8 }}>1 · Araç</T>
          <View style={ikili}>
            <Etiketli ad="Kategori" tam>
              <Secici
                etiket="Kategori"
                deger={v.kategori}
                secenekler={kategoriler.map((c) => ({ key: c.slug, ad: c.name }))}
                onSec={(x) =>
                  x &&
                  setV((o) => ({
                    ...o,
                    kategori: x,
                    marka: undefined,
                    seri: undefined,
                    model: undefined,
                    kasa: undefined,
                    paket: undefined,
                  }))
                }
              />
            </Etiketli>
            {katalogsuz ? (
              <>
                <Etiketli ad="Marka">
                  <TInput value={v.markaAd ?? ''} onChangeText={(x) => set('markaAd', x)} style={girdiStil} />
                </Etiketli>
                <Etiketli ad="Model">
                  <TInput value={v.modelAd ?? ''} onChangeText={(x) => set('modelAd', x)} style={girdiStil} />
                </Etiketli>
              </>
            ) : (
              <>
                <Etiketli ad="Marka">
                  <Secici
                    etiket="Marka"
                    deger={v.marka}
                    secenekler={(k.makes ?? []).map((m) => ({ key: m.key, ad: m.name }))}
                    onSec={(x) =>
                      setV((o) => ({
                        ...o,
                        marka: x,
                        seri: undefined,
                        model: undefined,
                        kasa: undefined,
                        paket: undefined,
                      }))
                    }
                  />
                </Etiketli>
                <Etiketli ad="Seri">
                  <Secici
                    etiket="Seri"
                    deger={v.seri}
                    disabled={!k.series?.length}
                    secenekler={(k.series ?? []).map((m) => ({ key: m.key, ad: m.name }))}
                    onSec={(x) =>
                      setV((o) => ({ ...o, seri: x, model: undefined, kasa: undefined, paket: undefined }))
                    }
                  />
                </Etiketli>
                <Etiketli ad="Model">
                  <Secici
                    etiket="Model"
                    deger={v.model}
                    disabled={!k.models?.length}
                    secenekler={(k.models ?? []).map((m) => ({ key: m.key, ad: m.name }))}
                    onSec={(x) => set('model', x)}
                  />
                </Etiketli>
                <Etiketli ad="Kasa ve makyaj">
                  <Secici
                    etiket="Kasa"
                    deger={v.kasa}
                    disabled={!k.kusaklar.length}
                    secenekler={k.kusaklar.map((x) => ({ key: x.value, ad: `${x.label} (${x.alt})` }))}
                    onSec={(x) => set('kasa', x)}
                  />
                </Etiketli>
                <Etiketli ad="Donanım paketi">
                  <Secici
                    etiket="Paket"
                    deger={v.paket}
                    disabled={!k.paketler.length}
                    secenekler={k.paketler.map((p) => ({ key: p.key, ad: p.name }))}
                    onSec={(x) => set('paket', x)}
                  />
                </Etiketli>
              </>
            )}
            <Etiketli ad="Model yılı">
              <TInput
                keyboardType="number-pad"
                value={v.yil ? String(v.yil) : ''}
                onChangeText={(x) => set('yil', sayi(x))}
                style={girdiStil}
              />
            </Etiketli>
            <Etiketli ad="Yakıt">
              <Secici etiket="Yakıt" deger={v.yakit} secenekler={[...FUELS]} onSec={(x) => set('yakit', x)} />
            </Etiketli>
            <Etiketli ad="Vites">
              <Secici
                etiket="Vites"
                deger={v.vites}
                secenekler={[...GEARBOXES]}
                onSec={(x) => set('vites', x)}
              />
            </Etiketli>
            <Etiketli ad="Renk">
              <Secici etiket="Renk" deger={v.renk} secenekler={[...COLORS]} onSec={(x) => set('renk', x)} />
            </Etiketli>
          </View>
          <T style={{ marginTop: 8, fontSize: 11.5, color: colors.muted }}>
            Katalog: TSB ve açık veri setleri. Kasa ve paket bilgisi alıcı kriterleriyle eşleşir.
          </T>
        </View>

        <View style={kutu}>
          <T style={{ fontSize: 14, fontWeight: '800', marginBottom: 8 }}>2 · Plaka, km ve fiyat</T>
          <View style={ikili}>
            <Etiketli ad="Plaka">
              <TInput
                autoCapitalize="characters"
                placeholder="34 ABC 123"
                value={v.plaka ?? ''}
                onChangeText={(x) => set('plaka', x.toLocaleUpperCase('tr-TR'))}
                style={girdiStil}
              />
            </Etiketli>
            <Etiketli ad="Kilometre">
              <TInput
                keyboardType="number-pad"
                value={binlik(Number(v.km))}
                onChangeText={(x) => set('km', sayi(x))}
                style={girdiStil}
              />
            </Etiketli>
            <Etiketli ad={kok === 'kiralik' ? 'Günlük kira (TL)' : 'Fiyat (TL)'} tam>
              <TInput
                keyboardType="number-pad"
                value={binlik(Number(v.fiyat))}
                onChangeText={(x) => set('fiyat', sayi(x))}
                style={girdiStil}
              />
            </Etiketli>
            {eidsYok ? null : (
              <>
                <Etiketli ad="Şasi no (son 6)">
                  <TInput
                    autoCapitalize="characters"
                    maxLength={6}
                    value={v.sasiSon6 ?? ''}
                    onChangeText={(x) => set('sasiSon6', x.toUpperCase() || undefined)}
                    style={girdiStil}
                  />
                </Etiketli>
                <Etiketli ad="İlk tescil (YYYY-AA-GG)">
                  <TInput
                    placeholder="2020-03-15"
                    value={v.ilkTescil ?? ''}
                    onChangeText={(x) => set('ilkTescil', x || undefined)}
                    style={girdiStil}
                  />
                </Etiketli>
              </>
            )}
          </View>
          {eidsYok ? null : (
            <T style={{ marginTop: 8, fontSize: 11.5, color: colors.muted }}>
              Plaka EİDS ilan yetkilendirmesi için kullanılır; alıcılara gösterilmez.
            </T>
          )}
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: Boolean(v.fiyatBeyani) }}
            onPress={() => set('fiyatBeyani', !v.fiyatBeyani)}
            style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 5,
                borderWidth: 2,
                borderColor: v.fiyatBeyani ? colors.blue : '#AEB5C4',
                backgroundColor: v.fiyatBeyani ? colors.blue : colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {v.fiyatBeyani ? <Ikon d="onay" size={14} width={3} color={colors.surface} /> : null}
            </View>
            <T style={{ flex: 1, fontSize: 12.5, color: '#3A4052', lineHeight: 18 }}>
              Fiyat, aracın sıfır üretici tavsiye fiyatını aşmıyor.
            </T>
          </Pressable>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {kurallar.map((r) => (
              <T
                key={r.key}
                style={{
                  fontSize: 11.5,
                  fontWeight: '700',
                  paddingVertical: 4,
                  paddingHorizontal: 8,
                  borderRadius: 999,
                  overflow: 'hidden',
                  backgroundColor: r.ok ? '#E7FAF0' : r.engel ? '#FDECEC' : '#FFF6DF',
                  color: r.ok ? '#11683F' : r.engel ? '#A3271F' : '#7A5300',
                }}
              >
                {r.metin}
              </T>
            ))}
          </View>
        </View>

        <View style={kutu}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: hasarAcik }}
            onPress={() => setHasarAcik(!hasarAcik)}
            style={{ flexDirection: 'row', justifyContent: 'space-between' }}
          >
            <T style={{ fontSize: 14, fontWeight: '800' }}>Boya, değişen ve hasar</T>
            <T style={{ fontSize: 13, fontWeight: '700', color: colors.link }}>
              {hasarAcik ? 'Kapat' : 'Düzenle'}
            </T>
          </Pressable>
          {hasarAcik ? (
            <View style={{ marginTop: 10 }}>
              <ParcaSecimi
                beyan
                value={{ limit: 0, parts: v.hasar.parcalar as Record<string, string> }}
                onChange={(b) => set('hasar', { ...v.hasar, parcalar: b.parts as Damage['parcalar'] })}
              />
              <View style={{ ...ikili, marginTop: 10 }}>
                <Etiketli ad="Tramer (TL)" tam>
                  <TInput
                    keyboardType="number-pad"
                    value={binlik(v.hasar.tramer)}
                    onChangeText={(x) => set('hasar', { ...v.hasar, tramer: sayi(x) })}
                    style={girdiStil}
                  />
                </Etiketli>
              </View>
            </View>
          ) : null}
        </View>

        <View style={kutu}>
          <T style={{ fontSize: 14, fontWeight: '800', marginBottom: 8 }}>3 · Fotoğraf ve ekspertiz</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {(d?.fotolar ?? []).map((f, i) => (
              <Pressable
                key={f.id}
                accessibilityLabel={`Fotoğraf ${i + 1}, silmek için basılı tut`}
                onLongPress={() =>
                  Alert.alert('Fotoğrafı sil', undefined, [
                    { text: 'Vazgeç', style: 'cancel' },
                    {
                      text: 'Sil',
                      style: 'destructive',
                      onPress: () =>
                        calis('sil', async () =>
                          setD(await istek<Detay>(`${base}/${d?.id}/photos/${f.id}`, { method: 'DELETE' })),
                        ),
                    },
                  ])
                }
                style={{
                  width: '23.5%',
                  aspectRatio: 1,
                  borderRadius: 10,
                  overflow: 'hidden',
                  borderWidth: i === 0 ? 2 : 1,
                  borderColor: i === 0 ? colors.blue : colors.line,
                }}
              >
                <Image source={{ uri: `${API}${f.url}` }} style={{ width: '100%', height: '100%' }} />
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={fotoEkle}
              disabled={busy === 'foto'}
              style={{
                width: '23.5%',
                aspectRatio: 1,
                borderRadius: 10,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: '#A9B6D6',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <T style={{ fontSize: 11, fontWeight: '700', color: colors.link, textAlign: 'center' }}>
                {busy === 'foto' ? 'Yükleniyor…' : '+ Fotoğraf'}
              </T>
            </Pressable>
          </View>
          <T style={{ marginTop: 6, fontSize: 11.5, color: colors.muted }}>
            {d?.fotolar.length ?? 0} / en az {PHOTO_MIN} · ilk fotoğraf kapak olur
          </T>
          <Pressable
            accessibilityRole="button"
            onPress={raporEkle}
            style={{
              marginTop: 10,
              borderWidth: 1,
              borderColor: '#D5DAE5',
              borderRadius: 12,
              padding: 12,
              alignItems: 'center',
            }}
          >
            <T style={{ fontSize: 14, fontWeight: '700' }}>
              {d?.ekspertiz ? `Ekspertiz: ${d.ekspertiz.ad}` : 'Ekspertiz raporu ekle (PDF)'}
            </T>
          </Pressable>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: Boolean(v.fotoKatalogIzni) }}
            onPress={() => set('fotoKatalogIzni', !v.fotoKatalogIzni)}
            style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 5,
                borderWidth: 2,
                borderColor: v.fotoKatalogIzni ? colors.blue : '#AEB5C4',
                backgroundColor: v.fotoKatalogIzni ? colors.blue : colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {v.fotoKatalogIzni ? <Ikon d="onay" size={14} width={3} color={colors.surface} /> : null}
            </View>
            <T style={{ flex: 1, fontSize: 12.5, color: '#3A4052', lineHeight: 18 }}>
              Fotoğraflarım katalogda bu kasa ve paket için temsilî görsel olarak kullanılabilir (galeri
              adıyla gösterilir).
            </T>
          </Pressable>
        </View>
      </ScrollView>
      <View
        style={{
          flexDirection: 'row',
          gap: 8,
          padding: 12,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.line,
        }}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            calis('kaydet', async () => {
              const x = await kaydet();
              if (x) router.back();
            })
          }
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: '#D5DAE5',
            borderRadius: 14,
            paddingVertical: 14,
            alignItems: 'center',
          }}
        >
          <T style={{ fontSize: 15, fontWeight: '700' }}>{yayinda ? 'Kaydet' : 'Taslak'}</T>
        </Pressable>
        {yayinda ? null : (
          <Pressable
            accessibilityRole="button"
            disabled={Boolean(busy)}
            onPress={() =>
              calis('gonder', async () => {
                const x = await kaydet();
                if (!x) return;
                const s = await istek<Detay>(`${base}/${x.id}/submit`, { method: 'POST' });
                Alert.alert(
                  s.durum === 'PUBLISHED' ? 'Araç yayında' : "EİDS'e gönderildi",
                  s.durum === 'PUBLISHED' ? undefined : 'Ruhsat sahibi onaylayınca alıcılara görünür.',
                );
                router.back();
              })
            }
            style={{
              flex: 2,
              backgroundColor: colors.blue,
              borderRadius: 14,
              paddingVertical: 14,
              alignItems: 'center',
            }}
          >
            <T style={{ fontSize: 15, fontWeight: '800' }}>
              {eidsYok ? 'Kaydet ve yayınla' : "Kaydet ve EİDS'e gönder"}
            </T>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}
