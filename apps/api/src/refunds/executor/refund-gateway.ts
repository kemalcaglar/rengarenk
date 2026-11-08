import { createHmac } from 'node:crypto';
import type { Env } from '../../config/env.js';

export interface RefundInput {
  /** Siparişin ödeme kuruluşundaki no'su (merchant_oid) */
  oid: string;
  amountKurus: number;
  /** İade referansı (harf ve rakam, en çok 64) */
  referenceNo: string;
}

export interface RefundResult {
  /** unknown: bağlantı hatası, iadenin yapılıp yapılmadığı bilinmiyor (yeniden denenmez, sahip inceler) */
  status: 'success' | 'failed' | 'unknown';
  message: string | null;
  testMode: boolean;
}

/**
 * Ödeme kuruluşunun iade ucu. Yalnızca iade yürütücü sürecinde (`src/refund-executor.ts`) kurulur; API ve işçi bu
 * dosyayı içe aktarmaz (test denetler). Kilit 2 (Teknik tasarım §7).
 */
export interface RefundGateway {
  readonly ad: 'none' | 'fake' | 'paytr';
  refund(i: RefundInput): Promise<RefundResult>;
}

class NoRefund implements RefundGateway {
  readonly ad = 'none' as const;
  async refund(): Promise<RefundResult> {
    return { status: 'failed', message: 'İade altyapısı kapalı (REFUND_PROVIDER=none)', testMode: false };
  }
}

/** Geliştirme ve test: her iade başarılı; `failNext` ile bir sonraki iade reddedilir ya da belirsiz kalır */
export class FakeRefund implements RefundGateway {
  readonly ad = 'fake' as const;
  failNext: 'failed' | 'unknown' | null = null;
  readonly calls: RefundInput[] = [];
  async refund(i: RefundInput): Promise<RefundResult> {
    this.calls.push(i);
    const f = this.failNext;
    this.failNext = null;
    if (f === 'failed') return { status: 'failed', message: 'İade reddedildi (sahte)', testMode: true };
    if (f === 'unknown') return { status: 'unknown', message: 'Bağlantı koptu (sahte)', testMode: true };
    return { status: 'success', message: null, testMode: true };
  }
}

/**
 * PayTR iade API (dev.paytr.com › İade API): POST https://www.paytr.com/odeme/iade; özet
 * base64(HMAC-SHA256(merchant_key, merchant_id + merchant_oid + return_amount + merchant_salt)); tutar "10.25".
 */
class PaytrRefund implements RefundGateway {
  readonly ad = 'paytr' as const;
  constructor(
    private readonly id: string,
    private readonly key: string,
    private readonly salt: string,
  ) {}

  async refund(i: RefundInput): Promise<RefundResult> {
    const tutar = (i.amountKurus / 100).toFixed(2);
    const token = createHmac('sha256', this.key)
      .update(`${this.id}${i.oid}${tutar}${this.salt}`)
      .digest('base64');
    let r: Response;
    try {
      r = await fetch('https://www.paytr.com/odeme/iade', {
        method: 'POST',
        body: new URLSearchParams({
          merchant_id: this.id,
          merchant_oid: i.oid,
          return_amount: tutar,
          paytr_token: token,
          reference_no: i.referenceNo,
        }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (e) {
      return { status: 'unknown', message: `PayTR'ye ulaşılamadı: ${(e as Error).message}`, testMode: false };
    }
    const j = (await r.json().catch(() => null)) as {
      status?: string;
      is_test?: string | number;
      err_no?: string;
      err_msg?: string;
    } | null;
    if (!j) return { status: 'unknown', message: `PayTR yanıtı okunamadı (${r.status})`, testMode: false };
    if (j.status === 'success')
      return { status: 'success', message: null, testMode: String(j.is_test) === '1' };
    return {
      status: 'failed',
      message:
        `PayTR: ${j.err_msg ?? j.status ?? 'iade yapılamadı'}${j.err_no ? ` (${j.err_no})` : ''}`.slice(
          0,
          300,
        ),
      testMode: false,
    };
  }
}

/** Yalnızca iade yürütücü sürecinde (IADE_YURUTUCU=1) kurulabilir */
export function createRefundGateway(env: Env): RefundGateway {
  if (env.IADE_YURUTUCU !== '1') throw new Error('İade ucu yalnızca iade yürütücü sürecinde kurulabilir');
  if (env.REFUND_PROVIDER === 'fake') return new FakeRefund();
  if (env.REFUND_PROVIDER === 'paytr') {
    const { IADE_PAYTR_MERCHANT_ID: id, IADE_PAYTR_MERCHANT_KEY: key, IADE_PAYTR_MERCHANT_SALT: salt } = env;
    if (!id || !key || !salt)
      throw new Error('PayTR iadesi için IADE_PAYTR_MERCHANT_ID, _KEY ve _SALT gerekli');
    return new PaytrRefund(id, key, salt);
  }
  return new NoRefund();
}
