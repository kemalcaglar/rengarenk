import { type CategoryField, type CategoryRules, colors, PAINT_PARTS, PAINT_STATES } from '@rengarenk/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Share, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ikon } from '../../components/ikon';
import { T } from '../../components/t';
import { AracSemasi, Cip, kartStil } from '../../components/talep/ortak';
import { API } from '../../lib/api';
import { basHarf, useOturum } from '../../lib/oturum';
import { butceAraligi, deger, etiket, uzunTarih } from '../../lib/talep-bicim';

type Values = Record<string, unknown>;
interface Talep {
  no: number;
  status: string;
  baslik: string;
  category: { slug: string; name: string };
  il: string | null;
  ilce: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
  data: { alanlar: Values; alternatifler: Values[] };
  schema: { fields: CategoryField[]; rules: CategoryRules };
  gorunum: {
    katalog: { marka: string | null; seri: string | null; model: string | null };
    alternatifler: {
      kasa: {
        value: string;
        label: string;
        yillar: string | null;
        foto: { url: string; caption: string } | null;
      }[];
      paket: string[];
      teknik: { label: string; value: string }[];
      teknikOrnek: string | null;
    }[];
  };
  owner: { name: string; isYou: boolean; phone: string | null; phoneHidden: boolean; whatsapp: boolean };
}

const TINTS = ['#EEF3FF', '#FFEEF6', '#FFF6DF', '#E7FAF0'];
const BOYA_AD: Record<string, string> = {
  orijinal: 'Orijinal olmalı',
  lokal: 'Lokal boya kabul',
  boya: 'Boya kabul',
  degisen: 'Değişen kabul',
};

/** Talep detayı (tasarım: Mobil.dc.html; Karar 08, 11.4, 24): altta Mesaj at ve izin verildiyse Ara. */
export default function TalepDetay() {
  const { no } = useLocalSearchParams<{ no: string }>();
  const { durum, istek } = useOturum();
  const [t, setT] = useState<Talep | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [alt, setAlt] = useState(0);

  useEffect(() => {
    if (durum === 'yukleniyor') return;
    const al =
      durum === 'uye'
        ? istek<Talep>(`/talepler/${no}`)
        : fetch(`${API}/talepler/${no}`).then((r) =>
            r.ok ? (r.json() as Promise<Talep>) : Promise.reject(new Error('Talep bulunamadı')),
          );
    al.then(setT).catch((e: Error) => setHata(e.message));
  }, [no, durum, istek]);

  if (!t) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <T style={{ color: colors.muted }}>{hata ?? 'Yükleniyor…'}</T>
      </SafeAreaView>
    );
  }
  const f = t.schema.fields;
  const a = t.data.alternatifler[alt] ?? {};
  const g = t.gorunum.alternatifler[alt];
  const foto = g?.kasa.find((x) => x.foto)?.foto ?? null;
  const k = t.gorunum.katalog;
  const yayinda = t.status === 'PUBLISHED';
  const gun = Math.max(
    0,
    Math.ceil(((t.expiresAt ? new Date(t.expiresAt).getTime() : 0) - Date.now()) / 86_400_000),
  );
  const anaArac = [
    { label: 'Kategori', value: t.category.name },
    k.marka ? { label: 'Marka', value: k.marka } : null,
    k.seri ? { label: 'Seri', value: k.seri } : null,
    k.model ? { label: 'Model', value: k.model } : null,
    ...f
      .filter((x) => x.step === 'ana_arac' && x.type !== 'catalog')
      .map((x) => {
        const v = deger(x, t.data.alanlar[x.key]);
        return v ? { label: etiket(x), value: v } : null;
      }),
  ].filter((x): x is { label: string; value: string } => x !== null);
  const satirlar = [
    g?.kasa.length ? { label: 'Kasa ve makyaj', value: g.kasa.map((x) => x.label).join(' veya ') } : null,
    f.some((x) => x.key === 'paket')
      ? { label: 'Donanım paketi', value: g?.paket.length ? g.paket.join(' veya ') : 'Fark etmez' }
      : null,
    ...f
      .filter(
        (x) =>
          x.scope === 'alternatif' && x.key !== 'butce' && x.source !== 'katalog' && x.step === 'kriterler',
      )
      .map((x) => {
        const v = deger(x, a[x.key]);
        return v ? { label: etiket(x), value: v } : null;
      }),
  ].filter((x): x is { label: string; value: string } => x !== null);
  const butce = a.butce as { min?: number; max?: number } | undefined;
  const boya = t.data.alanlar.boya as { limit: number; parts: Record<string, string> } | undefined;
  const islem = f.find((x) => x.key === 'islemKabul');
  const kabul = (t.data.alanlar.islemKabul as string[] | undefined) ?? [];
  const bolum = { ...kartStil, borderRadius: 18, padding: 16, marginTop: 12 } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 8,
          paddingVertical: 6,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
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
        <T style={{ fontSize: 15, fontWeight: '800' }}>Talep No {t.no}</T>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Paylaş"
          onPress={() =>
            Share.share({ message: `${t.baslik} · https://rengarenk.com.tr/talep/${t.no}` }).catch(
              () => undefined,
            )
          }
          style={{ height: 44, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' }}
        >
          <T style={{ fontSize: 13, fontWeight: '700', color: colors.link }}>Paylaş</T>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <View
          style={{
            height: 190,
            borderRadius: 16,
            overflow: 'hidden',
            backgroundColor: '#DCE3F0',
            justifyContent: 'space-between',
          }}
        >
          {foto ? (
            <Image
              source={{ uri: `${API}${foto.url}` }}
              style={{ position: 'absolute', inset: 0 }}
              resizeMode="cover"
              accessibilityLabel="Temsilî fotoğraf"
            />
          ) : null}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 10 }}>
            <T
              style={{
                backgroundColor: colors.surface,
                fontSize: 11.5,
                fontWeight: '700',
                paddingVertical: 4,
                paddingHorizontal: 9,
                borderRadius: 999,
                overflow: 'hidden',
              }}
            >
              Temsili görsel
            </T>
            {t.data.alternatifler.length > 1 ? (
              <T
                style={{
                  backgroundColor: colors.surface,
                  fontSize: 11.5,
                  fontWeight: '700',
                  paddingVertical: 4,
                  paddingHorizontal: 9,
                  borderRadius: 999,
                  overflow: 'hidden',
                }}
              >{`Alternatif ${alt + 1}`}</T>
            ) : null}
          </View>
          {foto ? (
            <T
              style={{ fontSize: 10.5, color: '#FFFFFF', padding: 8, backgroundColor: 'rgba(30,35,51,0.45)' }}
            >
              {foto.caption}
            </T>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', marginTop: 14 }}>
          <T
            style={{
              backgroundColor: yayinda ? '#E7FAF0' : '#F3F5FA',
              color: yayinda ? '#11683F' : '#3A4052',
              fontSize: 12.5,
              fontWeight: '700',
              paddingVertical: 5,
              paddingHorizontal: 11,
              borderRadius: 999,
              overflow: 'hidden',
            }}
          >
            {yayinda
              ? `Yayında · ${gun} gün kaldı`
              : t.status === 'PASSIVE'
                ? 'Pasif'
                : t.status === 'COMPLETED'
                  ? 'Tamamlandı'
                  : 'Kapatıldı'}
          </T>
        </View>
        <T
          accessibilityRole="header"
          style={{ fontSize: 21, fontWeight: '800', lineHeight: 27, marginTop: 10 }}
        >
          {t.baslik}
        </T>
        <T style={{ fontSize: 13, color: colors.muted, marginTop: 6 }}>
          {[`Yayın ${uzunTarih(t.publishedAt)}`, [t.il, t.ilce].filter(Boolean).join(', ')]
            .filter(Boolean)
            .join(' · ')}
        </T>

        <View style={{ ...bolum, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: '#EEF3FF',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <T style={{ fontWeight: '800', color: colors.link }}>{basHarf(t.owner.name)}</T>
          </View>
          <View style={{ flex: 1 }}>
            <T style={{ fontSize: 15.5, fontWeight: '800' }}>{t.owner.name}</T>
            <T style={{ fontSize: 12.5, color: '#11683F', fontWeight: '600', marginTop: 2 }}>
              Telefon numarası doğrulandı
            </T>
          </View>
        </View>

        <View style={bolum}>
          <T accessibilityRole="header" style={{ fontSize: 16.5, fontWeight: '800', marginBottom: 10 }}>
            Aranan araç
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {anaArac.map((x, i) => (
              <View
                key={x.label}
                style={{
                  width: '48.5%',
                  backgroundColor: TINTS[i % TINTS.length],
                  borderRadius: 12,
                  padding: 10,
                }}
              >
                <T style={{ fontSize: 12, fontWeight: '600', color: '#4A5064' }}>{x.label}</T>
                <T style={{ fontSize: 15.5, fontWeight: '800', marginTop: 2 }}>{x.value}</T>
              </View>
            ))}
          </View>
          {t.data.alternatifler.length > 1 ? (
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
              {t.data.alternatifler.map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: alternatiflerin kimliği sırasıdır
                <Cip key={i} on={alt === i} onPress={() => setAlt(i)}>
                  {`Alternatif ${i + 1}`}
                </Cip>
              ))}
            </View>
          ) : null}
          <View style={{ marginTop: 12 }}>
            {satirlar.map((r) => (
              <View
                key={r.label}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: 12,
                  paddingVertical: 10,
                  borderTopWidth: 1,
                  borderTopColor: '#EEF0F5',
                }}
              >
                <T style={{ fontSize: 13.5, color: colors.muted }}>{r.label}</T>
                <T style={{ flex: 1, fontSize: 13.5, fontWeight: '700', textAlign: 'right' }}>{r.value}</T>
              </View>
            ))}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 4,
                backgroundColor: '#EEF3FF',
                borderRadius: 12,
                padding: 12,
              }}
            >
              <T style={{ fontSize: 13.5, fontWeight: '600', color: '#3A4052' }}>Bütçe</T>
              <T style={{ fontSize: 17, fontWeight: '800', color: colors.link }}>
                {butceAraligi(butce?.min, butce?.max) || '—'}
              </T>
            </View>
          </View>
        </View>

        <View style={bolum}>
          <T accessibilityRole="header" style={{ fontSize: 16.5, fontWeight: '800', marginBottom: 8 }}>
            Açıklama
          </T>
          <T style={{ fontSize: 14.5, lineHeight: 22, color: '#2E3344' }}>
            {(t.data.alanlar.aciklama as string | undefined) || 'Talep sahibi açıklama yazmadı.'}
          </T>
        </View>

        {boya || islem ? (
          <View style={bolum}>
            <T accessibilityRole="header" style={{ fontSize: 16.5, fontWeight: '800', marginBottom: 8 }}>
              Boya, değişen ve hasar
            </T>
            {boya ? (
              <>
                <T style={{ fontSize: 13.5, color: '#3A4052', marginBottom: 10 }}>
                  Toplamda en fazla {boya.limit} parçada işlem;{' '}
                  {Object.values(boya.parts).includes('degisen')
                    ? 'bazı parçalarda değişen kabul.'
                    : 'değişen parça kabul edilmez.'}
                </T>
                <View style={{ alignItems: 'center' }}>
                  <AracSemasi parts={boya.parts} width={160} />
                </View>
                {PAINT_STATES.map((s) => {
                  const p = PAINT_PARTS.filter((x) => (boya.parts[x.key] ?? 'orijinal') === s.key).map(
                    (x) => x.ad,
                  );
                  return (
                    <View key={s.key} style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                      <View
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 5,
                          backgroundColor: s.renk,
                          borderWidth: 1,
                          borderColor: '#AEB5C4',
                        }}
                      />
                      <View style={{ flex: 1 }}>
                        <T style={{ fontSize: 13.5, fontWeight: '700' }}>{BOYA_AD[s.key]}</T>
                        <T style={{ fontSize: 12.5, color: colors.muted }}>
                          {p.length ? p.join(', ') : 'Hiçbir parça'}
                        </T>
                      </View>
                    </View>
                  );
                })}
              </>
            ) : null}
            {islem ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                {(islem.options ?? []).map((o) => {
                  const ok = kabul.includes(o.value);
                  return (
                    <T
                      key={o.value}
                      style={{
                        fontSize: 12.5,
                        fontWeight: '700',
                        paddingVertical: 4,
                        paddingHorizontal: 9,
                        borderRadius: 999,
                        overflow: 'hidden',
                        backgroundColor: ok ? '#E7FAF0' : '#FDECEC',
                        color: ok ? '#11683F' : '#A3271F',
                      }}
                    >
                      {o.label} · {ok ? 'kabul' : 'kabul etmiyor'}
                    </T>
                  );
                })}
              </View>
            ) : null}
          </View>
        ) : null}

        {g?.teknik.length ? (
          <View style={bolum}>
            <T accessibilityRole="header" style={{ fontSize: 16.5, fontWeight: '800' }}>
              Teknik özellikler
            </T>
            <T style={{ fontSize: 12.5, color: colors.muted, marginTop: 4, marginBottom: 10 }}>
              Katalogdaki örnek donanım: {g.teknikOrnek}. Değerler donanıma göre değişebilir.
            </T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {g.teknik.map((x) => (
                <View
                  key={x.label}
                  style={{
                    width: '48.5%',
                    borderWidth: 1,
                    borderColor: '#EEF0F5',
                    borderRadius: 12,
                    padding: 10,
                  }}
                >
                  <T style={{ fontSize: 12, color: colors.muted }}>{x.label}</T>
                  <T style={{ fontSize: 14, fontWeight: '700', marginTop: 2 }}>{x.value}</T>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={{ marginTop: 12, backgroundColor: '#FFF6DF', borderRadius: 16, padding: 14 }}>
          <T style={{ fontSize: 14.5, fontWeight: '800', color: '#5C3F00', marginBottom: 4 }}>
            Güvenliğiniz için
          </T>
          <T style={{ fontSize: 13, lineHeight: 20, color: '#4A3500' }}>
            Aracı görmeden kapora ödemeyin; ödemeyi noterde Güvenli Ödeme Sistemi ile yapın.
          </T>
        </View>
        {t.schema.rules.legalNotice ? (
          <T style={{ marginTop: 12, fontSize: 12.5, color: '#3A4052', lineHeight: 18 }}>
            {t.schema.rules.legalNotice}
          </T>
        ) : null}
        <T style={{ marginTop: 14, fontSize: 13.5, fontWeight: '600', color: '#8A91A3' }}>
          Bu talebi şikayet et (yakında)
        </T>
      </ScrollView>

      <View
        style={{
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.line,
          padding: 12,
          paddingHorizontal: 16,
          gap: 8,
        }}
      >
        {t.owner.isYou ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/(sekmeler)/taleplerim')}
            style={{
              borderWidth: 1,
              borderColor: '#D5DAE5',
              borderRadius: 14,
              paddingVertical: 14,
              alignItems: 'center',
            }}
          >
            <T style={{ fontSize: 15, fontWeight: '800' }}>Bu senin talebin · Taleplerim</T>
          </Pressable>
        ) : (
          <>
            <T style={{ fontSize: 12, color: colors.muted, textAlign: 'center' }}>
              {yayinda
                ? 'Bu talebe yalnızca bir ilk mesaj atabilirsiniz.'
                : 'Talep yayında değil; satıcılar yazamaz.'}
            </T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View
                style={{
                  flex: 2,
                  backgroundColor: colors.blue,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: 'center',
                  opacity: 0.55,
                }}
                accessibilityLabel="Mesajlaşma yakında açılacak"
              >
                <T style={{ fontSize: 15.5, fontWeight: '800' }}>Mesaj at</T>
              </View>
              {yayinda && (t.owner.phone || t.owner.phoneHidden) ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.owner.phone ? 'Ara' : 'Aramak için giriş yap'}
                  onPress={() =>
                    t.owner.phone ? Linking.openURL(`tel:${t.owner.phone}`) : router.push('/giris')
                  }
                  onLongPress={() =>
                    t.owner.whatsapp && t.owner.phone
                      ? Linking.openURL(`https://wa.me/${t.owner.phone.replace(/\D/g, '')}`)
                      : undefined
                  }
                  style={{
                    flex: 1,
                    borderWidth: 1.5,
                    borderColor: '#25A35A',
                    borderRadius: 14,
                    paddingVertical: 13,
                    alignItems: 'center',
                  }}
                >
                  <T style={{ fontSize: 14.5, fontWeight: '700', color: '#11683F' }}>Ara</T>
                </Pressable>
              ) : null}
            </View>
            {yayinda && t.owner.whatsapp && t.owner.phone ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => Linking.openURL(`https://wa.me/${t.owner.phone?.replace(/\D/g, '')}`)}
                style={{ alignItems: 'center', paddingVertical: 4 }}
              >
                <T style={{ fontSize: 13.5, fontWeight: '700', color: '#11683F' }}>WhatsApp'tan yaz</T>
              </Pressable>
            ) : null}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
