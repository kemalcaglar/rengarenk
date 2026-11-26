import { defaultHomeLayout, type HomeResponse, tints, visibleSections } from '@rengarenk/shared';
import Link from 'next/link';
import { getCategories } from '../../lib/kategoriler';
import { colors } from '../../lib/renk';
import { GaleriCagri, GuvenRozetleri, NasilCalisir, SikSorulanlar, SonTalepler } from './ana-bolumler';
import { AnaDuzen } from './ana-duzen';
import { IstemciSon, IstemciVitrin } from './ana-yedek';
import stil from './page.module.css';
import { type TalepYaniti, VitrinBolumu } from './vitrin';

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
/** Yakında açılacak ana kategoriler (tasarım: kenar çubuğunun alt bölümü) */
const YAKINDA = ['Emlak', 'İkinci el alışveriş'];

const ADIMLAR = [
  { no: 1, text: 'Aradığın aracı ve kriterlerini gir', tint: tints.blue, dot: colors.blue },
  { no: 2, text: 'Uygun aracı olanlar sana mesaj atsın', tint: tints.pink, dot: colors.pink },
  { no: 3, text: 'Görüş, incele, kendi aranızda anlaşın', tint: tints.green, dot: colors.green },
];

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
    <aside className={`rr-kenar ${stil.kutu1}`} aria-label="Kategoriler">
      <h2 className={`rr-serit-baslik ${stil.baslik1}`}>Kategoriler</h2>
      <span className={`rr-serit-baslik ${stil.metin1}`}>Vasıta</span>
      <ul className={stil.liste1}>
        {kategoriler.map((c) => (
          <li key={c.slug}>
            <Link href={`/talepler?kategori=${c.slug}`} className={`kategori ${stil.bag1}`}>
              <span className={stil.metin2} style={{ background: c.color }} aria-hidden="true" />
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
      <div className={`rr-yalniz-genis ${stil.kutu2}`}>
        {YAKINDA.map((ad) => (
          <span key={ad} className={stil.metin3}>
            {ad}
            <span className={stil.metin4}>Yakında</span>
          </span>
        ))}
      </div>
    </aside>
  );
  const karsi = (
    <section className={`rr-karsi ${stil.kutu3}`} aria-labelledby="hero">
      <div className={stil.kutu4}>
        <h1 id="hero" className={stil.baslik2}>
          Aradığın aracı söyle, satıcılar seni bulsun.
        </h1>
        <p className={stil.metin5}>
          İlan ilan gezmek yerine talebini bir kez yayınla. Uygun aracı olan galeriler ve satıcılar sana
          yazsın.
        </p>
        <Link href="/talep-olustur" className={stil.bag2}>
          Ücretsiz talep oluştur
        </Link>
      </div>
      <ol className={stil.liste2}>
        {ADIMLAR.map((a) => (
          <li key={a.no} className={stil.oge1} style={{ background: a.tint }}>
            <span className={stil.metin6} style={{ background: a.dot }}>
              {a.no}
            </span>
            <span className={stil.metin7}>{a.text}</span>
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
