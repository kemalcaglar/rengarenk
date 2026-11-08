import { colors } from '@rengarenk/shared';
import { HesapMenusu } from './hesap-menusu';
import { Logo } from './logo';

/**
 * Üst çubuk (tasarım: Anasayfa.dc.html, Taleplerim.dc.html): logo, talep arama, hesap (girişliyse avatar ve ad,
 * değilse "Giriş yap") ve "Talep oluştur".
 */
export function SiteHeader() {
  return (
    <header style={{ background: colors.surface, borderBottom: `1px solid ${colors.line}` }}>
      <div
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
        <Logo />
        {/* biome-ignore lint/a11y/useSemanticElements: tasarımdaki gibi role=search; <search> öğesi her tarayıcıda yok */}
        <form
          action="/talepler"
          role="search"
          style={{
            flex: '999 1 320px',
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#F3F5FA',
            border: `1px solid ${colors.line}`,
            borderRadius: 12,
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
              borderRadius: 9,
              background: colors.blue,
              color: colors.ink,
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
