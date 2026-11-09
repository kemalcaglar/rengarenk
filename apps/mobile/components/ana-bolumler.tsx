import { colors, HELP_TOPICS, type HomeResponse, type PublicCategory, tints } from '@rengarenk/shared';
import { type Href, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useOturum } from '../lib/oturum';
import { T } from './t';

/**
 * Mobil ana sayfanın kişiye özel ve isteğe bağlı bölümleri (Karar 46; YonetimIcerik.dc.html › anasayfa). Görünürlük ve
 * sıra konsoldaki "Ana sayfa düzeni"nden gelir.
 */

const kart = {
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.line,
  borderRadius: 16,
} as const;

export function Baslik({ yazi, sag, git }: { yazi: string; sag?: string; git?: () => void }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginHorizontal: 12,
        marginBottom: 10,
      }}
    >
      <T accessibilityRole="header" style={{ fontSize: 17, fontWeight: '800', flexShrink: 1 }}>
        {yazi}
      </T>
      {sag ? (
        <T
          accessibilityRole="link"
          onPress={git}
          style={{ fontSize: 13.5, fontWeight: '700', color: colors.link }}
        >
          {sag}
        </T>
      ) : null}
    </View>
  );
}

type Galeri = NonNullable<HomeResponse['galeri']>;

const kucukDugme = (yazi: string, git: () => void, rozet?: number) => (
  <Pressable
    accessibilityRole="link"
    onPress={git}
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 12,
      paddingVertical: 9,
      paddingHorizontal: 12,
      backgroundColor: colors.surface,
    }}
  >
    <T style={{ fontSize: 13.5, fontWeight: '700' }}>{yazi}</T>
    {rozet ? (
      <View style={{ backgroundColor: colors.pink, borderRadius: 999, paddingHorizontal: 7 }}>
        <T style={{ fontSize: 12, fontWeight: '800' }}>{rozet}</T>
      </View>
    ) : null}
  </Pressable>
);

/** Galeri karşılaması: ad, paket ve bugün kalan ilk mesaj hakkı */
export function GaleriKarsilama({ g }: { g: Galeri }) {
  return (
    <View style={{ ...kart, marginHorizontal: 12, padding: 14, gap: 10 }}>
      <View>
        <T accessibilityRole="header" style={{ fontSize: 19, fontWeight: '800' }}>
          Merhaba, {g.ad}
        </T>
        <T style={{ fontSize: 13.5, color: colors.muted, marginTop: 3 }}>
          {g.paket} paket
          {g.gunluk ? ' · Bugün kalan ilk mesaj hakkın ' : ' · Mesaj göndermek için paket seç'}
          {g.gunluk ? (
            <T style={{ fontSize: 13.5, fontWeight: '800' }}>
              {g.gunluk.kalan} / {g.gunluk.toplam}
            </T>
          ) : null}
        </T>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {kucukDugme(`Portföyüm (${g.portfoy} araç)`, () => router.push('/galeri-paneli'))}
        {kucukDugme('Mesajlar', () => router.push('/(sekmeler)/mesajlar'), g.okunmamis)}
      </View>
    </View>
  );
}

export function HakKarti({ g }: { g: Galeri }) {
  const oran = g.gunluk?.toplam ? g.gunluk.kalan / g.gunluk.toplam : 0;
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push('/haklarim')}
      style={{ ...kart, marginHorizontal: 12, padding: 14, backgroundColor: tints.yellow }}
    >
      <T style={{ fontSize: 15, fontWeight: '800' }}>
        {g.gunluk ? `Bugün ${g.gunluk.kalan} ilk mesaj hakkın kaldı` : 'Paketin yok; ilk mesaj gönderemezsin'}
      </T>
      <T style={{ fontSize: 12.5, color: '#5A3D00', marginTop: 3 }}>
        {g.paket} paket{g.gunluk ? ` · günde ${g.gunluk.toplam}` : ''} · ek hak {g.ek} · Paket ve ek haklar ›
      </T>
      {g.gunluk ? (
        <View
          style={{
            height: 8,
            borderRadius: 999,
            backgroundColor: '#FFFFFF',
            marginTop: 8,
            overflow: 'hidden',
          }}
        >
          <View
            style={{ width: `${Math.round(oran * 100)}%`, height: '100%', backgroundColor: colors.yellow }}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

export function ArananModeller({ a }: { a: NonNullable<HomeResponse['aranan']> }) {
  return (
    <View>
      <Baslik
        yazi={`${a.bolge.replace(/^./, (c) => c.toLocaleUpperCase('tr-TR'))} aranan modeller`}
        sag="Araç ekle"
        git={() => router.push('/galeri-arac')}
      />
      <View style={{ ...kart, marginHorizontal: 12, overflow: 'hidden' }}>
        {a.modeller.map((m) => (
          <View
            key={m.ad}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingVertical: 11,
              paddingHorizontal: 14,
              borderBottomWidth: 1,
              borderBottomColor: '#EEF0F5',
            }}
          >
            <T style={{ width: 18, fontWeight: '800', color: colors.muted }}>{m.sira}</T>
            <View style={{ flex: 1 }}>
              <T style={{ fontSize: 14, fontWeight: '700' }}>{m.ad}</T>
              <T style={{ fontSize: 12.5, fontWeight: '800', color: colors.link, marginTop: 2 }}>
                {m.talep} talep
              </T>
            </View>
            <T
              style={{
                fontSize: 12,
                fontWeight: '800',
                paddingVertical: 3,
                paddingHorizontal: 8,
                borderRadius: 999,
                overflow: 'hidden',
                backgroundColor: m.arac ? '#E7FAF0' : '#FFF6DF',
                color: m.arac ? '#11683F' : '#7A5300',
              }}
            >
              {m.arac ? `Portföyünde ${m.arac}` : 'Portföyünde yok'}
            </T>
          </View>
        ))}
        <T style={{ padding: 12, fontSize: 13, lineHeight: 18, backgroundColor: '#F6F8FD' }}>
          <T style={{ fontSize: 13, fontWeight: '800' }}>Ajan: </T>
          {a.oneri}
        </T>
      </View>
    </View>
  );
}

export function TaleplerimOzeti({ liste }: { liste: NonNullable<HomeResponse['taleplerim']> }) {
  return (
    <View>
      <Baslik yazi="Aktif taleplerin" sag="Taleplerim" git={() => router.push('/(sekmeler)/taleplerim')} />
      <View style={{ gap: 8, paddingHorizontal: 12 }}>
        {liste.length ? (
          liste.map((t) => (
            <Pressable
              key={t.no}
              accessibilityRole="link"
              onPress={() => router.push(`/talep/${t.no}`)}
              style={{ ...kart, padding: 12 }}
            >
              <T style={{ fontSize: 14, fontWeight: '800' }}>{t.baslik}</T>
              <T style={{ fontSize: 12.5, color: colors.muted, marginTop: 4 }}>
                {t.kalanGun} gün kaldı · {t.yazan} satıcı yazdı
              </T>
            </Pressable>
          ))
        ) : (
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push('/talep-olustur')}
            style={{ ...kart, padding: 12 }}
          >
            <T style={{ fontSize: 13.5, color: colors.muted }}>
              Yayında talebin yok. <T style={{ fontSize: 13.5, fontWeight: '800' }}>Talep oluştur ›</T>
            </T>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function GelenMesajlar({ liste }: { liste: NonNullable<HomeResponse['mesajlar']> }) {
  if (!liste.length) return null;
  return (
    <View>
      <Baslik yazi="Gelen ilk mesajlar" sag="Mesajlar" git={() => router.push('/(sekmeler)/mesajlar')} />
      <View style={{ ...kart, marginHorizontal: 12, overflow: 'hidden' }}>
        {liste.map((m) => (
          <Pressable
            key={m.id}
            accessibilityRole="link"
            accessibilityLabel={`${m.satici}${m.okunmadi ? ', okunmadı' : ''}`}
            onPress={() => router.push(`/sohbet/${m.id}`)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderBottomWidth: 1,
              borderBottomColor: '#EEF0F5',
            }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: m.okunmadi ? colors.pink : '#D5DAE5',
              }}
            />
            <View style={{ flex: 1 }}>
              <T style={{ fontSize: 14, fontWeight: m.okunmadi ? '800' : '600' }}>{m.satici}</T>
              <T numberOfLines={1} style={{ fontSize: 12.5, color: colors.muted, marginTop: 2 }}>
                {m.talep}
              </T>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

interface Arama {
  id: string;
  ad: string;
  sorgu: Record<string, unknown>;
  kriterler: string[];
  yeni: number | null;
}

/** Kayıtlı aramalar: yeni talep gelenler (yalnızca üyede) */
export function KayitliAramalar() {
  const { durum, istek } = useOturum();
  const [liste, setListe] = useState<Arama[]>([]);
  useEffect(() => {
    if (durum === 'uye')
      istek<Arama[]>('/saved-searches')
        .then((a) => setListe(a.slice(0, 3)))
        .catch(() => undefined);
  }, [durum, istek]);
  if (!liste.length) return null;
  return (
    <View>
      <Baslik yazi="Kayıtlı aramalarınız" sag="Tümü" git={() => router.push('/favoriler')} />
      <View style={{ gap: 8, paddingHorizontal: 12 }}>
        {liste.map((a) => (
          <Pressable
            key={a.id}
            accessibilityRole="link"
            onPress={() =>
              router.push({
                pathname: '/talepler',
                params: Object.fromEntries(Object.entries(a.sorgu).map(([k, v]) => [k, String(v)])),
              })
            }
            style={{ ...kart, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}
          >
            <View style={{ flex: 1 }}>
              <T style={{ fontSize: 14, fontWeight: '700' }}>{a.ad}</T>
              <T numberOfLines={1} style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                {a.kriterler.slice(0, 3).join(' · ')}
              </T>
            </View>
            <T style={{ fontSize: 13, fontWeight: '800', color: colors.link }}>{a.yeni ?? 0} yeni</T>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

interface Eslesme {
  no: number;
  baslik: string;
  il: string | null;
  arac: string;
}

/** Galeri: portföyüne uyan talepler */
export function PortfoyEslesmeleri() {
  const { durum, istek } = useOturum();
  const [liste, setListe] = useState<Eslesme[]>([]);
  useEffect(() => {
    if (durum === 'uye')
      istek<{ eslesmeler: Eslesme[] }>('/me/matches')
        .then((r) => setListe(r.eslesmeler.slice(0, 3)))
        .catch(() => undefined);
  }, [durum, istek]);
  if (!liste.length) return null;
  return (
    <View>
      <Baslik yazi="Portföyünüze uyan talepler" sag="Tümünü gör" git={() => router.push('/galeri-paneli')} />
      <View style={{ gap: 8, paddingHorizontal: 12 }}>
        {liste.map((e) => (
          <Pressable
            key={e.no}
            accessibilityRole="link"
            onPress={() => router.push(`/talep/${e.no}`)}
            style={{ ...kart, padding: 12 }}
          >
            <T style={{ fontSize: 12, fontWeight: '700', color: '#11683F' }}>{e.arac} uyuyor</T>
            <T style={{ fontSize: 14, fontWeight: '800', marginTop: 4 }}>{e.baslik}</T>
            <T style={{ fontSize: 12.5, color: colors.muted, marginTop: 2 }}>{e.il ?? 'Tüm Türkiye'}</T>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Kategori kutuları: yatay kaydırılır */
export function KategoriKutulari({ kategoriler }: { kategoriler: PublicCategory[] }) {
  if (!kategoriler.length) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}
    >
      {kategoriler.map((c) => (
        <Pressable
          key={c.slug}
          accessibilityRole="link"
          onPress={() => router.push({ pathname: '/talepler', params: { kategori: c.slug } } as Href)}
          style={{
            ...kart,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 10,
            paddingHorizontal: 12,
          }}
        >
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c.color }} />
          <T style={{ fontSize: 13.5, fontWeight: '700' }}>{c.name}</T>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const ROZETLER = [
  'Galeriler yetki belgesiyle doğrulanır',
  'Numaran sen izin verene kadar gizli',
  'Mesajlar güvenlik kurallarıyla denetlenir',
  'Kişisel verin Türkiye’de saklanır',
];

export function GuvenRozetleri() {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12 }}>
      {ROZETLER.map((r) => (
        <T
          key={r}
          style={{
            backgroundColor: '#E7FAF0',
            color: '#11683F',
            borderRadius: 999,
            overflow: 'hidden',
            paddingVertical: 7,
            paddingHorizontal: 12,
            fontSize: 12.5,
            fontWeight: '800',
          }}
        >
          ✓ {r}
        </T>
      ))}
    </View>
  );
}

const SORULAR = HELP_TOPICS.slice(0, 6).map((t) => t.sorular[0] as readonly [string, string]);

export function SikSorulanlar() {
  const [acik, setAcik] = useState<string | null>(null);
  return (
    <View>
      <Baslik yazi="Sık sorulanlar" sag="Yardım" git={() => router.push('/yardim')} />
      <View style={{ ...kart, marginHorizontal: 12, overflow: 'hidden' }}>
        {SORULAR.map(([soru, cevap]) => (
          <Pressable
            key={soru}
            accessibilityRole="button"
            accessibilityState={{ expanded: acik === soru }}
            onPress={() => setAcik(acik === soru ? null : soru)}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderBottomWidth: 1,
              borderBottomColor: '#EEF0F5',
            }}
          >
            <T style={{ fontSize: 14, fontWeight: '800' }}>{soru}</T>
            {acik === soru ? (
              <T style={{ fontSize: 13, color: colors.inkSoft, marginTop: 6, lineHeight: 19 }}>{cevap}</T>
            ) : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function GaleriCagri() {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push('/kurumsal-basvuru')}
      style={{
        ...kart,
        marginHorizontal: 12,
        padding: 14,
        backgroundColor: '#F3EFFF',
        borderLeftWidth: 6,
        borderLeftColor: '#9B7BFF',
      }}
    >
      <T style={{ fontSize: 15.5, fontWeight: '800' }}>Galeri misin? Alıcılar seni bekliyor</T>
      <T style={{ fontSize: 13, color: colors.inkSoft, marginTop: 3 }}>
        İlan vermeden, aradığı aracı yazan alıcılara ulaş. İlk 30 gün ücretsiz.
      </T>
      <T style={{ fontSize: 13.5, fontWeight: '800', color: colors.link, marginTop: 8 }}>
        Galeri başvurusu ›
      </T>
    </Pressable>
  );
}
