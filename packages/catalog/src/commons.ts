/**
 * Wikimedia Commons nesil fotoğrafı adayları (Karar 34). Nesil kodunun Commons kategorisindeki dosyalar okunur,
 * ticari kullanıma izin vermeyen lisanslar elenir, kalanlar puanlanır; seçimi katalog sorumlusu yapar.
 */

/** Commons API'si: kategorideki dosyalar, ölçü, lisans ve yazar (en çok 50) */
export function commonsCategoryUrl(category: string, limit = 50): string {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'categorymembers',
    gcmtitle: `Category:${category.replace(/^Category:/i, '')}`,
    gcmtype: 'file',
    gcmlimit: String(limit),
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '1600',
    iiextmetadatafilter: 'LicenseShortName|License|Artist|LicenseUrl|Credit',
  });
  return `https://commons.wikimedia.org/w/api.php?${params}`;
}

export interface CommonsCandidate {
  commonsFile: string;
  pageUrl: string;
  /** Saklanacak kopya: 1600 piksel genişlikte küçültülmüş dosya (özgün dosya çok büyük olabilir) */
  sourceUrl: string;
  width: number;
  height: number;
  mime: string;
  author: string;
  license: string;
  licenseUrl: string | null;
  score: number;
}

/** Karar 34: kamu malı, CC0, CC BY, CC BY-SA. NC (ticari olmayan) ve ND (değiştirilemez) alınmaz. */
export function licenseAllowed(short: string, code = ''): boolean {
  const text = `${short} ${code}`.toLowerCase();
  if (/\bnc\b|\bnd\b|non-?commercial|no ?deriv|fair use|copyrighted/.test(text)) return false;
  return /\bcc0\b|public domain|\bpd\b|^pd-|cc[ -]by(?:[ -]sa)?[ -]?\d|cc-by(?:-sa)?-\d/.test(text);
}

/** HTML etiketlerini ve fazla boşluğu atar: yazar alanı Commons'ta bağlantılı gelir. */
export function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

const BAD_WORDS =
  /\b(interior|innenraum|cockpit|dashboard|armaturen|engine|motor|motorraum|badge|emblem|logo|detail|wheel|felge|rim|seat|sitz|steering|lenkrad|trunk|boot|kofferraum|light|lamp|grille|key|mirror|crash|wreck|unfall|race|racing|rally|dtm|police|polizei|taxi|toy|model car|modell|lego|miniature|scale)\b/i;
const FRONT_WORDS = /\b(front|vorne|vorn|fl|three[- ]quarter|3\/4|frontansicht|av)\b/i;
const REAR_WORDS = /\b(rear|heck|hinten|back|arrière)\b/i;

/**
 * Sıralama: Karar 34'ün tarif ettiği fotoğraf (dış çekim, ön çapraz açı, araç tam kadrajda, en az 1200 piksel).
 * Görsel içerik okunmaz; ölçü ve dosya adındaki ipuçlarıyla sıralanır, son karar insanındır.
 */
export function scoreCandidate(file: string, width: number, height: number): number {
  let score = 0;
  const ratio = width / Math.max(height, 1);
  if (ratio >= 1.3 && ratio <= 2.1) score += 30;
  else if (ratio < 1) score -= 40;
  score += Math.min(Math.floor(width / 400), 10);
  if (FRONT_WORDS.test(file)) score += 25;
  if (REAR_WORDS.test(file)) score -= 10;
  if (BAD_WORDS.test(file)) score -= 60;
  return score;
}

interface ApiPage {
  title: string;
  imageinfo?: {
    url: string;
    thumburl?: string;
    descriptionurl: string;
    width: number;
    height: number;
    mime: string;
    extmetadata?: Record<string, { value: string } | undefined>;
  }[];
}

/** Commons API yanıtından adaylar: yalnızca izinli lisans, JPEG/PNG, en az 1200 piksel genişlik. */
export function commonsCandidates(body: { query?: { pages?: ApiPage[] } }): CommonsCandidate[] {
  const out: CommonsCandidate[] = [];
  for (const p of body.query?.pages ?? []) {
    const ii = p.imageinfo?.[0];
    if (!ii || !/^image\/(jpeg|png)$/.test(ii.mime) || ii.width < 1200) continue;
    const meta = ii.extmetadata ?? {};
    const short = plainText(meta.LicenseShortName?.value ?? '');
    if (!licenseAllowed(short, meta.License?.value ?? '')) continue;
    const author = plainText(meta.Artist?.value ?? '') || plainText(meta.Credit?.value ?? '') || 'Bilinmiyor';
    const file = p.title.replace(/^File:/, '');
    out.push({
      commonsFile: file,
      pageUrl: ii.descriptionurl,
      sourceUrl: (ii.thumburl ?? ii.url).replace(/\?.*$/, ''),
      width: ii.width,
      height: ii.height,
      mime: ii.mime,
      author: author.slice(0, 300),
      license: short.slice(0, 80),
      licenseUrl: meta.LicenseUrl?.value ?? null,
      score: scoreCandidate(file, ii.width, ii.height),
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Fotoğrafın altında gösterilecek atıf (Karar 34) */
export function photoCaption(p: { author: string; license: string }, edited = false): string {
  return `Fotoğraf: ${p.author} · ${p.license} · Wikimedia Commons · temsilî görsel${edited ? ' · düzenlendi' : ''}`;
}
