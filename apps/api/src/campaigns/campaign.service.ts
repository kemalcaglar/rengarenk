import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { type Approval, Prisma, uuidv7 } from '@rengarenk/db';
import {
  type AbResult,
  abSummary,
  armOf,
  CAMPAIGN_APPROVAL_LIMIT,
  CAMPAIGN_CHANNELS,
  CAMPAIGN_GOALS,
  CAMPAIGN_STATUSES,
  type CampaignChannel,
  type CampaignStatus,
  type PermissionGrants,
  type SegmentRule,
  satisfies,
  type Variant,
} from '@rengarenk/shared';
import { ApprovalService } from '../approvals/approval.service.js';
import { ApprovalExecutor } from '../approvals/approval-executor.js';
import { AuditService } from '../audit/audit.service.js';
import { ENV, type Env } from '../config/env.js';
import { grafikNotu } from '../dashboard/dashboard.service.js';
import { ExperimentService } from '../dashboard/experiments.service.js';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';
import { isinmaLimiti } from '../notifications/commercial.js';
import { NotificationService } from '../notifications/notification.service.js';
import { SegmentService } from './segment.service.js';

const SUBJECT = 'campaign';
const PARCA = 500;

interface StaffActor {
  staff: { id: string; role: string; status: string };
  grants: PermissionGrants;
}

/**
 * Kampanyalar (Karar 49, 51; YonetimKampanya.dc.html › kampanya). Ticari ileti olarak bildirim katmanından gider
 * (`kampanya.duyuru`): onay, kanal tercihi, haftada 2 ve sessiz saat orada uygulanır. Gönderimden önce segment, kanal
 * ulaşımı, sıklık sınırına takılanlar ve ısınma tahmini gösterilir. Ulaşılabilir kişi 1.000'i aşarsa toplu gönderim
 * onayı (BULK_SEND; sahip ya da yönetici) gerekir; altında kampanya yetkisi "tam" olan zamanlar. İşçi zamanı gelince
 * segmenti yeniden hesaplayıp gönderir; sonuç kampanyaya ve kontrol paneli grafiğine not olarak düşer.
 */
@Injectable()
export class CampaignService {
  private readonly log = new Logger(CampaignService.name);

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    private readonly segments: SegmentService,
    private readonly approvals: ApprovalService,
    private readonly audit: AuditService,
    executor: ApprovalExecutor,
    private readonly deneyler: ExperimentService,
    @Optional() private readonly notifications?: NotificationService,
  ) {
    executor.register('BULK_SEND', (a, tx) => this.approved(a, tx));
  }

  /** Gönderim özeti: segment, kanallar, sıklık sınırı, ısınma (e-posta), maliyet */
  async estimate(segmentId: string, kanallar: CampaignChannel[]) {
    const s = await this.db.segment.findUnique({ where: { id: segmentId } });
    if (!s) throw new NotFoundException('Segment bulunamadı');
    const ids = await this.segments.userIds(s.rules as unknown as SegmentRule[]);
    const r = await this.segments.reach(ids);
    const uyg = kanallar.includes('uygulama');
    const ep = kanallar.includes('eposta');
    const gunBasi = new Date(new Date().setHours(0, 0, 0, 0));
    const bugunTicari = ep
      ? await this.db.delivery.count({
          where: { kanal: 'eposta', ticari: true, durum: 'gonderildi', sentAt: { gte: gunBasi } },
        })
      : 0;
    const limit = isinmaLimiti(
      this.env.EPOSTA_ISINMA_BASLANGIC ? new Date(this.env.EPOSTA_ISINMA_BASLANGIC) : null,
      new Date(),
    );
    const ertesi =
      ep && Number.isFinite(limit) ? Math.max(0, r.eposta - Math.max(0, limit - bugunTicari)) : 0;
    const ulasilan = Math.max(uyg ? r.uygulama : 0, ep ? r.eposta : 0);
    return {
      segment: s.name,
      toplam: r.toplam,
      satirlar: [
        ...(uyg
          ? [
              {
                ad: 'Uygulama içi',
                not: 'Kampanya bildirimine izin veren, ticari onaylı',
                deger: r.uygulama,
              },
              { ad: 'Push', not: 'Bunlardan bildirim izni açık cihazı olan', deger: r.push },
            ]
          : []),
        ...(ep ? [{ ad: 'E-posta', not: 'Ticari onaylı, e-postası doğrulanmış', deger: r.eposta }] : []),
        { ad: 'Sıklık sınırına takılan', not: 'Bu hafta 2 ticari ileti almış', deger: -r.sinirda },
        ...(ep
          ? [
              {
                ad: 'Isınma limiti nedeniyle ertesi gün',
                not: Number.isFinite(limit) ? `Ticari e-posta günlük limiti ${limit}` : 'Isınma tamamlandı',
                deger: ertesi,
              },
            ]
          : []),
      ],
      maliyet: 0,
      ulasilan: Math.max(0, ulasilan - r.sinirda),
      onayGerek: ulasilan > CAMPAIGN_APPROVAL_LIMIT,
    };
  }

  async list() {
    const rows = await this.db.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { segment: { select: { name: true, lastCount: true } } },
    });
    const onay = new Map(
      (
        await this.db.approval.findMany({
          where: { id: { in: rows.flatMap((r) => (r.approvalId ? [r.approvalId] : [])) } },
          select: { id: true, status: true },
        })
      ).map((a) => [a.id, a]),
    );
    const sonuc = await this.sonuclar(rows.filter((r) => r.status === 'gonderildi').map((r) => r.id));
    const abSonuc = new Map<string, AbResult>();
    for (const r of rows)
      if (r.variantB !== null && r.status === 'gonderildi')
        abSonuc.set(r.id, await this.deneyler.kampanyaSonuc(r.id));
    const kuponlar = new Map(
      (
        await this.db.coupon.findMany({
          where: { id: { in: rows.flatMap((r) => (r.couponId ? [r.couponId] : [])) } },
          select: { id: true, code: true, status: true },
        })
      ).map((k) => [k.id, k]),
    );
    const kanalAd = (k: string[]) =>
      k.map((x) => CAMPAIGN_CHANNELS.find((c) => c.key === x)?.ad.split(' (')[0] ?? x).join(' ve ');
    const tarih = (d: Date) =>
      new Intl.DateTimeFormat('tr-TR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Istanbul',
      }).format(d);
    return rows.map((r) => {
      const a = r.approvalId ? onay.get(r.approvalId) : undefined;
      const durum: CampaignStatus =
        r.status === 'onay_bekliyor' && a && a.status !== 'PENDING' && a.status !== 'APPROVED'
          ? 'reddedildi'
          : (r.status as CampaignStatus);
      const sn = sonuc.get(r.id);
      const kupon = r.couponId ? kuponlar.get(r.couponId) : undefined;
      const kuponNotu = kupon
        ? kupon.status === 'onaylandi'
          ? ` · kupon ${kupon.code}`
          : ` · kupon ${kupon.code} onayını bekliyor`
        : '';
      return {
        id: r.id,
        ad: r.name,
        hedef: CAMPAIGN_GOALS.find((g) => g.key === r.goal)?.ad ?? r.goal,
        kanal: kanalAd(r.channels),
        kitle: `${new Intl.NumberFormat('tr-TR').format(r.targetCount ?? r.segment.lastCount ?? 0)} kişi · ${r.segment.name}`,
        sonuc:
          durum === 'gonderildi' && r.sentAt
            ? `${tarih(r.sentAt)} · ${new Intl.NumberFormat('tr-TR').format(r.sentCount ?? 0)} kişiye gitti${
                abSonuc.has(r.id)
                  ? ` · ${abSummary(abSonuc.get(r.id) as AbResult, 'okunma')}`
                  : sn
                    ? ` · uygulamada okunma %${sn.okunma} · e-posta ${sn.eposta}`
                    : ''
              }`
            : durum === 'zamanlandi'
              ? `${tarih(r.scheduledAt)} gönderilecek${kuponNotu}`
              : durum === 'onay_bekliyor'
                ? '1.000 kişiyi aştığı için onay bekliyor'
                : durum === 'reddedildi'
                  ? 'Onaylanmadı'
                  : '',
        durum,
        durumAd: CAMPAIGN_STATUSES[durum].ad,
        bg: CAMPAIGN_STATUSES[durum].bg,
        fg: CAMPAIGN_STATUSES[durum].fg,
        iptalEdilebilir: durum === 'zamanlandi' || durum === 'onay_bekliyor',
      };
    });
  }

  /** Gönderilmiş kampanyaların sonucu: uygulama içi okunma ve e-posta teslimi (açılma ölçülmez) */
  private async sonuclar(ids: string[]) {
    if (!ids.length) return new Map<string, { okunma: number; eposta: number }>();
    const [b, okundu, ep] = await Promise.all([
      this.db.notification.groupBy({ by: ['campaignId'], where: { campaignId: { in: ids } }, _count: true }),
      this.db.notification.groupBy({
        by: ['campaignId'],
        where: { campaignId: { in: ids }, readAt: { not: null } },
        _count: true,
      }),
      this.db.delivery.groupBy({
        by: ['campaignId'],
        where: { campaignId: { in: ids }, kanal: 'eposta', durum: 'gonderildi' },
        _count: true,
      }),
    ]);
    const say = (rows: { campaignId: string | null; _count: number }[]) =>
      new Map(rows.map((r) => [r.campaignId as string, r._count]));
    const toplam = say(b);
    const ok = say(okundu);
    const e = say(ep);
    return new Map(
      ids.map((id) => [
        id,
        {
          okunma: toplam.get(id) ? Math.round(((ok.get(id) ?? 0) / (toplam.get(id) ?? 1)) * 100) : 0,
          eposta: e.get(id) ?? 0,
        },
      ]),
    );
  }

  async create(
    actor: StaffActor,
    b: {
      ad: string;
      hedef: string;
      segmentId: string;
      kanallar: CampaignChannel[];
      baslik: string;
      metin: string;
      dugme: string;
      url: string;
      zaman: string;
      kuponId?: string | null;
      b?: Variant | null;
    },
    ip?: string,
  ) {
    const zaman = new Date(b.zaman);
    if (zaman.getTime() < Date.now() - 60_000)
      throw new BadRequestException('Gönderim zamanı geçmişte olamaz');
    if (b.kuponId) {
      const k = await this.db.coupon.findUnique({ where: { id: b.kuponId } });
      if (!k || k.status === 'iptal') throw new BadRequestException('Kupon bulunamadı');
      if (k.endsAt <= zaman) throw new BadRequestException('Kuponun süresi gönderim zamanından önce bitiyor');
    }
    const tahmin = await this.estimate(b.segmentId, b.kanallar);
    if (!tahmin.ulasilan)
      throw new BadRequestException('Bu segmentte bu kanallardan ulaşılabilecek kimse yok');
    const tam = satisfies(actor.grants['kampanya.hazirla'], 'tam');
    // 1.000'i aşan ya da kampanya yetkisi "öneri" düzeyinde olan (ör. ajan) gönderim onaya gider
    const onayli = tahmin.onayGerek || !tam;
    if (onayli && !['tam', 'oneri'].includes(actor.grants.toplu_gonderim ?? ''))
      throw new ForbiddenException('1.000 kişiyi aşan gönderim için toplu gönderim yetkisi gerekir');
    const id = uuidv7();
    await this.db.$transaction(async (tx) => {
      await tx.campaign.create({
        data: {
          id,
          name: b.ad,
          goal: b.hedef,
          segmentId: b.segmentId,
          channels: b.kanallar,
          title: b.baslik,
          body: b.metin,
          buttonText: b.dugme,
          url: b.url,
          scheduledAt: zaman,
          couponId: b.kuponId ?? null,
          variantB: b.b ? (b.b as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
          status: onayli ? 'onay_bekliyor' : 'zamanlandi',
          estimate: tahmin as unknown as Prisma.InputJsonValue,
          targetCount: tahmin.ulasilan,
          createdBy: actor.staff.id,
        },
      });
      if (onayli) {
        const a = await this.approvals.request(
          actor,
          {
            kind: 'BULK_SEND',
            subjectType: SUBJECT,
            subjectId: id,
            title: `Kampanya: ${b.ad} · ${new Intl.NumberFormat('tr-TR').format(tahmin.ulasilan)} kişi`,
            reason: `${tahmin.segment} · ${b.kanallar.join(', ')} · ${b.baslik}`.slice(0, 1000),
            payload: { kampanya: id, kisi: tahmin.ulasilan, kanallar: b.kanallar },
          },
          tx,
          ip,
        );
        await tx.campaign.update({ where: { id }, data: { approvalId: a.id } });
      }
      await this.audit.record(
        {
          actorType: actor.staff.role === 'AGENT' ? 'AGENT' : 'STAFF',
          actorId: actor.staff.id,
          action: 'kampanya_olusturuldu',
          entityType: 'campaign',
          entityId: id,
          after: { kisi: tahmin.ulasilan, onay: onayli },
          ip,
        },
        tx,
      );
    });
    return this.list();
  }

  /** Toplu gönderim onaylandı (işçideki yürütücü) */
  async approved(a: Approval, tx: Tx): Promise<Prisma.InputJsonValue> {
    if (a.subjectType !== SUBJECT) throw new Error('Kampanya onayı değil');
    const k = await tx.campaign.updateMany({
      where: { id: a.subjectId, approvalId: a.id, status: 'onay_bekliyor' },
      data: { status: 'zamanlandi' },
    });
    if (!k.count) return { durum: 'zaten_zamanlandi' };
    return { durum: 'zamanlandi' };
  }

  async cancel(actor: StaffActor, id: string, ip?: string) {
    const c = await this.db.campaign.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Kampanya bulunamadı');
    const k = await this.db.campaign.updateMany({
      where: { id, status: { in: ['zamanlandi', 'onay_bekliyor', 'taslak'] } },
      data: { status: 'iptal' },
    });
    if (!k.count) throw new ConflictException('Gönderilmiş kampanya iptal edilemez');
    if (c.approvalId) await this.approvals.cancel(actor, c.approvalId, ip).catch(() => undefined);
    await this.audit.record({
      actorType: 'STAFF',
      actorId: actor.staff.id,
      action: 'kampanya_iptal',
      entityType: 'campaign',
      entityId: id,
      ip,
    });
    return this.list();
  }

  /** İşçi: zamanı gelen kampanyaları gönderir (segment yeniden hesaplanır) */
  async dispatchDue(now = new Date()) {
    if (!this.notifications) return 0;
    const due = await this.db.campaign.findMany({
      where: { status: 'zamanlandi', scheduledAt: { lte: now } },
      include: { segment: true },
      take: 5,
    });
    let n = 0;
    for (const c of due) {
      if (c.couponId) {
        const kupon = await this.db.coupon.findUnique({ where: { id: c.couponId } });
        if (kupon?.status === 'onay_bekliyor' && kupon.endsAt > now) continue; // onay bekleniyor
        if (kupon?.status !== 'onaylandi' || kupon.endsAt <= now) {
          await this.db.campaign.updateMany({
            where: { id: c.id, status: 'zamanlandi' },
            data: { status: 'iptal' },
          });
          this.log.warn(`kampanya ${c.id}: kupon geçersiz, gönderilmedi`);
          continue;
        }
      }
      const k = await this.db.campaign.updateMany({
        where: { id: c.id, status: 'zamanlandi' },
        data: { status: 'gonderiliyor' },
      });
      if (!k.count) continue;
      const ids = await this.segments.userIds(c.segment.rules as unknown as SegmentRule[], now);
      // A/B: kişi kimliğinden sabit kol; B'ye ikinci sürüm gider (kol saklanmaz, sonuçta yeniden hesaplanır)
      const v = c.variantB as unknown as Variant | null;
      const kollar: [string[], { baslik: string; metin: string; dugme: string }][] = v
        ? [
            [
              ids.filter((u) => armOf(u, c.id) === 'A'),
              { baslik: c.title, metin: c.body, dugme: c.buttonText },
            ],
            [ids.filter((u) => armOf(u, c.id) === 'B'), { baslik: v.baslik, metin: v.metin, dugme: v.dugme }],
          ]
        : [[ids, { baslik: c.title, metin: c.body, dugme: c.buttonText }]];
      let gonderilen = 0;
      for (const [kisiler, icerik] of kollar)
        for (let i = 0; i < kisiler.length; i += PARCA) {
          gonderilen += await this.notifications.notify({
            userIds: kisiler.slice(i, i + PARCA),
            sablon: 'kampanya.duyuru',
            veri: { ...icerik, url: c.url },
            kanallar: c.channels as CampaignChannel[],
            campaignId: c.id,
          });
        }
      await this.db.$transaction(async (tx) => {
        await tx.campaign.update({
          where: { id: c.id },
          data: { status: 'gonderildi', sentAt: new Date(), sentCount: gonderilen, targetCount: ids.length },
        });
        await grafikNotu(tx, new Date(), `Kampanya: ${c.name}`, 'kampanya', c.id);
        await this.audit.record(
          {
            actorType: 'SYSTEM',
            action: 'kampanya_gonderildi',
            entityType: 'campaign',
            entityId: c.id,
            after: { segment: ids.length, gonderilen },
          },
          tx,
        );
      });
      this.log.log(`kampanya ${c.id}: ${gonderilen}/${ids.length}`);
      n++;
    }
    return n;
  }
}
