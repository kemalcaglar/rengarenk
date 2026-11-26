import { Markdown } from './markdown';
import stil from './yasal-metin.module.css';

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
    <main className={`rr-sayfa ${stil.kutu1}`}>
      {t ? (
        <article className={stil.kutu2} aria-labelledby="baslik">
          <h1 id="baslik" className={stil.baslik1}>
            {t.title.charAt(0).toLocaleUpperCase('tr-TR') + t.title.slice(1)}
          </h1>
          <p className={stil.metin1}>
            <span className={stil.metin2}>Sürüm {t.version}</span>
            {t.status === 'taslak' ? (
              <span className={stil.metin3}>Taslak · yayın öncesi, hukuki incelemede</span>
            ) : null}
          </p>
          <div className={stil.kutu3}>
            <Markdown text={t.body} />
          </div>
        </article>
      ) : (
        <p className={stil.metin4}>Metin şu an yüklenemedi; birazdan yeniden dene.</p>
      )}
    </main>
  );
}
