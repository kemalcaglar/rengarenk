import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { categoryDefinitionSchema } from '@rengarenk/shared';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AccessClaims } from '../auth/auth.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { RequirePermission } from '../staff/permissions.js';
import { StaffGuard } from '../staff/staff.guard.js';
import { MatchingService } from './matching.service.js';

type AuthedRequest = { user: AccessClaims };

const simulateSchema = z
  .object({
    definition: categoryDefinitionSchema,
    talepNo: z.number().int().positive().optional(),
  })
  .strict();

/** Galeri paneli › Eşleşmeler (Karar 06.2) */
@Controller('gallery/:accountId/matches')
@UseGuards(AuthGuard)
export class GalleryMatchesController {
  constructor(private readonly matching: MatchingService) {}

  @Get()
  list(
    @Req() req: AuthedRequest,
    @Param('accountId', new ParseUUIDPipe()) accountId: string,
    @Query('arac') arac?: string,
  ) {
    const id = arac && z.uuid().safeParse(arac).success ? arac : undefined;
    return this.matching.listForGallery(req.user.sub, accountId, id);
  }

  @Post('seen')
  @HttpCode(200)
  seen(@Req() req: AuthedRequest, @Param('accountId', new ParseUUIDPipe()) accountId: string) {
    return this.matching.markSeen(req.user.sub, accountId);
  }
}

/** Ana sayfa ve araç sayfası: girişli kullanıcıya özel eşleşmeler (Karar 22, PortfoyArac.dc.html) */
@Controller()
@UseGuards(AuthGuard)
export class MyMatchesController {
  constructor(private readonly matching: MatchingService) {}

  @Get('me/matches')
  home(@Req() req: AuthedRequest) {
    return this.matching.home(req.user.sub);
  }

  @Get('araclar/:no/uyum')
  fit(@Req() req: AuthedRequest, @Param('no', new ParseIntPipe()) no: number) {
    return this.matching.fitForViewer(no, req.user.sub);
  }
}

/** Konsol › Eşleştirme ayarı › Deneme alanı (YonetimIcerik.dc.html) */
@Controller('staff/categories/:id/matching')
@UseGuards(StaffGuard)
export class StaffMatchingController {
  constructor(private readonly matching: MatchingService) {}

  @Post('simulate')
  @HttpCode(200)
  @RequirePermission('kategori.ayarla')
  simulate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(simulateSchema)) b: z.output<typeof simulateSchema>,
  ) {
    return this.matching.simulate(id, b.definition, b.talepNo);
  }
}
