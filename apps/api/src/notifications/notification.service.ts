import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
} from '@nestjs/common';
import { type Prisma, uuidv7 } from '@rengarenk/db';
import {
  maskEposta,
  maskTrMobile,
  NOTIFY_GROUP_STYLE,
  NOTIFY_TOPICS,
  type NotifyGroup,
  type NotifyTemplate,
  PREF_CHANNELS,
  type PrefChannel,
  TOPIC_KEYS,
  type TopicKey,
} from '@rengarenk/shared';
import { Redis } from 'ioredis';
import { ENV, type Env } from '../config/env.js';
import { ConsentService } from '../consents/consent.service.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { TemplatesService } from './templates.service.js';

const DAY = 86_400_000;
/** Ticari ileti sıklık sınırı: kişi başına haftada 2 (Karar 49) */
const TICARI_HAFTALIK = 2;

export interface NotifyInput {
  userIds: string[];
  sablon: string;
  veri: Record<string, unknown>;
}

/** Sessiz saat (ticari ileti): İstanbul saatiyle 21.00–09.00 arası sabah 09.00'a ertelenir (Karar 49) */
export function sessizSaatSonu(t: Date): Date {
  const tr = new Date(t.getTime() + 3 * 3600_000);
  const saat = tr.getUTCHours();
  if (saat >= 9 && saat < 21) return t;
  const gun = saat >= 21 ? tr.getUTCDate() + 1 : tr.getUTCDate();
  return new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), gun, 9) - 3 * 3600_000);
}

/**
 * Bildirim katmanı (Karar 30, 48, 49; Teknik tasarım §9). "Bu kişiye bu olayı bildir": tercih ve rıza kontrolü,
 * ticari iletide sıklık sınırı ve sessiz saat, kanal sırası (uygulama içi ve push hemen; e-posta bildirim okunmadıysa
 * gecikmeyle; SMS yalnızca şablon izin verirse) ve teslim kaydı. Gönderimi işçideki DeliveryService yapar.
 */
@Injectable()
export class NotificationService implements OnModuleDestroy {
  private readonly log = new Logger(NotificationService.name);
  private pub: Redis | null = null;

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    private readonly templates: TemplatesService,
    private readonly consents: ConsentService,
  ) {}

  onModuleDestroy() {
    this.pub?.disconnect();
  }

  /** Uygulama içi bildirimi açık bağlantılara iletir (API süreçleri Redis yayınını dinler; bkz. RealtimeService) */
  private async yayinla(userId: string, data: unknown) {
    try {
      this.pub ??= new Redis(this.env.REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: 1 });
      await this.pub.publish('rr:canli', JSON.stringify({ u: [userId], d: data }));
    } catch (e) {
      this.log.warn(`anlık bildirim iletilemedi: ${(e as Error).message}`);
    }
  }

  // ── Tercihler ─────────────────────────────────────────────────

  private async ticariOnay(userId: string) {
    const son = await this.db.consent.findFirst({
      where: { userId, kind: 'ticari_ileti' },
      orderBy: { createdAt: 'desc' },
      select: { granted: true },
    });
    return son?.granted === true;
  }

  /** Şablonun bu kişi için açık kanalları */
  async kanallar(userId: string, sablon: NotifyTemplate): Promise<Record<PrefChannel, boolean>> {
    if (sablon.konu === 'genel') return { uygulama: true, eposta: false, sms: false };
    if (sablon.konu === 'guvenlik') return { uygulama: true, eposta: true, sms: !!sablon.sms };
    const konu = sablon.konu as TopicKey;
    const t = NOTIFY_TOPICS[konu];
    const satir = await this.db.notificationPref.findMany({ where: { userId, konu } });
    const sonuc = { ...t.varsayilan } as Record<PrefChannel, boolean>;
    for (const s of satir) sonuc[s.kanal as PrefChannel] = s.acik;
    for (const k of t.kilitli as readonly PrefChannel[]) sonuc[k] = true;
    if (t.tur === 'ticari' && !(await this.ticariOnay(userId)))
      return { uygulama: false, eposta: false, sms: false };
    return sonuc;
  }

  async prefs(userId: string) {
    const [satir, uye, user, ticari] = await Promise.all([
      this.db.notificationPref.findMany({ where: { userId } }),
      this.db.accountMember.count({
        where: { userId, account: { kind: 'BUSINESS', gallery: { isNot: null } } },
      }),
      this.db.user.findUniqueOrThrow({
        where: { id: userId },
        select: { email: true, emailVerifiedAt: true },
      }),
      this.ticariOnay(userId),
    ]);
    return {
      konular: TOPIC_KEYS.filter((k) => !('galeri' in NOTIFY_TOPICS[k]) || uye > 0).map((k) => {
        const t = NOTIFY_TOPICS[k];
        return {
          konu: k,
          ad: t.ad,
          not: t.not,
          kanallar: PREF_CHANNELS.map((kanal) => {
            const kilitli = (t.kilitli as readonly string[]).includes(kanal);
            const s = satir.find((x) => x.konu === k && x.kanal === kanal);
            const acik =
              kilitli || (t.tur === 'ticari' && !ticari ? false : (s?.acik ?? t.varsayilan[kanal]));
            return { kanal, acik, kilitli };
          }),
        };
      }),
      ticariOnay: ticari,
      eposta: user.email ? { adres: maskEposta(user.email), dogrulandi: !!user.emailVerifiedAt } : null,
    };
  }

  /**
   * Tercih kaydı. Kilitli kanal kapatılamaz. Kampanya satırında bir kanal açılınca ticari ileti onayı, hepsi kapanınca
   * onayın geri alınması rıza kaydına yazılır (İYS ile eşitleme bu kayıttan; Karar 49).
   */
  async setPrefs(
    userId: string,
    tercihler: { konu: TopicKey; kanal: PrefChannel; acik: boolean }[],
    meta: { ip?: string; kanal?: 'web' | 'ios' | 'android' },
  ) {
    for (const t of tercihler) {
      if ((NOTIFY_TOPICS[t.konu].kilitli as readonly string[]).includes(t.kanal) && !t.acik) {
        throw new BadRequestException(`${NOTIFY_TOPICS[t.konu].ad} bildirimleri kapatılamaz`);
      }
    }
    await this.db.$transaction(async (tx) => {
      for (const t of tercihler) {
        await tx.notificationPref.upsert({
          where: { userId_konu_kanal: { userId, konu: t.konu, kanal: t.kanal } },
          create: { userId, konu: t.konu, kanal: t.kanal, acik: t.acik },
          update: { acik: t.acik },
        });
      }
      if (tercihler.some((t) => t.konu === 'kampanya')) {
        const kampanya = await tx.notificationPref.findMany({
          where: { userId, konu: 'kampanya', acik: true },
        });
        const simdi = await this.ticariOnay(userId);
        const istenen = kampanya.length > 0;
        if (simdi !== istenen)
          await this.consents.recordCommercial(tx, userId, istenen, meta.kanal ?? 'web', meta.ip);
      }
    });
    return this.prefs(userId);
  }

  // ── Bildirim ──────────────────────────────────────────────────

  /** Olayı alıcılara bildirir; her alıcı ayrı ele alınır, biri hata verse diğerleri sürer */
  async notify(input: NotifyInput) {
    let n = 0;
    for (const userId of [...new Set(input.userIds)]) {
      try {
        if (await this.one(userId, input.sablon, input.veri)) n++;
      } catch (e) {
        this.log.error(`bildirim ${input.sablon} → ${userId}: ${(e as Error).message}`);
      }
    }
    return n;
  }

  private async one(userId: string, key: string, veriTaban: Record<string, unknown>) {
    const { surum, sablon } = await this.templates.get(key);
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { firstName: true, email: true, emailVerifiedAt: true, phone: true, status: true },
    });
    if (user?.status !== 'ACTIVE') return false;
    const veri: Record<string, unknown> = { ad: user.firstName || 'değerli üyemiz', ...veriTaban };
    const ticari = sablon.konu === 'kampanya';
    const kanal = await this.kanallar(userId, sablon);
    const now = new Date();
    let due = now;
    if (ticari) {
      const hafta = await this.db.notification.count({
        where: { userId, ticari: true, createdAt: { gte: new Date(now.getTime() - 7 * DAY) } },
      });
      if (hafta >= TICARI_HAFTALIK) return false;
      due = sessizSaatSonu(now);
    }
    const r = this.templates.render(sablon, veri);
    if (r.url) veri.link = this.templates.link(r.url);

    let bildirimId: string | null = null;
    if (kanal.uygulama && !sablon.yalnizcaEposta) {
      const veriler = {
        baslik: r.baslik,
        metin: r.metin,
        url: r.url,
        sablon: key,
        grup: sablon.grup,
        ticari,
      };
      const var_ = r.tekil
        ? await this.db.notification.findFirst({ where: { userId, tekil: r.tekil, readAt: null } })
        : null;
      const b = var_
        ? await this.db.notification.update({ where: { id: var_.id }, data: { ...veriler, createdAt: now } })
        : await this.db.notification.create({ data: { id: uuidv7(), userId, tekil: r.tekil, ...veriler } });
      bildirimId = b.id;
      const okunmamis = await this.db.notification.count({ where: { userId, readAt: null } });
      await this.yayinla(userId, { tip: 'bildirim', bildirim: this.view(b), okunmamis });
      // Push: kullanıcının etkin cihazları (Uygulama kanalı push'u da kapsar)
      const cihazlar = await this.db.pushToken.findMany({
        where: { userId, disabledAt: null },
        select: { id: true },
      });
      for (const c of cihazlar) {
        await this.teslim({
          userId,
          bildirimId,
          kanal: 'push',
          key,
          surum,
          ticari,
          veri: { ...veri, tokenId: c.id },
          due,
        });
      }
    }
    if (kanal.eposta && sablon.eposta && user.email && user.emailVerifiedAt) {
      const gecikme = sablon.epostaGecikmeDk ?? 0;
      await this.teslim({
        userId,
        bildirimId,
        kanal: 'eposta',
        key,
        surum,
        ticari,
        veri,
        due: new Date(due.getTime() + gecikme * 60_000),
        kosul: gecikme && bildirimId ? 'okunmadiysa' : null,
        hedef: maskEposta(user.email),
      });
    }
    const smsUygun = sablon.smsKosul !== 'son_gun' || Number(veri.gun) <= 1;
    if (kanal.sms && sablon.sms && smsUygun) {
      await this.teslim({
        userId,
        bildirimId,
        kanal: 'sms',
        key,
        surum,
        ticari,
        veri,
        due,
        hedef: maskTrMobile(user.phone),
      });
    }
    return true;
  }

  private teslim(d: {
    userId: string;
    bildirimId: string | null;
    kanal: 'push' | 'eposta' | 'sms';
    key: string;
    surum: number;
    ticari: boolean;
    veri: Record<string, unknown>;
    due: Date;
    kosul?: string | null;
    hedef?: string;
  }) {
    return this.db.delivery.create({
      data: {
        id: uuidv7(),
        notificationId: d.bildirimId,
        userId: d.userId,
        kanal: d.kanal,
        sablon: d.key,
        sablonSurum: d.surum,
        ticari: d.ticari,
        veri: d.veri as Prisma.InputJsonValue,
        dueAt: d.due,
        kosul: d.kosul ?? null,
        hedef: d.hedef ?? null,
      },
    });
  }

  // ── Uygulama içi liste ────────────────────────────────────────

  private view(b: {
    id: string;
    sablon: string;
    grup: string;
    baslik: string;
    metin: string;
    url: string | null;
    ticari: boolean;
    readAt: Date | null;
    createdAt: Date;
  }) {
    const s = NOTIFY_GROUP_STYLE[b.grup as NotifyGroup] ?? NOTIFY_GROUP_STYLE.talep;
    return {
      id: b.id,
      sablon: b.sablon,
      grup: b.grup,
      ikon: s.ikon,
      tint: s.tint,
      baslik: b.baslik,
      metin: b.metin,
      url: b.url,
      ticari: b.ticari,
      okundu: !!b.readAt,
      zaman: b.createdAt,
    };
  }

  async list(userId: string, grup?: string) {
    const where: Prisma.NotificationWhereInput = {
      userId,
      createdAt: { gte: new Date(Date.now() - 60 * DAY) },
      ...(grup === 'mesaj' ? { grup: 'mesaj' } : grup === 'talep' ? { grup: 'talep' } : {}),
    };
    const [rows, okunmamis] = await Promise.all([
      this.db.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 }),
      this.db.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { okunmamis, bildirimler: rows.map((b) => this.view(b)) };
  }

  async unread(userId: string) {
    return { okunmamis: await this.db.notification.count({ where: { userId, readAt: null } }) };
  }

  async read(userId: string, ids: string[] | 'hepsi') {
    await this.db.notification.updateMany({
      where: { userId, readAt: null, ...(ids === 'hepsi' ? {} : { id: { in: ids } }) },
      data: { readAt: new Date() },
    });
    return this.unread(userId);
  }

  // ── Push cihazları ────────────────────────────────────────────

  async registerPush(userId: string, token: string, platform: 'ios' | 'android' | 'web') {
    await this.db.pushToken.upsert({
      where: { token },
      create: { id: uuidv7(), userId, token, platform },
      update: { userId, platform, lastSeenAt: new Date(), disabledAt: null },
    });
    return { ok: true };
  }

  async unregisterPush(userId: string, token: string) {
    await this.db.pushToken.updateMany({ where: { userId, token }, data: { disabledAt: new Date() } });
    return { ok: true };
  }

  // ── E-posta adresi ────────────────────────────────────────────

  /** Adres kaydedilir, doğrulanana kadar bildirim gitmez; doğrulama bağlantısı hemen gönderilir */
  async setEmail(userId: string, eposta: string) {
    const adres = eposta.trim().toLowerCase();
    const kod = randomBytes(32).toString('base64url');
    await this.db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { email: adres, emailVerifiedAt: null } });
      await tx.emailChallenge.create({
        data: {
          id: uuidv7(),
          userId,
          email: adres,
          tokenHash: createHash('sha256').update(kod).digest('hex'),
          expiresAt: new Date(Date.now() + DAY),
        },
      });
    });
    const { surum } = await this.templates.get('eposta.dogrulama');
    const u = await this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { firstName: true } });
    await this.teslim({
      userId,
      bildirimId: null,
      kanal: 'eposta',
      key: 'eposta.dogrulama',
      surum,
      ticari: false,
      veri: { ad: u.firstName || 'değerli üyemiz', kod },
      due: new Date(),
      hedef: maskEposta(adres),
    });
    return { adres: maskEposta(adres), dogrulandi: false };
  }

  async verifyEmail(kod: string) {
    const c = await this.db.emailChallenge.findUnique({
      where: { tokenHash: createHash('sha256').update(kod).digest('hex') },
    });
    if (!c || c.usedAt || c.expiresAt < new Date()) {
      throw new NotFoundException('Bağlantının süresi dolmuş ya da kullanılmış; yeniden gönder');
    }
    await this.db.$transaction(async (tx) => {
      await tx.emailChallenge.update({ where: { id: c.id }, data: { usedAt: new Date() } });
      // Adres bu arada değiştiyse eski bağlantı geçersiz
      const r = await tx.user.updateMany({
        where: { id: c.userId, email: c.email },
        data: { emailVerifiedAt: new Date() },
      });
      if (r.count !== 1) throw new NotFoundException('Bu bağlantı artık geçerli değil');
    });
    return { dogrulandi: true, adres: maskEposta(c.email) };
  }
}
