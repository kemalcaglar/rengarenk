import {
  butonOran,
  CLOSE_REASON_KEYS,
  CLOSE_REASONS,
  type CloseReason,
  colors,
  KVKK_KIND_KEYS,
  KVKK_KINDS,
  type KvkkKind,
  kartOran,
  radii,
  tlYaz,
} from '@rengarenk/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ikon } from '../components/ikon';
import { T, TInput } from '../components/t';
import { Anahtar } from '../components/talep/ortak';
import { useOturum } from '../lib/oturum';

interface Kopya {
  id: string;
  durum: 'hazirlaniyor' | 'hazir' | 'hata' | 'suresi_doldu';
  istendi: string;
  gecerlilik: string | null;
}
interface Kapanis {
  engel: string | null;
  iade: { satirlar: { ad: string; tutarKurus: number }[]; toplamKurus: number };
}
interface Basvuru {
  numara: string;
  tur: string;
  durum: 'acik' | 'yanitlandi';
  sonTarih: string;
  yanit: string | null;
}

const kart = {
  get backgroundColor() {
    return colors.surface;
  },
  borderWidth: 1,
  get borderColor() {
    return colors.line;
  },
  get borderRadius() {
    return radii.kart;
  },
  padding: 16,
} as const;
const tarih = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' }).format(
    new Date(iso),
  );

/**
 * Kişisel verilerim (HesapMobil.dc.html › Hesap; Karar 31, 58): verilerimi indir, KVKK başvurusu ve hesabı kapat,
 * üçü de SMS koduyla. Reklam ölçümü onayı da buradan verilir ya da geri alınır (Karar 35, 59; tasarımda yok). Kapatmada kullanılmamış hakların iadesi Sahip'in onayına gider.
 * Hazır kopya güvenlik için hesaba girilerek web'den (Ayarlar › Gizlilik ve güvenlik) indirilir.
 */
export default function KisiselVerilerim() {
  const { durum, me, istek, cikis } = useOturum();
  const [kapanis, setKapanis] = useState<Kapanis | null>(null);
  const [neden, setNeden] = useState<CloseReason>('buldum');
  const [kopya, setKopya] = useState<Kopya | null>(null);
  const [basvurular, setBasvurular] = useState<Basvuru[]>([]);
  const [adim, setAdim] = useState<null | 'indir' | 'kvkk' | 'kapat'>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [kod, setKod] = useState('');
  const [tur, setTur] = useState<KvkkKind>('bilgi');
  const [metin, setMetin] = useState('');
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [reklam, setReklam] = useState<boolean | null>(null);

  const yukle = useCallback(() => {
    istek<{ acik: boolean }>('/me/reklam-olcum')
      .then((r) => setReklam(r.acik))
      .catch(() => undefined);
    istek<Kopya[]>('/me/data-exports')
      .then((k) => setKopya(k[0] ?? null))
      .catch(() => undefined);
    istek<Basvuru[]>('/me/kvkk')
      .then(setBasvurular)
      .catch(() => undefined);
  }, [istek]);
  useFocusEffect(
    useCallback(() => {
      if (durum === 'uye') yukle();
    }, [durum, yukle]),
  );

  async function kapatAc() {
    setHata(null);
    try {
      setKapanis(await istek<Kapanis>('/me/close'));
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  async function kodIste(ne: 'indir' | 'kvkk' | 'kapat') {
    setHata(null);
    try {
      const r = await istek<{ challengeId: string; devCode?: string }>('/auth/otp/request', {
        method: 'POST',
        body: { phone: me?.phone },
      });
      setChallengeId(r.challengeId);
      setKod(r.devCode ?? '');
      setAdim(ne);
      setBilgi('Telefonuna doğrulama kodu gönderdik.');
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function onayla() {
    if (!challengeId) return;
    setHata(null);
    try {
      if (adim === 'kapat') {
        await istek('/me/close', { method: 'POST', body: { challengeId, code: kod, neden } });
        // Oturumlar API'de kapandı; cihazdaki jetonlar da silinir
        await cikis().catch(() => undefined);
        router.replace('/');
        return;
      }
      if (adim === 'indir') {
        const k = await istek<Kopya[]>('/me/data-exports', {
          method: 'POST',
          body: { challengeId, code: kod },
        });
        setKopya(k[0] ?? null);
        setBilgi('Verilerinin kopyası hazırlanıyor; hazır olunca bildirim ve e-posta göndereceğiz.');
      } else {
        const r = await istek<{ numara: string; sonTarih: string }>('/me/kvkk', {
          method: 'POST',
          body: { challengeId, code: kod, tur, metin },
        });
        setMetin('');
        setBilgi(`Başvurun alındı · ${r.numara}. En geç ${tarih(r.sonTarih)} tarihine kadar yanıtlayacağız.`);
        yukle();
      }
      setAdim(null);
      setChallengeId(null);
      setKod('');
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  const kodAlani = (
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' }}>
      <TInput
        value={kod}
        onChangeText={(v) => setKod(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        accessibilityLabel="SMS kodu"
        placeholder="SMS kodu"
        style={{
          flex: 1,
          borderWidth: 1,
          borderColor: '#D5DAE5',
          borderRadius: butonOran(10),
          padding: 11,
          fontSize: 16,
        }}
      />
      <Pressable
        accessibilityRole="button"
        onPress={onayla}
        style={{
          backgroundColor: colors.blue,
          borderRadius: butonOran(10),
          paddingVertical: 12,
          paddingHorizontal: 16,
        }}
      >
        <T style={{ color: colors.onBlue, fontSize: 14.5, fontWeight: '800' }}>Onayla</T>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <View
        style={{
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
          paddingVertical: 10,
          paddingHorizontal: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Geri"
          onPress={() => router.back()}
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
        <T accessibilityRole="header" style={{ flex: 1, fontSize: 18, fontWeight: '800' }}>
          Kişisel verilerim
        </T>
      </View>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {bilgi ? (
          <T accessibilityRole="alert" style={{ color: '#11683F', fontWeight: '700', paddingHorizontal: 4 }}>
            {bilgi}
          </T>
        ) : null}
        {hata ? (
          <T accessibilityRole="alert" style={{ color: '#A3271F', fontWeight: '700', paddingHorizontal: 4 }}>
            {hata}
          </T>
        ) : null}
        {reklam === null ? null : (
          <View style={[kart, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
            <View style={{ flex: 1 }}>
              <T style={{ fontSize: 16, fontWeight: '800' }}>Reklam ölçümü</T>
              <T style={{ fontSize: 13, color: colors.muted, marginTop: 4, lineHeight: 19 }}>
                Talep ve ödeme gibi adımların, reklamlarımızı ölçmek için Meta ve Google'a özet bilgiyle
                bildirilmesi. Mesajların ve talep açıklaman hiçbir zaman gönderilmez.
              </T>
            </View>
            <Anahtar
              on={reklam}
              label="Reklam ölçümü"
              onPress={() =>
                istek<{ acik: boolean }>('/me/reklam-olcum', { method: 'PUT', body: { acik: !reklam } })
                  .then((r) => {
                    setReklam(r.acik);
                    setHata(null);
                    setBilgi(r.acik ? 'Reklam ölçümüne izin verdin.' : 'Reklam ölçümü iznini geri aldın.');
                  })
                  .catch((e: Error) => setHata(e.message))
              }
            />
          </View>
        )}
        <View style={kart}>
          <T style={{ fontSize: 16, fontWeight: '800' }}>Verilerimi indir</T>
          <T style={{ fontSize: 13, color: colors.muted, marginTop: 4, lineHeight: 19 }}>
            Profil, talepler, mesajlar, ödemeler ve rızaların. Doğrulama kodundan sonra 24 saat içinde
            hazırlanır; bağlantı 7 gün geçerli.
          </T>
          {kopya ? (
            <T
              style={{
                fontSize: 13,
                fontWeight: '700',
                marginTop: 8,
                color: kopya.durum === 'hazir' ? '#11683F' : '#7A5300',
              }}
            >
              {kopya.durum === 'hazir'
                ? `Hazır · ${kopya.gecerlilik ? tarih(kopya.gecerlilik) : ''} tarihine kadar rengarenksite.com › Ayarlar › Gizlilik ve güvenlik bölümünden indirebilirsin`
                : kopya.durum === 'hazirlaniyor'
                  ? `${tarih(kopya.istendi)} tarihinde istendi · hazırlanıyor`
                  : kopya.durum === 'suresi_doldu'
                    ? 'Son kopyanın süresi doldu'
                    : 'Hazırlanamadı; yeniden dene'}
            </T>
          ) : null}
          {adim === 'indir' ? (
            kodAlani
          ) : kopya?.durum === 'hazirlaniyor' || kopya?.durum === 'hazir' ? null : (
            <Pressable
              accessibilityRole="button"
              onPress={() => kodIste('indir')}
              style={{
                marginTop: 12,
                borderWidth: 1,
                borderColor: '#D5DAE5',
                borderRadius: butonOran(10),
                paddingVertical: 11,
                alignItems: 'center',
              }}
            >
              <T style={{ fontSize: 14.5, fontWeight: '700' }}>Hazırla</T>
            </Pressable>
          )}
        </View>

        <View style={kart}>
          <T style={{ fontSize: 16, fontWeight: '800' }}>KVKK başvurusu</T>
          <T style={{ fontSize: 13, color: colors.muted, marginTop: 4, lineHeight: 19 }}>
            Bilgi alma, düzeltme, silme ya da itiraz. En geç 30 gün içinde yanıtlanır (KVKK m.13).
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {KVKK_KIND_KEYS.map((k) => {
              const on = tur === k;
              return (
                <Pressable
                  key={k}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => setTur(k)}
                  style={{
                    borderWidth: 1.5,
                    borderColor: on ? colors.blue : '#D5DAE5',
                    backgroundColor: on ? '#EEF3FF' : colors.surface,
                    borderRadius: radii.etiket,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                  }}
                >
                  <T style={{ fontSize: 13, fontWeight: '700' }}>{KVKK_KINDS[k]}</T>
                </Pressable>
              );
            })}
          </View>
          <TInput
            value={metin}
            onChangeText={setMetin}
            multiline
            maxLength={3000}
            accessibilityLabel="Talebin"
            placeholder="Talebini yaz"
            style={{
              marginTop: 10,
              borderWidth: 1,
              borderColor: '#D5DAE5',
              borderRadius: butonOran(10),
              padding: 11,
              minHeight: 100,
              fontSize: 14.5,
              textAlignVertical: 'top',
            }}
          />
          {adim === 'kvkk' ? (
            kodAlani
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: metin.trim().length < 10 }}
              onPress={() => metin.trim().length >= 10 && kodIste('kvkk')}
              style={{
                marginTop: 12,
                backgroundColor: metin.trim().length >= 10 ? colors.blue : '#E3E6EF',
                borderRadius: butonOran(10),
                paddingVertical: 12,
                alignItems: 'center',
              }}
            >
              <T style={{ fontSize: 14.5, fontWeight: '800' }}>Doğrulama kodu gönder</T>
            </Pressable>
          )}
          {basvurular.map((b) => (
            <View
              key={b.numara}
              style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#EEF0F5' }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <T style={{ fontSize: 14, fontWeight: '700' }}>
                  {b.numara} · {b.tur}
                </T>
                <T
                  style={{
                    fontSize: 12.5,
                    fontWeight: '800',
                    color: b.durum === 'acik' ? '#7A5300' : '#11683F',
                  }}
                >
                  {b.durum === 'acik' ? 'İnceleniyor' : 'Yanıtlandı'}
                </T>
              </View>
              <T style={{ fontSize: 13, color: colors.muted, marginTop: 3, lineHeight: 19 }}>
                {b.durum === 'acik' ? `Yanıt en geç ${tarih(b.sonTarih)}` : b.yanit}
              </T>
            </View>
          ))}
        </View>

        {!kapanis ? (
          <Pressable
            accessibilityRole="button"
            onPress={kapatAc}
            style={{
              borderWidth: 1,
              borderColor: '#F3C5C5',
              backgroundColor: colors.surface,
              borderRadius: kartOran(16),
              padding: 14,
            }}
          >
            <T style={{ fontSize: 14.5, fontWeight: '800', color: '#A11B1B' }}>Hesabı kapat</T>
            <T style={{ fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 17 }}>
              Talepler kapanır, sohbetler “Kapatılmış hesap” görünür. Fatura kayıtları yasal süre boyunca
              saklanır.
            </T>
          </Pressable>
        ) : (
          <View style={{ ...kart, borderColor: '#F3C5C5' }}>
            <T accessibilityRole="header" style={{ fontSize: 16, fontWeight: '800', color: '#A11B1B' }}>
              Hesabı kapat
            </T>
            {[
              'Yayındaki taleplerin kapanır, satıcılar artık sana yazamaz.',
              'Sohbetlerin karşı tarafta “Kapatılmış hesap” olarak görünür.',
              kapanis.iade.toplamKurus > 0
                ? `Web’den aldığın ve kullanmadığın haklar kartına iade edilir: ${kapanis.iade.satirlar.map((x) => `${x.ad} · ${tlYaz(x.tutarKurus)}`).join(', ')}. Başlamış öne çıkarmalar iade edilmez.`
                : 'Web’den aldığın ve kullanmadığın haklar kartına iade edilir; şu an kullanılmamış hakkın yok.',
              'App Store veya Google Play’den aldığın hakların iadesi mağaza üzerinden yapılır.',
              'Fatura ve ödeme kayıtları yasal saklama süresi boyunca tutulur; diğer verilerin silinir.',
            ].map((m) => (
              <T key={m} style={{ fontSize: 13.5, color: '#3A4052', marginTop: 8, lineHeight: 19 }}>
                • {m}
              </T>
            ))}
            {kapanis.engel ? (
              <T
                accessibilityRole="alert"
                style={{ marginTop: 10, fontSize: 13.5, fontWeight: '700', color: '#A3271F' }}
              >
                {kapanis.engel}
              </T>
            ) : (
              <View
                style={{ backgroundColor: '#FDECEC', borderRadius: radii.buton, padding: 12, marginTop: 12 }}
              >
                <T style={{ fontSize: 13, fontWeight: '700' }}>Neden ayrılıyorsun? (isteğe bağlı)</T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {CLOSE_REASON_KEYS.map((k) => {
                    const on = neden === k;
                    return (
                      <Pressable
                        key={k}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on }}
                        onPress={() => setNeden(k)}
                        style={{
                          borderWidth: 1.5,
                          borderColor: on ? '#A3271F' : '#E5A6A1',
                          backgroundColor: colors.surface,
                          borderRadius: radii.etiket,
                          paddingVertical: 7,
                          paddingHorizontal: 11,
                        }}
                      >
                        <T style={{ fontSize: 12.5, fontWeight: '700' }}>{CLOSE_REASONS[k]}</T>
                      </Pressable>
                    );
                  })}
                </View>
                {adim === 'kapat' ? (
                  kodAlani
                ) : (
                  <>
                    <T style={{ fontSize: 12.5, color: '#A3271F', marginTop: 10 }}>
                      Onaylamak için telefonuna bir SMS kodu göndereceğiz.
                    </T>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => kodIste('kapat')}
                      style={{
                        marginTop: 10,
                        borderWidth: 1,
                        borderColor: '#E5A6A1',
                        backgroundColor: colors.surface,
                        borderRadius: butonOran(12),
                        paddingVertical: 12,
                        alignItems: 'center',
                      }}
                    >
                      <T style={{ fontSize: 14.5, fontWeight: '800', color: '#A3271F' }}>
                        SMS kodu gönder ve hesabı kapat
                      </T>
                    </Pressable>
                  </>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
