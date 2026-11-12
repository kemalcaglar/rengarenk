import { getDesign } from '../lib/bakim';
import { colors } from '../lib/renk';
import { HesapMenusu } from './hesap-menusu';
import { Logo } from './logo';

/**
 * Üst çubuk (tasarım: Anasayfa.dc.html, Taleplerim.dc.html): logo, talep arama, hesap (girişliyse avatar ve ad,
 * değilse "Giriş yap") ve "Talep oluştur".
 */
export async function SiteHeader() {
  // Mevsimsel tema (Karar 46): tarih aralığında üst bant rengi ve rozet
  const { tema } = await getDesign();
  return (
    <header style={{ background: 'var(--rr-ust-bant, #FFFFFF)', borderBottom: `1px solid ${colors.line}` }}>
      <div
        className="rr-ust"
        style={{
          maxWidth: 1360,
          margin: '0 auto',
          padding: '16px 24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '16px 24px',
        }}
      >
        <span
          className="rr-ust-logo"
          style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--rr-ust-yazi)' }}
        >
          <Logo />
          {tema?.rozet ? (
            <span
              style={{ fontSize: 13, fontWeight: 700, color: 'var(--rr-ust-yazi)', whiteSpace: 'nowrap' }}
            >
              {tema.rozet}
            </span>
          ) : null}
        </span>
        {/* biome-ignore lint/a11y/useSemanticElements: tasarımdaki gibi role=search; <search> öğesi her tarayıcıda yok */}
        <form
          action="/talepler"
          role="search"
          className="rr-ust-ara"
          style={{
            flex: '999 1 320px',
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#F3F5FA',
            border: `1px solid ${colors.line}`,
            borderRadius: 'calc(var(--rr-buton-kose) * 12 / 14)',
            padding: '0 8px 0 14px',
          }}
        >
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
            style={{
              flex: 1,
              minWidth: 0,
              border: 0,
              background: 'transparent',
              fontSize: 15,
              padding: '12px 0',
              color: colors.ink,
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <button
            type="submit"
            style={{
              border: 0,
              borderRadius: 'calc(var(--rr-buton-kose) * 9 / 14)',
              background: colors.blue,
              color: 'var(--rr-maviYazi, #1E2333)',
              fontWeight: 700,
              fontSize: 14,
              padding: '9px 16px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Ara
          </button>
        </form>
        <HesapMenusu />
      </div>
    </header>
  );
}
