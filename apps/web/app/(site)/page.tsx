import { defaultHomeLayout, type HomeResponse, tints, visibleSections } from '@rengarenk/shared';
import Link from 'next/link';
import { getCategories } from '../../lib/kategoriler';
import { colors } from '../../lib/renk';
import { GaleriCagri, GuvenRozetleri, NasilCalisir, SikSorulanlar, SonTalepler } from './ana-bolumler';
import { AnaDuzen } from './ana-duzen';
import { IstemciSon, IstemciVitrin } from './ana-yedek';
import { type TalepYaniti, VitrinBolumu } from './vitrin';

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
/** Yakında açılacak ana kategoriler (tasarım: kenar çubuğunun alt bölümü) */
const YAKINDA = ['Emlak', 'İkinci el alışveriş'];

const ADIMLAR = [
  { no: 1, text: 'Aradığın aracı ve kriterlerini gir', tint: tints.blue, dot: colors.blue },
  { no: 2, text: 'Uygun aracı olanlar sana mesaj atsın', tint: tints.pink, dot: colors.pink },
  { no: 3, text: 'Görüş, incele, kendi aranızda anlaşın', tint: tints.green, dot: colors.green },
];

const card = { background: colors.surface, border: `1px solid ${colors.line}` } as const;

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

/** Talepler; ulaşılamazsa bir kez daha dener, yine olmazsa `null` (bölüm tarayıcıda yeniden çekilir) */
async function talepler(yol: string): Promise<TalepYaniti | null> {
  for (let deneme = 0; deneme < 2; deneme++) {
    try {
      const r = await fetch(`${API}${yol}`, { cache: 'no-store', signal: AbortSignal.timeout(3000) });
      if (r.ok) return (await r.json()) as TalepYaniti;
    } catch {
      // yeniden dener
    }
  }
  return null;
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
    // Telefonda kategoriler üst çubuktaki ☰ menüsünde (AnasayfaMobil.dc.html); kenar çubuğu yalnızca geniş ekranda
    <aside
      className="rr-yalniz-genis"
      style={{
        ...card,
        flex: '1 1 220px',
        maxWidth: 250,
        minWidth: 0,
        borderRadius: 'var(--rr-kart-kose)',
        padding: '18px 12px',
      }}
      aria-label="Kategoriler"
    >
      <h2
        className="rr-serit-baslik"
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
      <span
        className="rr-serit-baslik"
        style={{ display: 'block', padding: '10px 8px', fontSize: 15.5, fontWeight: 800 }}
      >
        Vasıta
      </span>
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
                borderRadius: 'calc(var(--rr-buton-kose) * 10 / 14)',
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
      <div className="rr-yalniz-genis" style={{ borderTop: '1px solid #EEF0F5', paddingTop: 8 }}>
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
                borderRadius: 'var(--rr-etiket-kose)',
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
      className="rr-karsi"
      style={{
        ...card,
        borderRadius: 'calc(var(--rr-kart-kose) * 22 / 18)',
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
            color: 'var(--rr-maviYazi, #1E2333)',
            fontWeight: 800,
            fontSize: 16,
            padding: '15px 24px',
            borderRadius: 'var(--rr-buton-kose)',
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
              borderRadius: 'var(--rr-buton-kose)',
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

  return (
    <AnaDuzen
      ilk={ilk}
      bolumler={{
        kat,
        karsi,
        // Sunucu talepleri alamadıysa (API yeniden başlıyor ya da yavaş) bölüm kaybolmaz: tarayıcı yeniden dener
        vitrin: vitrin ? <VitrinBolumu vitrin={vitrin} /> : <IstemciVitrin />,
        son: son ? (
          <SonTalepler liste={son.sonuclar} baslik="Son talepler" tumu="/talepler?sira=yeni" />
        ) : (
          <IstemciSon />
        ),
        nasil: <NasilCalisir />,
        guven: <GuvenRozetleri />,
        sss: <SikSorulanlar />,
        galeri_cagri: <GaleriCagri />,
      }}
    />
  );
}
