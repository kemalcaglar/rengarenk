import { PAINT_STATES } from '@rengarenk/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AracSemasiGorunum } from '../../../../components/arac-semasi';
import { binlik } from '../../../../lib/talep-bicim';
import { AracFavori, FotoGezgini, IlanSikayet, Iletisim, TalebineUyuyor } from './arac-istemci';

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
const kart = { background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 18 } as const;
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
    <div style={{ maxWidth: 1360, margin: '0 auto', padding: '18px 24px 64px' }}>
      <nav aria-label="Konum" style={{ fontSize: 13.5, color: '#5A6073', marginBottom: 10 }}>
        <Link href={`/galeri/${a.galeri.slug}`}>{a.galeri.ad}</Link> › {a.kategori.name} ›{' '}
        {[a.marka, a.seri, a.model].filter(Boolean).join(' › ')}
      </nav>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: '8px 16px',
          marginBottom: 14,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: -0.4 }}>{a.baslik}</h1>
        <span style={{ fontSize: 13.5, color: '#5A6073' }}>
          Portföy no {a.no} · {tarih(a.yayin)}
        </span>
      </div>

      <TalebineUyuyor no={a.no} />

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 20 }}>
        <div style={{ flex: '999 1 640px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FotoGezgini fotolar={a.fotolar} ad={a.ad} />

          <section style={{ ...kart, padding: 22 }} aria-labelledby="ab">
            <h2 id="ab" style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 800 }}>
              Araç bilgileri
            </h2>
            <div className="rr-iki-sutun" style={{ columnGap: 28, rowGap: 0 }}>
              {a.bilgiler.map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '11px 0',
                    borderBottom: '1px solid #EEF0F5',
                    fontSize: 14.5,
                  }}
                >
                  <span style={{ color: '#5A6073' }}>{k}</span>
                  <span style={{ fontWeight: 700, textAlign: 'right' }}>{v}</span>
                </div>
              ))}
            </div>
          </section>

          <section style={{ ...kart, padding: 22 }} aria-labelledby="bh">
            <h2 id="bh" style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 800 }}>
              Boya, değişen ve hasar
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 24 }}>
              <AracSemasiGorunum parts={parts} etiket={`Parça bazında boya ve değişen: ${a.hasar.ozet}`} />
              <div
                style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 13, fontWeight: 600 }}>
                  {a.hasar.durumlar.map((d) => (
                    <span key={d.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 4,
                          background: PAINT_STATES.find((s) => s.key === d.key)?.renk,
                          border: '1px solid #AEB5C4',
                        }}
                      />
                      {DURUM_AD[d.key]} · {d.sayi ? `${d.sayi} parça` : 'yok'}
                    </span>
                  ))}
                </div>
                {a.hasar.parcalar
                  .filter((p) => p.durum !== 'orijinal')
                  .map((p) => (
                    <div
                      key={p.key}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        border: '1px solid #EEF0F5',
                        borderRadius: 12,
                        padding: '11px 14px',
                      }}
                    >
                      <span style={{ fontSize: 14.5, fontWeight: 700 }}>{p.ad}</span>
                      <span style={{ fontSize: 13.5, fontWeight: 800, color: '#7A5300' }}>
                        {DURUM_AD[p.durum]}
                      </span>
                    </div>
                  ))}
                {a.hasar.satirlar.map(([k, v, iyi]) => (
                  <div
                    key={k}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      border: '1px solid #EEF0F5',
                      borderRadius: 12,
                      padding: '11px 14px',
                    }}
                  >
                    <span style={{ fontSize: 14.5, fontWeight: 700 }}>{k}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: iyi ? '#11683F' : '#7A5300' }}>
                      {v}
                    </span>
                  </div>
                ))}
                {a.ekspertiz ? (
                  <a
                    href={`${GENEL}${a.ekspertiz.url}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      background: '#EEF3FF',
                      borderRadius: 12,
                      padding: '12px 14px',
                      fontSize: 14.5,
                      fontWeight: 800,
                    }}
                  >
                    Ekspertiz raporu · {tarih(a.ekspertiz.tarih)}
                    <span style={{ fontSize: 13 }}>PDF’i aç</span>
                  </a>
                ) : null}
                <p style={{ margin: 0, fontSize: 12.5, color: '#5A6073' }}>
                  Boya, değişen ve hasar bilgileri galerinin beyanıdır; ekspertiz raporu ile karşılaştırarak
                  kontrol et.
                </p>
              </div>
            </div>
          </section>

          {a.aciklama ? (
            <section style={{ ...kart, padding: 22 }} aria-labelledby="ac">
              <h2 id="ac" style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 800 }}>
                Galerinin açıklaması
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: 15,
                  lineHeight: 1.65,
                  color: '#2E3344',
                  whiteSpace: 'pre-line',
                }}
              >
                {a.aciklama}
              </p>
            </section>
          ) : null}
        </div>

        <aside
          aria-label="Fiyat ve iletişim"
          style={{
            flex: '1 1 320px',
            maxWidth: 380,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            position: 'sticky',
            top: 16,
          }}
        >
          <section style={{ ...kart, padding: 20 }}>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.5 }}>{binlik(a.fiyat)} TL</div>
            <div style={{ fontSize: 13, color: '#5A6073', marginTop: 2 }}>
              Galerinin belirlediği satış fiyatı
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '16px 0',
                marginTop: 14,
                borderTop: '1px solid #EEF0F5',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  flex: 'none',
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: '#FFF6DF',
                  color: '#7A5300',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                }}
              >
                {basHarf(a.galeri.ad)}
              </span>
              <span style={{ minWidth: 0 }}>
                <Link
                  href={`/galeri/${a.galeri.slug}`}
                  style={{ display: 'block', fontSize: 16, fontWeight: 800, color: '#1E2333' }}
                >
                  {a.galeri.ad}
                </Link>
                {a.temsilci ? (
                  <span style={{ display: 'block', fontSize: 13, color: '#5A6073', marginTop: 2 }}>
                    Satış temsilcisi {a.temsilci}
                  </span>
                ) : null}
                <span
                  style={{
                    display: 'inline-block',
                    marginTop: 5,
                    fontSize: 12,
                    fontWeight: 800,
                    padding: '3px 9px',
                    borderRadius: 999,
                    background: '#E7FAF0',
                    color: '#11683F',
                  }}
                >
                  ✓ Onaylı galeri
                </span>
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Iletisim no={a.no} />
            </div>
            <AracFavori no={a.no} />
            <p style={{ margin: '10px 0 0', fontSize: 12, color: '#5A6073' }}>
              {a.galeri.isletmeAdi}
              {a.galeri.yetkiNo ? ` · Yetki belgesi no ${a.galeri.yetkiNo}` : ''}
            </p>
          </section>
          <section style={{ background: '#E7FAF0', borderRadius: 18, padding: 18 }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 15.5, fontWeight: 800, color: '#11683F' }}>
              Doğrulamalar
            </h2>
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                fontSize: 13.5,
                lineHeight: 1.45,
              }}
            >
              {a.dogrulamalar.map((d) => (
                <li key={d}>✓ {d}</li>
              ))}
            </ul>
          </section>
          <section
            style={{ background: '#FFF6DF', borderRadius: 18, padding: 18, fontSize: 13.5, lineHeight: 1.5 }}
          >
            <strong style={{ display: 'block', marginBottom: 4 }}>Güvenli alışveriş</strong>
            Aracı görmeden kapora veya ön ödeme gönderme. Ödemeyi noterde satış sırasında yap.
          </section>
          <IlanSikayet no={a.no} />
        </aside>
      </div>
    </div>
  );
}
