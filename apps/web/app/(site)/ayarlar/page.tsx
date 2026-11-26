'use client';

import { ILLER } from '@rengarenk/shared';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { HesabimMenu } from '../../../components/hesabim-menu';
import { cx } from '../../../lib/cx';
import { istek, useGiris } from '../../../lib/istemci';
import { Engellediklerin, KisiselVerilerim, SifreBolumu } from './gizlilik';
import { HesabiKapat } from './hesap';
import { GorunenAd, Iletisim, type IletisimTercihi, NumaraDegistir } from './iletisim';
import stil from './page.module.css';

interface Kanal {
  kanal: 'uygulama' | 'eposta' | 'whatsapp';
  acik: boolean;
  kilitli: boolean;
  /** Bu konuda sunulmayan kanal (kampanyada WhatsApp) */
  kapali?: boolean;
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
    <div className={`rr-sayfa ${stil.kutu1}`}>
      <HesabimMenu aktif="/ayarlar" />
      <main className={stil.kutu2}>
        <h1 className={stil.baslik1}>Ayarlar</h1>
        <div role="tablist" aria-label="Ayar bölümleri" className={stil.kutu3}>
          {BOLUMLER.map(([k, a]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={bolum === k}
              onClick={() => setBolum(k)}
              className={cx(stil.dugme1, bolum === k ? stil.dugme2 : stil.dugme3)}
            >
              {a}
            </button>
          ))}
        </div>
        {bilgi ? (
          <p role="status" className={stil.metin1}>
            {bilgi}
          </p>
        ) : null}
        {hata ? (
          <p role="alert" className={stil.metin2}>
            {hata}
          </p>
        ) : null}

        {bolum === 'profil' && ben ? (
          <section className={stil.kutu4} aria-labelledby="pr">
            <h2 id="pr" className={stil.baslik2}>
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
              <div className={`rr-iki-sutun ${stil.kutu5}`}>
                <label className={stil.etiket1}>
                  Ad
                  <input value={ad} onChange={(e) => setAd(e.target.value)} className={stil.girdi1} />
                </label>
                <label className={stil.etiket1}>
                  Soyad
                  <input value={soyad} onChange={(e) => setSoyad(e.target.value)} className={stil.girdi1} />
                </label>
                <label className={stil.etiket1}>
                  İl
                  <select
                    value={il}
                    onChange={(e) => {
                      setIl(e.target.value);
                      setIlce('');
                    }}
                    className={stil.girdi2}
                  >
                    <option value="">Seç</option>
                    {ILLER.map((i) => (
                      <option key={i.plaka} value={i.ad}>
                        {i.ad}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={stil.etiket1}>
                  İlçe
                  <select
                    value={ilce}
                    disabled={!il}
                    onChange={(e) => setIlce(e.target.value)}
                    className={stil.girdi2}
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
              <button type="submit" className={stil.dugme4}>
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
            <h3 className={stil.baslik3}>Giriş bilgileri</h3>
            <div className={stil.kutu6}>
              <div className={stil.kutu7}>
                <span>
                  <span className={stil.metin3}>Cep telefonu · {maske}</span>
                  <span className={stil.metin4}>WhatsApp ile doğrulandı</span>
                </span>
                <NumaraDegistir
                  bitti={(m) => {
                    setBilgi(m);
                    yukle().catch((e: Error) => setHata(e.message));
                  }}
                />
              </div>
              <div className={stil.kutu7}>
                <span>
                  <span className={stil.metin3}>E-posta · {t?.eposta?.adres ?? 'eklenmedi'}</span>
                  <span className={cx(stil.metin5, t?.eposta?.dogrulandi ? stil.metin6 : stil.metin7)}>
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
                  className={stil.kutu8}
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
                    className={stil.girdi3}
                  />
                  <button type="submit" className={stil.dugme5}>
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
          <section className={stil.kutu9} aria-labelledby="bl">
            <h2 id="bl" className={stil.baslik4}>
              Bildirimler
            </h2>
            <p className={stil.metin8}>
              Güvenlik ve ödeme bildirimleri kapatılamaz.
              {t.eposta?.dogrulandi ? '' : ' E-posta bildirimleri için Profil bölümünden e-postanı doğrula.'}
            </p>
            <div className={stil.kutu10}>
              <span className={stil.metin9}>Bildirim</span>
              {['Uygulama', 'E-posta', 'WhatsApp'].map((k) => (
                <span key={k} className={stil.metin10}>
                  {k}
                </span>
              ))}
            </div>
            {t.konular.map((r) => (
              <div key={r.konu} className={stil.kutu11}>
                <span className={stil.metin11}>
                  <span className={stil.metin3}>{r.ad}</span>
                  <span className={stil.metin12}>{r.not}</span>
                </span>
                {r.kanallar.map((k) =>
                  k.kapali ? (
                    <span key={k.kanal} title="Bu bildirim bu kanaldan gönderilmez" className={stil.metin13}>
                      —
                    </span>
                  ) : (
                    <span key={k.kanal} className={stil.metin14}>
                      {/* biome-ignore lint/a11y/useSemanticElements: tasarımdaki gibi role=checkbox düğmesi (Ayarlar.dc.html) */}
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={k.acik}
                        aria-disabled={k.kilitli}
                        aria-label={`${r.ad} · ${k.kanal === 'uygulama' ? 'Uygulama' : k.kanal === 'eposta' ? 'E-posta' : 'WhatsApp'}`}
                        onClick={() => degistir(r.konu, k)}
                        className={cx(
                          stil.dugme6,
                          k.acik ? stil.dugme7 : stil.dugme8,
                          k.kilitli ? stil.dugme9 : stil.dugme10,
                        )}
                        style={{ border: `2px solid ${k.acik ? 'var(--rr-mavi, #5B8CFF)' : '#AEB5C4'}` }}
                      >
                        {k.acik ? '✓' : ''}
                      </button>
                    </span>
                  ),
                )}
              </div>
            ))}
            <p className={stil.metin15}>
              Kampanya e-postaları ticari elektronik ileti onayınla gönderilir ve İYS’ye kaydedilir; kampanya
              WhatsApp’tan gönderilmez. Onayını istediğin zaman geri alabilirsin.
            </p>
          </section>
        ) : null}

        {bolum === 'gizlilik' ? (
          <div className={stil.kutu12}>
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
            <section className={stil.kutu13} aria-labelledby="ot">
              <h2 id="ot" className={stil.baslik5}>
                Açık oturumlar
              </h2>
              {oturumlar.map((o) => (
                <div key={o.id} className={stil.kutu14}>
                  <span>
                    <span className={stil.metin3}>{PLATFORM[o.device?.platform ?? 'WEB'] ?? 'Tarayıcı'}</span>
                    <span className={stil.metin12}>
                      {o.current
                        ? 'şu an etkin'
                        : `son etkinlik ${tarih(o.device?.lastSeenAt ?? o.createdAt)}`}
                    </span>
                  </span>
                  {o.current ? (
                    <span className={stil.metin16}>Bu cihaz</span>
                  ) : (
                    <button
                      type="button"
                      className={stil.dugme5}
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
