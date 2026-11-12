import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditService } from '../audit/audit.service.js';
import { ENV, type Env } from '../config/env.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { SignupService } from './signup.service.js';
import {
  APPLE_VERIFIER,
  createAppleVerifier,
  createUserIdentityProvider,
  USER_IDP,
} from './user-identity.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({ secret: env.JWT_SECRET, signOptions: { issuer: 'rengarenk' } }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SignupService,
    AuthGuard,
    AuditService,
    OutboxService,
    { provide: USER_IDP, inject: [ENV], useFactory: (env: Env) => createUserIdentityProvider(env) },
    { provide: APPLE_VERIFIER, inject: [ENV], useFactory: (env: Env) => createAppleVerifier(env) },
  ],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
