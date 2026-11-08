import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { RequirePermission } from './permissions.js';
import { StaffGuard } from './staff.guard.js';

/**
 * Entegrasyonlar ekranının durumu (tasarım: YonetimSistem › Entegrasyonlar). Gizli anahtarlar hiçbir zaman
 * dönmez; yalnızca hangi sağlayıcının bağlı olduğu ve katalog kaynaklarının son durumu.
 */
@Controller('staff/integrations')
@UseGuards(StaffGuard)
export class IntegrationsController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(PRISMA) private readonly db: Db,
  ) {}

  @Get()
  @RequirePermission('kategori.ayarla')
  async list() {
    const sources = await this.db.catalogSource.findMany({
      select: {
        key: true,
        name: true,
        active: true,
        autoFetch: true,
        lastSuccessAt: true,
        lastCheckedAt: true,
        lastError: true,
        attribution: true,
      },
    });
    const [aliasPending, photoGenerations] = await Promise.all([
      this.db.catalogAlias.count({ where: { status: 'onerildi' } }),
      this.db.catalogGeneration.count({
        where: {
          source: 'wikidata',
          images: { some: { status: 'aday' } },
          NOT: { images: { some: { status: 'secildi' } } },
        },
      }),
    ]);
    return {
      sms: {
        // console ve test yalnızca geliştirmede; gerçek sağlayıcı hesabı açılınca değişir
        ana: this.env.SMS_PROVIDER,
        yedek: this.env.SMS_FALLBACK_PROVIDER ?? null,
      },
      sources,
      bekleyen: { adEsleme: aliasPending, fotograf: photoGenerations },
    };
  }
}
