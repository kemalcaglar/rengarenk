'use client';

import { ILLER } from '@rengarenk/shared';
import { useRouter } from 'next/navigation';
import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { HesabimMenu } from '../../../components/hesabim-menu';
import { istek, useGiris } from '../../../lib/istemci';
import { Engellediklerin, KisiselVerilerim, SifreBolumu } from './gizlilik';
import { HesabiKapat } from './hesap';
import { GorunenAd, Iletisim, type IletisimTercihi, NumaraDegistir } from './iletisim';

interface Kanal {
  kanal: 'uygulama' | 'eposta' | 'sms';
  acik: boolean;
  kilitli: boolean;
}
interface Tercihler {
  konular: { konu: string; ad: string; not: string; kanallar: Kanal[] }[];
  ticariOnay: boolean;
  eposta: { adres: string; dogrulandi: boolean } | null;
}
interface Ben extends IletisimTercihi {
  firstName: string | null;
  lastName: string | null;
  phone: string;
  il: string | null;
  ilce: string | null;
  nameMode: 'tam' | 'kisa';
  /** Giriş yolları (Karar 18) */
  girisYollari?: { sifre: boolean; google: boolean; apple: boolean };
}
interface Oturum {
  id: string;
  createdAt: string;
  current: boolean;
  device: { platform: string; lastSeenAt: string } | null;
}

type Bolum = 'profil' | 'iletisim' | 'bildirim' | 'gizlilik' | 'hesap';
/** Ayar bölümleri (Ayarlar.dc.html) */
const BOLUMLER: [Bolum, string][] = [
  ['profil', 'Profil'],
  ['iletisim', 'İletişim'],
  ['bildirim', 'Bildirimler'],
  ['gizlilik', 'Gizlilik ve güvenlik'],
  ['hesap', 'Hesap'],
];

const kart: CSSProperties = {
  background: 'var(--rr-kart, #FFFFFF)',
  border: '1px solid var(--rr-cizgi, #E3E6EF)',
  borderRadius: 'var(--rr-kart-kose)',
};
const girdi: CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  marginTop: 5,
  border: '1px solid #D5DAE5',
  borderRadius: 'calc(var(--rr-buton-kose) * 10 / 14)',
  padding: 11,
  fontSize: 14.5,
  fontFamily: 'inherit',
};
const ikincil: CSSProperties = {
  border: '1px solid #D5DAE5',
  background: 'var(--rr-kart, #FFFFFF)',
  borderRadius: 'calc(var(--rr-buton-kose) * 10 / 14)',
  padding: '8px 12px',
  fontSize: 13.5,
  fontWeight: 700,
  color: 'var(--rr-murekkep, #1E2333)',
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const satir: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
  border: '1px solid #EEF0F5',
  borderRadius: 'calc(var(--rr-buton-kose) * 12 / 14)',
  padding: '12px 14px',
};
const PLATFORM: Record<string, string> = {
  WEB: 'Tarayıcı',
  IOS: 'iPhone · Rengarenk uygulaması',
  ANDROID: 'Android · Rengarenk uygulaması',
};
const tarih = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

/**
 * Ayarlar (Ayarlar.dc.html; Karar 29, 30, 48, 49): Profil (ad, soyad, il, ilçe, görünen ad, numarayı değiştir, e-posta ve
 * doğrulama), İletişim (telefon ve WhatsApp izni, aranabilir saatler), Bildirimler (konu
 * ve kanal; ödeme kapatılamaz; kampanya ticari ileti onayıyla), Gizlilik ve güvenlik (açık oturumlar, engellediklerin,
 * kişisel verilerim: verilerimi indir ve KVKK başvurusu, Karar 58).
 */
export default function Ayarlar() {
  const giris = useGiris();
  const router = useRouter();
  const [bolum, setBolum] = useState<Bolum>('profil');
  const [ben, setBen] = useState<Ben | null>(null);
  const [ad, setAd] = useState('');
  const [soyad, setSoyad] = useState('');
  const [il, setIl] = useState('');
  const [ilce, setIlce] = useState('');
  const [t, setT] = useState<Tercihler | null>(null);
  const [yeniEposta, setYeniEposta] = useState('');
  const [oturumlar, setOturumlar] = useState<Oturum[]>([]);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    if (giris === false) router.replace('/giris?sonra=/ayarlar');
    const b = new URLSearchParams(window.location.search).get('bolum');
    if (b && BOLUMLER.some(([k]) => k === b)) setBolum(b as Bolum);
  }, [giris, router]);

  const yukle = useCallback(async () => {
    const [m, p, o] = await Promise.all([
      istek<Ben>('/me'),
      istek<Tercihler>('/me/notification-preferences'),
      istek<Oturum[]>('/me/sessions'),
    ]);
    setBen(m);
    setAd(m.firstName ?? '');
    setSoyad(m.lastName ?? '');
    setIl(m.il ?? '');
    setIlce(m.ilce ?? '');
    setT(p);
    setOturumlar(o);
  }, []);
  useEffect(() => {
    if (giris) yukle().catch((e: Error) => setHata(e.message));
  }, [giris, yukle]);

  async function calistir(fn: () => Promise<unknown>, mesaj: string) {
    setHata(null);
    setBilgi(null);
    try {
      await fn();
      setBilgi(mesaj);
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  async function degistir(konu: string, k: Kanal) {
    if (k.kilitli) return;
    await calistir(async () => {
      const r = await istek<Tercihler>('/me/notification-preferences', {
        method: 'PUT',
        body: { tercihler: [{ konu, kanal: k.kanal, acik: !k.acik }] },
      });
      setT(r);
    }, 'Bildirim tercihin kaydedildi.');
  }

  const maske = ben ? `+90 5XX XXX XX ${ben.phone.slice(-2)}` : '';

  return (
    <div
      className="rr-sayfa"
      style={{
        maxWidth: 1360,
        margin: '0 auto',
        padding: '24px 24px 64px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        gap: 24,
      }}
    >
      <HesabimMenu aktif="/ayarlar" />
      <main style={{ flex: '999 1 760px', minWidth: 0 }}>
        <h1 style={{ margin: '0 0 16px', fontSize: 28, fontWeight: 800, letterSpacing: -0.4 }}>Ayarlar</h1>
        <div
          role="tablist"
          aria-label="Ayar bölümleri"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            background: 'var(--rr-kart, #FFFFFF)',
            border: '1px solid var(--rr-cizgi, #E3E6EF)',
            borderRadius: 'var(--rr-buton-kose)',
            padding: 6,
            marginBottom: 16,
          }}
        >
          {BOLUMLER.map(([k, a]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={bolum === k}
              onClick={() => setBolum(k)}
              style={{
                flex: '1 1 130px',
                border: 0,
                background: bolum === k ? '#EEF3FF' : 'transparent',
                borderRadius: 'calc(var(--rr-buton-kose) * 10 / 14)',
                padding: '11px 10px',
                fontSize: 14.5,
                fontWeight: bolum === k ? 800 : 600,
                color: bolum === k ? 'var(--rr-murekkep, #1E2333)' : '#3A4052',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {a}
            </button>
          ))}
        </div>
        {bilgi ? (
          <p
            role="status"
            style={{
              background: '#E7FAF0',
              color: '#11683F',
              borderRadius: 'calc(var(--rr-buton-kose) * 12 / 14)',
              padding: '10px 14px',
              fontWeight: 700,
            }}
          >
            {bilgi}
          </p>
        ) : null}
        {hata ? (
          <p
            role="alert"
            style={{
              background: '#FDECEC',
              color: '#A3271F',
              borderRadius: 'calc(var(--rr-buton-kose) * 12 / 14)',
              padding: '10px 14px',
              fontWeight: 700,
            }}
          >
            {hata}
          </p>
        ) : null}

        {bolum === 'profil' && ben ? (
          <section style={{ ...kart, padding: 22 }} aria-labelledby="pr">
            <h2 id="pr" style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 800 }}>
              Profil bilgileri
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                calistir(async () => {
                  const r = await istek<Partial<Ben>>('/me', {
                    method: 'PATCH',
                    body: {
                      firstName: ad.trim(),
                      lastName: soyad.trim(),
                      il: il || null,
                      ilce: ilce || null,
                    },
                  });
                  setBen((b) => (b ? { ...b, ...r } : b));
                }, 'Profilin kaydedildi.');
              }}
            >
              <div className="rr-iki-sutun" style={{ gap: 14 }}>
                <label style={{ fontSize: 13, fontWeight: 700 }}>
                  Ad
                  <input value={ad} onChange={(e) => setAd(e.target.value)} style={girdi} />
                </label>
                <label style={{ fontSize: 13, fontWeight: 700 }}>
                  Soyad
                  <input value={soyad} onChange={(e) => setSoyad(e.target.value)} style={girdi} />
                </label>
                <label style={{ fontSize: 13, fontWeight: 700 }}>
                  İl
                  <select
                    value={il}
                    onChange={(e) => {
                      setIl(e.target.value);
                      setIlce('');
                    }}
                    style={{ ...girdi, background: 'var(--rr-kart, #FFFFFF)' }}
                  >
                    <option value="">Seç</option>
                    {ILLER.map((i) => (
                      <option key={i.plaka} value={i.ad}>
                        {i.ad}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ fontSize: 13, fontWeight: 700 }}>
                  İlçe
                  <select
                    value={ilce}
                    disabled={!il}
                    onChange={(e) => setIlce(e.target.value)}
                    style={{ ...girdi, background: 'var(--rr-kart, #FFFFFF)' }}
                  >
                    <option value="">{il ? 'Seç' : 'Önce il seç'}</option>
                    {(ILLER.find((i) => i.ad === il)?.ilceler ?? []).map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button type="submit" style={{ ...ikincil, marginTop: 12 }}>
                Kaydet
              </button>
            </form>
            <GorunenAd
              ad={ad}
              soyad={soyad}
              secili={ben.nameMode}
              sec={(m) =>
                calistir(
                  async () => {
                    await istek('/me', { method: 'PATCH', body: { nameMode: m } });
                    setBen((b) => (b ? { ...b, nameMode: m } : b));
                  },
                  m === 'tam'
                    ? 'Yeni taleplerde adın tam görünecek.'
                    : 'Yeni taleplerde soyadının baş harfi görünecek.',
                )
              }
            />
            <h3 style={{ margin: '22px 0 10px', fontSize: 15, fontWeight: 800 }}>Giriş bilgileri</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={satir}>
                <span>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>
                    Cep telefonu · {maske}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 12.5,
                      color: '#11683F',
                      fontWeight: 700,
                      marginTop: 2,
                    }}
                  >
                    SMS ile doğrulandı
                  </span>
                </span>
                <NumaraDegistir
                  bitti={(m) => {
                    setBilgi(m);
                    yukle().catch((e: Error) => setHata(e.message));
                  }}
                />
              </div>
              <div style={satir}>
                <span>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>
                    E-posta · {t?.eposta?.adres ?? 'eklenmedi'}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 12.5,
                      fontWeight: 700,
                      marginTop: 2,
                      color: t?.eposta?.dogrulandi ? '#11683F' : '#7A5300',
                    }}
                  >
                    {t?.eposta?.dogrulandi
                      ? 'Doğrulandı'
                      : 'Doğrulanmadı · faturalar ve günlük özetler için gerekli'}
                  </span>
                </span>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    calistir(async () => {
                      await istek('/me/email', { method: 'POST', body: { eposta: yeniEposta } });
                      setYeniEposta('');
                      setT(await istek<Tercihler>('/me/notification-preferences'));
                    }, 'Doğrulama bağlantısı gönderildi. E-postandaki düğmeye bas.');
                  }}
                  style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}
                >
                  <label className="sr-only" htmlFor="eposta">
                    E-posta adresi
                  </label>
                  <input
                    id="eposta"
                    type="email"
                    required
                    placeholder={t?.eposta ? 'Yeni adres' : 'ornek@eposta.com'}
                    value={yeniEposta}
                    onChange={(e) => setYeniEposta(e.target.value)}
                    style={{ ...girdi, marginTop: 0, width: 220, padding: 8 }}
                  />
                  <button type="submit" style={ikincil}>
                    Doğrulama bağlantısı gönder
                  </button>
                </form>
              </div>
            </div>
          </section>
        ) : null}

        {bolum === 'iletisim' && ben ? (
          <Iletisim
            v={ben}
            kaydet={(yeni, mesaj) =>
              calistir(async () => {
                const r = await istek<IletisimTercihi>('/me/contact', {
                  method: 'PUT',
                  body: {
                    phoneVisible: yeni.phoneVisible,
                    whatsappVisible: yeni.whatsappVisible,
                    callFrom: yeni.callFrom,
                    callTo: yeni.callTo,
                  },
                });
                setBen((b) => (b ? { ...b, ...r } : b));
              }, mesaj)
            }
          />
        ) : null}

        {bolum === 'bildirim' && t ? (
          <section style={{ ...kart, overflow: 'hidden' }} aria-labelledby="bl">
            <h2 id="bl" style={{ margin: 0, padding: '18px 20px 6px', fontSize: 18, fontWeight: 800 }}>
              Bildirimler
            </h2>
            <p
              style={{ margin: 0, padding: '0 20px 14px', fontSize: 13.5, color: 'var(--rr-soluk, #5A6073)' }}
            >
              Güvenlik ve ödeme bildirimleri kapatılamaz.
              {t.eposta?.dogrulandi ? '' : ' E-posta bildirimleri için Profil bölümünden e-postanı doğrula.'}
            </p>
            <div
              style={{
                display: 'flex',
                gap: 10,
                padding: '10px 20px',
                background: '#F3F5FA',
                fontSize: 12.5,
                fontWeight: 700,
                color: 'var(--rr-soluk, #5A6073)',
              }}
            >
              <span style={{ flex: 1 }}>Bildirim</span>
              {['Uygulama', 'E-posta', 'SMS'].map((k) => (
                <span key={k} style={{ width: 72, textAlign: 'center' }}>
                  {k}
                </span>
              ))}
            </div>
            {t.konular.map((r) => (
              <div
                key={r.konu}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 20px',
                  borderTop: '1px solid #EEF0F5',
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{r.ad}</span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 12.5,
                      color: 'var(--rr-soluk, #5A6073)',
                      marginTop: 2,
                    }}
                  >
                    {r.not}
                  </span>
                </span>
                {r.kanallar.map((k) => (
                  <span key={k.kanal} style={{ width: 72, display: 'flex', justifyContent: 'center' }}>
                    {/* biome-ignore lint/a11y/useSemanticElements: tasarımdaki gibi role=checkbox düğmesi (Ayarlar.dc.html) */}
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={k.acik}
                      aria-disabled={k.kilitli}
                      aria-label={`${r.ad} · ${k.kanal === 'uygulama' ? 'Uygulama' : k.kanal === 'eposta' ? 'E-posta' : 'SMS'}`}
                      onClick={() => degistir(r.konu, k)}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 'calc(var(--rr-buton-kose) * 7 / 14)',
                        border: `2px solid ${k.acik ? 'var(--rr-mavi, #5B8CFF)' : '#AEB5C4'}`,
                        background: k.acik ? 'var(--rr-mavi, #5B8CFF)' : '#FFFFFF',
                        color: '#FFFFFF',
                        fontSize: 14,
                        fontWeight: 800,
                        cursor: k.kilitli ? 'not-allowed' : 'pointer',
                        padding: 0,
                        opacity: k.kilitli ? 0.5 : 1,
                      }}
                    >
                      {k.acik ? '✓' : ''}
                    </button>
                  </span>
                ))}
              </div>
            ))}
            <p
              style={{
                margin: 0,
                padding: '12px 20px 18px',
                fontSize: 12.5,
                color: 'var(--rr-soluk, #5A6073)',
                borderTop: '1px solid #EEF0F5',
              }}
            >
              Kampanya e-posta ve SMS’leri ticari elektronik ileti onayınla gönderilir ve İYS’ye kaydedilir.
              Onayını istediğin zaman geri alabilirsin.
            </p>
          </section>
        ) : null}

        {bolum === 'gizlilik' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {ben ? (
              <SifreBolumu
                sifreVar={!!ben.girisYollari?.sifre}
                google={!!ben.girisYollari?.google}
                bildir={(m, h) => {
                  setBilgi(m);
                  setHata(h ?? null);
                }}
              />
            ) : null}
            <section style={{ ...kart, padding: 20 }} aria-labelledby="ot">
              <h2 id="ot" style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 800 }}>
                Açık oturumlar
              </h2>
              {oturumlar.map((o) => (
                <div
                  key={o.id}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                    padding: '12px 0',
                    borderTop: '1px solid #EEF0F5',
                  }}
                >
                  <span>
                    <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>
                      {PLATFORM[o.device?.platform ?? 'WEB'] ?? 'Tarayıcı'}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 12.5,
                        color: 'var(--rr-soluk, #5A6073)',
                        marginTop: 2,
                      }}
                    >
                      {o.current
                        ? 'şu an etkin'
                        : `son etkinlik ${tarih(o.device?.lastSeenAt ?? o.createdAt)}`}
                    </span>
                  </span>
                  {o.current ? (
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#11683F' }}>Bu cihaz</span>
                  ) : (
                    <button
                      type="button"
                      style={ikincil}
                      onClick={() =>
                        calistir(async () => {
                          await istek(`/me/sessions/${o.id}`, { method: 'DELETE' });
                          setOturumlar((x) => x.filter((y) => y.id !== o.id));
                        }, 'Oturum kapatıldı.')
                      }
                    >
                      Oturumu kapat
                    </button>
                  )}
                </div>
              ))}
            </section>
            <Engellediklerin
              bildir={(m, h) => {
                setBilgi(m);
                setHata(h ?? null);
              }}
            />
            {ben ? (
              <KisiselVerilerim
                bildir={(m, h) => {
                  setBilgi(m);
                  setHata(h ?? null);
                }}
              />
            ) : null}
          </div>
        ) : null}

        {bolum === 'hesap' && ben ? (
          <HesabiKapat
            bildir={(m, h) => {
              setBilgi(m);
              setHata(h ?? null);
            }}
          />
        ) : null}
      </main>
    </div>
  );
}
