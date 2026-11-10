import { colors, radii } from '@rengarenk/shared';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useOturum } from '../lib/oturum';
import { T, TInput } from './t';

interface DusukYildiz {
  yetkili: boolean;
  gun: number;
  yildizlar: {
    id: string;
    tarih: string;
    itirazSonu: string;
    itirazEdebilir: boolean;
    itiraz: { durum: 'acik' | 'kabul' | 'red'; sonuc: string | null } | null;
  }[];
}

const tarih = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long' }).format(
    new Date(iso),
  );
const DURUM: Record<string, [string, string, string]> = {
  acik: ['İtirazın moderasyonda', '#FFF6DF', '#7A5300'],
  kabul: ['Kabul edildi · yıldız sayılmıyor', '#E7FAF0', '#11683F'],
  red: ['Reddedildi · yıldız geçerli', '#F3F5FA', '#3A4052'],
};

/**
 * Galeri paneli › Rozetlerin altında 1 yıldıza itiraz (Karar 55): son 30 günün 1 yıldızları yalnızca tarihiyle; sahip ya
 * da yönetici her birine bir kez itiraz eder, moderasyon inceler. Web galeri panelindeki listeyle aynı.
 */
export function BirYildiz({ hesap }: { hesap: string }) {
  const { istek } = useOturum();
  const [d, setD] = useState<DusukYildiz | null>(null);
  const [acik, setAcik] = useState<string | null>(null);
  const [metin, setMetin] = useState('');
  const [hata, setHata] = useState('');
  const [mesgul, setMesgul] = useState(false);

  const yukle = useCallback(() => {
    istek<DusukYildiz>(`/gallery/${hesap}/ratings/low`)
      .then(setD)
      .catch(() => setD(null));
  }, [hesap, istek]);
  useEffect(yukle, [yukle]);

  if (!d?.yildizlar.length) return null;
  async function gonder(id: string) {
    setHata('');
    if (metin.trim().length < 10) {
      setHata('İtirazını en az 10 karakterle anlat.');
      return;
    }
    setMesgul(true);
    try {
      setD(
        await istek<DusukYildiz>(`/gallery/${hesap}/ratings/${id}/appeal`, {
          method: 'POST',
          body: { metin: metin.trim() },
        }),
      );
      setAcik(null);
      setMetin('');
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setMesgul(false);
    }
  }

  return (
    <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: '#EEF0F5', paddingTop: 12 }}>
      <T style={{ fontSize: 14, fontWeight: '800' }}>1 yıldızlı değerlendirmeler</T>
      <T style={{ marginTop: 4, fontSize: 12.5, color: colors.muted, lineHeight: 18 }}>
        Haksız bulduğun 1 yıldıza {d.gun} gün içinde bir kez itiraz edebilirsin. Kabul edilirse yıldız
        ortalamana katılmaz.{d.yetkili ? '' : ' İtirazı galerinin sahibi ya da yöneticisi yapar.'}
      </T>
      {d.yildizlar.map((y) => {
        const durum = y.itiraz ? DURUM[y.itiraz.durum] : null;
        return (
          <View
            key={y.id}
            style={{
              marginTop: 8,
              borderWidth: 1,
              borderColor: '#E3E6EF',
              borderRadius: radii.buton - 2,
              padding: 10,
            }}
          >
            <View
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
            >
              <T style={{ fontSize: 13.5 }}>
                <T style={{ color: '#E0A100', fontWeight: '800' }}>★</T> 1 yıldız · {tarih(y.tarih)}
              </T>
              {durum ? (
                <T
                  style={{
                    flexShrink: 1,
                    fontSize: 12,
                    fontWeight: '800',
                    paddingVertical: 4,
                    paddingHorizontal: 8,
                    borderRadius: radii.etiket,
                    overflow: 'hidden',
                    backgroundColor: durum[1],
                    color: durum[2],
                  }}
                >
                  {durum[0]}
                </T>
              ) : y.itirazEdebilir && acik !== y.id ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setAcik(y.id);
                    setMetin('');
                    setHata('');
                  }}
                  style={{
                    borderWidth: 1,
                    borderColor: '#D5DAE5',
                    borderRadius: 10,
                    paddingVertical: 7,
                    paddingHorizontal: 12,
                  }}
                >
                  <T style={{ fontSize: 13, fontWeight: '700' }}>İtiraz et</T>
                </Pressable>
              ) : !y.itirazEdebilir && new Date(y.itirazSonu) < new Date() ? (
                <T style={{ fontSize: 12, color: '#8A91A3' }}>Süre doldu</T>
              ) : null}
            </View>
            {y.itiraz?.sonuc ? (
              <T style={{ marginTop: 6, fontSize: 12.5, color: '#3A4052' }}>Moderasyon: {y.itiraz.sonuc}</T>
            ) : null}
            {acik === y.id ? (
              <>
                <TInput
                  value={metin}
                  onChangeText={setMetin}
                  multiline
                  maxLength={1000}
                  placeholder="Neden haksız? Örn. alıcıyla hiç konuşmadık."
                  accessibilityLabel="İtiraz metni"
                  style={{
                    marginTop: 10,
                    borderWidth: 1,
                    borderColor: '#D5DAE5',
                    borderRadius: radii.buton - 2,
                    padding: 12,
                    minHeight: 90,
                    fontSize: 14,
                    textAlignVertical: 'top',
                  }}
                />
                {hata ? (
                  <T accessibilityRole="alert" style={{ marginTop: 6, color: '#A3271F', fontWeight: '700' }}>
                    {hata}
                  </T>
                ) : null}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: mesgul }}
                    onPress={() => gonder(y.id)}
                    style={{
                      flex: 1,
                      backgroundColor: colors.blue,
                      borderRadius: radii.buton - 2,
                      paddingVertical: 12,
                      alignItems: 'center',
                    }}
                  >
                    <T style={{ fontSize: 14, fontWeight: '800' }}>İtirazı gönder</T>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setAcik(null)}
                    style={{ paddingVertical: 12, paddingHorizontal: 12 }}
                  >
                    <T style={{ fontSize: 14, fontWeight: '700', color: colors.muted }}>Vazgeç</T>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
