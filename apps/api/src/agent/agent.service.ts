import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { type Prisma, uuidv7 } from '@rengarenk/db';
import {
  AGENT_ACTION_KINDS,
  AGENT_LIMITS,
  AGENT_SUGGESTION_KINDS,
  type AgentActionKind,
  type AgentSuggestionKind,
  ekle,
  microToUsd,
  type Permission,
} from '@rengarenk/shared';
import { AiGateway, trMonth } from '../ai/ai-gateway.service.js';
import { AJAN_EPOSTA } from '../approvals/agent-actor.js';
import type { Actor } from '../approvals/approval.service.js';
import { AuditService } from '../audit/audit.service.js';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';
import { OutboxService } from '../outbox/outbox.service.js';

const DAY = 86_400_000;
const TR = 3 * 3_600_000;
/** Türkiye saatine göre günün başı (UTC) */
export const trDayStart = (now: Date) => new Date(Math.floor((now.getTime() + TR) / DAY) * DAY - TR);
const saat = (d: Date) =>
  new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  }).format(d);
const yuzde = (x: number) =>
  `%${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(x * 100)}`;
const sayi = (n: number) => new Intl.NumberFormat('tr-TR').format(n);

export interface AgentActionInput {
  kind: AgentActionKind;
  title: string;
  reason: string;
  /** "Güven %97" | "Kural" | "Kontroller tam" | "Rapor" */
  confidence: string;
  entityType?: string;
  entityId?: string;
  undo?: Prisma.InputJsonValue;
}

/**
 * Rengarenk Ajanı (Karar 41; Teknik tasarım §10). Durdurma düğmesi `ajan` özellik anahtarıdır; her görev ilk adımda
 * `calisiyor()` sorar. Ajanın kendi yaptığı her işlem `agent_actions`'a (ve işlem kaydına) yazılır, geri alınabilen
 * işlemler tek tıkla geri alınır. Öneriler kurallarla üretilir ve insan kararını bekler; ajan iade yapamaz, kişisel
 * veriyi dışa aktaramaz, yetki değiştiremez, kayıt silemez.
 */
@Injectable()
export class AgentService {
  private static memo: { at: number; on: boolean } | null = null;

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly ai: AiGateway,
  ) {}

  /** Ajan çalışıyor mu (özellik anahtarı `ajan`; birkaç saniye önbellek) */
  async calisiyor(): Promise<boolean> {
    const m = AgentService.memo;
    if (m && Date.now() - m.at < 5000) return m.on;
    const on = (await this.db.featureFlag.findUnique({ where: { key: 'ajan' } }))?.enabled ?? false;
    AgentService.memo = { at: Date.now(), on };
    return on;
  }

  static unut() {
    AgentService.memo = null;
  }

  /** Ajan işlemini kaydeder; değişiklikle aynı veritabanı işleminde çağrılır */
  kaydet(tx: Tx, e: AgentActionInput) {
    return tx.agentAction.create({
      data: {
        id: uuidv7(),
        kind: e.kind,
        title: e.title.slice(0, 200),
        reason: e.reason.slice(0, 500),
        confidence: e.confidence,
        entityType: e.entityType ?? null,
        entityId: e.entityId ?? null,
        ...(e.undo !== undefined ? { undo: e.undo } : {}),
      },
    });
  }

  private async ajanId() {
    return (await this.db.staffMember.findUnique({ where: { email: AJAN_EPOSTA }, select: { id: true } }))
      ?.id;
  }

  // ── Konsol: Rengarenk Ajanı (YonetimEkip.dc.html › ajan) ────

  async overview(actor: Actor, now = new Date()) {
    const gun = trDayStart(now);
    const hafta = new Date(now.getTime() - 7 * DAY);
    const ajanId = await this.ajanId();
    const [calisiyor, aski, harcama, ayar, bugun, haftalik, geriAlinan, bekleyen, oneriler, tepkiler] =
      await Promise.all([
        this.calisiyor(),
        this.db.userSanction.count({ where: { byAgent: true, kind: 'aski', createdAt: { gte: gun } } }),
        this.ai.harcama(now),
        this.db.aiSetting.findUnique({ where: { id: 1 } }),
        this.db.agentAction.findMany({
          where: { createdAt: { gte: gun } },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
        this.db.agentAction.groupBy({
          by: ['kind'],
          where: { createdAt: { gte: hafta } },
          _count: { _all: true },
        }),
        this.db.agentAction.groupBy({
          by: ['kind'],
          where: { createdAt: { gte: hafta }, undoneAt: { not: null } },
          _count: { _all: true },
        }),
        ajanId ? this.db.approval.count({ where: { requestedBy: ajanId, status: 'PENDING' } }) : 0,
        this.db.agentSuggestion.findMany({
          where: { status: 'acik', createdAt: { gte: new Date(now.getTime() - 14 * DAY) } },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        this.tepkiSuresi(hafta),
      ]);
    const toplam7 = haftalik.reduce((t, g) => t + g._count._all, 0);
    const geri7 = geriAlinan.reduce((t, g) => t + g._count._all, 0);
    const insana = bugun.filter((a) => a.kind === 'insana').length;
    const sinir = ayar?.limitUsd ?? 150;
    const yetkili = (izin: Permission | null) => !!izin && actor.grants[izin] === 'tam';
    return {
      calisiyor,
      durum: {
        aski,
        askiSinir: AGENT_LIMITS.aski,
        yanit: await this.db.agentAction.count({ where: { kind: 'destek_yanit', createdAt: { gte: gun } } }),
        yanitSinir: AGENT_LIMITS.otomatikYanit,
        maliyetUsd: microToUsd(harcama),
        sinirUsd: sinir,
      },
      sayilar: {
        bugun: bugun.length,
        insana,
        geriOran: toplam7 ? geri7 / toplam7 : 0,
        geri7,
        toplam7,
        tepkiSn: tepkiler,
        bekleyen,
      },
      oneriler: oneriler.map((o) => ({
        id: o.id,
        tur: AGENT_SUGGESTION_KINDS[o.kind as AgentSuggestionKind]?.ad ?? o.kind,
        bg: AGENT_SUGGESTION_KINDS[o.kind as AgentSuggestionKind]?.bg ?? '#F3F5FA',
        fg: AGENT_SUGGESTION_KINDS[o.kind as AgentSuggestionKind]?.fg ?? '#5A6073',
        baslik: o.title,
        gerekce: o.reason,
      })),
      akis: bugun.map((a) => {
        const def = AGENT_ACTION_KINDS[a.kind as AgentActionKind];
        return {
          id: a.id,
          saat: saat(a.createdAt),
          islem: a.title,
          neden: a.reason,
          guven: a.confidence,
          geriAlinabilir: !!def?.geriAlinir && !a.undoneAt && yetkili(def.izin),
          geriAlindi: !!a.undoneAt,
        };
      }),
      karne: Object.entries(AGENT_ACTION_KINDS).map(([k, d]) => ({
        kind: k,
        ad: d.ad,
        sayi: haftalik.find((g) => g.kind === k)?._count._all ?? 0,
        geri: geriAlinan.find((g) => g.kind === k)?._count._all ?? 0,
      })),
    };
  }

  /** Şikâyet gelişinden (mesaj) ajanın işlemine ortalama süre, saniye; son 7 gün */
  private async tepkiSuresi(since: Date): Promise<number | null> {
    const r = await this.db.report.findMany({
      where: { source: 'ajan', targetType: 'mesaj', createdAt: { gte: since } },
      select: { targetId: true, createdAt: true },
      take: 500,
    });
    if (!r.length) return null;
    const m = new Map(
      (
        await this.db.message.findMany({
          where: { id: { in: r.map((x) => x.targetId) } },
          select: { id: true, createdAt: true },
        })
      ).map((x) => [x.id, x.createdAt.getTime()]),
    );
    const farklar = r.flatMap((x) => {
      const t = m.get(x.targetId);
      return t ? [(x.createdAt.getTime() - t) / 1000] : [];
    });
    return farklar.length ? Math.round(farklar.reduce((a, b) => a + b, 0) / farklar.length) : null;
  }

  /** Tek tıkla geri alma (Karar 41): işlemin türüne göre yetki ister, işlem kaydına girer */
  async undo(actor: Actor, id: string, ip?: string) {
    const a = await this.db.agentAction.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Ajan işlemi bulunamadı');
    const def = AGENT_ACTION_KINDS[a.kind as AgentActionKind];
    if (!def?.geriAlinir) throw new ConflictException('Bu işlem geri alınamaz');
    if (!def.izin || actor.grants[def.izin] !== 'tam')
      throw new ForbiddenException('Bu işlemi geri almak için yetkin yok');
    if (a.undoneAt) throw new ConflictException('İşlem zaten geri alındı');
    const u = (a.undo ?? {}) as Record<string, string | null>;
    const now = new Date();
    await this.db.$transaction(async (tx) => {
      const n = await tx.agentAction.updateMany({
        where: { id, undoneAt: null },
        data: { undoneAt: now, undoneBy: actor.staff.id },
      });
      if (!n.count) throw new ConflictException('İşlem zaten geri alındı');
      if (a.kind === 'mesaj_gizle') {
        if (u.messageId)
          await tx.message.updateMany({ where: { id: u.messageId }, data: { hiddenAt: null } });
        if (u.sanctionId)
          await tx.userSanction.updateMany({
            where: { id: u.sanctionId, liftedAt: null },
            data: { liftedAt: now },
          });
      } else if (a.kind === 'galeri_onay') {
        const app = await tx.galleryApplication.findUnique({ where: { id: u.applicationId as string } });
        if (app?.status !== 'APPROVED' || !app.accountId)
          throw new ConflictException('Başvuru artık onaylı değil; geri alınamaz');
        await tx.galleryApplication.update({
          where: { id: app.id },
          data: {
            status: 'REVOKED',
            decidedAt: now,
            decidedBy: actor.staff.id,
            decisionNote: 'Ajanın onayı geri alındı',
          },
        });
        await tx.account.update({ where: { id: app.accountId }, data: { status: 'SUSPENDED' } });
        await this.audit.record(
          {
            actorType: 'STAFF',
            actorId: actor.staff.id,
            action: 'galeri_basvuru_onay_geri_alindi',
            entityType: 'gallery_application',
            entityId: app.id,
            after: { gerekce: 'Ajanın onayı geri alındı', accountId: app.accountId },
            ip,
          },
          tx,
        );
        await this.outbox.add(tx, 'galeri.onay_geri_alindi', {
          applicationId: app.id,
          accountId: app.accountId,
        });
      } else if (a.kind === 'spam_kisit') {
        if (u.sanctionId)
          await tx.userSanction.updateMany({
            where: { id: u.sanctionId, liftedAt: null },
            data: { liftedAt: now },
          });
      } else if (a.kind === 'destek_yanit') {
        // Gönderilen yanıt geri çekilmez; talep yeniden insana açılır
        await tx.supportTicket.updateMany({
          where: { id: u.ticketId as string },
          data: { status: 'acik', resolvedAt: null, resolvedBy: null, dueAt: new Date() },
        });
      } else if (a.kind === 'talep_duzeltme') {
        // İstek kalkar; herkese açık görünümde iletişim bilgisi yine gizlidir
        await tx.demand.updateMany({
          where: { id: u.demandId as string },
          data: { correctionFlags: [], correctionAt: null },
        });
      } else if (a.kind === 'ticari_durdur') {
        await tx.notificationSwitch.upsert({
          where: { key: 'ticari' },
          create: { key: 'ticari', enabled: true, updatedBy: actor.staff.id },
          update: { enabled: true, updatedBy: actor.staff.id },
        });
      }
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: actor.staff.id,
          action: 'ajan_islemi_geri_alindi',
          entityType: 'agent_action',
          entityId: id,
          before: { tur: a.kind, islem: a.title },
          ip,
        },
        tx,
      );
    });
  }

  async oneriKapat(actor: Actor, id: string) {
    const n = await this.db.$transaction(async (tx) => {
      const r = await tx.agentSuggestion.updateMany({
        where: { id, status: 'acik' },
        data: { status: 'kapandi', closedBy: actor.staff.id, closedAt: new Date() },
      });
      if (r.count)
        await this.audit.record(
          {
            actorType: 'STAFF',
            actorId: actor.staff.id,
            action: 'ajan_onerisi_kapandi',
            entityType: 'agent_suggestion',
            entityId: id,
          },
          tx,
        );
      return r.count;
    });
    if (!n) throw new NotFoundException('Açık öneri bulunamadı');
  }

  // ── İşçi: öneriler ve günlük özet ────────────────────────────

  private async oneriYaz(
    kind: AgentSuggestionKind,
    key: string,
    title: string,
    reason: string,
    data: object,
  ) {
    const r = await this.db.agentSuggestion.createMany({
      data: [{ id: uuidv7(), kind, key, title, reason, data: data as Prisma.InputJsonValue }],
      skipDuplicates: true,
    });
    return r.count > 0;
  }

  /**
   * Kurallarla öneri üretir (Karar 41, önerir ve onay bekler). Her kural aynı dönemde bir kez öneri açar:
   * denemesi bu hafta biten ve hiç mesaj atmamış galeriler; dolandırıcılık vakalarında bağlantı oranı; il ve
   * kategoride talep artışı.
   */
  async oneriUret(now = new Date()) {
    if (!(await this.calisiyor())) return 0;
    let n = 0;
    const hafta = `${now.getUTCFullYear()}-${Math.ceil((trDayStart(now).getTime() / DAY + 4) / 7)}`;

    // Gelir: denemesi 7 gün içinde biten galeriler
    const biten = await this.db.gallery.findMany({
      where: {
        plan: 'deneme',
        trialEndsAt: { gte: now, lt: new Date(now.getTime() + 7 * DAY) },
        account: { status: 'ACTIVE' },
      },
      select: { accountId: true },
    });
    if (biten.length) {
      const yazan = new Set(
        (
          await this.db.conversation.findMany({
            where: { sellerAccountId: { in: biten.map((g) => g.accountId) }, origin: 'talep' },
            select: { sellerAccountId: true },
            distinct: ['sellerAccountId'],
          })
        ).map((c) => c.sellerAccountId),
      );
      const sessiz = biten.filter((g) => !yazan.has(g.accountId)).length;
      if (sessiz) {
        const baslik =
          sessiz === biten.length
            ? `${biten.length} galerinin denemesi bu hafta bitiyor, hiçbiri mesaj atmadı`
            : `${biten.length} galerinin denemesi bu hafta bitiyor, ${sessiz} tanesi hiç mesaj atmadı`;
        if (
          await this.oneriYaz(
            'gelir',
            `deneme-bitiyor:${hafta}`,
            baslik,
            'Bu galerilerle iletişime geçilsin mi? Deneme uzatma ayrıca onay ister.',
            { galeri: biten.length, sessiz },
          )
        )
          n++;
      }
    }

    // Kural: son 30 günde dolandırıcılık ve kapora vakalarında bağlantı
    const vakalar = await this.db.report.findMany({
      where: {
        targetType: 'mesaj',
        reason: { in: ['kapora', 'dolandiricilik'] },
        createdAt: { gte: new Date(now.getTime() - 30 * DAY) },
      },
      select: { targetId: true },
    });
    if (vakalar.length >= 5) {
      const baglanti = await this.db.message.count({
        where: { id: { in: vakalar.map((v) => v.targetId) }, flags: { has: 'baglanti' } },
      });
      if (
        baglanti / vakalar.length >= 0.5 &&
        (await this.oneriYaz(
          'kural',
          `baglanti:${trMonth(now).key}`,
          'Bağlantı içeren satıcı mesajları otomatik incelemeye düşsün',
          `Son 30 günde ${vakalar.length} dolandırıcılık ve kapora vakasının ${baglanti} tanesinde bağlantı vardı.`,
          { vaka: vakalar.length, baglanti },
        ))
      )
        n++;
    }

    // Kampanya fikri: il ve kategoride 2 haftalık talep artışı
    const ikiHafta = new Date(now.getTime() - 14 * DAY);
    const dortHafta = new Date(now.getTime() - 28 * DAY);
    const [simdi, once] = await Promise.all([
      this.db.demand.groupBy({
        by: ['il', 'categoryId'],
        where: { createdAt: { gte: ikiHafta }, il: { not: null }, status: { not: 'DRAFT' } },
        _count: { _all: true },
      }),
      this.db.demand.groupBy({
        by: ['il', 'categoryId'],
        where: { createdAt: { gte: dortHafta, lt: ikiHafta }, il: { not: null }, status: { not: 'DRAFT' } },
        _count: { _all: true },
      }),
    ]);
    const oncekiler = new Map(once.map((o) => [`${o.il}|${o.categoryId}`, o._count._all]));
    const artis = simdi
      .map((s) => {
        const p = oncekiler.get(`${s.il}|${s.categoryId}`) ?? 0;
        return { ...s, p, oran: p ? (s._count._all - p) / p : null };
      })
      .filter((s) => s._count._all >= 10 && s.p > 0 && (s.oran ?? 0) >= 0.5)
      .sort((a, b) => (b.oran ?? 0) - (a.oran ?? 0))[0];
    if (artis?.il) {
      const [kat, galeri] = await Promise.all([
        this.db.category.findUnique({ where: { id: artis.categoryId }, select: { name: true } }),
        this.db.gallery.count({ where: { il: artis.il, account: { status: 'ACTIVE' } } }),
      ]);
      const il = artis.il;
      if (
        await this.oneriYaz(
          'kampanya',
          `talep-artis:${il}:${artis.categoryId}:${hafta}`,
          `${ekle(il, 'bulunma')} ${(kat?.name ?? 'bu kategoride').toLocaleLowerCase('tr')} talebi 2 haftada ${yuzde(artis.oran ?? 0)} arttı`,
          `Bölgede ${galeri} galeri var. ${ekle(il, 'bulunma')}ki işletmelere 30 günlük deneme duyurusu öneriyorum.`,
          { il, kategori: artis.categoryId, simdi: artis._count._all, once: artis.p },
        )
      )
        n++;
    }
    return n;
  }

  /** Günlük özet (Karar 41): her sabah 09.00'dan sonra bir kez; yapay zekâ yalnızca cümleyi kurar, sayılar kuraldan */
  async ozet(now = new Date()) {
    if (!(await this.calisiyor())) return null;
    const bugun = trDayStart(now);
    if (now.getTime() - bugun.getTime() < 9 * 3_600_000) return null;
    if (await this.db.agentAction.findFirst({ where: { kind: 'ozet', createdAt: { gte: bugun } } }))
      return null;
    const dun = new Date(bugun.getTime() - DAY);
    const yedi = new Date(bugun.getTime() - 7 * DAY);
    const ondort = new Date(bugun.getTime() - 14 * DAY);
    const kapora = (gte: Date, lt: Date) =>
      this.db.report.count({ where: { reason: 'kapora', createdAt: { gte, lt } } });
    const [talep, ilkMesaj, buldu, kBu, kOnce] = await Promise.all([
      this.db.demand.count({ where: { publishedAt: { gte: dun, lt: bugun } } }),
      this.db.conversation.count({ where: { origin: 'talep', createdAt: { gte: dun, lt: bugun } } }),
      this.db.demand.count({ where: { foundVia: 'rengarenk', closedAt: { gte: dun, lt: bugun } } }),
      kapora(yedi, bugun),
      kapora(ondort, yedi),
    ]);
    const degisim =
      kOnce > 0
        ? `kapora şikâyetleri geçen haftaya göre ${yuzde(Math.abs(kBu - kOnce) / kOnce)} ${kBu >= kOnce ? 'arttı' : 'azaldı'}`
        : `bu hafta ${kBu} kapora şikâyeti var`;
    const taslak = `Dün ${sayi(talep)} yeni talep, ${sayi(ilkMesaj)} ilk mesaj; ${sayi(buldu)} alıcı aracını Rengarenk’te buldu; ${degisim}.`;
    const r = await this.ai.run({
      task: 'rapor',
      promptVersion: 'gunluk-ozet-v1',
      size: 'kucuk',
      system:
        'Rengarenk yönetim konsolu için günlük özet yaz. Yalnızca verilen olguları kullan, sayıları değiştirme, en çok iki cümle, Türkçe.',
      prompt: JSON.stringify({ talep, ilkMesaj, buldu, kaporaBuHafta: kBu, kaporaGecenHafta: kOnce }),
      taslak,
    });
    return this.db.$transaction(async (tx) => {
      const a = await this.kaydet(tx, {
        kind: 'ozet',
        title: 'Günlük özet yazıldı',
        reason: r.text,
        confidence: 'Rapor',
      });
      await this.outbox.add(tx, 'ajan.ozet', { actionId: a.id });
      return a;
    });
  }
}
