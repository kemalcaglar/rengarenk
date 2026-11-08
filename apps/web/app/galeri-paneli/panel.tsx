'use client';

import {
  DOTS,
  GALLERY_PLANS,
  GALLERY_TRIAL,
  galleryInviteSchema,
  MEMBER_ROLE_NAMES,
  MEMBER_ROLE_NOTES,
  type MemberRoleKey,
  type PublicCategory,
} from '@rengarenk/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { API, binlik, istek, useGiris } from '../../lib/istemci';
import { AracFormu } from './arac-formu';
import { Eslesmeler, type EslesmeVerisi } from './eslesmeler';
import { Portfoy, type PortfoyListesi, TopluYukleme } from './portfoy';

interface Panel {
  accountId: string;
  durum: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  rol: MemberRoleKey;
  galeri: {
    slug: string;
    ad: string;
    isletmeAdi: string;
    yetkiNo: string | null;
    tur: string;
    il: string;
    ilce: string;
    hakkinda: string | null;
    calismaSaatleri: string | null;
  };
  isletme: { unvan: string; vergiNo: string; vergiDairesi: string; mersis: string; adres: string } | null;
  paket: {
    key: string;
    ad: string;
    denemeBitis: string | null;
    denemeKalanGun: number | null;
    saltOkunur: boolean;
    portfoy: number | null;
    gunlukMesaj: number;
    calisan: number;
  };
  ekip: { userId: string; ad: string; telefon: string; rol: MemberRoleKey; rolAd: string; sen: boolean }[];
  davetler: { id: string; telefon: string; rol: MemberRoleKey; rolAd: string; bitis: string }[];
}
type Gorunum = 'ozet' | 'portfoy' | 'ekle' | 'toplu' | 'eslesme' | 'ekip' | 'paket';

/** Menü (GaleriPanel.dc.html) */
const MENU: { key: Gorunum; ad: string; sonra?: true }[] = [
  { key: 'ozet', ad: 'Özet' },
  { key: 'portfoy', ad: 'Portföy' },
  { key: 'ekle', ad: 'Araç ekle' },
  { key: 'toplu', ad: 'Toplu yükleme' },
  { key: 'eslesme', ad: 'Eşleşmeler' },
  { key: 'ekip', ad: 'Ekip' },
  { key: 'paket', ad: 'Paket ve faturalar' },
];
const TINTS = ['#EEF3FF', '#FFEEF6', '#FFF6DF', '#E7FAF0'];

const tarih = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('tr-TR', {
        timeZone: 'Europe/Istanbul',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(iso))
    : '';
const basHarf = (ad: string) =>
  ad
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toLocaleUpperCase('tr-TR'))
    .join('');

const kart: CSSProperties = { background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 16 };
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
  padding: '11px 16px',
  fontSize: 14,
  fontWeight: 700,
  color: '#1E2333',
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const girdi: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #D5DAE5',
  borderRadius: 12,
  padding: 12,
  fontSize: 15,
  fontFamily: 'inherit',
  background: '#FFFFFF',
};

/**
 * Galeri paneli (tasarım: GaleriPanel.dc.html; Karar 12.5, 20). Özet, ekip, paket. Tasarıma ek: Özet'te galeri
 * profilinin tanıtım ve çalışma saatleri düzenlenir; deneme süresi ve kalan gün paket satırında yazar.
 */
export function GaleriPaneli() {
  const giris = useGiris();
  const router = useRouter();
  const [galeriler, setGaleriler] = useState<{ accountId: string; ad: string }[] | null>(null);
  const [secili, setSecili] = useState<string | null>(null);
  const [p, setP] = useState<Panel | null>(null);
  const [me, setMe] = useState<{ firstName: string | null; lastName: string | null } | null>(null);
  const [gorunum, setGorunumHam] = useState<Gorunum>('ozet');
  const [duzenle, setDuzenle] = useState<string | null>(null);
  const [kategoriler, setKategoriler] = useState<PublicCategory[]>([]);
  const [portfoy, setPortfoy] = useState<PortfoyListesi | null>(null);
  const [eslesme, setEslesme] = useState<EslesmeVerisi | null>(null);
  const setGorunum = (g: Gorunum) => {
    setDuzenle(null);
    setGorunumHam(g);
  };
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [davetler, setDavetler] = useState<
    { id: string; galeri: string; rolAd: string; bitis: string }[] | null
  >(null);

  // Ana sayfadaki "Tümünü gör" doğrudan Eşleşmeler'i açar
  useEffect(() => {
    const b = new URLSearchParams(window.location.search).get('bolum');
    if (b && MENU.some((m) => m.key === b)) setGorunumHam(b as Gorunum);
  }, []);

  useEffect(() => {
    if (giris === false) router.replace('/giris?sonra=/galeri-paneli');
    if (!giris) return;
    Promise.all([istek<{ accountId: string; ad: string }[]>('/gallery/mine'), istek<typeof me>('/me')])
      .then(async ([g, m]) => {
        setMe(m);
        if (!g.length) {
          // Galerisi olmayan: bekleyen ekip daveti varsa onu gösterir, yoksa başvuruya gider (Karar 20)
          const d =
            await istek<{ id: string; galeri: string; rolAd: string; bitis: string }[]>('/me/invites');
          if (d.length) setDavetler(d);
          else router.replace('/kurumsal-basvuru');
          return;
        }
        setGaleriler(g);
        setSecili(g[0]?.accountId ?? null);
      })
      .catch((e: Error) => setHata(e.message));
  }, [giris, router]);

  const yukle = useCallback(async () => {
    if (!secili) return;
    const [x, l, e] = await Promise.all([
      istek<Panel>(`/gallery/${secili}`),
      istek<PortfoyListesi>(`/gallery/${secili}/portfolio`).catch(() => null),
      istek<EslesmeVerisi>(`/gallery/${secili}/matches`).catch(() => null),
    ]);
    setP(x);
    setPortfoy(l);
    setEslesme(e);
  }, [secili]);

  useEffect(() => {
    fetch(`${API}/categories`)
      .then((r) => r.json() as Promise<PublicCategory[]>)
      .then((c) => setKategoriler(c.filter((x) => x.vertical === 'vasita')))
      .catch(() => undefined);
  }, []);

  const portfoyBitti = (m: string) => {
    if (m) setBilgi(m);
    setGorunum('portfoy');
    yukle().catch(() => undefined);
  };
  useEffect(() => {
    yukle().catch((e: Error) => setHata(e.message));
  }, [yukle]);

  async function islem(fn: () => Promise<Panel | null | undefined>, mesaj: string) {
    setHata(null);
    try {
      const r = await fn();
      if (r) setP(r);
      else await yukle();
      setBilgi(mesaj);
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  useEffect(() => {
    if (!bilgi) return;
    const t = setTimeout(() => setBilgi(null), 4000);
    return () => clearTimeout(t);
  }, [bilgi]);

  const eslesmeGoruldu = useCallback(() => setEslesme((e) => (e ? { ...e, yeni: 0 } : e)), []);

  const benimAd = [me?.firstName, me?.lastName].filter(Boolean).join(' ') || 'Sen';

  return (
    <div style={{ background: '#F6F8FD', minHeight: '100vh', color: '#1E2333' }}>
      <header style={{ background: '#FFFFFF', borderBottom: '1px solid #E3E6EF' }}>
        <div
          style={{
            maxWidth: 1360,
            margin: '0 auto',
            padding: '14px 24px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: '#1E2333',
              textDecoration: 'none',
            }}
            aria-label="Rengarenk ana sayfa"
          >
            <span style={{ display: 'flex', gap: 3 }} aria-hidden="true">
              {['#5B8CFF', '#FF6FB5', '#FFC84A', '#3DD68C'].map((c) => (
                <span key={c} style={{ width: 10, height: 22, borderRadius: 5, background: c }} />
              ))}
            </span>
            <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>rengarenk</span>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 800,
                background: '#FFF6DF',
                color: '#7A5300',
                padding: '4px 10px',
                borderRadius: 999,
                marginLeft: 4,
              }}
            >
              Galeri paneli
            </span>
          </Link>
          {p ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: '#FFF6DF',
                  color: '#7A5300',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                {basHarf(benimAd)}
              </span>
              <span>
                {galeriler && galeriler.length > 1 ? (
                  <select
                    aria-label="Galeri"
                    value={secili ?? ''}
                    onChange={(e) => setSecili(e.target.value)}
                    style={{
                      border: 0,
                      fontSize: 14.5,
                      fontWeight: 700,
                      fontFamily: 'inherit',
                      background: 'transparent',
                    }}
                  >
                    {galeriler.map((g) => (
                      <option key={g.accountId} value={g.accountId}>
                        {g.ad}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{p.galeri.ad}</span>
                )}
                <span style={{ display: 'block', fontSize: 12.5, color: '#5A6073' }}>
                  {benimAd} · {MEMBER_ROLE_NAMES[p.rol]}
                </span>
              </span>
            </div>
          ) : null}
        </div>
      </header>

      <div
        style={{
          maxWidth: 1360,
          margin: '0 auto',
          padding: 24,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          gap: 24,
        }}
      >
        <nav
          aria-label="Galeri paneli"
          style={{
            flex: '1 1 220px',
            maxWidth: 250,
            minWidth: 0,
            background: '#FFFFFF',
            border: '1px solid #E3E6EF',
            borderRadius: 18,
            padding: 12,
          }}
        >
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            {MENU.map((m, i) => {
              const on = gorunum === m.key;
              const rozet =
                m.key === 'ekip' && p
                  ? String(p.ekip.length)
                  : m.key === 'eslesme' && eslesme?.yeni
                    ? String(eslesme.yeni)
                    : m.sonra
                      ? 'yakında'
                      : '';
              return (
                <li key={m.key}>
                  <button
                    type="button"
                    aria-current={on ? 'page' : undefined}
                    disabled={m.sonra}
                    onClick={() => setGorunum(m.key)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      border: 0,
                      background: on ? '#EEF3FF' : 'transparent',
                      borderRadius: 12,
                      padding: 12,
                      fontSize: 14.5,
                      fontWeight: on ? 800 : 600,
                      color: m.sonra ? '#8A91A3' : on ? '#1E2333' : '#3A4052',
                      cursor: m.sonra ? 'default' : 'pointer',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        aria-hidden="true"
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: '50%',
                          background: DOTS[i % DOTS.length],
                        }}
                      />
                      {m.ad}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#5A6073' }}>{rozet}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

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
          {bilgi ? (
            <p
              role="status"
              style={{
                margin: '0 0 14px',
                background: '#E7FAF0',
                borderRadius: 12,
                padding: '10px 14px',
                fontSize: 14,
                color: '#11683F',
                fontWeight: 600,
              }}
            >
              {bilgi}
            </p>
          ) : null}
          {p?.durum === 'SUSPENDED' ? (
            <p
              role="alert"
              style={{
                margin: '0 0 14px',
                background: '#FDECEC',
                borderRadius: 12,
                padding: '10px 14px',
                fontSize: 14,
                color: '#A3271F',
                fontWeight: 600,
              }}
            >
              Galeri hesabın askıya alındı. Ayrıntı için destek ekibimize yaz.
            </p>
          ) : null}
          {davetler ? (
            <Davetler
              davetler={davetler}
              yanitla={async (id, kabul) => {
                setHata(null);
                try {
                  await istek(`/me/invites/${id}/${kabul ? 'accept' : 'decline'}`, { method: 'POST' });
                  if (kabul) window.location.reload();
                  else setDavetler((d) => (d ?? []).filter((x) => x.id !== id));
                } catch (e) {
                  setHata((e as Error).message);
                }
              }}
            />
          ) : null}
          {!p && !davetler ? <p style={{ color: '#5A6073' }}>Yükleniyor…</p> : null}
          {p && gorunum === 'ozet' ? (
            <Ozet p={p} portfoy={portfoy} yeniEslesme={eslesme?.yeni ?? 0} git={setGorunum} islem={islem} />
          ) : null}
          {p && gorunum === 'eslesme' ? (
            <Eslesmeler accountId={p.accountId} veri={eslesme} gorundu={eslesmeGoruldu} />
          ) : null}
          {p && gorunum === 'portfoy' && !duzenle ? (
            <Portfoy
              key={String(portfoy?.aktif)}
              accountId={p.accountId}
              ekle={() => setGorunum('ekle')}
              duzenle={(id) => setDuzenle(id)}
              toplu={() => setGorunum('toplu')}
              bildir={setBilgi}
            />
          ) : null}
          {p && (gorunum === 'ekle' || duzenle) ? (
            <AracFormu
              key={duzenle ?? 'yeni'}
              accountId={p.accountId}
              id={duzenle}
              kategoriler={kategoriler}
              bitti={portfoyBitti}
            />
          ) : null}
          {p && gorunum === 'toplu' ? (
            portfoy?.toplu ? (
              <TopluYukleme accountId={p.accountId} api={portfoy.api} bitti={portfoyBitti} />
            ) : (
              <p style={{ color: '#5A6073' }}>Toplu yükleme Profesyonel ve Kurumsal paketlerdedir.</p>
            )
          ) : null}
          {p && gorunum === 'ekip' ? <Ekip p={p} islem={islem} /> : null}
          {p && gorunum === 'paket' ? <Paket p={p} /> : null}
        </main>
      </div>
    </div>
  );
}

type Islem = (fn: () => Promise<Panel | null | undefined>, mesaj: string) => Promise<void>;

function Ozet({
  p,
  portfoy,
  yeniEslesme,
  git,
  islem,
}: {
  p: Panel;
  portfoy: PortfoyListesi | null;
  yeniEslesme: number;
  git: (g: Gorunum) => void;
  islem: Islem;
}) {
  const aktif = portfoy?.aktif ?? 0;
  const bekleyen = portfoy?.araclar.filter((a) => a.durum === 'PENDING_EIDS').length ?? 0;
  const [hakkinda, setHakkinda] = useState(p.galeri.hakkinda ?? '');
  const [saatler, setSaatler] = useState(p.galeri.calismaSaatleri ?? '');
  const deneme = p.paket.key === 'deneme';
  const kotalar = [
    {
      label: 'Portföy',
      value: aktif,
      max: p.paket.portfoy === null ? 'sınırsız' : `${p.paket.portfoy} araç`,
      not:
        p.paket.portfoy === null
          ? 'Sınırsız araç ekleyebilirsin'
          : `${Math.max(0, p.paket.portfoy - aktif)} araç daha ekleyebilirsin`,
    },
    {
      label: 'Bugünkü ilk mesaj',
      value: 0,
      max: String(p.paket.gunlukMesaj),
      not: "Her gece 00:00'da yenilenir",
    },
    {
      label: deneme ? 'Deneme talep hakkı' : 'Bu ay açılan talep',
      value: 0,
      max: String(
        deneme ? GALLERY_TRIAL.talep : GALLERY_PLANS[p.paket.key as keyof typeof GALLERY_PLANS].aylikTalep,
      ),
      not: 'Galerinin kendi araç arayışları için',
    },
    {
      label: 'Öne çıkarma',
      value: 0,
      max: String(deneme ? 0 : GALLERY_PLANS[p.paket.key as keyof typeof GALLERY_PLANS].oneCikarma),
      not: deneme ? 'Denemede öne çıkarma yok' : 'Bu ay kullanılabilir',
    },
  ];
  const duzenleyebilir = p.rol !== 'SALES';
  return (
    <>
      <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800 }}>Özet</h1>
      <p style={{ margin: '0 0 20px', fontSize: 14.5, color: '#5A6073' }}>
        {deneme
          ? `Ücretsiz deneme · ${p.paket.denemeKalanGun} gün kaldı (bitiş ${tarih(p.paket.denemeBitis)})`
          : `${p.paket.ad} paket`}
      </p>
      {p.paket.saltOkunur ? (
        <p
          role="alert"
          style={{
            margin: '0 0 16px',
            background: '#FFF6DF',
            borderRadius: 12,
            padding: '10px 14px',
            fontSize: 14,
            color: '#7A5300',
            fontWeight: 600,
          }}
        >
          Deneme süren bitti. Paket seçene kadar yalnızca portföyünü görüntüleyebilirsin.
        </p>
      ) : null}
      <div className="rr-dort-sutun">
        {kotalar.map((k, i) => (
          <div key={k.label} style={{ ...kart, padding: 16 }}>
            <div style={{ fontSize: 13, color: '#5A6073', fontWeight: 600 }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>
              {k.value} <span style={{ fontSize: 14, color: '#5A6073', fontWeight: 600 }}>/ {k.max}</span>
            </div>
            <div
              style={{ height: 8, borderRadius: 4, background: '#EEF0F5', marginTop: 10, overflow: 'hidden' }}
            >
              <div
                style={{
                  height: 8,
                  borderRadius: 4,
                  background: DOTS[i],
                  width: `${k.max === 'sınırsız' || !Number.parseInt(k.max, 10) ? 0 : Math.min(100, (k.value / Number.parseInt(k.max, 10)) * 100)}%`,
                }}
              />
            </div>
            <div style={{ fontSize: 12.5, color: '#5A6073', marginTop: 8 }}>{k.not}</div>
          </div>
        ))}
      </div>
      <div className="rr-uc-sutun" style={{ marginTop: 16 }}>
        {[
          [String(yeniEslesme), '#11683F', 'Yeni eşleşme', 'Portföyündeki araçlara uyan talepler', 'eslesme'],
          [
            String(bekleyen),
            '#7A5300',
            'EİDS doğrulaması bekleyen',
            'Doğrulanana kadar alıcılara görünmez',
            'portfoy',
          ],
          ['0', '#9B1C5B', 'Okunmamış mesaj', 'Ekip üyelerine gelen sohbetler dahil', ''],
        ].map(([n, renk, ad, alt, hedef]) => {
          const ic = (
            <>
              <span style={{ display: 'block', fontSize: 30, fontWeight: 800, color: renk }}>{n}</span>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 700, marginTop: 2 }}>{ad}</span>
              <span style={{ display: 'block', fontSize: 13, color: '#5A6073', marginTop: 4 }}>{alt}</span>
            </>
          );
          return hedef ? (
            <button
              key={ad}
              type="button"
              onClick={() => git(hedef as Gorunum)}
              style={{ ...kart, padding: 18, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {ic}
            </button>
          ) : (
            <div key={ad} style={{ ...kart, padding: 18 }}>
              {ic}
            </div>
          );
        })}
      </div>

      <section style={{ ...kart, borderRadius: 18, padding: 20, marginTop: 16 }} aria-labelledby="profil">
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <h2 id="profil" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
            Galeri profilin
          </h2>
          <Link href={`/galeri/${p.galeri.slug}`} style={{ fontSize: 14, fontWeight: 700 }}>
            Profili gör
          </Link>
        </div>
        <p style={{ margin: '6px 0 14px', fontSize: 13.5, color: '#5A6073' }}>
          {p.galeri.isletmeAdi}
          {p.galeri.yetkiNo ? ` · Yetki belgesi no ${p.galeri.yetkiNo}` : ''} · {p.galeri.il}, {p.galeri.ilce}
        </p>
        {duzenleyebilir ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              islem(
                () =>
                  istek<Panel>(`/gallery/${p.accountId}/profile`, {
                    method: 'PATCH',
                    body: { hakkinda: hakkinda.trim() || null, calismaSaatleri: saatler.trim() || null },
                  }),
                'Profil güncellendi.',
              );
            }}
            style={{ display: 'grid', gap: 12 }}
          >
            <div>
              <label
                htmlFor="hakkinda"
                style={{ display: 'block', fontSize: 13.5, fontWeight: 700, marginBottom: 6 }}
              >
                Tanıtım
              </label>
              <textarea
                id="hakkinda"
                rows={3}
                maxLength={1000}
                value={hakkinda}
                onChange={(e) => setHakkinda(e.target.value)}
                placeholder="Galerini birkaç cümleyle anlat"
                style={{ ...girdi, resize: 'vertical' }}
              />
            </div>
            <div>
              <label
                htmlFor="saatler"
                style={{ display: 'block', fontSize: 13.5, fontWeight: 700, marginBottom: 6 }}
              >
                Çalışma saatleri
              </label>
              <input
                id="saatler"
                maxLength={120}
                value={saatler}
                onChange={(e) => setSaatler(e.target.value)}
                placeholder="Hafta içi 09.00–19.00, cumartesi 10.00–17.00"
                style={girdi}
              />
            </div>
            <div>
              <button type="submit" style={birincil}>
                Kaydet
              </button>
            </div>
          </form>
        ) : null}
      </section>
      <button type="button" onClick={() => git('ekip')} style={{ ...ikincil, marginTop: 16 }}>
        Ekibi yönet
      </button>
    </>
  );
}

function Ekip({ p, islem }: { p: Panel; islem: Islem }) {
  const [davet, setDavet] = useState<{ telefon: string; rol: 'MANAGER' | 'SALES' } | null>(null);
  const [duzen, setDuzen] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const davetEder = p.rol !== 'SALES';
  const doluKoltuk = p.ekip.length + p.davetler.length;
  return (
    <>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Ekip</h1>
          <p style={{ margin: '3px 0 0', fontSize: 14.5, color: '#5A6073' }}>
            {p.ekip.length} / {p.paket.calisan} kullanıcı · Mesaj ve talep hakları ekip genelinde ortaktır
          </p>
        </div>
        {davetEder ? (
          <button
            type="button"
            disabled={doluKoltuk >= p.paket.calisan}
            onClick={() => setDavet({ telefon: '', rol: 'SALES' })}
            style={birincil}
          >
            + Çalışan davet et
          </button>
        ) : null}
      </div>

      {davet ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const r = galleryInviteSchema.safeParse(davet);
            if (!r.success) {
              setHata(r.error.issues[0]?.message ?? 'Bilgileri kontrol et');
              return;
            }
            setHata(null);
            islem(async () => {
              const x = await istek<Panel>(`/gallery/${p.accountId}/invites`, {
                method: 'POST',
                body: davet,
              });
              setDavet(null);
              return x;
            }, 'Davet gönderildi. Çalışan bu numarayla giriş yapınca daveti kabul eder.');
          }}
          style={{ ...kart, borderRadius: 18, padding: 18, marginBottom: 16 }}
        >
          <h2 style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 800 }}>Çalışan davet et</h2>
          <div className="rr-iki-sutun" style={{ gap: 12 }}>
            <div>
              <label
                htmlFor="dtel"
                style={{ display: 'block', fontSize: 13.5, fontWeight: 700, marginBottom: 6 }}
              >
                Cep telefonu
              </label>
              <input
                id="dtel"
                inputMode="tel"
                autoComplete="off"
                placeholder="05XX XXX XX XX"
                value={davet.telefon}
                onChange={(e) => setDavet({ ...davet, telefon: e.target.value })}
                style={girdi}
              />
            </div>
            <div>
              <label
                htmlFor="drol"
                style={{ display: 'block', fontSize: 13.5, fontWeight: 700, marginBottom: 6 }}
              >
                Rol
              </label>
              <select
                id="drol"
                value={davet.rol}
                onChange={(e) => setDavet({ ...davet, rol: e.target.value as 'MANAGER' | 'SALES' })}
                style={girdi}
              >
                {p.rol === 'OWNER' ? <option value="MANAGER">{MEMBER_ROLE_NAMES.MANAGER}</option> : null}
                <option value="SALES">{MEMBER_ROLE_NAMES.SALES}</option>
              </select>
            </div>
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 12.5, color: '#5A6073' }}>
            {MEMBER_ROLE_NOTES[davet.rol]}
          </p>
          {hata ? (
            <p role="alert" style={{ margin: '8px 0 0', fontSize: 13.5, color: '#A3271F' }}>
              {hata}
            </p>
          ) : null}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="submit" style={birincil}>
              Davet gönder
            </button>
            <button type="button" onClick={() => setDavet(null)} style={ikincil}>
              Vazgeç
            </button>
          </div>
        </form>
      ) : null}

      <div style={{ ...kart, borderRadius: 18, overflow: 'hidden' }}>
        {p.ekip.map((u, i) => (
          <div key={u.userId} style={{ borderBottom: '1px solid #EEF0F5' }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '10px 18px',
                padding: '14px 18px',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: TINTS[(i + 2) % TINTS.length],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 13,
                  flex: 'none',
                }}
              >
                {basHarf(u.ad)}
              </span>
              <span style={{ flex: '999 1 200px', minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 800 }}>
                  {u.ad}
                  {u.sen ? <span style={{ fontWeight: 600, color: '#5A6073' }}> · sen</span> : null}
                </span>
                <span style={{ display: 'block', fontSize: 12.5, color: '#5A6073', marginTop: 2 }}>
                  Telefon doğrulandı · {u.telefon}
                </span>
              </span>
              <span style={{ flex: '1 1 150px', fontSize: 14, fontWeight: 700 }}>{u.rolAd}</span>
              <span style={{ flex: '1 1 180px', fontSize: 13.5, color: '#3A4052' }}>Sınır yok</span>
              {u.rol !== 'OWNER' && (p.rol === 'OWNER' || (p.rol === 'MANAGER' && u.rol === 'SALES')) ? (
                <button
                  type="button"
                  onClick={() => setDuzen(duzen === u.userId ? null : u.userId)}
                  aria-expanded={duzen === u.userId}
                  style={{
                    flex: 'none',
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
                  Düzenle
                </button>
              ) : (
                <span style={{ flex: 'none', width: 52 }} />
              )}
            </div>
            {duzen === u.userId ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 18px 14px 76px' }}>
                {p.rol === 'OWNER'
                  ? (['MANAGER', 'SALES'] as const)
                      .filter((r) => r !== u.rol)
                      .map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() =>
                            islem(
                              () =>
                                istek<Panel>(`/gallery/${p.accountId}/members/${u.userId}`, {
                                  method: 'PATCH',
                                  body: { rol: r },
                                }),
                              `${u.ad} artık ${MEMBER_ROLE_NAMES[r].toLocaleLowerCase('tr-TR')}.`,
                            )
                          }
                          style={ikincil}
                        >
                          {MEMBER_ROLE_NAMES[r]} yap
                        </button>
                      ))
                  : null}
                <button
                  type="button"
                  onClick={() =>
                    window.confirm(`${u.ad} ekipten çıkarılsın mı?`) &&
                    islem(async () => {
                      await istek(`/gallery/${p.accountId}/members/${u.userId}`, { method: 'DELETE' });
                      setDuzen(null);
                      return null;
                    }, `${u.ad} ekipten çıkarıldı.`)
                  }
                  style={{ ...ikincil, color: '#A3271F' }}
                >
                  Ekipten çıkar
                </button>
              </div>
            ) : null}
          </div>
        ))}
        {p.davetler.map((d) => (
          <div
            key={d.id}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '10px 18px',
              padding: '14px 18px',
              borderBottom: '1px solid #EEF0F5',
              background: '#FBFCFE',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                border: '2px dashed #C9CFDB',
                boxSizing: 'border-box',
                flex: 'none',
              }}
            />
            <span style={{ flex: '999 1 200px', minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 800 }}>{d.telefon}</span>
              <span style={{ display: 'block', fontSize: 12.5, color: '#7A5300', marginTop: 2 }}>
                Davet bekliyor · {tarih(d.bitis)} tarihine kadar geçerli
              </span>
            </span>
            <span style={{ flex: '1 1 150px', fontSize: 14, fontWeight: 700 }}>{d.rolAd}</span>
            <span style={{ flex: '1 1 180px' }} />
            <button
              type="button"
              onClick={() =>
                islem(
                  () => istek<Panel>(`/gallery/${p.accountId}/invites/${d.id}`, { method: 'DELETE' }),
                  'Davet iptal edildi.',
                )
              }
              style={{
                flex: 'none',
                border: 0,
                background: 'transparent',
                padding: 0,
                fontSize: 13.5,
                fontWeight: 700,
                color: '#A3271F',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              İptal et
            </button>
          </div>
        ))}
      </div>
      {doluKoltuk >= p.paket.calisan && davetEder ? (
        <p style={{ margin: '10px 2px 0', fontSize: 13, color: '#5A6073' }}>
          Paketindeki kullanıcı sınırına ulaştın. Daha büyük bir pakete geçince yeni çalışan ekleyebilirsin.
        </p>
      ) : null}
    </>
  );
}

function Paket({ p }: { p: Panel }) {
  const deneme = p.paket.key === 'deneme';
  const plan = deneme ? null : GALLERY_PLANS[p.paket.key as keyof typeof GALLERY_PLANS];
  return (
    <>
      <h1 style={{ margin: '0 0 18px', fontSize: 26, fontWeight: 800 }}>Paket ve faturalar</h1>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <section
          aria-labelledby="pk"
          style={{
            flex: '2 1 380px',
            minWidth: 0,
            background: '#FFFFFF',
            border: '2px solid #5B8CFF',
            borderRadius: 18,
            padding: 22,
          }}
        >
          <span style={{ fontSize: 12.5, fontWeight: 800, color: '#2450C8' }}>Mevcut paket</span>
          <h2 id="pk" style={{ margin: '4px 0 2px', fontSize: 24, fontWeight: 800 }}>
            {deneme ? 'Ücretsiz deneme' : plan?.ad}
          </h2>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
            {deneme ? `${p.paket.denemeKalanGun} gün kaldı` : `${binlik(plan?.aylik)} TL / ay`}{' '}
            <span style={{ fontSize: 13, color: '#5A6073', fontWeight: 500 }}>
              {deneme
                ? `Bitiş ${tarih(p.paket.denemeBitis)} · kart istenmez, kendiliğinden ücretli pakete geçmez`
                : 'KDV hariç'}
            </span>
          </p>
          <ul
            style={{ margin: '14px 0 0', paddingLeft: 18, fontSize: 14, lineHeight: 1.7, color: '#3A4052' }}
          >
            {deneme ? (
              <>
                <li>
                  Profesyonel paketin özellikleri: {GALLERY_TRIAL.portfoy} araçlık portföy, günde{' '}
                  {GALLERY_TRIAL.gunlukMesaj} ilk mesaj, {GALLERY_TRIAL.talep} talep hakkı
                </li>
                <li>Excel/CSV toplu yükleme ve otomatik eşleşme</li>
                <li>Öne çıkarma ve API denemede yok</li>
              </>
            ) : (
              <li>
                {plan?.portfoy ?? 'Sınırsız'} araçlık portföy, günde {plan?.gunlukMesaj} ilk mesaj, ayda{' '}
                {plan?.aylikTalep} talep
              </li>
            )}
          </ul>
          <p style={{ margin: '14px 0 0', fontSize: 13, color: '#5A6073' }}>
            Paket satın alma ödeme altyapısı (PayTR) açılınca bu ekrandan yapılacak.
          </p>
        </section>
        <section
          aria-labelledby="pl"
          style={{
            flex: '1 1 260px',
            minWidth: 0,
            background: '#FFFFFF',
            border: '1px solid #E3E6EF',
            borderRadius: 18,
            padding: 22,
          }}
        >
          <h2 id="pl" style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 800 }}>
            Paketler
          </h2>
          <p style={{ margin: '0 0 14px', fontSize: 13.5, color: '#5A6073' }}>
            Aylık, KDV hariç; yıllık ödemede 2 ay ücretsiz.
          </p>
          {Object.entries(GALLERY_PLANS).map(([k, v]) => (
            <div
              key={k}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 0',
                borderTop: '1px solid #EEF0F5',
                fontSize: 14,
              }}
            >
              <span>
                {v.ad} · {v.portfoy ?? 'sınırsız'} araç · {v.calisan} kullanıcı
              </span>
              <strong>{binlik(v.aylik)} TL</strong>
            </div>
          ))}
        </section>
      </div>
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
        <p style={{ margin: 0, padding: '14px 18px', fontSize: 14, color: '#5A6073' }}>Henüz faturan yok.</p>
      </section>
    </>
  );
}

function Davetler({
  davetler,
  yanitla,
}: {
  davetler: { id: string; galeri: string; rolAd: string; bitis: string }[];
  yanitla: (id: string, kabul: boolean) => void;
}) {
  return (
    <>
      <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800 }}>Galeri davetlerin</h1>
      <p style={{ margin: '0 0 16px', fontSize: 14.5, color: '#5A6073' }}>
        Kabul edince galerinin paneline erişirsin; mesajlarda galeri adıyla birlikte kendi adın görünür.
      </p>
      <div style={{ ...kart, borderRadius: 18, overflow: 'hidden' }}>
        {davetler.length === 0 ? (
          <p style={{ margin: 0, padding: 18, fontSize: 14, color: '#5A6073' }}>
            Bekleyen davetin kalmadı. <Link href="/kurumsal-basvuru">Kendi galerin için başvur</Link>
          </p>
        ) : null}
        {davetler.map((d) => (
          <div
            key={d.id}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '10px 18px',
              padding: '14px 18px',
              borderBottom: '1px solid #EEF0F5',
            }}
          >
            <span style={{ flex: '999 1 240px', minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 800 }}>{d.galeri}</span>
              <span style={{ display: 'block', fontSize: 12.5, color: '#5A6073', marginTop: 2 }}>
                {d.rolAd} olarak davet edildin · {tarih(d.bitis)} tarihine kadar geçerli
              </span>
            </span>
            <button type="button" onClick={() => yanitla(d.id, false)} style={ikincil}>
              Reddet
            </button>
            <button type="button" onClick={() => yanitla(d.id, true)} style={birincil}>
              Kabul et
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
