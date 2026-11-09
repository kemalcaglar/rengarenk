import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnApplicationBootstrap,
  type OnModuleInit,
} from '@nestjs/common';
import { type Approval, type Category, type CategorySchemaVersion, type Prisma, uuidv7 } from '@rengarenk/db';
import {
  type CategoryDefinition,
  categoryDefinitionSchema,
  DEFAULT_CATEGORIES,
  demandJsonSchema,
  diffDefinitions,
  dotColor,
  effectiveFields,
} from '@rengarenk/shared';
import { type Actor, ApprovalService } from '../approvals/approval.service.js';
import { ApprovalExecutor } from '../approvals/approval-executor.js';
import { AuditService } from '../audit/audit.service.js';
import { grafikNotu } from '../dashboard/dashboard.service.js';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';
import { OutboxService } from '../outbox/outbox.service.js';

const SUBJECT = 'category_schema_version';

export function slugify(name: string): string {
  return name
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Yeni kategorinin boş taslağı: yalnızca taban şema ve varsayılan kurallar. */
function emptyDefinition(vertical: string): CategoryDefinition {
  return {
    fields: [],
    rules: {
      listingDays: 30,
      tariff: 'genel',
      legalNotice: null,
      verifications:
        vertical === 'vasita' ? ['yetki_belgesi', 'vergi_levhasi', 'mersis'] : ['vergi_levhasi', 'mersis'],
      catalog: vertical === 'vasita' ? 'kullanici' : 'yok',
      freeFirstMessages: 5,
      matchThreshold: 80,
    },
    baseWeights: { konum: 12, butce: 20 },
  };
}

type Version = CategorySchemaVersion;

/**
 * Kategori ağacı ve sürümlü kategori şeması (Karar 23, 45). Değişiklik taslakta hazırlanır, dört göz
 * onayıyla (CATEGORY_SCHEMA) yayına girer; yayındaki talepler eski sürümle kalır. Her sürüme yeni bir
 * taslakla dönülür. Ağaç işlemleri (ad, sıra, renk, açma ve kapatma) doğrudan yapılır ve işlem kaydına girer.
 */
@Injectable()
export class CategoryService implements OnModuleInit, OnApplicationBootstrap {
  private readonly log = new Logger(CategoryService.name);

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly approvals: ApprovalService,
    private readonly executor: ApprovalExecutor,
  ) {}

  onModuleInit() {
    this.executor.register('CATEGORY_SCHEMA', (a, tx) => this.publishApproved(a, tx));
  }

  async onApplicationBootstrap() {
    await this.ensureDefaults().catch((err: Error) =>
      this.log.error(`başlangıç kategorileri: ${err.message}`),
    );
  }

  /** Veritabanında olmayan başlangıç kategorilerini 1. sürümle yayına alır (ilk kurulum). */
  async ensureDefaults(): Promise<number> {
    const existing = new Set(
      (await this.db.category.findMany({ select: { slug: true } })).map((c) => c.slug),
    );
    if (DEFAULT_CATEGORIES.every((c) => existing.has(c.slug))) return 0;
    return this.db.$transaction(async (tx) => {
      // API ve işçi aynı anda açılırsa kurulumu yalnızca biri yapar.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('rr_kategori_kurulum'))`;
      const rows = await tx.category.findMany({ select: { id: true, slug: true } });
      const ids = new Map(rows.map((r) => [r.slug, r.id]));
      let n = 0;
      for (const [i, c] of DEFAULT_CATEGORIES.entries()) {
        if (ids.has(c.slug)) continue;
        const definition = categoryDefinitionSchema.parse(c.definition);
        const id = uuidv7();
        await tx.category.create({
          data: {
            id,
            slug: c.slug,
            name: c.name,
            parentId: c.parent ? (ids.get(c.parent) ?? null) : null,
            sort: i,
            enabled: c.enabled,
            publishedVersion: 1,
          },
        });
        await tx.categorySchemaVersion.create({
          data: {
            id: uuidv7(),
            categoryId: id,
            version: 1,
            status: 'PUBLISHED',
            definition: definition as unknown as Prisma.InputJsonValue,
            changes: ['İlk sürüm'],
            publishedAt: new Date(),
          },
        });
        await this.audit.record(
          {
            actorType: 'SYSTEM',
            action: 'kategori_tanimlandi',
            entityType: 'category',
            entityId: id,
            after: { slug: c.slug },
          },
          tx,
        );
        ids.set(c.slug, id);
        n++;
      }
      if (n) await this.outbox.add(tx, 'kategori.degisti', { tanimlanan: n });
      return n;
    });
  }

  // ── Herkese açık okuma (web, mobil, galeri API'si) ─────────────

  /** Açık kategoriler, ana sayfa ve menü sırasıyla. Renk boşsa sıradaki renk (DOTS). */
  async publicTree() {
    const rows = await this.db.category.findMany({
      where: { enabled: true },
      orderBy: [{ sort: 'asc' }],
      select: {
        id: true,
        slug: true,
        name: true,
        vertical: true,
        parentId: true,
        color: true,
        publishedVersion: true,
      },
    });
    const open = new Set(rows.map((r) => r.id));
    const top = rows.filter((r) => !r.parentId);
    return top.map((c, i) => ({
      slug: c.slug,
      name: c.name,
      vertical: c.vertical,
      color: c.color ?? dotColor(i),
      version: c.publishedVersion,
      children: rows
        .filter((r) => r.parentId === c.id && open.has(r.id))
        .map((r) => ({ slug: r.slug, name: r.name, version: r.publishedVersion })),
    }));
  }

  /** Kategorinin şeması: yayındaki ya da istenen sürüm (eski talepler kendi sürümüyle okunur). */
  async schema(slug: string, version?: number) {
    const c = await this.db.category.findUnique({ where: { slug } });
    if (!c || (!c.enabled && version === undefined)) throw new NotFoundException('Kategori bulunamadı');
    const v = await this.db.categorySchemaVersion.findFirst({
      where: {
        categoryId: c.id,
        ...(version === undefined
          ? { status: 'PUBLISHED' }
          : { version, status: { in: ['PUBLISHED', 'RETIRED'] } }),
      },
    });
    if (!v) throw new NotFoundException('Şema sürümü bulunamadı');
    const definition = this.definitionOf(v);
    return {
      category: { slug: c.slug, name: c.name },
      version: v.version,
      publishedAt: v.publishedAt,
      fields: effectiveFields(definition),
      rules: definition.rules,
      jsonSchema: demandJsonSchema(definition),
    };
  }

  // ── Konsol ─────────────────────────────────────────────────────

  async staffTree() {
    await this.reconcile();
    const rows = await this.db.category.findMany({
      orderBy: [{ sort: 'asc' }],
      include: {
        versions: {
          where: { status: { in: ['PUBLISHED', 'DRAFT', 'PENDING'] } },
          select: { version: true, status: true, publishedAt: true, changes: true, approvalId: true },
        },
      },
    });
    const top = rows.filter((r) => !r.parentId);
    const order = [...top.flatMap((t) => [t, ...rows.filter((r) => r.parentId === t.id)])];
    return order.map((c) => {
      const published = c.versions.find((v) => v.status === 'PUBLISHED') ?? null;
      const draft = c.versions.find((v) => v.status !== 'PUBLISHED') ?? null;
      return {
        id: c.id,
        slug: c.slug,
        name: c.name,
        vertical: c.vertical,
        parentId: c.parentId,
        enabled: c.enabled,
        color: c.color,
        dot:
          c.color ??
          dotColor(
            Math.max(
              0,
              top.findIndex((t) => t.id === (c.parentId ?? c.id)),
            ),
          ),
        published: published && { version: published.version, publishedAt: published.publishedAt },
        draft: draft && { version: draft.version, status: draft.status, changes: draft.changes.length },
        hasChildren: rows.some((r) => r.parentId === c.id),
        // Talep modülü (Aşama 3) gelince aktif talep sayısı buradan döner.
        activeDemands: 0,
      };
    });
  }

  async detail(id: string) {
    await this.reconcile(id);
    const c = await this.db.category.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Kategori bulunamadı');
    const versions = await this.db.categorySchemaVersion.findMany({
      where: { categoryId: id },
      orderBy: { version: 'desc' },
    });
    const published = versions.find((v) => v.status === 'PUBLISHED') ?? null;
    const draft = versions.find((v) => v.status === 'DRAFT' || v.status === 'PENDING') ?? null;
    const staffIds = [
      ...new Set(
        versions.flatMap((v) => [v.createdBy, v.publishedBy]).filter((x): x is string => Boolean(x)),
      ),
    ];
    const staff = new Map(
      (
        await this.db.staffMember.findMany({
          where: { id: { in: staffIds } },
          select: { id: true, name: true },
        })
      ).map((s) => [s.id, s.name]),
    );
    const approval = draft?.approvalId
      ? await this.db.approval.findUnique({
          where: { id: draft.approvalId },
          select: { id: true, status: true, requestedBy: true, createdAt: true },
        })
      : null;
    const publishedDef = published ? this.definitionOf(published) : null;
    const draftDef = draft ? this.definitionOf(draft) : null;
    const person = (sid: string | null) => (sid ? { id: sid, name: staff.get(sid) ?? 'Çalışan' } : null);
    return {
      category: {
        id: c.id,
        slug: c.slug,
        name: c.name,
        vertical: c.vertical,
        parentId: c.parentId,
        enabled: c.enabled,
        color: c.color,
        hasChildren: (await this.db.category.count({ where: { parentId: c.id } })) > 0,
        activeDemands: 0,
      },
      published: published && {
        version: published.version,
        publishedAt: published.publishedAt,
        definition: publishedDef,
      },
      draft: draft && {
        version: draft.version,
        status: draft.status,
        definition: draftDef,
        diff: diffDefinitions(publishedDef, draftDef as CategoryDefinition),
        restoredFrom: draft.restoredFrom,
        updatedAt: draft.updatedAt,
        approval,
      },
      versions: versions.map((v) => ({
        version: v.version,
        status: v.status,
        changes: v.changes,
        restoredFrom: v.restoredFrom,
        createdBy: person(v.createdBy),
        publishedBy: person(v.publishedBy),
        publishedAt: v.publishedAt,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      })),
    };
  }

  async create(actor: Actor, input: { name: string; vertical: string; parentId?: string }, ip?: string) {
    let parent: Category | null = null;
    if (input.parentId) {
      parent = await this.db.category.findUnique({ where: { id: input.parentId } });
      if (!parent) throw new NotFoundException('Üst kategori bulunamadı');
      if (parent.parentId) throw new BadRequestException('Alt kategorinin altına kategori eklenmez');
    }
    const vertical = parent?.vertical ?? input.vertical;
    const base = slugify(input.name) || 'kategori';
    return this.db.$transaction(async (tx) => {
      const taken = new Set(
        (await tx.category.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } })).map(
          (c) => c.slug,
        ),
      );
      let slug = base;
      for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
      const last = await tx.category.aggregate({ _max: { sort: true } });
      const id = uuidv7();
      const c = await tx.category.create({
        data: {
          id,
          slug,
          name: input.name,
          vertical,
          parentId: parent?.id ?? null,
          sort: (last._max.sort ?? 0) + 1,
        },
      });
      await tx.categorySchemaVersion.create({
        data: {
          id: uuidv7(),
          categoryId: id,
          version: 1,
          definition: emptyDefinition(vertical) as unknown as Prisma.InputJsonValue,
          changes: ['İlk sürüm'],
          createdBy: actor.staff.id,
        },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: actor.staff.id,
          action: 'kategori_eklendi',
          entityType: 'category',
          entityId: id,
          after: { ad: c.name, ust: parent?.name ?? null, dikey: vertical },
          ip,
        },
        tx,
      );
      return c;
    });
  }

  async update(
    actor: Actor,
    id: string,
    input: { name?: string; enabled?: boolean; color?: string | null; move?: 'up' | 'down' },
    ip?: string,
  ) {
    const c = await this.db.category.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Kategori bulunamadı');
    if (input.enabled && !c.publishedVersion) {
      throw new ConflictException('Kategoriyi açmak için önce bir sürümü yayınla');
    }
    return this.db.$transaction(async (tx) => {
      const data: Prisma.CategoryUpdateInput = {};
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      if (input.name !== undefined && input.name !== c.name) {
        data.name = input.name;
        before.ad = c.name;
        after.ad = input.name;
      }
      if (input.enabled !== undefined && input.enabled !== c.enabled) {
        data.enabled = input.enabled;
        before.durum = c.enabled ? 'açık' : 'kapalı';
        after.durum = input.enabled ? 'açık' : 'kapalı';
      }
      if (input.color !== undefined && input.color !== c.color) {
        data.color = input.color;
        before.renk = c.color;
        after.renk = input.color;
      }
      if (input.move) {
        const siblings = await tx.category.findMany({
          where: { parentId: c.parentId, vertical: c.vertical },
          orderBy: { sort: 'asc' },
          select: { id: true, sort: true, name: true },
        });
        const i = siblings.findIndex((s) => s.id === id);
        const j = input.move === 'up' ? i - 1 : i + 1;
        const other = siblings[j];
        if (other) {
          await tx.category.update({ where: { id: other.id }, data: { sort: c.sort } });
          data.sort = other.sort;
          before.sira = i + 1;
          after.sira = j + 1;
        }
      }
      if (Object.keys(data).length === 0) return c;
      const updated = await tx.category.update({ where: { id }, data });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: actor.staff.id,
          action: 'kategori_guncellendi',
          entityType: 'category',
          entityId: id,
          before: before as Prisma.InputJsonValue,
          after: after as Prisma.InputJsonValue,
          ip,
        },
        tx,
      );
      await this.outbox.add(tx, 'kategori.degisti', { categoryId: id });
      return updated;
    });
  }

  /** Taslağı kaydeder; yoksa yayındaki sürümün üstüne yeni taslak açar. Yayındakiyle aynıysa taslak kalkar. */
  async saveDraft(actor: Actor, id: string, raw: unknown, ip?: string) {
    const parsed = categoryDefinitionSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException({
        message: parsed.error.issues[0]?.message ?? 'Şema geçersiz',
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    const definition = parsed.data;
    await this.reconcile(id);
    return this.db.$transaction(async (tx) => {
      const { category, published, draft } = await this.lockVersions(tx, id);
      if (draft?.status === 'PENDING') {
        throw new ConflictException('Taslak onayda; değiştirmek için onay kuyruğundan isteği geri çek');
      }
      const diff = diffDefinitions(published ? this.definitionOf(published) : null, definition);
      if (published && diff.changes.length === 0) {
        if (draft) {
          await tx.categorySchemaVersion.delete({ where: { id: draft.id } });
          await this.auditDraft(tx, actor, category.id, 'kategori_taslak_silindi', draft.version, ip);
        }
        return { version: null, changes: [] };
      }
      const json = definition as unknown as Prisma.InputJsonValue;
      const v = draft
        ? await tx.categorySchemaVersion.update({
            where: { id: draft.id },
            data: { definition: json, changes: diff.changes },
          })
        : await tx.categorySchemaVersion.create({
            data: {
              id: uuidv7(),
              categoryId: category.id,
              version: await this.nextVersion(tx, category.id),
              definition: json,
              changes: diff.changes,
              createdBy: actor.staff.id,
            },
          });
      await this.auditDraft(
        tx,
        actor,
        category.id,
        'kategori_taslak_kaydedildi',
        v.version,
        ip,
        diff.changes,
      );
      return { version: v.version, changes: diff.changes };
    });
  }

  async discardDraft(actor: Actor, id: string, ip?: string) {
    await this.reconcile(id);
    await this.db.$transaction(async (tx) => {
      const { category, published, draft } = await this.lockVersions(tx, id);
      if (!draft) return;
      if (draft.status === 'PENDING') throw new ConflictException('Taslak onayda; önce isteği geri çek');
      if (!published) throw new ConflictException('Hiç yayınlanmamış kategorinin taslağı silinmez');
      await tx.categorySchemaVersion.delete({ where: { id: draft.id } });
      await this.auditDraft(tx, actor, category.id, 'kategori_taslak_silindi', draft.version, ip);
    });
  }

  /** Eski bir sürümü yeni taslak olarak açar ("Bu sürüme dön"); yayına yine dört göz onayıyla girer. */
  async restore(actor: Actor, id: string, version: number, ip?: string) {
    await this.reconcile(id);
    return this.db.$transaction(async (tx) => {
      const { category, published, draft } = await this.lockVersions(tx, id);
      if (draft?.status === 'PENDING') throw new ConflictException('Taslak onayda; önce isteği geri çek');
      const source = await tx.categorySchemaVersion.findUnique({
        where: { categoryId_version: { categoryId: id, version } },
      });
      if (source?.status !== 'RETIRED') throw new BadRequestException('Yalnızca eski bir sürüme dönülebilir');
      const definition = this.definitionOf(source);
      const changes = diffDefinitions(published ? this.definitionOf(published) : null, definition).changes;
      const data = {
        definition: definition as unknown as Prisma.InputJsonValue,
        changes: [`s.${version} sürümüne dönüş`, ...changes],
        restoredFrom: version,
      };
      const v = draft
        ? await tx.categorySchemaVersion.update({ where: { id: draft.id }, data })
        : await tx.categorySchemaVersion.create({
            data: {
              id: uuidv7(),
              categoryId: category.id,
              version: await this.nextVersion(tx, category.id),
              createdBy: actor.staff.id,
              ...data,
            },
          });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: actor.staff.id,
          action: 'kategori_surume_donuldu',
          entityType: 'category',
          entityId: category.id,
          after: { kaynak: version, taslak: v.version },
          ip,
        },
        tx,
      );
      return { version: v.version, changes: data.changes };
    });
  }

  /** Taslağı dört göz onayına gönderir ("Yayına gönder · N değişiklik"). */
  async submit(actor: Actor, id: string, ip?: string) {
    await this.reconcile(id);
    return this.db.$transaction(async (tx) => {
      const { category, published, draft } = await this.lockVersions(tx, id);
      if (!draft) throw new BadRequestException('Gönderilecek taslak yok');
      if (draft.status === 'PENDING') throw new ConflictException('Taslak zaten onayda');
      const definition = categoryDefinitionSchema.parse(draft.definition);
      const changes = diffDefinitions(published ? this.definitionOf(published) : null, definition).changes;
      if (published && changes.length === 0 && !draft.restoredFrom) {
        throw new BadRequestException('Taslakta değişiklik yok');
      }
      const list = draft.restoredFrom ? draft.changes : changes;
      const approval = await this.approvals.request(
        actor,
        {
          kind: 'CATEGORY_SCHEMA',
          subjectType: SUBJECT,
          subjectId: draft.id,
          title: `${category.name} şeması s.${draft.version}`,
          reason: list.slice(0, 12).join(' · ').slice(0, 1000),
          payload: { categoryId: category.id, version: draft.version, changes: list },
        },
        tx,
        ip,
      );
      await tx.categorySchemaVersion.update({
        where: { id: draft.id },
        data: { status: 'PENDING', approvalId: approval.id, changes: list },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: actor.staff.id,
          action: 'kategori_yayina_gonderildi',
          entityType: 'category',
          entityId: category.id,
          after: { surum: draft.version, onay: approval.id, degisiklik: list.length },
          ip,
        },
        tx,
      );
      return { version: draft.version, approvalId: approval.id };
    });
  }

  /** Onaylanan sürümü yayına alır (onay yürütücüsü, işçi). Önceki yayın "eski" olur. */
  async publishApproved(a: Approval, tx: Tx): Promise<Prisma.InputJsonValue> {
    if (a.subjectType !== SUBJECT) throw new Error('Kategori onayı değil');
    const v = await tx.categorySchemaVersion.findUnique({ where: { id: a.subjectId } });
    if (!v) throw new Error('Kategori sürümü bulunamadı');
    if (v.status === 'PUBLISHED' && v.approvalId === a.id)
      return { surum: v.version, durum: 'zaten_yayinda' };
    if (v.status !== 'PENDING' || v.approvalId !== a.id) throw new Error('Sürüm bu onayı beklemiyor');
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`rr_kategori_${v.categoryId}`}))`;
    await tx.categorySchemaVersion.updateMany({
      where: { categoryId: v.categoryId, status: 'PUBLISHED' },
      data: { status: 'RETIRED' },
    });
    await tx.categorySchemaVersion.update({
      where: { id: v.id },
      data: { status: 'PUBLISHED', publishedBy: a.decidedBy, publishedAt: new Date() },
    });
    const kat = await tx.category.update({
      where: { id: v.categoryId },
      data: { publishedVersion: v.version },
    });
    // Kontrol paneli grafiğine kendiliğinden not (Karar 44)
    await grafikNotu(tx, new Date(), `${kat.name} kuralları değişti (s.${v.version})`, 'kural', v.id);
    await this.audit.record(
      {
        actorType: 'SYSTEM',
        action: 'kategori_yayinlandi',
        entityType: 'category',
        entityId: v.categoryId,
        after: { surum: v.version, onay: a.id, onaylayan: a.decidedBy },
      },
      tx,
    );
    await this.outbox.add(tx, 'kategori.yayinlandi', { categoryId: v.categoryId, version: v.version });
    return { surum: v.version };
  }

  // ── Yardımcılar ───────────────────────────────────────────────

  private definitionOf(v: Pick<Version, 'definition'>): CategoryDefinition {
    return v.definition as unknown as CategoryDefinition;
  }

  private async nextVersion(tx: Tx, categoryId: string) {
    const max = await tx.categorySchemaVersion.aggregate({ where: { categoryId }, _max: { version: true } });
    return (max._max.version ?? 0) + 1;
  }

  /** Kategori başına kilit: aynı kategoride iki taslak işlemi aynı anda yürümez. */
  private async lockVersions(tx: Tx, id: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`rr_kategori_${id}`}))`;
    const category = await tx.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Kategori bulunamadı');
    const versions = await tx.categorySchemaVersion.findMany({
      where: { categoryId: id, status: { in: ['PUBLISHED', 'DRAFT', 'PENDING'] } },
    });
    return {
      category,
      published: versions.find((v) => v.status === 'PUBLISHED') ?? null,
      draft: versions.find((v) => v.status !== 'PUBLISHED') ?? null,
    };
  }

  private auditDraft(
    tx: Tx,
    actor: Actor,
    id: string,
    action: string,
    version: number,
    ip?: string,
    changes?: string[],
  ) {
    return this.audit.record(
      {
        actorType: 'STAFF',
        actorId: actor.staff.id,
        action,
        entityType: 'category',
        entityId: id,
        after: { surum: version, ...(changes ? { degisiklikler: changes.slice(0, 20) } : {}) },
        ip,
      },
      tx,
    );
  }

  /** Reddedilen, süresi dolan ya da geri çekilen onaydaki taslak yeniden düzenlenebilir olur. */
  private async reconcile(categoryId?: string) {
    const stuck = await this.db.categorySchemaVersion.findMany({
      where: { status: 'PENDING', ...(categoryId ? { categoryId } : {}) },
      select: { id: true, approvalId: true },
    });
    if (stuck.length === 0) return;
    const closed = await this.db.approval.findMany({
      where: {
        id: { in: stuck.map((s) => s.approvalId).filter((x): x is string => Boolean(x)) },
        status: { in: ['REJECTED', 'EXPIRED', 'CANCELLED'] },
      },
      select: { id: true },
    });
    const ids = new Set(closed.map((c) => c.id));
    for (const s of stuck) {
      if (s.approvalId && ids.has(s.approvalId)) {
        await this.db.categorySchemaVersion.updateMany({
          where: { id: s.id, status: 'PENDING' },
          data: { status: 'DRAFT', approvalId: null },
        });
      }
    }
  }
}
