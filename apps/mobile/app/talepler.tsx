import { colors, ILLER, radii, searchQueryKey } from '@rengarenk/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Banner } from '../components/banner';
import { Ikon } from '../components/ikon';
import { Logo } from '../components/logo';
import { MenuCekmecesi } from '../components/menu-cekmecesi';
import { T, TInput } from '../components/t';
import { Cip, girdiStil, Secici, sayiOku } from '../components/talep/ortak';
import { API } from '../lib/api';
import { useKategoriler } from '../lib/kategoriler';
import { useOturum } from '../lib/oturum';
import { binlik, butceAraligi, yilAraligi, zaman } from '../lib/talep-bicim';

const TINTS = ['#EEF3FF', '#FFEEF6', '#FFF6DF', '#E7FAF0', '#F3EFFF', '#FFF0EA'];
const SIRA = [
  ['onerilen', 'Önerilen sıralama'],
  ['yeni', 'En yeni'],
  ['butce_azalan', 'Bütçe: yüksekten düşüğe'],
  ['butce_artan', 'Bütçe: düşükten yükseğe'],
] as const;

interface Sonuc {
  no: number;
  baslik: string;
  yilMin: number | null;
  yilMax: number | null;
  kmMax: number | null;
  butceMin: number | null;
  butceMax: number | null;
  il: string | null;
  ilce: string | null;
  yayin: string;
  acil?: boolean;
  ustSira?: boolean;
}
type Q = Record<string, string | undefined>;

/** Talep listesi ve arama (tasarım: ListeMobil; Karar 06.1, 06.3) */
export default function Talepler() {
  const p = useLocalSearchParams<Q>();
  const { durum, istek } = useOturum();
  const kategoriler = useKategoriler();
  // Kayıtlı aramadan gelindiyse bütün filtreler adresle gelir; çoklu değerler virgülle ayrılır.
  const [q, setQ] = useState<Q>(() =>
    Object.fromEntries(
      Object.entries(p as Record<string, string | string[] | undefined>).map(([k, v]) => [
        k,
        Array.isArray(v) ? v.join(',') : v,
      ]),
    ),
  );
  const [kayit, setKayit] = useState<string | null>(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [metin, setMetin] = useState(p.q ?? '');
  const [liste, setListe] = useState<Sonuc[] | null>(null);
  const [toplam, setToplam] = useState(0);
  const [markalar, setMarkalar] = useState<{ key: string; ad: string; n: number }[]>([]);
  const [sayfa, setSayfa] = useState(1);
  const [filtre, setFiltre] = useState(false);
  const [sirala, setSirala] = useState(false);
  const [menu, setMenu] = useState(false);

  const yukle = useCallback(
    async (s: number) => {
      const u = new URLSearchParams(
        Object.entries({ ...q, sayfa: String(s) }).filter((x): x is [string, string] => Boolean(x[1])),
      );
      const r = await fetch(`${API}/talepler?${u.toString()}`);
      if (!r.ok) throw new Error('Talepler yüklenemedi');
      const d = (await r.json()) as {
        toplam: number;
        sonuclar: Sonuc[];
        filtreler: { marka: { key: string; ad: string; n: number }[] };
      };
      setToplam(d.toplam);
      setMarkalar(d.filtreler.marka);
      setListe((l) => (s === 1 ? d.sonuclar : [...(l ?? []), ...d.sonuclar]));
      setSayfa(s);
    },
    [q],
  );

  useEffect(() => {
    yukle(1).catch(() => setListe([]));
  }, [yukle]);

  // Arama günlüğü (Raporlar › En çok aranan modeller): aramanın ilk sayfası bir kez; metin saklanmaz
  useEffect(() => {
    if (!(q.marka || q.q)) return;
    fetch(`${API}/talepler/arama`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kategori: q.kategori, marka: q.marka, seri: q.seri, q: q.q }),
    }).catch(() => undefined);
  }, [q]);

  // Bu arama kayıtlı mı (Karar 30)
  const anahtar = searchQueryKey(q);
  useEffect(() => {
    if (durum !== 'uye') {
      setKayit(null);
      return;
    }
    istek<{ id: string; sorgu: Record<string, unknown> }[]>('/saved-searches')
      .then((l) => setKayit(l.find((s) => searchQueryKey(s.sorgu) === anahtar)?.id ?? null))
      .catch(() => undefined);
  }, [durum, istek, anahtar]);

  const kat = kategoriler.find((c) => c.slug === q.kategori || c.children.some((x) => x.slug === q.kategori));
  const altKat = kat?.children.find((x) => x.slug === q.kategori);
  const markaAd = markalar.find((m) => m.key === q.marka)?.ad;
  const baslik = q.q
    ? `“${q.q}” için talepler`
    : `${markaAd ?? altKat?.name ?? kat?.name ?? 'Tüm'} talepleri`;

  async function kaydet() {
    if (durum !== 'uye') {
      router.push('/giris');
      return;
    }
    setKaydediliyor(true);
    try {
      if (kayit) {
        await istek(`/saved-searches/${kayit}`, { method: 'DELETE' });
        setKayit(null);
      } else {
        const sorgu = Object.fromEntries(Object.entries(q).filter(([, v]) => v));
        const r = await istek<{ id: string }>('/saved-searches', {
          method: 'POST',
          body: { ad: baslik.slice(0, 80), sorgu },
        });
        setKayit(r.id);
      }
    } catch (e) {
      Alert.alert('Arama kaydedilemedi', (e as Error).message);
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <View
        style={{
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
          paddingTop: 10,
          paddingHorizontal: 12,
          paddingBottom: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kategoriler menüsü"
            onPress={() => setMenu(true)}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ikon d="menu" />
          </Pressable>
          <Pressable accessibilityRole="link" onPress={() => router.replace('/')}>
            <Logo />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Talep oluştur"
            onPress={() => router.push(durum === 'uye' ? '/talep-olustur' : '/giris')}
            style={{
              width: 44,
              height: 44,
              borderRadius: radii.buton - 2,
              backgroundColor: colors.blue,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ikon d="arti" size={20} width={2.4} />
          </Pressable>
        </View>
        <View
          style={{
            marginTop: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: '#F3F5FA',
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: radii.buton - 2,
            paddingHorizontal: 12,
          }}
        >
          <Ikon d="ara" size={18} width={2} color={colors.muted} />
          <TInput
            accessibilityLabel="Talep ara"
            placeholder="Marka, model veya talep no ile ara"
            returnKeyType="search"
            value={metin}
            onChangeText={setMetin}
            onSubmitEditing={() => setQ({ ...q, q: metin.trim() || undefined })}
            style={{ flex: 1, fontSize: 15, paddingVertical: 12 }}
          />
        </View>
      </View>
      <View
        style={{
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
          paddingVertical: 10,
          paddingHorizontal: 12,
          flexDirection: 'row',
          gap: 8,
        }}
      >
        {[
          ['Filtrele', () => setFiltre(true)],
          ['Sırala', () => setSirala(true)],
        ].map(([ad, fn]) => (
          <Pressable
            key={ad as string}
            accessibilityRole="button"
            onPress={fn as () => void}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: '#D5DAE5',
              borderRadius: radii.buton - 2,
              paddingVertical: 11,
              alignItems: 'center',
            }}
          >
            <T style={{ fontSize: 14, fontWeight: '700' }}>{ad as string}</T>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: Boolean(kayit), busy: kaydediliyor }}
          disabled={kaydediliyor}
          onPress={kaydet}
          style={{
            flex: 1,
            borderWidth: kayit ? 1.5 : 1,
            borderColor: kayit ? '#25A35A' : '#D5DAE5',
            backgroundColor: kayit ? '#E7FAF0' : colors.surface,
            borderRadius: radii.buton - 2,
            paddingVertical: kayit ? 10.5 : 11,
            alignItems: 'center',
          }}
        >
          <T style={{ fontSize: 13.5, fontWeight: '700', color: kayit ? '#11683F' : colors.ink }}>
            {kayit ? 'Kaydedildi' : 'Aramayı kaydet'}
          </T>
        </Pressable>
      </View>
      <FlatList
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 12, paddingBottom: 32, gap: 10 }}
        data={liste ?? []}
        keyExtractor={(t) => String(t.no)}
        onEndReached={() => {
          if (liste && liste.length < toplam) yukle(sayfa + 1).catch(() => undefined);
        }}
        ListHeaderComponent={
          <View style={{ marginBottom: 2 }}>
            <Banner yer="talep_listesi" style={{ marginBottom: 10 }} />
            <T style={{ fontSize: 12.5, color: colors.muted, marginBottom: 4 }}>
              {['Vasıta', kat?.name, altKat?.name, markaAd].filter(Boolean).join(' › ')}
            </T>
            <T accessibilityRole="header" style={{ fontSize: 20, fontWeight: '800', marginBottom: 2 }}>
              {baslik}{' '}
              <T style={{ fontSize: 14, fontWeight: '600', color: colors.muted }}>· {binlik(toplam)} talep</T>
            </T>
          </View>
        }
        ListEmptyComponent={
          liste ? (
            <View
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.line,
                borderRadius: 16,
                padding: 20,
              }}
            >
              <T style={{ textAlign: 'center', color: colors.muted }}>
                Bu filtrelere uyan yayında talep yok.
              </T>
            </View>
          ) : (
            <T style={{ color: colors.muted }}>Yükleniyor…</T>
          )
        }
        renderItem={({ item: t, index }) => (
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push(`/talep/${t.no}`)}
            style={{
              flexDirection: 'row',
              gap: 12,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: 16,
              padding: 12,
            }}
          >
            <View
              style={{
                width: 86,
                height: 86,
                borderRadius: radii.buton - 2,
                backgroundColor: TINTS[index % TINTS.length],
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View style={{ width: 74, height: 27, borderRadius: 10, backgroundColor: '#D6DDEA' }} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T style={{ fontSize: 14.5, fontWeight: '800', lineHeight: 19 }}>{t.baslik}</T>
              <T style={{ fontSize: 12.5, color: colors.muted, marginTop: 4 }}>
                {[
                  yilAraligi(t.yilMin, t.yilMax),
                  t.kmMax ? `${binlik(t.kmMax)} km` : null,
                  [t.il, t.ilce].filter(Boolean).join(', '),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </T>
              <T style={{ fontSize: 14.5, fontWeight: '800', color: colors.link, marginTop: 6 }}>
                {butceAraligi(t.butceMin, t.butceMax)}
              </T>
              <View
                style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginTop: 6 }}
              >
                {t.acil ? (
                  <T
                    style={{
                      backgroundColor: '#FFF6DF',
                      color: '#7A5300',
                      fontSize: 11.5,
                      fontWeight: '700',
                      paddingVertical: 3,
                      paddingHorizontal: 8,
                      borderRadius: radii.etiket,
                      overflow: 'hidden',
                    }}
                  >
                    Acil
                  </T>
                ) : null}
                {t.ustSira ? (
                  <T
                    style={{
                      backgroundColor: '#FFEEF6',
                      color: '#9B1C5B',
                      fontSize: 11.5,
                      fontWeight: '700',
                      paddingVertical: 3,
                      paddingHorizontal: 8,
                      borderRadius: radii.etiket,
                      overflow: 'hidden',
                    }}
                  >
                    Öne çıkan
                  </T>
                ) : null}
                <T style={{ fontSize: 11.5, color: colors.muted }}>{zaman(t.yayin)}</T>
              </View>
            </View>
          </Pressable>
        )}
      />

      <Modal visible={sirala} transparent animationType="fade" onRequestClose={() => setSirala(false)}>
        <Pressable
          accessibilityLabel="Kapat"
          onPress={() => setSirala(false)}
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
            {SIRA.map(([key, ad]) => (
              <Pressable
                key={key}
                accessibilityRole="button"
                onPress={() => {
                  setQ({ ...q, sira: key });
                  setSirala(false);
                }}
                style={{ paddingVertical: 14 }}
              >
                <T style={{ fontSize: 15, fontWeight: (q.sira ?? 'onerilen') === key ? '800' : '600' }}>
                  {ad}
                </T>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Filtreler acik={filtre} kapat={() => setFiltre(false)} q={q} uygula={setQ} markalar={markalar} />
      <MenuCekmecesi acik={menu} kapat={() => setMenu(false)} />
    </SafeAreaView>
  );
}

/** Filtre paneli: kategori, marka, il, model yılı, bütçe, telefonla ulaşılabilir */
function Filtreler({
  acik,
  kapat,
  q,
  uygula,
  markalar,
}: {
  acik: boolean;
  kapat: () => void;
  q: Q;
  uygula: (q: Q) => void;
  markalar: { key: string; ad: string; n: number }[];
}) {
  const kategoriler = useKategoriler();
  const [t, setT] = useState<Q>(q);
  useEffect(() => setT(q), [q]);
  const kutu = { ...girdiStil, flex: 1 };
  return (
    <Modal visible={acik} animationType="slide" onRequestClose={kapat}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 12,
            backgroundColor: colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: colors.line,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kapat"
            onPress={kapat}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ikon d="kapat" />
          </Pressable>
          <T style={{ fontSize: 15, fontWeight: '800' }}>Filtrele</T>
          <Pressable accessibilityRole="button" onPress={() => setT({ q: q.q })} style={{ padding: 12 }}>
            <T style={{ color: colors.link, fontWeight: '700' }}>Temizle</T>
          </Pressable>
        </View>
        <FlatList
          data={[0]}
          keyExtractor={() => 'f'}
          contentContainerStyle={{ padding: 16, gap: 16 }}
          renderItem={() => (
            <View style={{ gap: 18 }}>
              <View>
                <T style={{ fontSize: 15, fontWeight: '800', marginBottom: 8 }}>Kategori</T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {kategoriler
                    .flatMap((c) => [c, ...c.children])
                    .map((c) => (
                      <Cip
                        key={c.slug}
                        on={t.kategori === c.slug}
                        onPress={() =>
                          setT({
                            ...t,
                            kategori: t.kategori === c.slug ? undefined : c.slug,
                            marka: undefined,
                          })
                        }
                      >
                        {c.name}
                      </Cip>
                    ))}
                </View>
              </View>
              {markalar.length ? (
                <Secici
                  etiket="Marka"
                  deger={t.marka}
                  bos="Tüm markalar"
                  secenekler={markalar.map((m) => ({ key: m.key, ad: `${m.ad} (${m.n})` }))}
                  onSec={(k) => setT({ ...t, marka: k })}
                />
              ) : null}
              <Secici
                etiket="İl"
                deger={t.il}
                bos="Tüm iller"
                secenekler={ILLER.map((i) => ({ key: i.ad, ad: i.ad }))}
                onSec={(k) => setT({ ...t, il: k })}
              />
              {(
                [
                  ['Model yılı', 'yilMin', 'yilMax', false],
                  ['Bütçe (TL)', 'butceMin', 'butceMax', true],
                ] as const
              ).map(([ad, a, b, para]) => (
                <View key={ad}>
                  <T style={{ fontSize: 15, fontWeight: '800', marginBottom: 8 }}>{ad}</T>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {[a, b].map((k, i) => (
                      <TInput
                        key={k}
                        accessibilityLabel={`${ad} ${i ? 'en çok' : 'en az'}`}
                        placeholder={i ? 'En çok' : 'En az'}
                        keyboardType="number-pad"
                        value={t[k] ? (para ? binlik(Number(t[k])) : (t[k] as string)) : ''}
                        onChangeText={(s) => setT({ ...t, [k]: sayiOku(s)?.toString() })}
                        style={kutu}
                      />
                    ))}
                  </View>
                </View>
              ))}
              <Cip
                on={t.telefon === '1'}
                onPress={() => setT({ ...t, telefon: t.telefon === '1' ? undefined : '1' })}
              >
                Telefonla ulaşılabilir
              </Cip>
            </View>
          )}
        />
        <View
          style={{
            padding: 16,
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.line,
          }}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              uygula(t);
              kapat();
            }}
            style={{
              backgroundColor: colors.blue,
              borderRadius: radii.buton,
              paddingVertical: 15,
              alignItems: 'center',
            }}
          >
            <T style={{ fontSize: 15.5, fontWeight: '800' }}>Filtrele</T>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
