import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Prisma } from '@rengarenk/db';
import {
  type ClientFlags,
  FEATURE_FLAG_KEYS,
  FEATURE_FLAGS,
  type FeatureFlagKey,
  type FlagAudience,
  type FlagPlatform,
  MAINTENANCE_AREAS,
  MAINTENANCE_KEYS,
  type MaintenanceArea,
  maintenanceFlagKey,
  normalizeTrMobile,
  rolloutBucket,
} from '@rengarenk/shared';
import type { Redis } from 'ioredis';
import { AuditService } from '../audit/audit.service.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { REDIS, ready } from '../redis/redis.module.js';

interface FlagState {
  enabled: boolean;
  audience: FlagAudience;
  percent: number;
  platforms: FlagPlatform[];
  note: string | null;
}

interface Snapshot {
  flags: Record<string, FlagState>;
  testers: string[];
}

export interface FlagContext {
  userId?: string;
  platform?: FlagPlatform;
}

const CACHE_KEY = 'ozellik:v1';
const CACHE_SECONDS = 60;
/** Süreç içi kısa önbellek: bakım denetimi her istekte çalışır. */
const MEMO_MS = 3000;
const OFF: FlagState = { enabled: false, audience: 'ALL', percent: 100, platforms: [], note: null };

export const DEFAULT_MAINTENANCE_NOTE = 'Rengarenk kısa bir bakımda. Birazdan yeniden deneyebilirsin.';

type Actor = { staff: { id: string } };

/**
 * Özellik anahtarları ve bakım modu (T13, Karar 47). Durum veritabanındadır, Redis'te ve süreç içinde
 * kısa süre önbelleklenir; değişiklikte önbellek silinir, diğer sunucular en geç birkaç saniyede görür.
 */
@Injectable()
export class FeatureFlagService {
  private readonly log = new Logger(FeatureFlagService.name);
  private memo?: { at: number; snap: Snapshot };

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  async snapshot(): Promise<Snapshot> {
    if (this.memo && Date.now() - this.memo.at < MEMO_MS) return this.memo.snap;
    let snap: Snapshot | null = null;
    try {
      const cached = await (await ready(this.redis)).get(CACHE_KEY);
      if (cached) snap = JSON.parse(cached) as Snapshot;
    } catch {
      // Redis yoksa veritabanından okunur.
    }
    if (!snap) {
      const [rows, testers] = await Promise.all([
        this.db.featureFlag.findMany(),
        this.db.featureTester.findMany({ select: { userId: true } }),
      ]);
      snap = {
        flags: Object.fromEntries(
          rows.map((r) => [
            r.key,
            {
              enabled: r.enabled,
              audience: r.audience,
              percent: r.percent,
              platforms: r.platforms,
              note: r.note,
            },
          ]),
        ),
        testers: testers.map((t) => t.userId),
      };
      try {
        await (await ready(this.redis)).set(CACHE_KEY, JSON.stringify(snap), 'EX', CACHE_SECONDS);
      } catch {
        // önbellek yazılamazsa sorun değil
      }
    }
    this.memo = { at: Date.now(), snap };
    return snap;
  }

  async invalidate() {
    this.memo = undefined;
    try {
      await (await ready(this.redis)).del(CACHE_KEY);
    } catch (err) {
      this.log.warn(`özellik önbelleği silinemedi: ${(err as Error).message}`);
    }
  }

  /** Anahtar bu kişi ve platform için açık mı? */
  private evaluate(s: FlagState, key: string, ctx: FlagContext & { business: boolean; tester: boolean }) {
    if (!s.enabled) return false;
    if (s.platforms.length > 0 && (!ctx.platform || !s.platforms.includes(ctx.platform))) return false;
    if (s.audience === 'TESTERS' && !ctx.tester) return false;
    if (s.audience === 'BUSINESS' && !ctx.business) return false;
    if (s.percent >= 100) return true;
    // Kısmi açılış yalnızca giriş yapmış kullanıcıya; aynı kişi hep aynı sonucu alır.
    return ctx.userId !== undefined && rolloutBucket(key, ctx.userId) < s.percent;
  }

  async isOn(key: FeatureFlagKey, ctx: FlagContext = {}): Promise<boolean> {
    return (await this.forClient(ctx)).flags[key];
  }

  async forClient(ctx: FlagContext = {}): Promise<ClientFlags> {
    const snap = await this.snapshot();
    const tester = ctx.userId ? snap.testers.includes(ctx.userId) : false;
    const needsBusiness = FEATURE_FLAG_KEYS.some((k) => snap.flags[k]?.audience === 'BUSINESS');
    const business =
      needsBusiness && ctx.userId
        ? (await this.db.accountMember.count({
            where: { userId: ctx.userId, account: { kind: 'BUSINESS', status: 'ACTIVE' } },
          })) > 0
        : false;
    const flags = Object.fromEntries(
      FEATURE_FLAG_KEYS.map((k) => [k, this.evaluate(snap.flags[k] ?? OFF, k, { ...ctx, business, tester })]),
    ) as ClientFlags['flags'];
    const bakim = Object.fromEntries(
      MAINTENANCE_KEYS.map((a) => [a, snap.flags[maintenanceFlagKey(a)]?.enabled ?? false]),
    ) as ClientFlags['bakim'];
    const open = MAINTENANCE_KEYS.find((a) => bakim[a]);
    const duyuru = open ? (snap.flags[maintenanceFlagKey(open)]?.note ?? DEFAULT_MAINTENANCE_NOTE) : null;
    return { flags, bakim, duyuru };
  }

  async maintenance(area: MaintenanceArea): Promise<{ on: boolean; note: string }> {
    const s = (await this.snapshot()).flags[maintenanceFlagKey(area)];
    return { on: s?.enabled ?? false, note: s?.note || DEFAULT_MAINTENANCE_NOTE };
  }

  /** Bakımdaki bir alana yazma girişiminde çağrılır (ödeme, mesaj, talep modülleri). */
  async assertAvailable(area: MaintenanceArea) {
    const m = await this.maintenance(area);
    if (m.on) throw new ServiceUnavailableException({ message: m.note, bakim: area });
  }

  // ── Yönetim ──────────────────────────────────────────────────

  async list() {
    const rows = new Map((await this.db.featureFlag.findMany()).map((r) => [r.key, r]));
    const view = (key: string) => {
      const r = rows.get(key);
      return {
        enabled: r?.enabled ?? false,
        audience: r?.audience ?? 'ALL',
        percent: r?.percent ?? 100,
        platforms: r?.platforms ?? [],
        note: r?.note ?? null,
        updatedAt: r?.updatedAt ?? null,
      };
    };
    return {
      flags: FEATURE_FLAGS.map((f) => ({ ...f, ...view(f.key) })),
      maintenance: MAINTENANCE_AREAS.map((a) => ({ ...a, ...view(maintenanceFlagKey(a.key)) })),
    };
  }

  async update(
    actor: Actor,
    key: string,
    patch: {
      enabled?: boolean;
      audience?: FlagAudience;
      percent?: number;
      platforms?: FlagPlatform[];
      note?: string | null;
    },
    ip?: string,
  ) {
    const known = FEATURE_FLAG_KEYS.includes(key as FeatureFlagKey) || key.startsWith('bakim.');
    if (!known) throw new NotFoundException('Böyle bir özellik anahtarı yok');
    const result = await this.db.$transaction(async (tx) => {
      const before = await tx.featureFlag.findUnique({ where: { key } });
      const data = { ...patch, updatedBy: actor.staff.id };
      const after = await tx.featureFlag.upsert({ where: { key }, create: { key, ...data }, update: data });
      const pick = (r: typeof after | null) =>
        r
          ? { acik: r.enabled, kitle: r.audience, yuzde: r.percent, platform: r.platforms, duyuru: r.note }
          : { acik: false };
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: actor.staff.id,
          action: key.startsWith('bakim.') ? 'bakim_degisti' : 'ozellik_degisti',
          entityType: 'setting',
          entityId: key,
          before: pick(before) as Prisma.InputJsonValue,
          after: pick(after) as Prisma.InputJsonValue,
          ip,
        },
        tx,
      );
      await this.outbox.add(tx, 'ayar.degisti', { key, enabled: after.enabled });
      return after;
    });
    await this.invalidate();
    return result;
  }

  setMaintenance(actor: Actor, area: string, body: { enabled: boolean; note?: string }, ip?: string) {
    if (!MAINTENANCE_KEYS.includes(area as MaintenanceArea))
      throw new NotFoundException('Böyle bir bakım alanı yok');
    return this.update(
      actor,
      maintenanceFlagKey(area as MaintenanceArea),
      { enabled: body.enabled, ...(body.note !== undefined ? { note: body.note || null } : {}) },
      ip,
    );
  }

  async testers() {
    const rows = await this.db.featureTester.findMany({
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, phone: true, displayName: true } } },
    });
    return rows.map((r) => ({
      userId: r.userId,
      phone: r.user.phone,
      name: r.user.displayName,
      addedAt: r.createdAt,
    }));
  }

  async addTester(actor: Actor, phoneInput: string, ip?: string) {
    const phone = normalizeTrMobile(phoneInput);
    if (!phone) throw new BadRequestException('Geçerli bir cep telefonu numarası gir');
    const user = await this.db.user.findUnique({ where: { phone } });
    if (!user)
      throw new NotFoundException(
        'Bu numarayla kayıtlı kullanıcı yok; önce uygulamaya bir kez giriş yapmalı',
      );
    await this.db.$transaction(async (tx) => {
      if (await tx.featureTester.findUnique({ where: { userId: user.id } })) {
        throw new ConflictException('Bu kullanıcı zaten deneme listesinde');
      }
      await tx.featureTester.create({ data: { userId: user.id, addedBy: actor.staff.id } });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: actor.staff.id,
          action: 'deneme_kullanicisi_eklendi',
          entityType: 'user',
          entityId: user.id,
          ip,
        },
        tx,
      );
    });
    await this.invalidate();
  }

  async removeTester(actor: Actor, userId: string, ip?: string) {
    await this.db.$transaction(async (tx) => {
      const r = await tx.featureTester.deleteMany({ where: { userId } });
      if (r.count === 0) throw new NotFoundException('Bu kullanıcı deneme listesinde değil');
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: actor.staff.id,
          action: 'deneme_kullanicisi_cikarildi',
          entityType: 'user',
          entityId: userId,
          ip,
        },
        tx,
      );
    });
    await this.invalidate();
  }
}
