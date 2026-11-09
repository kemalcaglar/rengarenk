import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';

const font = (ad: string) => fileURLToPath(new URL(`../../assets/fonts/${ad}.ttf`, import.meta.url));
const RENK = ['#5B8CFF', '#FF6FB5', '#FFC84A', '#3DD68C'];
const MUREKKEP = '#1E2333';
const GRI = '#5A6073';
/** Bitişik harfler kapalı: PDF'ten kopyalanan metin ve arama doğru çalışsın */
const HARF = { liga: false, clig: false } as unknown as PDFKit.Mixins.OpenTypeFeatures[];

export interface DocumentPdf {
  baslik: string;
  /** Başlığın altındaki satır (ör. "Sipariş R12345 · 10 Kasım 2026") */
  alt: string;
  /** Üstte kutu içinde gösterilen bilgiler (taraflar, tutar) */
  bilgiler?: [string, string][];
  /** Basit Markdown: "# ", "## ", "1. ", "- ", girintili "- " ve **kalın** */
  metin: string;
  altBilgi: string;
}

/**
 * Müşteriye giden belge PDF'i (ön bilgilendirme formu, sözleşme). Sitenin yazı tipi gömülür (Türkçe harfler), metin
 * en az 12 punto (06-yasal-metin-taslaklari.md §6). Sürümlü yasal metnin basit Markdown'ını yazar.
 */
export function documentPdf(d: DocumentPdf): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 48, bottom: 56, left: 52, right: 52 },
    bufferPages: true,
    info: { Title: d.baslik, Author: 'Rengarenk', Subject: d.alt },
  });
  doc.registerFont('R', font('PlusJakartaSans_400Regular'));
  doc.registerFont('B', font('PlusJakartaSans_700Bold'));
  doc.registerFont('X', font('PlusJakartaSans_800ExtraBold'));
  const parcalar: Buffer[] = [];
  doc.on('data', (b: Buffer) => parcalar.push(b));
  const bitti = new Promise<Buffer>((ok) => doc.on('end', () => ok(Buffer.concat(parcalar))));

  const sol = doc.page.margins.left;
  const genislik = doc.page.width - sol - doc.page.margins.right;

  RENK.forEach((c, i) => {
    doc.roundedRect(sol + i * 22, 48, 18, 6, 3).fill(c);
  });
  doc.font('X').fontSize(10).fillColor(GRI).text('Rengarenk', sol, 62);
  doc.font('X').fontSize(20).fillColor(MUREKKEP).text(d.baslik, sol, 80, { width: genislik, features: HARF });
  doc.font('R').fontSize(12).fillColor(GRI).text(d.alt, { width: genislik, features: HARF });
  doc.moveDown(0.8);

  if (d.bilgiler?.length) {
    const y0 = doc.y;
    const satirY = 20;
    const h = d.bilgiler.length * satirY + 16;
    doc.roundedRect(sol, y0, genislik, h, 10).fill('#F6F8FD');
    d.bilgiler.forEach(([k, v], i) => {
      const y = y0 + 10 + i * satirY;
      doc
        .font('B')
        .fontSize(12)
        .fillColor(GRI)
        .text(k, sol + 14, y, { width: 150, features: HARF });
      doc
        .font('R')
        .fontSize(12)
        .fillColor(MUREKKEP)
        .text(v, sol + 170, y, { width: genislik - 184, features: HARF, lineBreak: false, ellipsis: true });
    });
    doc.x = sol;
    doc.y = y0 + h + 14;
  }

  /** "**Kalın:** düz" satırını parça parça yazar */
  const satir = (metin: string, x: number, w: number, boyut = 12) => {
    // Boş parça (satır "**" ile başlıyorsa) pdfkit'te satır kırar; atlanır
    const parca = metin
      .replace(/\\([[\]])/g, '$1')
      .split('**')
      .map((p, i) => ({ p, kalin: i % 2 === 1 }))
      .filter((x) => x.p);
    parca.forEach(({ p, kalin }, i) => {
      doc
        .font(kalin ? 'B' : 'R')
        .fontSize(boyut)
        .fillColor(MUREKKEP)
        .text(p, i === 0 ? x : undefined, i === 0 ? doc.y : undefined, {
          width: w,
          continued: i < parca.length - 1,
          features: HARF,
          lineGap: 2,
        });
    });
  };

  for (const ham of d.metin.split('\n')) {
    const l = ham.replace(/\s+$/, '');
    if (!l.trim()) {
      doc.moveDown(0.4);
      continue;
    }
    if (l.startsWith('# ')) {
      doc.moveDown(0.3);
      doc
        .font('X')
        .fontSize(15)
        .fillColor(MUREKKEP)
        .text(l.slice(2), sol, doc.y, { width: genislik, features: HARF });
      doc.moveDown(0.3);
    } else if (l.startsWith('## ')) {
      doc.moveDown(0.3);
      doc
        .font('X')
        .fontSize(13)
        .fillColor(MUREKKEP)
        .text(l.slice(3), sol, doc.y, { width: genislik, features: HARF });
      doc.moveDown(0.2);
    } else {
      const girinti = /^\s{2,}-\s/.test(l) ? 2 : /^(-|\d+\.)\s/.test(l) ? 1 : 0;
      const m = l.trim().match(/^(-|\d+\.)\s+(.*)$/);
      if (m && girinti) {
        const x = sol + (girinti - 1) * 18;
        const isaret = m[1] === '-' ? '•' : (m[1] as string);
        const y = doc.y;
        doc.font('B').fontSize(12).fillColor(GRI).text(isaret, x, y, { width: 18, features: HARF });
        doc.y = y;
        satir(m[2] as string, x + 20, genislik - (x - sol) - 20);
      } else {
        satir(l.trim(), sol, genislik);
      }
      doc.moveDown(0.25);
    }
  }

  // Alt bilgi ve sayfa numarası
  const sayfalar = doc.bufferedPageRange();
  for (let i = 0; i < sayfalar.count; i++) {
    doc.switchToPage(sayfalar.start + i);
    const y = doc.page.height - doc.page.margins.bottom + 20;
    doc.page.margins.bottom = 0;
    doc
      .font('R')
      .fontSize(8.5)
      .fillColor(GRI)
      .text(`${d.altBilgi} · ${i + 1}/${sayfalar.count}`, sol, y, { width: genislik, features: HARF });
  }
  doc.end();
  return bitti;
}
