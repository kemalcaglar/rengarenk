import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Veri kaynakları · Rengarenk',
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
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/catalog/attributions`,
      {
        cache: 'no-store',
      },
    );
    return r.ok ? ((await r.json()) as Source[]) : null;
  } catch {
    return null;
  }
}

/** Satır içi: [metin](https://…) bağlantı olur, `kod` düz metin; başka biçim yok (HTML yorumlanmaz). */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    out.push(text.slice(last, m.index).replace(/`/g, ''));
    out.push(
      <a key={`${m.index}-${m[2]}`} href={m[2]} rel="noreferrer">
        {m[1]}
      </a>,
    );
    last = (m.index ?? 0) + m[0].length;
  }
  out.push(text.slice(last).replace(/`/g, '').replace(/\*\*/g, ''));
  return out;
}

/** Kaynağın atıf metni (Markdown): başlık, madde, alıntı ve paragraf; HTML ve yorumlar atılır. */
function Notice({ text }: { text: string }) {
  const lines = text
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .map((l) => l.trimEnd());
  const blocks: ReactNode[] = [];
  lines.forEach((l, i) => {
    const key = `n${i}`;
    if (!l.trim() || /^<.*>$/.test(l.trim())) return;
    if (l.startsWith('# ')) return; // kaynak adı zaten başlıkta
    if (l.startsWith('## '))
      blocks.push(
        <h3 key={key} style={{ fontSize: 15, margin: '18px 0 6px' }}>
          {inline(l.slice(3))}
        </h3>,
      );
    else if (/^\s*[-*] /.test(l))
      blocks.push(
        <p key={key} style={{ margin: '2px 0 2px 16px', fontSize: 13.5 }}>
          • {inline(l.replace(/^\s*[-*] /, ''))}
        </p>,
      );
    else if (l.startsWith('>'))
      blocks.push(
        <p key={key} style={{ margin: '6px 0', fontSize: 13.5, fontWeight: 700 }}>
          {inline(l.replace(/^>\s?/, ''))}
        </p>,
      );
    else
      blocks.push(
        <p key={key} style={{ margin: '4px 0', fontSize: 13.5 }} className="muted">
          {inline(l)}
        </p>,
      );
  });
  return <div>{blocks}</div>;
}

/**
 * Veri kaynakları (Teknik tasarım §5): katalogdaki her kaynağın adı, lisansı ve atfı. Açık lisanslar (CC BY,
 * ODbL) atfı koşul sayar; kaynağın istediği atıf metni burada olduğu gibi gösterilir.
 */
export default async function VeriKaynaklari() {
  const list = await sources();
  return (
    <div style={{ maxWidth: 820 }}>
      <h1 style={{ marginTop: 0 }}>Veri kaynakları</h1>
      <p className="muted">
        Araç kataloğundaki marka, model, kasa ve yıl bilgileri aşağıdaki kaynaklardan derlenir. Kasko
        değerleri hiçbir yerde saklanmaz ve gösterilmez.
      </p>
      {list === null ? (
        <p className="card">Kaynak listesi şu an alınamadı; birazdan yeniden dene.</p>
      ) : (
        list.map((s) => (
          <section key={s.key} className="card" style={{ marginBottom: 16 }} aria-labelledby={`k-${s.key}`}>
            <h2 id={`k-${s.key}`} style={{ margin: 0, fontSize: 18 }}>
              {s.url ? (
                <a href={s.url} rel="noreferrer">
                  {s.attribution ?? s.name}
                </a>
              ) : (
                (s.attribution ?? s.name)
              )}
            </h2>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: 13.5 }}>
              {s.name} · Lisans: {s.license}
            </p>
            {s.notice ? (
              <details style={{ marginTop: 10 }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
                  Kaynağın atıf metni
                </summary>
                <Notice text={s.notice} />
              </details>
            ) : null}
          </section>
        ))
      )}
    </div>
  );
}
