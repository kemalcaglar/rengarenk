import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { StaffModule } from '../staff/staff.module.js';
import { MatchIndexService } from './match-index.service.js';
import {
  GalleryMatchesController,
  MyMatchesController,
  StaffMatchingController,
} from './matching.controller.js';
import { MatchingService } from './matching.service.js';

/** Eşleştirme (Aşama 5): talep ↔ portföy aracı skoru, galeri eşleşmeleri, konsoldaki deneme alanı. */
@Module({
  imports: [AuthModule, StaffModule],
  controllers: [GalleryMatchesController, MyMatchesController, StaffMatchingController],
  providers: [MatchingService, MatchIndexService, OutboxService],
  exports: [MatchingService],
})
export class MatchingModule {}

/** İşçi için: talep ve araç olaylarında eşleşmelerin yeniden hesaplanması. */
@Module({
  providers: [MatchingService, MatchIndexService, OutboxService],
  exports: [MatchingService],
})
export class MatchingWorkerModule {}
