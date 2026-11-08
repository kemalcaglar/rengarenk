import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type Demand, type DemandStatus, type Prisma, uuidv7 } from '@rengarenk/db';
import {
  type CategoryDefinition,
  type CategoryField,
  DEMAND_STATUS_NAMES,
  type DemandStatusKey,
  demandOwnerName,
  demandSchema,
  EXTEND_WINDOW_DAYS,
  effectiveFields,
  type FoundViaKey,
  REMINDER_DAYS,
} from '@rengarenk/shared';
import { AuditService } from '../audit/audit.service.js';
import { sha256 } from '../auth/tokens.js';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';
import { EntitlementService } from '../entitlements/entitlement.service.js';
import { type EventType, OutboxService } from '../outbox/outbox.service.js';

const DAY = 86_400_000;

type Values = Record<string, unknown>;
interface DemandData {
  alanlar: Values;
  alternatifler: Values[];
}

export interface DemandUpdate {
  kategori?: string;
  step?: number;
  data?: DemandData;
  contact?: { phoneVisible: boolean; whatsappVisible: boolean; nameMode: 'tam' | 'kisa' };
}

const range = (v: unknown) =>
  v && typeof v === 'object' ? (v as { min?: number; max?: number }) : undefined;

/** Alternatiflerdeki aralıkların en düşüğü ve en yükseği (liste ve arama sütunları). */
function span(alts: Values[], key: string) {
  const rs = alts.map((a) => range(a[key])).filter((r): r is { min?: number; max?: number } => Boolean(r));
  const mins = rs.map((r) => r.min ?? r.max).filter((x): x is number => typeof x === 'number');
  const maxs = rs.map((r) => r.max ?? r.min).filter((x): x is number => typeof x === 'number');
  return { min: mins.length ? Math.min(...mins) : null, max: maxs.length ? Math.max(...maxs) : null };
}

function invalid(issues: { path: PropertyKey[]; message: string }[]): never {
  throw new BadRequestException({
    message: issues[0]?.message ?? 'Talep eksik ya da hatalı',
    issues: issues.map((i) => ({ path: i.path.map(String).join('.'), message: i.message })),
  });
}

/**
 * Talepler (Karar 04, 05, 09, 10, 12, 21). Taslak her adımda kaydedilir; yayında şema doğrulanır ve hak
 * defterinden bir talep hakkı düşer (ilk talep telefon numarası başına ücretsiz). Süre dolunca talep silinmez,
 * pasife düşer ve uzatılabilir (ilk uzatma ücretsiz). Her durum değişikliği geçmişe, işlem kaydına ve outbox'a
 * aynı veritabanı işleminde yazılır.
 */
@Injectable()
export class DemandService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly entitlements: EntitlementService,
  ) {}

  // ── Okuma ─────────────────────────────────────────────────────

  /** Taleplerim: taslak dahil bütün talepler, durum sayılarıyla. */
  async mine(userId: string) {
    const rows = await this.db.demand.findMany({
      where: { userId },
      orderBy: [{ updatedAt: 'desc' }],
      take: 200,
      include: { category: { select: { slug: true, name: true } } },
    });
    const counts = Object.fromEntries(
      (Object.keys(DEMAND_STATUS_NAMES) as DemandStatusKey[]).map((k) => [
        k,
        rows.filter((r) => r.status === k).length,
      ]),
    );
    return { counts, items: rows.map((d) => this.summary(d)) };
  }

  /** Sahibin gördüğü talep: taslağın verisi, şeması ve yapılabilecek işler. */
  async ownerDetail(userId: string, id: string) {
    const d = await this.own(userId, id);
    const category = await this.db.category.findUniqueOrThrow({ where: { id: d.categoryId } });
    const version = d.schemaVersion ?? category.publishedVersion;
    const def = version ? await this.definition(d.categoryId, version) : null;
    return {
      ...this.summary({ ...d, category }),
      data: d.data,
      step: d.step,
      contact: { phoneVisible: d.phoneVisible, whatsappVisible: d.whatsappVisible, nameMode: d.nameMode },
      schema: def && { version, fields: effectiveFields(def), rules: def.rules },
      actions: this.actions(d),
    };
  }

  /** Herkese açık talep sayfası. Telefon yalnızca izin verildiyse ve giriş yapmış kullanıcıya görünür (Karar 11.4). */
  async publicDetail(no: number, viewerUserId?: string) {
    const d = await this.db.demand.findUnique({
      where: { no: BigInt(no) },
      include: {
        category: { select: { slug: true, name: true } },
        user: { select: { firstName: true, lastName: true, phone: true } },
      },
    });
    if (!d || d.status === 'DRAFT') throw new NotFoundException('Talep bulunamadı');
    const def = await this.definition(d.categoryId, d.schemaVersion as number);
    const data = d.data as unknown as DemandData;
    const showPhone = d.status === 'PUBLISHED' && d.phoneVisible && Boolean(viewerUserId);
    return {
      ...this.summary(d),
      data: { ...data, alanlar: data.alanlar },
      schema: { version: d.schemaVersion, fields: effectiveFields(def), rules: def.rules },
      owner: {
        name: demandOwnerName(d.user.firstName, d.user.lastName, d.nameMode as 'tam' | 'kisa'),
        isYou: viewerUserId === d.userId,
        phone: showPhone ? d.user.phone : null,
        phoneHidden: d.phoneVisible && !viewerUserId,
        whatsapp: showPhone && d.whatsappVisible,
      },
    };
  }

  // ── Taslak ────────────────────────────────────────────────────

  async create(userId: string, kategori: string) {
    const accountId = await this.accountOf(userId);
    const category = await this.leafCategory(kategori);
    return this.db.$transaction(async (tx) => {
      const d = await tx.demand.create({
        data: {
          id: uuidv7(),
          accountId,
          userId,
          categoryId: category.id,
          step: 2,
          data: { alanlar: {}, alternatifler: [{}] },
        },
        include: { category: { select: { slug: true, name: true } } },
      });
      await this.event(tx, d.id, 'olusturuldu', userId, { kategori: category.slug });
      return this.summary(d);
    });
  }

  /**
   * Taslağı kaydeder (yarım veri kabul edilir). Yayındaki ya da pasif talepte bu "Düzenle"dir: veri, talebin
   * yayına girdiği şema sürümüyle eksiksiz doğrulanır; talep yayında kalır (Karar 09).
   */
  async update(userId: string, id: string, input: DemandUpdate, ip?: string) {
    const d = await this.own(userId, id);
    if (d.status === 'CLOSED' || d.status === 'COMPLETED')
      throw new ConflictException('Kapanmış talep düzenlenemez');
    if (d.status === 'DRAFT') {
      let categoryId = d.categoryId;
      if (input.kategori) categoryId = (await this.leafCategory(input.kategori)).id;
      const changedCategory = categoryId !== d.categoryId;
      const updated = await this.db.demand.update({
        where: { id },
        data: {
          categoryId,
          ...(input.step ? { step: input.step } : {}),
          // Kategori değişince eski kategorinin alanları anlamsızdır.
          ...(changedCategory ? { data: { alanlar: {}, alternatifler: [{}] } } : {}),
          ...(input.data && !changedCategory ? { data: input.data as unknown as Prisma.InputJsonValue } : {}),
          ...(input.contact ?? {}),
        },
        include: { category: { select: { slug: true, name: true } } },
      });
      return this.summary(updated);
    }
    if (input.kategori) throw new BadRequestException('Yayındaki talebin kategorisi değiştirilemez');
    const def = await this.definition(d.categoryId, d.schemaVersion as number);
    const data = input.data ? await this.validate(def, input.data) : (d.data as unknown as DemandData);
    return this.db.$transaction(async (tx) => {
      const cols = input.data ? await this.columns(tx, def, data) : {};
      const updated = await tx.demand.update({
        where: { id },
        data: {
          ...cols,
          ...(input.data ? { data: data as unknown as Prisma.InputJsonValue } : {}),
          ...(input.contact ?? {}),
        },
        include: { category: { select: { slug: true, name: true } } },
      });
      await this.transition(tx, updated, userId, 'duzenlendi', 'talep.guncellendi', ip);
      return this.summary(updated);
    });
  }

  // ── Yayın ve yaşam döngüsü ───────────────────────────────────

  /** Taslağı yayınlar: şema doğrulanır, bir talep hakkı düşer, bitiş tarihi kurallardan hesaplanır. */
  async publish(userId: string, id: string, ip?: string) {
    const d = await this.own(userId, id);
    if (d.status !== 'DRAFT') throw new ConflictException('Talep zaten yayına girmiş');
    const category = await this.db.category.findUniqueOrThrow({ where: { id: d.categoryId } });
    if (!category.enabled || !category.publishedVersion)
      throw new ConflictException('Bu kategori şu an kapalı');
    const def = await this.definition(category.id, category.publishedVersion);
    const data = await this.validate(def, d.data as unknown as DemandData);
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { phone: true } });
    if (this.expiry(def, data, new Date()).getTime() - Date.now() < 3600_000) {
      throw new BadRequestException('Alış tarihi en az bir saat sonrası olmalı');
    }
    return this.db.$transaction(async (tx) => {
      // İlk talep telefon numarası başına ücretsiz; yeni hesap açmak hakkı yenilemez (Karar 12).
      const free = await tx.entitlementLedger.createMany({
        data: [
          {
            accountId: d.accountId,
            kind: 'talep',
            delta: 1,
            reason: 'tanimlama',
            sourceType: 'ucretsiz_talep',
            sourceId: sha256(`rr-ucretsiz-talep:${user.phone}`),
            createdBy: userId,
          },
        ],
        skipDuplicates: true,
      });
      await this.entitlements.consume(tx, d.accountId, 'talep', {
        sourceType: 'demand',
        sourceId: d.id,
        createdBy: userId,
      });
      const now = new Date();
      const updated = await tx.demand.update({
        where: { id, status: 'DRAFT' },
        data: {
          ...(await this.columns(tx, def, data)),
          data: data as unknown as Prisma.InputJsonValue,
          schemaVersion: category.publishedVersion,
          status: 'PUBLISHED',
          entitlement: free.count === 1 ? 'ucretsiz' : 'ek',
          publishedAt: now,
          expiresAt: this.expiry(def, data, now),
          step: 6,
        },
        include: { category: { select: { slug: true, name: true } } },
      });
      await this.transition(tx, updated, userId, 'yayinlandi', 'talep.yayinlandi', ip);
      return this.summary(updated);
    });
  }

  /** Pasife al: talep silinmeden yayından kalkar, satıcılar yazamaz (Karar 09). */
  async passivate(userId: string, id: string, ip?: string) {
    const d = await this.own(userId, id);
    this.expect(d, ['PUBLISHED']);
    return this.change(
      d,
      userId,
      { status: 'PASSIVE', passiveAt: new Date(), passiveReason: 'kullanici' },
      'pasife_alindi',
      'talep.pasife_alindi',
      ip,
    );
  }

  /** Pasif talebi yeniden yayına alır; süresi dolduysa uzatmak gerekir. */
  async activate(userId: string, id: string, ip?: string) {
    const d = await this.own(userId, id);
    this.expect(d, ['PASSIVE']);
    if (!d.expiresAt || d.expiresAt <= new Date()) {
      throw new ConflictException('Talebin süresi doldu; yeniden yayına almak için uzat');
    }
    return this.change(
      d,
      userId,
      { status: 'PUBLISHED', passiveAt: null, passiveReason: null },
      'aktif_edildi',
      'talep.yayinlandi',
      ip,
    );
  }

  /**
   * Uzat (Karar 10, 12.1): süresi dolan ya da son 7 güne giren talep yeniden tam süre yayında kalır. İlk uzatma
   * ücretsizdir; sonrakiler için hak defterinden bir uzatma hakkı düşer (satın alma ödeme modülüyle gelir).
   */
  async extend(userId: string, id: string, ip?: string) {
    const d = await this.own(userId, id);
    this.expect(d, ['PUBLISHED', 'PASSIVE']);
    const now = new Date();
    if (
      d.status === 'PUBLISHED' &&
      d.expiresAt &&
      d.expiresAt.getTime() - now.getTime() > EXTEND_WINDOW_DAYS * DAY
    ) {
      throw new ConflictException(`Talep bitişine ${EXTEND_WINDOW_DAYS} günden az kalınca uzatılabilir`);
    }
    if (d.status === 'PASSIVE' && d.passiveReason !== 'sure_doldu' && d.expiresAt && d.expiresAt > now) {
      throw new ConflictException('Talebin süresi dolmadı; yeniden yayına alabilirsin');
    }
    const def = await this.definition(d.categoryId, d.schemaVersion as number);
    const data = d.data as unknown as DemandData;
    const expiresAt = this.expiry(def, data, now);
    if (expiresAt.getTime() - now.getTime() < DAY)
      throw new ConflictException('Alış tarihi geçtiği için talep uzatılamaz');
    return this.db.$transaction(async (tx) => {
      const free = !d.freeExtensionUsed;
      if (!free) {
        await this.entitlements.consume(tx, d.accountId, 'uzatma', {
          sourceType: 'demand_extension',
          sourceId: `${d.id}:${d.extensionCount + 1}`,
          createdBy: userId,
        });
      }
      const updated = await tx.demand.update({
        where: { id },
        data: {
          status: 'PUBLISHED',
          expiresAt,
          passiveAt: null,
          passiveReason: null,
          reminderDays: null,
          freeExtensionUsed: true,
          extensionCount: { increment: 1 },
        },
        include: { category: { select: { slug: true, name: true } } },
      });
      await this.transition(tx, updated, userId, 'uzatildi', 'talep.uzatildi', ip, {
        ucretsiz: free,
        bitis: expiresAt,
      });
      return this.summary(updated);
    });
  }

  /** Kapat: artık araç aranmıyor (Karar 09). Taslak da kapatılarak listeden kalkar. */
  async close(userId: string, id: string, ip?: string) {
    const d = await this.own(userId, id);
    this.expect(d, ['DRAFT', 'PUBLISHED', 'PASSIVE']);
    return this.change(
      d,
      userId,
      { status: 'CLOSED', closedAt: new Date() },
      'kapatildi',
      'talep.kapandi',
      ip,
    );
  }

  /** Aracı buldum: talep "tamamlandı" olarak kapanır; aracın nereden bulunduğu satıcıya gösterilmez (Karar 31). */
  async complete(userId: string, id: string, foundVia: FoundViaKey, ip?: string) {
    const d = await this.own(userId, id);
    this.expect(d, ['PUBLISHED', 'PASSIVE']);
    return this.change(
      d,
      userId,
      { status: 'COMPLETED', closedAt: new Date(), foundVia },
      'tamamlandi',
      'arac.bulundu',
      ip,
      {
        nereden: foundVia,
      },
    );
  }

  // ── İşçi ──────────────────────────────────────────────────────

  /** Süresi dolan talepler pasife düşer (silinmez); sahibine "süreyi uzat" bildirimi gider (Karar 10). */
  async expireDue(now = new Date()): Promise<number> {
    const due = await this.db.demand.findMany({
      where: { status: 'PUBLISHED', expiresAt: { lte: now } },
      take: 500,
    });
    let n = 0;
    for (const d of due) {
      await this.db.$transaction(async (tx) => {
        const r = await tx.demand.updateMany({
          where: { id: d.id, status: 'PUBLISHED', expiresAt: { lte: now } },
          data: { status: 'PASSIVE', passiveAt: now, passiveReason: 'sure_doldu' },
        });
        if (r.count !== 1) return;
        await this.event(tx, d.id, 'suresi_doldu', null);
        await this.audit.record(
          { actorType: 'SYSTEM', action: 'talep_suresi_doldu', entityType: 'demand', entityId: d.id },
          tx,
        );
        await this.outbox.add(tx, 'talep.suresi_doldu', { demandId: d.id, userId: d.userId });
        n++;
      });
    }
    return n;
  }

  /** Bitişten 7, 3 ve 1 gün önce hatırlatma olayı (bildirim katmanı iletir). Her eşik bir kez. */
  async remindDue(now = new Date()): Promise<number> {
    let n = 0;
    // En yakın eşikten başlanır: 2,5 gün kalan talebe yalnızca "3 gün" hatırlatması gider, "7 gün" atlanır.
    for (const days of [...REMINDER_DAYS].sort((a, b) => a - b)) {
      const due = await this.db.demand.findMany({
        where: {
          status: 'PUBLISHED',
          expiresAt: { gt: now, lte: new Date(now.getTime() + days * DAY) },
          OR: [{ reminderDays: null }, { reminderDays: { gt: days } }],
        },
        select: { id: true, userId: true, expiresAt: true },
        take: 500,
      });
      for (const d of due) {
        await this.db.$transaction(async (tx) => {
          const r = await tx.demand.updateMany({
            where: { id: d.id, OR: [{ reminderDays: null }, { reminderDays: { gt: days } }] },
            data: { reminderDays: days },
          });
          if (r.count !== 1) return;
          await this.event(tx, d.id, 'hatirlatma', null, { gun: days });
          await this.outbox.add(tx, 'talep.suresi_doluyor', { demandId: d.id, userId: d.userId, gun: days });
          n++;
        });
      }
    }
    return n;
  }

  // ── Yardımcılar ───────────────────────────────────────────────

  summary(d: Demand & { category: { slug: string; name: string } }) {
    return {
      id: d.id,
      no: Number(d.no),
      status: d.status,
      statusName: DEMAND_STATUS_NAMES[d.status as DemandStatusKey],
      title: d.title,
      category: d.category,
      il: d.il,
      ilce: d.ilce,
      budgetMin: d.budgetMin === null ? null : Number(d.budgetMin),
      budgetMax: d.budgetMax === null ? null : Number(d.budgetMax),
      yearMin: d.yearMin,
      yearMax: d.yearMax,
      alternatives: Array.isArray((d.data as unknown as DemandData)?.alternatifler)
        ? (d.data as unknown as DemandData).alternatifler.length
        : 0,
      step: d.step,
      publishedAt: d.publishedAt,
      expiresAt: d.expiresAt,
      passiveReason: d.passiveReason,
      closedAt: d.closedAt,
      freeExtensionUsed: d.freeExtensionUsed,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  }

  /** Taleplerim ekranındaki düğmeler */
  private actions(d: Demand) {
    const now = Date.now();
    const exp = d.expiresAt?.getTime() ?? 0;
    const open = d.status === 'PUBLISHED' || d.status === 'PASSIVE';
    return {
      edit: d.status === 'DRAFT' || open,
      publish: d.status === 'DRAFT',
      passivate: d.status === 'PUBLISHED',
      activate: d.status === 'PASSIVE' && exp > now,
      extend:
        (d.status === 'PUBLISHED' && exp - now <= EXTEND_WINDOW_DAYS * DAY) ||
        (d.status === 'PASSIVE' && (d.passiveReason === 'sure_doldu' || exp <= now)),
      extendFree: !d.freeExtensionUsed,
      close: d.status === 'DRAFT' || open,
      complete: open,
    };
  }

  private async own(userId: string, id: string) {
    const d = await this.db.demand.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Talep bulunamadı');
    if (d.userId !== userId) throw new ForbiddenException('Bu talep senin değil');
    return d;
  }

  private expect(d: Demand, allowed: DemandStatus[]) {
    if (!allowed.includes(d.status)) {
      throw new ConflictException(
        `Talep "${DEMAND_STATUS_NAMES[d.status as DemandStatusKey]}" durumunda; bu işlem yapılamaz`,
      );
    }
  }

  private async accountOf(userId: string) {
    const m = await this.db.accountMember.findFirst({
      where: { userId, role: 'OWNER', account: { kind: 'INDIVIDUAL', status: 'ACTIVE' } },
      select: { accountId: true },
    });
    if (!m) throw new ForbiddenException('Bireysel hesap bulunamadı');
    return m.accountId;
  }

  /** Talep açılabilen kategori: açık, yayında sürümü olan ve açık alt kategorisi olmayan (Ticari'de alt kategori seçilir). */
  private async leafCategory(slug: string) {
    const c = await this.db.category.findUnique({
      where: { slug },
      include: { children: { where: { enabled: true }, select: { id: true } } },
    });
    if (!c?.enabled || !c.publishedVersion) throw new BadRequestException('Kategori bulunamadı ya da kapalı');
    if (c.children.length) throw new BadRequestException('Alt kategori seç');
    return c;
  }

  private async definition(categoryId: string, version: number): Promise<CategoryDefinition> {
    const v = await this.db.categorySchemaVersion.findUnique({
      where: { categoryId_version: { categoryId, version } },
    });
    if (!v) throw new NotFoundException('Kategori şeması bulunamadı');
    return v.definition as unknown as CategoryDefinition;
  }

  /** Şema doğrulaması ve katalog seçiminin katalogda var olduğu denetimi. */
  private async validate(def: CategoryDefinition, raw: DemandData): Promise<DemandData> {
    const r = demandSchema(def).safeParse(raw);
    if (!r.success) invalid(r.error.issues);
    const data = r.data as DemandData;
    for (const f of effectiveFields(def).filter((x) => x.type === 'catalog')) {
      const v = data.alanlar[f.key] as { make: string; series?: string; model?: string } | undefined;
      if (!v) continue;
      const make = await this.db.catalogMake.findUnique({ where: { key: v.make }, select: { id: true } });
      const series = v.series
        ? await this.db.catalogSeries.findUnique({
            where: { key: v.series },
            select: { id: true, makeId: true },
          })
        : null;
      const model = v.model
        ? await this.db.catalogModel.findUnique({
            where: { key: v.model },
            select: { makeId: true, seriesId: true },
          })
        : null;
      const ok =
        make &&
        (!v.series || series?.makeId === make.id) &&
        (!v.model || (model?.makeId === make.id && (!v.series || model.seriesId === series?.id)));
      if (!ok) invalid([{ path: ['alanlar', f.key], message: `${f.label}: katalogda bulunamadı` }]);
    }
    return data;
  }

  /** Liste ve arama için ayrı sütunlar ve katalogdan başlık. */
  private async columns(tx: Tx, def: CategoryDefinition, data: DemandData) {
    const fields = effectiveFields(def);
    const cat = fields.find((f) => f.type === 'catalog' && data.alanlar[f.key]);
    const v = cat ? (data.alanlar[cat.key] as { make: string; series?: string; model?: string }) : undefined;
    const konum = data.alanlar.konum as { il?: string; ilce?: string } | undefined;
    const budget = span(data.alternatifler, 'butce');
    const year = span(data.alternatifler, 'yil');
    return {
      title: await this.title(tx, fields, data, v),
      makeKey: v?.make ?? null,
      seriesKey: v?.series ?? null,
      modelKey: v?.model ?? null,
      il: konum?.il ?? null,
      ilce: konum?.ilce ?? null,
      budgetMin: budget.min === null ? null : BigInt(Math.round(budget.min)),
      budgetMax: budget.max === null ? null : BigInt(Math.round(budget.max)),
      yearMin: year.min,
      yearMax: year.max,
    };
  }

  /** "BMW 3 Serisi 320i"; katalog yoksa ana araç adımındaki seçim ("Motorlu yat") ya da kategori adı. */
  private async title(
    tx: Tx,
    fields: CategoryField[],
    data: DemandData,
    v?: { make: string; series?: string; model?: string },
  ) {
    const parts: string[] = [];
    const lead = fields.find(
      (f) => f.step === 'ana_arac' && f.type === 'select' && typeof data.alanlar[f.key] === 'string',
    );
    if (lead) {
      const label = lead.options?.find((o) => o.value === data.alanlar[lead.key])?.label;
      if (label) parts.push(label);
    }
    if (v) {
      const make = await tx.catalogMake.findUnique({ where: { key: v.make }, select: { name: true } });
      const series = v.series
        ? await tx.catalogSeries.findUnique({ where: { key: v.series }, select: { name: true } })
        : null;
      const model = v.model
        ? await tx.catalogModel.findUnique({ where: { key: v.model }, select: { name: true } })
        : null;
      const tr = (x?: string) => x?.toLocaleLowerCase('tr-TR') ?? '';
      // Seri adı marka adıyla başlıyorsa (ör. "Range Rover Sport") marka tekrar yazılmaz.
      const showMake = !(make && series && tr(series.name).startsWith(tr(make.name)));
      parts.push([showMake ? make?.name : null, series?.name, model?.name].filter(Boolean).join(' '));
    }
    return parts.filter(Boolean).join(' · ').slice(0, 160);
  }

  /** Bitiş: kategori yayın süresi; alış tarihi olan talepte (kiralık) alış tarihini geçmez. */
  private expiry(def: CategoryDefinition, data: DemandData, from: Date) {
    let end = from.getTime() + def.rules.listingDays * DAY;
    for (const f of effectiveFields(def).filter((x) => x.type === 'daterange')) {
      const v = data.alanlar[f.key] as { from?: string } | undefined;
      if (v?.from) end = Math.min(end, new Date(v.from).getTime());
    }
    return new Date(end);
  }

  private event(
    tx: Tx,
    demandId: string,
    type: string,
    userId: string | null,
    data: Prisma.InputJsonValue = {},
  ) {
    return tx.demandEvent.create({ data: { demandId, type, userId, data } });
  }

  private async transition(
    tx: Tx,
    d: Demand,
    userId: string,
    type: string,
    eventType: EventType,
    ip?: string,
    extra: Record<string, unknown> = {},
  ) {
    await this.event(tx, d.id, type, userId, extra as Prisma.InputJsonValue);
    await this.audit.record(
      {
        actorType: 'USER',
        actorId: userId,
        action: `talep_${type}`,
        entityType: 'demand',
        entityId: d.id,
        after: { no: Number(d.no), durum: d.status, ...extra } as Prisma.InputJsonValue,
        ip,
      },
      tx,
    );
    await this.outbox.add(tx, eventType, {
      demandId: d.id,
      no: Number(d.no),
      userId,
      categoryId: d.categoryId,
    });
  }

  private change(
    d: Demand,
    userId: string,
    data: Prisma.DemandUpdateInput,
    type: string,
    eventType: EventType,
    ip?: string,
    extra: Record<string, unknown> = {},
  ) {
    return this.db.$transaction(async (tx) => {
      const r = await tx.demand.updateMany({
        where: { id: d.id, status: d.status },
        data: data as Prisma.DemandUpdateManyMutationInput,
      });
      if (r.count !== 1) throw new ConflictException('Talep bu sırada değişti; sayfayı yenile');
      const updated = await tx.demand.findUniqueOrThrow({
        where: { id: d.id },
        include: { category: { select: { slug: true, name: true } } },
      });
      await this.transition(tx, updated, userId, type, eventType, ip, extra);
      return this.summary(updated);
    });
  }
}
