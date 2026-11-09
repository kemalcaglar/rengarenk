import { type FeatureFlag, uuidv7 } from '@rengarenk/db';
import { type AbResult, abTest, type FeatureFlagKey, rolloutBucket, UI_EXPERIMENTS } from '@rengarenk/shared';
import type { Db, Tx } from '../database/prisma.js';

/**
 * Arayüz deneyleri (Karar 44): deney dönemi özellik anahtarından çıkar. Anahtar açık, kitle "Herkes" ve yüzde 1–99
 * iken dönem açıktır; yüzde 100 (B herkese açıldı) ya da kapatma (A'da kalındı) dönemi kazananıyla kapatır. Anahtar
 * değişikliğiyle aynı veritabanı işleminde çağrılır.
 */
export async function uiDeneySenkron(tx: Tx, key: string, f: FeatureFlag) {
  if (!UI_EXPERIMENTS[key as FeatureFlagKey]) return;
  const acik = await tx.uiExperimentRun.findFirst({ where: { flagKey: key, endedAt: null } });
  const suruyor = f.enabled && f.audience === 'ALL' && f.percent > 0 && f.percent < 100;
  if (suruyor && !acik) {
    await tx.uiExperimentRun.create({ data: { id: uuidv7(), flagKey: key, percent: f.percent } });
  } else if (suruyor && acik && acik.percent !== f.percent) {
    await tx.uiExperimentRun.update({ where: { id: acik.id }, data: { percent: f.percent } });
  } else if (!suruyor && acik) {
    const winner = f.enabled && f.percent >= 100 ? 'B' : f.enabled && f.audience !== 'ALL' ? null : 'A';
    await tx.uiExperimentRun.update({ where: { id: acik.id }, data: { endedAt: new Date(), winner } });
  }
}

/** Kullanıcının bu dönemdeki kolu: dilimi yüzdenin altındaysa B (anahtar açık) */
export const uiKol = (key: string, userId: string, percent: number): 'A' | 'B' =>
  rolloutBucket(key, userId) < percent ? 'B' : 'A';

/**
 * İstemcinin olayı: adımı gördü (ilk kez) ya da geçti. Açık dönem yoksa ya da platform tanımdakinden farklıysa yok
 * sayılır. Kol sunucuda hesaplanır.
 */
export async function uiDeneyOlayi(
  db: Db,
  key: string,
  userId: string,
  tur: 'gorus' | 'gecis',
  platform: string | undefined,
) {
  const tanim = UI_EXPERIMENTS[key as FeatureFlagKey];
  if (!tanim || platform?.toUpperCase() !== tanim.platform) return false;
  const run = await db.uiExperimentRun.findFirst({ where: { flagKey: key, endedAt: null } });
  if (!run) return false;
  const arm = uiKol(key, userId, run.percent);
  const now = new Date();
  await db.uiExperimentEvent.createMany({
    data: [{ runId: run.id, userId, arm, seenAt: now, ...(tur === 'gecis' ? { passedAt: now } : {}) }],
    skipDuplicates: true,
  });
  if (tur === 'gecis')
    await db.uiExperimentEvent.updateMany({
      where: { runId: run.id, userId, passedAt: null },
      data: { passedAt: now },
    });
  return true;
}

/** Dönemin sonucu: kol başına gören ve geçen */
export async function uiDeneySonuc(db: Db, runId: string): Promise<AbResult> {
  const rows = await db.uiExperimentEvent.groupBy({
    by: ['arm'],
    where: { runId },
    _count: { _all: true, passedAt: true },
  });
  const kol = (k: string) => rows.find((r) => r.arm === k)?._count;
  return abTest(kol('A')?._all ?? 0, kol('A')?.passedAt ?? 0, kol('B')?._all ?? 0, kol('B')?.passedAt ?? 0);
}
