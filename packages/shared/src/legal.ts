import { z } from 'zod';

/**
 * Yasal metinler (Karar 46, 59; YonetimIcerik.dc.html › Yardım ve yasal metinler). Metinler sürümlüdür; her kullanıcının
 * hangi sürümü ne zaman onayladığı rıza kayıtlarında saklanır. Yayın sahip onayıyla olur (LEGAL_TEXT). Esaslı
 * değişiklikte kullanıcılara bildirim gider ve bir sonraki girişte yeni sürüm onaylatılır.
 */

/** Anahtarlar docs/kapsam/06-yasal-metin-taslaklari.md bölümleriyle aynı sırada */
export const LEGAL_TEXTS = {
  kullanim_kosullari: { ad: 'Kullanım koşulları', kullanim: 'Üyelikte onaylatılır' },
  kvkk_aydinlatma: { ad: 'KVKK aydınlatma metni', kullanim: 'Üyelikte ve formlarda bağlantı' },
  reklam_olcum: { ad: 'Reklam ölçümü açık rıza metni', kullanim: 'Üyelikte isteğe bağlı' },
  ticari_ileti: { ad: 'Ticari elektronik ileti onayı', kullanim: 'Üyelikte ve ayarlarda isteğe bağlı' },
  cerez_politikasi: { ad: 'Çerez politikası', kullanim: 'Çerez bandında bağlantı' },
  on_bilgilendirme: {
    ad: 'Ön bilgilendirme formu',
    kullanim: 'Her ödemede onaylatılır · cayma hakkı bilgisi dahil',
  },
  mesafeli_sozlesme: { ad: 'Mesafeli hizmet sözleşmesi', kullanim: 'Her ödemede onaylatılır' },
  galeri_sozlesmesi: { ad: 'Galeri hizmet sözleşmesi', kullanim: 'Galeri başvurusunda ve abonelikte' },
} as const;
export type LegalKey = keyof typeof LEGAL_TEXTS;
export const LEGAL_KEY_LIST = Object.keys(LEGAL_TEXTS) as LegalKey[];

/**
 * Esaslı değişiklikte bir sonraki girişte yeniden onaylatılanlar: zorunlu metinler (herkes; galeri sözleşmesi yalnızca
 * galeri sahibi ve yöneticisi) ve kişinin daha önce onay verdiği isteğe bağlı rızalar (yeniden seçer). Ödeme metinleri
 * her ödemede, çerez politikası çerez bandında zaten güncel sürümle onaylatılır.
 */
export const RECONSENT_REQUIRED: LegalKey[] = ['kullanim_kosullari', 'kvkk_aydinlatma', 'galeri_sozlesmesi'];
export const RECONSENT_OPTIONAL: LegalKey[] = ['ticari_ileti', 'reklam_olcum'];

/** Metnin sitedeki sayfası (bildirim bağlantısı; isteğe bağlı rızalar Ayarlar › Gizlilik'te) */
export const LEGAL_PATHS: Record<LegalKey, string> = {
  kullanim_kosullari: 'kullanim-kosullari',
  kvkk_aydinlatma: 'kvkk',
  reklam_olcum: 'ayarlar?bolum=gizlilik',
  ticari_ileti: 'ayarlar?bolum=gizlilik',
  cerez_politikasi: 'cerez-aydinlatma',
  on_bilgilendirme: 'on-bilgilendirme',
  mesafeli_sozlesme: 'mesafeli-sozlesme',
  galeri_sozlesmesi: 'galeri-sozlesmesi',
};

export const LEGAL_STATUS = { taslak: 'Taslak', yayinda: 'Yayında', eski: 'Eski sürüm' } as const;

/** Konsolda taslak kaydı */
export const legalDraftSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    body: z.string().trim().min(20).max(100_000),
    /** Esaslı değişiklik: yayınlanınca bildirim ve sonraki girişte yeniden onay */
    material: z.boolean(),
    not: z.string().trim().max(500).optional(),
  })
  .strict();
export type LegalDraftInput = z.infer<typeof legalDraftSchema>;

/** Kullanıcının bekleyen onaylara yanıtı; zorunlu metinler yalnızca kabul edilir */
export const legalAcceptSchema = z
  .object({
    onaylar: z
      .array(
        z
          .object({
            key: z.enum(LEGAL_KEY_LIST as [LegalKey, ...LegalKey[]]),
            version: z.number().int().positive(),
            granted: z.boolean(),
          })
          .strict(),
      )
      .min(1)
      .max(LEGAL_KEY_LIST.length),
  })
  .strict();

export interface LegalDiffLine {
  tip: 'ekle' | 'sil';
  metin: string;
  /** Değişikliğin bulunduğu bölüm başlığı ("7. Ödemeler ve iade") */
  bolum: string | null;
}

/** Paragraflar (boş satırla ayrılmış); başlık satırları ayrı paragraf sayılır */
function paragraflar(t: string): string[] {
  return t
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n|\n(?=#{1,6}\s)/)
    .map((p) => p.trim())
    .filter(Boolean);
}

const baslikMi = (p: string) => /^#{1,6}\s/.test(p) || /^\*\*\d+(\.\d+)*[.)]?\s/.test(p);
const baslikAdi = (p: string) =>
  p
    .replace(/^#{1,6}\s+/, '')
    .replace(/\*\*/g, '')
    .trim();

/**
 * İki sürüm arasındaki fark: paragraf düzeyinde en uzun ortak dizi; silinen ve eklenen paragraflar bulundukları bölüm
 * başlığıyla ("s.3 → s.4 · madde 7.2"). Aynı kalan paragraflar dönmez.
 */
export function legalDiff(eski: string, yeni: string): LegalDiffLine[] {
  const a = paragraflar(eski);
  const b = paragraflar(yeni);
  const n = a.length;
  const m = b.length;
  // LCS tablosu (paragraf sayısı küçük: metin başına birkaç yüz)
  const t: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      (t[i] as number[])[j] =
        a[i] === b[j]
          ? ((t[i + 1] as number[])[j + 1] as number) + 1
          : Math.max((t[i + 1] as number[])[j] as number, (t[i] as number[])[j + 1] as number);
  const out: LegalDiffLine[] = [];
  let i = 0;
  let j = 0;
  let bolum: string | null = null;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      if (baslikMi(a[i] as string)) bolum = baslikAdi(a[i] as string);
      i++;
      j++;
    } else if (
      j < m &&
      (i >= n || ((t[i] as number[])[j + 1] as number) > ((t[i + 1] as number[])[j] as number))
    ) {
      const p = b[j] as string;
      if (baslikMi(p)) bolum = baslikAdi(p);
      out.push({ tip: 'ekle', metin: p, bolum });
      j++;
    } else {
      out.push({ tip: 'sil', metin: a[i] as string, bolum });
      i++;
    }
  }
  return out;
}

/** Onay isteği ve sürüm notu için kısa özet: "3 paragraf eklendi, 1 paragraf çıkarıldı · bölüm: 7. Ödemeler" */
export function legalDiffSummary(d: LegalDiffLine[]): string {
  const ek = d.filter((x) => x.tip === 'ekle').length;
  const sil = d.filter((x) => x.tip === 'sil').length;
  if (!ek && !sil) return 'Metinde değişiklik yok';
  const bolumler = [...new Set(d.map((x) => x.bolum).filter(Boolean))].slice(0, 3);
  return [
    [ek ? `${ek} paragraf eklendi` : null, sil ? `${sil} paragraf çıkarıldı` : null]
      .filter(Boolean)
      .join(', '),
    bolumler.length ? `bölüm: ${bolumler.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Kullanıcıya gösterilen bekleyen onay */
export interface PendingLegal {
  key: LegalKey;
  ad: string;
  version: number;
  title: string;
  /** true: kabul edilmeden devam edilemez; false: isteğe bağlı rıza (yeniden seçilir) */
  zorunlu: boolean;
  /** Önceki onaylanan sürüme göre özet */
  ozet: string;
  /** Kişinin önceki tercihi (isteğe bağlı rızada) */
  onceki: boolean | null;
  publishedAt: string | null;
}
