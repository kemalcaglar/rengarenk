import {
  colors,
  type DonanimGrubu,
  radii,
  TEKNIK_ALANLARI,
  TEKNIK_KAYNAK,
  type TeknikOzet,
  teknikBolumleri,
} from '@rengarenk/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useOturum } from '../lib/oturum';
import { T, TInput } from './t';
import { Cip } from './talep/ortak';

/**
 * Talep sayfasında aracın ayrıntılı teknik özellikleri (sahip isteği, 17 Kasım 2026; web `TeknikTablo` ile aynı):
 * motor sürümü başına bölüm bölüm (motor, performans, şanzıman ve çekiş, tüketim ve emisyon, ölçüler ve ağırlık,
 * lastik ve fren). Değerler Türkiye'de satılan sürümlerle eşleşen kayıtlardan; sürümler arasında farklıysa aralık.
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
      <T style={{ fontSize: 14, lineHeight: 20, color: colors.muted }}>
        Bu araç için katalogda teknik bilgi bulunamadı. Motor ya da kasa seçilince ayrıntı genişler.
      </T>
    );
  }
  const sira = Math.min(secili, motorlar.length - 1);
  const m = motorlar[sira] as (typeof motorlar)[number];
  const bolumler = teknikBolumleri(m.ozet);
  return (
    <View>
      {motorlar.length > 1 ? (
        <View
          accessibilityLabel="Motor seçenekleri"
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}
        >
          {motorlar.map((x, i) => (
            <Cip key={x.ad} on={i === sira} onPress={() => setSecili(i)}>
              {x.ad}
            </Cip>
          ))}
        </View>
      ) : (
        <T style={{ fontSize: 15, fontWeight: '800' }}>{m.ad}</T>
      )}
      {not ? (
        <T style={{ fontSize: 12.5, color: colors.muted, marginTop: 8, lineHeight: 17 }}>{not}</T>
      ) : null}
      {bolumler.map((b) => (
        <View key={b.baslik} accessibilityLabel={b.baslik} style={{ marginTop: 16 }}>
          <T
            accessibilityRole="header"
            style={{
              fontSize: 12.5,
              fontWeight: '800',
              letterSpacing: 0.3,
              color: colors.muted,
              marginBottom: 4,
            }}
          >
            {/* Türkçe büyük harf ("çekiş" → "ÇEKİŞ"); textTransform dile göre çevirmez */}
            {b.baslik.toLocaleUpperCase('tr-TR')}
          </T>
          {b.satirlar.map(([etiket, deger]) => (
            <View
              key={etiket}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                gap: 12,
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderBottomColor: colors.line,
              }}
            >
              <T style={{ fontSize: 13.5, color: colors.muted }}>{etiket}</T>
              <T style={{ flex: 1, fontSize: 13.5, fontWeight: '700', textAlign: 'right' }}>{deger}</T>
            </View>
          ))}
        </View>
      ))}
      {m.donanim?.length ? <Donanim liste={m.donanim} /> : null}
      <T style={{ fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 14 }}>
        {TEKNIK_KAYNAK}.
        {m.ozet.kaynaklar?.includes('manuel') || m.donanim?.length
          ? ' Bazı değerler ve donanım ekibimizce girildi.'
          : ''}{' '}
        Değerler pakete ve model yılına göre değişebilir.
      </T>
      {talepNo && m.model ? <YanlisBildir key={m.model} talepNo={talepNo} motor={m.model} ad={m.ad} /> : null}
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

/** Donanım listesi (web `Donanim` ile aynı): paket başına, grup grup işaretli öğeler */
function Donanim({ liste }: { liste: { paket: string | null; gruplar: DonanimGrubu[] }[] }) {
  return (
    <View accessibilityLabel="Donanım" style={{ marginTop: 18 }}>
      <T
        accessibilityRole="header"
        style={{
          fontSize: 12.5,
          fontWeight: '800',
          letterSpacing: 0.3,
          color: colors.muted,
          marginBottom: 4,
        }}
      >
        DONANIM
      </T>
      {liste.map((d) => (
        <View key={d.paket ?? ''} style={{ marginTop: 6 }}>
          {d.paket ? (
            <T style={{ fontSize: 14, fontWeight: '800', marginBottom: 6 }}>{d.paket} paketi</T>
          ) : null}
          {d.gruplar.map((g) => (
            <View key={g.ad} style={{ marginBottom: 10 }}>
              <T style={{ fontSize: 13.5, fontWeight: '800', marginBottom: 2 }}>{g.ad}</T>
              {g.ogeler.map((o) => (
                <View key={o} style={{ flexDirection: 'row', gap: 8, paddingVertical: 3 }}>
                  <T
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                    style={{ color: colors.green, fontWeight: '800' }}
                  >
                    ✓
                  </T>
                  <T style={{ flex: 1, fontSize: 13.5, lineHeight: 19 }}>{o}</T>
                </View>
              ))}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
