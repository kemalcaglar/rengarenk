import { colors, demandOwnerName, saatYaz } from '@rengarenk/shared';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useOturum } from '../lib/oturum';
import { T, TInput } from './t';
import { Anahtar, Konum, Secici } from './talep/ortak';

interface Ben {
  firstName: string | null;
  lastName: string | null;
  phone: string;
  il: string | null;
  ilce: string | null;
  nameMode: 'tam' | 'kisa';
  phoneVisible: boolean;
  whatsappVisible: boolean;
  callFrom: number;
  callTo: number;
}
type Iletisim = Pick<Ben, 'phoneVisible' | 'whatsappVisible' | 'callFrom' | 'callTo'>;

const kart = {
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.line,
  borderRadius: 16,
  padding: 14,
} as const;
const girdi = {
  borderWidth: 1,
  borderColor: '#D5DAE5',
  borderRadius: 12,
  padding: 12,
  fontSize: 15,
} as const;
const saat = (h: number) => (h === 24 ? '24.00' : saatYaz(h));

/**
 * Ayarlar › Profil ve İletişim (Ayarlar.dc.html'nin mobil karşılığı; Karar 29): ad, soyad, il, ilçe, talepte görünen ad,
 * numarayı değiştir (yeni numaraya SMS kodu), telefon ve WhatsApp izni, aranabilir saatler.
 */
export function ProfilVeIletisim() {
  const { istek } = useOturum();
  const [ben, setBen] = useState<Ben | null>(null);
  const [ad, setAd] = useState('');
  const [soyad, setSoyad] = useState('');
  const [konum, setKonum] = useState<{ il?: string; ilce?: string }>({});
  const [numara, setNumara] = useState<'kapali' | 'tel' | 'kod'>('kapali');
  const [tel, setTel] = useState('');
  const [kod, setKod] = useState('');
  const [ch, setCh] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);

  const yukle = useCallback(async () => {
    const m = await istek<Ben>('/me');
    setBen(m);
    setAd(m.firstName ?? '');
    setSoyad(m.lastName ?? '');
    setKonum(m.il ? { il: m.il, ...(m.ilce ? { ilce: m.ilce } : {}) } : {});
  }, [istek]);
  useEffect(() => {
    yukle().catch(() => undefined);
  }, [yukle]);

  async function calistir(fn: () => Promise<void>, baslik: string, mesaj?: string) {
    setMesgul(true);
    try {
      await fn();
      if (mesaj) Alert.alert(baslik, mesaj);
    } catch (e) {
      Alert.alert('Kaydedilemedi', (e as Error).message);
    } finally {
      setMesgul(false);
    }
  }

  if (!ben) return null;

  const iletisim = (p: Partial<Iletisim>) => {
    const yeni: Iletisim = {
      phoneVisible: ben.phoneVisible,
      whatsappVisible: ben.whatsappVisible,
      callFrom: ben.callFrom,
      callTo: ben.callTo,
      ...p,
    };
    if (!yeni.phoneVisible) yeni.whatsappVisible = false;
    if (yeni.whatsappVisible) yeni.phoneVisible = true;
    calistir(async () => {
      const r = await istek<Iletisim>('/me/contact', { method: 'PUT', body: yeni });
      setBen({ ...ben, ...r });
    }, 'Kaydedildi');
  };

  return (
    <>
      <View style={kart}>
        <T accessibilityRole="header" style={{ fontSize: 16, fontWeight: '800' }}>
          Profil bilgileri
        </T>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <TInput
            accessibilityLabel="Ad"
            placeholder="Ad"
            value={ad}
            onChangeText={setAd}
            style={{ ...girdi, flex: 1 }}
          />
          <TInput
            accessibilityLabel="Soyad"
            placeholder="Soyad"
            value={soyad}
            onChangeText={setSoyad}
            style={{ ...girdi, flex: 1 }}
          />
        </View>
        <View style={{ marginTop: 8 }}>
          <Konum value={konum} onChange={(v) => setKonum((v as { il?: string; ilce?: string }) ?? {})} />
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={mesgul}
          onPress={() =>
            calistir(
              async () => {
                const r = await istek<Partial<Ben>>('/me', {
                  method: 'PATCH',
                  body: {
                    firstName: ad.trim(),
                    lastName: soyad.trim(),
                    il: konum.il ?? null,
                    ilce: konum.ilce ?? null,
                  },
                });
                setBen({ ...ben, ...r });
              },
              'Kaydedildi',
              'Profilin kaydedildi.',
            )
          }
          style={{
            marginTop: 10,
            borderWidth: 1,
            borderColor: '#D5DAE5',
            borderRadius: 12,
            paddingVertical: 11,
            alignItems: 'center',
          }}
        >
          <T style={{ fontSize: 14.5, fontWeight: '800' }}>Kaydet</T>
        </Pressable>

        <T style={{ marginTop: 16, marginBottom: 8, fontSize: 13, fontWeight: '700' }}>
          Talep sayfalarında adın nasıl görünsün?
        </T>
        <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
          {(
            [
              ['tam', 'Adın ve soyadın tam görünür'],
              ['kisa', 'Soyadının yalnızca baş harfi görünür'],
            ] as const
          ).map(([m, not]) => {
            const on = ben.nameMode === m;
            return (
              <Pressable
                key={m}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() =>
                  calistir(async () => {
                    await istek('/me', { method: 'PATCH', body: { nameMode: m } });
                    setBen({ ...ben, nameMode: m });
                  }, 'Kaydedildi')
                }
                style={{
                  borderWidth: on ? 1.5 : 1,
                  borderColor: on ? colors.blue : '#D5DAE5',
                  backgroundColor: on ? '#EEF3FF' : colors.surface,
                  borderRadius: 12,
                  paddingVertical: 11,
                  paddingHorizontal: 14,
                }}
              >
                <T style={{ fontSize: 15, fontWeight: '800' }}>
                  {demandOwnerName(ad || 'Ayşe', soyad || 'Yılmaz', m)}
                </T>
                <T style={{ fontSize: 12.5, color: colors.muted, marginTop: 2 }}>{not}</T>
              </Pressable>
            );
          })}
        </View>

        <View
          style={{
            marginTop: 16,
            borderWidth: 1,
            borderColor: '#EEF0F5',
            borderRadius: 12,
            padding: 12,
          }}
        >
          <T style={{ fontSize: 14.5, fontWeight: '700' }}>
            Cep telefonu · +90 5XX XXX XX {ben.phone.slice(-2)}
          </T>
          <T style={{ fontSize: 12.5, color: '#11683F', fontWeight: '700', marginTop: 2 }}>
            SMS ile doğrulandı
          </T>
          {numara === 'kapali' ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setNumara('tel')}
              style={{
                marginTop: 10,
                alignSelf: 'flex-start',
                borderWidth: 1,
                borderColor: '#D5DAE5',
                borderRadius: 10,
                paddingVertical: 8,
                paddingHorizontal: 12,
              }}
            >
              <T style={{ fontSize: 13.5, fontWeight: '700' }}>Numarayı değiştir</T>
            </Pressable>
          ) : (
            <View style={{ marginTop: 10, gap: 8 }}>
              {numara === 'tel' ? (
                <TInput
                  accessibilityLabel="Yeni cep telefonu"
                  placeholder="05XX XXX XX XX"
                  keyboardType="phone-pad"
                  value={tel}
                  onChangeText={setTel}
                  style={girdi}
                />
              ) : (
                <>
                  <T style={{ fontSize: 12.5, color: colors.muted }}>
                    Yeni numarana gelen 6 haneli kodu gir.
                  </T>
                  <TInput
                    accessibilityLabel="SMS kodu"
                    placeholder="6 haneli kod"
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    maxLength={6}
                    value={kod}
                    onChangeText={(v) => setKod(v.replace(/\D/g, ''))}
                    style={girdi}
                  />
                </>
              )}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  accessibilityRole="button"
                  disabled={mesgul}
                  onPress={() =>
                    numara === 'tel'
                      ? calistir(async () => {
                          const r = await istek<{ challengeId: string; devCode?: string }>(
                            '/me/phone/request',
                            {
                              method: 'POST',
                              body: { phone: tel },
                            },
                          );
                          setCh(r.challengeId);
                          if (r.devCode) setKod(r.devCode);
                          setNumara('kod');
                        }, 'Kod gönderildi')
                      : calistir(
                          async () => {
                            await istek('/me/phone/verify', {
                              method: 'POST',
                              body: { challengeId: ch, code: kod },
                            });
                            setNumara('kapali');
                            setTel('');
                            setKod('');
                            await yukle();
                          },
                          'Numaran değişti',
                          'Diğer cihazlardaki oturumların kapandı.',
                        )
                  }
                  style={{
                    flex: 1,
                    backgroundColor: colors.blue,
                    borderRadius: 12,
                    paddingVertical: 11,
                    alignItems: 'center',
                  }}
                >
                  <T style={{ fontSize: 14.5, fontWeight: '800' }}>
                    {numara === 'tel' ? 'Yeni numaraya kod gönder' : 'Doğrula'}
                  </T>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setNumara('kapali');
                    setKod('');
                  }}
                  style={{ paddingVertical: 11, paddingHorizontal: 10 }}
                >
                  <T style={{ fontSize: 14.5, fontWeight: '700', color: colors.muted }}>Vazgeç</T>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </View>

      <View style={kart}>
        <T accessibilityRole="header" style={{ fontSize: 16, fontWeight: '800' }}>
          İletişim tercihleri
        </T>
        <T style={{ marginTop: 2, fontSize: 13, color: colors.muted }}>
          Yeni talepler bu ayarlarla açılır. Her talepte ayrıca değiştirebilirsin.
        </T>
        {(
          [
            ['Rengarenk mesajları', 'Satıcılar sana her zaman uygulama içinden yazabilir', null],
            [
              'Telefon numaramı göster',
              'Talep sayfasında iletişim kutusunda görünür',
              () => iletisim({ phoneVisible: !ben.phoneVisible }),
            ],
            [
              'WhatsApp ile yazılabilsin',
              'Telefon numaran açıkken WhatsApp düğmesi de görünür',
              () => iletisim({ whatsappVisible: !ben.whatsappVisible }),
            ],
          ] as const
        ).map(([baslik, not, tikla], i) => (
          <View
            key={baslik}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              paddingVertical: 12,
              borderTopWidth: 1,
              borderTopColor: '#EEF0F5',
              marginTop: i === 0 ? 10 : 0,
            }}
          >
            <View style={{ flex: 1 }}>
              <T style={{ fontSize: 14.5, fontWeight: '700' }}>{baslik}</T>
              <T style={{ fontSize: 12.5, color: colors.muted, marginTop: 2 }}>{not}</T>
            </View>
            {tikla ? (
              <Anahtar label={baslik} on={i === 1 ? ben.phoneVisible : ben.whatsappVisible} onPress={tikla} />
            ) : (
              <T style={{ fontSize: 12.5, fontWeight: '700', color: colors.muted }}>Her zaman açık</T>
            )}
          </View>
        ))}
        <View style={{ borderTopWidth: 1, borderTopColor: '#EEF0F5', paddingTop: 12 }}>
          <T style={{ fontSize: 14.5, fontWeight: '700' }}>Aranabileceğim saatler</T>
          <T style={{ fontSize: 12.5, color: colors.muted, marginTop: 2 }}>
            Bu saatlerin dışında numaran talep sayfasında gizlenir
          </T>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Secici
              etiket="Başlangıç"
              deger={String(ben.callFrom)}
              secenekler={Array.from({ length: 24 }, (_, h) => ({ key: String(h), ad: saat(h) }))}
              onSec={(k) => {
                if (k === undefined) return;
                const bas = Number(k);
                iletisim({ callFrom: bas, callTo: Math.max(ben.callTo, bas + 1) });
              }}
            />
            <Secici
              etiket="Bitiş"
              deger={String(ben.callTo)}
              secenekler={Array.from({ length: 24 }, (_, i) => ({ key: String(i + 1), ad: saat(i + 1) }))}
              onSec={(k) => {
                if (k === undefined) return;
                const bit = Number(k);
                iletisim({ callTo: bit, callFrom: Math.min(ben.callFrom, bit - 1) });
              }}
            />
          </View>
        </View>
      </View>
    </>
  );
}
