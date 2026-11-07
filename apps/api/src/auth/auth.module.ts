import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditService } from '../audit/audit.service.js';
import { ENV, type Env } from '../config/env.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({ secret: env.JWT_SECRET, signOptions: { issuer: 'rengarenk' } }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, AuditService, OutboxService],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
