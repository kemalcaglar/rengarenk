import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { type StaffMember, uuidv7 } from '@rengarenk/db';
import {
  maskEmail,
  type PermissionGrants,
  STAFF_IDLE_MINUTES,
  STAFF_SESSION_MAX_HOURS,
} from '@rengarenk/shared';
import QRCode from 'qrcode';
import { AuditService } from '../audit/audit.service.js';
import { sha256 } from '../auth/tokens.js';
import { ENV, type Env } from '../config/env.js';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { RateLimiter } from '../ratelimit/rate-limiter.js';
import { IDENTITY_PROVIDER, IdentityError, type IdentityProvider } from './identity.js';
import { grantsFor } from './permissions.js';
import {
  formatRecoveryCode,
  newRecoveryCode,
  RECOVERY_CODE_COUNT,
  randomToken,
  SecretBox,
} from './secret-box.js';
import { newTotpSecret, otpauthUri, verifyTotp } from './totp.js';

/** Bir isteği yapan, oturumu doğrulanmış çalışan. */
export interface StaffContext {
  staff: StaffMember;
  sessionId: string;
  grants: PermissionGrants;
}

const LOGIN_STEP_MINUTES = 10;
const MAX_CODE_ATTEMPTS = 5;
/** Son etkinlik zamanı en fazla bu sıklıkla yazılır (her istekte veritabanına yazmamak için). */
const TOUCH_EVERY_MS = 30_000;

/**
 * Yönetim girişi (T10, Karar 40): şirket e-postasıyla Google Workspace tek oturum, ardından zorunlu
 * doğrulama uygulaması kodu. 30 dakika işlem yapılmazsa oturum kapanır; yeni cihazdan giriş sahibe bildirilir.
 */
@Injectable()
export class StaffAuthService {
  private readonly log = new Logger(StaffAuthService.name);
  readonly redirectUri: string;

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    @Inject(IDENTITY_PROVIDER) private readonly idp: IdentityProvider,
    private readonly box: SecretBox,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly limiter: RateLimiter,
  ) {
    this.redirectUri = `${env.ADMIN_ORIGIN}/api/oturum/google/donus`;
  }

  /** 1. adım: Google'a yönlendirme adresi. `state` tarayıcıda çerezle eşleştirilir (giriş sahteciliğine karşı). */
  async start(ip?: string): Promise<{ url: string; state: string }> {
    if (ip) await this.limiter.hit(`yonetim:baslat:${ip}`, 30, 3600);
    const state = randomToken(32);
    const nonce = randomToken(16);
    const codeVerifier = randomToken(48);
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    await this.db.staffLoginChallenge.create({
      data: {
        id: uuidv7(),
        stateHash: sha256(state),
        nonce,
        codeVerifier,
        expiresAt: new Date(Date.now() + LOGIN_STEP_MINUTES * 60_000),
        ip: ip ?? null,
      },
    });
    const url = this.idp.authorizationUrl({ state, nonce, codeChallenge, redirectUri: this.redirectUri });
    return { url, state };
  }

  /** 2. adım: Google dönüşü. Şirket hesabı ve kayıtlı çalışan denetlenir, iki adımlı doğrulama bileti verilir. */
  async google(
    state: string,
    code: string,
    ip?: string,
  ): Promise<{ ticket: string; needsSetup: boolean; name: string }> {
    if (ip) await this.limiter.hit(`yonetim:google:${ip}`, 30, 3600);
    const ch = await this.db.staffLoginChallenge.findUnique({ where: { stateHash: sha256(state) } });
    const expired = new UnauthorizedException('Giriş isteğinin süresi doldu, yeniden dene');
    if (!ch || ch.consumedAt || ch.expiresAt < new Date()) throw expired;
    // Google dönüşü tek kullanımlıktır.
    const taken = await this.db.staffLoginChallenge.updateMany({
      where: { id: ch.id, googleAt: null },
      data: { googleAt: new Date() },
    });
    if (taken.count !== 1) throw expired;

    let identity: Awaited<ReturnType<IdentityProvider['exchange']>>;
    try {
      identity = await this.idp.exchange({
        code,
        codeVerifier: ch.codeVerifier,
        redirectUri: this.redirectUri,
        nonce: ch.nonce,
      });
    } catch (err) {
      if (!(err instanceof IdentityError)) this.log.error(err);
      throw new UnauthorizedException('Google girişi doğrulanamadı, yeniden dene');
    }

    const domain = identity.email.split('@')[1] ?? '';
    const domains = this.env.STAFF_EMAIL_DOMAINS;
    const reject = async (neden: string, message: string) => {
      await this.audit.record({
        actorType: 'SYSTEM',
        action: 'yonetim_giris_reddedildi',
        entityType: 'staff_login',
        entityId: ch.id,
        after: { neden, eposta: maskEmail(identity.email) },
        ip,
      });
      throw new ForbiddenException(message);
    };
    // Google Workspace hesabı (hd) şartı canlıda her zaman aranır; yalnızca geliştirmede kişisel Google
    // hesabıyla deneme için kapatılabilir (STAFF_REQUIRE_WORKSPACE=false, env.ts canlıda engeller).
    const workspaceOk =
      !this.env.STAFF_REQUIRE_WORKSPACE || (identity.hd !== undefined && domains.includes(identity.hd));
    if (!identity.emailVerified || !domains.includes(domain) || !workspaceOk) {
      return reject('sirket_hesabi_degil', 'Yalnızca şirket Google hesabıyla giriş yapılabilir');
    }
    const staff = await this.db.staffMember.findUnique({ where: { email: identity.email } });
    if (!staff || staff.role === 'AGENT') {
      return reject('calisan_degil', 'Bu hesap yönetim konsoluna tanımlı değil');
    }
    if (staff.status === 'DISABLED') return reject('hesap_kapali', 'Bu çalışan hesabı kapatılmış');
    if (staff.status === 'INVITED' && (!staff.inviteExpiresAt || staff.inviteExpiresAt < new Date())) {
      return reject('davet_suresi_doldu', 'Davetin süresi dolmuş; yöneticinden yeni davet iste');
    }
    if (staff.googleSub && staff.googleSub !== identity.sub) {
      return reject('google_hesabi_farkli', 'Bu e-posta başka bir Google hesabına bağlı');
    }

    const ticket = randomToken(32);
    await this.db.staffLoginChallenge.update({
      where: { id: ch.id },
      data: {
        staffId: staff.id,
        googleSub: identity.sub,
        ticketHash: sha256(ticket),
        expiresAt: new Date(Date.now() + LOGIN_STEP_MINUTES * 60_000),
      },
    });
    return { ticket, needsSetup: !hasTotp(staff), name: staff.name };
  }

  /** İlk girişte doğrulama uygulaması kurulumu: sır ve karekod. Sır, ilk doğru kodla kalıcı olur. */
  async setup(ticket: string): Promise<{ secret: string; otpauthUri: string; qrSvg: string }> {
    const { ch, staff } = await this.byTicket(ticket);
    if (hasTotp(staff)) throw new ConflictException('İki adımlı doğrulama zaten kurulu');
    const secret = newTotpSecret();
    await this.db.staffLoginChallenge.update({
      where: { id: ch.id },
      data: { pendingTotpEnc: this.box.seal(secret) },
    });
    const uri = otpauthUri(secret, staff.email);
    const qrSvg = await QRCode.toString(uri, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
    return { secret, otpauthUri: uri, qrSvg };
  }

  /** 3. adım: doğrulama uygulaması kodu veya kurtarma kodu. Doğruysa yönetim oturumu açılır. */
  async verify(
    ticket: string,
    code: string,
    opts: { deviceId?: string; userAgent?: string; ip?: string } = {},
  ): Promise<{ sessionToken: string; expiresAt: Date; recoveryCodes?: string[] }> {
    if (opts.ip) await this.limiter.hit(`yonetim:kod:${opts.ip}`, 30, 3600);
    const { ch, staff } = await this.byTicket(ticket);
    if (ch.attempts >= MAX_CODE_ATTEMPTS) {
      throw new UnauthorizedException('Çok fazla hatalı deneme, girişe baştan başla');
    }

    const setup = !hasTotp(staff);
    let step: number | null = null;
    let recoveryId: string | null = null;
    if (setup) {
      if (!ch.pendingTotpEnc) throw new BadRequestException('Önce doğrulama uygulamasını kur');
      step = verifyTotp(this.box.open(ch.pendingTotpEnc), code, null);
    } else if (/^\d{6}$/.test(code)) {
      if (!staff.totpSecretEnc) throw new UnauthorizedException('Doğrulama uygulaması kurulu değil');
      step = verifyTotp(this.box.open(staff.totpSecretEnc), code, staff.totpLastStep);
    } else {
      const rc = await this.db.staffRecoveryCode.findFirst({
        where: { staffId: staff.id, usedAt: null, codeHash: this.box.digest(`${staff.id}:${code}`) },
      });
      recoveryId = rc?.id ?? null;
    }

    if (step === null && recoveryId === null) {
      await this.db.staffLoginChallenge.update({
        where: { id: ch.id },
        data: { attempts: { increment: 1 } },
      });
      await this.audit.record({
        actorType: 'STAFF',
        actorId: staff.id,
        action: 'yonetim_kod_hatali',
        entityType: 'staff_member',
        entityId: staff.id,
        ip: opts.ip,
      });
      throw new UnauthorizedException('Kod hatalı');
    }

    const invalid = new UnauthorizedException('Kod hatalı ya da kullanılmış');
    return this.db.$transaction(async (tx) => {
      const consumed = await tx.staffLoginChallenge.updateMany({
        where: { id: ch.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      if (consumed.count !== 1) throw invalid;

      let recoveryCodes: string[] | undefined;
      if (setup) {
        await tx.staffMember.update({
          where: { id: staff.id },
          data: {
            totpSecretEnc: ch.pendingTotpEnc,
            twoFactorEnabled: true,
            totpLastStep: BigInt(step as number),
          },
        });
        recoveryCodes = await this.replaceRecoveryCodes(tx, staff.id);
      } else if (step !== null) {
        // Aynı kod eş zamanlı iki istekte kullanılamaz.
        const ok = await tx.staffMember.updateMany({
          where: { id: staff.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: BigInt(step) } }] },
          data: { totpLastStep: BigInt(step) },
        });
        if (ok.count !== 1) throw invalid;
      } else {
        const ok = await tx.staffRecoveryCode.updateMany({
          where: { id: recoveryId as string, usedAt: null },
          data: { usedAt: new Date() },
        });
        if (ok.count !== 1) throw invalid;
      }

      await tx.staffMember.update({
        where: { id: staff.id },
        data: {
          lastLoginAt: new Date(),
          googleSub: ch.googleSub,
          ...(staff.status === 'INVITED' ? { status: 'ACTIVE', inviteExpiresAt: null } : {}),
        },
      });

      const device = opts.deviceId
        ? await this.rememberDevice(tx, staff.id, opts.deviceId, opts.userAgent)
        : null;
      const sessionToken = `rrs_${randomToken(32)}`;
      const expiresAt = new Date(Date.now() + STAFF_SESSION_MAX_HOURS * 3600_000);
      const session = await tx.staffSession.create({
        data: {
          id: uuidv7(),
          staffId: staff.id,
          deviceId: device?.id ?? null,
          tokenHash: sha256(sessionToken),
          expiresAt,
          ip: opts.ip ?? null,
        },
      });

      const method = recoveryId ? 'kurtarma_kodu' : 'dogrulama_uygulamasi';
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: staff.id,
          action: 'yonetim_giris',
          entityType: 'staff_session',
          entityId: session.id,
          after: { yontem: method, kurulum: setup, yeniCihaz: device?.isNew ?? false },
          ip: opts.ip,
        },
        tx,
      );
      await this.outbox.add(tx, 'calisan.giris', { staffId: staff.id, sessionId: session.id });
      if (device?.isNew) {
        await this.outbox.add(tx, 'calisan.yeni_cihaz', {
          staffId: staff.id,
          deviceId: device.id,
          ilkGiris: staff.lastLoginAt === null,
        });
      }
      if (recoveryId) {
        await this.outbox.add(tx, 'calisan.kurtarma_kodu_kullandi', { staffId: staff.id });
      }
      return { sessionToken, expiresAt, recoveryCodes };
    });
  }

  /** Her yönetim isteğinde oturumu doğrular; 30 dakikadan uzun hareketsizlikte oturumu kapatır. */
  async authenticate(token: string): Promise<StaffContext> {
    const s = await this.db.staffSession.findUnique({
      where: { tokenHash: sha256(token) },
      include: { staff: { include: { customRole: true } } },
    });
    const now = Date.now();
    if (!s || s.revokedAt || s.expiresAt.getTime() < now) throw new UnauthorizedException('Oturum kapalı');
    if (now - s.lastActiveAt.getTime() > STAFF_IDLE_MINUTES * 60_000) {
      await this.revokeSession(s.id);
      throw new UnauthorizedException(`${STAFF_IDLE_MINUTES} dakika işlem yapılmadığı için oturum kapandı`);
    }
    if (s.staff.status !== 'ACTIVE' || !s.staff.twoFactorEnabled) {
      await this.revokeSession(s.id);
      throw new UnauthorizedException('Oturum kapalı');
    }
    if (now - s.lastActiveAt.getTime() > TOUCH_EVERY_MS) {
      await this.db.staffSession.updateMany({
        where: { id: s.id, revokedAt: null },
        data: { lastActiveAt: new Date(now) },
      });
    }
    const { customRole: _, ...staff } = s.staff;
    return { staff, sessionId: s.id, grants: grantsFor(s.staff) };
  }

  async logout(ctx: StaffContext, ip?: string) {
    await this.db.$transaction(async (tx) => {
      await tx.staffSession.updateMany({
        where: { id: ctx.sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: ctx.staff.id,
          action: 'yonetim_cikis',
          entityType: 'staff_session',
          entityId: ctx.sessionId,
          ip,
        },
        tx,
      );
    });
  }

  /** Çalışanın tüm açık oturumlarını kapatır (hesap kapatma, rol veya 2FA sıfırlama). */
  revokeAll(tx: Tx | Db, staffId: string) {
    return tx.staffSession.updateMany({
      where: { staffId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private revokeSession(id: string) {
    return this.db.staffSession.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async byTicket(ticket: string) {
    const ch = await this.db.staffLoginChallenge.findUnique({ where: { ticketHash: sha256(ticket) } });
    const expired = new UnauthorizedException('Giriş isteğinin süresi doldu, yeniden dene');
    if (!ch?.staffId || !ch.googleAt || ch.consumedAt || ch.expiresAt < new Date()) throw expired;
    const staff = await this.db.staffMember.findUnique({ where: { id: ch.staffId } });
    if (!staff || staff.status === 'DISABLED') throw expired;
    return { ch, staff };
  }

  private async replaceRecoveryCodes(tx: Tx, staffId: string): Promise<string[]> {
    await tx.staffRecoveryCode.deleteMany({ where: { staffId } });
    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, newRecoveryCode);
    await tx.staffRecoveryCode.createMany({
      data: codes.map((c) => ({ id: uuidv7(), staffId, codeHash: this.box.digest(`${staffId}:${c}`) })),
    });
    return codes.map(formatRecoveryCode);
  }

  private async rememberDevice(tx: Tx, staffId: string, deviceId: string, userAgent?: string) {
    const deviceHash = sha256(`yonetim-cihaz:${deviceId}`);
    const existing = await tx.staffDevice.findUnique({
      where: { staffId_deviceHash: { staffId, deviceHash } },
    });
    if (existing) {
      await tx.staffDevice.update({ where: { id: existing.id }, data: { lastSeenAt: new Date() } });
      return { id: existing.id, isNew: false };
    }
    const d = await tx.staffDevice.create({
      data: { id: uuidv7(), staffId, deviceHash, userAgent: userAgent?.slice(0, 300) ?? null },
    });
    return { id: d.id, isNew: true };
  }
}

/** Doğrulama uygulaması gerçekten kurulu mu? İşaret açık ama sır yoksa (eski kayıt) yeniden kurulur. */
const hasTotp = (s: { twoFactorEnabled: boolean; totpSecretEnc: string | null }) =>
  s.twoFactorEnabled && s.totpSecretEnc !== null;
