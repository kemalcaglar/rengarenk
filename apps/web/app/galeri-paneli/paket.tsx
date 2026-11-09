'use client';

import { GALLERY_TRIAL, RENEWAL_CONSENT, SUBSCRIPTION_CONSENT, tlYaz, withVat } from '@rengarenk/shared';
import Link from 'next/link';
import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { API, erisim, istek } from '../../lib/istemci';

type Degisim = 'yeni' | 'yukseltme' | 'sonraki_donem' | 'ayni';
interface PaketSecenek {
  key: 'baslangic' | 'profesyonel' | 'kurumsal';
  ad: string;
  aylikKurus: number;
  yillikKurus: number;
  portfoy: number | null;
  gunlukMesaj: number;
  aylikTalep: number;
  oneCikarma: number;
  toplu: boolean;
  eslesme: boolean;
  api: boolean;
  calisan: number;
  degisim: Degisim;
  yukseltmeFarkiKurus: number | null;
}
export interface AbonelikVerisi {
  rol: 'OWNER' | 'MANAGER' | 'SALES';
  paket: { key: string; ad: string; saltOkunur: boolean; denemeBitis: string | null };
  abonelik: {
    plan: PaketSecenek['key'];
    planAd: string;
    donem: 'aylik' | 'yillik';
    donemAd: string;
    durum: 'ACTIVE' | 'PAST_DUE' | 'ENDED';
    durumAd: string;
    netKurus: number;
    brutKurus: number;
    baslangic: string;
    bitis: string;
    iptal: boolean;
    sonraki: { plan: string; planAd: string; donem: string; donemAd: string } | null;
    yenilemeKurus: number;
    kart: string | null;
    basarisizDeneme: number;
    sonrakiDeneme: string | null;
    bitisNedeni: string | null;
  } | null;
  paketler: PaketSecenek[];
  haklar: { talep: number; ustSira: number; ekMesaj: number };
  kullanim: { calisan: number; arac: number };
  ekPaketler: { key: string; ad: string; netKurus: number; brutKurus: number }[];
  faturalar: {
    id: string;
    no: string;
    ad: string;
    tarih: string;
    tutarKurus: number;
    fatura: boolean;
    iadeKurus: number;
  }[];
  eposta: string | null;
  odeme: { acik: boolean; not: string | null };
}

/** Ödeme ekranındaki seçim: paket satın alma ya da geçiş, bekleyen yenileme, ek paket */
type Secim =
  | {
      tur: 'paket';
      plan: PaketSecenek['key'];
      donem: 'aylik' | 'yillik';
      ad: string;
      tutarKurus: number;
      not: string;
    }
  | { tur: 'yenile'; ad: string; tutarKurus: number; not: string }
  | { tur: 'ek'; urun: string; ad: string; tutarKurus: number; not: string };

const kart: CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E3E6EF',
  borderRadius: 18,
  padding: 22,
};
const birincil: CSSProperties = {
  border: 0,
  background: '#5B8CFF',
  borderRadius: 12,
  padding: '12px 18px',
  fontSize: 14.5,
  fontWeight: 800,
  color: '#1E2333',
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const ikincil: CSSProperties = {
  border: '1px solid #D5DAE5',
  background: '#FFFFFF',
  borderRadius: 12,
  padding: '12px 16px',
  fontSize: 14.5,
  fontWeight: 700,
  color: '#1E2333',
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const baglanti: CSSProperties = {
  border: 0,
  background: 'none',
  padding: 0,
  fontSize: 14,
  fontWeight: 700,
  color: '#2450C8',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const tarih = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('tr-TR', {
        timeZone: 'Europe/Istanbul',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(iso))
    : '';
const tl = (kurus: number) => tlYaz(kurus).replace(' TL', '');
/** Ek paket adları (GaleriPanel.dc.html › Ek paket al) */
const EK_AD: Record<string, string> = {
  mesaj_30: '30 ilk mesaj',
  mesaj_10: '10 ilk mesaj',
  talep_paketi: '3 talep hakkı',
  ek_talep: '1 talep hakkı',
  ust_sira_7: 'Üst sıra, 7 gün',
};

function ozellikler(p: PaketSecenek) {
  return [
    `${p.portfoy ?? 'Sınırsız'} araçlık portföy, günde ${p.gunlukMesaj} ilk mesaj, ayda ${p.aylikTalep} talep`,
    p.toplu
      ? 'Excel/CSV toplu yükleme ve otomatik eşleşme'
      : 'Manuel portföy (toplu yükleme ve otomatik eşleşme yok)',
    p.oneCikarma ? `Ayda ${p.oneCikarma} öne çıkarma hakkı` : 'Öne çıkarma hakkı yok',
    `${p.calisan} çalışan kullanıcı${p.api ? ' · API entegrasyonu' : ''}`,
  ];
}

/**
 * Galeri paneli › Paket ve faturalar (GaleriPanel.dc.html; Karar 12.2, 12.4, 12.7, 39). Paket yalnızca web'den, yalnızca
 * galeri sahibi tarafından alınır; kart PayTR'de saklanır ve dönem sonunda kendiliğinden yenilenir. Üst pakete geçiş
 * hemen (kalan sürenin farkı), alt paket ve aylık/yıllık değişikliği sonraki dönemde; iptal dönem sonunda geçerli.
 */
export function Paket({ accountId, onDegisti }: { accountId: string; onDegisti: () => void }) {
  const [v, setV] = useState<AbonelikVerisi | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [secim, setSecim] = useState<Secim | null>(null);
  const [eposta, setEposta] = useState('');
  const [onay, setOnay] = useState({ sozlesme: false, yenileme: false });
  const [siparis, setSiparis] = useState<{ no: string; odemeAdresi: string } | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const [paketler, setPaketlerAcik] = useState(false);
  // Kupon (Karar 51): yeni pakette ilk ödemeye ve ek paketlere; yenilemede yok
  const [kuponKod, setKuponKod] = useState('');
  const [kupon, setKupon] = useState<{ kod: string; indirimKurus: number; toplamKurus: number } | null>(null);
  const [kuponHata, setKuponHata] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    const x = await istek<AbonelikVerisi>(`/gallery/${accountId}/subscription`);
    setV(x);
    setEposta((e) => e || x.eposta || '');
    return x;
  }, [accountId]);

  useEffect(() => {
    yukle().catch((e: Error) => setHata(e.message));
  }, [yukle]);

  // Ödeme sonucundan dönüş (?siparis=)
  useEffect(() => {
    const no = new URLSearchParams(window.location.search).get('siparis');
    if (!no) return;
    istek<{ durum: string }>(`/orders/${no}`)
      .then((s) => {
        if (s.durum === 'PAID') setBilgi('Ödemen alındı. Teşekkürler!');
      })
      .catch(() => undefined);
  }, []);

  // Ödeme çerçevesi açıkken sipariş durumu izlenir
  useEffect(() => {
    if (!siparis) return;
    const t = setInterval(async () => {
      const s = await istek<{ durum: string; neden: string | null }>(`/orders/${siparis.no}`).catch(
        () => null,
      );
      if (s?.durum === 'PAID') {
        setSiparis(null);
        setSecim(null);
        setBilgi('Ödemen alındı. Paketin ve hakların güncellendi.');
        await yukle().catch(() => undefined);
        onDegisti();
      } else if (s?.durum === 'FAILED' || s?.durum === 'CANCELLED') {
        setSiparis(null);
        setHata(s.neden ?? 'Ödeme alınamadı');
      }
    }, 2500);
    return () => clearInterval(t);
  }, [siparis, yukle, onDegisti]);

  async function calistir<T>(fn: () => Promise<T>, mesaj?: string) {
    setHata(null);
    setMesgul(true);
    try {
      const r = await fn();
      if (mesaj) setBilgi(mesaj);
      return r;
    } catch (e) {
      setHata((e as Error).message);
      return null;
    } finally {
      setMesgul(false);
    }
  }

  async function kuponUygula() {
    if (!secim || secim.tur === 'yenile') return;
    setKuponHata(null);
    try {
      setKupon(
        await istek<{ kod: string; indirimKurus: number; toplamKurus: number }>('/orders/kupon', {
          method: 'POST',
          body:
            secim.tur === 'paket'
              ? {
                  kod: kuponKod,
                  urunler: ['abonelik'],
                  hesap: accountId,
                  plan: secim.plan,
                  donem: secim.donem,
                }
              : { kod: kuponKod, urunler: [secim.urun], hesap: accountId },
        }),
      );
    } catch (e) {
      setKupon(null);
      setKuponHata((e as Error).message);
    }
  }

  function sec(s: Secim) {
    setSecim(s);
    setKupon(null);
    setKuponHata(null);
    setOnay({ sozlesme: false, yenileme: false });
    setSiparis(null);
    setHata(null);
    setTimeout(() => document.getElementById('odeme')?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  async function ode() {
    if (!secim) return;
    const r = await calistir(() =>
      secim.tur === 'ek'
        ? istek<{ no: string; odemeAdresi: string }>('/orders', {
            method: 'POST',
            body: {
              hesap: accountId,
              kalemler: [{ urun: secim.urun }],
              // Fatura galerinin ticari bilgileriyle kesilir; burada yalnızca e-posta kullanılır
              fatura: { ad: 'Galeri hesabı', eposta, il: 'İstanbul', ilce: 'Kadıköy' },
              ...(kupon ? { kupon: kupon.kod } : {}),
              onay: { sozlesme: true },
            },
          })
        : istek<{ no: string; odemeAdresi: string }>(
            `/gallery/${accountId}/subscription/${secim.tur === 'yenile' ? 'pay' : 'checkout'}`,
            {
              method: 'POST',
              body:
                secim.tur === 'yenile'
                  ? { eposta, onay: { sozlesme: true, yenileme: true } }
                  : {
                      plan: secim.plan,
                      donem: secim.donem,
                      eposta,
                      ...(kupon ? { kupon: kupon.kod } : {}),
                      onay: { sozlesme: true, yenileme: true },
                    },
            },
          ),
    );
    if (r) setSiparis(r);
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

  if (!v) {
    return (
      <>
        <h1 style={{ margin: '0 0 18px', fontSize: 26, fontWeight: 800 }}>Paket ve faturalar</h1>
        {hata ? <p role="alert">{hata}</p> : <p style={{ color: '#5A6073' }}>Yükleniyor…</p>}
      </>
    );
  }

  const sahip = v.rol === 'OWNER';
  const a = v.abonelik && v.abonelik.durum !== 'ENDED' ? v.abonelik : null;
  const mevcut = a ? v.paketler.find((p) => p.key === a.plan) : null;
  const ust = a ? v.paketler.find((p) => p.degisim === 'yukseltme') : null;
  const acik = v.odeme.acik;
  const ekSecim = (e: AbonelikVerisi['ekPaketler'][number]) =>
    sec({
      tur: 'ek',
      urun: e.key,
      ad: e.ad,
      tutarKurus: e.brutKurus,
      not: `${tl(e.netKurus)} TL + KDV. Haklar galeri hesabının ortak havuzuna eklenir, süresi dolmaz${e.key === 'ust_sira_7' ? '; Taleplerim’den galerinin talebine uygulanır' : ''}.`,
    });
  const paketSecim = (p: PaketSecenek, donem: 'aylik' | 'yillik') => {
    if (p.degisim === 'yukseltme' && a) {
      sec({
        tur: 'paket',
        plan: p.key,
        donem: a.donem,
        ad: `${p.ad} pakete geçiş`,
        tutarKurus: p.yukseltmeFarkiKurus ?? 0,
        not: `Paket hemen değişir; ${tarih(a.bitis)} tarihine kadar kalan sürenin farkını ödersin. Bu ayın hak farkı hemen eklenir. Yenilemede ${p.ad} fiyatı uygulanır.`,
      });
      return;
    }
    const net = donem === 'aylik' ? p.aylikKurus : p.yillikKurus;
    sec({
      tur: 'paket',
      plan: p.key,
      donem,
      ad: `${p.ad} paket · ${donem === 'aylik' ? 'Aylık' : 'Yıllık'}`,
      tutarKurus: withVat(net),
      not: `${tl(net)} TL + KDV. Paket hemen başlar; dönem sonunda kayıtlı kartından kendiliğinden yenilenir.`,
    });
  };
  async function sonrakiDonem(plan: string, donem: string, mesaj: string) {
    const r = await calistir(
      () =>
        istek<AbonelikVerisi>(`/gallery/${accountId}/subscription/next`, {
          method: 'PATCH',
          body: { plan, donem },
        }),
      mesaj,
    );
    if (r) setV(r);
  }
  async function iptal(deger: boolean) {
    const r = await calistir(
      () =>
        istek<AbonelikVerisi>(`/gallery/${accountId}/subscription/cancel`, {
          method: 'POST',
          body: { iptal: deger },
        }),
      deger ? 'Aboneliğin dönem sonunda bitecek.' : 'İptal geri alındı; aboneliğin yenilenecek.',
    );
    if (r) setV(r);
  }

  return (
    <>
      <h1 style={{ margin: '0 0 18px', fontSize: 26, fontWeight: 800 }}>Paket ve faturalar</h1>
      {bilgi ? (
        <p
          role="status"
          style={{
            margin: '0 0 14px',
            background: '#E7FAF0',
            color: '#11683F',
            borderRadius: 12,
            padding: '10px 14px',
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          {bilgi}
        </p>
      ) : null}
      {hata ? (
        <p
          role="alert"
          style={{
            margin: '0 0 14px',
            background: '#FDECEC',
            color: '#A3271F',
            borderRadius: 12,
            padding: '10px 14px',
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          {hata}
        </p>
      ) : null}
      {a?.durum === 'PAST_DUE' ? (
        <div
          role="alert"
          style={{
            margin: '0 0 14px',
            background: '#FDECEC',
            color: '#A3271F',
            borderRadius: 12,
            padding: '12px 14px',
            fontSize: 14,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>
            <strong>Yenileme ödemesi alınamadı.</strong>{' '}
            {a.sonrakiDeneme
              ? `Kayıtlı kartın ${tarih(a.sonrakiDeneme)} tarihinde yeniden denenecek; ödeme alınamazsa paket askıya alınır.`
              : 'Ödeme alınamazsa paket askıya alınır.'}
          </span>
          {sahip && acik ? (
            <button
              type="button"
              style={{ ...birincil, background: '#FF8A5B' }}
              onClick={() =>
                sec({
                  tur: 'yenile',
                  ad: `${a.sonraki?.planAd ?? a.planAd} paket · ${a.sonraki?.donemAd ?? a.donemAd} yenileme`,
                  tutarKurus: a.yenilemeKurus,
                  not: 'Yeni kartını kaydedip şimdi ödersin; dönem eski bitiş tarihinden başlar.',
                })
              }
            >
              Kartı güncelle ve öde
            </button>
          ) : null}
        </div>
      ) : null}
      {v.paket.saltOkunur ? (
        <p
          role="alert"
          style={{
            margin: '0 0 14px',
            background: '#FFF6DF',
            borderRadius: 12,
            padding: '10px 14px',
            fontSize: 14,
            color: '#7A5300',
            fontWeight: 600,
          }}
        >
          {v.paket.key === 'deneme' ? 'Deneme süren bitti.' : 'Paketin sona erdi.'} Paket seçene kadar
          yalnızca portföyünü görüntüleyebilirsin.
        </p>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <section
          aria-labelledby="pk"
          style={{ ...kart, flex: '2 1 380px', minWidth: 0, border: '2px solid #5B8CFF' }}
        >
          <span style={{ fontSize: 12.5, fontWeight: 800, color: '#2450C8' }}>Mevcut paket</span>
          {a && mevcut ? (
            <>
              <h2 id="pk" style={{ margin: '4px 0 2px', fontSize: 24, fontWeight: 800 }}>
                {a.planAd}
              </h2>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                {tl(a.netKurus)} TL / {a.donem === 'aylik' ? 'ay' : 'yıl'}{' '}
                <span style={{ fontSize: 13, color: '#5A6073', fontWeight: 500 }}>
                  KDV hariç ·{' '}
                  {a.iptal
                    ? `${tarih(a.bitis)} tarihinde bitecek`
                    : `Yenileme ${tarih(a.bitis)} · PayTR ile otomatik`}
                </span>
              </p>
              <ul
                style={{
                  margin: '14px 0 0',
                  paddingLeft: 18,
                  fontSize: 14,
                  lineHeight: 1.7,
                  color: '#3A4052',
                }}
              >
                {ozellikler(mevcut)
                  .slice(0, 3)
                  .map((x) => (
                    <li key={x}>{x}</li>
                  ))}
              </ul>
              <p style={{ margin: '12px 0 0', fontSize: 13, color: '#5A6073' }}>
                Bu ay kalan: {v.haklar.talep} talep hakkı · {v.haklar.ustSira} öne çıkarma ·{' '}
                {v.haklar.ekMesaj} ek ilk mesaj{a.kart ? ` · Kart: ${a.kart}` : ''}
                {a.sonraki ? (
                  <>
                    {' '}
                    · Sonraki dönem:{' '}
                    <strong>
                      {a.sonraki.planAd} · {a.sonraki.donemAd}
                    </strong>
                  </>
                ) : null}
              </p>
              {sahip ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
                  {ust && acik && a.durum === 'ACTIVE' ? (
                    <button type="button" style={birincil} onClick={() => paketSecim(ust, a.donem)}>
                      {ust.ad} pakete geç
                    </button>
                  ) : null}
                  {a.donem === 'aylik' && a.sonraki?.donem !== 'yillik' ? (
                    <button
                      type="button"
                      style={ikincil}
                      disabled={mesgul}
                      onClick={() =>
                        sonrakiDonem(
                          a.sonraki?.plan ?? a.plan,
                          'yillik',
                          `${tarih(a.bitis)} yenilemesinde yıllık ödemeye geçilecek.`,
                        )
                      }
                    >
                      Yıllık ödemeye geç (2 ay ücretsiz)
                    </button>
                  ) : null}
                  {a.sonraki ? (
                    <button
                      type="button"
                      style={ikincil}
                      disabled={mesgul}
                      onClick={() => sonrakiDonem(a.plan, a.donem, 'Sonraki dönem değişikliği geri alındı.')}
                    >
                      Değişikliği geri al
                    </button>
                  ) : null}
                </div>
              ) : null}
              {sahip ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 14 }}>
                  <button type="button" style={baglanti} onClick={() => setPaketlerAcik((x) => !x)}>
                    {paketler ? 'Paketleri gizle' : 'Paketleri karşılaştır'}
                  </button>
                  <button
                    type="button"
                    style={{ ...baglanti, color: '#A3271F' }}
                    onClick={() => iptal(!a.iptal)}
                  >
                    {a.iptal ? 'İptali geri al' : 'Aboneliği iptal et'}
                  </button>
                </div>
              ) : null}
              {a.iptal ? (
                <p style={{ margin: '10px 0 0', fontSize: 13, color: '#7A5300' }}>
                  İptal ettin: paketin {tarih(a.bitis)} tarihine kadar açık kalır, sonra yenilenmez. Kalan
                  süre için iade yapılmaz.
                </p>
              ) : null}
            </>
          ) : (
            <>
              <h2 id="pk" style={{ margin: '4px 0 2px', fontSize: 24, fontWeight: 800 }}>
                {v.paket.key === 'deneme' ? 'Ücretsiz deneme' : 'Paket yok'}
              </h2>
              {v.paket.key === 'deneme' && !v.paket.saltOkunur ? (
                <ul
                  style={{
                    margin: '8px 0 10px',
                    paddingLeft: 18,
                    fontSize: 14,
                    lineHeight: 1.7,
                    color: '#3A4052',
                  }}
                >
                  <li>
                    Profesyonel paketin özellikleri: {GALLERY_TRIAL.portfoy} araçlık portföy, günde{' '}
                    {GALLERY_TRIAL.gunlukMesaj} ilk mesaj, {GALLERY_TRIAL.talep} talep hakkı
                  </li>
                  <li>Excel/CSV toplu yükleme ve otomatik eşleşme</li>
                  <li>Öne çıkarma ve API denemede yok</li>
                </ul>
              ) : null}
              <p style={{ margin: 0, fontSize: 14, color: '#5A6073' }}>
                {v.paket.key === 'deneme'
                  ? `Deneme ${tarih(v.paket.denemeBitis)} tarihinde biter; kart istenmez, kendiliğinden ücretli pakete geçmez. Paket seçince deneme biter ve paket hemen başlar.`
                  : v.abonelik?.bitisNedeni === 'odeme_alinamadi'
                    ? 'Yenileme ödemesi alınamadığı için paketin askıya alındı. Paket seçince hemen açılır.'
                    : 'Paketin sona erdi. Paket seçince hemen açılır.'}
              </p>
            </>
          )}
        </section>

        <section aria-labelledby="ek" style={{ ...kart, flex: '1 1 260px', minWidth: 0 }}>
          <h2 id="ek" style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 800 }}>
            Ek paket al
          </h2>
          <p style={{ margin: '0 0 14px', fontSize: 13.5, color: '#5A6073' }}>
            Limit dolduğunda ay sonunu beklemeden ek hak alabilirsin.
          </p>
          {v.ekPaketler.map((e) => (
            <div
              key={e.key}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                padding: '10px 0',
                borderTop: '1px solid #EEF0F5',
                fontSize: 14,
              }}
            >
              <span>{EK_AD[e.key] ?? e.ad}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <strong>
                  {tl(e.netKurus)} TL{' '}
                  <span style={{ fontSize: 12, color: '#5A6073', fontWeight: 600 }}>+ KDV</span>
                </strong>
                {sahip && acik && !v.paket.saltOkunur ? (
                  <button type="button" style={baglanti} onClick={() => ekSecim(e)}>
                    Al
                  </button>
                ) : null}
              </span>
            </div>
          ))}
          <p style={{ margin: '8px 0 0', fontSize: 12.5, color: '#5A6073' }}>
            Üst sıra hak olarak eklenir; Taleplerim'den galerinin talebine uygulanır.
          </p>
        </section>
      </div>

      {sahip && (!a || paketler) ? (
        <section aria-labelledby="pl" style={{ ...kart, marginTop: 16 }}>
          <h2 id="pl" style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800 }}>
            {a ? 'Paketler' : 'Paket seç'}
          </h2>
          <p style={{ margin: '0 0 14px', fontSize: 13.5, color: '#5A6073' }}>
            Fiyatlar KDV hariç; yıllık ödemede 2 ay ücretsiz. Üst pakete hemen geçilir (kalan sürenin farkı);
            alt pakete sonraki dönemde.
          </p>
          {!acik ? (
            <p style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#7A5300' }}>
              {v.odeme.not ?? 'Ödemeler şu an kapalı'}
            </p>
          ) : null}
          <div className="rr-uc-sutun">
            {v.paketler.map((p) => (
              <div
                key={p.key}
                style={{
                  border: p.degisim === 'ayni' ? '2px solid #5B8CFF' : '1px solid #E3E6EF',
                  borderRadius: 16,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <strong style={{ fontSize: 17 }}>{p.ad}</strong>
                <span style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>
                  {tl(p.aylikKurus)} TL / ay
                  <span style={{ display: 'block', fontSize: 12.5, color: '#5A6073', fontWeight: 600 }}>
                    yıllık {tl(p.yillikKurus)} TL
                  </span>
                </span>
                <ul
                  style={{ margin: '10px 0 12px', paddingLeft: 18, fontSize: 13, lineHeight: 1.6, flex: 1 }}
                >
                  {ozellikler(p).map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
                {p.degisim !== 'ayni' &&
                (v.kullanim.calisan > p.calisan || (p.portfoy !== null && v.kullanim.arac > p.portfoy)) ? (
                  <p style={{ margin: '0 0 10px', fontSize: 12.5, color: '#7A5300', fontWeight: 600 }}>
                    {v.kullanim.calisan > p.calisan
                      ? `Ekibinde ${v.kullanim.calisan} kullanıcı var; bu pakette en çok ${p.calisan}. `
                      : ''}
                    {p.portfoy !== null && v.kullanim.arac > p.portfoy
                      ? `Portföyünde ${v.kullanim.arac} araç var; bu pakette en çok ${p.portfoy}. `
                      : ''}
                    Fazlası silinmez, ama yenisi eklenemez.
                  </p>
                ) : null}
                {p.degisim === 'ayni' ? (
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: '#2450C8' }}>Mevcut paketin</span>
                ) : p.degisim === 'yeni' ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <button
                      type="button"
                      style={{ ...birincil, padding: '10px 12px', fontSize: 13.5 }}
                      disabled={!acik}
                      onClick={() => paketSecim(p, 'aylik')}
                    >
                      Aylık al
                    </button>
                    <button
                      type="button"
                      style={{ ...ikincil, padding: '10px 12px', fontSize: 13.5 }}
                      disabled={!acik}
                      onClick={() => paketSecim(p, 'yillik')}
                    >
                      Yıllık al
                    </button>
                  </div>
                ) : p.degisim === 'yukseltme' ? (
                  <button
                    type="button"
                    style={{ ...birincil, padding: '10px 12px', fontSize: 13.5 }}
                    disabled={!acik || a?.durum !== 'ACTIVE'}
                    onClick={() => paketSecim(p, a?.donem ?? 'aylik')}
                  >
                    Hemen geç · {tl(p.yukseltmeFarkiKurus ?? 0)} TL fark (KDV dahil)
                  </button>
                ) : a ? (
                  <button
                    type="button"
                    style={{ ...ikincil, padding: '10px 12px', fontSize: 13.5 }}
                    disabled={mesgul || a.sonraki?.plan === p.key}
                    onClick={() =>
                      sonrakiDonem(
                        p.key,
                        a.sonraki?.donem ?? a.donem,
                        `${tarih(a.bitis)} yenilemesinde ${p.ad} pakete geçilecek.`,
                      )
                    }
                  >
                    {a.sonraki?.plan === p.key ? 'Sonraki dönemde geçilecek' : 'Sonraki dönemde geç'}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {secim && sahip ? (
        <section
          id="odeme"
          aria-labelledby="od"
          style={{ ...kart, marginTop: 16, border: '2px solid #FFC84A' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <h2 id="od" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
              Ödeme
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
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 10,
              padding: '14px 0',
              borderBottom: '1px solid #EEF0F5',
              fontSize: 15,
            }}
          >
            <span style={{ fontWeight: 700 }}>{secim.ad}</span>
            <strong>{tlYaz(secim.tutarKurus)}</strong>
          </div>
          {kupon ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 10,
                padding: '10px 0',
                borderBottom: '1px solid #EEF0F5',
                fontSize: 14.5,
                fontWeight: 700,
                color: '#11683F',
              }}
            >
              <span>
                Kupon {kupon.kod}
                {secim.tur === 'paket' ? ' · yalnızca ilk ödeme' : ''}
              </span>
              <span>
                −{tlYaz(kupon.indirimKurus)} · ödenecek {tlYaz(kupon.toplamKurus)}
              </span>
            </div>
          ) : secim.tur !== 'yenile' && !siparis ? (
            <div style={{ padding: '10px 0', borderBottom: '1px solid #EEF0F5' }}>
              <div style={{ display: 'flex', gap: 8, maxWidth: 420 }}>
                <input
                  value={kuponKod}
                  maxLength={16}
                  placeholder="Kupon kodu"
                  aria-label="Kupon kodu"
                  onChange={(e) => setKuponKod(e.target.value.toLocaleUpperCase('tr-TR'))}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: '1px solid #D5DAE5',
                    borderRadius: 10,
                    padding: '9px 10px',
                    fontSize: 14,
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  type="button"
                  disabled={kuponKod.trim().length < 4}
                  onClick={kuponUygula}
                  style={{
                    flex: 'none',
                    border: '1px solid #D5DAE5',
                    background: '#FFFFFF',
                    borderRadius: 10,
                    padding: '9px 14px',
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#1E2333',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    opacity: kuponKod.trim().length < 4 ? 0.5 : 1,
                  }}
                >
                  Uygula
                </button>
              </div>
              {kuponHata ? (
                <p
                  role="alert"
                  style={{ margin: '6px 0 0', fontSize: 12.5, color: '#A3271F', fontWeight: 700 }}
                >
                  {kuponHata}
                </p>
              ) : null}
            </div>
          ) : null}
          <p style={{ margin: '10px 0 14px', fontSize: 13.5, color: '#5A6073' }}>
            {secim.not} Tutar KDV dahildir. Fatura galerinin ticari unvanı ve vergi numarasıyla kesilir.
          </p>
          {siparis ? (
            <iframe
              title="PayTR kart bilgileri"
              src={siparis.odemeAdresi}
              style={{ width: '100%', height: 560, border: '1px solid #D5DAE5', borderRadius: 14 }}
            />
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                ode();
              }}
              style={{ display: 'grid', gap: 12 }}
            >
              <label style={{ fontSize: 13.5, fontWeight: 700 }}>
                Faturanın gönderileceği e-posta
                <input
                  type="email"
                  required
                  value={eposta}
                  onChange={(e) => setEposta(e.target.value)}
                  style={{
                    display: 'block',
                    width: '100%',
                    boxSizing: 'border-box',
                    marginTop: 6,
                    border: '1px solid #D5DAE5',
                    borderRadius: 12,
                    padding: 12,
                    fontSize: 15,
                    fontFamily: 'inherit',
                  }}
                />
              </label>
              <label style={{ display: 'flex', gap: 10, fontSize: 14, alignItems: 'flex-start' }}>
                <input
                  type="checkbox"
                  checked={onay.sozlesme}
                  onChange={(e) => {
                    const c = e.target.checked;
                    setOnay((o) => ({ ...o, sozlesme: c }));
                  }}
                  style={{ marginTop: 3 }}
                />
                <span>
                  {secim.tur === 'ek' ? (
                    <>
                      <Link href="/on-bilgilendirme" target="_blank">
                        Ön Bilgilendirme Formu
                      </Link>
                      ’nu ve{' '}
                      <Link href="/mesafeli-sozlesme" target="_blank">
                        Mesafeli Hizmet Sözleşmesi
                      </Link>
                      ’ni okudum, onaylıyorum.
                    </>
                  ) : (
                    <>
                      <Link href="/galeri-sozlesmesi" target="_blank">
                        {SUBSCRIPTION_CONSENT.split('’')[0]}
                      </Link>
                      ’{SUBSCRIPTION_CONSENT.split('’').slice(1).join('’')}
                    </>
                  )}
                </span>
              </label>
              {secim.tur !== 'ek' ? (
                <label style={{ display: 'flex', gap: 10, fontSize: 14, alignItems: 'flex-start' }}>
                  <input
                    type="checkbox"
                    checked={onay.yenileme}
                    onChange={(e) => {
                      const c = e.target.checked;
                      setOnay((o) => ({ ...o, yenileme: c }));
                    }}
                    style={{ marginTop: 3 }}
                  />
                  <span>{RENEWAL_CONSENT}</span>
                </label>
              ) : null}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="submit"
                  style={{ ...birincil, opacity: mesgul ? 0.6 : 1 }}
                  disabled={mesgul || !eposta || !onay.sozlesme || (secim.tur !== 'ek' && !onay.yenileme)}
                >
                  Siparişi onayla ve öde
                </button>
                <button type="button" style={ikincil} onClick={() => setSecim(null)}>
                  Vazgeç
                </button>
              </div>
            </form>
          )}
        </section>
      ) : null}

      <section
        aria-labelledby="ft"
        style={{
          marginTop: 16,
          background: '#FFFFFF',
          border: '1px solid #E3E6EF',
          borderRadius: 18,
          overflow: 'hidden',
        }}
      >
        <h2
          id="ft"
          style={{
            margin: 0,
            padding: '16px 18px',
            fontSize: 17,
            fontWeight: 800,
            borderBottom: '1px solid #EEF0F5',
          }}
        >
          Faturalar
        </h2>
        {v.faturalar.length ? (
          v.faturalar.map((f) => (
            <div
              key={f.id}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                padding: '12px 18px',
                borderBottom: '1px solid #EEF0F5',
                fontSize: 14,
              }}
            >
              <span style={{ fontWeight: 700, flex: '1 1 260px' }}>{f.ad}</span>
              <span style={{ color: '#5A6073' }}>{tarih(f.tarih)}</span>
              <span style={{ fontWeight: 800 }}>
                {tlYaz(f.tutarKurus)}
                {f.iadeKurus ? (
                  <span style={{ marginLeft: 6, fontSize: 12.5, color: '#11683F' }}>
                    İade: {tlYaz(f.iadeKurus)}
                  </span>
                ) : null}
              </span>
              {f.fatura ? (
                <button type="button" style={baglanti} onClick={() => faturaIndir(f.id)}>
                  E-arşiv faturayı indir
                </button>
              ) : (
                <span style={{ fontSize: 13, color: '#5A6073' }}>Fatura hazırlanıyor</span>
              )}
            </div>
          ))
        ) : (
          <p style={{ margin: 0, padding: '14px 18px', fontSize: 14, color: '#5A6073' }}>
            Henüz faturan yok.
          </p>
        )}
      </section>
    </>
  );
}
