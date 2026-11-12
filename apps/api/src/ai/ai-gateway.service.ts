import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { type Prisma, uuidv7 } from '@rengarenk/db';
import {
  AI_BUDGET,
  AI_MODELS,
  AI_TASK_KEYS,
  AI_TASKS,
  type AiModelSize,
  type AiTask,
  aiCostMicroUsd,
  MASK_RULES,
  maskPii,
  microToUsd,
  unmaskPii,
} from '@rengarenk/shared';
import type { Actor } from '../approvals/approval.service.js';
import { AuditService } from '../audit/audit.service.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { AI_PROVIDER, type AiProvider } from './ai.provider.js';

/** Türkiye saati (UTC+3, yaz saati yok) */
const TR = 3 * 3_600_000;
const AYLAR = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];
/** Kayıtta saklanan maskeli içerik en çok bu kadar karakter */
const KIRP = 4000;

/** Türkiye saatine göre ayın başı (UTC), ayın anahtarı (2026-11) ve gün bilgisi */
export function trMonth(now: Date) {
  const t = new Date(now.getTime() + TR);
  const y = t.getUTCFullYear();
  const m = t.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1) - TR);
  const end = new Date(Date.UTC(y, m + 1, 1) - TR);
  return {
    key: `${y}-${String(m + 1).padStart(2, '0')}`,
    ad: AYLAR[m] as string,
    start,
    end,
    gecenGun: (now.getTime() - start.getTime()) / 86_400_000,
    toplamGun: (end.getTime() - start.getTime()) / 86_400_000,
  };
}

export interface AiRequest {
  task: AiTask;
  /** İstem sürümü (rapor-ozet-v1); her çağrıyla kaydedilir */
  promptVersion: string;
  size: AiModelSize;
  system: string;
  prompt: string;
  /** Kurallarla hazırlanan metin: yapay zekâ kullanılamazsa bu döner */
  taslak: string;
  /** İsteğe konu kişilerin adları (maskelenir) */
  names?: (string | null | undefined)[];
  maxOutputTokens?: number;
}

export interface AiResult {
  text: string;
  /** yz: sağlayıcı yazdı · kural: kural metni (sağlayıcı yok, görev kapalı, bütçe doldu ya da hata) */
  kaynak: 'yz' | 'kural';
  durum: 'tamam' | 'yok' | 'kapali' | 'butce' | 'hata';
}

/**
 * Yapay zekâ ağ geçidi (Teknik tasarım §10, Karar 41, 57). Her istek önce maskelenir; görev kapalıysa ya da aylık
 * sınır dolduysa (kritik görevler hariç) sağlayıcı çağrılmaz. Her çağrı görev, istem sürümü, token ve maliyetle
 * kaydedilir; %80 ve %100'de sahibe bildirim olayı yazılır (ayda bir kez).
 */
@Injectable()
export class AiGateway {
  private readonly log = new Logger(AiGateway.name);

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(AI_PROVIDER) private readonly provider: AiProvider | null,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  private async ayar() {
    return this.db.aiSetting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  }

  async gorevAcik(task: AiTask) {
    return (await this.db.aiTaskSwitch.findUnique({ where: { task } }))?.enabled ?? true;
  }

  /** Bu ayın harcaması (milyonda bir USD) */
  async harcama(now = new Date()) {
    const ay = trMonth(now);
    const s = await this.db.aiCall.aggregate({
      where: { createdAt: { gte: ay.start, lt: ay.end } },
      _sum: { costMicroUsd: true },
    });
    return s._sum.costMicroUsd ?? 0;
  }

  async run(q: AiRequest): Promise<AiResult> {
    const kural = (durum: AiResult['durum']): AiResult => ({ text: q.taslak, kaynak: 'kural', durum });
    if (!this.provider) return kural('yok');
    if (!(await this.gorevAcik(q.task))) return kural('kapali');
    const ayar = await this.ayar();
    const kritik = AI_TASKS[q.task].kritik;
    const once = await this.harcama();
    if (!kritik && once >= ayar.limitUsd * 1_000_000) return kural('butce');

    // İstek ve taslak birlikte maskelenir: aynı değer aynı yer tutucuyu alır
    const AYRAC = '\n␞\n';
    const m = maskPii(`${q.system}${AYRAC}${q.prompt}${AYRAC}${q.taslak}`, { names: q.names });
    const [system, prompt, taslak] = m.text.split(AYRAC) as [string, string, string];
    const tablo = this.provider.ad === 'vertex' ? 'vertex' : 'bedrock';
    const model = AI_MODELS[tablo][q.size].id;
    const temel = {
      id: uuidv7(),
      task: q.task,
      promptVersion: q.promptVersion,
      provider: this.provider.ad,
      model,
      inputMasked: prompt.slice(0, KIRP),
      masked: m.sayim as Prisma.InputJsonValue,
    };
    try {
      const r = await this.provider.generate({
        model,
        system,
        prompt,
        taslak,
        maxOutputTokens: q.maxOutputTokens ?? 1024,
      });
      const cost = aiCostMicroUsd(tablo, q.size, r.inputTokens, r.outputTokens);
      await this.db.aiCall.create({
        data: {
          ...temel,
          status: 'tamam',
          inputTokens: r.inputTokens,
          outputTokens: r.outputTokens,
          costMicroUsd: cost,
          outputMasked: r.text.slice(0, KIRP),
        },
      });
      await this.esik(once + cost, ayar.limitUsd);
      return { text: unmaskPii(r.text, m.map), kaynak: 'yz', durum: 'tamam' };
    } catch (e) {
      const error = (e as Error).message.slice(0, 300);
      this.log.warn(`yapay zekâ çağrısı başarısız (${q.task}): ${error}`);
      await this.db.aiCall.create({ data: { ...temel, status: 'hata', error } });
      return kural('hata');
    }
  }

  /** %80 ve %100 eşikleri: ay içinde bir kez olay yazılır */
  private async esik(harcama: number, limitUsd: number) {
    const sinir = limitUsd * 1_000_000;
    const ay = trMonth(new Date()).key;
    const veri = { ay, harcamaUsd: microToUsd(harcama), sinirUsd: limitUsd };
    const ayDisi = (alan: 'alertMonth' | 'capMonth'): Prisma.AiSettingWhereInput => ({
      id: 1,
      OR: [{ [alan]: null }, { [alan]: { not: ay } }],
    });
    if (harcama >= sinir * AI_BUDGET.uyariOrani) {
      await this.db.$transaction(async (tx) => {
        const n = await tx.aiSetting.updateMany({ where: ayDisi('alertMonth'), data: { alertMonth: ay } });
        if (n.count) await this.outbox.add(tx, 'yz.butce_uyari', veri);
      });
    }
    if (harcama >= sinir) {
      await this.db.$transaction(async (tx) => {
        const n = await tx.aiSetting.updateMany({ where: ayDisi('capMonth'), data: { capMonth: ay } });
        if (n.count) await this.outbox.add(tx, 'yz.butce_doldu', veri);
      });
    }
  }

  // ── Konsol (YonetimSistem › Yapay zekâ ve bütçe) ─────────────

  async overview(now = new Date()) {
    const ay = trMonth(now);
    const [ayar, toplam, gorevler, anahtarlar, gecmis] = await Promise.all([
      this.ayar(),
      this.harcama(now),
      this.db.aiCall.groupBy({
        by: ['task'],
        where: { createdAt: { gte: ay.start, lt: ay.end } },
        _sum: { costMicroUsd: true },
        _count: { _all: true },
      }),
      this.db.aiTaskSwitch.findMany(),
      this.db.auditLog.findMany({
        where: { action: 'yz_siniri_degisti' },
        orderBy: { id: 'desc' },
        take: 10,
      }),
    ]);
    const kisiler = new Map(
      (
        await this.db.staffMember.findMany({
          where: { id: { in: gecmis.flatMap((g) => (g.actorId ? [g.actorId] : [])) } },
          select: { id: true, name: true },
        })
      ).map((s) => [s.id, s.name]),
    );
    const acik = new Map(anahtarlar.map((a) => [a.task, a.enabled]));
    const tutar = new Map(gorevler.map((g) => [g.task, g._sum.costMicroUsd ?? 0]));
    const sayi = new Map(gorevler.map((g) => [g.task, g._count._all]));
    const harcamaUsd = microToUsd(toplam);
    const tahminUsd = ay.gecenGun > 0 ? (harcamaUsd / ay.gecenGun) * ay.toplamGun : 0;
    return {
      ay: ay.ad,
      saglayici: this.provider?.ad ?? 'yok',
      harcamaUsd,
      tahminUsd,
      sinirUsd: ayar.limitUsd,
      uyariOrani: AI_BUDGET.uyariOrani,
      sinirda: toplam >= ayar.limitUsd * 1_000_000,
      gorevler: AI_TASK_KEYS.map((k) => ({
        key: k,
        ad: AI_TASKS[k].ad,
        kritik: AI_TASKS[k].kritik,
        acik: acik.get(k) ?? true,
        tutarUsd: microToUsd(tutar.get(k) ?? 0),
        cagri: sayi.get(k) ?? 0,
      })),
      maskeler: MASK_RULES,
      gecmis: gecmis.map((g) => ({
        once: (g.before as { sinirUsd?: number } | null)?.sinirUsd ?? null,
        sonra: (g.after as { sinirUsd?: number } | null)?.sinirUsd ?? null,
        kim: kisiler.get(g.actorId ?? '') ?? 'Çalışan',
        tarih: g.createdAt,
      })),
    };
  }

  /** Aylık sınır: yalnızca Sahip (yapay_zeka.butce tam), hemen geçerli, işlem kaydına girer (Karar 57) */
  async setLimit(actor: Actor, limitUsd: number, ip?: string) {
    if (actor.staff.role !== 'OWNER') throw new ForbiddenException('Aylık sınırı yalnızca sahip değiştirir');
    return this.db.$transaction(async (tx) => {
      const once = await tx.aiSetting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
      const sonra = await tx.aiSetting.update({
        where: { id: 1 },
        // Sınır artırılınca ay içindeki eşik bildirimleri yeniden gönderilebilir
        data: {
          limitUsd,
          updatedBy: actor.staff.id,
          ...(limitUsd > once.limitUsd ? { alertMonth: null, capMonth: null } : {}),
        },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: actor.staff.id,
          action: 'yz_siniri_degisti',
          entityType: 'setting',
          entityId: 'yapay_zeka.sinir',
          before: { sinirUsd: once.limitUsd },
          after: { sinirUsd: sonra.limitUsd },
          ip,
        },
        tx,
      );
      await this.outbox.add(tx, 'ayar.degisti', { key: 'yapay_zeka.sinir', limitUsd });
      return { sinirUsd: sonra.limitUsd };
    });
  }

  async setTask(actor: Actor, task: AiTask, enabled: boolean, ip?: string) {
    await this.db.$transaction(async (tx) => {
      const once = await tx.aiTaskSwitch.findUnique({ where: { task } });
      await tx.aiTaskSwitch.upsert({
        where: { task },
        create: { task, enabled, updatedBy: actor.staff.id },
        update: { enabled, updatedBy: actor.staff.id },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: actor.staff.id,
          action: 'yz_gorevi_degisti',
          entityType: 'setting',
          entityId: `yapay_zeka.${task}`,
          before: { acik: once?.enabled ?? true },
          after: { acik: enabled },
          ip,
        },
        tx,
      );
    });
  }
}
