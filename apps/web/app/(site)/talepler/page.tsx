import { ILLER, type PublicCategory } from '@rengarenk/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { AracKapak } from '../../../components/arac-kapak';
import { Banner } from '../../../components/banner';
import { DarAcilir } from '../../../components/dar-acilir';
import { getCategories } from '../../../lib/kategoriler';
import { binlik, butceAraligi, yilAraligi, zaman } from '../../../lib/talep-bicim';
import { AramaBildir } from './arama-bildir';
import { AramaKaydet } from './arama-kaydet';
import { SiralamaSecimi } from './siralama';
import css from './talepler.module.css';

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
/** Fotoğrafı olmayan satırların sırayla değişen zemini (talepler.module.css › .ton0–5) */
const TONLAR = [css.ton0, css.ton1, css.ton2, css.ton3, css.ton4, css.ton5];
/** Görseller tarayıcıdan istenir: genel API adresi */
const GORSEL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

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
  foto: string | null;
  markaAd?: string | null;
  seriAd?: string | null;
  /** Öne çıkarmalar (Karar 12.6) */
  acil: boolean;
  ustSira: boolean;
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
    <label className={css.isaret}>
      <input type="checkbox" name={name} value={value} defaultChecked={on} className="rr-isaret" />
      {children}
    </label>
  );
}

/** Birden çok sınıfı birleştirir; boş olanlar atlanır */
const sinif = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

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
    : markaAd || altKat || kat
      ? `${markaAd ?? altKat?.name ?? kat?.name} talepleri`
      : 'Tüm talepler';
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
    <main className={sinif(css.sayfa, 'rr-sayfa')}>
      <Banner yer="talep_listesi" className={css.banner} />
      <nav aria-label="Konum" className={css.konum}>
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
      <div className={css.duzen}>
        <DarAcilir etiket="Filtreler" ariaLabel="Filtreler" className={sinif('rr-filtre', css.filtre)}>
          <form action="/talepler" method="get" id="filtre">
            {kategori ? <input type="hidden" name="kategori" value={kategori} /> : null}
            {marka ? <input type="hidden" name="marka" value={marka} /> : null}
            {metin ? <input type="hidden" name="q" value={metin} /> : null}
            {tek(q.sira) ? <input type="hidden" name="sira" value={tek(q.sira)} /> : null}
            <h2 className={css.ustBaslik}>Kategori</h2>
            <ul className={css.liste}>
              <li className={sinif(css.oge, kat ? css.ince : css.kalin)}>
                {kat ? (
                  <Link href="/talepler" className={css.altBaglanti}>
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
                      className={sinif(
                        i ? css.girinti2 : css.girinti1,
                        !marka && c.slug === kategori ? css.kalin : css.ince,
                      )}
                    >
                      <Link href={`/talepler?kategori=${c.slug}`} className={css.altBaglanti}>
                        {c.name}
                      </Link>
                    </li>
                  ))
                : kategoriler.map((c) => (
                    <li key={c.slug} className={css.girinti1}>
                      <Link href={`/talepler?kategori=${c.slug}`} className={css.altBaglanti}>
                        {c.name}
                      </Link>
                    </li>
                  ))}
              {kat && !altKat && kat.children.length
                ? kat.children.map((c) => (
                    <li key={c.slug} className={css.girinti2}>
                      <Link href={`/talepler?kategori=${c.slug}`} className={css.altBaglanti}>
                        {c.name}
                      </Link>
                    </li>
                  ))
                : null}
              {markaAd ? (
                <li className={sinif(altKat ? css.girinti3 : css.girinti2, css.kalin)}>{markaAd}</li>
              ) : null}
            </ul>

            {!marka && (y?.filtreler.marka.length ?? 0) > 0 ? (
              <>
                <h2 className={css.baslik}>Marka</h2>
                <ul className={css.liste}>
                  {y?.filtreler.marka.map((m) => (
                    <li key={m.key} className={css.oge}>
                      <Link
                        href={`/talepler?${parametreler(q, { marka: m.key, seri: undefined, paket: undefined, sayfa: undefined }).toString()}`}
                        className={css.altBaglanti}
                      >
                        {m.ad} <span className={css.soluk}>({m.n})</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {marka && (y?.filtreler.seri.length ?? 0) > 0 ? (
              <>
                <h2 className={css.baslik}>Seri</h2>
                <div className={css.isaretler}>
                  {y?.filtreler.seri.map((s) => (
                    <Isaret key={s.key} name="seri" value={s.key} on={seriler.includes(s.key)}>
                      {s.ad} <span className={css.soluk}>({s.n})</span>
                    </Isaret>
                  ))}
                </div>
              </>
            ) : null}

            <h2 className={css.baslik}>Kasa ve makyaj</h2>
            <div className={css.isaretler}>
              {(['makyajsiz', 'makyajli'] as const).map((k) => (
                <Isaret key={k} name="makyaj" value={k} on={makyaj.includes(k)}>
                  {k === 'makyajsiz' ? 'Makyajsız' : 'Makyajlı'}
                </Isaret>
              ))}
            </div>

            {(y?.filtreler.paket.length ?? 0) > 0 ? (
              <>
                <h2 className={css.baslik}>Donanım paketi</h2>
                <div className={css.isaretler}>
                  {y?.filtreler.paket.slice(0, 12).map((p) => (
                    <Isaret key={p.ad} name="paket" value={p.ad} on={paket.includes(p.ad)}>
                      {p.ad}
                    </Isaret>
                  ))}
                </div>
              </>
            ) : null}

            <h2 className={css.baslik}>Model yılı</h2>
            <div className={css.aralik}>
              <label htmlFor="y1" className="sr-only">
                En az model yılı
              </label>
              <input
                id="y1"
                name="yilMin"
                inputMode="numeric"
                placeholder="En az"
                defaultValue={tek(q.yilMin)}
                className={css.kutu}
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
                className={css.kutu}
              />
            </div>

            <h2 className={css.baslik}>Bütçe (TL)</h2>
            <div className={css.aralik}>
              <label htmlFor="bt1" className="sr-only">
                En az bütçe
              </label>
              <input
                id="bt1"
                name="butceMin"
                inputMode="numeric"
                placeholder="En az"
                defaultValue={tek(q.butceMin)}
                className={css.kutu}
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
                className={css.kutu}
              />
            </div>

            <label htmlFor="il" className={css.ilEtiket}>
              İl
            </label>
            <select id="il" name="il" defaultValue={tek(q.il) ?? ''} className={css.secim}>
              <option value="">Tüm iller</option>
              {ILLER.map((i) => (
                <option key={i.plaka} value={i.ad}>
                  {i.ad}
                </option>
              ))}
            </select>

            <h2 className={css.baslik}>Diğer</h2>
            <div className={css.isaretlerSon}>
              <Isaret name="telefon" value="1" on={Boolean(tek(q.telefon))}>
                Telefonla ulaşılabilir
              </Isaret>
            </div>
            <button type="submit" className={css.filtrele}>
              Filtrele
            </button>
          </form>
        </DarAcilir>

        <div className={css.sonuclar}>
          <div className={css.ust}>
            <div>
              <h1 className={css.h1}>{baslik}</h1>
              <p className={css.sayi}>
                {y ? `${binlik(y.toplam)} talep` : 'Talepler şu an yüklenemedi; biraz sonra yeniden dene.'}
              </p>
            </div>
            <div className={css.araclar}>
              <Suspense>
                <AramaKaydet ad={baslik} />
                <AramaBildir sorgu={q} />
                <SiralamaSecimi deger={tek(q.sira) ?? 'onerilen'} className={css.siralama} />
              </Suspense>
            </div>
          </div>

          <div className={css.etiketler}>
            {(aktif.length ? aktif : [baslik]).map((a) => (
              <span key={a} className={css.etiket}>
                {a}
              </span>
            ))}
          </div>

          <div className={css.tablo}>
            <div className={sinif('rr-yalniz-genis', css.tabloBaslik)}>
              <span className={css.sGorsel} />
              <span className={css.sTalep}>Talep</span>
              <span className={css.sYil}>Model yılı</span>
              <span className={css.sYil}>En fazla km</span>
              <span className={css.sButce}>Bütçe</span>
              <span className={css.sKonum}>Konum</span>
            </div>
            {y && y.sonuclar.length === 0 ? (
              <p className={css.bos}>Bu filtrelere uyan yayında talep yok.</p>
            ) : null}
            {(y?.sonuclar ?? []).map((t, i) => (
              <div key={t.no} className={sinif('rr-talep-satir', css.satir, t.ustSira && css.satirUst)}>
                <Link
                  href={`/talep/${t.no}`}
                  aria-label={t.baslik}
                  className={sinif(css.gorsel, TONLAR[i % TONLAR.length])}
                >
                  {t.foto ? (
                    // biome-ignore lint/performance/noImgElement: katalog görseli API'den akar; Next görüntü iyileştirmesi gerekmez
                    <img src={`${GORSEL}${t.foto}`} alt="" loading="lazy" className={css.foto} />
                  ) : (
                    <AracKapak boyut="mini" marka={t.markaAd} seri={t.seriAd ?? t.kategori.name} />
                  )}
                </Link>
                <div className={css.govde}>
                  <Link href={`/talep/${t.no}`} className={css.talepBaslik}>
                    {t.baslik}
                  </Link>
                  <span className={css.arac}>{t.arac || t.kategori.name}</span>
                  <div className={css.rozetler}>
                    {t.acil ? <span className={css.rozetAcil}>Acil arıyorum</span> : null}
                    {t.ustSira ? <span className={css.rozetUst}>Öne çıkan</span> : null}
                    <span className={css.zaman}>{zaman(t.yayin)}</span>
                  </div>
                </div>
                <span className={sinif('rr-ts-bilgi', css.bilgi)}>
                  {yilAraligi(t.yilMin, t.yilMax) || '—'}
                </span>
                <span className={sinif('rr-ts-bilgi', css.bilgi)} data-bos={t.kmMax ? undefined : ''}>
                  {t.kmMax ? `${binlik(t.kmMax)} km` : '—'}
                </span>
                <span className={sinif('rr-ts-butce', css.butce)}>
                  {butceAraligi(t.butceMin, t.butceMax)}
                </span>
                <span className={css.yer}>{[t.il, t.ilce].filter(Boolean).join(', ')}</span>
              </div>
            ))}
          </div>
          {sayfalar > 1 ? (
            <nav aria-label="Sayfalar" className={css.sayfalar}>
              {Array.from(
                { length: Math.min(sayfalar, 7) },
                (_, i) => i + Math.max(1, Math.min(sayfa - 3, sayfalar - 6)),
              ).map((n) =>
                n === sayfa ? (
                  <span key={n} aria-current="page" className={css.sayfaNo}>
                    {n}
                  </span>
                ) : (
                  <Link
                    key={n}
                    href={`/talepler?${parametreler(q, { sayfa: String(n) }).toString()}`}
                    className={css.sayfaBag}
                  >
                    {n}
                  </Link>
                ),
              )}
              {sayfa < sayfalar ? (
                <Link
                  href={`/talepler?${parametreler(q, { sayfa: String(sayfa + 1) }).toString()}`}
                  className={css.sonraki}
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
