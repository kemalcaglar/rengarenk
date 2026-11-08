import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Injectable,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { type Prisma, uuidv7 } from '@rengarenk/db';
import {
  AUTOMATION_KEYS,
  AUTOMATIONS,
  type AutomationKey,
  NOTIFY_TEMPLATES,
  NOTIFY_TOPICS,
  type NotifyTemplate,
  type TemplateEdit,
  templateEditSchema,
  templateOf,
  templateVariables,
  tlYaz,
} from '@rengarenk/shared';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { ENV, type Env } from '../config/env.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { RequirePermission } from '../staff/permissions.js';
import { StaffGuard, type StaffRequest } from '../staff/staff.guard.js';
import { isinmaLimiti } from './commercial.js';
import { ITIBAR_SINIR, ReputationService } from './reputation.js';
import { SwitchService } from './switches.js';
import { TemplatesService } from './templates.service.js';

const DAY = 86_400_000;
/** SMS birim maliyeti (kuruş; teklif netleşince ayara taşınır) */
const SMS_KURUS = 25;

/** Önizleme ve test için örnek değerler ("Ayşe için") */
const ORNEK: Record<string, unknown> = {
  ad: 'Ayşe',
  talep: 'BMW 3 Serisi 320i, 2019 sonrası',
  talepKisa: 'BMW 3 Serisi 320i',
  galeri: 'Marmara Oto',
  galeriKisa: 'Marmara Oto',
  satici: 'Marmara Oto',
  gonderen: 'Marmara Oto',
  konu: 'BMW 3 Serisi 320i',
  gun: 3,
  yazan: 12,
  tutar: '359,99 TL',
  siparis: 'RG8X2K',
  kalem: 'Üst sıra · 7 gün',
  arac: '2020 BMW 3 Serisi 320i M Sport',
  skor: 86,
  sayi: 3,
  arama: 'İstanbul BMW',
  aramalar: 'İstanbul BMW (2), Passat (1)',
  yer: 'Kadıköy, İstanbul',
  no: 1000010,
  slug: 'marmara-oto',
  tarih: '1 Aralık',
  neden: 'Kart reddedildi',
  conversationId: 'ornek',
  kod: 'ornek-kod',
  baslik: 'Hafta sonu: talebini öne çıkar',
  metin: 'Üst sıra 7 gün %20 indirimli.',
  url: '/haklarim',
  dugme: 'İncele',
  link: 'https://rengarenk.com.tr/taleplerim',
  karar: '24 saat askı: mesaj gönderemezsin',
  gerekce: 'Mesajında kapora istendi.',
  rapor: 'ornek',
  sonuc: 'İnceledik ve gerekli işlemi yaptık.',
  hak: '5 ek ilk mesaj',
};
const ornek = (t: NotifyTemplate) =>
  Object.fromEntries(templateVariables(t).map((v) => [v, ORNEK[v] ?? `örnek ${v}`]));

const turOf = (t: NotifyTemplate) => (t.konu === 'kampanya' ? 'Ticari' : 'İşlemsel');
const kanallarOf = (t: NotifyTemplate) =>
  [
    t.yalnizcaEposta ? null : 'uygulama içi',
    t.yalnizcaEposta ? null : 'push',
    t.eposta ? 'e-posta' : null,
    t.sms ? 'SMS' : null,
  ].filter(Boolean) as string[];

/**
 * Konsol › Büyüme: Şablonlar, Bildirim merkezi, Teslim raporu, Otomatik akışlar (YonetimKampanya.dc.html; Karar 48–51).
 * Şablonun yalnızca metinleri değişir ve yeni sürüm olarak eklenir; kullanılan değişkenler kodun tanıdıklarıyla
 * sınırlıdır. Açılma ve tıklama izlenmez (e-postada izleme pikseli ve bağlantı yönlendirmesi yok); uygulama içinde
 * okunma oranı gösterilir.
 */
@Injectable()
export class NotificationsStaffService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    private readonly templates: TemplatesService,
    private readonly switches: SwitchService,
    private readonly audit: AuditService,
    private readonly itibar: ReputationService,
  ) {}

  async templateList() {
    const surumler = await this.db.notificationTemplate.groupBy({ by: ['key'], _max: { version: true } });
    const surum = new Map(surumler.map((s) => [s.key, s._max.version ?? 0]));
    return Object.entries(NOTIFY_TEMPLATES as Record<string, NotifyTemplate>).map(([key, t]) => ({
      key,
      ad: t.ad,
      tur: turOf(t),
      kanallar: kanallarOf(t),
      surum: surum.get(key) ?? 0,
    }));
  }

  async template(key: string) {
    const kod = templateOf(key);
    if (!kod) throw new NotFoundException('Şablon bulunamadı');
    const { surum, sablon } = await this.templates.get(key);
    const gecmis = await this.db.notificationTemplate.findMany({
      where: { key },
      orderBy: { version: 'desc' },
      take: 10,
      select: { version: true, createdAt: true, createdBy: true },
    });
    const konu =
      sablon.konu in NOTIFY_TOPICS ? NOTIFY_TOPICS[sablon.konu as keyof typeof NOTIFY_TOPICS] : null;
    return {
      key,
      ad: sablon.ad,
      tur: turOf(sablon),
      surum,
      kanallar: kanallarOf(sablon),
      degiskenler: templateVariables(kod),
      icerik: { baslik: sablon.baslik, metin: sablon.metin, sms: sablon.sms, eposta: sablon.eposta },
      kural:
        sablon.konu === 'kampanya'
          ? 'Ticari ileti: yalnızca onay verenlere, kişi başına haftada 2, 21.00–09.00 arası sabaha ertelenir, tek tıkla ayrılma bağlantısı eklenir.'
          : sablon.konu === 'guvenlik'
            ? 'Güvenlik iletisi: kapatılamaz, sessiz saatte de gider.'
            : `İşlemsel ileti (${konu?.ad ?? 'genel'}): kişinin bildirim tercihine göre; sessiz saatte de gider.${sablon.epostaGecikmeDk ? ` E-posta, bildirim ${sablon.epostaGecikmeDk} dakika okunmazsa gider.` : ''}`,
      gecmis,
    };
  }

  private birlestir(key: string, icerik?: TemplateEdit): NotifyTemplate {
    const kod = templateOf(key);
    if (!kod) throw new NotFoundException('Şablon bulunamadı');
    if (!icerik) return kod;
    const t: NotifyTemplate = {
      ...kod,
      baslik: icerik.baslik,
      metin: icerik.metin,
      sms: icerik.sms || undefined,
      eposta: icerik.eposta ?? kod.eposta,
    };
    const bilinen = new Set(templateVariables(kod));
    const yabanci = templateVariables(t).filter((v) => !bilinen.has(v));
    if (yabanci.length) {
      throw new BadRequestException(
        `Bu şablonda kullanılamayan değişken: ${yabanci.map((v) => `{{${v}}}`).join(', ')}`,
      );
    }
    if (kod.sms === undefined && icerik.sms) throw new BadRequestException('Bu şablon SMS göndermez');
    return t;
  }

  async preview(key: string, icerik?: TemplateEdit) {
    const t = icerik ? this.birlestir(key, icerik) : (await this.templates.get(key)).sablon;
    const veri = ornek(t);
    const r = this.templates.render(t, veri);
    const e = await this.templates.email(t, veri, t.konu === 'kampanya' ? '#ayril' : undefined);
    const sms = this.templates.sms(t, { ...veri, link: 'https://rgnk.tr/a1' });
    return {
      uygulama: { baslik: r.baslik, metin: r.metin },
      eposta: e
        ? {
            kimden: t.konu === 'kampanya' ? this.env.EPOSTA_GONDEREN_TICARI : this.env.EPOSTA_GONDEREN,
            konu: e.konu,
            html: e.html,
          }
        : null,
      sms: sms ? { metin: sms, karakter: sms.length, adet: Math.ceil(sms.length / 160) } : null,
    };
  }

  async save(key: string, icerik: TemplateEdit, staffId: string, ip: string) {
    this.birlestir(key, icerik);
    const son = await this.db.notificationTemplate.findFirst({
      where: { key },
      orderBy: { version: 'desc' },
    });
    const version = (son?.version ?? 0) + 1;
    await this.db.$transaction(async (tx) => {
      await tx.notificationTemplate.create({
        data: { key, version, icerik: icerik as unknown as Prisma.InputJsonValue, createdBy: staffId },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'sablon_surum',
          entityType: 'notification_template',
          entityId: key,
          after: { surum: version },
          ip,
        },
        tx,
      );
    });
    this.templates.temizle();
    return this.template(key);
  }

  /** Kendime test: çalışanın e-postasına örnek değerlerle (yalnızca e-posta) */
  async test(key: string, staffId: string) {
    const { surum, sablon } = await this.templates.get(key);
    if (!sablon.eposta) throw new BadRequestException('Bu şablonun e-postası yok');
    await this.db.delivery.create({
      data: {
        id: uuidv7(),
        staffId,
        kanal: 'eposta',
        sablon: key,
        sablonSurum: surum,
        veri: ornek(sablon) as Prisma.InputJsonValue,
      },
    });
    return { ok: true };
  }

  async center() {
    const now = new Date();
    const gunBasi = new Date(new Date().setHours(0, 0, 0, 0));
    const hafta = new Date(now.getTime() - 7 * DAY);
    const sayi = (where: Prisma.DeliveryWhereInput) => this.db.delivery.count({ where });
    const kanal = async (k: string, ticari?: boolean, ek: Prisma.DeliveryWhereInput = {}) => {
      const w = { kanal: k, ...(ticari === undefined ? {} : { ticari }), ...ek };
      const [bugun, gonderildi, hata, kuyruk] = await Promise.all([
        sayi({ ...w, durum: 'gonderildi', sentAt: { gte: gunBasi } }),
        sayi({ ...w, durum: 'gonderildi', createdAt: { gte: hafta } }),
        sayi({ ...w, durum: 'hata', createdAt: { gte: hafta } }),
        sayi({ ...w, durum: 'bekliyor', dueAt: { lte: now } }),
      ]);
      const teslim = gonderildi + hata ? gonderildi / (gonderildi + hata) : null;
      // Son 7 günde teslim oranı %95'in altındaysa ya da süresi gelmiş 100'den çok ileti bekliyorsa uyarı
      const durum =
        teslim !== null && teslim < 0.95 ? 'Sorunlu' : kuyruk > 100 ? 'Kuyruk birikti' : 'Sağlıklı';
      return { bugun, teslim, kuyruk, durum };
    };
    const anaSms = this.env.SMS_PROVIDER;
    const [push, islemsel, ticariE, sms, smsYedek, uygBugun, ticariAcik, engel, oran] = await Promise.all([
      kanal('push'),
      kanal('eposta', false),
      kanal('eposta', true),
      kanal('sms', undefined, { OR: [{ saglayici: anaSms }, { saglayici: null }] }),
      kanal('sms', undefined, { saglayici: { not: anaSms } }),
      this.db.notification.count({ where: { createdAt: { gte: gunBasi } } }),
      this.switches.ticariAcik(),
      this.db.emailSuppression.groupBy({ by: ['reason'], _count: true }),
      this.itibar.oranlar(now),
    ]);
    const bas = this.env.EPOSTA_ISINMA_BASLANGIC ? new Date(this.env.EPOSTA_ISINMA_BASLANGIC) : null;
    const hafta_ = bas ? Math.floor((now.getTime() - bas.getTime()) / (7 * DAY)) : null;
    const limit = isinmaLimiti(bas, now);
    return {
      ticariAcik,
      saglik: [
        {
          ad: 'Mobil ve web push',
          saglayici: `Firebase Cloud Messaging (${this.env.PUSH_PROVIDER})`,
          ...push,
        },
        {
          ad: 'E-posta · işlemsel',
          saglayici: `Kendi sunucumuz · ${this.env.EPOSTA_GONDEREN.replace(/.*@|>.*/g, '')} (${this.env.EMAIL_PROVIDER})`,
          ...islemsel,
        },
        {
          ad: 'E-posta · ticari',
          saglayici: `Kendi sunucumuz · ${this.env.EPOSTA_GONDEREN_TICARI.replace(/.*@|>.*/g, '')}`,
          ...ticariE,
          durum: !ticariAcik
            ? 'Durduruldu'
            : hafta_ === null
              ? 'Isınma başlamadı'
              : hafta_ < 6
                ? `Isınıyor · ${hafta_}/6`
                : 'Sağlıklı',
        },
        { ad: 'SMS · ana', saglayici: `${anaSms} · doğrulama ve kritik`, ...sms },
        {
          ad: 'SMS · yedek',
          saglayici: this.env.SMS_FALLBACK_PROVIDER ?? 'Tanımlı değil',
          ...smsYedek,
          durum: this.env.SMS_FALLBACK_PROVIDER ? (smsYedek.bugun ? 'Kullanıldı' : 'Beklemede') : 'Yok',
        },
        {
          ad: 'Uygulama içi',
          saglayici: 'Kendi altyapımız',
          bugun: uygBugun,
          teslim: null,
          kuyruk: 0,
          durum: 'Sağlıklı',
        },
      ],
      isinma: {
        baslangic: this.env.EPOSTA_ISINMA_BASLANGIC ?? null,
        hafta: hafta_,
        bugunLimit: Number.isFinite(limit) ? limit : null,
        bugunGonderilen: ticariE.bugun,
      },
      engelListesi: Object.fromEntries(engel.map((e) => [e.reason, e._count])),
      kimlikler: [
        { ad: 'İşlemsel', adres: this.env.EPOSTA_GONDEREN, not: 'Doğrulama, mesaj, ödeme ve süre iletileri' },
        { ad: 'Ticari', adres: this.env.EPOSTA_GONDEREN_TICARI, not: 'Kampanya ve akış iletileri' },
      ],
      itibar: { ...oran, sinir: ITIBAR_SINIR },
      kurallar: [
        { ad: 'Ticari ileti sıklığı', not: 'Kişi başına (Karar 49)', deger: 'Haftada 2' },
        { ad: 'Sessiz saat', not: 'Ticari ileti sabaha ertelenir; işlemsel gider', deger: '21.00–09.00' },
        { ad: 'Kanal sırası', not: 'Maliyete göre (Karar 48)', deger: 'Uygulama → push → e-posta → SMS' },
        {
          ad: 'Okunmayan mesajda e-posta',
          not: 'Uygulama içi bildirim okunmadıysa',
          deger: '15–30 dakika sonra',
        },
        {
          ad: 'SMS',
          not: 'Doğrulama kodu ve kritik durumlar (son gün hatırlatması, ödeme sorunu)',
          deger: 'Yalnızca kritik',
        },
        {
          ad: 'Toplu gönderim onayı',
          not: '1.000 kişiyi aşan gönderim (Karar 40)',
          deger: 'Sahip veya yönetici',
        },
      ],
    };
  }

  async setCommercial(acik: boolean, staffId: string, ip: string) {
    await this.switches.ayarla('ticari', acik, staffId);
    await this.audit.record({
      actorType: 'STAFF',
      actorId: staffId,
      action: acik ? 'ticari_gonderim_basladi' : 'ticari_gonderim_durdu',
      entityType: 'notification_switch',
      entityId: 'ticari',
      ip,
    });
    return this.center();
  }

  async report() {
    const once = new Date(Date.now() - 30 * DAY);
    const grup = await this.db.delivery.groupBy({
      by: ['kanal', 'ticari', 'durum'],
      where: { createdAt: { gte: once } },
      _count: true,
    });
    const say = (k: string, t: boolean | null, d: string) =>
      grup
        .filter((g) => g.kanal === k && (t === null || g.ticari === t) && g.durum === d)
        .reduce((s, g) => s + g._count, 0);
    const [uyg, okunan, ayrilan, sikayet, sablonlar] = await Promise.all([
      this.db.notification.count({ where: { createdAt: { gte: once } } }),
      this.db.notification.count({ where: { createdAt: { gte: once }, readAt: { not: null } } }),
      this.db.emailSuppression.count({ where: { reason: 'ayrildi', createdAt: { gte: once } } }),
      this.db.emailSuppression.count({ where: { reason: 'sikayet', createdAt: { gte: once } } }),
      this.db.notification.groupBy({ by: ['sablon'], where: { createdAt: { gte: once } }, _count: true }),
    ]);
    const okunanSablon = await this.db.notification.groupBy({
      by: ['sablon'],
      where: { createdAt: { gte: once }, readAt: { not: null } },
      _count: true,
    });
    const satir = (
      ad: string,
      not: string,
      k: string,
      t: boolean | null,
      ek: Record<string, unknown> = {},
    ) => {
      const g = say(k, t, 'gonderildi');
      const h = say(k, t, 'hata');
      return { ad, not, gonderilen: g, teslim: g + h ? g / (g + h) : null, ...ek };
    };
    const sms = say('sms', null, 'gonderildi');
    return {
      kanallar: [
        satir('Mobil ve web push', 'Firebase Cloud Messaging', 'push', null, { maliyetKurus: 0 }),
        satir('E-posta · işlemsel', 'bildirim.rengarenk.com.tr', 'eposta', false, { maliyetKurus: 0 }),
        satir('E-posta · ticari', 'bulten.rengarenk.com.tr', 'eposta', true, {
          ayrilma: ayrilan,
          sikayet,
          maliyetKurus: 0,
        }),
        satir('SMS · doğrulama ve kritik', 'Ana sağlayıcı + yedek (doğrulama kodları hariç)', 'sms', null, {
          maliyetKurus: sms * SMS_KURUS,
          maliyet: tlYaz(sms * SMS_KURUS),
        }),
        {
          ad: 'Uygulama içi',
          not: 'Kendi altyapımız',
          gonderilen: uyg,
          teslim: null,
          okunma: uyg ? okunan / uyg : null,
          maliyetKurus: 0,
        },
      ],
      sablonlar: sablonlar
        .map((s) => {
          const ok = okunanSablon.find((o) => o.sablon === s.sablon)?._count ?? 0;
          const t = templateOf(s.sablon);
          return {
            key: s.sablon,
            ad: t?.ad ?? s.sablon,
            tur: t ? turOf(t) : '',
            adet: s._count,
            okunma: s._count ? ok / s._count : 0,
          };
        })
        .sort((a, b) => b.adet - a.adet),
    };
  }

  async automations() {
    const once = new Date(Date.now() - 30 * DAY);
    return Promise.all(
      AUTOMATION_KEYS.map(async (key) => {
        const a = AUTOMATIONS[key];
        const [acik, kisi, okunan] = await Promise.all([
          this.switches.akisAcik(key),
          this.db.notification.count({
            where: { sablon: { in: [...a.sablonlar] }, createdAt: { gte: once } },
          }),
          this.db.notification.count({
            where: { sablon: { in: [...a.sablonlar] }, createdAt: { gte: once }, readAt: { not: null } },
          }),
        ]);
        return {
          key,
          ad: a.ad,
          tur: a.tur,
          acik,
          adimlar: a.adimlar,
          kisi,
          okunma: kisi ? okunan / kisi : null,
        };
      }),
    );
  }

  async setAutomation(key: AutomationKey, acik: boolean, staffId: string, ip: string) {
    await this.switches.ayarla(`akis.${key}`, acik, staffId);
    await this.audit.record({
      actorType: 'STAFF',
      actorId: staffId,
      action: acik ? 'akis_acildi' : 'akis_kapandi',
      entityType: 'automation',
      entityId: key,
      ip,
    });
    return this.automations();
  }
}

const acikSchema = z.object({ acik: z.boolean() }).strict();
const onizlemeSchema = z.object({ icerik: templateEditSchema.optional() }).strict();

@Controller('staff/notifications')
@UseGuards(StaffGuard)
export class NotificationsStaffController {
  constructor(private readonly s: NotificationsStaffService) {}

  @Get('templates')
  @RequirePermission('rapor.gor', 'maskeli')
  templates() {
    return this.s.templateList();
  }

  @Get('templates/:key')
  @RequirePermission('rapor.gor', 'maskeli')
  template(@Param('key') key: string) {
    return this.s.template(key);
  }

  @Post('templates/:key/preview')
  @HttpCode(200)
  @RequirePermission('rapor.gor', 'maskeli')
  preview(@Param('key') key: string, @Body(new ZodPipe(onizlemeSchema)) b: z.output<typeof onizlemeSchema>) {
    return this.s.preview(key, b.icerik);
  }

  @Post('templates/:key')
  @HttpCode(200)
  @RequirePermission('kampanya.hazirla')
  save(
    @Req() req: StaffRequest,
    @Param('key') key: string,
    @Body(new ZodPipe(templateEditSchema)) b: z.output<typeof templateEditSchema>,
  ) {
    return this.s.save(key, b, req.staff.staff.id, req.ip);
  }

  @Post('templates/:key/test')
  @HttpCode(200)
  @RequirePermission('kampanya.hazirla', 'oneri')
  test(@Req() req: StaffRequest, @Param('key') key: string) {
    return this.s.test(key, req.staff.staff.id);
  }

  @Get('center')
  @RequirePermission('rapor.gor', 'maskeli')
  center() {
    return this.s.center();
  }

  /** Ticari gönderimi durdur / yeniden başlat (işlemsel iletiler etkilenmez) */
  @Post('commercial')
  @HttpCode(200)
  @RequirePermission('sistem.ayarla')
  commercial(@Req() req: StaffRequest, @Body(new ZodPipe(acikSchema)) b: z.output<typeof acikSchema>) {
    return this.s.setCommercial(b.acik, req.staff.staff.id, req.ip);
  }

  @Get('report')
  @RequirePermission('rapor.gor', 'maskeli')
  report() {
    return this.s.report();
  }

  @Get('automations')
  @RequirePermission('rapor.gor', 'maskeli')
  automations() {
    return this.s.automations();
  }

  @Post('automations/:key')
  @HttpCode(200)
  @RequirePermission('kampanya.hazirla')
  setAutomation(
    @Req() req: StaffRequest,
    @Param('key') key: string,
    @Body(new ZodPipe(acikSchema)) b: z.output<typeof acikSchema>,
  ) {
    if (!(AUTOMATION_KEYS as string[]).includes(key)) throw new NotFoundException('Akış bulunamadı');
    return this.s.setAutomation(key as AutomationKey, b.acik, req.staff.staff.id, req.ip);
  }
}
