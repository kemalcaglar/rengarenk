import { Inject, Injectable, Optional } from '@nestjs/common';
import { colors, DEFAULT_DESIGN, type NotifyTemplate, templateOf } from '@rengarenk/shared';
import Handlebars from 'handlebars';
import mjml2html from 'mjml';
import { ENV, type Env } from '../config/env.js';
import { DesignService } from '../content/design.service.js';
import { type Db, PRISMA } from '../database/prisma.js';

export interface Rendered {
  surum: number;
  sablon: NotifyTemplate;
  baslik: string;
  metin: string;
  url: string | null;
}

const hb = Handlebars.create();
const metin = (s: string, veri: object) => hb.compile(s, { noEscape: true })(veri);
const html = (s: string, veri: object) => hb.compile(s)(veri);

/** SMS: Türkçe karakterler GSM 7 bit karşılığına (tek SMS 160 karakter) */
const gsm = (s: string) =>
  s
    .replace(/[ğĞ]/g, (c) => (c === 'ğ' ? 'g' : 'G'))
    .replace(/[üÜ]/g, (c) => (c === 'ü' ? 'u' : 'U'))
    .replace(/[şŞ]/g, (c) => (c === 'ş' ? 's' : 'S'))
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'I')
    .replace(/[öÖ]/g, (c) => (c === 'ö' ? 'o' : 'O'))
    .replace(/[çÇ]/g, (c) => (c === 'ç' ? 'c' : 'C'));

/**
 * Bildirim şablonları (Karar 48; Teknik tasarım §9). Kod içindeki şablon sürüm 0'dır; konsolda düzenlenen şablon yeni
 * sürüm olarak eklenir ve en yeni sürüm kullanılır. Değişkenler Handlebars ile doldurulur; e-posta MJML düzeninden
 * HTML'e derlenir ve marka renklerini (tasarım değerleri, Karar 46) kullanır. Her teslim kaydı şablon sürümünü taşır.
 */
@Injectable()
export class TemplatesService {
  private onbellek = new Map<string, { surum: number; sablon: NotifyTemplate; zaman: number }>();

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    @Optional() private readonly design?: DesignService,
  ) {}

  /** En yeni sürüm (konsoldaki değişiklik bir dakika içinde geçerli olur) */
  async get(key: string): Promise<{ surum: number; sablon: NotifyTemplate }> {
    const o = this.onbellek.get(key);
    if (o && Date.now() - o.zaman < 60_000) return o;
    const kod = templateOf(key);
    if (!kod) throw new Error(`şablon yok: ${key}`);
    const son = await this.db.notificationTemplate.findFirst({
      where: { key },
      orderBy: { version: 'desc' },
    });
    const r = son
      ? { surum: son.version, sablon: { ...kod, ...(son.icerik as Partial<NotifyTemplate>) } }
      : { surum: 0, sablon: kod };
    this.onbellek.set(key, { ...r, zaman: Date.now() });
    return r;
  }

  temizle() {
    this.onbellek.clear();
  }

  /** Mutlak bağlantı (e-posta ve SMS) */
  link(yol: string) {
    return yol.startsWith('http') ? yol : `${this.env.WEB_ORIGIN}${yol}`;
  }

  render(sablon: NotifyTemplate, veri: Record<string, unknown>) {
    return {
      baslik: metin(sablon.baslik, veri),
      metin: metin(sablon.metin, veri),
      url: sablon.url ? metin(sablon.url, veri) : null,
      tekil: sablon.tekil ? metin(sablon.tekil, veri) : null,
    };
  }

  sms(sablon: NotifyTemplate, veri: Record<string, unknown>) {
    return sablon.sms ? gsm(metin(sablon.sms, veri)).slice(0, 320) : null;
  }

  /** E-posta: konu, HTML (MJML) ve düz metin. Ticari iletide tek tıkla ayrılma bağlantısı eklenir (Karar 49). */
  async email(sablon: NotifyTemplate, veri: Record<string, unknown>, ayrilma?: string) {
    const e = sablon.eposta;
    if (!e) return null;
    const konu = metin(e.konu, veri);
    const paragraflar = e.paragraflar.map((p) => html(p, veri));
    const dugme = e.dugme
      ? { yazi: html(e.dugme.yazi, veri), url: this.link(metin(e.dugme.url, veri)) }
      : null;
    const serit = [colors.blue, colors.pink, colors.yellow, colors.green]
      .map(
        (c) =>
          `<span style="display:inline-block;width:10px;height:22px;border-radius:5px;background:${c};margin-right:3px"></span>`,
      )
      .join('');
    // Tasarım değerleri (Karar 46): yazı tipi, köşeler ve geçerli mevsimsel temanın başlığı; renkler `colors`'ta
    const tasarim = this.design ? await this.design.publicDesign() : null;
    const t = tasarim?.degerler ?? DEFAULT_DESIGN;
    const tema = tasarim?.tema ?? null;
    const mjml = `<mjml>
  <mj-head>
    <mj-title>${konu.replace(/</g, '&lt;')}</mj-title>
    <mj-attributes><mj-all font-family="'${t.yaziTipi}', Arial, sans-serif" /><mj-text color="${colors.ink}" font-size="15px" line-height="1.6" /></mj-attributes>
  </mj-head>
  <mj-body background-color="${colors.background}">
    ${
      tema
        ? `<mj-section background-color="${tema.ustBant}" padding="14px 0"><mj-column><mj-text font-size="22px" font-weight="800" color="${tema.ustYazi}">${serit} rengarenk <span style="font-size:13px;font-weight:700">${tema.rozet.replace(/</g, '&lt;')}</span></mj-text></mj-column></mj-section>`
        : `<mj-section padding="24px 0 8px"><mj-column><mj-text font-size="22px" font-weight="800">${serit} rengarenk</mj-text></mj-column></mj-section>`
    }
    <mj-section background-color="#FFFFFF" border-radius="${t.kartKose}px" padding="20px 8px">
      <mj-column>
        ${paragraflar.map((p) => `<mj-text>${p}</mj-text>`).join('\n        ')}
        ${dugme ? `<mj-button href="${dugme.url}" background-color="${colors.blue}" color="${colors.ink}" font-weight="800" border-radius="${t.butonKose}px" align="left">${dugme.yazi}</mj-button>` : ''}
      </mj-column>
    </mj-section>
    <mj-section padding="12px 0"><mj-column><mj-text font-size="12px" color="${colors.muted}">Bu e-posta Rengarenk hesabınla ilgili olduğu için gönderildi. Bildirim tercihlerini Ayarlar › Bildirimler'den değiştirebilirsin.${ayrilma ? ` Kampanya e-postalarından <a href="${ayrilma}">tek tıkla ayrıl</a>.` : ''}</mj-text></mj-column></mj-section>
  </mj-body>
</mjml>`;
    const { html: govde } = await mjml2html(mjml, { validationLevel: 'soft', minify: false });
    const duz = [
      ...e.paragraflar.map((p) => metin(p, veri)),
      dugme ? `${metin(e.dugme?.yazi ?? '', veri)}: ${dugme.url}` : '',
      ayrilma ? `Kampanya e-postalarından ayrıl: ${ayrilma}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
    return { konu, html: govde, text: duz };
  }
}
