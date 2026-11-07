import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { approvalDecisionSchema } from '@rengarenk/shared';
import { z } from 'zod';
import { type ApprovalScope, ApprovalService } from '../approvals/approval.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { StaffOnly } from './permissions.js';
import { StaffGuard, type StaffRequest } from './staff.guard.js';

const scopeSchema = z.enum(['bekleyen', 'benim', 'gecmis']);

/**
 * Onay kuyruğu. Uç noktalar her çalışana açıktır; kim neyi görüp karara bağlayabileceği onay
 * motorunun kurallarıyla (APPROVAL_POLICIES) belirlenir. İstekler ilgili modüllerden açılır.
 */
@Controller('staff/approvals')
@UseGuards(StaffGuard)
export class StaffApprovalsController {
  constructor(private readonly approvals: ApprovalService) {}

  @Get()
  @StaffOnly()
  list(
    @Req() req: StaffRequest,
    @Query('kapsam', new DefaultValuePipe('bekleyen'), new ZodPipe(scopeSchema)) scope: ApprovalScope,
  ) {
    return this.approvals.list(req.staff, scope);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @StaffOnly()
  approve(
    @Req() req: StaffRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(approvalDecisionSchema)) body: z.output<typeof approvalDecisionSchema>,
  ) {
    return this.approvals.decide(req.staff, id, 'approve', body.note, req.ip).then(serialize);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @StaffOnly()
  reject(
    @Req() req: StaffRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(approvalDecisionSchema)) body: z.output<typeof approvalDecisionSchema>,
  ) {
    return this.approvals.decide(req.staff, id, 'reject', body.note, req.ip).then(serialize);
  }

  @Post(':id/cancel')
  @HttpCode(204)
  @StaffOnly()
  async cancel(@Req() req: StaffRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.approvals.cancel(req.staff, id, req.ip);
  }
}

const serialize = <T extends { amountKurus: bigint | null }>(a: T) => ({
  ...a,
  amountKurus: a.amountKurus?.toString() ?? null,
});
