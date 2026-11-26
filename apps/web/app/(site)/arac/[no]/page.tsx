import { PAINT_STATES } from '@rengarenk/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AracSemasiGorunum } from '../../../../components/arac-semasi';
import { cx } from '../../../../lib/cx';
import { binlik } from '../../../../lib/talep-bicim';
import { AracFavori, FotoGezgini, IlanSikayet, Iletisim, TalebineUyuyor } from './arac-istemci';
import stil from './page.module.css';

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const GENEL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Arac {
  no: number;
  ad: string;
  baslik: string;
  kategori: { slug: string; name: string };
  marka: string;
  seri: string | null;
  model: string | null;
  galeri: { slug: string; ad: string; isletmeAdi: string; yetkiNo: string | null };
  temsilci: string | null;
  fotolar: string[];
  bilgiler: [string, string][];
  hasar: {
    ozet: string;
    parcalar: { key: string; ad: string; durum: string }[];
    durumlar: { key: string; ad: string; renk: string; sayi: number }[];
    satirlar: [string, string, boolean][];
  };
  ekspertiz: { tarih: string; url: string } | null;
  aciklama: string | null;
  fiyat: number;
  yayin: string;
  dogrulamalar: string[];
}

async function al(no: string): Promise<Arac | null> {
  if (!/^\d+$/.test(no)) return null;
  try {
    const r = await fetch(`${API}/araclar/${no}`, { cache: 'no-store', signal: AbortSignal.timeout(3000) });
    return r.ok ? ((await r.json()) as Arac) : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ no: string }> }): Promise<Metadata> {
  const a = await al((await params).no);
  return { title: a ? `${a.ad} · ${a.galeri.ad} · Rengarenk` : 'Araç · Rengarenk' };
}

const tarih = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
const basHarf = (ad: string) =>
  ad
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0]?.toLocaleUpperCase('tr-TR'))
    .join('');
const DURUM_AD: Record<string, string> = {
  orijinal: 'Orijinal',
  lokal: 'Lokal boyalı',
  boya: 'Boyalı',
  degisen: 'Değişen',
};

/**
 * Portföy aracı sayfası (tasarım: PortfoyArac.dc.html; Karar 07, 17). Yalnızca EİDS onaylı ve yayındaki araç görünür;
 * plakanın yalnızca il kodu yazılır. "Talebine uyuyor" bandı girişli alıcının yayındaki talepleriyle hesaplanır; mesaj
 * Aşama 5'in ikinci bölümünde, şikayet Aşama 8'de (Karar 53); araç favorisi "Favorilere ekle" (Favoriler › Favori araçlar).
 */
export default async function AracSayfasi({ params }: { params: Promise<{ no: string }> }) {
  const a = await al((await params).no);
  if (!a) notFound();
  const parts = Object.fromEntries(a.hasar.parcalar.map((p) => [p.key, p.durum]));
  return (
    <div className={stil.kutu1}>
      <nav aria-label="Konum" className={stil.kutu2}>
        <Link href={`/galeri/${a.galeri.slug}`}>{a.galeri.ad}</Link> › {a.kategori.name} ›{' '}
        {[a.marka, a.seri, a.model].filter(Boolean).join(' › ')}
      </nav>
      <div className={stil.kutu3}>
        <h1 className={stil.baslik1}>{a.baslik}</h1>
        <span className={stil.metin1}>
          Portföy no {a.no} · {tarih(a.yayin)}
        </span>
      </div>

      <TalebineUyuyor no={a.no} />

      <div className={stil.kutu4}>
        <div className={stil.kutu5}>
          <FotoGezgini fotolar={a.fotolar} ad={a.ad} />

          <section className={stil.kutu6} aria-labelledby="ab">
            <h2 id="ab" className={stil.baslik2}>
              Araç bilgileri
            </h2>
            <div className={`rr-iki-sutun ${stil.kutu7}`}>
              {a.bilgiler.map(([k, v]) => (
                <div key={k} className={stil.kutu8}>
                  <span className={stil.metin2}>{k}</span>
                  <span className={stil.metin3}>{v}</span>
                </div>
              ))}
            </div>
          </section>

          <section className={stil.kutu6} aria-labelledby="bh">
            <h2 id="bh" className={stil.baslik2}>
              Boya, değişen ve hasar
            </h2>
            <div className={stil.kutu9}>
              <AracSemasiGorunum parts={parts} etiket={`Parça bazında boya ve değişen: ${a.hasar.ozet}`} />
              <div className={stil.kutu10}>
                <div className={stil.kutu11}>
                  {a.hasar.durumlar.map((d) => (
                    <span key={d.key} className={stil.metin4}>
                      <span
                        className={stil.metin5}
                        style={{ background: PAINT_STATES.find((s) => s.key === d.key)?.renk }}
                      />
                      {DURUM_AD[d.key]} · {d.sayi ? `${d.sayi} parça` : 'yok'}
                    </span>
                  ))}
                </div>
                {a.hasar.parcalar
                  .filter((p) => p.durum !== 'orijinal')
                  .map((p) => (
                    <div key={p.key} className={stil.kutu12}>
                      <span className={stil.metin6}>{p.ad}</span>
                      <span className={stil.metin7}>{DURUM_AD[p.durum]}</span>
                    </div>
                  ))}
                {a.hasar.satirlar.map(([k, v, iyi]) => (
                  <div key={k} className={stil.kutu12}>
                    <span className={stil.metin6}>{k}</span>
                    <span className={cx(stil.metin8, iyi ? stil.metin9 : stil.metin10)}>{v}</span>
                  </div>
                ))}
                {a.ekspertiz ? (
                  <a
                    href={`${GENEL}${a.ekspertiz.url}`}
                    target="_blank"
                    rel="noreferrer"
                    className={stil.bag1}
                  >
                    Ekspertiz raporu · {tarih(a.ekspertiz.tarih)}
                    <span className={stil.metin11}>PDF’i aç</span>
                  </a>
                ) : null}
                <p className={stil.metin12}>
                  Boya, değişen ve hasar bilgileri galerinin beyanıdır; ekspertiz raporu ile karşılaştırarak
                  kontrol et.
                </p>
              </div>
            </div>
          </section>

          {a.aciklama ? (
            <section className={stil.kutu6} aria-labelledby="ac">
              <h2 id="ac" className={stil.baslik3}>
                Galerinin açıklaması
              </h2>
              <p className={stil.metin13}>{a.aciklama}</p>
            </section>
          ) : null}
        </div>

        <aside aria-label="Fiyat ve iletişim" className={stil.kutu13}>
          <section className={stil.kutu14}>
            <div className={stil.kutu15}>{binlik(a.fiyat)} TL</div>
            <div className={stil.kutu16}>Galerinin belirlediği satış fiyatı</div>
            <div className={stil.kutu17}>
              <span aria-hidden="true" className={stil.metin14}>
                {basHarf(a.galeri.ad)}
              </span>
              <span className={stil.metin15}>
                <Link href={`/galeri/${a.galeri.slug}`} className={stil.bag2}>
                  {a.galeri.ad}
                </Link>
                {a.temsilci ? <span className={stil.metin16}>Satış temsilcisi {a.temsilci}</span> : null}
                <span className={stil.metin17}>✓ Onaylı galeri</span>
              </span>
            </div>
            <div className={stil.kutu18}>
              <Iletisim no={a.no} />
            </div>
            <AracFavori no={a.no} />
            <p className={stil.metin18}>
              {a.galeri.isletmeAdi}
              {a.galeri.yetkiNo ? ` · Yetki belgesi no ${a.galeri.yetkiNo}` : ''}
            </p>
          </section>
          <section className={stil.kutu19}>
            <h2 className={stil.baslik4}>Doğrulamalar</h2>
            <ul className={stil.liste1}>
              {a.dogrulamalar.map((d) => (
                <li key={d}>✓ {d}</li>
              ))}
            </ul>
          </section>
          <section className={stil.kutu20}>
            <strong className={stil.metin19}>Güvenli alışveriş</strong>
            Aracı görmeden kapora veya ön ödeme gönderme. Ödemeyi noterde satış sırasında yap.
          </section>
          <IlanSikayet no={a.no} />
        </aside>
      </div>
    </div>
  );
}
