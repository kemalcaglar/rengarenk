import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { FeatureFlagService } from './feature-flag.service.js';

/**
 * Bakımdayken de çalışan yollar: yönetim konsolu, sağlık, ölçüm, anahtar durumu, API belgeleri ve ödeme kuruluşunun
 * bildirimi (bakımda gelen ödeme kaybolmasın).
 */
const ALWAYS_OPEN = ['/staff', '/health', '/metrics', '/flags', '/docs', '/odeme/bildirim'];

/**
 * "Tüm site" bakımdayken kullanıcıya dönük her uç nokta 503 ve duyuru metniyle yanıt verir
 * (tasarım: YonetimSistem › Bakım modu). Web ve mobil bu yanıtta bakım sayfasını gösterir.
 */
@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(private readonly flags: FeatureFlagService) {}

  async canActivate(ctx: ExecutionContext) {
    if (ctx.getType() !== 'http') return true;
    const url = ctx.switchToHttp().getRequest<{ url: string }>().url;
    if (ALWAYS_OPEN.some((p) => url === p || url.startsWith(`${p}/`) || url.startsWith(`${p}?`))) return true;
    const m = await this.flags.maintenance('tum');
    if (m.on) throw new ServiceUnavailableException({ message: m.note, bakim: 'tum' });
    return true;
  }
}
