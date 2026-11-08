import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { type Db, PRISMA } from '../database/prisma.js';

const saatYaz = (d: Date) =>
  new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  }).format(d);

/**
 * Yaptırımların denetimi (Karar 53): 24 saat askıdaki kişi ya da galeri hesabı ilk mesaj ve mesaj gönderemez. Kalıcı
 * engelleme önerisi onay beklerken askı sürer; öneri reddedilir ya da süresi dolarsa askı kalkar.
 */
@Injectable()
export class SanctionService {
  constructor(@Inject(PRISMA) private readonly db: Db) {}

  /** Etkin askı: bitiş zamanı (onay bekleyen kalıcı engelleme önerisinde null) */
  async aktifAski(userId: string, accountId?: string | null): Promise<{ until: Date | null } | null> {
    const now = new Date();
    const rows = await this.db.userSanction.findMany({
      where: {
        kind: 'aski',
        liftedAt: null,
        OR: [{ userId }, ...(accountId ? [{ accountId }] : [])],
        AND: [{ OR: [{ until: { gt: now } }, { approvalId: { not: null } }] }],
      },
      select: { until: true, approvalId: true },
    });
    if (!rows.length) return null;
    const bekleyen = rows.filter((r) => r.approvalId).map((r) => r.approvalId as string);
    const surenOnay = bekleyen.length
      ? await this.db.approval.count({
          where: { id: { in: bekleyen }, status: { in: ['PENDING', 'APPROVED'] } },
        })
      : 0;
    if (surenOnay) return { until: null };
    const sureli = rows.filter((r) => r.until && r.until > now).map((r) => r.until as Date);
    if (!sureli.length) return null;
    return { until: new Date(Math.max(...sureli.map((d) => d.getTime()))) };
  }

  async assertCanMessage(userId: string, accountId?: string | null) {
    const a = await this.aktifAski(userId, accountId);
    if (!a) return;
    throw new ForbiddenException(
      a.until
        ? `Moderasyon kararıyla ${saatYaz(a.until)} saatine kadar mesaj gönderemezsin. Bildirimlerden kararı görüp itiraz edebilirsin.`
        : 'Hesabın moderasyon incelemesinde; şimdilik mesaj gönderemezsin. Karar sana bildirilecek.',
    );
  }
}
