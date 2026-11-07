import { colors } from '@rengarenk/shared';
import type { Metadata } from 'next';
import { Markdown } from '../../../components/markdown';

export const metadata: Metadata = {
  title: 'Rengarenk · Veri kaynakları',
  description: 'Araç kataloğunun kaynakları, lisansları ve atıfları.',
};
export const dynamic = 'force-dynamic';

interface Source {
  key: string;
  name: string;
  license: string;
  attribution: string | null;
  url: string | null;
  notice: string | null;
}

async function sources(): Promise<Source[] | null> {
  try {
    const r = await fetch(
      `${process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/catalog/attributions`,
      {
        cache: 'no-store',
      },
    );
    return r.ok ? ((await r.json()) as Source[]) : null;
  } catch {
    return null;
  }
}

const card = {
  background: colors.surface,
  border: `1px solid ${colors.line}`,
  borderRadius: 18,
} as const;

/**
 * Veri kaynakları (Teknik tasarım §5): katalogdaki her kaynağın adı, lisansı ve atfı. Açık lisanslar (CC BY,
 * ODbL) atfı koşul sayar; kaynağın istediği atıf metni olduğu gibi gösterilir. Tasarımda bu sayfa yok; çerçeve
 * ve açılır kartlar Yardım tasarımının (Yardim.dc.html) ölçüleriyle.
 */
export default async function VeriKaynaklari() {
  const list = await sources();
  return (
    <main style={{ maxWidth: 1160, margin: '0 auto', padding: '28px 24px 64px' }}>
      <div style={{ maxWidth: 860 }}>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: -0.5 }}>Veri kaynakları</h1>
        <p style={{ margin: '8px 0 20px', fontSize: 15, lineHeight: 1.55, color: colors.inkSoft }}>
          Araç kataloğundaki marka, model, kasa ve yıl bilgileri aşağıdaki kaynaklardan derlenir. Kasko
          değerleri hiçbir yerde saklanmaz ve gösterilmez.
        </p>
        {list === null ? (
          <p style={{ ...card, padding: 20, margin: 0 }}>
            Kaynak listesi şu an alınamadı; birazdan yeniden dene.
          </p>
        ) : (
          <div style={{ ...card, overflow: 'hidden' }}>
            {list.map((s, i) => (
              <section
                key={s.key}
                aria-labelledby={`k-${s.key}`}
                style={{ padding: '16px 20px', borderTop: i ? '1px solid #EEF0F5' : 0 }}
              >
                <h2 id={`k-${s.key}`} style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
                  {s.url ? (
                    <a href={s.url} rel="noreferrer">
                      {s.attribution ?? s.name}
                    </a>
                  ) : (
                    (s.attribution ?? s.name)
                  )}
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: 13.5, color: colors.muted }}>
                  {s.name} · Lisans: {s.license}
                </p>
                {s.notice ? (
                  <details style={{ marginTop: 10 }}>
                    <summary style={{ cursor: 'pointer', fontSize: 15, fontWeight: 700, color: colors.ink }}>
                      Kaynağın atıf metni
                    </summary>
                    <div style={{ marginTop: 8 }}>
                      <Markdown text={s.notice.replace(/<!--[\s\S]*?-->/g, '').replace(/^# .*$/m, '')} />
                    </div>
                  </details>
                ) : null}
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
