import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cx } from '../../../../lib/cx';
import { binlik } from '../../../../lib/talep-bicim';
import stil from './page.module.css';
import { TakipDugmesi } from './takip';

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Profil {
  slug: string;
  ad: string;
  isletmeAdi: string;
  yetkiNo: string | null;
  tur: string;
  alan: string;
  il: string;
  ilce: string;
  adres: string;
  hakkinda: string | null;
  calismaSaatleri: string | null;
  uyelik: string;
  satisTemsilcisi: number;
  portfoy: { toplam: number; araclar: unknown[] };
  /** Alıcının gördüğü rozetler (Karar 55): onaylı galeri, hızlı yanıt, güvenilir satıcı */
  rozetler: { key: 'onay' | 'hizli' | 'guven'; ad: string; bg: string; renk: string; aciklama: string }[];
  ortalamaYanitDakika: number | null;
}

/** "18 dk", "2 sa" */
const sureYaz = (dk: number | null | undefined) =>
  typeof dk !== 'number' ? '—' : dk < 60 ? `${Math.max(1, Math.round(dk))} dk` : `${Math.round(dk / 60)} sa`;

interface Kart {
  no: number;
  ad: string;
  ozellik: string;
  fiyat: number;
  foto: string | null;
  fotoSayisi: number;
  yayin: string;
}
const GENEL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function araclar(slug: string): Promise<Kart[]> {
  try {
    const r = await fetch(`${API}/galeriler/${encodeURIComponent(slug)}/araclar`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    return r.ok ? ((await r.json()) as Kart[]) : [];
  } catch {
    return [];
  }
}

const gun = (iso: string) => {
  const n = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return n <= 0 ? 'Bugün' : n === 1 ? 'Dün' : `${n} gün önce`;
};

async function profil(slug: string): Promise<Profil | null> {
  try {
    const r = await fetch(`${API}/galeriler/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(3000),
    });
    return r.ok ? ((await r.json()) as Profil) : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await profil((await params).slug);
  return { title: p ? `${p.ad} · Rengarenk` : 'Galeri · Rengarenk' };
}

/** Yıla gelen "-den/-dan/-ten/-tan" eki okunuşa göre: 2026’dan, 2027’den, 2030’dan */
function yilEki(yil: number) {
  const birler = ['', 'den', 'den', 'ten', 'ten', 'ten', 'dan', 'den', 'den', 'dan'];
  const onlar = ['den', 'dan', 'den', 'dan', 'tan', 'den', 'tan', 'ten', 'den', 'dan'];
  return yil % 10 ? birler[yil % 10] : onlar[Math.floor(yil / 10) % 10];
}

const basHarf = (ad: string) =>
  ad
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toLocaleUpperCase('tr-TR'))
    .join('');

/**
 * Galeri profili (tasarım: GaleriProfil.dc.html; Karar 07, 17). İşletme adı ve yetki belgesi numarası profilde
 * görünür (yönetmelik m.21). Rozetler (Karar 55) alıcı yıldızları, yanıt süresi ve şikâyet oranından her gece hesaplanır;
 * puan sayı olarak gösterilmez. Galeri takip edilebilir (Karar 28).
 */
export default async function GaleriProfili({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const [p, liste] = await Promise.all([profil(slug), araclar(slug)]);
  if (!p) notFound();
  const uyelik = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    month: 'long',
    year: 'numeric',
  }).format(new Date(p.uyelik));
  const istatistik: [string, string][] = [
    [String(p.portfoy.toplam), 'yayında araç'],
    [sureYaz(p.ortalamaYanitDakika), 'ortalama yanıt süresi'],
    [String(p.satisTemsilcisi), 'satış temsilcisi'],
    [p.alan, p.yetkiNo ? 'yetki belgesi türü' : 'faaliyet alanı'],
  ];
  return (
    <div className={stil.kutu1}>
      <section aria-labelledby="gad" className={stil.kutu2}>
        <div aria-hidden="true" className={stil.kutu3} />
        <div className={stil.kutu4}>
          <span aria-hidden="true" className={stil.metin1}>
            {basHarf(p.ad)}
          </span>
          <div className={`rr-galeri-ad ${stil.kutu5}`}>
            <h1 id="gad" className={stil.baslik1}>
              {p.ad}
            </h1>
            <div className={stil.kutu6}>
              <span className={stil.metin2}>✓ Onaylı {p.tur.toLocaleLowerCase('tr-TR')}</span>
              {p.yetkiNo ? <span className={stil.metin3}>Yetki belgesi doğrulandı</span> : null}
              {(p.rozetler ?? [])
                .filter((r) => r.key !== 'onay')
                .map((r) => (
                  <span
                    key={r.key}
                    title={r.aciklama}
                    className={stil.metin4}
                    style={{ background: r.bg, color: r.renk }}
                  >
                    {r.ad}
                  </span>
                ))}
              <span className={stil.metin5}>
                {uyelik}’{yilEki(new Date(p.uyelik).getFullYear())} beri Rengarenk’te
              </span>
            </div>
            <p className={stil.metin6}>
              {[`${p.il}, ${p.ilce}`, p.adres, p.calismaSaatleri].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className={`rr-galeri-dugme ${stil.kutu7}`}>
            <TakipDugmesi slug={p.slug} />
          </div>
        </div>
        <div className={`rr-dort-sutun ${stil.kutu8}`}>
          {istatistik.map(([d, k], i) => (
            <div key={k} className={cx(stil.kutu9, i < 3 ? stil.kutu10 : stil.kutu11)}>
              <div className={stil.kutu12}>{d}</div>
              <div className={stil.kutu13}>{k}</div>
            </div>
          ))}
        </div>
      </section>

      {liste.length ? (
        <div className={`rr-uc-sutun ${stil.kutu14}`}>
          {liste.map((a, i) => (
            <Link key={a.no} href={`/arac/${a.no}`} className={stil.bag1}>
              <div
                className={stil.kutu15}
                style={{
                  background: ['#EEF3FF', '#FFEEF6', '#FFF6DF', '#E7FAF0', '#F3EFFF', '#FFF0EA'][i % 6],
                }}
              >
                {a.foto ? (
                  // biome-ignore lint/performance/noImgElement: galeri fotoğrafı API'den akar
                  <img src={`${GENEL}${a.foto}`} alt="" loading="lazy" className={stil.gorsel1} />
                ) : null}
                <span className={stil.metin7}>EİDS doğrulandı</span>
                <span className={stil.metin8}>{a.fotoSayisi} fotoğraf</span>
              </div>
              <div className={stil.kutu16}>
                <div className={stil.kutu17}>{a.ad}</div>
                <div className={stil.kutu18}>{a.ozellik}</div>
                <div className={stil.kutu19}>
                  <span className={stil.metin9}>{binlik(a.fiyat)} TL</span>
                  <span className={stil.metin10}>{gun(a.yayin)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className={stil.kutu20}>Bu galerinin henüz yayında aracı yok.</div>
      )}

      <section aria-labelledby="hk" className={stil.kutu21}>
        <h2 id="hk" className={stil.baslik2}>
          Hakkında
        </h2>
        {p.hakkinda ? <p className={stil.metin11}>{p.hakkinda}</p> : null}
        <p className={cx(stil.metin10, p.hakkinda ? stil.metin12 : stil.metin13)}>
          Ticari unvan: {p.isletmeAdi}
          {p.yetkiNo ? ` · Yetki belgesi no ${p.yetkiNo}` : ''} · Yetki belgesi ve vergi bilgileri Rengarenk
          tarafından doğrulanmıştır.
        </p>
      </section>
    </div>
  );
}
