import { Module } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { EidsFactory } from './eids.js';
import {
  ApiKeyGuard,
  IntegrationController,
  PortfolioController,
  PublicPortfolioController,
} from './portfolio.controller.js';
import { PortfolioService } from './portfolio.service.js';
import { PortfolioBulkService } from './portfolio-bulk.service.js';

/** Galeri portföyü (Aşama 4): araç, fotoğraf, ekspertiz, EİDS, toplu yükleme, API (Karar 07, 17). */
@Module({
  imports: [AuthModule],
  controllers: [PortfolioController, PublicPortfolioController, IntegrationController],
  providers: [PortfolioService, PortfolioBulkService, ApiKeyGuard, EidsFactory, AuditService, OutboxService],
  exports: [PortfolioService],
})
export class PortfolioModule {}

/** İşçi için: EİDS isteklerinin işlenmesi. */
@Module({
  providers: [PortfolioService, EidsFactory, AuditService, OutboxService],
  exports: [PortfolioService],
})
export class PortfolioWorkerModule {}
