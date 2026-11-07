import { colors } from '@rengarenk/shared';
import { Markdown } from './markdown';

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface LegalText {
  key: string;
  version: number;
  title: string;
  body: string;
  status: 'taslak' | 'yayinda' | 'eski';
  publishedAt: string | null;
}

async function load(key: string): Promise<LegalText | null> {
  try {
    const r = await fetch(`${API}/legal/${key}`, { next: { revalidate: 300 } });
    return r.ok ? ((await r.json()) as LegalText) : null;
  } catch {
    return null;
  }
}

/**
 * Sürümlü yasal metin sayfası (Karar 46). Yayın öncesinde taslak gösterilir ve öyle işaretlenir; yayınlanan
 * sürüm konsoldan sahip onayıyla gelir. Sayfa çerçevesi Yardım tasarımının ölçüleriyle.
 */
export async function YasalMetin({ textKey }: { textKey: string }) {
  const t = await load(textKey);
  return (
    <main style={{ maxWidth: 1160, margin: '0 auto', padding: '28px 24px 64px' }}>
      {t ? (
        <article
          style={{
            maxWidth: 860,
            background: colors.surface,
            border: `1px solid ${colors.line}`,
            borderRadius: 18,
            padding: '28px 32px',
          }}
          aria-labelledby="baslik"
        >
          <h1 id="baslik" style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: -0.5 }}>
            {t.title.charAt(0).toLocaleUpperCase('tr-TR') + t.title.slice(1)}
          </h1>
          <p style={{ margin: '8px 0 0', display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 13.5 }}>
            <span style={{ color: colors.muted }}>Sürüm {t.version}</span>
            {t.status === 'taslak' ? (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  padding: '3px 9px',
                  borderRadius: 999,
                  background: '#FFF6DF',
                  color: '#7A5300',
                }}
              >
                Taslak · yayın öncesi, hukuki incelemede
              </span>
            ) : null}
          </p>
          <div style={{ marginTop: 12 }}>
            <Markdown text={t.body} />
          </div>
        </article>
      ) : (
        <p
          style={{
            maxWidth: 860,
            background: colors.surface,
            border: `1px solid ${colors.line}`,
            borderRadius: 18,
            padding: 24,
          }}
        >
          Metin şu an yüklenemedi; birazdan yeniden dene.
        </p>
      )}
    </main>
  );
}
