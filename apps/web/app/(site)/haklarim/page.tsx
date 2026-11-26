'use client';

import { CONTRACT_CONSENT, ILLER, tlYaz, vatOfGross, WAIVER_CONSENT } from '@rengarenk/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { HesabimMenu } from '../../../components/hesabim-menu';
import { cx } from '../../../lib/cx';
import { API, erisim, istek, useGiris } from '../../../lib/istemci';
import { olcumOlayi } from '../../../lib/olcum';
import stil from './page.module.css';

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

const kart: CSSProperties = {
  background: 'var(--rr-kart, #FFFFFF)',
  border: '1px solid var(--rr-cizgi, #E3E6EF)',
  borderRadius: 'var(--rr-kart-kose)',
};
const RENK = [
  'var(--rr-mavi, #5B8CFF)',
  'var(--rr-pembe, #FF6FB5)',
  'var(--rr-sari, #FFC84A)',
  'var(--rr-yesil, #3DD68C)',
];
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
  // Kupon (Karar 51): fiyatlar ve indirim sunucuda hesaplanır
  const [kuponKod, setKuponKod] = useState('');
  const [kupon, setKupon] = useState<{ kod: string; indirimKurus: number; toplamKurus: number } | null>(null);
  const [kuponHata, setKuponHata] = useState<string | null>(null);

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
        olcumOlayi('Purchase', no, s.toplamKurus);
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
        olcumOlayi('Purchase', siparis.no, siparis.toplamKurus);
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
  const odenecek = kupon?.toplamKurus ?? toplam;
  const sepetAnahtari = sepet.join(',');
  // Sepet değişince kupon yeniden uygulanmalı
  useEffect(() => {
    if (sepetAnahtari !== undefined) setKupon(null);
  }, [sepetAnahtari]);

  async function kuponUygula() {
    setKuponHata(null);
    try {
      const r = await istek<{ kod: string; indirimKurus: number; toplamKurus: number }>('/orders/kupon', {
        method: 'POST',
        body: { kod: kuponKod, urunler: secili.map((u) => u.key) },
      });
      setKupon(r);
    } catch (e) {
      setKupon(null);
      setKuponHata((e as Error).message);
    }
  }

  async function ode() {
    setHata(null);
    setMesgul(true);
    try {
      const r = await istek<{ no: string; odemeAdresi: string; toplamKurus: number }>('/orders', {
        method: 'POST',
        body: {
          kalemler: secili.map((u) => (u.oneCikarma ? { urun: u.key, talepNo: hedef } : { urun: u.key })),
          fatura: { ...fatura, ...(kurumsal ? { kurumsal } : {}) },
          ...(kupon ? { kupon: kupon.kod } : {}),
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
    <div className={`rr-sayfa ${stil.kutu1}`}>
      <HesabimMenu aktif="/haklarim" />
      <main className={stil.kutu2}>
        {hata ? (
          <p role="alert" className={stil.metin1}>
            {hata}
          </p>
        ) : null}

        {adim === 'magaza' ? (
          <>
            <h1 className={stil.baslik1}>Haklarım ve ödemeler</h1>
            <div className={`rr-dort-sutun ${stil.kutu3}`}>
              {kartlar.map((h, i) => (
                <div
                  key={h.ad}
                  style={{
                    ...kart,
                    borderRadius: 'calc(var(--rr-kart-kose) * 16 / 18)',
                    padding: 16,
                    borderTop: `4px solid ${RENK[i]}`,
                  }}
                >
                  <div className={stil.kutu4}>{h.ad}</div>
                  <div className={stil.kutu5}>{h.deger}</div>
                  <div className={stil.kutu6}>{h.not}</div>
                </div>
              ))}
            </div>
            {o?.aktifOneCikarma.length ? (
              <div className={stil.kutu7}>
                <span className={stil.metin2}>Aktif öne çıkarma</span>
                {o.aktifOneCikarma.map((a) => (
                  <span key={`${a.tur}-${a.talep.no}`} className={stil.metin3}>
                    <span className={stil.metin4}>{a.ad}</span>
                    <span className={stil.metin5}>
                      {a.talep.baslik} · {kalanGun(a.bitis)} gün kaldı
                    </span>
                  </span>
                ))}
              </div>
            ) : null}
            {o && !o.odeme.acik ? (
              <p className={stil.metin6}>
                {o.odeme.not ?? 'Ödemeler şu an kapalı.'} Hakların kullanılmaya devam eder.
              </p>
            ) : null}

            <div className={stil.kutu8}>
              <section className={stil.kutu9} aria-labelledby="mg">
                <h2 id="mg" className={stil.baslik2}>
                  Hak ve öne çıkarma satın al
                </h2>
                {(['talep', 'mesaj', 'one_cikarma'] as const).map((g) => {
                  const liste = urunler.filter((u) => u.grup === g);
                  if (!liste.length) return null;
                  const oneCikarma = g === 'one_cikarma';
                  return (
                    <div key={g} className={stil.kutu10}>
                      <h3 className={stil.baslik3}>
                        {oneCikarma ? (
                          <>
                            Öne çıkarma ·{' '}
                            {/* Seçim ve "talebi için" birlikte satır değiştirir; telefonda ayrı satırlara bölünmez */}
                            <span className={stil.metin7}>
                              {o && o.talepler.length > 1 ? (
                                <select
                                  aria-label="Öne çıkarılacak talep"
                                  value={hedef ?? ''}
                                  onChange={(e) => setHedef(Number(e.target.value))}
                                  className={stil.girdi1}
                                >
                                  {o.talepler.map((t) => (
                                    <option key={t.no} value={t.no}>
                                      {t.baslik}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span>{hedefBaslik ?? 'yayında talebin yok'}</span>
                              )}
                              {hedefBaslik ? <span className={stil.metin8}>talebi için</span> : null}
                            </span>
                          </>
                        ) : (
                          liste[0]?.grupAd
                        )}
                      </h3>
                      {liste.map((u) => {
                        const on = sepet.includes(u.key);
                        const pasif = !o?.odeme.acik || (oneCikarma && !hedef);
                        return (
                          <div key={u.key} className={stil.kutu11}>
                            <span className={stil.metin9}>
                              <span className={stil.metin10}>{u.ad}</span>
                              <span className={stil.metin11}>{u.not}</span>
                            </span>
                            <span className={stil.metin12}>{tlYaz(u.kurus)}</span>
                            <button
                              type="button"
                              aria-pressed={on}
                              disabled={pasif && !on}
                              onClick={() =>
                                setSepet((s) => (on ? s.filter((k) => k !== u.key) : [...s, u.key]))
                              }
                              className={cx(
                                stil.dugme1,
                                on ? stil.dugme2 : stil.dugme3,
                                pasif && !on ? stil.dugme4 : stil.dugme5,
                              )}
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

              <aside aria-labelledby="sp" className={stil.kutu12}>
                <h2 id="sp" className={stil.baslik4}>
                  Sepet
                </h2>
                {!secili.length ? (
                  <p className={stil.metin13}>Sepetin boş. Listeden bir hak veya öne çıkarma seç.</p>
                ) : (
                  <>
                    {secili.map((u) => (
                      <div key={u.key} className={stil.kutu13}>
                        <span>{u.ad}</span>
                        <strong className={stil.metin14}>{tlYaz(u.kurus)}</strong>
                      </div>
                    ))}
                    <div className={stil.kutu14}>
                      <span>Toplam</span>
                      <span>{tlYaz(toplam)}</span>
                    </div>
                    <p className={stil.metin15}>KDV dahil · e-arşiv fatura e-postana gönderilir</p>
                    <button
                      type="button"
                      onClick={() => {
                        setHata(null);
                        setAdim('odeme');
                      }}
                      className={stil.dugme6}
                    >
                      Ödemeye geç
                    </button>
                  </>
                )}
              </aside>
            </div>

            <section className={stil.kutu15} aria-labelledby="fg">
              <h2 id="fg" className={stil.baslik5}>
                Ödeme geçmişi
              </h2>
              {o && !o.gecmis.length ? <p className={stil.metin16}>Henüz ödemen yok.</p> : null}
              {(o?.gecmis ?? []).map((g) => (
                <div key={g.id} className={stil.kutu16}>
                  <span className={stil.metin17}>{tarih(g.tarih)}</span>
                  <span className={stil.metin18}>{g.kalem}</span>
                  <span className={stil.metin19}>
                    {tlYaz(g.tutarKurus)}
                    {g.iadeKurus ? <span className={stil.metin20}>İade: {tlYaz(g.iadeKurus)}</span> : null}
                  </span>
                  {g.fatura ? (
                    <button type="button" onClick={() => faturaIndir(g.id)} className={stil.dugme7}>
                      Faturayı indir
                    </button>
                  ) : (
                    <span className={stil.metin21}>Fatura hazırlanıyor</span>
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
              className={stil.dugme8}
            >
              ← Sepete dön
            </button>
            <h1 className={stil.baslik6}>Ödeme</h1>
            <div className={stil.kutu17}>
              <div className={stil.kutu18}>
                <section className={stil.kutu19} aria-labelledby="fb">
                  <h2 id="fb" className={stil.baslik4}>
                    Fatura bilgileri
                  </h2>
                  <fieldset disabled={!!siparis} className={stil.kutu20}>
                    <div className={`rr-iki-sutun ${stil.kutu3}`}>
                      <label className={stil.etiket1}>
                        Ad soyad
                        <input
                          value={fatura.ad}
                          onChange={(e) => setFatura({ ...fatura, ad: e.target.value })}
                          className={stil.girdi2}
                        />
                      </label>
                      <label className={stil.etiket1}>
                        Fatura e-postası
                        <input
                          type="email"
                          value={fatura.eposta}
                          onChange={(e) => setFatura({ ...fatura, eposta: e.target.value })}
                          className={stil.girdi2}
                        />
                      </label>
                      <label className={stil.etiket1}>
                        İl
                        <select
                          value={fatura.il}
                          onChange={(e) => setFatura({ ...fatura, il: e.target.value, ilce: '' })}
                          className={stil.girdi2}
                        >
                          <option value="">Seç</option>
                          {ILLER.map((i) => (
                            <option key={i.ad} value={i.ad}>
                              {i.ad}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={stil.etiket1}>
                        İlçe
                        <select
                          value={fatura.ilce}
                          onChange={(e) => setFatura({ ...fatura, ilce: e.target.value })}
                          className={stil.girdi2}
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
                      <div className={`rr-uc-sutun ${stil.kutu21}`}>
                        <label className={stil.etiket1}>
                          Ticari unvan
                          <input
                            value={kurumsal.unvan}
                            onChange={(e) => setKurumsal({ ...kurumsal, unvan: e.target.value })}
                            className={stil.girdi2}
                          />
                        </label>
                        <label className={stil.etiket1}>
                          Vergi no
                          <input
                            inputMode="numeric"
                            value={kurumsal.vergiNo}
                            onChange={(e) =>
                              setKurumsal({ ...kurumsal, vergiNo: e.target.value.replace(/\D/g, '') })
                            }
                            className={stil.girdi2}
                          />
                        </label>
                        <label className={stil.etiket1}>
                          Vergi dairesi
                          <input
                            value={kurumsal.vergiDairesi}
                            onChange={(e) => setKurumsal({ ...kurumsal, vergiDairesi: e.target.value })}
                            className={stil.girdi2}
                          />
                        </label>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() =>
                        setKurumsal(kurumsal ? null : { unvan: '', vergiNo: '', vergiDairesi: '' })
                      }
                      className={stil.dugme9}
                    >
                      {kurumsal ? 'Bireysel fatura istiyorum' : 'Kurumsal fatura istiyorum (vergi no ile)'}
                    </button>
                  </fieldset>
                </section>

                <section className={stil.kutu19} aria-labelledby="kb">
                  <div className={stil.kutu22}>
                    <h2 id="kb" className={stil.baslik7}>
                      Kart bilgileri
                    </h2>
                    <span className={stil.metin22}>PayTR güvenli ödeme · 3D Secure</span>
                  </div>
                  {siparis?.odemeAdresi ? (
                    <iframe
                      title="PayTR ödeme çerçevesi"
                      src={siparis.odemeAdresi}
                      className={stil.gorsel1}
                    />
                  ) : (
                    <div className={stil.kutu23}>
                      <div className={stil.kutu24}>
                        Bu alan PayTR’nin ödeme çerçevesidir; siparişi onaylayınca açılır
                      </div>
                      <div className={`rr-iki-sutun ${stil.kutu25}`}>
                        {['Kart üzerindeki isim', 'Kart numarası', 'AA / YY', 'CVC'].map((x, i) => (
                          <span key={x} className={cx(stil.metin23, i < 2 ? stil.metin24 : undefined)}>
                            {x}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className={stil.metin25}>
                    Kart bilgilerin Rengarenk sunucularına gelmez ve saklanmaz. Tek çekim; bu tutarlarda
                    taksit yok.
                  </p>
                </section>

                <section aria-label="Sözleşmeler" className={stil.kutu26}>
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
                        className={stil.dugme10}
                      >
                        <span
                          className={cx(stil.metin26, on ? stil.metin27 : stil.metin28)}
                          style={{ border: `2px solid ${on ? 'var(--rr-mavi, #5B8CFF)' : '#AEB5C4'}` }}
                        >
                          {on ? '✓' : ''}
                        </span>
                        <span>{c.yazi}</span>
                      </button>
                    );
                  })}
                  <span className={stil.metin29}>
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

              <aside aria-labelledby="oz" className={stil.kutu27}>
                <h2 id="oz" className={stil.baslik4}>
                  Sipariş özeti
                </h2>
                {secili.map((u) => (
                  <div key={u.key} className={stil.kutu13}>
                    <span>
                      {u.ad}
                      {u.oneCikarma && hedefBaslik ? ` · ${hedefBaslik}` : ''}
                    </span>
                    <strong className={stil.metin14}>{tlYaz(u.kurus)}</strong>
                  </div>
                ))}
                {kupon ? (
                  <div className={stil.kutu28}>
                    <span>
                      Kupon {kupon.kod}
                      {siparis ? null : (
                        <button type="button" onClick={() => setKupon(null)} className={stil.dugme11}>
                          Kaldır
                        </button>
                      )}
                    </span>
                    <span>−{tlYaz(kupon.indirimKurus)}</span>
                  </div>
                ) : siparis ? null : (
                  <div className={stil.kutu29}>
                    <div className={stil.kutu30}>
                      <label className={stil.etiket2}>
                        <span className="sr-only">Kupon kodu</span>
                        <input
                          value={kuponKod}
                          maxLength={16}
                          placeholder="Kupon kodu"
                          aria-label="Kupon kodu"
                          onChange={(e) => setKuponKod(e.target.value.toLocaleUpperCase('tr-TR'))}
                          className={stil.girdi3}
                        />
                      </label>
                      <button
                        type="button"
                        disabled={kuponKod.trim().length < 4}
                        onClick={kuponUygula}
                        className={stil.dugme12}
                        style={{ opacity: kuponKod.trim().length < 4 ? 0.5 : 1 }}
                      >
                        Uygula
                      </button>
                    </div>
                    {kuponHata ? (
                      <p role="alert" className={stil.metin30}>
                        {kuponHata}
                      </p>
                    ) : null}
                  </div>
                )}
                <div className={stil.kutu31}>
                  <span>KDV (%20, dahil)</span>
                  <span>{tlYaz(vatOfGross(odenecek))}</span>
                </div>
                <div className={stil.kutu32}>
                  <span>Toplam</span>
                  <span>{tlYaz(odenecek)}</span>
                </div>
                <p className={stil.metin31}>
                  {hemen
                    ? 'Ek talep ve mesaj hakları kullanılmadıysa 14 gün içinde iade edilebilir. Öne çıkarma ve uzatma satın alındığı anda başlar.'
                    : 'Ek talep ve mesaj hakları kullanılmadıysa 14 gün içinde iade edilebilir; hakların süresi dolmaz.'}
                </p>
                {siparis ? (
                  <p className={stil.metin32}>
                    Kart bilgilerini ödeme çerçevesine gir. Ödeme onaylanınca bu sayfa kendiliğinden ilerler.
                  </p>
                ) : odeHazir ? (
                  <button type="button" disabled={mesgul} onClick={ode} className={stil.dugme13}>
                    {mesgul ? 'Hazırlanıyor…' : `Siparişi onayla ve öde · ${tlYaz(odenecek)}`}
                  </button>
                ) : (
                  <>
                    <button type="button" disabled className={stil.dugme14}>
                      Siparişi onayla ve öde · {tlYaz(odenecek)}
                    </button>
                    <p className={stil.metin33}>
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
          <section aria-labelledby="ok" className={stil.kutu33}>
            <span aria-hidden="true" className={stil.metin34}>
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
            <h1 id="ok" className={stil.baslik8}>
              Ödeme alındı
            </h1>
            <p className={stil.metin35}>
              {tlYaz(siparis?.toplamKurus ?? toplam)} tutarındaki ödemen tamamlandı. Haklar hesabına
              tanımlandı, faturan hazırlanınca ödeme geçmişinden indirebilirsin.
            </p>
            <div className={stil.kutu34}>
              <Link href="/taleplerim" className={stil.bag1}>
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
                className={stil.dugme15}
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
