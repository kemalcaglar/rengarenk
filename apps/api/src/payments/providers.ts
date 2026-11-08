import { createHmac, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';

export interface CheckoutInput {
  oid: string;
  amountKurus: number;
  email: string;
  userIp: string;
  /** PayTR sepeti: [ad, birim fiyat "199.00", adet] */
  basket: [string, string, number][];
  userName: string;
  userAddress: string;
  userPhone: string;
  okUrl: string;
  failUrl: string;
}

export interface Notification {
  oid: string;
  status: 'success' | 'failed';
  amountKurus: number;
  totalKurus: number;
  method: string | null;
  failCode: string | null;
  failMessage: string | null;
  testMode: boolean;
  /** Kart saklandıysa ödeme kuruluşunun kullanıcı anahtarı (PayTR utoken) */
  cardToken: string | null;
}

/** Kart saklayan ödeme (galeri aboneliği): kartı kayıtlı kullanıcının anahtarı da gönderilir */
export interface CardCheckoutInput extends CheckoutInput {
  utoken?: string | null;
}

/** Tarayıcının kart bilgisiyle doğrudan ödeme kuruluşuna gönderdiği form */
export interface CardForm {
  action: string;
  fields: Record<string, string>;
}

export interface StoredCard {
  ctoken: string;
  last4: string;
  schema: string;
  requireCvv: boolean;
}

export interface ChargeResult {
  status: 'success' | 'failed' | 'wait_callback';
  message: string | null;
}

/**
 * Ödeme kuruluşu (Karar 12.7, Teknik tasarım §7). Kart bilgisi Rengarenk'e gelmez: kuruluşun ödeme çerçevesi açılır,
 * sonuç imzalı bildirimle gelir. İade bu arayüzde yoktur: iade yalnızca sahibin onayıyla, ayrı yürütücü süreçte yapılır.
 */
export interface PaymentProvider {
  readonly ad: 'none' | 'fake' | 'paytr';
  /** Ödeme çerçevesinin adresi */
  checkout(i: CheckoutInput): Promise<string>;
  /** Bildirimin imzasını doğrular; geçersizse null */
  verify(body: Record<string, string>): Notification | null;
  /**
   * Kartı saklayarak ödeme formu (PayTR Direkt API, `store_card=1`). Kart bilgisi tarayıcıdan doğrudan ödeme kuruluşuna
   * gider; Rengarenk sunucusuna gelmez.
   */
  cardForm(i: CardCheckoutInput): CardForm;
  /** Kullanıcının saklı kartları (PayTR CAPI LIST) */
  cards(utoken: string): Promise<StoredCard[]>;
  /** Saklı karttan tekrarlı tahsilat (3D'siz, `recurring_payment=1`); kesin sonuç bildirimle de gelir */
  chargeStored(i: CheckoutInput & { utoken: string; ctoken: string }): Promise<ChargeResult>;
}

const hmac = (key: string, msg: string) => createHmac('sha256', key).update(msg).digest('base64');
const esit = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

function parseNotification(body: Record<string, string>, key: string, salt: string): Notification | null {
  const { merchant_oid: oid, status, total_amount: total, hash } = body;
  if (!oid || !status || !total || !hash) return null;
  if (status !== 'success' && status !== 'failed') return null;
  if (!esit(hmac(key, `${oid}${salt}${status}${total}`), hash)) return null;
  return {
    oid,
    status,
    amountKurus: Number(body.payment_amount ?? total),
    totalKurus: Number(total),
    method: body.payment_type ?? null,
    failCode: body.failed_reason_code ?? null,
    failMessage: body.failed_reason_msg ?? null,
    testMode: body.test_mode === '1',
    cardToken: body.utoken || null,
  };
}

/** PayTR Direkt API tutar biçimi: "1788.00" */
const tutar = (kurus: number) => (kurus / 100).toFixed(2);

/** Ödeme kapalı: PayTR sözleşmesi gelene kadar canlıda satın alma yapılamaz. */
export class NoPayment implements PaymentProvider {
  readonly ad = 'none' as const;
  async checkout(): Promise<string> {
    throw new Error('Ödeme şu an kapalı');
  }
  verify() {
    return null;
  }
  cardForm(): CardForm {
    throw new Error('Ödeme şu an kapalı');
  }
  async cards(): Promise<StoredCard[]> {
    return [];
  }
  async chargeStored(): Promise<ChargeResult> {
    return { status: 'failed', message: 'Ödeme şu an kapalı' };
  }
}

/**
 * PayTR iFrame API (dev.paytr.com › iFrame API 1. ve 2. adım): token isteği sunucudan, çerçeve
 * `https://www.paytr.com/odeme/guvenli/{token}`. Bildirim özeti HMAC-SHA256(merchant_key,
 * merchant_oid + merchant_salt + status + total_amount), base64.
 */
export class PaytrPayment implements PaymentProvider {
  readonly ad = 'paytr' as const;
  constructor(
    private readonly id: string,
    private readonly key: string,
    private readonly salt: string,
    private readonly testMode: '0' | '1',
  ) {}

  async checkout(i: CheckoutInput): Promise<string> {
    const basket = Buffer.from(JSON.stringify(i.basket)).toString('base64');
    const noInstallment = '1';
    const maxInstallment = '0';
    const currency = 'TL';
    const amount = String(i.amountKurus);
    const token = hmac(
      this.key,
      `${this.id}${i.userIp}${i.oid}${i.email}${amount}${basket}${noInstallment}${maxInstallment}${currency}${this.testMode}${this.salt}`,
    );
    const form = new URLSearchParams({
      merchant_id: this.id,
      user_ip: i.userIp,
      merchant_oid: i.oid,
      email: i.email,
      payment_amount: amount,
      paytr_token: token,
      user_basket: basket,
      debug_on: '0',
      no_installment: noInstallment,
      max_installment: maxInstallment,
      user_name: i.userName.slice(0, 60),
      user_address: i.userAddress.slice(0, 400),
      user_phone: i.userPhone.slice(0, 20),
      merchant_ok_url: i.okUrl,
      merchant_fail_url: i.failUrl,
      timeout_limit: '30',
      currency,
      test_mode: this.testMode,
      lang: 'tr',
    });
    const r = await fetch('https://www.paytr.com/odeme/api/get-token', {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(20_000),
    });
    const j = (await r.json().catch(() => ({}))) as { status?: string; token?: string; reason?: string };
    if (j.status !== 'success' || !j.token) throw new Error(`PayTR: ${j.reason ?? r.status}`);
    return `https://www.paytr.com/odeme/guvenli/${j.token}`;
  }

  verify(body: Record<string, string>) {
    return parseNotification(body, this.key, this.salt);
  }

  /**
   * Direkt API 1. adım ve Kart Saklama API özeti: merchant_id + user_ip + merchant_oid + email + payment_amount +
   * payment_type + installment_count + currency + test_mode + non_3d + merchant_salt
   */
  private token(i: CheckoutInput, non3d: '0' | '1') {
    return hmac(
      this.key,
      `${this.id}${i.userIp}${i.oid}${i.email}${tutar(i.amountKurus)}card0TL${this.testMode}${non3d}${this.salt}`,
    );
  }

  private ortak(i: CheckoutInput, non3d: '0' | '1') {
    return {
      merchant_id: this.id,
      paytr_token: this.token(i, non3d),
      user_ip: i.userIp,
      merchant_oid: i.oid,
      email: i.email,
      payment_amount: tutar(i.amountKurus),
      payment_type: 'card',
      installment_count: '0',
      currency: 'TL',
      client_lang: 'tr',
      test_mode: this.testMode,
      non_3d: non3d,
      merchant_ok_url: i.okUrl,
      merchant_fail_url: i.failUrl,
      user_name: i.userName.slice(0, 60),
      user_address: i.userAddress.slice(0, 400),
      user_phone: i.userPhone.slice(0, 20),
      user_basket: JSON.stringify(i.basket),
      debug_on: '0',
    };
  }

  cardForm(i: CardCheckoutInput): CardForm {
    return {
      action: 'https://www.paytr.com/odeme',
      fields: { ...this.ortak(i, '0'), store_card: '1', ...(i.utoken ? { utoken: i.utoken } : {}) },
    };
  }

  async cards(utoken: string): Promise<StoredCard[]> {
    const r = await fetch('https://www.paytr.com/odeme/capi/list', {
      method: 'POST',
      body: new URLSearchParams({
        merchant_id: this.id,
        utoken,
        paytr_token: hmac(this.key, `${utoken}${this.salt}`),
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const j = (await r.json().catch(() => null)) as unknown;
    if (!Array.isArray(j)) return [];
    return j.map((c: Record<string, string>) => ({
      ctoken: c.ctoken ?? '',
      last4: c.last_4 ?? '',
      schema: c.schema ?? 'KART',
      requireCvv: c.require_cvv === '1',
    }));
  }

  async chargeStored(i: CheckoutInput & { utoken: string; ctoken: string }): Promise<ChargeResult> {
    const r = await fetch('https://www.paytr.com/odeme', {
      method: 'POST',
      body: new URLSearchParams({
        ...this.ortak(i, '1'),
        utoken: i.utoken,
        ctoken: i.ctoken,
        recurring_payment: '1',
        sync_mode: '1',
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const j = (await r.json().catch(() => ({}))) as { status?: string; msg?: string; reason?: string };
    if (j.status === 'success') return { status: 'success', message: null };
    if (j.status === 'wait_callback') return { status: 'wait_callback', message: j.msg ?? null };
    return { status: 'failed', message: (j.msg ?? j.reason ?? `PayTR ${r.status}`).slice(0, 300) };
  }
}

/**
 * Geliştirme ve test: kendi sahte ödeme sayfamız (`/odeme/sahte/:no`). Sayfa PayTR'nin bildirimiyle aynı biçimde,
 * aynı özetle bildirim gönderir; böylece bildirim işleme kodu gerçek akışla aynı yoldan sınanır.
 */
export class FakePayment implements PaymentProvider {
  readonly ad = 'fake' as const;
  readonly key: string;
  readonly salt = 'sahte-tuz';
  constructor(
    private readonly apiUrl: string,
    secret: string,
  ) {
    this.key = `sahte-odeme:${secret}`;
  }
  async checkout(i: CheckoutInput): Promise<string> {
    return `${this.apiUrl}/odeme/sahte/${encodeURIComponent(i.oid)}`;
  }
  /** Sahte sayfanın göndereceği bildirim gövdesi; kart saklandıysa kullanıcı anahtarıyla */
  notification(oid: string, status: 'success' | 'failed', amountKurus: number, utoken?: string) {
    const total = String(amountKurus);
    return {
      ...(utoken && status === 'success' ? { utoken } : {}),
      merchant_oid: oid,
      status,
      total_amount: total,
      payment_amount: total,
      payment_type: 'card',
      currency: 'TL',
      test_mode: '1',
      ...(status === 'failed'
        ? { failed_reason_code: '0', failed_reason_msg: 'Kart limiti yetersiz (sahte)' }
        : {}),
      hash: hmac(this.key, `${oid}${this.salt}${status}${total}`),
    };
  }
  verify(body: Record<string, string>) {
    return parseNotification(body, this.key, this.salt);
  }
  /** Sahte kart sayfası: kart bilgisi istenmez, "kartı kaydet" düğmeleri */
  cardForm(i: CardCheckoutInput): CardForm {
    return { action: `${this.apiUrl}/odeme/sahte/${encodeURIComponent(i.oid)}`, fields: {} };
  }
  /** "sahte-red-" ile başlayan anahtarın kartı yenilemede reddedilir (başarısız yenileme denemesi için) */
  async cards(utoken: string): Promise<StoredCard[]> {
    const red = utoken.startsWith('sahte-red-');
    return [{ ctoken: `c-${utoken}`, last4: red ? '0002' : '4242', schema: 'VISA', requireCvv: false }];
  }
  async chargeStored(i: CheckoutInput & { utoken: string; ctoken: string }): Promise<ChargeResult> {
    if (i.utoken.startsWith('sahte-red-')) return { status: 'failed', message: 'Kart reddedildi (sahte)' };
    return { status: 'success', message: null };
  }
}

@Injectable()
export class PaymentProviderFactory {
  private provider: PaymentProvider | null = null;
  constructor(@Inject(ENV) private readonly env: Env) {}
  get(): PaymentProvider {
    if (this.provider) return this.provider;
    const e = this.env;
    this.provider =
      e.PAYMENT_PROVIDER === 'paytr'
        ? new PaytrPayment(
            e.PAYTR_MERCHANT_ID as string,
            e.PAYTR_MERCHANT_KEY as string,
            e.PAYTR_MERCHANT_SALT as string,
            e.PAYTR_TEST_MODE,
          )
        : e.PAYMENT_PROVIDER === 'fake'
          ? new FakePayment(e.API_PUBLIC_URL, e.JWT_SECRET)
          : new NoPayment();
    return this.provider;
  }
}

// ── e-Arşiv ─────────────────────────────────────────────────────

export interface InvoiceInput {
  orderNo: string;
  date: Date;
  billing: {
    ad: string;
    eposta: string;
    il: string;
    ilce: string;
    kurumsal?: { unvan: string; vergiNo: string; vergiDairesi: string };
  };
  lines: { ad: string; adet: number; tutarKurus: number }[];
  totalKurus: number;
  vatKurus: number;
}

/** İade faturası: iade edilen tutar ve asıl faturanın no'su */
export interface RefundInvoiceInput {
  orderNo: string;
  invoiceNo: string | null;
  date: Date;
  billing: InvoiceInput['billing'];
  amountKurus: number;
  vatKurus: number;
}

/** e-Arşiv entegratörü (Karar 12.7): fatura no ve PDF döner. Entegratör seçilince bu arayüzü uygular. */
export interface EArsivProvider {
  readonly ad: string;
  issue(i: InvoiceInput): Promise<{ no: string; pdf: Uint8Array }>;
  issueRefund(i: RefundInvoiceInput): Promise<{ no: string; pdf: Uint8Array }>;
}

/** Entegratör yok: fatura kesilemez, kuyrukta bekler */
export class NoEArsiv implements EArsivProvider {
  readonly ad = 'none';
  async issue(): Promise<{ no: string; pdf: Uint8Array }> {
    throw new Error('e-Arşiv entegratörü henüz bağlanmadı');
  }
  async issueRefund(): Promise<{ no: string; pdf: Uint8Array }> {
    throw new Error('e-Arşiv entegratörü henüz bağlanmadı');
  }
}

/** Geliştirme ve test: "SAHTE" damgalı, gerçek olmayan bir fatura PDF'i üretir */
export class FakeEArsiv implements EArsivProvider {
  readonly ad = 'fake';
  async issue(i: InvoiceInput) {
    const no = `RGS${i.date.getFullYear()}${String(Date.now()).slice(-9)}`;
    return { no, pdf: basitPdf(no, i) };
  }
  async issueRefund(i: RefundInvoiceInput) {
    const no = `RGI${i.date.getFullYear()}${String(Date.now()).slice(-9)}`;
    return {
      no,
      pdf: basitPdf(no, {
        orderNo: `${i.orderNo} (IADE${i.invoiceNo ? `, asil fatura ${i.invoiceNo}` : ''})`,
        date: i.date,
        billing: i.billing,
        lines: [{ ad: 'Hizmet bedeli iadesi', adet: 1, tutarKurus: i.amountKurus }],
        totalKurus: i.amountKurus,
        vatKurus: i.vatKurus,
      }),
    };
  }
}

@Injectable()
export class EArsivFactory {
  constructor(@Inject(ENV) private readonly env: Env) {}
  create(): EArsivProvider {
    return this.env.EARSIV_PROVIDER === 'fake' ? new FakeEArsiv() : new NoEArsiv();
  }
}

/** Türkçe harfleri PDF'in standart yazı tipinde gösterilebilir harflere çevirir (yalnızca sahte fatura için) */
const ascii = (s: string) =>
  s
    .replace(/[ğĞ]/g, (c) => (c === 'ğ' ? 'g' : 'G'))
    .replace(/[üÜ]/g, (c) => (c === 'ü' ? 'u' : 'U'))
    .replace(/[şŞ]/g, (c) => (c === 'ş' ? 's' : 'S'))
    .replace(/[ıİ]/g, (c) => (c === 'ı' ? 'i' : 'I'))
    .replace(/[öÖ]/g, (c) => (c === 'ö' ? 'o' : 'O'))
    .replace(/[çÇ]/g, (c) => (c === 'ç' ? 'c' : 'C'))
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/[()\\]/g, ' ');

/** Tek sayfalık, metin içeren en küçük PDF */
function basitPdf(no: string, i: InvoiceInput): Uint8Array {
  const tl = (k: number) => `${(k / 100).toFixed(2)} TL`;
  const satirlar = [
    'SAHTE FATURA - GELISTIRME ORTAMI, GECERSIZDIR',
    `Fatura no: ${no}`,
    `Siparis no: ${i.orderNo}`,
    `Tarih: ${i.date.toISOString().slice(0, 10)}`,
    `Alici: ${i.billing.kurumsal ? `${i.billing.kurumsal.unvan} VKN ${i.billing.kurumsal.vergiNo}` : i.billing.ad}`,
    `${i.billing.il} / ${i.billing.ilce}`,
    '',
    ...i.lines.map((l) => `${l.adet} x ${l.ad}  ${tl(l.tutarKurus)}`),
    '',
    `KDV dahil toplam: ${tl(i.totalKurus)}   KDV (%20): ${tl(i.vatKurus)}`,
  ].map(ascii);
  const icerik = [
    'BT /F1 11 Tf 50 790 Td 16 TL',
    ...satirlar.map((s, n) => (n === 0 ? `(${s}) Tj` : `T* (${s}) Tj`)),
    'ET',
  ].join('\n');
  const nesneler = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(icerik)} >>\nstream\n${icerik}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const konumlar: number[] = [];
  nesneler.forEach((n, k) => {
    konumlar.push(Buffer.byteLength(pdf));
    pdf += `${k + 1} 0 obj\n${n}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${nesneler.length + 1}\n0000000000 65535 f \n`;
  for (const k of konumlar) pdf += `${String(k).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${nesneler.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(pdf, 'latin1'));
}
