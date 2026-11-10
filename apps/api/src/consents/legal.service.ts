import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
  Optional,
} from '@nestjs/common';
import { type Approval, type ConsentText, type Prisma, uuidv7 } from '@rengarenk/db';
import {
  LEGAL_KEY_LIST,
  LEGAL_TEXTS,
  type LegalDraftInput,
  type LegalKey,
  legalDiff,
  legalDiffSummary,
  type PendingLegal,
  RECONSENT_OPTIONAL,
  RECONSENT_REQUIRED,
} from '@rengarenk/shared';
import { AdsService } from '../ads/ads.service.js';
import { type Actor, ApprovalService } from '../approvals/approval.service.js';
import { ApprovalExecutor } from '../approvals/approval-executor.js';
import { AuditService } from '../audit/audit.service.js';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { type Channel, ConsentService } from './consent.service.js';

const SUBJECT = 'consent_text';
const tarih = (d: Date) =>
  new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Istanbul',
  }).format(d);

/**
 * Yasal metinlerin konsoldan yönetimi ve yeniden onay (Karar 46, 59; YonetimIcerik.dc.html › Yardım ve yasal metinler).
 * Taslak düzenlenir, önceki sürümle karşılaştırılır, yayına sahip onayıyla girer (LEGAL_TEXT). Yayınlanmış ve
 * kullanıcıların onayladığı metin değişmez (RR041, RR042): düzenleme yeni taslak sürüm açar. Esaslı değişiklikte
 * kullanıcılara bildirim gider ve bir sonraki girişte yeni sürüm onaylatılır.
 */
@Injectable()
export class LegalService implements OnModuleInit {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly consents: ConsentService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    @Optional() private readonly approvals?: ApprovalService,
    @Optional() private readonly executor?: ApprovalExecutor,
    @Optional() private readonly ads?: AdsService,
  ) {}

  onModuleInit() {
    this.executor?.register('LEGAL_TEXT', (a, tx) => this.publishApproved(a, tx), SUBJECT);
  }

  // ── Konsol ─────────────────────────────────────────────────

  /** Metin listesi: yayındaki sürüm, onaylayan sayısı, taslak ve onay durumu */
  async staffList() {
    const rows = await this.db.consentText.findMany({ orderBy: [{ key: 'asc' }, { version: 'desc' }] });
    const sayilar = await this.db.consent.groupBy({
      by: ['textKey', 'textVersion'],
      where: { granted: true, userId: { not: null }, textKey: { not: null } },
      _count: { _all: true },
    });
    const sayi = (key: string, v: number) =>
      sayilar.find((s) => s.textKey === key && s.textVersion === v)?._count._all ?? 0;
    const onaylar = await this.bekleyenOnaylar(rows);
    return LEGAL_KEY_LIST.map((key) => {
      const list = rows.filter((r) => r.key === key);
      const yayinda = list.find((r) => r.status === 'yayinda') ?? null;
      const taslak =
        list.find((r) => r.status === 'taslak' && (!yayinda || r.version > yayinda.version)) ?? null;
      return {
        key,
        ad: LEGAL_TEXTS[key].ad,
        kullanim: LEGAL_TEXTS[key].kullanim,
        yayinda: yayinda
          ? {
              version: yayinda.version,
              publishedAt: yayinda.publishedAt,
              tarih: yayinda.publishedAt ? tarih(yayinda.publishedAt) : null,
              onaylayan: sayi(key, yayinda.version),
            }
          : null,
        taslak: taslak
          ? {
              version: taslak.version,
              material: taslak.material,
              not: taslak.changeNote,
              onaylayan: sayi(key, taslak.version),
              onayda: Boolean(taslak.approvalId && onaylar.has(taslak.approvalId)),
              guncelleme: tarih(taslak.createdAt),
            }
          : null,
      };
    });
  }

  private async bekleyenOnaylar(rows: ConsentText[]) {
    const ids = rows.map((r) => r.approvalId).filter((x): x is string => Boolean(x));
    if (!ids.length) return new Set<string>();
    const a = await this.db.approval.findMany({
      where: { id: { in: ids }, status: 'PENDING' },
      select: { id: true },
    });
    return new Set(a.map((x) => x.id));
  }

  /** Bir metnin yayındaki ve taslak sürümü, aralarındaki fark */
  async staffDetail(key: LegalKey, karsilastir?: number) {
    const list = await this.db.consentText.findMany({ where: { key }, orderBy: { version: 'desc' } });
    const yayinda = list.find((r) => r.status === 'yayinda') ?? null;
    const taslak =
      list.find((r) => r.status === 'taslak' && (!yayinda || r.version > yayinda.version)) ?? null;
    const yeni = taslak ?? yayinda;
    const eski = karsilastir
      ? (list.find((r) => r.version === karsilastir) ?? null)
      : taslak && yayinda
        ? yayinda
        : (list.find((r) => yeni && r.version < yeni.version) ?? null);
    const fark = yeni && eski ? legalDiff(eski.body, yeni.body) : [];
    const onayda = taslak?.approvalId ? (await this.bekleyenOnaylar([taslak])).has(taslak.approvalId) : false;
    const onaylayan = taslak
      ? await this.db.consent.count({ where: { textKey: key, textVersion: taslak.version } })
      : 0;
    return {
      key,
      ad: LEGAL_TEXTS[key].ad,
      surumler: list.map((r) => ({
        version: r.version,
        status: r.status,
        material: r.material,
        tarih: tarih(r.publishedAt ?? r.createdAt),
      })),
      yayinda: yayinda && {
        version: yayinda.version,
        title: yayinda.title,
        body: yayinda.body,
        publishedAt: yayinda.publishedAt,
      },
      taslak: taslak && {
        version: taslak.version,
        title: taslak.title,
        body: taslak.body,
        material: taslak.material,
        not: taslak.changeNote,
        onayda,
        // Kullanıcılar bu taslağı onayladıysa düzenleme yeni sürüm açar (RR042)
        kilitli: onaylayan > 0,
      },
      fark: {
        eski: eski?.version ?? null,
        yeni: yeni?.version ?? null,
        satirlar: fark,
        ozet: legalDiffSummary(fark),
      },
    };
  }

  /**
   * Taslağı kaydeder. Taslak yoksa, onaydaysa ya da kullanıcılar onu onayladıysa yeni taslak sürüm açılır; yoksa taslak
   * yerinde güncellenir. Yayınlanmış metin hiç değişmez.
   */
  async saveDraft(actor: Actor, key: LegalKey, d: LegalDraftInput, ip?: string) {
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`rr_yasal_${key}`}))`;
      const son = await tx.consentText.findFirst({ where: { key }, orderBy: { version: 'desc' } });
      const yerinde =
        son?.status === 'taslak' &&
        !(son.approvalId && (await this.bekleyenOnaylar([son])).size) &&
        (await tx.consent.count({ where: { textKey: key, textVersion: son.version } })) === 0;
      if (son && son.title === d.title && son.body === d.body && son.material === d.material && yerinde) {
        if ((son.changeNote ?? '') === (d.not ?? ''))
          throw new BadRequestException('Taslakta değişiklik yok');
      }
      let version: number;
      if (yerinde && son) {
        await tx.consentText.update({
          where: { id: son.id },
          data: {
            title: d.title,
            body: d.body,
            material: d.material,
            changeNote: d.not ?? null,
            approvalId: null,
          },
        });
        version = son.version;
      } else {
        version = (son?.version ?? 0) + 1;
        await tx.consentText.create({
          data: {
            id: uuidv7(),
            key,
            version,
            title: d.title,
            body: d.body,
            status: 'taslak',
            material: d.material,
            changeNote: d.not ?? null,
            createdBy: actor.staff.id,
          },
        });
      }
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: actor.staff.id,
          action: 'yasal_taslak_kaydedildi',
          entityType: 'consent_text',
          entityId: key,
          after: { surum: version, esasli: d.material, yeniSurum: !yerinde },
          ip,
        },
        tx,
      );
      return { version };
    });
  }

  /** Taslağı sahip onayına gönderir (LEGAL_TEXT). Esaslı değişiklik onay isteğinde yazılır. */
  async submit(actor: Actor, key: LegalKey, ip?: string) {
    if (!this.approvals) throw new ConflictException('Onay motoru yok');
    const approvals = this.approvals;
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`rr_yasal_${key}`}))`;
      const list = await tx.consentText.findMany({ where: { key }, orderBy: { version: 'desc' } });
      const yayinda = list.find((r) => r.status === 'yayinda') ?? null;
      const taslak = list.find((r) => r.status === 'taslak' && (!yayinda || r.version > yayinda.version));
      if (!taslak) throw new BadRequestException('Gönderilecek taslak yok');
      if (taslak.approvalId && (await this.bekleyenOnaylar([taslak])).size)
        throw new ConflictException('Taslak zaten onayda');
      const fark = yayinda ? legalDiff(yayinda.body, taslak.body) : [];
      if (yayinda && !fark.length && yayinda.title === taslak.title)
        throw new BadRequestException('Yayındaki metinle aynı');
      const ozet = yayinda ? legalDiffSummary(fark) : 'İlk yayın';
      const approval = await approvals.request(
        actor,
        {
          kind: 'LEGAL_TEXT',
          subjectType: SUBJECT,
          subjectId: taslak.id,
          title: `${LEGAL_TEXTS[key].ad} s.${taslak.version}${taslak.material ? ' · esaslı değişiklik' : ''}`,
          reason: [taslak.changeNote, ozet].filter(Boolean).join(' · ').slice(0, 1000),
          payload: {
            key,
            version: taslak.version,
            onceki: yayinda?.version ?? null,
            esasli: taslak.material,
            ozet,
          },
        },
        tx,
        ip,
      );
      await tx.consentText.update({ where: { id: taslak.id }, data: { approvalId: approval.id } });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: actor.staff.id,
          action: 'yasal_yayina_gonderildi',
          entityType: 'consent_text',
          entityId: key,
          after: { surum: taslak.version, onay: approval.id, esasli: taslak.material },
          ip,
        },
        tx,
      );
      return { version: taslak.version, approvalId: approval.id };
    });
  }

  /** Onaylanan sürümü yayına alır (onay yürütücüsü). Önceki yayın "eski" olur; esaslıysa kullanıcılara bildirim. */
  async publishApproved(a: Approval, tx: Tx): Promise<Prisma.InputJsonValue> {
    if (a.subjectType !== SUBJECT) throw new Error('Yasal metin onayı değil');
    const t = await tx.consentText.findUnique({ where: { id: a.subjectId } });
    if (!t) throw new Error('Yasal metin bulunamadı');
    if (t.status === 'yayinda' && t.approvalId === a.id) return { surum: t.version, durum: 'zaten_yayinda' };
    if (t.status !== 'taslak' || t.approvalId !== a.id) throw new Error('Taslak bu onayı beklemiyor');
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`rr_yasal_${t.key}`}))`;
    const once = await tx.consentText.findFirst({ where: { key: t.key, status: 'yayinda' } });
    if (once && once.version > t.version) throw new Error('Daha yeni bir sürüm yayında');
    await tx.consentText.updateMany({ where: { key: t.key, status: 'yayinda' }, data: { status: 'eski' } });
    const now = new Date();
    await tx.consentText.update({
      where: { id: t.id },
      data: { status: 'yayinda', publishedAt: now, publishedBy: a.decidedBy },
    });
    await this.audit.record(
      {
        actorType: 'STAFF',
        actorId: a.decidedBy ?? a.requestedBy,
        action: 'yasal_yayinlandi',
        entityType: 'consent_text',
        entityId: t.key,
        before: once ? { surum: once.version } : undefined,
        after: { surum: t.version, esasli: t.material, onay: a.id },
      },
      tx,
    );
    if (t.material) await this.outbox.add(tx, 'yasal.guncellendi', { key: t.key, version: t.version });
    return { surum: t.version, esasli: t.material };
  }

  // ── Kullanıcı: bir sonraki girişte yeniden onay ──────────────────

  /**
   * Kullanıcının yeniden onaylaması gereken metinler: son onayladığı sürümden sonra esaslı bir sürüm yayınlanmışsa.
   * Zorunlu metinler herkese (galeri sözleşmesi yalnızca galeri sahibi ve yöneticisine); isteğe bağlı rızalar yalnızca
   * daha önce onay verdiyse.
   */
  async pending(userId: string): Promise<PendingLegal[]> {
    const yayinda = await this.db.consentText.findMany({ where: { status: 'yayinda' } });
    if (!yayinda.length) return [];
    const esasli = await this.db.consentText.findMany({
      where: { material: true, status: { in: ['yayinda', 'eski'] } },
      select: { key: true, version: true },
    });
    const son = await this.consents.latest(userId);
    const galeri = await this.db.accountMember.count({
      where: { userId, role: { in: ['OWNER', 'MANAGER'] }, account: { kind: 'BUSINESS', status: 'ACTIVE' } },
    });
    const out: PendingLegal[] = [];
    for (const key of [...RECONSENT_REQUIRED, ...RECONSENT_OPTIONAL]) {
      const t = yayinda.find((x) => x.key === key);
      if (!t) continue;
      const kayit = son[key];
      const zorunlu = RECONSENT_REQUIRED.includes(key);
      if (key === 'galeri_sozlesmesi' && (!galeri || !kayit)) continue;
      if (!zorunlu && !kayit?.granted) continue;
      const onayli = kayit?.granted ? (kayit.textVersion ?? 0) : 0;
      // Zorunlu metinde hiç kayıt yoksa (eski üyelik) ya da son onaydan sonra esaslı sürüm yayınlandıysa
      const gerekli =
        (zorunlu && !kayit?.granted) ||
        esasli.some((e) => e.key === key && e.version > onayli && e.version <= t.version);
      if (!gerekli) continue;
      const onceki = onayli
        ? await this.db.consentText.findUnique({ where: { key_version: { key, version: onayli } } })
        : null;
      out.push({
        key,
        ad: LEGAL_TEXTS[key].ad,
        version: t.version,
        title: t.title,
        zorunlu,
        ozet: onceki ? legalDiffSummary(legalDiff(onceki.body, t.body)) : 'Metnin güncel sürümü',
        onceki: zorunlu ? null : Boolean(kayit?.granted),
        publishedAt: t.publishedAt?.toISOString() ?? null,
      });
    }
    return out;
  }

  /**
   * Yeniden onay: zorunlu metin yalnızca kabul edilir; isteğe bağlı rıza bırakılırsa Ayarlar'daki yolla aynı sonuç
   * (ticari iletide kampanya bildirimleri kapanır ve İYS'ye bildirilir; reklam ölçümünde bekleyen olaylar iptal edilir).
   */
  async accept(
    userId: string,
    onaylar: { key: LegalKey; version: number; granted: boolean }[],
    channel: Channel,
    ip?: string,
  ) {
    const bekleyen = await this.pending(userId);
    for (const o of onaylar) {
      const b = bekleyen.find((x) => x.key === o.key);
      if (!b) throw new BadRequestException(`${LEGAL_TEXTS[o.key].ad} için bekleyen onay yok`);
      if (b.version !== o.version)
        throw new ConflictException('Metnin daha yeni bir sürümü yayınlandı; sayfayı yenile');
      if (b.zorunlu && !o.granted) throw new BadRequestException(`${b.ad} kabul edilmeden devam edilemez`);
    }
    const eksik = bekleyen.filter((b) => b.zorunlu && !onaylar.some((o) => o.key === b.key));
    if (eksik.length) throw new BadRequestException(`${eksik[0]?.ad} kabul edilmeli`);
    await this.db.$transaction(async (tx) => {
      for (const o of onaylar) {
        if (o.key === 'ticari_ileti' && !o.granted) {
          await tx.notificationPref.updateMany({
            where: { userId, konu: 'kampanya' },
            data: { acik: false },
          });
          await tx.outboxEvent.create({
            data: { type: 'iys.izin_degisti', payload: { userId, onay: false } },
          });
        }
        if (o.key === 'reklam_olcum' && !o.granted) await this.ads?.unut(tx, userId);
        await tx.consent.create({
          data: {
            id: uuidv7(),
            userId,
            kind: o.key,
            granted: o.granted,
            textKey: o.key,
            textVersion: o.version,
            channel,
            ip: ip ?? null,
          },
        });
      }
    });
    return this.pending(userId);
  }

  /** Esaslı değişiklik bildiriminin alıcıları: bu metni onaylamış, hesabı açık kullanıcılar (sayfa sayfa) */
  async recipients(key: string, after?: string, limit = 500) {
    const rows = await this.db.consent.findMany({
      where: { textKey: key, granted: true, userId: { not: null, ...(after ? { gt: after } : {}) } },
      distinct: ['userId'],
      orderBy: { userId: 'asc' },
      select: { userId: true },
      take: limit,
    });
    const ids = rows.map((r) => r.userId as string);
    const acik = await this.db.user.findMany({
      where: { id: { in: ids }, NOT: { phone: { startsWith: 'kapali:' } } },
      select: { id: true },
    });
    const set = new Set(acik.map((u) => u.id));
    return { ids: ids.filter((i) => set.has(i)), son: ids.at(-1) ?? null };
  }

  /** Metin bulunamazsa */
  async exists(key: LegalKey) {
    const n = await this.db.consentText.count({ where: { key } });
    if (!n) throw new NotFoundException('Metin bulunamadı');
  }
}
