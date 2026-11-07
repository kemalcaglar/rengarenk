import { Body, Controller, Get, HttpCode, Inject, Ip, Post, Req, UseGuards } from '@nestjs/common';
import { otpRequestSchema, otpVerifySchema, refreshSchema } from '@rengarenk/shared';
import type { z } from 'zod';
import { ZodPipe } from '../common/zod.pipe.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { AuthGuard } from './auth.guard.js';
import { type AccessClaims, AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(PRISMA) private readonly db: Db,
  ) {}

  @Post('otp/request')
  @HttpCode(200)
  request(@Body(new ZodPipe(otpRequestSchema)) body: z.output<typeof otpRequestSchema>, @Ip() ip: string) {
    return this.auth.requestOtp(body.phone, ip);
  }

  @Post('otp/verify')
  @HttpCode(200)
  verify(@Body(new ZodPipe(otpVerifySchema)) body: z.output<typeof otpVerifySchema>, @Ip() ip: string) {
    return this.auth.verifyOtp(body.challengeId, body.code, body.platform, ip, body.consents);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body(new ZodPipe(refreshSchema)) body: z.output<typeof refreshSchema>) {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async logout(@Req() req: { user: AccessClaims }) {
    await this.auth.logout(req.user.sid);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@Req() req: { user: AccessClaims }) {
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: req.user.sub },
      select: {
        id: true,
        displayName: true,
        status: true,
        memberships: { select: { accountId: true, role: true } },
      },
    });
    return user;
  }
}
