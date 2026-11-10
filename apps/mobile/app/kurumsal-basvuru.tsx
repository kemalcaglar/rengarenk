import {
  BUSINESS_KIND_DEFS,
  BUSINESS_KINDS,
  butonOran,
  colors,
  GALLERY_TRIAL,
  type GalleryApplicationDraft,
  galleryApplicationSchema,
  kartOran,
  maskTrMobile,
  radii,
} from '@rengarenk/shared';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ikon } from '../components/ikon';
import { T, TInput } from '../components/t';
import { girdiStil, Konum, kartStil } from '../components/talep/ortak';
import { useOturum } from '../lib/oturum';

type Durum = 'DRAFT' | 'SUBMITTED' | 'IN_REVIEW' | 'DOCS_REQUESTED' | 'APPROVED' | 'REJECTED' | 'REVOKED';
interface Basvuru {
  id: string;
  durum: Durum;
  veri: GalleryApplicationDraft;
  belgeler: { id: string; kind: string; ad: string }[];
  gonderildi: string | null;
  kontrolEdildi: string | null;
  yetki: 'gecti' | 'kaldi' | 'uyari' | 'yapilamadi' | null;
  not: string | null;
  galeri: { accountId: string; slug: string } | null;
}

const WEB = process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:3000';
const ADIM = [
  ['İşletme türün nedir?', 'İstenen belgeler işletme türüne göre değişir.'],
  ['İşletme bilgileri', 'Vergi levhandaki bilgilerle aynı olmalı.'],
  ['Yetki ve belgeler', ''],
  ['Hesabın sahibi', 'Bu kişi hesabın sahibi olur; paketleri ve ekibi yönetir.'],
  ['Kontrol et ve gönder', 'Başvurunu yönetici ekibimiz inceler; sonucu SMS ve e-postayla bildiririz.'],
] as const;
const ALAN: { id: keyof GalleryApplicationDraft; ad: string; sayi?: true }[] = [
  { id: 'unvan', ad: 'Ticari unvan' },
  { id: 'gorunenAd', ad: 'Platformda görünecek ad' },
  { id: 'vergiNo', ad: 'Vergi numarası', sayi: true },
  { id: 'vergiDairesi', ad: 'Vergi dairesi' },
  { id: 'mersis', ad: 'MERSİS numarası', sayi: true },
];

const adBol = (s: string) => {
  const p = s.trim().split(/\s+/);
  return p.length < 2
    ? { ad: p[0] ?? '', soyad: '' }
    : { ad: p.slice(0, -1).join(' '), soyad: p.at(-1) as string };
};
const dolu = <T extends object>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== undefined && v !== null));

/**
 * Kurumsal hesap başvurusu (tasarım: BasvuruMobil.dc.html; Karar 03, 17). Taslak her adımda kaydedilir; belge
 * kamerayla çekilir ya da dosyalardan seçilir. Eksik belgeyle gönderilebilir, inceleme belgeyi bekler. Tasarımdaki
 * "Paketler aylık 1.490 TL’den başlar" cümlesi Karar 38 gereği uygulamada yazılmaz (galeri paket fiyatı yalnızca web).
 */
export default function KurumsalBasvuru() {
  const { durum: oturum, me, istek } = useOturum();
  const [b, setB] = useState<Basvuru | null | undefined>(undefined);
  const [adim, setAdim] = useState(1);
  const [veri, setVeri] = useState<GalleryApplicationDraft>({});
  const [adSoyad, setAdSoyad] = useState('');
  const [sozlesme, setSozlesme] = useState(false);
  const [ticari, setTicari] = useState(false);
  const [kaydedildi, setKaydedildi] = useState(false);
  const [dogru, setDogru] = useState<{ sonuc: string; not?: string; unvan?: string } | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const al = useCallback(async () => {
    const r = await istek<Basvuru | null>('/gallery-applications/me');
    setB(r);
    if (r) {
      setVeri(r.veri);
      setAdSoyad([r.veri.sahip?.ad, r.veri.sahip?.soyad].filter(Boolean).join(' '));
      if (r.durum === 'DOCS_REQUESTED') setAdim(3);
    }
  }, [istek]);

  useEffect(() => {
    if (oturum === 'misafir') router.replace('/giris');
    if (oturum === 'uye') al().catch((e: Error) => setHata(e.message));
  }, [oturum, al]);

  useEffect(() => {
    if (b?.durum !== 'SUBMITTED') return;
    const t = setInterval(() => al().catch(() => undefined), 4000);
    return () => clearInterval(t);
  }, [b?.durum, al]);

  const duzenlenebilir = !b || b.durum === 'DRAFT' || b.durum === 'DOCS_REQUESTED';
  const tur = veri.tur ? BUSINESS_KIND_DEFS[veri.tur] : null;
  const set = (k: keyof GalleryApplicationDraft, v: string) => {
    setVeri((x) => ({ ...x, [k]: v }));
    setKaydedildi(false);
  };

  async function kaydet() {
    const sahip = dolu({ ...veri.sahip, ...adBol(adSoyad) });
    const r = await istek<Basvuru>('/gallery-applications/me', {
      method: 'PATCH',
      body: dolu({ ...veri, sahip: Object.keys(sahip).length ? sahip : undefined }),
    });
    setB(r);
    setKaydedildi(true);
  }

  function eksik(n: number): string | null {
    const tam = galleryApplicationSchema.safeParse({ ...veri, sahip: { ...veri.sahip, ...adBol(adSoyad) } });
    const ilk = (yollar: string[]) =>
      tam.success
        ? null
        : (tam.error.issues.find((i) => yollar.includes(String(i.path[0])))?.message ?? null);
    if (n === 1) return veri.tur ? null : 'İşletme türünü seç';
    if (n === 2)
      return ilk(['unvan', 'gorunenAd', 'vergiNo', 'vergiDairesi', 'mersis', 'il', 'ilce', 'adres']);
    if (n === 3) return ilk(['yetkiNo']);
    if (n === 4) {
      if (!adBol(adSoyad).soyad) return 'Adını ve soyadını yaz';
      return ilk(['sahip']) ?? (sozlesme ? null : 'Galeri hizmet sözleşmesini ve aydınlatma metnini onayla');
    }
    return null;
  }

  async function ileri() {
    setHata(null);
    const e = eksik(adim);
    if (e) {
      setHata(e);
      return;
    }
    setBusy('ileri');
    try {
      await kaydet();
      if (adim < 5) setAdim(adim + 1);
      else {
        setB(
          await istek<Basvuru>('/gallery-applications/me/submit', {
            method: 'POST',
            body: { sozlesme, ticariIleti: ticari, kanal: Platform.OS === 'ios' ? 'ios' : 'android' },
          }),
        );
      }
    } catch (err) {
      setHata((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function geri() {
    setHata(null);
    if (adim > 1 && duzenlenebilir) setAdim(adim - 1);
    else router.back();
  }

  async function dogrula() {
    setBusy('dogrula');
    setHata(null);
    try {
      await kaydet();
      setDogru(await istek('/gallery-applications/me/verify-authority', { method: 'POST' }));
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function yukle(kind: string, uri: string, ad: string, tip: string) {
    setBusy(kind);
    setHata(null);
    try {
      if (!b) await kaydet();
      const blob = await (await fetch(uri)).blob();
      setB(
        await istek<Basvuru>(`/gallery-applications/me/documents/${kind}`, { dosya: { blob, tur: tip, ad } }),
      );
      setKaydedildi(true);
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function belgeSec(kind: string, ad: string) {
    Alert.alert(ad, 'PDF, JPG ya da PNG, en çok 10 MB', [
      {
        text: 'Kamerayla çek',
        onPress: async () => {
          const izin = await ImagePicker.requestCameraPermissionsAsync();
          if (!izin.granted) {
            Alert.alert(
              'Kamera izni gerekli',
              'Ayarlardan kamera iznini açabilir ya da dosyalardan seçebilirsin.',
            );
            return;
          }
          const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
          const a = r.canceled ? null : r.assets[0];
          if (a) await yukle(kind, a.uri, a.fileName ?? `${kind}.jpg`, a.mimeType ?? 'image/jpeg');
        },
      },
      {
        text: 'Dosyalardan seç',
        onPress: async () => {
          const r = await DocumentPicker.getDocumentAsync({
            type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
            copyToCacheDirectory: true,
          });
          const a = r.canceled ? null : r.assets[0];
          if (a) await yukle(kind, a.uri, a.name, a.mimeType ?? 'application/pdf');
        },
      },
      { text: 'Vazgeç', style: 'cancel' },
    ]);
  }

  const durumGorunumu = b && !duzenlenebilir;
  const eksikBelgeler = (tur?.belgeler ?? []).filter(
    (d) => d.zorunlu && !b?.belgeler.some((x) => x.kind === d.key),
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top', 'bottom']}>
      <View
        style={{
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
          paddingTop: 10,
          paddingHorizontal: 12,
          paddingBottom: 14,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Geri"
            onPress={geri}
            style={{
              width: 44,
              height: 44,
              borderRadius: butonOran(12),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ikon d="geri" />
          </Pressable>
          <T accessibilityRole="header" style={{ fontSize: 15, fontWeight: '800' }}>
            Kurumsal başvuru
          </T>
          <T
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: '#11683F',
              paddingHorizontal: 6,
              minWidth: 80,
              textAlign: 'right',
            }}
          >
            {kaydedildi && duzenlenebilir ? '✓ Kaydedildi' : ''}
          </T>
        </View>
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 6 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <View
              key={n}
              style={{
                flex: 1,
                height: 5,
                borderRadius: Math.min(radii.etiket, 3),
                backgroundColor: durumGorunumu || n <= adim ? colors.blue : colors.line,
              }}
            />
          ))}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingTop: 18, paddingHorizontal: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        {hata ? (
          <T
            accessibilityRole="alert"
            style={{
              marginBottom: 12,
              backgroundColor: '#FFF0EE',
              color: '#A3271F',
              borderRadius: butonOran(12),
              padding: 12,
              fontSize: 13.5,
            }}
          >
            {hata}
          </T>
        ) : null}
        {b?.durum === 'DOCS_REQUESTED' && b.not ? (
          <T
            style={{
              marginBottom: 12,
              backgroundColor: '#FFF6DF',
              color: '#7A5300',
              borderRadius: butonOran(12),
              padding: 12,
              fontSize: 13.5,
              fontWeight: '700',
            }}
          >
            Ekibimiz ek belge istedi: {b.not} Belgeyi yükleyip başvurunu yeniden gönder.
          </T>
        ) : null}
        {b === undefined ? <T style={{ color: colors.muted }}>Yükleniyor…</T> : null}

        {b !== undefined && !durumGorunumu ? (
          <>
            <T style={{ fontSize: 12.5, fontWeight: '700', color: colors.link }}>Adım {adim} / 5</T>
            <T
              accessibilityRole="header"
              style={{ marginTop: 4, marginBottom: 6, fontSize: 22, fontWeight: '800', lineHeight: 28 }}
            >
              {ADIM[adim - 1]?.[0]}
            </T>
            {ADIM[adim - 1]?.[1] ? (
              <T style={{ marginBottom: 16, fontSize: 13.5, color: colors.muted }}>{ADIM[adim - 1]?.[1]}</T>
            ) : null}
          </>
        ) : null}

        {b !== undefined && !durumGorunumu && adim === 1 ? (
          <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
            {BUSINESS_KINDS.map((k) => {
              const t = BUSINESS_KIND_DEFS[k];
              const on = veri.tur === k;
              return (
                <Pressable
                  key={k}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => {
                    set('tur', k);
                    setDogru(null);
                  }}
                  style={{
                    flexDirection: 'row',
                    gap: 12,
                    alignItems: 'center',
                    borderWidth: on ? 2 : 1,
                    borderColor: on ? colors.blue : colors.line,
                    backgroundColor: on ? '#EEF3FF' : colors.surface,
                    borderRadius: kartOran(16),
                    padding: on ? 13 : 14,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: butonOran(12),
                      backgroundColor: t.tint,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <View style={{ width: 13, height: 13, borderRadius: 7, backgroundColor: t.dot }} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T style={{ fontSize: 15, fontWeight: '800' }}>{t.ad}</T>
                    <T style={{ fontSize: 12.5, color: colors.muted, marginTop: 2 }}>{t.alt}</T>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {!durumGorunumu && adim === 2 ? (
          <View style={{ ...kartStil, gap: 12 }}>
            {ALAN.map((a) => (
              <View key={a.id}>
                <T style={{ fontSize: 13, fontWeight: '800', marginBottom: 6 }}>{a.ad}</T>
                <TInput
                  accessibilityLabel={a.ad}
                  value={(veri[a.id] as string | undefined) ?? ''}
                  onChangeText={(v) => set(a.id, v)}
                  keyboardType={a.sayi ? 'number-pad' : 'default'}
                  style={girdiStil}
                />
              </View>
            ))}
            <Konum
              value={{ il: veri.il, ilce: veri.ilce }}
              onChange={(v) => {
                const x = (v as { il?: string; ilce?: string } | undefined) ?? {};
                setVeri((o) => ({ ...o, il: x.il, ilce: x.ilce }));
                setKaydedildi(false);
              }}
            />
            <View>
              <T style={{ fontSize: 13, fontWeight: '800', marginBottom: 6 }}>İşletme adresi</T>
              <TInput
                accessibilityLabel="İşletme adresi"
                placeholder="Mahalle, cadde, numara"
                value={veri.adres ?? ''}
                onChangeText={(v) => set('adres', v)}
                style={girdiStil}
              />
            </View>
          </View>
        ) : null}

        {!durumGorunumu && adim === 3 && tur ? (
          <>
            {tur.yetkiVar ? (
              <View style={kartStil}>
                <T style={{ fontSize: 13, fontWeight: '800', marginBottom: 6 }}>{tur.yetkiAd}</T>
                <TInput
                  accessibilityLabel={tur.yetkiAd}
                  value={veri.yetkiNo ?? ''}
                  onChangeText={(v) => {
                    set('yetkiNo', v);
                    setDogru(null);
                  }}
                  style={girdiStil}
                />
                {dogru?.sonuc === 'gecti' || dogru?.sonuc === 'uyari' ? (
                  <T
                    style={{
                      marginTop: 10,
                      backgroundColor: '#E7FAF0',
                      color: '#11683F',
                      borderRadius: butonOran(12),
                      padding: 10,
                      fontSize: 13,
                      fontWeight: '700',
                    }}
                  >
                    ✓ Yetki belgesi doğrulandı{dogru.unvan ? ` · ${dogru.unvan}` : ''}
                    {dogru.sonuc === 'uyari' && dogru.not ? ` · ${dogru.not}` : ''}
                  </T>
                ) : (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      onPress={dogrula}
                      disabled={busy === 'dogrula' || !veri.yetkiNo?.trim()}
                      style={{
                        marginTop: 10,
                        borderWidth: 1,
                        borderColor: colors.ink,
                        borderRadius: butonOran(12),
                        padding: 12,
                        alignItems: 'center',
                      }}
                    >
                      <T style={{ fontSize: 14.5, fontWeight: '800' }}>
                        {busy === 'dogrula' ? 'Doğrulanıyor…' : 'Bakanlık sisteminden doğrula'}
                      </T>
                    </Pressable>
                    {dogru ? (
                      <T
                        style={{
                          marginTop: 8,
                          fontSize: 12.5,
                          color: dogru.sonuc === 'kaldi' ? '#A3271F' : '#7A5300',
                        }}
                      >
                        {dogru.sonuc === 'kaldi'
                          ? `${dogru.not ?? 'Doğrulanamadı'}. Numara doğruysa başvurun ekibimizce incelenir.`
                          : 'Otomatik doğrulama şu an yapılamıyor; belgen ekibimizce elle kontrol edilecek.'}
                      </T>
                    ) : null}
                  </>
                )}
              </View>
            ) : null}
            <T
              style={{
                marginVertical: 10,
                marginHorizontal: 4,
                fontSize: 12.5,
                color: colors.muted,
                lineHeight: 18,
              }}
            >
              {tur.belgeNotu}
            </T>
            <View style={{ ...kartStil, padding: 0, overflow: 'hidden' }}>
              {tur.belgeler.map((d, i) => {
                const y = b?.belgeler.find((x) => x.kind === d.key);
                return (
                  <View
                    key={d.key}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingVertical: 13,
                      paddingHorizontal: 14,
                      borderTopWidth: i ? 1 : 0,
                      borderTopColor: '#EEF0F5',
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <T style={{ fontSize: 14.5, fontWeight: '700' }}>{d.ad}</T>
                      <T numberOfLines={1} style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                        {y ? y.ad : d.not}
                      </T>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${d.ad} ${y ? 'değiştir' : 'yükle'}`}
                      onPress={() => belgeSec(d.key, d.ad)}
                      disabled={busy === d.key}
                      style={{
                        borderWidth: y ? 0 : 1,
                        borderColor: colors.ink,
                        backgroundColor: y ? '#E7FAF0' : colors.surface,
                        borderRadius: butonOran(10),
                        paddingVertical: 9,
                        paddingHorizontal: 12,
                      }}
                    >
                      <T style={{ fontSize: 13, fontWeight: '800', color: y ? '#11683F' : colors.ink }}>
                        {busy === d.key ? 'Yükleniyor…' : y ? '✓ Yüklendi' : 'Yükle'}
                      </T>
                    </Pressable>
                  </View>
                );
              })}
            </View>
            <T style={{ marginTop: 8, marginHorizontal: 4, fontSize: 12, color: colors.muted }}>
              Kamerayla çekebilir veya dosyalardan seçebilirsin · PDF, JPG, PNG
            </T>
          </>
        ) : null}

        {!durumGorunumu && adim === 4 ? (
          <>
            <View style={{ ...kartStil, gap: 12 }}>
              <View>
                <T style={{ fontSize: 13, fontWeight: '800', marginBottom: 6 }}>Ad soyad</T>
                <TInput
                  accessibilityLabel="Ad soyad"
                  value={adSoyad}
                  onChangeText={(v) => {
                    setAdSoyad(v);
                    setKaydedildi(false);
                  }}
                  autoComplete="name"
                  style={girdiStil}
                />
              </View>
              <View>
                <T style={{ fontSize: 13, fontWeight: '800' }}>Cep telefonu</T>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginTop: 6,
                    borderWidth: 1,
                    borderColor: colors.line,
                    backgroundColor: '#F6F8FD',
                    borderRadius: butonOran(12),
                    padding: 12,
                  }}
                >
                  <T style={{ fontSize: 15 }}>{me ? maskTrMobile(me.phone) : ''}</T>
                  <T style={{ fontSize: 12, fontWeight: '800', color: '#11683F' }}>SMS ile doğrulandı</T>
                </View>
              </View>
              <View>
                <T style={{ fontSize: 13, fontWeight: '800', marginBottom: 6 }}>Fatura e-postası</T>
                <TInput
                  accessibilityLabel="Fatura e-postası"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  value={veri.sahip?.eposta ?? ''}
                  onChangeText={(v) => setVeri((x) => ({ ...x, sahip: { ...x.sahip, eposta: v } }))}
                  style={girdiStil}
                />
              </View>
            </View>
            {[
              {
                on: sozlesme,
                set: setSozlesme,
                metin: 'Galeri hizmet sözleşmesini ve aydınlatma metnini okudum.',
                bag: `${WEB}/galeri-sozlesmesi`,
              },
              {
                on: ticari,
                set: setTicari,
                metin: 'Kampanya ve duyuru iletileri almak istiyorum (isteğe bağlı, İYS’ye kaydedilir).',
              },
            ].map((o) => (
              <Pressable
                key={o.metin}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: o.on }}
                onPress={() => o.set(!o.on)}
                style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 12 }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: butonOran(5),
                    borderWidth: 2,
                    borderColor: o.on ? colors.blue : '#AEB5C4',
                    backgroundColor: o.on ? colors.blue : colors.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {o.on ? <Ikon d="onay" size={14} width={3} color={colors.surface} /> : null}
                </View>
                <T style={{ flex: 1, fontSize: 13, color: '#3A4052', lineHeight: 19 }}>
                  {o.metin}
                  {o.bag ? (
                    <T
                      style={{ fontSize: 13, color: colors.link, fontWeight: '700' }}
                      onPress={() => Linking.openURL(o.bag)}
                    >
                      {' '}
                      Sözleşmeyi oku
                    </T>
                  ) : null}
                </T>
              </Pressable>
            ))}
          </>
        ) : null}

        {!durumGorunumu && adim === 5 && tur ? (
          <>
            <View style={{ ...kartStil, padding: 0, overflow: 'hidden' }}>
              {[
                ['İşletme türü', tur.ad],
                ['Unvan', veri.unvan],
                ['Konum', [veri.il, veri.ilce].filter(Boolean).join(', ')],
                [
                  'Belgeler',
                  `${tur.belgeler.length - eksikBelgeler.length} / ${tur.belgeler.filter((d) => d.zorunlu).length}`,
                ],
                ['Hesap sahibi', adSoyad],
              ].map(([k, v], i) => (
                <View
                  key={k}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    gap: 12,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderTopWidth: i ? 1 : 0,
                    borderTopColor: '#EEF0F5',
                  }}
                >
                  <T style={{ fontSize: 13, color: colors.muted }}>{k}</T>
                  <T style={{ flex: 1, fontSize: 13.5, fontWeight: '700', textAlign: 'right' }}>{v}</T>
                </View>
              ))}
            </View>
            {eksikBelgeler.length ? (
              <View
                style={{ marginTop: 12, backgroundColor: '#FFF6DF', borderRadius: radii.buton, padding: 12 }}
              >
                <T style={{ fontSize: 13, color: '#5A3D00', lineHeight: 19 }}>
                  <T style={{ fontSize: 13, fontWeight: '800', color: '#5A3D00' }}>
                    Eksik: {eksikBelgeler.map((d) => d.ad).join(', ')}.
                  </T>{' '}
                  Şimdi gönderebilirsin; eksikler yüklenene kadar inceleme bekler.{' '}
                  <T
                    style={{
                      fontSize: 13,
                      fontWeight: '800',
                      color: '#7A5300',
                      textDecorationLine: 'underline',
                    }}
                    onPress={() => setAdim(3)}
                  >
                    Belgelere dön
                  </T>
                </T>
              </View>
            ) : null}
            <View
              style={{ marginTop: 12, backgroundColor: '#EEF3FF', borderRadius: radii.buton, padding: 12 }}
            >
              <T style={{ fontSize: 13, color: '#1E3A8A', lineHeight: 19 }}>
                Onaylanınca{' '}
                <T style={{ fontSize: 13, fontWeight: '800', color: '#1E3A8A' }}>
                  {GALLERY_TRIAL.gun} günlük ücretsiz deneme
                </T>{' '}
                başlar: {GALLERY_TRIAL.portfoy} araç, günde {GALLERY_TRIAL.gunlukMesaj} ilk mesaj. Kart
                bilgisi istenmez.
              </T>
            </View>
          </>
        ) : null}

        {durumGorunumu ? <MobilDurum b={b} /> : null}
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
        {durumGorunumu ? (
          b.galeri ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/galeri-paneli')}
              style={{
                flex: 1,
                backgroundColor: colors.blue,
                borderRadius: radii.buton,
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              <T style={{ color: colors.onBlue, fontSize: 15.5, fontWeight: '800' }}>Galeri paneline git</T>
            </Pressable>
          ) : b.durum === 'REJECTED' || b.durum === 'REVOKED' ? (
            <Pressable
              accessibilityRole="button"
              onPress={async () => {
                const r = await istek<Basvuru>('/gallery-applications/me', {
                  method: 'PATCH',
                  body: { tur: veri.tur ?? 'DEALER' },
                }).catch((e: Error) => {
                  setHata(e.message);
                  return null;
                });
                if (r) {
                  setB(r);
                  setAdim(1);
                }
              }}
              style={{
                flex: 1,
                backgroundColor: colors.blue,
                borderRadius: radii.buton,
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              <T style={{ fontSize: 15.5, fontWeight: '800' }}>Yeniden başvur</T>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/(sekmeler)/hesabim')}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: '#D5DAE5',
                borderRadius: radii.buton,
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              <T style={{ fontSize: 15, fontWeight: '700' }}>Hesabıma dön</T>
            </Pressable>
          )
        ) : (
          <>
            {adim > 1 ? (
              <Pressable
                accessibilityRole="button"
                onPress={geri}
                style={{
                  borderWidth: 1,
                  borderColor: '#D5DAE5',
                  borderRadius: radii.buton,
                  paddingVertical: 14,
                  paddingHorizontal: 20,
                }}
              >
                <T style={{ fontSize: 15, fontWeight: '700' }}>Geri</T>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={ileri}
              disabled={busy === 'ileri' || b === undefined}
              style={{
                flex: 1,
                backgroundColor: colors.blue,
                borderRadius: radii.buton,
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              <T style={{ color: colors.onBlue, fontSize: 15.5, fontWeight: '800' }}>
                {adim === 5
                  ? b?.durum === 'DOCS_REQUESTED'
                    ? 'Yeniden gönder'
                    : 'Başvuruyu gönder'
                  : 'Devam et'}
              </T>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function MobilDurum({ b }: { b: Basvuru }) {
  const tur = b.veri.tur ? BUSINESS_KIND_DEFS[b.veri.tur] : null;
  const onay = b.durum === 'APPROVED';
  const ret = b.durum === 'REJECTED' || b.durum === 'REVOKED';
  const kontrol = Boolean(b.kontrolEdildi);
  const yetkiTamam = b.yetki === 'gecti' || b.yetki === 'uyari';
  const adimlar = [
    { ad: 'Başvuru alındı', not: 'Belgelerin ve bilgilerin kaydedildi', bitti: true },
    tur?.yetkiVar
      ? {
          ad: !kontrol
            ? 'Yetki belgesi kontrol ediliyor'
            : yetkiTamam
              ? 'Yetki belgesi doğrulandı'
              : 'Yetki belgesi elle kontrol ediliyor',
          not: 'Bakanlık sisteminden otomatik kontrol',
          bitti: kontrol,
        }
      : { ad: 'Belgeler alındı', not: 'Yönetici incelemesine hazır', bitti: true },
    {
      ad: 'Yönetici incelemesi',
      not: onay || ret ? 'Tamamlandı' : 'Belgeler ve adres kontrol ediliyor',
      bitti: onay || ret,
    },
    {
      ad: ret ? 'Başvuru sonuçlanmadı' : `Hesap açılır, ${GALLERY_TRIAL.gun} günlük deneme başlar`,
      not: ret ? (b.not ?? '') : 'Onaydan sonra çalışanlarını davet edebilirsin',
      bitti: onay,
    },
  ];
  return (
    <>
      <T accessibilityRole="header" style={{ fontSize: 22, fontWeight: '800' }}>
        {onay ? 'Başvurun onaylandı' : ret ? 'Başvurun onaylanmadı' : 'Başvurun alındı'}
      </T>
      <T style={{ marginTop: 6, marginBottom: 18, fontSize: 13.5, color: colors.muted, lineHeight: 19 }}>
        {onay
          ? `${GALLERY_TRIAL.gun} günlük ücretsiz denemen başladı.`
          : ret
            ? 'Gerekçeyi aşağıda görebilirsin; eksikleri tamamlayıp yeniden başvurabilirsin.'
            : 'Yönetici ekibimiz inceler; sonucu SMS ve e-postayla bildiririz. Genellikle 1 iş günü sürer.'}
      </T>
      {adimlar.map((a, i) => {
        const kirmizi = ret && i === 3;
        return (
          <View key={a.ad} style={{ flexDirection: 'row', gap: 12, paddingBottom: 16 }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: radii.buton,
                borderWidth: 2,
                borderColor: kirmizi ? '#E5484D' : a.bitti ? colors.blue : colors.line,
                backgroundColor: kirmizi ? '#E5484D' : a.bitti ? colors.blue : colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <T
                style={{
                  fontSize: 12,
                  fontWeight: '800',
                  color: kirmizi ? '#FFFFFF' : a.bitti ? colors.onBlue : colors.ink,
                }}
              >
                {kirmizi ? '✕' : a.bitti ? '✓' : i + 1}
              </T>
            </View>
            <View style={{ flex: 1 }}>
              <T style={{ fontSize: 15, fontWeight: '800' }}>{a.ad}</T>
              <T style={{ fontSize: 13, color: kirmizi ? '#A3271F' : colors.muted, marginTop: 2 }}>{a.not}</T>
            </View>
          </View>
        );
      })}
    </>
  );
}
