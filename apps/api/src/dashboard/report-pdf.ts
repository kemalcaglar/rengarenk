import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';

/** Rapor tablosu: PDF'te ve Excel'de (CSV) aynı satırlar */
export interface ReportTable {
  baslik: string;
  kolonlar: string[];
  satirlar: (string | number | null)[][];
  /** Tablonun altındaki not (ör. ajanın yorumu) */
  not?: string | null;
}

/** Tablosuz bölüm: yalnızca açıklama (ör. "reklam hesapları bağlanınca") */
export interface ReportNote {
  baslik: string;
  metin: string;
}

export type ReportSection = ReportTable | ReportNote;

const font = (ad: string) => fileURLToPath(new URL(`../../assets/fonts/${ad}.ttf`, import.meta.url));
const RENK = ['#5B8CFF', '#FF6FB5', '#FFC84A', '#3DD68C'];
const MUREKKEP = '#1E2333';
const GRI = '#5A6073';
const ACIK_GRI = '#EEF0F5';
const ZEMIN = '#F6F8FD';
/** "1.490 TL", "%12,5", "—", "+3 puan", "▲ %4" gibi değerler */
const SAYISAL = /^[-+▲▼]?\s*[%₺]?\s*[\d.,]+\s*(TL|puan)?$|^—$/;
/** Bitişik harfler (fi, fl) kapalı: PDF'ten kopyalanan metin ve arama doğru çalışsın */
const HARF = { liga: false, clig: false } as unknown as PDFKit.Mixins.OpenTypeFeatures[];

/**
 * Zamanlanmış raporun PDF'i (Karar 44). Sitenin yazı tipi (Plus Jakarta Sans, SIL Open Font License) gömülür; Türkçe
 * harfler doğru çıkar. İçerik kişisel veri taşımaz.
 */
export function reportPdf(r: { baslik: string; alt: string; bolumler: ReportSection[] }): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 48, bottom: 56, left: 48, right: 48 },
    bufferPages: true,
    info: { Title: r.baslik, Author: 'Rengarenk', Subject: r.alt },
  });
  doc.registerFont('R', font('PlusJakartaSans_400Regular'));
  doc.registerFont('B', font('PlusJakartaSans_700Bold'));
  doc.registerFont('X', font('PlusJakartaSans_800ExtraBold'));
  const parcalar: Buffer[] = [];
  doc.on('data', (b: Buffer) => parcalar.push(b));
  const bitti = new Promise<Buffer>((ok) => doc.on('end', () => ok(Buffer.concat(parcalar))));

  const sol = doc.page.margins.left;
  const genislik = doc.page.width - sol - doc.page.margins.right;
  const alt = () => doc.page.height - doc.page.margins.bottom;

  // Başlık: renk noktaları, Rengarenk, rapor adı ve dönem
  RENK.forEach((c, i) => {
    doc.roundedRect(sol + i * 22, 48, 18, 6, 3).fill(c);
  });
  doc.font('X').fontSize(10).fillColor(GRI).text('Rengarenk · yönetim', sol, 62);
  doc.font('X').fontSize(22).fillColor(MUREKKEP).text(r.baslik, sol, 80, { width: genislik, features: HARF });
  doc.font('R').fontSize(10.5).fillColor(GRI).text(r.alt, { width: genislik, features: HARF });
  doc.moveDown(1.2);

  const yer = (h: number) => {
    if (doc.y + h > alt()) {
      doc.addPage();
      doc.y = doc.page.margins.top;
    }
  };

  for (const b of r.bolumler) {
    yer(60);
    doc
      .font('X')
      .fontSize(13.5)
      .fillColor(MUREKKEP)
      .text(b.baslik, sol, doc.y, { width: genislik, features: HARF });
    doc.moveDown(0.35);
    if ('metin' in b) {
      doc.font('R').fontSize(10).fillColor(GRI).text(b.metin, { width: genislik, features: HARF });
      doc.moveDown(1);
      continue;
    }
    const n = b.kolonlar.length;
    // İlk sütun geniş, diğerleri eşit
    const ilk = n === 1 ? genislik : Math.max(genislik * 0.36, genislik / n);
    const diger = n === 1 ? 0 : (genislik - ilk) / (n - 1);
    const xs = b.kolonlar.map((_, i) => (i === 0 ? sol : sol + ilk + (i - 1) * diger));
    // Sayı sütunları sağa, metin sütunları sola yaslanır
    const hiza = b.kolonlar.map((_, i) =>
      i > 0 &&
      b.satirlar.every((x) => {
        const v = x[i];
        return v === null || v === undefined || typeof v === 'number' || SAYISAL.test(String(v));
      })
        ? ('right' as const)
        : ('left' as const),
    );
    const ws = b.kolonlar.map((_, i) => (i === 0 ? ilk : diger));
    const satirYuksekligi = (hucreler: string[], f: string, boyut: number) => {
      doc.font(f).fontSize(boyut);
      return Math.max(...hucreler.map((h, i) => doc.heightOfString(h, { width: (ws[i] ?? 0) - 12 }))) + 10;
    };
    const baslikSatiri = () => {
      const h = satirYuksekligi(b.kolonlar, 'B', 9);
      yer(h + 20);
      const y = doc.y;
      doc.rect(sol, y, genislik, h).fill(ZEMIN);
      b.kolonlar.forEach((k, i) => {
        doc
          .font('B')
          .fontSize(9)
          .fillColor(GRI)
          .text(k, (xs[i] ?? 0) + 6, y + 5, { width: (ws[i] ?? 0) - 12, align: hiza[i], features: HARF });
      });
      doc.y = y + h;
    };
    baslikSatiri();
    if (b.satirlar.length === 0) {
      doc
        .font('R')
        .fontSize(10)
        .fillColor(GRI)
        .text('Bu dönemde veri yok.', sol + 6, doc.y + 6, { features: HARF });
      doc.moveDown(0.6);
    }
    for (const satir of b.satirlar) {
      const hucreler = satir.map((v) => (v === null || v === undefined ? '—' : String(v)));
      const h = satirYuksekligi(hucreler, 'R', 10);
      if (doc.y + h > alt()) {
        doc.addPage();
        doc.y = doc.page.margins.top;
        baslikSatiri();
      }
      const y = doc.y;
      hucreler.forEach((v, i) => {
        doc
          .font(i === 0 ? 'B' : 'R')
          .fontSize(10)
          .fillColor(MUREKKEP)
          .text(v, (xs[i] ?? 0) + 6, y + 5, { width: (ws[i] ?? 0) - 12, align: hiza[i], features: HARF });
      });
      doc
        .moveTo(sol, y + h)
        .lineTo(sol + genislik, y + h)
        .lineWidth(0.6)
        .strokeColor(ACIK_GRI)
        .stroke();
      doc.y = y + h;
    }
    if (b.not) {
      doc.moveDown(0.5);
      doc
        .font('R')
        .fontSize(9.5)
        .fillColor('#2E3344')
        .text(b.not, sol, doc.y, { width: genislik, features: HARF });
    }
    doc.moveDown(1.2);
  }

  // Alt bilgi ve sayfa numarası
  const sayfa = doc.bufferedPageRange();
  for (let i = 0; i < sayfa.count; i++) {
    doc.switchToPage(sayfa.start + i);
    // Alt boşluğa yazarken yeni sayfa açılmasın
    doc.page.margins.bottom = 0;
    const y = doc.page.height - 36;
    doc
      .font('R')
      .fontSize(8)
      .fillColor(GRI)
      .text(`Kişisel veri içermez · Rengarenk yönetim konsolu · ${i + 1}/${sayfa.count}`, sol, y, {
        width: genislik,
        align: 'center',
        lineBreak: false,
      });
  }
  doc.end();
  return bitti;
}

/** Excel'in açtığı CSV (UTF-8 BOM, noktalı virgül) */
export function reportCsv(tablolar: ReportTable[]) {
  const satirlar: (string | number | null)[][] = [];
  tablolar.forEach((t, i) => {
    if (i) satirlar.push([]);
    if (tablolar.length > 1) satirlar.push([t.baslik]);
    satirlar.push(t.kolonlar, ...t.satirlar);
  });
  return `﻿${satirlar
    .map((x) => x.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';'))
    .join('\r\n')}`;
}
