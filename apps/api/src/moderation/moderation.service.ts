import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type Prisma, type Report, uuidv7 } from '@rengarenk/db';
import {
  AGENT_DAILY_SUSPENSIONS,
  APPEAL_DAYS,
  CONTENT_FILTER_KEYS,
  CONTENT_FILTERS,
  DECISION_NAMES,
  DECISION_NOTES,
  DECISION_PERMISSION,
  flagShort,
  HIDE_NAMES,
  type MessageFlag,
  type ModerationDecision,
  maskEvidence,
  type PermissionGrants,
  PRIORITY_HOURS,
  PRIORITY_NAMES,
  REPORT_REASONS,
  REPORT_TARGET_NAMES,
  REPORTS_PER_DAY,
  type ReportCreate,
  type ReportPriority,
  type ReportReasonKey,
  type ReportTarget,
  SUSPEND_HOURS,
  shortName,
  WARN_WINDOW_DAYS,
} from '@rengarenk/shared';
import { ApprovalService } from '../approvals/approval.service.js';
import { ApprovalExecutor } from '../approvals/approval-executor.js';
import { AuditService } from '../audit/audit.service.js';
import { ENV, type Env } from '../config/env.js';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { SecretBox } from '../staff/secret-box.js';
import { ContentRulesService } from './content-rules.service.js';
import { SanctionService } from './sanctions.service.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const UYGULANAN = ['uyari', 'gizle', 'aski', 'engel'];

export interface ModeratorCtx {
  staff: { id: string; role: string; status: string };
  grants: PermissionGrants;
}

interface Hedef {
  targetType: ReportTarget;
  targetId: string;
  targetUserId: string;
  targetAccountId: string | null;
}

const tarihSaat = (d: Date) =>
  new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  }).format(d);

/**
 * Şikâyet ve moderasyon (Karar 13.2, 41, 52, 53).
 *
 * - Kullanıcı mesajı, talebi ya da portföy aracını şikâyet eder; yasaklı kelime kuralı ve ajan da şikâyet açar.
 * - Konsol kuyruğu önceliğe göre sıralar (kritik 1, yüksek 4, normal 24 saat); kanıt maskeli gösterilir.
 * - Karar: uyarı (30 günde ikincisi otomatik askı), gizle, 24 saat askı, kalıcı engelleme önerisi (dört göz), red.
 *   Karar, işlem kaydı ve bildirim olayı aynı veritabanı işlemindedir.
 * - Ajan, satıcı mesajında açık kapora ve IBAN ya da ödeme isteği varsa mesajı gizler, hesabı 24 saat askıya alır ve
 *   kararı insana bırakır (günde en çok 50 askı).
 * - İtiraz 7 gün içinde; ilk kararı veren dışında bir moderatör inceler. Kabul edilirse yaptırım kalkar, içerik geri gelir.
 */
@Injectable()
export class ModerationService {
  private readonly box: SecretBox;
  private readonly web: string;

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(ENV) env: Env,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly approvals: ApprovalService,
    executor: ApprovalExecutor,
    private readonly rules: ContentRulesService,
    private readonly sanctions: SanctionService,
  ) {
    this.box = SecretBox.forMessages(env);
    this.web = env.WEB_ORIGIN;
    executor.register('PERMANENT_BAN', (a, tx) =>
      this.banApproved(a.payload as unknown as BanPayload, a.id, tx),
    );
  }

  private acik(body: string) {
    try {
      return this.box.open(body);
    } catch {
      return '';
    }
  }

  // ── Şikâyet açma ──────────────────────────────────────────────

  /** Kullanıcı şikâyeti: hedefin tarafı olmalı (mesajda karşı tarafın mesajı); aynı hedefe açık şikâyeti varsa onu döner */
  async create(userId: string, b: ReportCreate, ip?: string) {
    const bugun = await this.db.report.count({
      where: { reporterUserId: userId, createdAt: { gte: new Date(Date.now() - DAY) } },
    });
    if (bugun >= REPORTS_PER_DAY) {
      throw new HttpException(
        `Günde en çok ${REPORTS_PER_DAY} şikâyet gönderebilirsin`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const h = await this.hedef(userId, b.hedef, b.id);
    const var_ = await this.db.report.findFirst({
      where: { reporterUserId: userId, targetType: h.targetType, targetId: h.targetId, status: 'acik' },
      select: { no: true },
    });
    if (var_) return { no: var_.no, yeni: false };
    const neden = REPORT_REASONS[b.neden];
    const id = uuidv7();
    const r = await this.db.$transaction(async (tx) => {
      const r = await tx.report.create({
        data: {
          id,
          source: 'kullanici',
          reporterUserId: userId,
          ...h,
          reason: b.neden,
          priority: neden.oncelik,
          note: b.aciklama || null,
          dueAt: new Date(Date.now() + PRIORITY_HOURS[neden.oncelik] * HOUR),
        },
      });
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: userId,
          action: 'sikayet_acildi',
          entityType: 'report',
          entityId: id,
          after: { hedef: h.targetType, neden: b.neden },
          ip,
        },
        tx,
      );
      await this.outbox.add(tx, 'sikayet.acildi', { reportId: id });
      return r;
    });
    return { no: r.no, yeni: true };
  }

  private async hedef(userId: string, tur: ReportTarget, ref: string): Promise<Hedef> {
    if (tur === 'mesaj') {
      if (!/^[0-9a-f-]{36}$/i.test(ref)) throw new BadRequestException('Mesaj bulunamadı');
      const m = await this.db.message.findUnique({
        where: { id: ref },
        include: { conversation: true },
      });
      if (m?.kind !== 'metin' || !m.senderUserId) throw new NotFoundException('Mesaj bulunamadı');
      const c = m.conversation;
      const alici = c.buyerUserId === userId;
      const satici =
        !alici &&
        !!(await this.db.accountMember.findUnique({
          where: { accountId_userId: { accountId: c.sellerAccountId, userId } },
        }));
      if (!alici && !satici) throw new NotFoundException('Mesaj bulunamadı');
      if ((alici && m.side !== 'satici') || (satici && m.side !== 'alici')) {
        throw new BadRequestException('Yalnızca karşı tarafın mesajı şikâyet edilir');
      }
      return {
        targetType: 'mesaj',
        targetId: m.id,
        targetUserId: m.senderUserId,
        targetAccountId: m.side === 'satici' ? c.sellerAccountId : null,
      };
    }
    if (!/^\d{1,12}$/.test(ref)) throw new BadRequestException('Numara geçersiz');
    if (tur === 'talep') {
      const d = await this.db.demand.findUnique({
        where: { no: BigInt(ref) },
        select: { id: true, userId: true, accountId: true, status: true },
      });
      if (!d || d.status === 'DRAFT') throw new NotFoundException('Talep bulunamadı');
      if (d.userId === userId) throw new BadRequestException('Kendi talebini şikâyet edemezsin');
      return { targetType: 'talep', targetId: d.id, targetUserId: d.userId, targetAccountId: d.accountId };
    }
    const v = await this.db.portfolioVehicle.findUnique({
      where: { no: BigInt(ref) },
      select: { id: true, accountId: true, status: true, assignedTo: true, createdBy: true },
    });
    if (v?.status !== 'PUBLISHED') throw new NotFoundException('Araç bulunamadı');
    const uye = await this.db.accountMember.findUnique({
      where: { accountId_userId: { accountId: v.accountId, userId } },
    });
    if (uye) throw new BadRequestException('Kendi galerinin aracını şikâyet edemezsin');
    return {
      targetType: 'arac',
      targetId: v.id,
      targetUserId: v.assignedTo ?? v.createdBy,
      targetAccountId: v.accountId,
    };
  }

  /**
   * Yasaklı kelime kuralı (Karar 13.2): mesaj ya da talep kaydıyla aynı işlemde şikâyet açar. Aynı hedefe açık kural
   * şikâyeti varsa yenisi açılmaz.
   */
  async kuralSikayeti(tx: Tx, h: Hedef, kelimeler: string[]) {
    if (!kelimeler.length) return;
    const var_ = await tx.report.findFirst({
      where: { source: 'kural', targetType: h.targetType, targetId: h.targetId, status: 'acik' },
      select: { id: true },
    });
    if (var_) return;
    const id = uuidv7();
    await tx.report.create({
      data: {
        id,
        source: 'kural',
        ...h,
        reason: 'yasakli_kelime',
        priority: 'normal',
        signals: kelimeler,
        dueAt: new Date(Date.now() + PRIORITY_HOURS.normal * HOUR),
      },
    });
    await this.outbox.add(tx, 'sikayet.acildi', { reportId: id });
  }

  /**
   * Ajan (Karar 41, sormadan yapar): satıcı mesajında açık kapora ve IBAN ya da ödeme isteği varsa mesajı gizler,
   * hesabı 24 saat askıya alır, şikâyeti kritik öncelikle insana bırakır. İşçi `mesaj.uyari` olayında çağırır.
   */
  async ajanMesajKontrolu(messageId: string): Promise<'islem_yok' | 'askiya_alindi' | 'gizlendi'> {
    const m = await this.db.message.findUnique({ where: { id: messageId }, include: { conversation: true } });
    if (m?.side !== 'satici' || !m.senderUserId || m.hiddenAt) return 'islem_yok';
    const f = m.flags as MessageFlag[];
    if (!(f.includes('kapora') && (f.includes('iban') || f.includes('odeme')))) return 'islem_yok';
    if (!(await this.rules.acik('kapora'))) return 'islem_yok';
    const var_ = await this.db.report.findFirst({
      where: { source: 'ajan', targetType: 'mesaj', targetId: m.id },
      select: { id: true },
    });
    if (var_) return 'islem_yok';
    const gunBasi = new Date(new Date().setHours(0, 0, 0, 0));
    const askiSayisi = await this.db.userSanction.count({
      where: { byAgent: true, kind: 'aski', createdAt: { gte: gunBasi } },
    });
    const aski = askiSayisi < AGENT_DAILY_SUSPENSIONS;
    const id = uuidv7();
    const accountId = m.conversation.sellerAccountId;
    await this.db.$transaction(async (tx) => {
      await tx.message.update({ where: { id: m.id }, data: { hiddenAt: new Date() } });
      const eylem = aski
        ? 'Mesajı gizledi, hesabı 24 saat askıya aldı'
        : 'Mesajı gizledi (günlük askı sınırı doldu, askı uygulanmadı)';
      await tx.report.create({
        data: {
          id,
          source: 'ajan',
          targetType: 'mesaj',
          targetId: m.id,
          targetUserId: m.senderUserId as string,
          targetAccountId: accountId,
          reason: 'kapora',
          priority: 'kritik',
          signals: f,
          agentAction: eylem,
          dueAt: new Date(Date.now() + PRIORITY_HOURS.kritik * HOUR),
        },
      });
      if (aski) {
        await tx.userSanction.create({
          data: {
            id: uuidv7(),
            userId: m.senderUserId as string,
            accountId,
            kind: 'aski',
            reportId: id,
            until: new Date(Date.now() + SUSPEND_HOURS * HOUR),
            byAgent: true,
          },
        });
      }
      await this.audit.record(
        {
          actorType: 'AGENT',
          action: 'ajan_mesaj_gizledi',
          entityType: 'report',
          entityId: id,
          after: { mesaj: m.id, aski, isaretler: f },
        },
        tx,
      );
      await this.outbox.add(tx, 'sikayet.acildi', { reportId: id });
      if (aski) await this.outbox.add(tx, 'moderasyon.ajan_aski', { reportId: id });
    });
    return aski ? 'askiya_alindi' : 'gizlendi';
  }

  // ── Konsol: kuyruk ve ayrıntı ─────────────────────────────────

  private async adlar(ids: { users: string[]; accounts: string[] }) {
    const [u, a] = await Promise.all([
      this.db.user.findMany({
        where: { id: { in: [...new Set(ids.users)] } },
        select: { id: true, firstName: true, lastName: true },
      }),
      this.db.account.findMany({
        where: { id: { in: [...new Set(ids.accounts)] } },
        select: { id: true, kind: true, gallery: { select: { displayName: true } } },
      }),
    ]);
    const kisi = new Map(u.map((x) => [x.id, shortName(x.firstName, x.lastName)]));
    const galeri = new Map(a.flatMap((x) => (x.gallery ? [[x.id, x.gallery.displayName] as const] : [])));
    return {
      kisi: (id: string | null) => (id ? (kisi.get(id) ?? 'Kullanıcı') : 'Kullanıcı'),
      hedef: (r: Pick<Report, 'targetUserId' | 'targetAccountId'>) =>
        (r.targetAccountId && galeri.get(r.targetAccountId)) || (kisi.get(r.targetUserId) ?? 'Kullanıcı'),
    };
  }

  private kaynakAd(r: Report, kisi: (id: string | null) => string) {
    return r.source === 'kullanici' ? kisi(r.reporterUserId) : r.source === 'ajan' ? 'Ajan' : 'Kural';
  }

  async queue() {
    const [acik, kapali] = await Promise.all([
      this.db.report.findMany({ where: { status: 'acik' }, orderBy: [{ dueAt: 'asc' }], take: 200 }),
      this.db.report.findMany({ where: { status: 'kapali' }, orderBy: { decidedAt: 'desc' }, take: 30 }),
    ]);
    const hepsi = [...acik, ...kapali];
    const n = await this.adlar({
      users: hepsi.flatMap((r) => [r.targetUserId, ...(r.reporterUserId ? [r.reporterUserId] : [])]),
      accounts: hepsi.flatMap((r) => (r.targetAccountId ? [r.targetAccountId] : [])),
    });
    const satir = (r: Report) => ({
      id: r.id,
      no: r.no,
      oncelik: r.priority as ReportPriority,
      oncelikAd: PRIORITY_NAMES[r.priority as ReportPriority],
      neden: REPORT_REASONS[r.reason as ReportReasonKey]?.ad ?? r.reason,
      taraf: `${this.kaynakAd(r, n.kisi)} → ${n.hedef(r)} · ${REPORT_TARGET_NAMES[r.targetType as ReportTarget].toLocaleLowerCase('tr-TR')}`,
      sonTarih: r.dueAt,
      durum: r.status,
      karar: r.decision ? DECISION_NAMES[r.decision as ModerationDecision] : null,
      ajan: r.agentAction,
    });
    const now = Date.now();
    return {
      acik: acik.map(satir),
      kapali: kapali.map(satir),
      suresiAsan: acik.filter((r) => r.dueAt.getTime() < now).length,
    };
  }

  async detail(id: string) {
    const r = await this.db.report.findUnique({ where: { id }, include: { appeals: true } });
    if (!r) throw new NotFoundException('Şikâyet bulunamadı');
    const n = await this.adlar({
      users: [r.targetUserId, ...(r.reporterUserId ? [r.reporterUserId] : [])],
      accounts: r.targetAccountId ? [r.targetAccountId] : [],
    });
    const kanit = await this.kanit(r);
    const otuz = new Date(Date.now() - WARN_WINDOW_DAYS * DAY);
    const [gecmis, aski, onay, karar] = await Promise.all([
      this.db.report.count({
        where: {
          targetUserId: r.targetUserId,
          status: 'kapali',
          decision: { in: UYGULANAN },
          reversedAt: null,
          decidedAt: { gte: otuz },
          id: { not: r.id },
        },
      }),
      this.sanctions.aktifAski(r.targetUserId, r.targetAccountId),
      r.approvalId
        ? this.db.approval.findUnique({ where: { id: r.approvalId }, select: { status: true } })
        : null,
      r.decidedByStaffId
        ? this.db.staffMember.findUnique({ where: { id: r.decidedByStaffId }, select: { name: true } })
        : null,
    ]);
    const ap = r.appeals[0];
    return {
      id: r.id,
      no: r.no,
      neden: REPORT_REASONS[r.reason as ReportReasonKey]?.ad ?? r.reason,
      oncelik: r.priority,
      hedefTur: r.targetType,
      gizleAd: HIDE_NAMES[r.targetType as ReportTarget],
      ozet: [
        `Şikâyet eden ${this.kaynakAd(r, n.kisi)}`,
        `şikâyet edilen ${n.hedef(r)}`,
        tarihSaat(r.createdAt),
        r.signals.length ? `işaretler: ${r.signals.map(flagShort).join(', ')}` : null,
      ]
        .filter(Boolean)
        .join(' · '),
      aciklama: r.note ? maskEvidence(r.note) : null,
      kanit,
      gecmis,
      ajan: r.agentAction,
      aski,
      oneri: this.oneri(r, kanit.isaretler, gecmis),
      sonTarih: r.dueAt,
      durum: r.status,
      karar: r.decision
        ? {
            karar: r.decision,
            ad: DECISION_NAMES[r.decision as ModerationDecision],
            not: r.decisionNote,
            kim: r.decidedByAgent ? 'Ajan' : (karar?.name ?? 'Çalışan'),
            zaman: r.decidedAt,
            onay: onay?.status ?? null,
            geriAlindi: r.reversedAt,
          }
        : null,
      itiraz: ap ? { id: ap.id, durum: ap.status, metin: maskEvidence(ap.text), zaman: ap.createdAt } : null,
    };
  }

  /** Kanıt: mesajda öncesi ve sonrasıyla sohbet kesiti, talep ve araçta başlık ve açıklama; hepsi maskeli */
  private async kanit(r: Report) {
    if (r.targetType === 'mesaj') {
      const m = await this.db.message.findUnique({ where: { id: r.targetId } });
      if (!m) return { baslik: 'Mesaj bulunamadı', satirlar: [], isaretler: [] as string[], link: null };
      const c = await this.db.conversation.findUniqueOrThrow({
        where: { id: m.conversationId },
        include: {
          buyer: { select: { firstName: true, lastName: true } },
          sellerAccount: { select: { gallery: { select: { displayName: true } } } },
          demand: { select: { no: true, title: true, headline: true } },
        },
      });
      const satici = await this.db.user.findUnique({
        where: { id: c.sellerUserId },
        select: { firstName: true, lastName: true },
      });
      const hepsi = await this.db.message.findMany({
        where: { conversationId: c.id, kind: 'metin' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      const i = hepsi.findIndex((x) => x.id === m.id);
      const kesit = hepsi.slice(Math.max(0, i - 2), i + 3);
      return {
        baslik: c.demand
          ? `Talep No ${c.demand.no} · ${c.demand.headline ?? c.demand.title}`
          : 'Araç sohbeti',
        link: c.demand ? `${this.web}/talep/${c.demand.no}` : null,
        isaretler: m.flags,
        satirlar: kesit.map((x) => ({
          kim:
            x.side === 'alici'
              ? shortName(c.buyer.firstName, c.buyer.lastName)
              : (c.sellerAccount.gallery?.displayName ?? shortName(satici?.firstName, satici?.lastName)),
          yon: x.side === 'alici' ? 'sag' : 'sol',
          metin:
            maskEvidence(this.acik(x.body)) +
            (x.flags.length ? ` [${x.flags.map(flagShort).join(', ')} işaretlendi]` : ''),
          hedef: x.id === m.id,
          gizli: !!x.hiddenAt,
          zaman: x.createdAt,
        })),
      };
    }
    if (r.targetType === 'talep') {
      const d = await this.db.demand.findUnique({ where: { id: r.targetId } });
      if (!d) return { baslik: 'Talep bulunamadı', satirlar: [], isaretler: [] as string[], link: null };
      const aciklama = String((d.data as { alanlar?: { aciklama?: unknown } }).alanlar?.aciklama ?? '');
      return {
        baslik: `Talep No ${d.no} · ${d.headline ?? d.title}`,
        link: `${this.web}/talep/${d.no}`,
        isaretler: r.signals,
        satirlar: [
          {
            kim: 'Başlık',
            yon: 'sol',
            metin: maskEvidence(d.headline ?? d.title),
            hedef: false,
            gizli: false,
            zaman: d.createdAt,
          },
          ...(aciklama
            ? [
                {
                  kim: 'Açıklama',
                  yon: 'sol',
                  metin: maskEvidence(aciklama),
                  hedef: true,
                  gizli: false,
                  zaman: d.updatedAt,
                },
              ]
            : []),
        ],
      };
    }
    const v = await this.db.portfolioVehicle.findUnique({ where: { id: r.targetId } });
    if (!v) return { baslik: 'Araç bulunamadı', satirlar: [], isaretler: [] as string[], link: null };
    return {
      baslik: `Araç No ${v.no}`,
      link: `${this.web}/arac/${v.no}`,
      isaretler: r.signals,
      satirlar: v.description
        ? [
            {
              kim: 'Açıklama',
              yon: 'sol',
              metin: maskEvidence(v.description),
              hedef: true,
              gizli: false,
              zaman: v.updatedAt,
            },
          ]
        : [],
    };
  }

  /**
   * Kural önerisi: işaretler ve son 30 günün geçmişiyle. Yapay zekâ değerlendirmesi (güven oranıyla) Rengarenk Ajanı
   * gelince eklenecek (Karar 41).
   */
  private oneri(
    r: Report,
    isaretler: string[],
    gecmis: number,
  ): { karar: ModerationDecision; metin: string } {
    const kapora =
      isaretler.includes('kapora') && (isaretler.includes('iban') || isaretler.includes('odeme'));
    if (kapora && gecmis >= 2)
      return {
        karar: 'engel',
        metin: `Kalıcı engelleme öner · son 30 günde ${gecmis + 1}. ihlal, mesajda kapora ve ödeme isteği var.`,
      };
    if (kapora) return { karar: 'aski', metin: '24 saat askı · mesajda kapora ve ödeme isteği var.' };
    if (r.reason === 'sahte' || r.reason === 'yanlis_kategori' || r.reason === 'spam')
      return {
        karar: 'gizle',
        metin: `${HIDE_NAMES[r.targetType as ReportTarget]} · ${REPORT_REASONS[r.reason as ReportReasonKey].ad.toLocaleLowerCase('tr-TR')}.`,
      };
    if (r.reason === 'yasakli_kelime')
      return {
        karar: 'uyari',
        metin: `Metni oku: yasaklı kelime (${r.signals.join(', ')}) bağlamında zararsız olabilir.`,
      };
    if (gecmis >= 1) return { karar: 'aski', metin: `24 saat askı · son 30 günde ${gecmis} karar daha var.` };
    if (!isaretler.length && r.priority !== 'kritik')
      return { karar: 'uyari', metin: 'Uyarı · ilk ihlal; kanıtı okuyup karar ver.' };
    return { karar: 'uyari', metin: 'Uyarı · kanıtta açık bir işaret yok; metni okuyup karar ver.' };
  }

  // ── Karar ─────────────────────────────────────────────────────

  async decide(ctx: ModeratorCtx, id: string, b: { karar: ModerationDecision; not?: string }, ip?: string) {
    const perm = DECISION_PERMISSION[b.karar];
    const level = ctx.grants[perm];
    if (b.karar === 'engel' ? level !== 'tam' && level !== 'oneri' : level !== 'tam') {
      throw new ForbiddenException('Bu karar için yetkin yok');
    }
    const r = await this.db.report.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Şikâyet bulunamadı');
    if (r.status !== 'acik') throw new ConflictException('Şikâyet zaten karara bağlandı');
    const now = new Date();
    await this.db.$transaction(async (tx) => {
      // Aynı şikâyete eşzamanlı iki karar yazılmasın
      const kilit = await tx.report.updateMany({
        where: { id, status: 'acik' },
        data: {
          status: 'kapali',
          decision: b.karar,
          decisionNote: b.not || null,
          decidedByStaffId: ctx.staff.id,
          decidedAt: now,
        },
      });
      if (!kilit.count) throw new ConflictException('Şikâyet zaten karara bağlandı');
      const yaptirim = (kind: 'uyari' | 'aski', until: Date | null, approvalId?: string) =>
        tx.userSanction.create({
          data: {
            id: uuidv7(),
            userId: r.targetUserId,
            accountId: r.targetAccountId,
            kind,
            reportId: r.id,
            until,
            approvalId: approvalId ?? null,
            createdByStaff: ctx.staff.id,
          },
        });
      // Aynı içeriğe açık diğer şikâyetler aynı kararla kapanır; şikâyet edenlere sonuç gider
      const digerleri = await tx.report.findMany({
        where: { targetType: r.targetType, targetId: r.targetId, status: 'acik', id: { not: r.id } },
        select: { id: true, agentAction: true },
      });
      if (digerleri.length) {
        await tx.report.updateMany({
          where: { id: { in: digerleri.map((x) => x.id) }, status: 'acik' },
          data: {
            status: 'kapali',
            decision: b.karar,
            decisionNote: b.not || null,
            decidedByStaffId: ctx.staff.id,
            decidedAt: now,
          },
        });
        for (const x of digerleri)
          await this.outbox.add(tx, 'moderasyon.karar', { reportId: x.id, yalnizcaSikayetEden: true });
      }
      // İnsan kararı ajanın geçici işlemlerinin yerine geçer: ajan askısı kalkar; red ve uyarıda gizlenen mesaj geri gelir
      if (r.agentAction || digerleri.some((x) => x.agentAction)) {
        await tx.userSanction.updateMany({
          where: { reportId: { in: [r.id, ...digerleri.map((x) => x.id)] }, byAgent: true, liftedAt: null },
          data: { liftedAt: now },
        });
        if (r.targetType === 'mesaj' && (b.karar === 'red' || b.karar === 'uyari')) {
          await tx.message.update({ where: { id: r.targetId }, data: { hiddenAt: null } });
        }
      }
      let otomatikAski = false;
      if (b.karar === 'uyari') {
        const onceki = await tx.userSanction.count({
          where: {
            userId: r.targetUserId,
            kind: 'uyari',
            liftedAt: null,
            createdAt: { gte: new Date(now.getTime() - WARN_WINDOW_DAYS * DAY) },
          },
        });
        await yaptirim('uyari', null);
        if (onceki >= 1) {
          otomatikAski = true;
          await yaptirim('aski', new Date(now.getTime() + SUSPEND_HOURS * HOUR));
        }
      } else if (b.karar === 'gizle') {
        await this.gizle(tx, r);
      } else if (b.karar === 'aski') {
        await yaptirim('aski', new Date(now.getTime() + SUSPEND_HOURS * HOUR));
      } else if (b.karar === 'engel') {
        const onay = await this.approvals.request(
          ctx,
          {
            kind: 'PERMANENT_BAN',
            subjectType: 'user',
            subjectId: r.targetUserId,
            title: `Kalıcı engelleme · şikâyet S-${r.no}`,
            reason: (b.not || REPORT_REASONS[r.reason as ReportReasonKey]?.ad || r.reason).slice(0, 1000),
            payload: { userId: r.targetUserId, accountId: r.targetAccountId, reportId: r.id },
          },
          tx,
          ip,
        );
        await tx.report.update({ where: { id }, data: { approvalId: onay.id } });
        await yaptirim('aski', null, onay.id);
      }
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: ctx.staff.id,
          action: 'sikayet_karari',
          entityType: 'report',
          entityId: r.id,
          before: { durum: 'acik' },
          after: { karar: b.karar, otomatikAski },
          ip,
        },
        tx,
      );
      await this.outbox.add(tx, 'moderasyon.karar', { reportId: r.id });
    });
    return this.detail(id);
  }

  /** İçeriği yayından kaldırır: mesaj gizlenir; talep ve araç pasife düşer, arama ve eşleşmeden çıkar */
  private async gizle(tx: Tx, r: Report) {
    const now = new Date();
    if (r.targetType === 'mesaj') {
      await tx.message.update({ where: { id: r.targetId }, data: { hiddenAt: now } });
    } else if (r.targetType === 'talep') {
      const d = await tx.demand.findUniqueOrThrow({ where: { id: r.targetId }, select: { status: true } });
      if (d.status === 'PUBLISHED') {
        await tx.demand.update({
          where: { id: r.targetId },
          data: { status: 'PASSIVE', passiveAt: now, passiveReason: 'moderasyon' },
        });
        await this.outbox.add(tx, 'talep.pasife_alindi', { demandId: r.targetId });
      }
    } else {
      const v = await tx.portfolioVehicle.findUniqueOrThrow({
        where: { id: r.targetId },
        select: { status: true },
      });
      await tx.portfolioVehicle.update({
        where: { id: r.targetId },
        data: {
          moderatedAt: now,
          ...(v.status === 'PUBLISHED' ? { status: 'PASSIVE', passiveAt: now } : {}),
        },
      });
      if (v.status === 'PUBLISHED') await this.outbox.add(tx, 'portfoy.kalkti', { vehicleId: r.targetId });
    }
  }

  /** İtiraz kabul: gizleme geri alınır; süresi dolmamış talep yeniden yayına girer, araç galerinin kararına kalır */
  private async geriAl(tx: Tx, r: Report) {
    if (r.targetType === 'mesaj') {
      await tx.message.update({ where: { id: r.targetId }, data: { hiddenAt: null } });
    } else if (r.targetType === 'talep') {
      const d = await tx.demand.findUniqueOrThrow({
        where: { id: r.targetId },
        select: { status: true, passiveReason: true, expiresAt: true },
      });
      if (d.status === 'PASSIVE' && d.passiveReason === 'moderasyon') {
        const yayin = !!d.expiresAt && d.expiresAt > new Date();
        await tx.demand.update({
          where: { id: r.targetId },
          data: yayin
            ? { status: 'PUBLISHED', passiveAt: null, passiveReason: null }
            : { passiveReason: 'sure_doldu' },
        });
        if (yayin) await this.outbox.add(tx, 'talep.yayinlandi', { demandId: r.targetId });
      }
    } else {
      await tx.portfolioVehicle.update({ where: { id: r.targetId }, data: { moderatedAt: null } });
    }
  }

  /** Onaylanan kalıcı engelleme (işçi, onay yürütücü): hesap kapanır, oturumlar düşer, yayındaki talepler kalkar */
  private async banApproved(p: BanPayload, approvalId: string, tx: Tx): Promise<Prisma.InputJsonValue> {
    const now = new Date();
    // Onay beklerken itiraz kabul edildiyse engelleme uygulanmaz
    const r = await tx.report.findUnique({ where: { id: p.reportId }, select: { reversedAt: true } });
    if (r?.reversedAt) return { atlandi: 'itiraz kabul edildi' };
    await tx.user.update({ where: { id: p.userId }, data: { status: 'SUSPENDED' } });
    const oturum = await tx.session.updateMany({
      where: { userId: p.userId, revokedAt: null },
      data: { revokedAt: now },
    });
    const talepler = await tx.demand.findMany({
      where: { userId: p.userId, status: 'PUBLISHED' },
      select: { id: true },
    });
    for (const d of talepler) {
      await tx.demand.update({
        where: { id: d.id },
        data: { status: 'PASSIVE', passiveAt: now, passiveReason: 'moderasyon' },
      });
      await this.outbox.add(tx, 'talep.pasife_alindi', { demandId: d.id });
    }
    // Galeri sahibiyse galeri hesabı da askıya alınır
    let galeri = false;
    if (p.accountId) {
      const uye = await tx.accountMember.findUnique({
        where: { accountId_userId: { accountId: p.accountId, userId: p.userId } },
        select: { role: true, account: { select: { kind: true } } },
      });
      if (uye?.role === 'OWNER' && uye.account.kind === 'BUSINESS') {
        await tx.account.update({ where: { id: p.accountId }, data: { status: 'SUSPENDED' } });
        galeri = true;
      }
    }
    await tx.userSanction.create({
      data: {
        id: uuidv7(),
        userId: p.userId,
        accountId: p.accountId,
        kind: 'engel',
        reportId: p.reportId,
        approvalId,
      },
    });
    return { oturum: oturum.count, talep: talepler.length, galeri };
  }

  // ── İtiraz ────────────────────────────────────────────────────

  /** Kişinin hakkındaki karar (bildirimdeki bağlantı): yalnızca şikâyet edilen görür; reddedilen şikâyet gösterilmez */
  async myDecision(userId: string, id: string) {
    const r = await this.db.report.findUnique({ where: { id }, include: { appeals: true } });
    if (!r || r.targetUserId !== userId || r.status !== 'kapali' || r.decision === 'red') {
      throw new NotFoundException('Karar bulunamadı');
    }
    const aski = await this.db.userSanction.findFirst({
      where: { reportId: r.id, kind: 'aski', liftedAt: null },
      select: { until: true },
    });
    const sonGun = new Date((r.decidedAt as Date).getTime() + APPEAL_DAYS * DAY);
    const ap = r.appeals[0];
    const karar = r.decision as ModerationDecision;
    return {
      id: r.id,
      no: r.no,
      karar,
      kararAd: karar === 'gizle' ? HIDE_NAMES[r.targetType as ReportTarget] : DECISION_NAMES[karar],
      aciklama: DECISION_NOTES[karar],
      gerekce: r.decisionNote ?? REPORT_REASONS[r.reason as ReportReasonKey]?.ad ?? '',
      hedef: REPORT_TARGET_NAMES[r.targetType as ReportTarget],
      tarih: r.decidedAt,
      aski: aski ? { until: aski.until } : null,
      geriAlindi: r.reversedAt,
      itirazSonu: sonGun,
      itirazEdebilir: !ap && !r.reversedAt && sonGun > new Date(),
      itiraz: ap
        ? {
            durum: ap.status,
            metin: ap.text,
            sonuc: ap.decisionNote,
            zaman: ap.createdAt,
            karar: ap.decidedAt,
          }
        : null,
    };
  }

  async appeal(userId: string, id: string, metin: string, ip?: string) {
    const d = await this.myDecision(userId, id);
    if (!d.itirazEdebilir) throw new ConflictException('Bu karara itiraz süresi doldu ya da itiraz edildi');
    const aid = uuidv7();
    await this.db.$transaction(async (tx) => {
      await tx.reportAppeal.create({ data: { id: aid, reportId: id, userId, text: metin } });
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: userId,
          action: 'itiraz_acildi',
          entityType: 'report',
          entityId: id,
          ip,
        },
        tx,
      );
      await this.outbox.add(tx, 'itiraz.acildi', { appealId: aid });
    });
    return this.myDecision(userId, id);
  }

  async appeals() {
    const rows = await this.db.reportAppeal.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      where: { OR: [{ status: 'acik' }, { decidedAt: { gte: new Date(Date.now() - 30 * DAY) } }] },
      include: { report: true },
      take: 100,
    });
    const n = await this.adlar({
      users: rows.map((a) => a.userId),
      accounts: rows.flatMap((a) => (a.report.targetAccountId ? [a.report.targetAccountId] : [])),
    });
    const kisiler = await this.db.staffMember.findMany({
      where: {
        id: {
          in: rows
            .flatMap((a) => [a.report.decidedByStaffId, a.decidedByStaffId])
            .filter(Boolean) as string[],
        },
      },
      select: { id: true, name: true },
    });
    const ad = new Map(kisiler.map((k) => [k.id, k.name]));
    return rows.map((a) => ({
      id: a.id,
      raporId: a.reportId,
      no: a.report.no,
      ad: `${n.hedef(a.report)} · ${DECISION_NAMES[a.report.decision as ModerationDecision]} kararına itiraz`,
      metin: maskEvidence(a.text),
      ilkKarar: a.report.decidedByAgent ? 'Ajan' : (ad.get(a.report.decidedByStaffId ?? '') ?? 'Çalışan'),
      ilkKararId: a.report.decidedByStaffId,
      durum: a.status,
      sonuc: a.decisionNote,
      inceleyen: a.decidedByStaffId ? (ad.get(a.decidedByStaffId) ?? 'Çalışan') : null,
      zaman: a.createdAt,
    }));
  }

  /** İtirazı ilk kararı veren dışında bir moderatör inceler (Karar 53); kabulde yaptırım kalkar, içerik geri gelir */
  async decideAppeal(ctx: ModeratorCtx, id: string, b: { kabul: boolean; not?: string }, ip?: string) {
    const a = await this.db.reportAppeal.findUnique({ where: { id }, include: { report: true } });
    if (!a) throw new NotFoundException('İtiraz bulunamadı');
    if (a.status !== 'acik') throw new ConflictException('İtiraz zaten sonuçlandı');
    if (!a.report.decidedByAgent && a.report.decidedByStaffId === ctx.staff.id) {
      throw new ForbiddenException('İlk kararı veren bu itirazı inceleyemez');
    }
    const now = new Date();
    await this.db.$transaction(async (tx) => {
      const k = await tx.reportAppeal.updateMany({
        where: { id, status: 'acik' },
        data: {
          status: b.kabul ? 'kabul' : 'red',
          decidedByStaffId: ctx.staff.id,
          decisionNote: b.not || null,
          decidedAt: now,
        },
      });
      if (!k.count) throw new ConflictException('İtiraz zaten sonuçlandı');
      if (b.kabul) {
        await tx.userSanction.updateMany({
          where: { reportId: a.reportId, liftedAt: null },
          data: { liftedAt: now },
        });
        await tx.report.update({ where: { id: a.reportId }, data: { reversedAt: now } });
        if (a.report.decision === 'gizle') await this.geriAl(tx, a.report);
      }
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: ctx.staff.id,
          action: b.kabul ? 'itiraz_kabul' : 'itiraz_red',
          entityType: 'report',
          entityId: a.reportId,
          ip,
        },
        tx,
      );
      await this.outbox.add(tx, 'moderasyon.itiraz_sonuc', { appealId: id });
    });
    return this.appeals();
  }

  // ── Filtreler ve yasaklı kelimeler ────────────────────────────

  async filters() {
    const { filtre, kelimeler } = await this.rules.filtreler();
    return {
      filtreler: CONTENT_FILTER_KEYS.map((k) => ({
        key: k,
        ad: CONTENT_FILTERS[k].ad,
        not: CONTENT_FILTERS[k].not,
        acik: filtre.get(k) ?? true,
      })),
      kelimeler,
    };
  }

  async setFilter(staffId: string, key: string, acik: boolean, ip?: string) {
    if (!(CONTENT_FILTER_KEYS as string[]).includes(key)) throw new NotFoundException('Filtre bulunamadı');
    await this.db.$transaction(async (tx) => {
      await tx.contentFilter.upsert({
        where: { key },
        create: { key, enabled: acik, updatedBy: staffId },
        update: { enabled: acik, updatedBy: staffId },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: acik ? 'filtre_acildi' : 'filtre_kapandi',
          entityType: 'content_filter',
          entityId: key,
          ip,
        },
        tx,
      );
    });
    this.rules.temizle();
    return this.filters();
  }

  async addWord(staffId: string, kelime: string, ip?: string) {
    const w = kelime.trim();
    await this.db.$transaction(async (tx) => {
      await tx.bannedWord.upsert({ where: { word: w }, create: { word: w, createdBy: staffId }, update: {} });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'yasakli_kelime_eklendi',
          entityType: 'banned_word',
          entityId: w,
          ip,
        },
        tx,
      );
    });
    this.rules.temizle();
    return this.filters();
  }

  async removeWord(staffId: string, kelime: string, ip?: string) {
    await this.db.$transaction(async (tx) => {
      const r = await tx.bannedWord.deleteMany({ where: { word: kelime } });
      if (!r.count) throw new NotFoundException('Kelime bulunamadı');
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'yasakli_kelime_kaldirildi',
          entityType: 'banned_word',
          entityId: kelime,
          ip,
        },
        tx,
      );
    });
    this.rules.temizle();
    return this.filters();
  }
}

interface BanPayload {
  userId: string;
  accountId: string | null;
  reportId: string;
}
