import { Inject, Injectable, Logger } from '@nestjs/common';
import { type Db, PRISMA } from '../database/prisma.js';
import { NotificationService } from './notification.service.js';
import { SwitchService } from './switches.js';

const DAY = 86_400_000;

/**
 * Zamanlı akışlar (Karar 51): işçi her gün 09.30'da çalıştırır. Olayla tetiklenen akışlar (hoş geldin, talep süresi,
 * deneme, ödeme başarısız) olay eşlemesindedir; anahtarı kapalı akışın şablonu bildirim katmanında gönderilmez.
 */
@Injectable()
export class AutomationService {
  private readonly log = new Logger(AutomationService.name);
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly notifications: NotificationService,
    private readonly switches: SwitchService,
  ) {}

  async runDaily(now = new Date()) {
    const sonuc = { ilk_talep: 0, okumadin: 0, galeri7: 0 };
    if (await this.switches.akisAcik('ilk_talep')) sonuc.ilk_talep = await this.ilkTalep(now);
    if (await this.switches.akisAcik('okumadin')) sonuc.okumadin = await this.okumadin(now);
    if (await this.switches.akisAcik('galeri7')) sonuc.galeri7 = await this.galeriSessiz(now);
    return sonuc;
  }

  /** Üyeliğin 3. günü ve hiç talep yok (ticari: onay, haftada 2 ve sessiz saat bildirim katmanında) */
  private async ilkTalep(now: Date) {
    const kisiler = await this.db.user.findMany({
      where: {
        status: 'ACTIVE',
        createdAt: { gte: new Date(now.getTime() - 4 * DAY), lt: new Date(now.getTime() - 3 * DAY) },
        notifications: { none: { sablon: 'akis.ilk_talep' } },
      },
      select: { id: true },
      take: 1000,
    });
    let n = 0;
    for (const k of kisiler) {
      const talep = await this.db.demand.count({ where: { userId: k.id } });
      if (talep) continue;
      n += await this.notifications.notify({ userIds: [k.id], sablon: 'akis.ilk_talep', veri: {} });
    }
    return n;
  }

  /** Talebe gelen ilk mesaj 24–48 saattir okunmadı: alıcıya bir kez hatırlatma */
  private async okumadin(now: Date) {
    const sohbetler = await this.db.conversation.findMany({
      where: {
        origin: 'talep',
        buyerReadAt: null,
        createdAt: { gte: new Date(now.getTime() - 2 * DAY), lt: new Date(now.getTime() - DAY) },
      },
      include: {
        demand: { select: { title: true, headline: true } },
        sellerAccount: { select: { name: true, gallery: { select: { displayName: true } } } },
      },
      take: 1000,
    });
    let n = 0;
    for (const c of sohbetler) {
      n += await this.notifications.notify({
        userIds: [c.buyerUserId],
        sablon: 'akis.okumadin',
        veri: {
          conversationId: c.id,
          satici: c.sellerAccount.gallery?.displayName ?? 'Bir satıcı',
          talep: c.demand?.headline || c.demand?.title || 'Talebin',
        },
      });
    }
    return n;
  }

  /** Paketli galeri 7 gündür ilk mesaj göndermedi ve bu sürede portföyüne uyan talep var: sahip ve yöneticilere */
  private async galeriSessiz(now: Date) {
    const hafta = new Date(now.getTime() - 7 * DAY);
    const galeriler = await this.db.gallery.findMany({
      where: { plan: { in: ['baslangic', 'profesyonel', 'kurumsal'] }, account: { status: 'ACTIVE' } },
      select: { accountId: true, displayName: true },
    });
    let n = 0;
    for (const g of galeriler) {
      const [mesaj, eslesme, uyelik] = await Promise.all([
        this.db.conversation.count({
          where: { sellerAccountId: g.accountId, origin: 'talep', createdAt: { gte: hafta } },
        }),
        this.db.match.count({ where: { accountId: g.accountId, createdAt: { gte: hafta } } }),
        this.db.accountMember.findMany({
          where: { accountId: g.accountId, role: { in: ['OWNER', 'MANAGER'] } },
          select: { userId: true },
        }),
      ]);
      if (mesaj || !eslesme) continue;
      const ids = uyelik.map((u) => u.userId);
      const yakin = await this.db.notification.count({
        where: { userId: { in: ids }, sablon: 'akis.galeri_sessiz', createdAt: { gte: hafta } },
      });
      if (yakin) continue;
      n += await this.notifications.notify({
        userIds: ids,
        sablon: 'akis.galeri_sessiz',
        veri: { galeri: g.displayName, sayi: eslesme },
      });
    }
    if (n) this.log.log(`galeri hatırlatması: ${n} kişi`);
    return n;
  }
}
