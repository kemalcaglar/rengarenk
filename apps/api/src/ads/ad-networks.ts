import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AdEventName } from '@rengarenk/shared';
import { ENV, type Env } from '../config/env.js';

/**
 * Reklam ağları (Karar 35). Olaylar kişisel veri olarak yalnızca özet (SHA-256) telefon ve kullanıcı kimliği, Meta
 * çerezleri (fbp, fbc), IP ve tarayıcı bilgisiyle gider; mesaj, talep açıklaması, plaka ve şasi hiçbir zaman gitmez.
 * Gizli anahtarlar günlüğe yazılmaz.
 */

export type AgAdi = 'meta' | 'google';

export interface AdUser {
  /** sha256(kullanıcı kimliği) */
  externalId: string;
  /** sha256(ülke kodlu telefon, yalnızca rakam) */
  ph?: string;
  fbp?: string;
  fbc?: string;
  gclid?: string;
  ip?: string;
  ua?: string;
}

export interface AdOut {
  id: string;
  name: AdEventName;
  /** saniye */
  time: number;
  /** web: tarayıcıyla tekilleşen olay; sunucu: yalnızca sunucudan (galeri onayı gibi) */
  kaynak: 'web' | 'sunucu';
  url?: string;
  valueKurus?: number | null;
  category?: string | null;
  user: AdUser;
}

export interface SpendRow {
  campaign: string;
  spendKurus: number;
  impressions: number;
  clicks: number;
}

export interface AdNetwork {
  readonly ag: AgAdi;
  /** Konsolda görünen sağlayıcı adı */
  readonly saglayici: string;
  /** Gönderim açık mı (hesap yoksa olaylar bekler) */
  readonly acik: boolean;
  /** Olayı kabul etme süresi (Meta 7 gün, Google çevrimdışı dönüşüm 90 gün) */
  readonly sureGun: number;
  gonder(evts: AdOut[]): Promise<void>;
  /** Bir günün kampanya harcamaları (TR günü, YYYY-AA-GG) */
  harcama(gun: string): Promise<SpendRow[] | null>;
}

/** Hesap açılana kadar: olay gönderilmez, harcama çekilmez */
class NoNetwork implements AdNetwork {
  readonly saglayici = 'bağlı değil';
  readonly acik = false;
  constructor(
    readonly ag: AgAdi,
    readonly sureGun: number,
  ) {}
  async gonder() {
    throw new Error('Ağ bağlı değil');
  }
  async harcama() {
    return null;
  }
}

/** Geliştirme ve test: gönderilenleri bellekte tutar (canlıda kullanılamaz) */
export class FakeAdNetwork implements AdNetwork {
  static gonderilen: { ag: AgAdi; olay: AdOut }[] = [];
  static harcamalar: Partial<Record<AgAdi, Record<string, SpendRow[]>>> = {};
  /** Testte hata denemesi */
  static hata: Partial<Record<AgAdi, string>> = {};
  readonly saglayici = 'sahte (geliştirme)';
  readonly acik = true;
  constructor(
    readonly ag: AgAdi,
    readonly sureGun: number,
  ) {}
  async gonder(evts: AdOut[]) {
    const h = FakeAdNetwork.hata[this.ag];
    if (h) throw new Error(h);
    for (const olay of evts) FakeAdNetwork.gonderilen.push({ ag: this.ag, olay });
  }
  async harcama(gun: string) {
    return FakeAdNetwork.harcamalar[this.ag]?.[gun] ?? [];
  }
}

const GRAPH = 'https://graph.facebook.com/v21.0';

/** Meta Conversions API ve (reklam hesabı verilirse) Marketing API ile kampanya harcaması */
class MetaCapi implements AdNetwork {
  readonly ag = 'meta' as const;
  readonly saglayici = 'Conversions API';
  readonly acik = true;
  readonly sureGun = 7;
  private readonly log = new Logger('MetaCapi');
  constructor(private readonly env: Env) {}

  async gonder(evts: AdOut[]) {
    const data = evts.map((e) => ({
      event_name: e.name,
      event_time: e.time,
      event_id: e.id,
      action_source: e.kaynak === 'web' ? 'website' : 'system_generated',
      ...(e.kaynak === 'web' && e.url ? { event_source_url: e.url } : {}),
      user_data: {
        external_id: [e.user.externalId],
        ...(e.user.ph ? { ph: [e.user.ph] } : {}),
        ...(e.user.fbp ? { fbp: e.user.fbp } : {}),
        ...(e.user.fbc ? { fbc: e.user.fbc } : {}),
        ...(e.user.ip ? { client_ip_address: e.user.ip } : {}),
        ...(e.user.ua ? { client_user_agent: e.user.ua } : {}),
      },
      custom_data: {
        ...(e.valueKurus ? { currency: 'TRY', value: e.valueKurus / 100 } : {}),
        ...(e.category ? { content_category: e.category } : {}),
      },
    }));
    const res = await fetch(`${GRAPH}/${this.env.META_PIXEL_ID}/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        data,
        access_token: this.env.META_CAPI_TOKEN,
        ...(this.env.META_TEST_EVENT_CODE ? { test_event_code: this.env.META_TEST_EVENT_CODE } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      throw new Error(`Meta ${res.status}: ${body?.error?.message?.slice(0, 200) ?? 'yanıt okunamadı'}`);
    }
  }

  async harcama(gun: string) {
    if (!this.env.META_AD_ACCOUNT) return null;
    const q = new URLSearchParams({
      level: 'campaign',
      fields: 'campaign_name,spend,impressions,clicks',
      time_range: JSON.stringify({ since: gun, until: gun }),
      limit: '500',
      access_token: this.env.META_CAPI_TOKEN ?? '',
    });
    const res = await fetch(`${GRAPH}/act_${this.env.META_AD_ACCOUNT}/insights?${q}`, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Meta harcama ${res.status}`);
    const body = (await res.json()) as {
      data: { campaign_name: string; spend: string; impressions: string; clicks: string }[];
    };
    this.log.log(`Meta harcama ${gun}: ${body.data.length} kampanya`);
    return body.data.map((r) => ({
      campaign: r.campaign_name,
      spendKurus: Math.round(Number(r.spend) * 100),
      impressions: Number(r.impressions) || 0,
      clicks: Number(r.clicks) || 0,
    }));
  }
}

export const AD_NETWORKS = Symbol('AD_NETWORKS');

@Injectable()
export class AdNetworkFactory {
  constructor(@Inject(ENV) private readonly env: Env) {}
  create(): Record<AgAdi, AdNetwork> {
    const meta =
      this.env.META_PROVIDER === 'capi'
        ? new MetaCapi(this.env)
        : this.env.META_PROVIDER === 'fake'
          ? new FakeAdNetwork('meta', 7)
          : new NoNetwork('meta', 7);
    const google =
      this.env.GOOGLE_ADS_PROVIDER === 'fake' ? new FakeAdNetwork('google', 90) : new NoNetwork('google', 90);
    return { meta, google };
  }
}
