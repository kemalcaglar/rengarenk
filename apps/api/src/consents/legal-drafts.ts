import { LEGAL_KEYS, type LegalKey } from './consent.service.js';

/** Belge dışa aktarımının kaçış işaretleri: "\[" → "[", "&#91;" → "[" */
const kacisiCoz = (t: string) =>
  t
    .replace(/&#91;/g, '[')
    .replace(/&#93;/g, ']')
    .replace(/\\([[\]_*#>-])/g, '$1');

export interface LegalDraft {
  key: LegalKey;
  title: string;
  body: string;
}

/**
 * docs/kapsam/06-yasal-metin-taslaklari.md dosyasından metinler: "## N. Başlık" bölümleri sırayla anahtarlara
 * karşılık gelir (1 kullanım koşulları … 8 galeri sözleşmesi). "Avukat notu" ile başlayan paragraflar metne
 * girmez (belgenin kendi kuralı); 9. bölüm (avukata sorular) alınmaz.
 */
export function parseLegalDrafts(markdown: string): LegalDraft[] {
  const out: LegalDraft[] = [];
  const parts = markdown.split(/^## /m).slice(1);
  for (const part of parts) {
    const nl = part.indexOf('\n');
    const head = part.slice(0, nl).trim();
    const m = /^(\d+)\.\s+(.+)$/.exec(head);
    if (!m) continue;
    const key = LEGAL_KEYS[Number(m[1]) - 1];
    if (!key) continue;
    const body = kacisiCoz(part.slice(nl + 1))
      .split(/\n{2,}/)
      .filter((para) => !/^\s*(\*\*)?Avukat notu/i.test(para))
      .join('\n\n')
      .trim();
    out.push({ key, title: (m[2] as string).trim(), body });
  }
  return out;
}
