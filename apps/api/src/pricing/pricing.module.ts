import {
  Body,
  Controller,
  Get,
  HttpCode,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { type PriceBook, priceExperimentSchema, priceProposalSchema } from '@rengarenk/shared';
import type { z } from 'zod';
import { ZodPipe } from '../common/zod.pipe.js';
import { RequirePermission } from '../staff/permissions.js';
import { StaffGuard, type StaffRequest } from '../staff/staff.guard.js';
import { StaffModule } from '../staff/staff.module.js';
import { PriceExperimentService } from './price-experiments.service.js';
import { PricingService } from './pricing.service.js';

/** Konsol › Sistem › Kurallar ve fiyatlar (YonetimSistem.dc.html; Karar 47, 56) */
@Controller('staff/pricing')
@UseGuards(StaffGuard)
export class PricingStaffController {
  constructor(
    private readonly pricing: PricingService,
    private readonly deneyler: PriceExperimentService,
  ) {}

  @Get()
  @RequirePermission('rapor.gor')
  overview() {
    return this.pricing.overview();
  }

  /** Fiyat deneyleri (Karar 44, 56): liste, öneri (Sahip onaylar), durdurma, kazananı fiyat listesine önerme */
  @Get('experiments')
  @RequirePermission('rapor.gor')
  experiments() {
    return this.deneyler.list();
  }

  @Post('experiments')
  @HttpCode(200)
  @RequirePermission('fiyat.degistir', 'oneri')
  createExperiment(
    @Req() req: StaffRequest,
    @Body(new ZodPipe(priceExperimentSchema)) b: z.output<typeof priceExperimentSchema>,
  ) {
    return this.deneyler.create(req.staff, b, req.ip);
  }

  @Post('experiments/:id/stop')
  @HttpCode(200)
  @RequirePermission('fiyat.degistir', 'oneri')
  stopExperiment(@Req() req: StaffRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.deneyler.durdur(req.staff, id, req.ip);
  }

  @Post('experiments/:id/propose')
  @HttpCode(200)
  @RequirePermission('fiyat.degistir', 'oneri')
  proposeWinner(@Req() req: StaffRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.deneyler.oner(req.staff, id, req.ip);
  }

  /** Değişikliği onaya gönderir (fiyat ve paket değişikliği; Sahip onaylar) */
  @Post()
  @HttpCode(200)
  @RequirePermission('fiyat.degistir', 'oneri')
  propose(
    @Req() req: StaffRequest,
    @Body(new ZodPipe(priceProposalSchema)) b: z.output<typeof priceProposalSchema>,
  ) {
    return this.pricing.propose(req.staff, b.kitap as PriceBook, b.yururluk, b.not, req.ip);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermission('fiyat.degistir', 'oneri')
  cancel(@Req() req: StaffRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.pricing.cancel(req.staff, id, req.ip);
  }
}

/** Herkese açık: yürürlükteki web fiyatları ve paketler (web sihirbazı, Taleplerim, galeri paketleri) */
@Controller('fiyatlar')
export class PricingPublicController {
  constructor(private readonly pricing: PricingService) {}

  @Get()
  async current() {
    const k = await this.pricing.current();
    return { urunler: k.urunler, paketler: k.paketler };
  }
}

@Module({ imports: [StaffModule], controllers: [PricingStaffController, PricingPublicController] })
export class PricingModule {}
