import { HttpException, HttpStatus, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { uuidv7 } from '@rengarenk/db';
import type { TokenPair } from '@rengarenk/shared';
import { AuditService } from '../audit/audit.service.js';
import { ENV, type Env } from '../config/env.js';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';
import { Metrics } from '../observability/metrics.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { RateLimiter } from '../ratelimit/rate-limiter.js';
import { SMS_SENDER, type SmsSender } from '../sms/sms.js';
import {
  ACCESS_TTL_SECONDS,
  hashOtp,
  newOtpCode,
  newRefreshToken,
  OTP_COOLDOWN_SECONDS,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_PER_HOUR,
  OTP_TTL_SECONDS,
  REFRESH_TTL_DAYS,
  safeEqualHex,
  sha256,
} from './tokens.js';

export interface AccessClaims {
  sub: string;
  sid: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly limiter: RateLimiter,
    private readonly metrics: Metrics,
  ) {}

  /** SMS kodu gönderir. Aynı numaraya 60 saniyede bir, saatte en fazla 5 kod. */
  async requestOtp(
    phone: string,
    ip?: string,
  ): Promise<{ challengeId: string; expiresIn: number; devCode?: string }> {
    // Aynı IP'den saatte en fazla 20 kod: numara değiştirerek SMS bombardımanını engeller.
    if (ip) await this.limiter.hit(`otp:ip:${ip}`, 20, 3600);
    const hourAgo = new Date(Date.now() - 3600_000);
    const recent = await this.db.otpChallenge.findMany({
      where: { phone, createdAt: { gt: hourAgo } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const last = recent[0];
    if (last && Date.now() - last.createdAt.getTime() < OTP_COOLDOWN_SECONDS * 1000) {
      throw new HttpException('Yeni kod için biraz bekle', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (recent.length >= OTP_MAX_PER_HOUR) {
      throw new HttpException(
        'Çok fazla kod istendi, bir saat sonra tekrar dene',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const id = uuidv7();
    const code = newOtpCode();
    await this.db.otpChallenge.create({
      data: {
        id,
        phone,
        codeHash: hashOtp(this.env.JWT_SECRET, id, code),
        expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
        ip: ip ?? null,
      },
    });
    try {
      const r = await this.sms.send(phone, `Rengarenk giriş kodun: ${code}. Kodu kimseyle paylaşma.`);
      this.metrics.smsSent.inc({ provider: r.provider, result: 'ok' });
    } catch (err) {
      this.metrics.smsSent.inc({ provider: this.sms.name, result: 'error' });
      throw new HttpException('Kod gönderilemedi, biraz sonra tekrar dene', HttpStatus.SERVICE_UNAVAILABLE, {
        cause: err,
      });
    }
    // Yalnızca yerel geliştirme: SMS gerçekten gönderilmediği için kod yanıtta da döner ve giriş
    // ekranında gösterilir. Canlıda `console` sağlayıcısı zaten yasaktır (env.ts); iki koşul birlikte aranır.
    const devCode =
      this.env.NODE_ENV === 'development' && this.env.SMS_PROVIDER === 'console' ? code : undefined;
    return { challengeId: id, expiresIn: OTP_TTL_SECONDS, ...(devCode ? { devCode } : {}) };
  }

  /** Kodu doğrular; kullanıcı yoksa oluşturur (bireysel hesabıyla birlikte) ve oturum açar. */
  async verifyOtp(
    challengeId: string,
    code: string,
    platform: 'IOS' | 'ANDROID' | 'WEB',
    ip?: string,
  ): Promise<TokenPair & { isNewUser: boolean }> {
    if (ip) await this.limiter.hit(`verify:ip:${ip}`, 60, 3600);
    const ch = await this.db.otpChallenge.findUnique({ where: { id: challengeId } });
    const invalid = new UnauthorizedException('Kod hatalı ya da süresi dolmuş');
    if (!ch || ch.consumedAt || ch.expiresAt < new Date() || ch.attempts >= OTP_MAX_ATTEMPTS) throw invalid;

    if (!safeEqualHex(ch.codeHash, hashOtp(this.env.JWT_SECRET, ch.id, code))) {
      await this.db.otpChallenge.update({ where: { id: ch.id }, data: { attempts: { increment: 1 } } });
      throw invalid;
    }

    return this.db.$transaction(async (tx) => {
      // Aynı kodun iki kez kullanılmasını engeller.
      const consumed = await tx.otpChallenge.updateMany({
        where: { id: ch.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      if (consumed.count !== 1) throw invalid;

      let user = await tx.user.findUnique({ where: { phone: ch.phone } });
      const isNewUser = !user;
      if (!user) {
        user = await tx.user.create({ data: { id: uuidv7(), phone: ch.phone, phoneVerifiedAt: new Date() } });
        await tx.account.create({
          data: {
            id: uuidv7(),
            kind: 'INDIVIDUAL',
            name: 'Bireysel',
            members: { create: { userId: user.id, role: 'OWNER' } },
          },
        });
        await this.outbox.add(tx, 'kullanici.kaydoldu', { userId: user.id });
      }
      if (user.status !== 'ACTIVE') throw new UnauthorizedException('Hesap kullanıma kapalı');

      const device = await tx.device.create({ data: { id: uuidv7(), userId: user.id, platform } });
      const pair = await this.openSession(tx, user.id, device.id);
      await this.audit.record(
        { actorType: 'USER', actorId: user.id, action: 'giris', entityType: 'user', entityId: user.id, ip },
        tx,
      );
      await this.outbox.add(tx, 'kullanici.giris', { userId: user.id, platform });
      return { ...pair, isNewUser };
    });
  }

  /** Yenileme jetonunu döndürür (eski jeton geçersiz olur). Çalınmış jeton tekrar kullanılırsa oturum kapanır. */
  async refresh(refreshToken: string): Promise<TokenPair> {
    const hash = sha256(refreshToken);
    const s = await this.db.session.findUnique({ where: { refreshTokenHash: hash } });
    if (!s || s.expiresAt < new Date()) throw new UnauthorizedException('Oturum süresi doldu');
    if (s.revokedAt) {
      // Kullanılmış jeton tekrar geldi: jeton çalınmış olabilir, kullanıcının tüm oturumları kapanır.
      await this.db.session.updateMany({
        where: { userId: s.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Oturum kapatıldı');
    }
    return this.db.$transaction(async (tx) => {
      const revoked = await tx.session.updateMany({
        where: { id: s.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (revoked.count !== 1) throw new UnauthorizedException('Oturum kapatıldı');
      return this.openSession(tx, s.userId, s.deviceId);
    });
  }

  async logout(sessionId: string) {
    await this.db.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async verifyAccess(token: string): Promise<AccessClaims> {
    try {
      return await this.jwt.verifyAsync<AccessClaims>(token);
    } catch {
      throw new UnauthorizedException();
    }
  }

  private async openSession(tx: Tx, userId: string, deviceId: string | null): Promise<TokenPair> {
    const refreshToken = newRefreshToken();
    const session = await tx.session.create({
      data: {
        id: uuidv7(),
        userId,
        deviceId,
        refreshTokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 86400_000),
      },
    });
    const accessToken = await this.jwt.signAsync({ sub: userId, sid: session.id } satisfies AccessClaims, {
      expiresIn: ACCESS_TTL_SECONDS,
    });
    return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SECONDS };
  }
}
