import { Inject, Injectable, Logger } from '@nestjs/common';
import { type AutomationRun, Prisma, uuidv7 } from '@rengarenk/db';
import {
  AUTOMATIONS,
  type AutomationKey,
  FLOW_CONDITIONS,
  FLOW_GOALS,
  type FlowCondition,
  type FlowStep,
  flowStepSchema,
} from '@rengarenk/shared';
import { z } from 'zod';
import { type Db, PRISMA } from '../database/prisma.js';
import { NotificationService } from './notification.service.js';
import { SwitchService } from './switches.js';

const HOUR = 3_600_000;
/** Bir işçi adımı alınca diğerleri bu süre dokunmaz */
const KILIT_MS = 5 * 60_000;
const adimlarSchema = z.array(flowStepSchema);

/** Kişinin akıştaki bağlamı: ileti değişkenleri ve hedef denetimi için kimlikler */
export interface FlowContext {
  veri: Record<string, unknown>;
  demandId?: string;
  bitis?: string;
  conversationId?: string;
  accountId?: string;
}

/** {{degisken}} yerine değer; bilinmeyen değişken olduğu gibi kalır (kaydederken denetlenir) */
export const doldur = (metin: string, veri: Record<string, unknown>) =>
  metin.replace(/\{\{\s*(\w+)\s*\}\}/g, (tum, k: string) =>
    veri[k] === undefined || veri[k] === null ? tum : String(veri[k]),
  );

/**
 * Otomatik akış motoru (Karar 51; Teknik tasarım: her akış bir JSON tanımı, her kişinin durumu ayrı). Tetikleyici
 * ilk iletiyi bildirim katmanından gönderir ve `baslat` ile kişiyi akışa alır; eklenen adımlar o anki haliyle kişinin
 * kaydına kopyalanır (sonradan yapılan düzenleme süren akışı bozmaz). İşçi dakikada bir zamanı gelen adımları yürütür:
 * her adımdan önce akış açık mı ve hedefe ulaşıldı mı bakılır; bekleme `next_at`'i ileri atar; koşul sağlanmazsa kişi
 * akıştan çıkar; ileti `akis.adim.<akış>` şablonuyla gider.
 */
@Injectable()
export class FlowService {
  private readonly log = new Logger(FlowService.name);

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly notifications: NotificationService,
    private readonly switches: SwitchService,
  ) {}

  /** Akışın eklenen adımları ve sürümü */
  async adimlar(key: AutomationKey): Promise<{ adimlar: FlowStep[]; surum: number }> {
    const r = await this.db.automationFlow.findUnique({ where: { key } });
    if (!r) return { adimlar: [], surum: 0 };
    const v = adimlarSchema.safeParse(r.steps);
    return { adimlar: v.success ? v.data : [], surum: r.version };
  }

  /**
   * Tetikleyici ilk iletiyi gönderdikten sonra çağırır. Eklenen adım yoksa kayıt açılmaz. `ref` aynı tetikleyicinin
   * ikinci kez akış başlatmasını önler (ör. talep ve bitiş tarihi).
   */
  async baslat(
    key: AutomationKey,
    userIds: string[],
    ctx: FlowContext,
    ref: string,
    now = new Date(),
  ): Promise<number> {
    const { adimlar, surum } = await this.adimlar(key);
    if (!adimlar.length || !(await this.switches.akisAcik(key))) return 0;
    let n = 0;
    for (const userId of new Set(userIds)) {
      try {
        await this.db.automationRun.create({
          data: {
            id: uuidv7(),
            flowKey: key,
            userId,
            dedupeKey: `${key}:${ref}:${userId}`,
            context: ctx as unknown as Prisma.InputJsonValue,
            steps: adimlar as unknown as Prisma.InputJsonValue,
            flowVersion: surum,
            nextAt: now,
          },
        });
        n++;
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
      }
    }
    return n;
  }

  /** İşçi: zamanı gelen adımlar (dakikada bir) */
  async tick(now = new Date(), limit = 200) {
    const runs = await this.db.automationRun.findMany({
      where: { status: 'aktif', nextAt: { lte: now } },
      orderBy: { nextAt: 'asc' },
      take: limit,
    });
    let n = 0;
    for (const r of runs) {
      try {
        if (await this.ilerlet(r, now)) n++;
      } catch (e) {
        this.log.error(`akış ${r.flowKey} ${r.id}: ${(e as Error).message}`);
      }
    }
    return n;
  }

  private async ilerlet(r: AutomationRun, now: Date) {
    // Birden çok işçi aynı kaydı almasın
    const kilit = await this.db.automationRun.updateMany({
      where: { id: r.id, status: 'aktif', step: r.step, nextAt: r.nextAt },
      data: { nextAt: new Date(now.getTime() + KILIT_MS) },
    });
    if (!kilit.count) return false;
    const key = r.flowKey as AutomationKey;
    const adimlar = adimlarSchema.safeParse(r.steps);
    const ctx = r.context as unknown as FlowContext;
    const bitir = (status: string, note: string) =>
      this.db.automationRun.update({ where: { id: r.id }, data: { status, note } });
    if (!adimlar.success) {
      await bitir('cikti', 'Adım tanımı okunamadı');
      return true;
    }
    let step = r.step;
    let note = r.note;
    for (;;) {
      if (!(await this.switches.akisAcik(key))) {
        await bitir('kapali', 'Akış kapatıldı');
        return true;
      }
      if (await this.hedefte(key, r, ctx)) {
        await bitir('hedef', `Hedefe ulaştı: ${FLOW_GOALS[key].hedef}`);
        return true;
      }
      const a = adimlar.data[step];
      if (!a) {
        await this.db.automationRun.update({
          where: { id: r.id },
          data: { status: 'bitti', step, note: note ?? 'Adımlar tamamlandı' },
        });
        return true;
      }
      if (a.tip === 'bekle') {
        step++;
        await this.db.automationRun.update({
          where: { id: r.id },
          data: { step, nextAt: new Date(now.getTime() + a.saat * HOUR), note: `${a.saat} saat bekliyor` },
        });
        return true;
      }
      if (a.tip === 'kosul') {
        if (!(await this.kosul(a.kosul, key, r))) {
          await this.db.automationRun.update({
            where: { id: r.id },
            data: { status: 'cikti', step, note: `Koşul sağlanmadı: ${FLOW_CONDITIONS[a.kosul].ad}` },
          });
          return true;
        }
        step++;
        continue;
      }
      await this.ileti(key, a, r.userId, ctx);
      step++;
      note = 'İleti gönderildi';
      await this.db.automationRun.update({ where: { id: r.id }, data: { step, note } });
    }
  }

  /** Hedef (FLOW_GOALS): ulaşıldıysa kişi akıştan çıkar */
  async hedefte(key: AutomationKey, r: { userId: string; createdAt: Date }, ctx: FlowContext) {
    switch (key) {
      case 'hosgeldin':
      case 'ilk_talep':
        return (await this.db.demand.count({ where: { userId: r.userId, publishedAt: { not: null } } })) > 0;
      case 'doluyor': {
        if (!ctx.demandId) return true;
        const d = await this.db.demand.findUnique({
          where: { id: ctx.demandId },
          select: { status: true, expiresAt: true },
        });
        if (d?.status !== 'PUBLISHED') return true;
        return Boolean(ctx.bitis && d.expiresAt && d.expiresAt.getTime() > new Date(ctx.bitis).getTime());
      }
      case 'okumadin': {
        if (!ctx.conversationId) return true;
        const c = await this.db.conversation.findUnique({
          where: { id: ctx.conversationId },
          select: { buyerReadAt: true },
        });
        return !c || c.buyerReadAt !== null;
      }
      case 'galeri7':
        return (
          (await this.db.conversation.count({
            where: { sellerAccountId: ctx.accountId, origin: 'talep', createdAt: { gte: r.createdAt } },
          })) > 0
        );
      case 'deneme':
        return (await this.db.subscription.count({ where: { accountId: ctx.accountId } })) > 0;
      case 'odeme': {
        const s = await this.db.subscription.findUnique({
          where: { accountId: ctx.accountId },
          select: { status: true, failCount: true },
        });
        return !s || (s.status === 'ACTIVE' && s.failCount === 0);
      }
    }
  }

  private async kosul(k: FlowCondition, key: AutomationKey, r: AutomationRun) {
    if (k === 'okunmadi') {
      const son = await this.db.notification.findFirst({
        where: {
          userId: r.userId,
          sablon: { in: [...AUTOMATIONS[key].sablonlar] },
          createdAt: { gte: new Date(r.createdAt.getTime() - 60_000) },
        },
        orderBy: { createdAt: 'desc' },
        select: { readAt: true },
      });
      return !son || son.readAt === null;
    }
    if (k === 'ticari_onay') {
      const son = await this.db.consent.findFirst({
        where: { userId: r.userId, kind: 'ticari_ileti' },
        orderBy: { createdAt: 'desc' },
        select: { granted: true },
      });
      return son?.granted === true;
    }
    const u = await this.db.user.findUnique({
      where: { id: r.userId },
      select: { email: true, emailVerifiedAt: true },
    });
    return Boolean(u?.email && u.emailVerifiedAt);
  }

  private async ileti(
    key: AutomationKey,
    a: Extract<FlowStep, { tip: 'ileti' }>,
    userId: string,
    ctx: FlowContext,
  ) {
    const u = await this.db.user.findUnique({ where: { id: userId }, select: { firstName: true } });
    const veri = { ...ctx.veri, ad: u?.firstName || 'değerli üyemiz' };
    return this.notifications.notify({
      userIds: [userId],
      sablon: `akis.adim.${key}`,
      veri: {
        baslik: doldur(a.baslik, veri),
        metin: doldur(a.metin, veri),
        dugme: doldur(a.dugme, veri),
        url: doldur(FLOW_GOALS[key].url, veri),
      },
      kanallar: a.kanallar,
    });
  }
}
