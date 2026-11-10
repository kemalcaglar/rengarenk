import {
  colors,
  compactBudget,
  defaultHomeLayout,
  type HomeResponse,
  ONE_CIKARMA,
  tints,
  visibleSections,
} from '@rengarenk/shared';
import Link from 'next/link';
import { getCategories } from '../../lib/kategoriler';
import { GaleriCagri, GuvenRozetleri, NasilCalisir, SikSorulanlar, SonTalepler } from './ana-bolumler';
import { AnaDuzen } from './ana-duzen';

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
/** Görseller tarayıcıdan istenir: genel API adresi */
const GORSEL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const VITRIN_FIYAT = ONE_CIKARMA.find((o) => o.key === 'vitrin')?.tl ?? 299;
/** Vitrinin son satırını tamamlayan boş hücrelerin anahtarları */
const BOS = ['bos1', 'bos2', 'bos3', 'bos4', 'bos5'];
const FOTO_YOK = [
  'linear-gradient(135deg, #C9D3E6, #EEF1F7)',
  'linear-gradient(135deg, #D7CFE6, #F1EEF7)',
  'linear-gradient(135deg, #CFE0D8, #EEF5F1)',
  'linear-gradient(135deg, #E6DCC9, #F7F3EE)',
];

/** Yakında açılacak ana kategoriler (tasarım: kenar çubuğunun alt bölümü) */
const YAKINDA = ['Emlak', 'İkinci el alışveriş'];

const ADIMLAR = [
  { no: 1, text: 'Aradığın aracı ve kriterlerini gir', tint: tints.blue, dot: colors.blue },
  { no: 2, text: 'Uygun aracı olanlar sana mesaj atsın', tint: tints.pink, dot: colors.pink },
  { no: 3, text: 'Görüş, incele, kendi aranızda anlaşın', tint: tints.green, dot: colors.green },
];

const card = { background: colors.surface, border: `1px solid ${colors.line}` } as const;

interface Kart {
  no: number;
  baslik: string;
  butceMin: number | null;
  butceMax: number | null;
  il: string | null;
  ilce: string | null;
  yayin: string;
  foto: string | null;
}

/** Ziyaretçi düzeni (yayındaki sürüm); API'ye ulaşılamazsa tasarımdaki varsayılan */
async function duzen(): Promise<HomeResponse> {
  try {
    const r = await fetch(`${API}/icerik/anasayfa?platform=web`, {
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(3000),
    });
    if (r.ok) return (await r.json()) as HomeResponse;
  } catch {
    // varsayılana düşer
  }
  return { kitle: 'ziyaretci', sira: visibleSections(defaultHomeLayout().ziyaretci.web) };
}

async function talepler(yol: string): Promise<{ toplam: number; sonuclar: Kart[] } | null> {
  try {
    const r = await fetch(`${API}${yol}`, { cache: 'no-store', signal: AbortSignal.timeout(3000) });
    return r.ok ? ((await r.json()) as { toplam: number; sonuclar: Kart[] }) : null;
  } catch {
    return null;
  }
}

/**
 * Ana sayfa (tasarım: Anasayfa.dc.html; Karar 22, 46): bölümler sunucuda çizilir, sırası ve görünürlüğü konsoldaki
 * "Ana sayfa düzeni"nden gelir (kitleye ve platforma göre). Vitrinde ücretli talepler önce; boş yerleri editör seçimi
 * doldurur. Giriş yapan üye ve galeriye özel bölümler istemcide (`ana-duzen.tsx`).
 */
export default async function Home() {
  const [tum, vitrin, son, ilk] = await Promise.all([
    getCategories(),
    talepler('/talepler/vitrin?boyut=17'),
    talepler('/talepler?sira=yeni&boyut=6'),
    duzen(),
  ]);
  const kategoriler = tum.filter((c) => c.vertical === 'vasita');
  const kat = (
    <aside
      style={{
        ...card,
        flex: '1 1 220px',
        maxWidth: 250,
        minWidth: 0,
        borderRadius: 18,
        padding: '18px 12px',
      }}
      aria-label="Kategoriler"
    >
      <h2
        style={{
          margin: '0 8px 12px',
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: colors.muted,
        }}
      >
        Kategoriler
      </h2>
      <span style={{ display: 'block', padding: '10px 8px', fontSize: 15.5, fontWeight: 800 }}>Vasıta</span>
      <ul style={{ listStyle: 'none', margin: '0 0 8px', padding: 0 }}>
        {kategoriler.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/talepler?kategori=${c.slug}`}
              className="kategori"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 10px',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 500,
                color: colors.inkSoft,
                textDecoration: 'none',
              }}
            >
              <span
                style={{ width: 9, height: 9, borderRadius: '50%', background: c.color, flex: 'none' }}
                aria-hidden="true"
              />
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
      <div style={{ borderTop: '1px solid #EEF0F5', paddingTop: 8 }}>
        {YAKINDA.map((ad) => (
          <span
            key={ad}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 8px',
              fontSize: 15.5,
              fontWeight: 700,
              color: '#6B7183',
            }}
          >
            {ad}
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: colors.muted,
                background: '#F3F5FA',
                padding: '3px 8px',
                borderRadius: 999,
              }}
            >
              Yakında
            </span>
          </span>
        ))}
      </div>
    </aside>
  );
  const karsi = (
    <section
      style={{
        ...card,
        borderRadius: 22,
        padding: 32,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 28,
      }}
      aria-labelledby="hero"
    >
      <div style={{ flex: '999 1 380px', minWidth: 0 }}>
        <h1
          id="hero"
          style={{ margin: 0, fontSize: 36, lineHeight: 1.15, fontWeight: 800, letterSpacing: -0.8 }}
        >
          Aradığın aracı söyle, satıcılar seni bulsun.
        </h1>
        <p style={{ margin: '12px 0 22px', fontSize: 16, lineHeight: 1.55, color: colors.inkSoft }}>
          İlan ilan gezmek yerine talebini bir kez yayınla. Uygun aracı olan galeriler ve satıcılar sana
          yazsın.
        </p>
        <Link
          href="/talep-olustur"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: colors.blue,
            color: colors.ink,
            fontWeight: 800,
            fontSize: 16,
            padding: '15px 24px',
            borderRadius: 14,
            textDecoration: 'none',
          }}
        >
          Ücretsiz talep oluştur
        </Link>
      </div>
      <ol
        style={{
          flex: '1 1 280px',
          minWidth: 0,
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {ADIMLAR.map((a) => (
          <li
            key={a.no}
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              background: a.tint,
              borderRadius: 14,
              padding: '12px 14px',
            }}
          >
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: a.dot,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: 14,
                flex: 'none',
              }}
            >
              {a.no}
            </span>
            <span style={{ fontSize: 14.5, fontWeight: 600 }}>{a.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
  const vitrinBolumu = vitrin?.sonuclar.length ? (
    <section aria-labelledby="vitrin">
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 10,
        }}
      >
        <h2 id="vitrin" style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>
          Ana sayfa vitrini
        </h2>
        <Link
          href="/talepler"
          style={{ fontSize: 13.5, fontWeight: 700, color: colors.link, textDecoration: 'none' }}
        >
          Tüm talepler ({vitrin.toplam})
        </Link>
      </div>
      <div className="rr-vitrin">
        {vitrin.sonuclar.map((v, i) => (
          <Link
            key={v.no}
            href={`/talep/${v.no}`}
            style={{
              display: 'block',
              background: '#FFFFFF',
              padding: '8px 8px 10px',
              color: colors.ink,
              textDecoration: 'none',
              minWidth: 0,
            }}
          >
            <span
              style={{
                display: 'block',
                position: 'relative',
                aspectRatio: '4 / 3',
                borderRadius: 8,
                overflow: 'hidden',
                background: FOTO_YOK[i % FOTO_YOK.length],
              }}
            >
              {v.foto ? (
                // biome-ignore lint/performance/noImgElement: katalog görseli API'den akar; Next görüntü iyileştirmesi gerekmez
                <img
                  src={`${GORSEL}${v.foto}`}
                  alt=""
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : null}
            </span>
            <span
              style={{
                display: 'block',
                fontSize: 12.5,
                fontWeight: 700,
                lineHeight: 1.3,
                marginTop: 6,
                height: 33,
                overflow: 'hidden',
              }}
            >
              {v.baslik}
            </span>
            <span
              style={{
                display: 'block',
                fontSize: 12.5,
                fontWeight: 800,
                color: colors.link,
                marginTop: 3,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {compactBudget(v.butceMin, v.butceMax) || ' '}
            </span>
            <span
              style={{
                display: 'block',
                fontSize: 11.5,
                color: colors.muted,
                marginTop: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {v.il ?? 'Tüm Türkiye'}
            </span>
          </Link>
        ))}
        <Link
          href="/taleplerim"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 5,
            background: tints.yellow,
            padding: 12,
            color: colors.ink,
            textDecoration: 'none',
            minWidth: 0,
          }}
        >
          <span style={{ fontSize: 13.5, fontWeight: 800, lineHeight: 1.3 }}>Talebin burada görünsün</span>
          <span style={{ fontSize: 12, color: '#5A3D00', lineHeight: 1.4 }}>
            7 gün ana sayfa vitrini, web ve uygulamada
          </span>
          <span style={{ fontSize: 13.5, fontWeight: 800, color: '#7A5300', marginTop: 2 }}>
            {VITRIN_FIYAT} TL ›
          </span>
        </Link>
        {/* Az talep varken satırın kalanı boş beyaz hücre; dar ekranda (3 sütun) fazlası gizlenir */}
        {BOS.slice(0, (6 - ((vitrin.sonuclar.length + 1) % 6)) % 6).map((k, i) => (
          <span
            key={k}
            aria-hidden="true"
            className={i < (3 - ((vitrin.sonuclar.length + 1) % 3)) % 3 ? undefined : 'rr-genis'}
            style={{ background: '#FFFFFF' }}
          />
        ))}
      </div>
      <p style={{ margin: '6px 2px 0', fontSize: 11.5, color: colors.muted }}>
        Fotoğraflar temsilîdir · Wikimedia Commons ve galeri portföyleri · sıra her açılışta karışır
      </p>
    </section>
  ) : null;

  return (
    <AnaDuzen
      ilk={ilk}
      bolumler={{
        kat,
        karsi,
        vitrin: vitrinBolumu,
        son: <SonTalepler liste={son?.sonuclar ?? []} baslik="Son talepler" tumu="/talepler?sira=yeni" />,
        nasil: <NasilCalisir />,
        guven: <GuvenRozetleri />,
        sss: <SikSorulanlar />,
        galeri_cagri: <GaleriCagri />,
      }}
    />
  );
}
