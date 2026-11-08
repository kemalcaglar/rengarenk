import { Module } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { StaffModule } from '../staff/staff.module.js';
import {
  GalleryApplicationController,
  GalleryController,
  MyInvitesController,
  PublicGalleryController,
  StaffGalleryApplicationsController,
} from './gallery.controller.js';
import { GalleryService } from './gallery.service.js';
import { GalleryApplicationService } from './gallery-application.service.js';
import { VerifierFactory } from './verification.js';

/** Galeri hesapları (Aşama 4): kurumsal başvuru, onay kuyruğu, galeri profili ve ekip (Karar 03, 12.5, 17, 20). */
@Module({
  imports: [AuthModule, StaffModule],
  controllers: [
    GalleryApplicationController,
    GalleryController,
    MyInvitesController,
    PublicGalleryController,
    StaffGalleryApplicationsController,
  ],
  providers: [GalleryApplicationService, GalleryService, VerifierFactory, AuditService, OutboxService],
  exports: [GalleryApplicationService, GalleryService],
})
export class GalleriesModule {}

/** İşçi için: başvuru kontrolleri ve deneme hatırlatmaları. */
@Module({
  providers: [GalleryApplicationService, GalleryService, VerifierFactory, AuditService, OutboxService],
  exports: [GalleryApplicationService, GalleryService],
})
export class GalleriesWorkerModule {}
