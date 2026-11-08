import { ILLER, type PublicCategory } from '@rengarenk/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { Suspense } from 'react';
import { getCategories } from '../../../lib/kategoriler';
import { binlik, butceAraligi, yilAraligi, zaman } from '../../../lib/talep-bicim';
import { AramaKaydet } from './arama-kaydet';
import { SiralamaSecimi } from './siralama';

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const TINTS = ['#EEF3FF', '#FFEEF6', '#FFF6DF', '#E7FAF0', '#F3EFFF', '#FFF0EA'];

export const metadata: Metadata = { title: 'Talepler · Rengarenk' };

type Q = Record<string, string | string[] | undefined>;
interface Sonuc {
  no: number;
  baslik: string;
  arac: string;
  kategori: { slug: string; name: string };
  yilMin: number | null;
  yilMax: number | null;
  kmMax: number | null;
  butceMin: number | null;
  butceMax: number | null;
  il: string | null;
  ilce: string | null;
  yayin: string;
}
interface Yanit {
  toplam: number;
  sayfa: number;
  boyut: number;
  sonuclar: Sonuc[];
  filtreler: {
    marka: { key: string; ad: string; n: number }[];
    seri: { key: string; ad: string; n: number }[];
    makyaj: { key: string; n: number }[];
    paket: { ad: string; n: number }[];
    il: { ad: string; n: number }[];
  };
}

const dizi = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);
const tek = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

/** Sorgudan API adresi ve sayfa bağlantıları için ortak parametreler */
function parametreler(q: Q, degis: Record<string, string | string[] | undefined> = {}) {
  const p = new URLSearchParams();
  const hepsi = { ...q, ...degis };
  for (const [k, v] of Object.entries(hepsi)) for (const x of dizi(v)) if (x) p.append(k, x);
  return p;
}

async function ara(q: Q): Promise<Yanit | null> {
  try {
    const r = await fetch(`${API}/talepler?${parametreler(q).toString()}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    return r.ok ? ((await r.json()) as Yanit) : null;
  } catch {
    return null;
  }
}

const kutuStil: CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: '1px solid #D5DAE5',
  borderRadius: 10,
  padding: 10,
  fontSize: 14,
  fontFamily: 'inherit',
};
const baslikStil: CSSProperties = { margin: '0 0 8px', fontSize: 15, fontWeight: 800 };

/** İşaret kutusu (Liste.dc.html): JavaScript olmadan da form gönderilir */
function Isaret({
  name,
  value,
  on,
  children,
}: {
  name: string;
  value: string;
  on: boolean;
  children: ReactNode;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '7px 2px',
        fontSize: 14,
        color: '#1E2333',
        cursor: 'pointer',
      }}
    >
      <input type="checkbox" name={name} value={value} defaultChecked={on} className="rr-isaret" />
      {children}
    </label>
  );
}

/**
 * Talep listesi ve arama (tasarım: Liste.dc.html; Karar 06.1, 06.3): solda filtreler, sağda sonuç tablosu.
 * Yalnızca yayındaki talepler listelenir; öne çıkanlar ödeme modülüyle üste alınacak.
 */
export default async function Talepler({ searchParams }: { searchParams: Promise<Q> }) {
  const q = await searchParams;
  const [y, kategoriler] = await Promise.all([ara(q), getCategories()]);
  const kategori = tek(q.kategori);
  const kat: PublicCategory | undefined = kategoriler.find(
    (c) => c.slug === kategori || c.children.some((x) => x.slug === kategori),
  );
  const altKat = kat?.children.find((x) => x.slug === kategori);
  const marka = tek(q.marka);
  const markaAd = y?.filtreler.marka.find((m) => m.key === marka)?.ad;
  const seriler = dizi(q.seri);
  const makyaj = dizi(q.makyaj);
  const paket = dizi(q.paket);
  const metin = tek(q.q);
  const baslik = metin
    ? `“${metin}” için talepler`
    : `${markaAd ?? altKat?.name ?? kat?.name ?? 'Tüm'} talepleri`;
  const aktif = [
    ...seriler.map((s) => y?.filtreler.seri.find((x) => x.key === s)?.ad ?? s),
    ...makyaj.map((m) => (m === 'makyajsiz' ? 'Makyajsız' : 'Makyajlı')),
    ...paket,
    tek(q.il),
    tek(q.yilMin) || tek(q.yilMax)
      ? `Model yılı ${yilAraligi(Number(tek(q.yilMin)) || null, Number(tek(q.yilMax)) || null)}`
      : null,
    tek(q.butceMin) || tek(q.butceMax)
      ? `Bütçe ${butceAraligi(Number(tek(q.butceMin)) || null, Number(tek(q.butceMax)) || null)}`
      : null,
    tek(q.telefon) ? 'Telefonla ulaşılabilir' : null,
  ].filter((x): x is string => Boolean(x));
  const sayfalar = y ? Math.ceil(y.toplam / y.boyut) : 0;
  const sayfa = y?.sayfa ?? 1;

  return (
    <main style={{ maxWidth: 1360, margin: '0 auto', padding: '20px 24px 64px' }}>
      <nav
        aria-label="Konum"
        style={{
          fontSize: 13.5,
          color: '#5A6073',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          marginBottom: 16,
        }}
      >
        <Link href="/talepler">Vasıta</Link>
        {kat ? (
          <>
            <span aria-hidden="true">›</span>
            {altKat || marka ? (
              <Link href={`/talepler?kategori=${kat.slug}`}>{kat.name}</Link>
            ) : (
              <span>{kat.name}</span>
            )}
          </>
        ) : null}
        {altKat ? (
          <>
            <span aria-hidden="true">›</span>
            {marka ? (
              <Link href={`/talepler?kategori=${altKat.slug}`}>{altKat.name}</Link>
            ) : (
              <span>{altKat.name}</span>
            )}
          </>
        ) : null}
        {markaAd ? (
          <>
            <span aria-hidden="true">›</span>
            <span>{markaAd}</span>
          </>
        ) : null}
      </nav>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 24 }}>
        <aside
          aria-label="Filtreler"
          style={{
            flex: '1 1 260px',
            maxWidth: 290,
            minWidth: 0,
            background: '#FFFFFF',
            border: '1px solid #E3E6EF',
            borderRadius: 18,
            padding: 18,
          }}
        >
          <form action="/talepler" method="get" id="filtre">
            {kategori ? <input type="hidden" name="kategori" value={kategori} /> : null}
            {marka ? <input type="hidden" name="marka" value={marka} /> : null}
            {metin ? <input type="hidden" name="q" value={metin} /> : null}
            {tek(q.sira) ? <input type="hidden" name="sira" value={tek(q.sira)} /> : null}
            <h2
              style={{
                margin: '0 0 4px',
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                color: '#5A6073',
              }}
            >
              Kategori
            </h2>
            <ul style={{ listStyle: 'none', margin: '0 0 16px', padding: 0, fontSize: 14 }}>
              <li style={{ padding: '6px 0', fontWeight: kat ? 400 : 800 }}>
                {kat ? (
                  <Link href="/talepler" style={{ color: '#3A4052' }}>
                    Vasıta
                  </Link>
                ) : (
                  'Vasıta'
                )}
              </li>
              {kat
                ? [kat, ...(altKat ? [altKat] : [])].map((c, i) => (
                    <li
                      key={c.slug}
                      style={{
                        padding: `6px 0 6px ${12 * (i + 1)}px`,
                        fontWeight: !marka && c.slug === kategori ? 800 : 400,
                      }}
                    >
                      <Link href={`/talepler?kategori=${c.slug}`} style={{ color: '#3A4052' }}>
                        {c.name}
                      </Link>
                    </li>
                  ))
                : kategoriler.map((c) => (
                    <li key={c.slug} style={{ padding: '6px 0 6px 12px' }}>
                      <Link href={`/talepler?kategori=${c.slug}`} style={{ color: '#3A4052' }}>
                        {c.name}
                      </Link>
                    </li>
                  ))}
              {kat && !altKat && kat.children.length
                ? kat.children.map((c) => (
                    <li key={c.slug} style={{ padding: '6px 0 6px 24px' }}>
                      <Link href={`/talepler?kategori=${c.slug}`} style={{ color: '#3A4052' }}>
                        {c.name}
                      </Link>
                    </li>
                  ))
                : null}
              {markaAd ? (
                <li style={{ padding: `6px 0 6px ${altKat ? 36 : 24}px`, fontWeight: 800 }}>{markaAd}</li>
              ) : null}
            </ul>

            {!marka && (y?.filtreler.marka.length ?? 0) > 0 ? (
              <>
                <h2 style={baslikStil}>Marka</h2>
                <ul style={{ listStyle: 'none', margin: '0 0 16px', padding: 0, fontSize: 14 }}>
                  {y?.filtreler.marka.map((m) => (
                    <li key={m.key} style={{ padding: '6px 0' }}>
                      <Link
                        href={`/talepler?${parametreler(q, { marka: m.key, seri: undefined, paket: undefined, sayfa: undefined }).toString()}`}
                        style={{ color: '#3A4052' }}
                      >
                        {m.ad} <span style={{ color: '#5A6073' }}>({m.n})</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {marka && (y?.filtreler.seri.length ?? 0) > 0 ? (
              <>
                <h2 style={baslikStil}>Seri</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
                  {y?.filtreler.seri.map((s) => (
                    <Isaret key={s.key} name="seri" value={s.key} on={seriler.includes(s.key)}>
                      {s.ad} <span style={{ color: '#5A6073' }}>({s.n})</span>
                    </Isaret>
                  ))}
                </div>
              </>
            ) : null}

            <h2 style={baslikStil}>Kasa ve makyaj</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
              {(['makyajsiz', 'makyajli'] as const).map((k) => (
                <Isaret key={k} name="makyaj" value={k} on={makyaj.includes(k)}>
                  {k === 'makyajsiz' ? 'Makyajsız' : 'Makyajlı'}
                </Isaret>
              ))}
            </div>

            {(y?.filtreler.paket.length ?? 0) > 0 ? (
              <>
                <h2 style={baslikStil}>Donanım paketi</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
                  {y?.filtreler.paket.slice(0, 12).map((p) => (
                    <Isaret key={p.ad} name="paket" value={p.ad} on={paket.includes(p.ad)}>
                      {p.ad}
                    </Isaret>
                  ))}
                </div>
              </>
            ) : null}

            <h2 style={baslikStil}>Model yılı</h2>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <label htmlFor="y1" className="sr-only">
                En az model yılı
              </label>
              <input
                id="y1"
                name="yilMin"
                inputMode="numeric"
                placeholder="En az"
                defaultValue={tek(q.yilMin)}
                style={kutuStil}
              />
              <label htmlFor="y2" className="sr-only">
                En çok model yılı
              </label>
              <input
                id="y2"
                name="yilMax"
                inputMode="numeric"
                placeholder="En çok"
                defaultValue={tek(q.yilMax)}
                style={kutuStil}
              />
            </div>

            <h2 style={baslikStil}>Bütçe (TL)</h2>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <label htmlFor="bt1" className="sr-only">
                En az bütçe
              </label>
              <input
                id="bt1"
                name="butceMin"
                inputMode="numeric"
                placeholder="En az"
                defaultValue={tek(q.butceMin)}
                style={kutuStil}
              />
              <label htmlFor="bt2" className="sr-only">
                En çok bütçe
              </label>
              <input
                id="bt2"
                name="butceMax"
                inputMode="numeric"
                placeholder="En çok"
                defaultValue={tek(q.butceMax)}
                style={kutuStil}
              />
            </div>

            <label
              htmlFor="il"
              style={{ display: 'block', margin: '0 0 8px', fontSize: 15, fontWeight: 800 }}
            >
              İl
            </label>
            <select
              id="il"
              name="il"
              defaultValue={tek(q.il) ?? ''}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                border: '1px solid #D5DAE5',
                borderRadius: 10,
                padding: '11px 10px',
                fontSize: 14,
                background: '#FFFFFF',
                color: '#1E2333',
                marginBottom: 16,
                fontFamily: 'inherit',
              }}
            >
              <option value="">Tüm iller</option>
              {ILLER.map((i) => (
                <option key={i.plaka} value={i.ad}>
                  {i.ad}
                </option>
              ))}
            </select>

            <h2 style={baslikStil}>Diğer</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 18 }}>
              <Isaret name="telefon" value="1" on={Boolean(tek(q.telefon))}>
                Telefonla ulaşılabilir
              </Isaret>
            </div>
            <button
              type="submit"
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
              Filtrele
            </button>
          </form>
        </aside>

        <div style={{ flex: '999 1 720px', minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{baslik}</h1>
              <p style={{ margin: '3px 0 0', fontSize: 14, color: '#5A6073' }}>
                {y ? `${binlik(y.toplam)} talep` : 'Talepler şu an yüklenemedi; biraz sonra yeniden dene.'}
              </p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
              <Suspense>
                <AramaKaydet ad={baslik} />
                <SiralamaSecimi deger={tek(q.sira) ?? 'onerilen'} />
              </Suspense>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {(aktif.length
              ? aktif
              : [`${baslik.replace(/ talepleri$/, '')} talepleri`.replace(/^Tüm talepleri$/, 'Tüm talepler')]
            ).map((a) => (
              <span
                key={a}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: '#EEF3FF',
                  borderRadius: 999,
                  padding: '6px 12px',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {a}
              </span>
            ))}
          </div>

          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E3E6EF',
              borderRadius: 18,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 16,
                padding: '12px 18px',
                background: '#F3F5FA',
                fontSize: 12.5,
                fontWeight: 700,
                color: '#5A6073',
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}
            >
              <span style={{ flex: '0 0 96px' }} />
              <span style={{ flex: '999 1 240px' }}>Talep</span>
              <span style={{ flex: '1 1 100px' }}>Model yılı</span>
              <span style={{ flex: '1 1 100px' }}>En fazla km</span>
              <span style={{ flex: '1 1 170px' }}>Bütçe</span>
              <span style={{ flex: '1 1 120px' }}>Konum</span>
            </div>
            {y && y.sonuclar.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  padding: '36px 18px',
                  borderTop: '1px solid #EEF0F5',
                  textAlign: 'center',
                  fontSize: 15,
                  color: '#5A6073',
                }}
              >
                Bu filtrelere uyan yayında talep yok.
              </p>
            ) : null}
            {(y?.sonuclar ?? []).map((t, i) => (
              <div
                key={t.no}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '10px 16px',
                  padding: '14px 18px',
                  borderTop: '1px solid #EEF0F5',
                  background: '#FFFFFF',
                }}
              >
                <Link
                  href={`/talep/${t.no}`}
                  aria-label={t.baslik}
                  style={{
                    flex: '0 0 96px',
                    height: 64,
                    borderRadius: 12,
                    background: TINTS[i % TINTS.length],
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flex: 'none',
                      width: 84,
                      maxWidth: '100%',
                      aspectRatio: '84 / 31',
                      borderRadius: 10,
                      background: 'linear-gradient(135deg, #C9D3E6, #EEF1F7)',
                    }}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#8C95AA"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M4 7h3l2-2h6l2 2h3v12H4z" />
                      <circle cx="12" cy="13" r="3.5" />
                    </svg>
                  </span>
                </Link>
                <div style={{ flex: '999 1 240px', minWidth: 0 }}>
                  <Link
                    href={`/talep/${t.no}`}
                    style={{
                      display: 'block',
                      fontSize: 15,
                      fontWeight: 800,
                      color: '#1E2333',
                      lineHeight: 1.35,
                    }}
                  >
                    {t.baslik}
                  </Link>
                  <span style={{ display: 'block', fontSize: 13, color: '#3A4052', marginTop: 3 }}>
                    {t.arac || t.kategori.name}
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    <span style={{ fontSize: 12.5, color: '#5A6073', padding: '3px 0' }}>
                      {zaman(t.yayin)}
                    </span>
                  </div>
                </div>
                <span style={{ flex: '1 1 100px', fontSize: 14, fontWeight: 600 }}>
                  {yilAraligi(t.yilMin, t.yilMax) || '—'}
                </span>
                <span style={{ flex: '1 1 100px', fontSize: 14, fontWeight: 600 }}>
                  {t.kmMax ? `${binlik(t.kmMax)} km` : '—'}
                </span>
                <span style={{ flex: '1 1 170px', fontSize: 14.5, fontWeight: 800, color: '#2450C8' }}>
                  {butceAraligi(t.butceMin, t.butceMax)}
                </span>
                <span style={{ flex: '1 1 120px', fontSize: 13.5, color: '#3A4052' }}>
                  {[t.il, t.ilce].filter(Boolean).join(', ')}
                </span>
              </div>
            ))}
          </div>
          {sayfalar > 1 ? (
            <nav
              aria-label="Sayfalar"
              style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 18 }}
            >
              {Array.from(
                { length: Math.min(sayfalar, 7) },
                (_, i) => i + Math.max(1, Math.min(sayfa - 3, sayfalar - 6)),
              ).map((n) =>
                n === sayfa ? (
                  <span
                    key={n}
                    aria-current="page"
                    style={{
                      minWidth: 40,
                      height: 40,
                      borderRadius: 10,
                      background: '#5B8CFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                    }}
                  >
                    {n}
                  </span>
                ) : (
                  <Link
                    key={n}
                    href={`/talepler?${parametreler(q, { sayfa: String(n) }).toString()}`}
                    style={{
                      minWidth: 40,
                      height: 40,
                      borderRadius: 10,
                      background: '#FFFFFF',
                      border: '1px solid #E3E6EF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      color: '#1E2333',
                    }}
                  >
                    {n}
                  </Link>
                ),
              )}
              {sayfa < sayfalar ? (
                <Link
                  href={`/talepler?${parametreler(q, { sayfa: String(sayfa + 1) }).toString()}`}
                  style={{
                    padding: '0 14px',
                    height: 40,
                    borderRadius: 10,
                    background: '#FFFFFF',
                    border: '1px solid #E3E6EF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    color: '#1E2333',
                  }}
                >
                  Sonraki
                </Link>
              ) : null}
            </nav>
          ) : null}
        </div>
      </div>
    </main>
  );
}
