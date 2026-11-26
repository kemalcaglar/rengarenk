import { getDesign } from '../lib/bakim';
import { getCategories } from '../lib/kategoriler';
import { colors } from '../lib/renk';
import { HesapMenusu } from './hesap-menusu';
import { Logo } from './logo';
import { MenuCekmecesi } from './menu-cekmecesi';
import stil from './site-header.module.css';

/**
 * Üst çubuk (tasarım: Anasayfa.dc.html, Taleplerim.dc.html): logo, talep arama, hesap (girişliyse avatar ve ad,
 * değilse "Giriş yap") ve "Talep oluştur". Telefonda logonun solunda ☰ (AnasayfaMobil.dc.html: menü ve kategoriler).
 */
export async function SiteHeader() {
  // Mevsimsel tema (Karar 46): tarih aralığında üst bant rengi ve rozet
  const [{ tema }, kategoriler] = await Promise.all([getDesign(), getCategories()]);
  return (
    <header className={stil.kutu1}>
      <div className={`rr-ust ${stil.kutu2}`}>
        <span className={`rr-ust-logo ${stil.metin1}`}>
          <MenuCekmecesi
            kategoriler={kategoriler
              .filter((c) => c.vertical === 'vasita')
              .map(({ slug, name, color }) => ({ slug, name, color }))}
          />
          <Logo />
          {tema?.rozet ? <span className={stil.metin2}>{tema.rozet}</span> : null}
        </span>
        {/* biome-ignore lint/a11y/useSemanticElements: tasarımdaki gibi role=search; <search> öğesi her tarayıcıda yok */}
        <form action="/talepler" role="search" className={`rr-ust-ara ${stil.kutu3}`}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={colors.muted}
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <label htmlFor="ara" className="sr-only">
            Talep ara
          </label>
          <input
            id="ara"
            name="q"
            type="search"
            placeholder="Marka, model veya talep no ile ara"
            className={stil.girdi1}
          />
          <button type="submit" className={stil.dugme1}>
            Ara
          </button>
        </form>
        <HesapMenusu />
      </div>
    </header>
  );
}
