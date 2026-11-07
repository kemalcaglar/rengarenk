import { Module } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { MeController } from './me.controller.js';

@Module({ imports: [AuthModule], controllers: [MeController], providers: [AuditService] })
export class MeModule {}
