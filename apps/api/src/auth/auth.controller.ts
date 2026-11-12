import { Body, Controller, Get, HttpCode, Inject, Ip, Post, Req, UseGuards } from '@nestjs/common';
import {
  appleLoginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  googleCallbackSchema,
  googleStartSchema,
  loginLinkSchema,
  loginSchema,
  refreshSchema,
  registerResendSchema,
  registerStartSchema,
  registerVerifySchema,
  resetPasswordSchema,
} from '@rengarenk/shared';
import type { z } from 'zod';
import { ZodPipe } from '../common/zod.pipe.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { AuthGuard } from './auth.guard.js';
import { type AccessClaims, AuthService } from './auth.service.js';
import { SignupService } from './signup.service.js';

/**
 * Üyelik ve giriş (Karar 18): Üye ol (bilgiler + telefon kodu) ve Giriş yap (e-posta ve şifre, Google, Apple) ayrı
 * uçlardır. Telefon kodu yalnızca üyelikte, numara değiştirirken ve hassas işlem onayında gider.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly signup: SignupService,
    @Inject(PRISMA) private readonly db: Db,
  ) {}

  /** Üye ol, 1. adım: bilgiler; telefona kod gider */
  @Post('register')
  @HttpCode(200)
  register(
    @Body(new ZodPipe(registerStartSchema)) b: z.output<typeof registerStartSchema>,
    @Ip() ip: string,
  ) {
    return this.signup.start(b, ip);
  }

  @Post('register/resend')
  @HttpCode(200)
  resend(
    @Body(new ZodPipe(registerResendSchema)) b: z.output<typeof registerResendSchema>,
    @Ip() ip: string,
  ) {
    return this.signup.resend(b.challengeId, ip);
  }

  /** Üye ol, 2. adım: kod doğrulanınca hesap açılır ve oturum başlar */
  @Post('register/verify')
  @HttpCode(200)
  registerVerify(
    @Body(new ZodPipe(registerVerifySchema)) b: z.output<typeof registerVerifySchema>,
    @Ip() ip: string,
  ) {
    return this.signup.verify(b.challengeId, b.code, ip, b.kurulum);
  }

  /** E-posta ve şifreyle giriş */
  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodPipe(loginSchema)) b: z.output<typeof loginSchema>, @Ip() ip: string) {
    return this.signup.login(b, ip);
  }

  @Post('google/start')
  @HttpCode(200)
  googleStart(@Body(new ZodPipe(googleStartSchema)) b: z.output<typeof googleStartSchema>, @Ip() ip: string) {
    return this.signup.googleStart(b.platform, ip);
  }

  @Post('google/callback')
  @HttpCode(200)
  googleCallback(
    @Body(new ZodPipe(googleCallbackSchema)) b: z.output<typeof googleCallbackSchema>,
    @Ip() ip: string,
  ) {
    return this.signup.googleCallback(b.state, b.code, ip, b.kurulum);
  }

  @Post('apple')
  @HttpCode(200)
  apple(@Body(new ZodPipe(appleLoginSchema)) b: z.output<typeof appleLoginSchema>, @Ip() ip: string) {
    return this.signup.appleLogin(b, ip);
  }

  @Post('password/forgot')
  @HttpCode(200)
  forgot(
    @Body(new ZodPipe(forgotPasswordSchema)) b: z.output<typeof forgotPasswordSchema>,
    @Ip() ip: string,
  ) {
    return this.signup.forgot(b.eposta, ip);
  }

  @Post('password/reset')
  @HttpCode(200)
  reset(@Body(new ZodPipe(resetPasswordSchema)) b: z.output<typeof resetPasswordSchema>, @Ip() ip: string) {
    return this.signup.reset(b.kod, b.sifre, ip);
  }

  /** Ayarlar › Güvenlik: şifre değiştir ya da belirle */
  @Post('password')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  changePassword(
    @Req() req: { user: AccessClaims },
    @Body(new ZodPipe(changePasswordSchema)) b: z.output<typeof changePasswordSchema>,
    @Ip() ip: string,
  ) {
    return this.signup.change(req.user.sub, req.user.sid, b, ip);
  }

  /** Hassas işlem onayı: kişinin kendi numarasına kod (Karar 58) */
  @Post('code')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  code(@Req() req: { user: AccessClaims }, @Ip() ip: string) {
    return this.auth.sendOwnCode(req.user.sub, ip);
  }

  /** Destekten gelen giriş bağlantısı (Karar 52) */
  @Post('link/verify')
  @HttpCode(200)
  linkVerify(@Body(new ZodPipe(loginLinkSchema)) body: z.output<typeof loginLinkSchema>, @Ip() ip: string) {
    return this.auth.verifyLoginLink(body.kod, ip);
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
