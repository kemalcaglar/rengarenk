import type { Metadata } from 'next';
import { Markdown } from '../../../components/markdown';
import { cx } from '../../../lib/cx';
import stil from './page.module.css';

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

/**
 * Veri kaynakları (Teknik tasarım §5): katalogdaki her kaynağın adı, lisansı ve atfı. Açık lisanslar (CC BY,
 * ODbL) atfı koşul sayar; kaynağın istediği atıf metni olduğu gibi gösterilir. Tasarımda bu sayfa yok; çerçeve
 * ve açılır kartlar Yardım tasarımının (Yardim.dc.html) ölçüleriyle.
 */
export default async function VeriKaynaklari() {
  const list = await sources();
  return (
    <main className={`rr-sayfa ${stil.kutu1}`}>
      <div className={stil.kutu2}>
        <h1 className={stil.baslik1}>Veri kaynakları</h1>
        <p className={stil.metin1}>
          Araç kataloğundaki marka, model, kasa ve yıl bilgileri aşağıdaki kaynaklardan derlenir. Kasko
          değerleri hiçbir yerde saklanmaz ve gösterilmez.
        </p>
        {list === null ? (
          <p className={stil.metin2}>Kaynak listesi şu an alınamadı; birazdan yeniden dene.</p>
        ) : (
          <div className={stil.kutu3}>
            {list.map((s, i) => (
              <section
                key={s.key}
                aria-labelledby={`k-${s.key}`}
                className={cx(stil.kutu4, i ? stil.kutu5 : stil.kutu6)}
              >
                <h2 id={`k-${s.key}`} className={stil.baslik2}>
                  {s.url ? (
                    <a href={s.url} rel="noreferrer">
                      {s.attribution ?? s.name}
                    </a>
                  ) : (
                    (s.attribution ?? s.name)
                  )}
                </h2>
                <p className={stil.metin3}>
                  {s.name} · Lisans: {s.license}
                </p>
                {s.notice ? (
                  <details className={stil.kutu7}>
                    <summary className={stil.metin4}>Kaynağın atıf metni</summary>
                    <div className={stil.kutu8}>
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
