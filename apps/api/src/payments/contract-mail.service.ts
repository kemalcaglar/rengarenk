import { Inject, Injectable, Logger } from '@nestjs/common';
import { type Billing, tlYaz } from '@rengarenk/shared';
import { documentPdf } from '../common/document-pdf.js';
import { ENV, type Env } from '../config/env.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { EMAIL_SENDER, type EmailSender } from '../notifications/channels.js';

const SOZLESMELER = {
  mesafeli_sozlesme: { dosya: 'mesafeli-hizmet-sozlesmesi', ad: 'Mesafeli hizmet sözleşmesi' },
  galeri_sozlesmesi: { dosya: 'galeri-hizmet-sozlesmesi', ad: 'Galeri hizmet sözleşmesi' },
} as const;

const tarih = (d: Date) =>
  new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(d);
/** "+905321234567" → "0 (532) 123 45 67"; kapatılmış hesapta boş */
const telefonYaz = (e164: string) => {
  const d = e164.replace(/^\+90/, '');
  return /^5\d{9}$/.test(d) ? `0 (${d.slice(0, 3)}) ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8)}` : '—';
};
const kacir = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );

/**
 * Ön bilgilendirme formu ve sözleşmenin kalıcı veri saklayıcısıyla teslimi (Mesafeli Sözleşmeler Yönetmeliği; Karar 39;
 * 06-yasal-metin-taslaklari.md §6–8). Ödeme alınınca işçi, siparişte onaylanan metin sürümleriyle PDF'leri üretip
 * fatura e-postasına gönderir. Web siparişlerinde (ürün, abonelik, üst pakete geçiş); otomatik yenileme yeni sözleşme
 * değildir, mağaza satışında belgeleri mağaza verir. Gönderim bir kez yapılır (`orders.contract_sent_at`); geçici
 * hatada olay yeniden denenir. Bu işlemsel bir iletidir; bildirim tercihine ve ticari onaya bağlı değildir.
 */
@Injectable()
export class ContractMailService {
  private readonly log = new Logger('Sözleşme e-postası');

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
  ) {}

  private async not(id: string, neden: string) {
    await this.db.order.update({ where: { id }, data: { contractNote: neden } });
    return 'atlandi' as const;
  }

  async gonder(orderId: string): Promise<'gonderildi' | 'atlandi' | 'zaten'> {
    const o = await this.db.order.findUnique({
      where: { id: orderId },
      include: { user: { select: { phone: true } } },
    });
    if (o?.status !== 'PAID') return 'atlandi';
    if (o.contractSentAt) return 'zaten';
    if (o.channel !== 'web') return this.not(o.id, 'Mağaza ya da otomatik yenileme: yeni sözleşme yok');
    const fatura = o.billing as unknown as Billing;
    const adres = fatura?.eposta?.toLowerCase();
    if (!adres) return this.not(o.id, 'Fatura e-postası yok');
    const engel = await this.db.emailSuppression.findUnique({ where: { email: adres } });
    if (engel && !engel.onlyCommercial && engel.reason !== 'gecici_hata') {
      return this.not(o.id, `Adres gönderim dışı (${engel.reason})`);
    }

    const surumler = ((o.consents as { surumler?: Record<string, number | null> })?.surumler ?? {}) as Record<
      string,
      number | null
    >;
    const zaman = o.paidAt ?? o.createdAt;
    const alt = `Sipariş ${o.no} · ${tarih(zaman)}`;
    const altBilgi = `Rengarenk · sipariş ${o.no} · bu belge ödeme ekranında onayladığın metnin kopyasıdır`;
    const taraf: [string, string][] = [
      ['Sipariş no', o.no],
      [fatura.kurumsal ? 'Alıcı' : 'Tüketici', fatura.kurumsal?.unvan ?? fatura.ad],
      ['Telefon', telefonYaz(o.user.phone)],
      ['E-posta', fatura.eposta],
      ['Toplam', `${tlYaz(Number(o.totalKurus))}, tüm vergiler dahil`],
      ['Onay zamanı', tarih(o.createdAt)],
    ];

    const ekler: { filename: string; content: Buffer; contentType: string }[] = [
      {
        filename: `on-bilgilendirme-formu-${o.no}.pdf`,
        content: await documentPdf({
          baslik: 'Ön bilgilendirme formu',
          alt,
          bilgiler: taraf,
          metin: o.preInfo.replace(/^# .*\n?/, ''),
          altBilgi,
        }),
        contentType: 'application/pdf',
      },
    ];
    for (const [key, s] of Object.entries(SOZLESMELER)) {
      if (!(key in surumler)) continue;
      const v = surumler[key];
      const t =
        (v ? await this.db.consentText.findFirst({ where: { key, version: v } }) : null) ??
        (await this.db.consentText.findFirst({ where: { key }, orderBy: { version: 'desc' } }));
      if (!t) continue;
      ekler.push({
        filename: `${s.dosya}-${o.no}.pdf`,
        content: await documentPdf({
          baslik: t.title || s.ad,
          alt: `${alt} · metin sürümü ${t.version}`,
          bilgiler: taraf,
          metin: t.body,
          altBilgi,
        }),
        contentType: 'application/pdf',
      });
    }

    const adlar = ekler.length > 1 ? 'Ön bilgilendirme formu ve sözleşme' : 'Ön bilgilendirme formu';
    const haklarim = `${this.env.WEB_ORIGIN}/haklarim`;
    const r = await this.email.send({
      to: adres,
      from: this.env.EPOSTA_GONDEREN,
      subject: `Rengarenk · ${o.no} siparişinin ön bilgilendirme formu ve sözleşmesi`,
      text: `Merhaba,\n\n${o.no} numaralı siparişin için onayladığın ${adlar.toLocaleLowerCase('tr-TR')} ekteki PDF dosyalarında. Bu belgeleri saklamanı öneririz; Haklarım › Ödeme geçmişi ekranından da görebilirsin: ${haklarim}\n\nToplam: ${tlYaz(Number(o.totalKurus))}, tüm vergiler dahil.\n\nRengarenk`,
      html: `<p style="font:14px/1.6 system-ui,sans-serif;color:#1E2333">Merhaba,</p><p style="font:14px/1.6 system-ui,sans-serif;color:#1E2333"><strong>${kacir(o.no)}</strong> numaralı siparişin için onayladığın ${kacir(adlar.toLocaleLowerCase('tr-TR'))} ekteki PDF dosyalarında. Bu belgeleri saklamanı öneririz; <a href="${kacir(haklarim)}" style="color:#2450C8">Haklarım › Ödeme geçmişi</a> ekranından da görebilirsin.</p><p style="font:14px/1.6 system-ui,sans-serif;color:#1E2333">Toplam: ${kacir(tlYaz(Number(o.totalKurus)))}, tüm vergiler dahil.</p><p style="font:12px system-ui,sans-serif;color:#5A6073">Rengarenk</p>`,
      attachments: ekler,
    });
    if (r.status === 'sent') {
      await this.db.order.update({
        where: { id: o.id },
        data: { contractSentAt: new Date(), contractNote: null },
      });
      return 'gonderildi';
    }
    if (r.status === 'permanent') return this.not(o.id, `Gönderilemedi: ${r.message ?? 'kalıcı hata'}`);
    await this.db.order.update({
      where: { id: o.id },
      data: { contractNote: 'Geçici hata; yeniden denenecek' },
    });
    this.log.warn(`sipariş ${o.no}: geçici hata`);
    throw new Error('Sözleşme e-postası geçici olarak gönderilemedi');
  }
}
