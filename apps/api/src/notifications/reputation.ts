import { Inject, Injectable, Logger } from '@nestjs/common';
import { AgentService } from '../agent/agent.service.js';
import { AuditService } from '../audit/audit.service.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { SwitchService } from './switches.js';

const DAY = 86_400_000;

/** Gönderen itibarı sınırları (YonetimKampanya.dc.html › Bildirim merkezi): 7 günlük pencere */
export const ITIBAR_SINIR = {
  /** Kalıcı geri dönme (bounce) oranı */
  geriDonme: 0.02,
  /** Spam şikâyeti oranı (ticari e-postaya göre) */
  sikayet: 0.001,
  /** Oran bu kadar gönderimden azsa karar verilmez (küçük sayıda tek şikâyet oranı uçurur) */
  enAzGonderim: 200,
};

export interface ItibarOranlari {
  gonderilen: number;
  ticariGonderilen: number;
  geriDonme: number | null;
  sikayet: number | null;
}

/**
 * E-posta itibarı: son 7 günde kalıcı geri dönme ve şikâyet oranı. Sınırlardan biri aşılırsa ticari e-posta
 * kendiliğinden durur (işlemsel e-posta, doğrulama kodu ve ödeme iletileri gitmeye devam eder); işlem kaydına ve
 * outbox'a (`bildirim.ticari_durduruldu`) yazılır, yeniden başlatmak konsoldan elle yapılır.
 */
@Injectable()
export class ReputationService {
  private readonly log = new Logger(ReputationService.name);
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly switches: SwitchService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly agent: AgentService,
  ) {}

  async oranlar(now = new Date()): Promise<ItibarOranlari> {
    const once = new Date(now.getTime() - 7 * DAY);
    const [gonderilen, ticariGonderilen, geri, sikayet] = await Promise.all([
      this.db.delivery.count({ where: { kanal: 'eposta', durum: 'gonderildi', sentAt: { gte: once } } }),
      this.db.delivery.count({
        where: { kanal: 'eposta', ticari: true, durum: 'gonderildi', sentAt: { gte: once } },
      }),
      this.db.emailSuppression.count({ where: { reason: 'kalici_hata', updatedAt: { gte: once } } }),
      this.db.emailSuppression.count({ where: { reason: 'sikayet', updatedAt: { gte: once } } }),
    ]);
    return {
      gonderilen,
      ticariGonderilen,
      geriDonme: gonderilen ? geri / gonderilen : null,
      sikayet: ticariGonderilen ? sikayet / ticariGonderilen : null,
    };
  }

  /** İşçi saatte bir çağırır. Durdurduysa nedeni döner. */
  async denetle(now = new Date()): Promise<string | null> {
    if (!(await this.switches.ticariAcik())) return null;
    // Durdurma düğmesi: ajan durunca bu otomatik işlem de yapılmaz (Karar 41)
    if (!(await this.agent.calisiyor())) return null;
    const o = await this.oranlar(now);
    const neden =
      o.gonderilen >= ITIBAR_SINIR.enAzGonderim && (o.geriDonme ?? 0) > ITIBAR_SINIR.geriDonme
        ? `Geri dönme oranı %${((o.geriDonme ?? 0) * 100).toFixed(1)} (sınır %2)`
        : o.ticariGonderilen >= ITIBAR_SINIR.enAzGonderim && (o.sikayet ?? 0) > ITIBAR_SINIR.sikayet
          ? `Spam şikâyeti oranı %${((o.sikayet ?? 0) * 100).toFixed(2)} (sınır %0,1)`
          : null;
    if (!neden) return null;
    await this.db.$transaction(async (tx) => {
      await tx.notificationSwitch.upsert({
        where: { key: 'ticari' },
        create: { key: 'ticari', enabled: false, updatedBy: null },
        update: { enabled: false, updatedBy: null },
      });
      await this.audit.record(
        {
          actorType: 'AGENT',
          action: 'ticari_gonderim_durdu',
          entityType: 'notification_switch',
          entityId: 'ticari',
          after: { neden, ...o },
        },
        tx,
      );
      await this.agent.kaydet(tx, {
        kind: 'ticari_durdur',
        title: 'Ticari e-posta gönderimi durduruldu',
        reason: `${neden}; işlemsel iletiler sürüyor`,
        confidence: 'Kural',
        entityType: 'notification_switch',
        entityId: 'ticari',
        undo: {},
      });
      await this.outbox.add(tx, 'bildirim.ticari_durduruldu', { neden });
    });
    this.switches.temizle();
    this.log.warn(`ticari e-posta durduruldu: ${neden}`);
    return neden;
  }
}
