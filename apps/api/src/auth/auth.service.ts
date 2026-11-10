import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, uuidv7 } from '@rengarenk/db';
import type { SignupConsents, TokenPair } from '@rengarenk/shared';
import { AdsService, olayPlatformu } from '../ads/ads.service.js';
import { AuditService } from '../audit/audit.service.js';
import { ENV, type Env } from '../config/env.js';
import { ConsentService, channelOf } from '../consents/consent.service.js';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';
import { blockHash, karaListede } from '../moderation/blocklist.js';
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
  REUSE_GRACE_MS,
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
    private readonly consents: ConsentService,
    @Optional() private readonly ads?: AdsService,
  ) {}

  /** SMS kodu gönderir. Aynı numaraya 60 saniyede bir, saatte en fazla 5 kod. */
  async requestOtp(
    phone: string,
    ip?: string,
    kurulum?: string,
  ): Promise<{ challengeId: string; expiresIn: number; devCode?: string }> {
    // Aynı IP'den saatte en fazla 20 kod: numara değiştirerek SMS bombardımanını engeller.
    if (ip) await this.limiter.hit(`otp:ip:${ip}`, 20, 3600);
    // Kara liste (Karar 43): engellenen numara, IP ya da cihaza kod gönderilmez (neden açıklanmaz)
    if (
      (await karaListede(this.db, this.env.JWT_SECRET, 'telefon', [phone])) ||
      (ip && (await karaListede(this.db, this.env.JWT_SECRET, 'ip', [ip.toLowerCase()]))) ||
      (kurulum && (await karaListede(this.db, this.env.JWT_SECRET, 'cihaz', [kurulum])))
    ) {
      throw new ForbiddenException('Bu numarayla şu an giriş yapılamıyor. Destek ekibimize yazabilirsin.');
    }
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

  /**
   * Hassas işlem onayı (Karar 58: veri indirme, KVKK başvurusu): kişinin kendi numarasına gönderilen kodu doğrular ve
   * harcar; oturum açmaz. Yanlış kod deneme hakkını azaltır.
   */
  async confirmCode(userId: string, challengeId: string, code: string) {
    const u = await this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { phone: true } });
    const ch = await this.db.otpChallenge.findUnique({ where: { id: challengeId } });
    const invalid = new UnauthorizedException('Kod hatalı ya da süresi dolmuş');
    if (
      !ch ||
      ch.phone !== u.phone ||
      ch.consumedAt ||
      ch.expiresAt < new Date() ||
      ch.attempts >= OTP_MAX_ATTEMPTS
    ) {
      throw invalid;
    }
    if (!safeEqualHex(ch.codeHash, hashOtp(this.env.JWT_SECRET, ch.id, code))) {
      await this.db.otpChallenge.update({ where: { id: ch.id }, data: { attempts: { increment: 1 } } });
      throw invalid;
    }
    const k = await this.db.otpChallenge.updateMany({
      where: { id: ch.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (k.count !== 1) throw invalid;
  }

  /**
   * Numarayı değiştir (Ayarlar › Profil; Yardim.dc.html): yeni numaraya kod gönderir. Numara başka bir hesapta
   * kayıtlıysa reddedilir; kara liste ve hız sınırları girişle aynıdır.
   */
  async requestPhoneChange(userId: string, phone: string, ip?: string) {
    const u = await this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { phone: true } });
    if (u.phone === phone) throw new ConflictException('Bu numara zaten hesabında kayıtlı');
    if (await this.db.user.findUnique({ where: { phone }, select: { id: true } })) {
      throw new ConflictException('Bu numara başka bir hesapta kayıtlı');
    }
    return this.requestOtp(phone, ip);
  }

  /**
   * Yeni numaraya gelen kodla numarayı değiştirir. Bu oturum dışındaki bütün oturumlar kapanır (Karar 58), işlem kaydına
   * numaranın kendisi değil yalnızca değiştiği yazılır, kişiye güvenlik bildirimi gider.
   */
  async confirmPhoneChange(
    userId: string,
    sessionId: string,
    challengeId: string,
    code: string,
    ip?: string,
  ) {
    const u = await this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { phone: true } });
    const ch = await this.db.otpChallenge.findUnique({ where: { id: challengeId } });
    const invalid = new UnauthorizedException('Kod hatalı ya da süresi dolmuş');
    if (
      !ch ||
      ch.phone === u.phone ||
      ch.consumedAt ||
      ch.expiresAt < new Date() ||
      ch.attempts >= OTP_MAX_ATTEMPTS
    ) {
      throw invalid;
    }
    if (!safeEqualHex(ch.codeHash, hashOtp(this.env.JWT_SECRET, ch.id, code))) {
      await this.db.otpChallenge.update({ where: { id: ch.id }, data: { attempts: { increment: 1 } } });
      throw invalid;
    }
    try {
      return await this.db.$transaction(async (tx) => {
        const k = await tx.otpChallenge.updateMany({
          where: { id: ch.id, consumedAt: null },
          data: { consumedAt: new Date() },
        });
        if (k.count !== 1) throw invalid;
        await tx.user.update({
          where: { id: userId },
          data: { phone: ch.phone, phoneVerifiedAt: new Date() },
        });
        const kapanan = await tx.session.updateMany({
          where: { userId, id: { not: sessionId }, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await this.audit.record(
          {
            actorType: 'USER',
            actorId: userId,
            action: 'telefon_degisti',
            entityType: 'user',
            entityId: userId,
            ip,
          },
          tx,
        );
        await this.outbox.add(tx, 'hesap.telefon_degisti', { userId });
        return { degisti: true, kapananOturum: kapanan.count };
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Bu numara başka bir hesapta kayıtlı');
      }
      throw err;
    }
  }

  /**
   * Giriş bağlantısıyla oturum (Karar 52): destekten gelen tek kullanımlık bağlantı; 15 dakika geçerli, bir kez
   * kullanılır. Kara liste denetimi girişle aynıdır. Yalnızca web'de açılır; bağlantı yeni hesap açmaz.
   */
  async verifyLoginLink(kod: string, ip?: string) {
    if (ip) await this.limiter.hit(`verify:ip:${ip}`, 60, 3600);
    const invalid = new UnauthorizedException(
      'Bağlantının süresi dolmuş ya da kullanılmış. Destek ekibimizden yenisini iste.',
    );
    const l = await this.db.loginLink.findUnique({ where: { tokenHash: sha256(kod) } });
    if (!l || l.usedAt || l.revokedAt || l.expiresAt < new Date()) throw invalid;
    const u = await this.db.user.findUnique({ where: { id: l.userId } });
    if (u?.status !== 'ACTIVE') throw invalid;
    if (
      (await karaListede(this.db, this.env.JWT_SECRET, 'telefon', [u.phone])) ||
      (ip && (await karaListede(this.db, this.env.JWT_SECRET, 'ip', [ip.toLowerCase()])))
    ) {
      throw new ForbiddenException('Bu hesapla şu an giriş yapılamıyor. Destek ekibimize yazabilirsin.');
    }
    return this.db.$transaction(async (tx) => {
      const k = await tx.loginLink.updateMany({
        where: { id: l.id, usedAt: null, revokedAt: null },
        data: { usedAt: new Date() },
      });
      if (k.count !== 1) throw invalid;
      const device = await tx.device.create({ data: { id: uuidv7(), userId: u.id, platform: 'WEB' } });
      const pair = await this.openSession(tx, u.id, device.id);
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: u.id,
          action: 'giris_baglanti',
          entityType: 'user',
          entityId: u.id,
          ip,
        },
        tx,
      );
      await this.outbox.add(tx, 'kullanici.giris', { userId: u.id, platform: 'WEB' });
      return { ...pair, isNewUser: false };
    });
  }

  /** Kodu doğrular; kullanıcı yoksa oluşturur (bireysel hesabıyla birlikte) ve oturum açar. */
  async verifyOtp(
    challengeId: string,
    code: string,
    platform: 'IOS' | 'ANDROID' | 'WEB',
    ip?: string,
    consents?: SignupConsents,
    kurulum?: string,
  ): Promise<TokenPair & { isNewUser: boolean }> {
    if (ip) await this.limiter.hit(`verify:ip:${ip}`, 60, 3600);
    // Kara listedeki cihaz giriş yapamaz (kod başka cihazdan istenmiş olsa da)
    if (kurulum && (await karaListede(this.db, this.env.JWT_SECRET, 'cihaz', [kurulum]))) {
      throw new ForbiddenException('Bu cihazla şu an giriş yapılamıyor. Destek ekibimize yazabilirsin.');
    }
    const ch = await this.db.otpChallenge.findUnique({ where: { id: challengeId } });
    const invalid = new UnauthorizedException('Kod hatalı ya da süresi dolmuş');
    if (!ch || ch.consumedAt || ch.expiresAt < new Date() || ch.attempts >= OTP_MAX_ATTEMPTS) throw invalid;

    if (!safeEqualHex(ch.codeHash, hashOtp(this.env.JWT_SECRET, ch.id, code))) {
      await this.db.otpChallenge.update({ where: { id: ch.id }, data: { attempts: { increment: 1 } } });
      throw invalid;
    }
    // Yeni üyelik kullanım koşulları ve KVKK aydınlatma onayı olmadan açılmaz (kod harcanmadan önce denetlenir).
    if (!consents && !(await this.db.user.findUnique({ where: { phone: ch.phone }, select: { id: true } }))) {
      throw new BadRequestException(
        'Üye olmak için kullanım koşullarını ve KVKK aydınlatma metnini onaylamalısın',
      );
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

      // Rıza kaydı (Karar 59): hangi metin sürümüne, hangi kanaldan, ne zaman
      if (consents) await this.consents.recordSignup(tx, user.id, consents, channelOf(platform), ip);
      // Reklam ölçümü (Karar 35): telefonla doğrulanmış yeni üyelik; tarayıcı aynı kimliği (kod isteği) kullanır
      if (isNewUser)
        await this.ads?.olay(tx, user.id, 'CompleteRegistration', {
          ref: challengeId,
          platform: olayPlatformu(platform),
        });
      const device = await tx.device.create({
        data: {
          id: uuidv7(),
          userId: user.id,
          platform,
          installHash: kurulum ? blockHash(this.env.JWT_SECRET, 'cihaz', kurulum) : null,
        },
      });
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
      // Kaybolan yanıt: yenileme sürerken sayfa değişti, yeni jeton tarayıcıya ulaşmadı ve eski jeton kısa süre içinde
      // yeniden geldi. Yerine açılan oturum hiç kullanılmadıysa o kapatılır, yeni oturum verilir.
      if (s.rotated) {
        const kurtar = await this.lostResponse(s);
        if (kurtar) return kurtar;
      }
      // Yenilenmiş (kullanılmış) jeton tekrar geldi: jeton çalınmış olabilir, kullanıcının tüm oturumları kapanır.
      // Elle kapatılan oturumun jetonu yalnızca reddedilir; diğer cihazlar açık kalır.
      if (s.rotated) {
        await this.db.session.updateMany({
          where: { userId: s.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      throw new UnauthorizedException('Oturum kapatıldı');
    }
    return this.db.$transaction(async (tx) => {
      const revoked = await tx.session.updateMany({
        where: { id: s.id, revokedAt: null },
        data: { revokedAt: new Date(), rotated: true },
      });
      if (revoked.count !== 1) throw new UnauthorizedException('Oturum kapatıldı');
      const yeni = uuidv7();
      await tx.session.update({ where: { id: s.id }, data: { replacedBy: yeni } });
      return this.openSession(tx, s.userId, s.deviceId, yeni);
    });
  }

  /**
   * Kaybolan yenileme yanıtı (`REUSE_GRACE_MS` içinde): yerine açılan oturum hiç yenilenmemiş ve açıksa kapatılır,
   * aynı cihaza yeni oturum açılır. Süre ilk döndürmeden sayılır (tekrar tekrar uzamaz). Yerine açılan oturum
   * kullanılmışsa ya da süre geçtiyse `null`: jeton çalınmış sayılır.
   */
  private async lostResponse(s: {
    id: string;
    userId: string;
    deviceId: string | null;
    revokedAt: Date | null;
    replacedBy: string | null;
  }): Promise<TokenPair | null> {
    const halef = s.replacedBy;
    if (!halef || !s.revokedAt || Date.now() - s.revokedAt.getTime() > REUSE_GRACE_MS) return null;
    return this.db.$transaction(async (tx) => {
      const kapandi = await tx.session.updateMany({
        where: { id: halef, revokedAt: null, rotated: false },
        data: { revokedAt: new Date() },
      });
      if (kapandi.count !== 1) return null;
      const yeni = uuidv7();
      await tx.session.update({ where: { id: s.id }, data: { replacedBy: yeni } });
      return this.openSession(tx, s.userId, s.deviceId, yeni);
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

  private async openSession(
    tx: Tx,
    userId: string,
    deviceId: string | null,
    id: string = uuidv7(),
  ): Promise<TokenPair> {
    const refreshToken = newRefreshToken();
    const session = await tx.session.create({
      data: {
        id,
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
