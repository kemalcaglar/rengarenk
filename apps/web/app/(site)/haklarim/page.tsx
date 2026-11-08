'use client';

import { CONTRACT_CONSENT, ILLER, tlYaz, vatOfGross, WAIVER_CONSENT } from '@rengarenk/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { HesabimMenu } from '../../../components/hesabim-menu';
import { API, erisim, istek, useGiris } from '../../../lib/istemci';

interface Urun {
  key: string;
  grup: 'talep' | 'mesaj' | 'one_cikarma';
  grupAd: string;
  ad: string;
  not: string;
  kurus: number;
  oneCikarma: boolean;
  hemenBaslar: boolean;
}
interface Ozet {
  ekMesaj: number;
  gunlukMesaj: { toplam: number; kalan: number };
  uzatmaHakki: number;
  ucretsizUzatma: number;
  odeme: { acik: boolean; not: string | null };
  urunler: Urun[];
  talepler: { no: number; baslik: string }[];
  aktifOneCikarma: { tur: string; ad: string; talep: { no: number; baslik: string }; bitis: string }[];
  gecmis: {
    id: string;
    no: string;
    tarih: string;
    kalem: string;
    tutarKurus: number;
    fatura: boolean;
    iadeKurus: number;
  }[];
}
type Adim = 'magaza' | 'odeme' | 'tamam';

const kart: CSSProperties = { background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 18 };
const girdi: CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  marginTop: 5,
  border: '1px solid #D5DAE5',
  borderRadius: 10,
  padding: 11,
  fontSize: 14.5,
  fontFamily: 'inherit',
  background: '#FFFFFF',
};
const RENK = ['#5B8CFF', '#FF6FB5', '#FFC84A', '#3DD68C'];
const tarih = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
const kalanGun = (iso: string) => Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));

/**
 * Haklarım ve ödemeler (tasarım: Haklarim.dc.html; Karar 12, 31, 39). Sepet, fatura bilgileri, PayTR ödeme çerçevesi,
 * Karar 39 onayları. Tasarımdan fark: ödeme çerçevesi "Siparişi onayla ve öde" düğmesinden sonra açılır (PayTR
 * çerçevesi siparişin tutarıyla oluşturulur); kart bilgileri çerçevenin içinde girilir ve Rengarenk'e gelmez.
 */
export default function Haklarim() {
  const giris = useGiris();
  const router = useRouter();
  const [o, setO] = useState<Ozet | null>(null);
  const [haklar, setHaklar] = useState<{ talep: number; ucretsizTalep: boolean } | null>(null);
  const [adim, setAdim] = useState<Adim>('magaza');
  const [sepet, setSepet] = useState<string[]>([]);
  const [hedef, setHedef] = useState<number | null>(null);
  const [fatura, setFatura] = useState({ ad: '', eposta: '', il: '', ilce: '' });
  const [kurumsal, setKurumsal] = useState<{ unvan: string; vergiNo: string; vergiDairesi: string } | null>(
    null,
  );
  const [onay, setOnay] = useState({ sozlesme: false, cayma: false });
  const [siparis, setSiparis] = useState<{ no: string; odemeAdresi: string; toplamKurus: number } | null>(
    null,
  );
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);

  useEffect(() => {
    if (giris === false) router.replace('/giris?sonra=/haklarim');
  }, [giris, router]);

  const yukle = useCallback(async () => {
    const [x, h, me] = await Promise.all([
      istek<Ozet>('/orders/overview'),
      istek<{ talep: number; ucretsizTalep: boolean }>('/demands/rights'),
      istek<{ firstName: string | null; lastName: string | null; email: string | null }>('/me'),
    ]);
    setO(x);
    setHaklar(h);
    setFatura((f) =>
      f.ad || f.eposta
        ? f
        : { ...f, ad: [me.firstName, me.lastName].filter(Boolean).join(' '), eposta: me.email ?? '' },
    );
    const q = new URLSearchParams(window.location.search);
    const t = Number(q.get('talep'));
    setHedef((h0) => h0 ?? x.talepler.find((y) => y.no === t)?.no ?? x.talepler[0]?.no ?? null);
    // Sihirbazdan ya da talep sayfasından gelen sepet: ?sepet=ust_sira_7,acil_7
    const onSepet = (q.get('sepet') ?? '').split(',').filter((k) => x.urunler.some((u) => u.key === k));
    if (onSepet.length) setSepet((s0) => (s0.length ? s0 : onSepet));
    // Ödeme sonucu sayfasından dönüş
    const no = q.get('siparis');
    if (no) {
      const s = await istek<{ durum: string; toplamKurus: number }>(`/orders/${no}`).catch(() => null);
      if (s?.durum === 'PAID') {
        setSiparis({ no, odemeAdresi: '', toplamKurus: s.toplamKurus });
        setAdim('tamam');
      }
    }
  }, []);
  useEffect(() => {
    if (giris) yukle().catch((e: Error) => setHata(e.message));
  }, [giris, yukle]);

  // Ödeme çerçevesi açıkken sipariş durumu izlenir
  useEffect(() => {
    if (!siparis?.odemeAdresi || adim !== 'odeme') return;
    const t = setInterval(async () => {
      const s = await istek<{ durum: string; neden: string | null }>(`/orders/${siparis.no}`).catch(
        () => null,
      );
      if (s?.durum === 'PAID') {
        setAdim('tamam');
        yukle().catch(() => undefined);
      } else if (s?.durum === 'FAILED' || s?.durum === 'CANCELLED') {
        setHata(s.neden ?? 'Ödeme alınamadı');
        setSiparis(null);
      }
    }, 2500);
    return () => clearInterval(t);
  }, [siparis, adim, yukle]);

  const urunler = o?.urunler ?? [];
  const secili = sepet.map((k) => urunler.find((u) => u.key === k)).filter((u): u is Urun => !!u);
  const toplam = secili.reduce((t, u) => t + u.kurus, 0);
  const hemen = secili.some((u) => u.hemenBaslar);
  const odeHazir =
    onay.sozlesme && (!hemen || onay.cayma) && !!fatura.ad && !!fatura.eposta && !!fatura.il && !!fatura.ilce;
  const hedefBaslik = o?.talepler.find((t) => t.no === hedef)?.baslik;

  async function ode() {
    setHata(null);
    setMesgul(true);
    try {
      const r = await istek<{ no: string; odemeAdresi: string; toplamKurus: number }>('/orders', {
        method: 'POST',
        body: {
          kalemler: secili.map((u) => (u.oneCikarma ? { urun: u.key, talepNo: hedef } : { urun: u.key })),
          fatura: { ...fatura, ...(kurumsal ? { kurumsal } : {}) },
          onay: { sozlesme: true, ...(hemen ? { cayma: onay.cayma } : {}) },
        },
      });
      setSiparis(r);
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setMesgul(false);
    }
  }

  async function faturaIndir(id: string) {
    const token = await erisim();
    const r = await fetch(`${API}/orders/${id}/invoice`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    if (!r.ok) {
      setHata('Fatura henüz hazır değil');
      return;
    }
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fatura.pdf';
    a.click();
    URL.revokeObjectURL(url);
  }

  const kartlar = [
    {
      ad: 'Talep hakkı',
      deger: String(haklar?.talep ?? 0),
      not: haklar?.ucretsizTalep ? '1 ücretsiz talep hakkın dahil' : 'Ek talep ya da paketle artar',
    },
    {
      ad: 'Bugünkü ücretsiz ilk mesaj',
      deger: `${o?.gunlukMesaj.kalan ?? 0} / ${o?.gunlukMesaj.toplam ?? 5}`,
      not: 'Gece 00.00’da yenilenir',
    },
    { ad: 'Ek ilk mesaj', deger: String(o?.ekMesaj ?? 0), not: 'Satın aldığın mesajlar, süresi dolmaz' },
    {
      ad: 'Ücretsiz uzatma',
      deger: String(o?.ucretsizUzatma ?? 0),
      not: `Süresi dolan bir talebi 30 gün uzatır${o?.uzatmaHakki ? ` · ek uzatma hakkın ${o.uzatmaHakki}` : ''}`,
    },
  ];

  return (
    <div
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
      <HesabimMenu aktif="/haklarim" />
      <main style={{ flex: '999 1 760px', minWidth: 0 }}>
        {hata ? (
          <p
            role="alert"
            style={{
              margin: '0 0 14px',
              background: '#FFF0EE',
              border: '1px solid #F5C6C0',
              borderRadius: 12,
              padding: '10px 14px',
              fontSize: 14,
              color: '#A3271F',
            }}
          >
            {hata}
          </p>
        ) : null}

        {adim === 'magaza' ? (
          <>
            <h1 style={{ margin: '0 0 16px', fontSize: 28, fontWeight: 800, letterSpacing: -0.4 }}>
              Haklarım ve ödemeler
            </h1>
            <div className="rr-dort-sutun" style={{ gap: 12 }}>
              {kartlar.map((h, i) => (
                <div
                  key={h.ad}
                  style={{ ...kart, borderRadius: 16, padding: 16, borderTop: `4px solid ${RENK[i]}` }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#5A6073' }}>{h.ad}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>{h.deger}</div>
                  <div style={{ fontSize: 12.5, color: '#5A6073', marginTop: 4, lineHeight: 1.4 }}>
                    {h.not}
                  </div>
                </div>
              ))}
            </div>
            {o?.aktifOneCikarma.length ? (
              <div
                style={{
                  ...kart,
                  borderRadius: 16,
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '8px 14px',
                  padding: '14px 18px',
                  marginTop: 12,
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 800 }}>Aktif öne çıkarma</span>
                {o.aktifOneCikarma.map((a) => (
                  <span
                    key={`${a.tur}-${a.talep.no}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        padding: '3px 9px',
                        borderRadius: 999,
                        background: '#FFEEF6',
                        color: '#A3236A',
                      }}
                    >
                      {a.ad}
                    </span>
                    <span style={{ fontSize: 14, color: '#3A4052' }}>
                      {a.talep.baslik} · {kalanGun(a.bitis)} gün kaldı
                    </span>
                  </span>
                ))}
              </div>
            ) : null}
            {o && !o.odeme.acik ? (
              <p
                style={{
                  margin: '12px 0 0',
                  background: '#FFF6DF',
                  borderRadius: 12,
                  padding: '10px 14px',
                  fontSize: 14,
                  color: '#5A3D00',
                }}
              >
                {o.odeme.not ?? 'Ödemeler şu an kapalı.'} Hakların kullanılmaya devam eder.
              </p>
            ) : null}

            <div
              style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 16, marginTop: 22 }}
            >
              <section style={{ flex: '999 1 460px', minWidth: 0 }} aria-labelledby="mg">
                <h2 id="mg" style={{ margin: '0 0 10px', fontSize: 19, fontWeight: 800 }}>
                  Hak ve öne çıkarma satın al
                </h2>
                {(['talep', 'mesaj', 'one_cikarma'] as const).map((g) => {
                  const liste = urunler.filter((u) => u.grup === g);
                  if (!liste.length) return null;
                  const oneCikarma = g === 'one_cikarma';
                  return (
                    <div key={g} style={{ ...kart, overflow: 'hidden', marginBottom: 12 }}>
                      <h3
                        style={{
                          margin: 0,
                          padding: '13px 16px',
                          fontSize: 14.5,
                          fontWeight: 800,
                          background: '#F3F5FA',
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        {oneCikarma ? (
                          <>
                            Öne çıkarma ·{' '}
                            {o && o.talepler.length > 1 ? (
                              <select
                                aria-label="Öne çıkarılacak talep"
                                value={hedef ?? ''}
                                onChange={(e) => setHedef(Number(e.target.value))}
                                style={{
                                  border: '1px solid #D5DAE5',
                                  borderRadius: 8,
                                  padding: '4px 6px',
                                  fontSize: 13.5,
                                  fontWeight: 700,
                                  fontFamily: 'inherit',
                                }}
                              >
                                {o.talepler.map((t) => (
                                  <option key={t.no} value={t.no}>
                                    {t.baslik}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span>{hedefBaslik ?? 'yayında talebin yok'}</span>
                            )}{' '}
                            {hedefBaslik ? 'talebi için' : ''}
                          </>
                        ) : (
                          liste[0]?.grupAd
                        )}
                      </h3>
                      {liste.map((u) => {
                        const on = sepet.includes(u.key);
                        const pasif = !o?.odeme.acik || (oneCikarma && !hedef);
                        return (
                          <div
                            key={u.key}
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              alignItems: 'center',
                              gap: '8px 14px',
                              padding: '12px 16px',
                              borderTop: '1px solid #EEF0F5',
                            }}
                          >
                            <span style={{ flex: '999 1 220px', minWidth: 0 }}>
                              <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>
                                {u.ad}
                              </span>
                              <span
                                style={{ display: 'block', fontSize: 12.5, color: '#5A6073', marginTop: 2 }}
                              >
                                {u.not}
                              </span>
                            </span>
                            <span style={{ flex: 'none', fontSize: 15, fontWeight: 800 }}>
                              {tlYaz(u.kurus)}
                            </span>
                            <button
                              type="button"
                              aria-pressed={on}
                              disabled={pasif && !on}
                              onClick={() =>
                                setSepet((s) => (on ? s.filter((k) => k !== u.key) : [...s, u.key]))
                              }
                              style={{
                                flex: 'none',
                                width: 104,
                                border: on ? 0 : '1px solid #5B8CFF',
                                background: on ? '#E7FAF0' : '#FFFFFF',
                                borderRadius: 10,
                                padding: on ? '9px 0' : '8px 0',
                                fontSize: 13.5,
                                fontWeight: 800,
                                color: on ? '#11683F' : '#2450C8',
                                cursor: pasif && !on ? 'default' : 'pointer',
                                opacity: pasif && !on ? 0.5 : 1,
                                fontFamily: 'inherit',
                              }}
                            >
                              {on ? '✓ Sepette' : 'Sepete ekle'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </section>

              <aside
                aria-labelledby="sp"
                style={{
                  ...kart,
                  flex: '1 1 280px',
                  maxWidth: 340,
                  minWidth: 0,
                  padding: 18,
                  position: 'sticky',
                  top: 16,
                }}
              >
                <h2 id="sp" style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 800 }}>
                  Sepet
                </h2>
                {!secili.length ? (
                  <p style={{ margin: 0, fontSize: 14, color: '#5A6073' }}>
                    Sepetin boş. Soldan bir hak veya öne çıkarma seç.
                  </p>
                ) : (
                  <>
                    {secili.map((u) => (
                      <div
                        key={u.key}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 10,
                          padding: '8px 0',
                          borderBottom: '1px solid #EEF0F5',
                          fontSize: 14,
                        }}
                      >
                        <span>{u.ad}</span>
                        <strong style={{ flex: 'none' }}>{tlYaz(u.kurus)}</strong>
                      </div>
                    ))}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: 12,
                        fontSize: 16,
                        fontWeight: 800,
                      }}
                    >
                      <span>Toplam</span>
                      <span>{tlYaz(toplam)}</span>
                    </div>
                    <p style={{ margin: '4px 0 14px', fontSize: 12.5, color: '#5A6073' }}>
                      KDV dahil · e-arşiv fatura e-postana gönderilir
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setHata(null);
                        setAdim('odeme');
                      }}
                      style={{
                        width: '100%',
                        border: 0,
                        background: '#5B8CFF',
                        borderRadius: 12,
                        padding: 13,
                        fontSize: 15,
                        fontWeight: 800,
                        color: '#1E2333',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      Ödemeye geç
                    </button>
                  </>
                )}
              </aside>
            </div>

            <section style={{ ...kart, marginTop: 22, overflow: 'hidden' }} aria-labelledby="fg">
              <h2
                id="fg"
                style={{
                  margin: 0,
                  padding: '16px 18px',
                  fontSize: 17,
                  fontWeight: 800,
                  borderBottom: '1px solid #EEF0F5',
                }}
              >
                Ödeme geçmişi
              </h2>
              {o && !o.gecmis.length ? (
                <p style={{ margin: 0, padding: '12px 18px', fontSize: 14, color: '#5A6073' }}>
                  Henüz ödemen yok.
                </p>
              ) : null}
              {(o?.gecmis ?? []).map((g) => (
                <div
                  key={g.id}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '6px 16px',
                    padding: '12px 18px',
                    borderBottom: '1px solid #EEF0F5',
                    fontSize: 14,
                  }}
                >
                  <span style={{ flex: '1 1 120px', color: '#5A6073' }}>{tarih(g.tarih)}</span>
                  <span style={{ flex: '999 1 240px', fontWeight: 700 }}>{g.kalem}</span>
                  <span style={{ flex: '1 1 90px', fontWeight: 800 }}>
                    {tlYaz(g.tutarKurus)}
                    {g.iadeKurus ? (
                      <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#11683F' }}>
                        İade: {tlYaz(g.iadeKurus)}
                      </span>
                    ) : null}
                  </span>
                  {g.fatura ? (
                    <button
                      type="button"
                      onClick={() => faturaIndir(g.id)}
                      style={{
                        flex: '1 1 110px',
                        textAlign: 'left',
                        border: 0,
                        background: 'transparent',
                        padding: 0,
                        fontSize: 14,
                        fontWeight: 700,
                        color: '#2450C8',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      Faturayı indir
                    </button>
                  ) : (
                    <span style={{ flex: '1 1 110px', color: '#5A6073' }}>Fatura hazırlanıyor</span>
                  )}
                </div>
              ))}
            </section>
          </>
        ) : null}

        {adim === 'odeme' ? (
          <>
            <button
              type="button"
              onClick={() => {
                setSiparis(null);
                setAdim('magaza');
              }}
              style={{
                border: 0,
                background: 'transparent',
                padding: 0,
                fontSize: 14,
                fontWeight: 700,
                color: '#2450C8',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              ← Sepete dön
            </button>
            <h1 style={{ margin: '8px 0 16px', fontSize: 28, fontWeight: 800, letterSpacing: -0.4 }}>
              Ödeme
            </h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 16 }}>
              <div
                style={{
                  flex: '999 1 460px',
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                <section style={{ ...kart, padding: 20 }} aria-labelledby="fb">
                  <h2 id="fb" style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 800 }}>
                    Fatura bilgileri
                  </h2>
                  <fieldset disabled={!!siparis} style={{ border: 0, margin: 0, padding: 0 }}>
                    <div className="rr-iki-sutun" style={{ gap: 12 }}>
                      <label style={{ fontSize: 13, fontWeight: 700 }}>
                        Ad soyad
                        <input
                          value={fatura.ad}
                          onChange={(e) => setFatura({ ...fatura, ad: e.target.value })}
                          style={girdi}
                        />
                      </label>
                      <label style={{ fontSize: 13, fontWeight: 700 }}>
                        Fatura e-postası
                        <input
                          type="email"
                          value={fatura.eposta}
                          onChange={(e) => setFatura({ ...fatura, eposta: e.target.value })}
                          style={girdi}
                        />
                      </label>
                      <label style={{ fontSize: 13, fontWeight: 700 }}>
                        İl
                        <select
                          value={fatura.il}
                          onChange={(e) => setFatura({ ...fatura, il: e.target.value, ilce: '' })}
                          style={girdi}
                        >
                          <option value="">Seç</option>
                          {ILLER.map((i) => (
                            <option key={i.ad} value={i.ad}>
                              {i.ad}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label style={{ fontSize: 13, fontWeight: 700 }}>
                        İlçe
                        <select
                          value={fatura.ilce}
                          onChange={(e) => setFatura({ ...fatura, ilce: e.target.value })}
                          style={girdi}
                        >
                          <option value="">Seç</option>
                          {(ILLER.find((i) => i.ad === fatura.il)?.ilceler ?? []).map((x) => (
                            <option key={x} value={x}>
                              {x}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {kurumsal ? (
                      <div className="rr-uc-sutun" style={{ gap: 12, marginTop: 12 }}>
                        <label style={{ fontSize: 13, fontWeight: 700 }}>
                          Ticari unvan
                          <input
                            value={kurumsal.unvan}
                            onChange={(e) => setKurumsal({ ...kurumsal, unvan: e.target.value })}
                            style={girdi}
                          />
                        </label>
                        <label style={{ fontSize: 13, fontWeight: 700 }}>
                          Vergi no
                          <input
                            inputMode="numeric"
                            value={kurumsal.vergiNo}
                            onChange={(e) =>
                              setKurumsal({ ...kurumsal, vergiNo: e.target.value.replace(/\D/g, '') })
                            }
                            style={girdi}
                          />
                        </label>
                        <label style={{ fontSize: 13, fontWeight: 700 }}>
                          Vergi dairesi
                          <input
                            value={kurumsal.vergiDairesi}
                            onChange={(e) => setKurumsal({ ...kurumsal, vergiDairesi: e.target.value })}
                            style={girdi}
                          />
                        </label>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() =>
                        setKurumsal(kurumsal ? null : { unvan: '', vergiNo: '', vergiDairesi: '' })
                      }
                      style={{
                        marginTop: 12,
                        border: 0,
                        background: 'transparent',
                        padding: 0,
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: '#2450C8',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {kurumsal ? 'Bireysel fatura istiyorum' : 'Kurumsal fatura istiyorum (vergi no ile)'}
                    </button>
                  </fieldset>
                </section>

                <section style={{ ...kart, padding: 20 }} aria-labelledby="kb">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 10,
                      marginBottom: 12,
                    }}
                  >
                    <h2 id="kb" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
                      Kart bilgileri
                    </h2>
                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: 800,
                        color: '#11683F',
                        background: '#E7FAF0',
                        padding: '4px 10px',
                        borderRadius: 999,
                      }}
                    >
                      PayTR güvenli ödeme · 3D Secure
                    </span>
                  </div>
                  {siparis?.odemeAdresi ? (
                    <iframe
                      title="PayTR ödeme çerçevesi"
                      src={siparis.odemeAdresi}
                      style={{ width: '100%', height: 560, border: '1px solid #D5DAE5', borderRadius: 14 }}
                    />
                  ) : (
                    <div
                      style={{
                        border: '1px dashed #AEB5C4',
                        borderRadius: 14,
                        padding: 16,
                        background: '#FBFCFE',
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#5A6073', marginBottom: 10 }}>
                        Bu alan PayTR’nin ödeme çerçevesidir; siparişi onaylayınca açılır
                      </div>
                      <div className="rr-iki-sutun" style={{ gap: 10 }}>
                        {['Kart üzerindeki isim', 'Kart numarası', 'AA / YY', 'CVC'].map((x, i) => (
                          <span
                            key={x}
                            style={{
                              gridColumn: i < 2 ? '1 / -1' : undefined,
                              border: '1px solid #D5DAE5',
                              borderRadius: 10,
                              padding: 11,
                              fontSize: 14.5,
                              color: '#6B7183',
                              background: '#FFFFFF',
                            }}
                          >
                            {x}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <p style={{ margin: '10px 0 0', fontSize: 12.5, color: '#5A6073' }}>
                    Kart bilgilerin Rengarenk sunucularına gelmez ve saklanmaz. Tek çekim; bu tutarlarda
                    taksit yok.
                  </p>
                </section>

                <section
                  aria-label="Sözleşmeler"
                  style={{ ...kart, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}
                >
                  {[
                    { key: 'sozlesme' as const, yazi: CONTRACT_CONSENT },
                    ...(hemen ? [{ key: 'cayma' as const, yazi: WAIVER_CONSENT }] : []),
                  ].map((c) => {
                    const on = onay[c.key];
                    return (
                      // biome-ignore lint/a11y/useSemanticElements: tasarımdaki özel onay kutusu (Haklarim.dc.html)
                      <button
                        key={c.key}
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        disabled={!!siparis}
                        onClick={() => setOnay((x) => ({ ...x, [c.key]: !x[c.key] }))}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 10,
                          textAlign: 'left',
                          border: 0,
                          background: 'transparent',
                          padding: 0,
                          fontSize: 14,
                          lineHeight: 1.45,
                          color: '#1E2333',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        <span
                          style={{
                            flex: 'none',
                            width: 20,
                            height: 20,
                            borderRadius: 6,
                            border: `2px solid ${on ? '#5B8CFF' : '#AEB5C4'}`,
                            background: on ? '#5B8CFF' : '#FFFFFF',
                            color: '#FFFFFF',
                            fontSize: 13,
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginTop: 1,
                          }}
                        >
                          {on ? '✓' : ''}
                        </span>
                        <span>{c.yazi}</span>
                      </button>
                    );
                  })}
                  <span style={{ fontSize: 12.5, color: '#5A6073' }}>
                    <Link href="/on-bilgilendirme" target="_blank">
                      Ön Bilgilendirme Formu
                    </Link>{' '}
                    ·{' '}
                    <Link href="/mesafeli-sozlesme" target="_blank">
                      Mesafeli Hizmet Sözleşmesi
                    </Link>
                  </span>
                </section>
              </div>

              <aside
                aria-labelledby="oz"
                style={{ ...kart, flex: '1 1 280px', maxWidth: 340, minWidth: 0, padding: 18 }}
              >
                <h2 id="oz" style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 800 }}>
                  Sipariş özeti
                </h2>
                {secili.map((u) => (
                  <div
                    key={u.key}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 10,
                      padding: '8px 0',
                      borderBottom: '1px solid #EEF0F5',
                      fontSize: 14,
                    }}
                  >
                    <span>
                      {u.ad}
                      {u.oneCikarma && hedefBaslik ? ` · ${hedefBaslik}` : ''}
                    </span>
                    <strong style={{ flex: 'none' }}>{tlYaz(u.kurus)}</strong>
                  </div>
                ))}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: 10,
                    fontSize: 13.5,
                    color: '#5A6073',
                  }}
                >
                  <span>KDV (%20, dahil)</span>
                  <span>{tlYaz(vatOfGross(toplam))}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: 6,
                    fontSize: 17,
                    fontWeight: 800,
                  }}
                >
                  <span>Toplam</span>
                  <span>{tlYaz(toplam)}</span>
                </div>
                <p style={{ margin: '12px 0 0', fontSize: 12.5, lineHeight: 1.5, color: '#3A4052' }}>
                  {hemen
                    ? 'Ek talep ve mesaj hakları kullanılmadıysa 14 gün içinde iade edilebilir. Öne çıkarma ve uzatma satın alındığı anda başlar.'
                    : 'Ek talep ve mesaj hakları kullanılmadıysa 14 gün içinde iade edilebilir; hakların süresi dolmaz.'}
                </p>
                {siparis ? (
                  <p style={{ margin: '14px 0 0', fontSize: 13.5, fontWeight: 700, color: '#2450C8' }}>
                    Kart bilgilerini soldaki ödeme çerçevesine gir. Ödeme onaylanınca bu sayfa kendiliğinden
                    ilerler.
                  </p>
                ) : odeHazir ? (
                  <button
                    type="button"
                    disabled={mesgul}
                    onClick={ode}
                    style={{
                      width: '100%',
                      marginTop: 14,
                      border: 0,
                      background: '#3DD68C',
                      borderRadius: 12,
                      padding: 13,
                      fontSize: 15,
                      fontWeight: 800,
                      color: '#1E2333',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {mesgul ? 'Hazırlanıyor…' : `Siparişi onayla ve öde · ${tlYaz(toplam)}`}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled
                      style={{
                        width: '100%',
                        marginTop: 14,
                        border: 0,
                        background: '#E3E6EF',
                        borderRadius: 12,
                        padding: 13,
                        fontSize: 15,
                        fontWeight: 800,
                        color: '#6B7183',
                        fontFamily: 'inherit',
                      }}
                    >
                      Siparişi onayla ve öde · {tlYaz(toplam)}
                    </button>
                    <p style={{ margin: '8px 0 0', fontSize: 12.5, color: '#5A6073' }}>
                      {!fatura.ad || !fatura.eposta || !fatura.il || !fatura.ilce
                        ? 'Fatura bilgilerini doldur.'
                        : hemen
                          ? 'Devam etmek için iki onayı da işaretle.'
                          : 'Devam etmek için sözleşme onayını işaretle.'}
                    </p>
                  </>
                )}
              </aside>
            </div>
          </>
        ) : null}

        {adim === 'tamam' ? (
          <section
            aria-labelledby="ok"
            style={{
              ...kart,
              borderRadius: 22,
              maxWidth: 560,
              margin: '40px auto',
              padding: 32,
              textAlign: 'center',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: 'inline-flex',
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: '#E7FAF0',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                aria-hidden="true"
                width="30"
                height="30"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#11683F"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12l5 5 9-10" />
              </svg>
            </span>
            <h1 id="ok" style={{ margin: '14px 0 6px', fontSize: 24, fontWeight: 800 }}>
              Ödeme alındı
            </h1>
            <p style={{ margin: 0, fontSize: 15, color: '#3A4052' }}>
              {tlYaz(siparis?.toplamKurus ?? toplam)} tutarındaki ödemen tamamlandı. Haklar hesabına
              tanımlandı, faturan hazırlanınca ödeme geçmişinden indirebilirsin.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 22 }}>
              <Link
                href="/taleplerim"
                style={{
                  background: '#5B8CFF',
                  borderRadius: 12,
                  padding: '12px 18px',
                  fontSize: 14.5,
                  fontWeight: 800,
                  color: '#1E2333',
                  textDecoration: 'none',
                }}
              >
                Taleplerime git
              </Link>
              <button
                type="button"
                onClick={() => {
                  setSepet([]);
                  setOnay({ sozlesme: false, cayma: false });
                  setSiparis(null);
                  setAdim('magaza');
                  window.history.replaceState(null, '', '/haklarim');
                }}
                style={{
                  border: '1px solid #D5DAE5',
                  background: '#FFFFFF',
                  borderRadius: 12,
                  padding: '12px 18px',
                  fontSize: 14.5,
                  fontWeight: 700,
                  color: '#1E2333',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Haklarıma dön
              </button>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
