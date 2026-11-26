'use client';

import {
  DOTS,
  GALLERY_TRIAL,
  galleryInviteSchema,
  MEMBER_ROLE_NAMES,
  MEMBER_ROLE_NOTES,
  type MemberRoleKey,
  type PublicCategory,
} from '@rengarenk/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Banner } from '../../components/banner';
import { cx } from '../../lib/cx';
import { API, istek, useGiris } from '../../lib/istemci';
import { AracFormu } from './arac-formu';
import { Eslesmeler, type EslesmeVerisi } from './eslesmeler';
import { Guven, type GuvenVerisi } from './guven';
import { Paket } from './paket';
import stil from './panel.module.css';
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
    aylikTalep?: number;
    oneCikarma?: number;
    calisan: number;
  };
  ekip: {
    userId: string;
    ad: string;
    telefon: string;
    rol: MemberRoleKey;
    rolAd: string;
    gunlukSinir: number | null;
    sen: boolean;
  }[];
  davetler: { id: string; telefon: string; rol: MemberRoleKey; rolAd: string; bitis: string }[];
  haklar: { talep: number; ustSira: number; buDonemTalep: number };
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
  const [okunmamis, setOkunmamis] = useState(0);
  const [guven, setGuven] = useState<GuvenVerisi | null>(null);
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
    // Uygulamadan "toplu yükleme web panelde" ile gelindiyse bölüm girişten sonra da korunur
    if (giris === false)
      router.replace(`/giris?sonra=${encodeURIComponent(`/galeri-paneli${window.location.search}`)}`);
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
    istek<{ okunmamis: number }>(`/conversations/unread?hesap=${secili}`)
      .then((u) => setOkunmamis(u.okunmamis))
      .catch(() => undefined);
    istek<GuvenVerisi>(`/gallery/${secili}/trust`)
      .then(setGuven)
      .catch(() => undefined);
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
    <div className={stil.kutu1}>
      <header className={stil.kutu2}>
        <div className={stil.kutu3}>
          <Link href="/" className={stil.bag1} aria-label="Rengarenk ana sayfa">
            <span className={stil.metin1} aria-hidden="true">
              {[
                'var(--rr-mavi, #5B8CFF)',
                'var(--rr-pembe, #FF6FB5)',
                'var(--rr-sari, #FFC84A)',
                'var(--rr-yesil, #3DD68C)',
              ].map((c) => (
                <span key={c} className={stil.metin2} style={{ background: c }} />
              ))}
            </span>
            <span className={stil.metin3}>rengarenk</span>
            <span className={stil.metin4}>Galeri paneli</span>
          </Link>
          {p ? (
            <div className={stil.kutu4}>
              <span aria-hidden="true" className={stil.metin5}>
                {basHarf(benimAd)}
              </span>
              <span>
                {galeriler && galeriler.length > 1 ? (
                  <select
                    aria-label="Galeri"
                    value={secili ?? ''}
                    onChange={(e) => setSecili(e.target.value)}
                    className={stil.girdi1}
                  >
                    {galeriler.map((g) => (
                      <option key={g.accountId} value={g.accountId}>
                        {g.ad}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className={stil.metin6}>{p.galeri.ad}</span>
                )}
                <span className={stil.metin7}>
                  {benimAd} · {MEMBER_ROLE_NAMES[p.rol]}
                </span>
              </span>
            </div>
          ) : null}
        </div>
      </header>

      <div className={stil.kutu5}>
        <nav aria-label="Galeri paneli" className={`rr-panel-menu ${stil.kutu6}`}>
          <ul className={stil.liste1}>
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
                    className={cx(
                      stil.dugme1,
                      on ? stil.dugme2 : stil.dugme3,
                      m.sonra ? stil.dugme4 : stil.dugme5,
                    )}
                    style={{ color: m.sonra ? '#8A91A3' : on ? 'var(--rr-murekkep, #1E2333)' : '#3A4052' }}
                  >
                    <span className={stil.kutu4}>
                      <span
                        aria-hidden="true"
                        className={stil.metin8}
                        style={{ background: DOTS[i % DOTS.length] }}
                      />
                      {m.ad}
                    </span>
                    <span className={stil.metin9}>{rozet}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <main className={stil.kutu7}>
          <Banner yer="galeri_paneli" className={stil.banner} />
          {hata ? (
            <p role="alert" className={stil.metin10}>
              {hata}
            </p>
          ) : null}
          {bilgi ? (
            <p role="status" className={stil.metin11}>
              {bilgi}
            </p>
          ) : null}
          {p?.durum === 'SUSPENDED' ? (
            <p role="alert" className={stil.metin12}>
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
          {!p && !davetler ? <p className={stil.metin13}>Yükleniyor…</p> : null}
          {p && gorunum === 'ozet' ? (
            <Ozet
              p={p}
              portfoy={portfoy}
              yeniEslesme={eslesme?.yeni ?? 0}
              kullanilanMesaj={eslesme ? eslesme.gunlukMesaj - eslesme.kalanMesaj : 0}
              okunmamis={okunmamis}
              guven={guven}
              git={setGorunum}
              islem={islem}
            />
          ) : null}
          {p && gorunum === 'eslesme' ? (
            <Eslesmeler
              accountId={p.accountId}
              veri={eslesme}
              gorundu={eslesmeGoruldu}
              yenile={() => yukle().catch(() => undefined)}
            />
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
              <p className={stil.metin13}>Toplu yükleme Profesyonel ve Kurumsal paketlerdedir.</p>
            )
          ) : null}
          {p && gorunum === 'ekip' ? <Ekip p={p} islem={islem} /> : null}
          {p && gorunum === 'paket' ? (
            <Paket accountId={p.accountId} onDegisti={() => yukle().catch(() => undefined)} />
          ) : null}
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
  kullanilanMesaj,
  okunmamis,
  guven,
  git,
  islem,
}: {
  p: Panel;
  portfoy: PortfoyListesi | null;
  yeniEslesme: number;
  kullanilanMesaj: number;
  okunmamis: number;
  guven: GuvenVerisi | null;
  git: (g: Gorunum) => void;
  islem: Islem;
}) {
  const aktif = portfoy?.aktif ?? 0;
  const bekleyen = portfoy?.araclar.filter((a) => a.durum === 'PENDING_EIDS').length ?? 0;
  const [hakkinda, setHakkinda] = useState(p.galeri.hakkinda ?? '');
  const [saatler, setSaatler] = useState(p.galeri.calismaSaatleri ?? '');
  const deneme = p.paket.key === 'deneme';
  // Paket hakları yürürlükteki fiyat listesinden (API)
  const plan = { aylikTalep: p.paket.aylikTalep ?? 0, oneCikarma: deneme ? 0 : (p.paket.oneCikarma ?? 0) };
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
      value: kullanilanMesaj,
      max: String(p.paket.gunlukMesaj),
      not: "Her gece 00:00'da yenilenir",
    },
    {
      label: deneme ? 'Deneme talep hakkı' : 'Bu ay açılan talep',
      value: p.haklar.buDonemTalep,
      max: String(deneme ? GALLERY_TRIAL.talep : (plan?.aylikTalep ?? 0)),
      not:
        p.haklar.talep > 0
          ? `${p.haklar.talep} talep hakkın var · galerin adına talep aç`
          : 'Galerinin kendi araç arayışları için',
    },
    {
      label: 'Öne çıkarma',
      value: Math.max(0, (plan?.oneCikarma ?? 0) - p.haklar.ustSira),
      max: String(plan?.oneCikarma ?? 0),
      not: deneme
        ? 'Denemede öne çıkarma yok'
        : p.haklar.ustSira > 0
          ? `${p.haklar.ustSira} hak kaldı · Taleplerim'den uygulanır`
          : 'Bu ay kullanılabilir',
    },
  ];
  const duzenleyebilir = p.rol !== 'SALES';
  return (
    <>
      <h1 className={stil.baslik1}>Özet</h1>
      <p className={stil.metin14}>
        {deneme
          ? `Ücretsiz deneme · ${p.paket.denemeKalanGun} gün kaldı (bitiş ${tarih(p.paket.denemeBitis)})`
          : plan
            ? `${p.paket.ad} paket`
            : 'Paket yok'}
      </p>
      {p.paket.saltOkunur ? (
        <p role="alert" className={stil.metin15}>
          {deneme ? 'Deneme süren bitti.' : 'Paketin sona erdi.'} Paket seçene kadar yalnızca portföyünü
          görüntüleyebilirsin.{' '}
          <button type="button" onClick={() => git('paket')} className={stil.dugme6}>
            Paket seç
          </button>
        </p>
      ) : null}
      <div className="rr-dort-sutun">
        {kotalar.map((k, i) => (
          <div key={k.label} className={stil.kutu8}>
            <div className={stil.kutu9}>{k.label}</div>
            <div className={stil.kutu10}>
              {k.value} <span className={stil.metin16}>/ {k.max}</span>
            </div>
            <div className={stil.kutu11}>
              <div
                className={stil.kutu12}
                style={{
                  background: DOTS[i],
                  width: `${k.max === 'sınırsız' || !Number.parseInt(k.max, 10) ? 0 : Math.min(100, (k.value / Number.parseInt(k.max, 10)) * 100)}%`,
                }}
              />
            </div>
            <div className={stil.kutu13}>{k.not}</div>
          </div>
        ))}
      </div>
      {p.rol !== 'SALES' && !p.paket.saltOkunur ? (
        <p className={stil.metin17}>
          <Link href={`/talep-olustur?hesap=${p.accountId}`} className={stil.bag2}>
            Galerin adına talep aç
          </Link>{' '}
          <span className={stil.metin13}>
            · aradığın aracı satıcılar bulsun; paketin talep hakkı kullanılır, alıcı olarak galerinin adı
            görünür
          </span>
        </p>
      ) : null}
      <div className={`rr-uc-sutun ${stil.kutu14}`}>
        {[
          [String(yeniEslesme), '#11683F', 'Yeni eşleşme', 'Portföyündeki araçlara uyan talepler', 'eslesme'],
          [
            String(bekleyen),
            '#7A5300',
            'EİDS doğrulaması bekleyen',
            'Doğrulanana kadar alıcılara görünmez',
            'portfoy',
          ],
          [String(okunmamis), '#9B1C5B', 'Okunmamış mesaj', 'Ekip üyelerine gelen sohbetler dahil', 'mesaj'],
        ].map(([n, renk, ad, alt, hedef]) => {
          const ic = (
            <>
              <span className={stil.metin18} style={{ color: renk }}>
                {n}
              </span>
              <span className={stil.metin19}>{ad}</span>
              <span className={stil.metin20}>{alt}</span>
            </>
          );
          return hedef ? (
            <button
              key={ad}
              type="button"
              onClick={() =>
                hedef === 'mesaj' ? window.location.assign('/mesajlarim') : git(hedef as Gorunum)
              }
              className={stil.dugme7}
            >
              {ic}
            </button>
          ) : (
            <div key={ad} className={stil.kutu15}>
              {ic}
            </div>
          );
        })}
      </div>

      {guven ? <Guven v={guven} hesap={p.accountId} /> : null}

      <section className={stil.kutu16} aria-labelledby="profil">
        <div className={stil.kutu17}>
          <h2 id="profil" className={stil.baslik2}>
            Galeri profilin
          </h2>
          <Link href={`/galeri/${p.galeri.slug}`} className={stil.bag3}>
            Profili gör
          </Link>
        </div>
        <p className={stil.metin21}>
          {p.galeri.isletmeAdi}
          {p.galeri.yetkiNo ? ` · Yetki belgesi no ${p.galeri.yetkiNo}` : ''} · {p.galeri.il}, {p.galeri.ilce}
          {guven ? ` · ${guven.takipci} takipçi` : ''}
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
            className={stil.kutu18}
          >
            <div>
              <label htmlFor="hakkinda" className={stil.etiket1}>
                Tanıtım
              </label>
              <textarea
                id="hakkinda"
                rows={3}
                maxLength={1000}
                value={hakkinda}
                onChange={(e) => setHakkinda(e.target.value)}
                placeholder="Galerini birkaç cümleyle anlat"
                className={stil.girdi2}
              />
            </div>
            <div>
              <label htmlFor="saatler" className={stil.etiket1}>
                Çalışma saatleri
              </label>
              <input
                id="saatler"
                maxLength={120}
                value={saatler}
                onChange={(e) => setSaatler(e.target.value)}
                placeholder="Hafta içi 09.00–19.00, cumartesi 10.00–17.00"
                className={stil.girdi3}
              />
            </div>
            <div>
              <button type="submit" className={stil.dugme8}>
                Kaydet
              </button>
            </div>
          </form>
        ) : null}
      </section>
      <button type="button" onClick={() => git('ekip')} className={stil.dugme9}>
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
      <div className={stil.kutu19}>
        <div>
          <h1 className={stil.baslik3}>Ekip</h1>
          <p className={stil.metin22}>
            {p.ekip.length} / {p.paket.calisan} kullanıcı · Mesaj ve talep hakları ekip genelinde ortaktır
          </p>
        </div>
        {davetEder ? (
          <button
            type="button"
            disabled={doluKoltuk >= p.paket.calisan}
            onClick={() => setDavet({ telefon: '', rol: 'SALES' })}
            className={stil.dugme8}
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
          className={stil.kutu20}
        >
          <h2 className={stil.baslik4}>Çalışan davet et</h2>
          <div className={`rr-iki-sutun ${stil.kutu21}`}>
            <div>
              <label htmlFor="dtel" className={stil.etiket1}>
                Cep telefonu
              </label>
              <input
                id="dtel"
                inputMode="tel"
                autoComplete="off"
                placeholder="05XX XXX XX XX"
                value={davet.telefon}
                onChange={(e) => setDavet({ ...davet, telefon: e.target.value })}
                className={stil.girdi3}
              />
            </div>
            <div>
              <label htmlFor="drol" className={stil.etiket1}>
                Rol
              </label>
              <select
                id="drol"
                value={davet.rol}
                onChange={(e) => setDavet({ ...davet, rol: e.target.value as 'MANAGER' | 'SALES' })}
                className={stil.girdi3}
              >
                {p.rol === 'OWNER' ? <option value="MANAGER">{MEMBER_ROLE_NAMES.MANAGER}</option> : null}
                <option value="SALES">{MEMBER_ROLE_NAMES.SALES}</option>
              </select>
            </div>
          </div>
          <p className={stil.metin23}>{MEMBER_ROLE_NOTES[davet.rol]}</p>
          {hata ? (
            <p role="alert" className={stil.metin24}>
              {hata}
            </p>
          ) : null}
          <div className={stil.kutu22}>
            <button type="submit" className={stil.dugme8}>
              Davet gönder
            </button>
            <button type="button" onClick={() => setDavet(null)} className={stil.dugme10}>
              Vazgeç
            </button>
          </div>
        </form>
      ) : null}

      <div className={stil.kutu23}>
        {p.ekip.map((u, i) => (
          <div key={u.userId} className={stil.kutu24}>
            <div className={stil.kutu25}>
              <span
                aria-hidden="true"
                className={stil.metin25}
                style={{ background: TINTS[(i + 2) % TINTS.length] }}
              >
                {basHarf(u.ad)}
              </span>
              <span className={stil.metin26}>
                <span className={stil.metin27}>
                  {u.ad}
                  {u.sen ? <span className={stil.metin28}> · sen</span> : null}
                </span>
                <span className={stil.metin29}>Telefon doğrulandı · {u.telefon}</span>
              </span>
              <span className={stil.metin30}>{u.rolAd}</span>
              <span className={stil.metin31}>
                {u.gunlukSinir ? `Günde en fazla ${u.gunlukSinir} ilk mesaj` : 'Sınır yok'}
              </span>
              {(u.rol !== 'OWNER' && (p.rol === 'OWNER' || (p.rol === 'MANAGER' && u.rol === 'SALES'))) ||
              (p.rol === 'OWNER' && u.rol === 'OWNER') ? (
                <button
                  type="button"
                  onClick={() => setDuzen(duzen === u.userId ? null : u.userId)}
                  aria-expanded={duzen === u.userId}
                  className={stil.dugme11}
                >
                  Düzenle
                </button>
              ) : (
                <span className={stil.metin32} />
              )}
            </div>
            {duzen === u.userId ? (
              <div className={stil.kutu26}>
                {p.rol === 'OWNER' ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const v = new FormData(e.currentTarget).get('sinir');
                      const n = Number.parseInt(String(v ?? ''), 10);
                      islem(
                        () =>
                          istek<Panel>(`/gallery/${p.accountId}/members/${u.userId}/limit`, {
                            method: 'PATCH',
                            body: { gunlukSinir: Number.isFinite(n) && n > 0 ? n : null },
                          }),
                        Number.isFinite(n) && n > 0
                          ? `${u.ad} günde en fazla ${n} ilk mesaj atabilir.`
                          : `${u.ad} için mesaj sınırı kaldırıldı.`,
                      );
                    }}
                    className={stil.kutu27}
                  >
                    <label htmlFor={`sinir-${u.userId}`} className={stil.etiket2}>
                      Günlük ilk mesaj sınırı
                    </label>
                    <input
                      id={`sinir-${u.userId}`}
                      name="sinir"
                      inputMode="numeric"
                      defaultValue={u.gunlukSinir ?? ''}
                      placeholder="Sınır yok"
                      className={stil.girdi4}
                    />
                    <button type="submit" className={stil.dugme10}>
                      Kaydet
                    </button>
                  </form>
                ) : null}
                {p.rol === 'OWNER' && u.rol !== 'OWNER'
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
                          className={stil.dugme10}
                        >
                          {MEMBER_ROLE_NAMES[r]} yap
                        </button>
                      ))
                  : null}
                {u.rol !== 'OWNER' ? (
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
                    className={stil.dugme12}
                  >
                    Ekipten çıkar
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
        {p.davetler.map((d) => (
          <div key={d.id} className={stil.kutu28}>
            <span aria-hidden="true" className={stil.metin33} />
            <span className={stil.metin26}>
              <span className={stil.metin27}>{d.telefon}</span>
              <span className={stil.metin34}>Davet bekliyor · {tarih(d.bitis)} tarihine kadar geçerli</span>
            </span>
            <span className={stil.metin30}>{d.rolAd}</span>
            <span className={stil.metin35} />
            <button
              type="button"
              onClick={() =>
                islem(
                  () => istek<Panel>(`/gallery/${p.accountId}/invites/${d.id}`, { method: 'DELETE' }),
                  'Davet iptal edildi.',
                )
              }
              className={stil.dugme13}
            >
              İptal et
            </button>
          </div>
        ))}
      </div>
      {doluKoltuk >= p.paket.calisan && davetEder ? (
        <p className={stil.metin36}>
          Paketindeki kullanıcı sınırına ulaştın. Daha büyük bir pakete geçince yeni çalışan ekleyebilirsin.
        </p>
      ) : null}
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
      <h1 className={stil.baslik1}>Galeri davetlerin</h1>
      <p className={stil.metin37}>
        Kabul edince galerinin paneline erişirsin; mesajlarda galeri adıyla birlikte kendi adın görünür.
      </p>
      <div className={stil.kutu23}>
        {davetler.length === 0 ? (
          <p className={stil.metin38}>
            Bekleyen davetin kalmadı. <Link href="/kurumsal-basvuru">Kendi galerin için başvur</Link>
          </p>
        ) : null}
        {davetler.map((d) => (
          <div key={d.id} className={stil.kutu29}>
            <span className={stil.metin39}>
              <span className={stil.metin27}>{d.galeri}</span>
              <span className={stil.metin29}>
                {d.rolAd} olarak davet edildin · {tarih(d.bitis)} tarihine kadar geçerli
              </span>
            </span>
            <button type="button" onClick={() => yanitla(d.id, false)} className={stil.dugme10}>
              Reddet
            </button>
            <button type="button" onClick={() => yanitla(d.id, true)} className={stil.dugme8}>
              Kabul et
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
