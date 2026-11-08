import { colors, tints } from '@rengarenk/shared';
import Link from 'next/link';
import { getCategories } from '../../lib/kategoriler';

/** Yakında açılacak ana kategoriler (tasarım: kenar çubuğunun alt bölümü) */
const YAKINDA = ['Emlak', 'İkinci el alışveriş'];

const ADIMLAR = [
  { no: 1, text: 'Aradığın aracı ve kriterlerini gir', tint: tints.blue, dot: colors.blue },
  { no: 2, text: 'Uygun aracı olanlar sana mesaj atsın', tint: tints.pink, dot: colors.pink },
  { no: 3, text: 'Görüş, incele, kendi aranızda anlaşın', tint: tints.green, dot: colors.green },
];

const card = { background: colors.surface, border: `1px solid ${colors.line}` } as const;

/**
 * Ana sayfa, ziyaretçi görünümü (tasarım: Anasayfa.dc.html, gorunum = Ziyaretçi). Vitrin ve son talepler bölümleri
 * talep modülüyle (Aşama 3) gelir; o zamana kadar gösterilmez. Galeri görünümü kurumsal hesaplarla gelir.
 */
export default async function Home() {
  const kategoriler = (await getCategories()).filter((c) => c.vertical === 'vasita');
  return (
    <main
      style={{
        maxWidth: 1360,
        margin: '0 auto',
        padding: '24px 24px 64px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        gap: 24,
      }}
    >
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
                href={`/kategori/${c.slug}`}
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

      <div style={{ flex: '999 1 760px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 22 }}>
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
      </div>
    </main>
  );
}
