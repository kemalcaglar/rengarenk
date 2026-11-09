import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Delivery, Prisma } from '@rengarenk/db';
import { ENV, type Env } from '../config/env.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { SMS_SENDER, type SmsSender } from '../sms/sms.js';
import { SecretBox } from '../staff/secret-box.js';
import { EMAIL_SENDER, type EmailSender, PUSH_SENDER, type PushSender } from './channels.js';
import { ayrilmaKodu, isinmaLimiti } from './commercial.js';
import { sessizSaatSonu } from './notification.service.js';
import { SwitchService } from './switches.js';
import { TemplatesService } from './templates.service.js';

const DENEME = 3;

/**
 * Teslim (Karar 48, 50; Teknik tasarım §9): zamanı gelen teslim kayıtlarını kanal bağdaştırıcısıyla gönderir. Koşullu
 * e-posta (bildirim okunmadıysa) okunduysa atlanır. Geçici hata 3 kez yeniden denenir; kalıcı hata veren e-posta adresi
 * hemen, 3 geçici hata verense listeye alınır. Geçersiz push anahtarı kapatılır. Günlüğe adres ve numara yazılmaz.
 */
@Injectable()
export class DeliveryService {
  private readonly log = new Logger(DeliveryService.name);

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
    @Inject(PUSH_SENDER) private readonly push: PushSender,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
    private readonly templates: TemplatesService,
    private readonly switches: SwitchService,
  ) {}

  /**
   * Kullanıcı hesabı olmayan adrese işlemsel e-posta (ör. e-postayla gelen destek talebinin yanıtı). Gönderim dışı
   * listedeki adrese gitmez; teslim kaydı kişiye bağlı olmadığı için tutulmaz, sonuç döner.
   */
  async dogrudanEposta(adres: string, sablon: string, veri: Record<string, unknown>) {
    const a = adres.toLowerCase();
    const engel = await this.db.emailSuppression.findUnique({ where: { email: a } });
    if (engel && !engel.onlyCommercial && (engel.reason !== 'gecici_hata' || engel.count >= DENEME))
      return false;
    const { sablon: t } = await this.templates.get(sablon);
    const e = await this.templates.email(t, veri);
    if (!e) return false;
    const r = await this.email.send({
      to: a,
      from: this.env.EPOSTA_GONDEREN,
      subject: e.konu,
      html: e.html,
      text: e.text,
    });
    if (r.status !== 'sent') this.log.warn(`doğrudan e-posta gönderilemedi: ${r.message ?? r.status}`);
    return r.status === 'sent';
  }

  async dispatchDue(now = new Date(), limit = 200) {
    const due = await this.db.delivery.findMany({
      where: { durum: 'bekliyor', dueAt: { lte: now } },
      orderBy: { dueAt: 'asc' },
      take: limit,
      include: { notification: { select: { readAt: true } } },
    });
    let n = 0;
    if (due.length) this.log.debug(`${due.length} teslim gönderiliyor`);
    for (const d of due) {
      // Sahiplenme: zamanı 10 dakika ileri atılır; gönderim sürerken başka işçi aynı teslimi göremez ve alamaz
      const r = await this.db.delivery.updateMany({
        where: { id: d.id, durum: 'bekliyor', attempts: d.attempts, dueAt: { lte: now } },
        data: { attempts: { increment: 1 }, dueAt: new Date(Date.now() + 10 * 60_000) },
      });
      if (r.count !== 1) continue;
      try {
        await this.one(d);
        n++;
      } catch (e) {
        await this.sonuc(d, { durum: 'hata', neden: (e as Error).message.slice(0, 300) });
      }
    }
    return n;
  }

  private sonuc(
    d: Delivery,
    s: {
      durum: 'gonderildi' | 'atlandi' | 'hata' | 'tekrar';
      neden?: string | null;
      saglayici?: string;
      no?: string | null;
    },
  ) {
    const deneme = d.attempts + 1;
    // Şifreli tek kullanımlık kod (giriş bağlantısı) teslim sonuçlanınca kayıttan silinir
    const v = d.veri as Record<string, unknown>;
    const temizle =
      typeof v?.kodKutu === 'string' && !(s.durum === 'tekrar' && deneme < DENEME)
        ? {
            veri: Object.fromEntries(
              Object.entries(v).filter(([k]) => k !== 'kodKutu'),
            ) as Prisma.InputJsonValue,
          }
        : {};
    if (s.durum === 'tekrar' && deneme < DENEME) {
      return this.db.delivery.update({
        where: { id: d.id },
        data: { neden: s.neden ?? null, dueAt: new Date(Date.now() + deneme * 5 * 60_000) },
      });
    }
    return this.db.delivery.update({
      where: { id: d.id },
      data: {
        durum: s.durum === 'tekrar' ? 'hata' : s.durum,
        neden: s.neden ?? null,
        saglayici: s.saglayici ?? null,
        saglayiciNo: s.no ?? null,
        sentAt: s.durum === 'gonderildi' ? new Date() : null,
        ...temizle,
      },
    });
  }

  private async one(d: Delivery & { notification: { readAt: Date | null } | null }) {
    if (d.kosul === 'okunmadiysa' && d.notification?.readAt) {
      return this.sonuc(d, { durum: 'atlandi', neden: 'Bildirim uygulamada okundu' });
    }
    // Ticari gönderim konsoldan durdurulduysa ticari iletiler bekletilir (Bildirim merkezi; işlemsel sürer)
    if (d.ticari && !(await this.switches.ticariAcik())) {
      return this.db.delivery.update({
        where: { id: d.id },
        data: { neden: 'Ticari gönderim durduruldu; bekletiliyor', dueAt: new Date(Date.now() + 3600_000) },
      });
    }
    const { sablon } = await this.templates.get(d.sablon);
    const veri = d.veri as Record<string, unknown>;
    // Çalışana giden e-posta (konsolda "Kendime test gönder")
    if (d.staffId) {
      const st = await this.db.staffMember.findUnique({ where: { id: d.staffId }, select: { email: true } });
      const e = st ? await this.templates.email(sablon, veri) : null;
      if (!st || !e) return this.sonuc(d, { durum: 'atlandi', neden: 'Çalışan ya da e-posta şablonu yok' });
      const r = await this.email.send({
        to: st.email,
        from: this.env.EPOSTA_GONDEREN,
        subject: `[Test] ${e.konu}`,
        html: e.html,
        text: e.text,
      });
      return this.sonuc(d, {
        durum: r.status === 'sent' ? 'gonderildi' : 'hata',
        neden: r.message,
        saglayici: this.email.ad,
        no: r.id,
      });
    }
    const user = d.userId
      ? await this.db.user.findUnique({
          where: { id: d.userId },
          select: { email: true, emailVerifiedAt: true, phone: true, status: true },
        })
      : null;
    if (user?.status !== 'ACTIVE') return this.sonuc(d, { durum: 'atlandi', neden: 'Hesap etkin değil' });

    if (d.kanal === 'eposta') {
      const dogrulama = d.sablon === 'eposta.dogrulama';
      if (!user.email || (!user.emailVerifiedAt && !dogrulama)) {
        return this.sonuc(d, { durum: 'atlandi', neden: 'Doğrulanmış e-posta yok' });
      }
      const adres = user.email.toLowerCase();
      const engel = await this.db.emailSuppression.findUnique({ where: { email: adres } });
      if (
        engel &&
        (!engel.onlyCommercial || d.ticari) &&
        (engel.reason !== 'gecici_hata' || engel.count >= DENEME)
      ) {
        return this.sonuc(d, { durum: 'atlandi', neden: `Adres gönderim dışı (${engel.reason})` });
      }
      // Isınma (Karar 50): ticari e-postanın günlük sınırı dolduysa ertesi sabaha kalır
      if (d.ticari) {
        const gunBasi = new Date(new Date().setHours(0, 0, 0, 0));
        const bugun = await this.db.delivery.count({
          where: { kanal: 'eposta', ticari: true, durum: 'gonderildi', sentAt: { gte: gunBasi } },
        });
        const bas = this.env.EPOSTA_ISINMA_BASLANGIC ? new Date(this.env.EPOSTA_ISINMA_BASLANGIC) : null;
        if (bugun >= isinmaLimiti(bas, new Date())) {
          return this.db.delivery.update({
            where: { id: d.id },
            data: {
              neden: 'Isınma sınırı: yarına ertelendi',
              dueAt: sessizSaatSonu(new Date(gunBasi.getTime() + 86_400_000)),
            },
          });
        }
      }
      const kod = ayrilmaKodu(this.env.JWT_SECRET, d.id);
      const ayrilma = d.ticari ? this.templates.link(`/iletisim/ayril?k=${kod}`) : undefined;
      // Giriş bağlantısının kodu teslim kaydında şifreli durur; yalnızca gönderimde açılır
      let acik = veri;
      if (typeof veri.kodKutu === 'string') {
        try {
          acik = { ...veri, kod: SecretBox.forDeliveries(this.env).open(veri.kodKutu) };
        } catch {
          return this.sonuc(d, { durum: 'hata', neden: 'Kod açılamadı' });
        }
      }
      const e = await this.templates.email(sablon, acik, ayrilma);
      if (!e) return this.sonuc(d, { durum: 'atlandi', neden: 'Şablonda e-posta yok' });
      const r = await this.email.send({
        to: adres,
        from: d.ticari ? this.env.EPOSTA_GONDEREN_TICARI : this.env.EPOSTA_GONDEREN,
        subject: e.konu,
        html: e.html,
        text: e.text,
        headers: ayrilma
          ? {
              'List-Unsubscribe': `<${this.env.API_PUBLIC_URL}/iletisim/ayril?k=${kod}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            }
          : undefined,
      });
      if (r.status === 'permanent') {
        await this.db.emailSuppression.upsert({
          where: { email: adres },
          create: { email: adres, reason: 'kalici_hata' },
          update: { reason: 'kalici_hata', onlyCommercial: false },
        });
        return this.sonuc(d, { durum: 'hata', neden: r.message, saglayici: this.email.ad });
      }
      if (r.status === 'temporary') {
        if (d.attempts + 1 >= DENEME) {
          await this.db.emailSuppression.upsert({
            where: { email: adres },
            create: { email: adres, reason: 'gecici_hata', count: 1 },
            update: { count: { increment: 1 } },
          });
        }
        return this.sonuc(d, { durum: 'tekrar', neden: r.message, saglayici: this.email.ad });
      }
      return this.sonuc(d, { durum: 'gonderildi', saglayici: this.email.ad, no: r.id });
    }

    if (d.kanal === 'sms') {
      const metin = this.templates.sms(sablon, veri);
      if (!metin) return this.sonuc(d, { durum: 'atlandi', neden: 'Şablonda SMS yok' });
      try {
        const r = await this.sms.send(user.phone, metin);
        return this.sonuc(d, { durum: 'gonderildi', saglayici: r.provider, no: r.messageId ?? null });
      } catch (e) {
        return this.sonuc(d, {
          durum: 'tekrar',
          neden: (e as Error).message.slice(0, 300),
          saglayici: this.sms.name,
        });
      }
    }

    // push
    const cihaz = await this.db.pushToken.findUnique({ where: { id: String(veri.tokenId ?? '') } });
    if (!cihaz || cihaz.disabledAt) return this.sonuc(d, { durum: 'atlandi', neden: 'Cihaz kapalı' });
    if (d.notification?.readAt)
      return this.sonuc(d, { durum: 'atlandi', neden: 'Bildirim uygulamada okundu' });
    const r = this.templates.render(sablon, veri);
    const p = await this.push.send({ token: cihaz.token, baslik: r.baslik, metin: r.metin, url: r.url });
    if (p.status === 'invalid') {
      await this.db.pushToken.update({ where: { id: cihaz.id }, data: { disabledAt: new Date() } });
      return this.sonuc(d, {
        durum: 'hata',
        neden: 'Cihaz anahtarı geçersiz; kapatıldı',
        saglayici: this.push.ad,
      });
    }
    if (p.status === 'temporary')
      return this.sonuc(d, { durum: 'tekrar', neden: p.message, saglayici: this.push.ad });
    return this.sonuc(d, { durum: 'gonderildi', saglayici: this.push.ad, no: p.id });
  }
}
