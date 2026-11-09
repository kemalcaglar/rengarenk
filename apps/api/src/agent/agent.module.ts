import {
  Body,
  Controller,
  Get,
  Global,
  HttpCode,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  AI_TASK_KEYS,
  type AiTask,
  agentAskSchema,
  agentRunSchema,
  aiBudgetSchema,
  aiTaskSwitchSchema,
} from '@rengarenk/shared';
import { z } from 'zod';
import { AI_PROVIDER, createAiProvider } from '../ai/ai.provider.js';
import { AiGateway } from '../ai/ai-gateway.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { ENV, type Env } from '../config/env.js';
import { FeatureFlagService } from '../flags/feature-flag.service.js';
import { FlagsModule } from '../flags/flags.module.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { RequirePermission, StaffOnly } from '../staff/permissions.js';
import { StaffGuard, type StaffRequest } from '../staff/staff.guard.js';
import { StaffModule } from '../staff/staff.module.js';
import { AgentService } from './agent.service.js';
import { AgentAsk } from './agent-ask.js';

const taskSchema = z.enum(AI_TASK_KEYS as [AiTask, ...AiTask[]]);

/** Konsol › Ekip ve yetki › Rengarenk Ajanı (YonetimEkip.dc.html › ajan; Karar 41) */
@Controller('staff/agent')
@UseGuards(StaffGuard)
export class AgentStaffController {
  constructor(
    private readonly agent: AgentService,
    private readonly ask: AgentAsk,
    private readonly flags: FeatureFlagService,
  ) {}

  @Get()
  @RequirePermission('rapor.gor', 'maskeli')
  overview(@Req() req: StaffRequest) {
    return this.agent.overview(req.staff);
  }

  /** Tek tuşla tamamen durdurma ya da yeniden başlatma (`ajan` özellik anahtarı, işlem kaydına girer) */
  @Post('run')
  @HttpCode(200)
  @RequirePermission('sistem.ayarla')
  async run(
    @Req() req: StaffRequest,
    @Body(new ZodPipe(agentRunSchema)) body: z.output<typeof agentRunSchema>,
  ) {
    await this.flags.update(req.staff, 'ajan', { enabled: body.calisiyor }, req.ip);
    AgentService.unut();
    return { calisiyor: body.calisiyor };
  }

  /** Geri alma: yetki işlemin türüne göre serviste denetlenir (ör. mesaj gizleme için sikayet.coz) */
  @Post('actions/:id/undo')
  @HttpCode(204)
  @StaffOnly()
  async undo(@Req() req: StaffRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.agent.undo(req.staff, id, req.ip);
  }

  @Post('suggestions/:id/close')
  @HttpCode(204)
  @RequirePermission('sistem.ayarla')
  async close(@Req() req: StaffRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.agent.oneriKapat(req.staff, id);
  }

  @Post('ask')
  @HttpCode(200)
  @RequirePermission('rapor.gor', 'maskeli')
  sor(@Body(new ZodPipe(agentAskSchema)) body: z.output<typeof agentAskSchema>) {
    return this.ask.sor(body.soru);
  }
}

/** Konsol › Sistem › Yapay zekâ ve bütçe (YonetimSistem.dc.html › yz; Karar 57) */
@Controller('staff/ai')
@UseGuards(StaffGuard)
export class AiStaffController {
  constructor(private readonly ai: AiGateway) {}

  @Get()
  @RequirePermission('sistem.ayarla')
  overview() {
    return this.ai.overview();
  }

  @Post('limit')
  @HttpCode(200)
  @RequirePermission('yapay_zeka.butce')
  limit(@Req() req: StaffRequest, @Body(new ZodPipe(aiBudgetSchema)) body: z.output<typeof aiBudgetSchema>) {
    return this.ai.setLimit(req.staff, body.limitUsd, req.ip);
  }

  @Post('tasks/:task')
  @HttpCode(204)
  @RequirePermission('yapay_zeka.butce')
  async task(
    @Req() req: StaffRequest,
    @Param('task', new ZodPipe(taskSchema)) task: AiTask,
    @Body(new ZodPipe(aiTaskSwitchSchema)) body: z.output<typeof aiTaskSwitchSchema>,
  ) {
    await this.ai.setTask(req.staff, task, body.enabled, req.ip);
  }
}

/**
 * Yapay zekâ ağ geçidi ve ajan çekirdeği: API ve işçide ortak, her modül enjekte edebilir (moderasyon, galeri
 * başvurusu, bildirim itibarı ajanın işlemini buraya yazar).
 */
@Global()
@Module({
  providers: [
    { provide: AI_PROVIDER, inject: [ENV], useFactory: (env: Env) => createAiProvider(env) },
    AiGateway,
    AgentService,
    AgentAsk,
    AuditService,
    OutboxService,
  ],
  exports: [AI_PROVIDER, AiGateway, AgentService, AgentAsk],
})
export class AgentCoreModule {}

@Module({
  imports: [AuthModule, StaffModule, FlagsModule],
  controllers: [AgentStaffController, AiStaffController],
})
export class AgentModule {}
