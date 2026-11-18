import {
  butonOran,
  colors,
  type DonanimGrubu,
  kartOran,
  radii,
  TEKNIK_ALANLARI,
  TEKNIK_KAYNAK,
  type TeknikOzet,
  teknikBolumleri,
  teknikOneCikanlar,
  tints,
} from '@rengarenk/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useOturum } from '../lib/oturum';
import { T, TInput } from './t';
import { Cip } from './talep/ortak';

/** Gökkuşağı açık zeminleri ve noktalar (tasarım: TINTS, DOTS; web `TeknikTablo` ile aynı) */
const TINTS = [tints.blue, tints.pink, tints.yellow, tints.green];
const nokta = (i: number) => [colors.blue, colors.pink, colors.yellow, colors.green][i % 4] as string;

/**
 * Talep sayfasında aracın ayrıntılı teknik özellikleri (sahip isteği, 17 ve 18 Kasım 2026; web `TeknikTablo` ile
 * aynı): motor sürümü başına öne çıkan değerler (renkli kutular), bölüm kartları (konsolda gizlenen satırlar çıkar,
 * eklenenler girer) ve paket donanımı. Değerler Türkiye'de satılan sürümlerle eşleşen kayıtlardan.
 */
export function TeknikTablo({
  motorlar,
  not,
  talepNo,
}: {
  motorlar: {
    ad: string;
    model?: string;
    ozet: TeknikOzet;
    /** Konsoldan girilen donanım (sahip isteği, 18 Kasım 2026); pakete özelse paketin adıyla */
    donanim?: { paket: string | null; gruplar: DonanimGrubu[] }[];
  }[];
  /** Verilirse "Bir değer yanlış mı? Bildir" görünür (sahip isteği, 17 Kasım 2026) */
  talepNo?: number;
  /** Başlık altı açıklama (ör. "G20 makyajsız kasa, 2019–2022") */
  not?: string | null;
}) {
  const [secili, setSecili] = useState(0);
  if (!motorlar.length) {
    return (
      <View style={{ padding: 14, borderRadius: butonOran(12), backgroundColor: colors.background }}>
        <T style={{ fontSize: 14, lineHeight: 20, color: colors.muted }}>
          Bu araç için katalogda teknik bilgi bulunamadı. Motor ya da kasa seçilince ayrıntı genişler.
        </T>
      </View>
    );
  }
  const sira = Math.min(secili, motorlar.length - 1);
  const m = motorlar[sira] as (typeof motorlar)[number];
  const bolumler = teknikBolumleri(m.ozet);
  const one = teknikOneCikanlar(m.ozet);
  return (
    <View>
      {motorlar.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityLabel="Motor seçenekleri"
          contentContainerStyle={{ gap: 6 }}
        >
          {motorlar.map((x, i) => (
            <Cip key={x.ad} on={i === sira} onPress={() => setSecili(i)}>
              {x.ad}
            </Cip>
          ))}
        </ScrollView>
      ) : (
        <T style={{ fontSize: 15.5, fontWeight: '800' }}>{m.ad}</T>
      )}
      {not ? (
        <T style={{ fontSize: 12.5, color: colors.muted, marginTop: 8, lineHeight: 17 }}>{not}</T>
      ) : null}

      {one.length ? (
        <View
          accessibilityLabel="Öne çıkan değerler"
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}
        >
          {one.map((x, i) => (
            <View
              key={x.etiket}
              style={{
                flexBasis: '47%',
                flexGrow: 1,
                backgroundColor: TINTS[i % TINTS.length],
                borderRadius: radii.buton,
                paddingVertical: 10,
                paddingHorizontal: 12,
              }}
            >
              <T style={{ fontSize: 12, fontWeight: '600', color: '#4A5064' }}>{x.etiket}</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 4 }}>
                <T style={{ fontSize: 19, fontWeight: '800' }}>{x.deger}</T>
                <T style={{ fontSize: 12.5, fontWeight: '700', color: '#4A5064' }}>{x.birim}</T>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {bolumler.map((b, i) => (
        <View
          key={b.baslik}
          accessibilityLabel={b.baslik}
          style={{
            marginTop: 12,
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: kartOran(14),
            backgroundColor: colors.surface,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingVertical: 10,
              paddingHorizontal: 12,
              backgroundColor: colors.background,
              borderBottomWidth: 1,
              borderBottomColor: colors.line,
            }}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: nokta(i) }} />
            <T accessibilityRole="header" style={{ fontSize: 14, fontWeight: '800' }}>
              {b.baslik}
            </T>
          </View>
          {b.satirlar.map(([etiket, deger], j) => (
            <View
              key={etiket}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                gap: 12,
                paddingVertical: 9,
                marginHorizontal: 12,
                borderTopWidth: j ? 1 : 0,
                borderTopColor: '#EEF0F5',
              }}
            >
              <T style={{ fontSize: 13.5, color: colors.muted }}>{etiket}</T>
              <T style={{ flex: 1, fontSize: 13.5, fontWeight: '700', textAlign: 'right' }}>{deger}</T>
            </View>
          ))}
        </View>
      ))}
      {m.donanim?.length ? <Donanim key={m.ad} liste={m.donanim} /> : null}
      <View
        style={{
          marginTop: 14,
          padding: 12,
          borderRadius: butonOran(12),
          backgroundColor: colors.background,
        }}
      >
        <T style={{ fontSize: 12, lineHeight: 17, color: colors.muted }}>
          {TEKNIK_KAYNAK}.
          {m.ozet.kaynaklar?.includes('manuel') || m.donanim?.length
            ? ' Bazı değerler ve donanım ekibimizce girildi.'
            : ''}{' '}
          Değerler pakete ve model yılına göre değişebilir.
        </T>
        {talepNo && m.model ? (
          <YanlisBildir key={m.model} talepNo={talepNo} motor={m.model} ad={m.ad} />
        ) : null}
      </View>
    </View>
  );
}

/** Teknik özellik "yanlış" bildirimi (web `YanlisBildir` ile aynı): konsolda Katalog › Teknik özellikler'e düşer */
function YanlisBildir({ talepNo, motor, ad }: { talepNo: number; motor: string; ad: string }) {
  const { durum: oturum, istek } = useOturum();
  const [acik, setAcik] = useState(false);
  const [alan, setAlan] = useState<string | null>(null);
  const [not, setNot] = useState('');
  const [durum, setDurum] = useState<'bos' | 'gonderiliyor' | 'tamam'>('bos');
  const [hata, setHata] = useState<string | null>(null);

  if (durum === 'tamam')
    return (
      <T
        accessibilityRole="text"
        style={{ marginTop: 10, fontSize: 13, fontWeight: '700', color: '#11683F' }}
      >
        Teşekkürler, bildirimin ekibimize ulaştı.
      </T>
    );
  if (!acik)
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => (oturum === 'uye' ? setAcik(true) : router.push('/giris'))}
        hitSlop={8}
        style={{ marginTop: 10, alignSelf: 'flex-start' }}
      >
        <T style={{ fontSize: 13, fontWeight: '700', color: colors.link }}>Bir değer yanlış mı? Bildir</T>
      </Pressable>
    );

  async function gonder() {
    setHata(null);
    if (not.trim().length < 5) return setHata('Neyin yanlış olduğunu kısaca yaz');
    setDurum('gonderiliyor');
    try {
      await istek('/demands/teknik-bildir', { method: 'POST', body: { no: talepNo, motor, alan, not } });
      setDurum('tamam');
    } catch (err) {
      setHata((err as Error).message);
      setDurum('bos');
    }
  }

  return (
    <View
      style={{
        marginTop: 10,
        padding: 12,
        gap: 8,
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: radii.buton,
        backgroundColor: colors.background,
      }}
    >
      <T style={{ fontSize: 13.5, fontWeight: '800' }}>{ad}: hangi değer yanlış?</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Cip on={alan === null} onPress={() => setAlan(null)}>
          Genel
        </Cip>
        {TEKNIK_ALANLARI.map((a) => (
          <Cip key={a.key} on={alan === a.key} onPress={() => setAlan(a.key)}>
            {a.ad}
          </Cip>
        ))}
      </View>
      <TInput
        accessibilityLabel="Açıklama"
        value={not}
        onChangeText={setNot}
        multiline
        maxLength={1000}
        placeholder="Ör. Güç 184 hp olmalı, ruhsatta öyle yazıyor"
        style={{
          minHeight: 70,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: radii.buton,
          padding: 10,
          fontSize: 14,
          textAlignVertical: 'top',
          backgroundColor: colors.surface,
        }}
      />
      {hata ? <T style={{ fontSize: 12.5, color: '#A3271F', fontWeight: '600' }}>{hata}</T> : null}
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <Pressable
          accessibilityRole="button"
          disabled={durum === 'gonderiliyor'}
          onPress={gonder}
          style={{
            backgroundColor: colors.blue,
            paddingVertical: 9,
            paddingHorizontal: 16,
            borderRadius: radii.buton,
          }}
        >
          <T style={{ fontSize: 13.5, fontWeight: '700', color: colors.onBlue }}>
            {durum === 'gonderiliyor' ? 'Gönderiliyor…' : 'Gönder'}
          </T>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => setAcik(false)} hitSlop={8}>
          <T style={{ fontSize: 13, fontWeight: '700', color: colors.link }}>Vazgeç</T>
        </Pressable>
      </View>
    </View>
  );
}

/** Bir grupta ilk bakışta gösterilen öğe sayısı (web ile aynı) */
const GRUP_ILK = 8;

/** Donanım (web `Donanim` ile aynı): paket sekmeleri, renkli başlıklı grup kartları, yeşil işaretli öğeler */
function Donanim({ liste }: { liste: { paket: string | null; gruplar: DonanimGrubu[] }[] }) {
  const [secili, setSecili] = useState(0);
  const [acik, setAcik] = useState<Record<string, boolean>>({});
  const d = liste[Math.min(secili, liste.length - 1)] as (typeof liste)[number];
  const toplam = d.gruplar.reduce((n, g) => n + g.ogeler.length, 0);
  return (
    <View accessibilityLabel="Donanım" style={{ marginTop: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <T accessibilityRole="header" style={{ fontSize: 16, fontWeight: '800' }}>
          Donanım
        </T>
        <T style={{ fontSize: 12.5, color: colors.muted }}>
          {d.paket ? `${d.paket} paketi · ` : ''}
          {toplam} özellik
        </T>
      </View>
      {liste.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityLabel="Paketler"
          style={{ marginTop: 8 }}
          contentContainerStyle={{ gap: 6 }}
        >
          {liste.map((x, i) => (
            <Cip key={x.paket ?? ''} on={i === secili} onPress={() => setSecili(i)}>
              {x.paket ?? 'Bütün paketler'}
            </Cip>
          ))}
        </ScrollView>
      ) : null}
      {d.gruplar.map((g, i) => {
        const anahtar = `${d.paket ?? ''}|${g.ad}`;
        const hepsi = acik[anahtar] || g.ogeler.length <= GRUP_ILK + 1;
        const ogeler = hepsi ? g.ogeler : g.ogeler.slice(0, GRUP_ILK);
        return (
          <View
            key={g.ad}
            style={{
              marginTop: 10,
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: kartOran(14),
              overflow: 'hidden',
              backgroundColor: colors.surface,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: 9,
                paddingHorizontal: 12,
                backgroundColor: TINTS[i % TINTS.length],
              }}
            >
              <T style={{ fontSize: 13.5, fontWeight: '800' }}>{g.ad}</T>
              <T style={{ fontSize: 12.5, fontWeight: '700', color: '#4A5064' }}>{g.ogeler.length}</T>
            </View>
            <View style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
              {ogeler.map((o) => (
                <View key={o} style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
                  <View
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: tints.green,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <T style={{ fontSize: 10.5, fontWeight: '800', color: '#11683F' }}>✓</T>
                  </View>
                  <T style={{ flex: 1, fontSize: 13.5, lineHeight: 19 }}>{o}</T>
                </View>
              ))}
              {g.ogeler.length > ogeler.length ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setAcik((a) => ({ ...a, [anahtar]: true }))}
                  hitSlop={8}
                  style={{ paddingVertical: 6 }}
                >
                  <T style={{ fontSize: 13, fontWeight: '700', color: colors.link }}>
                    +{g.ogeler.length - ogeler.length} özellik daha
                  </T>
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
