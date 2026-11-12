import { createHash } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, uuidv7 } from '@rengarenk/db';
import type {
  RegisterStart,
  RegisterStarted,
  SignupConsents,
  SocialLoginResult,
  TokenPair,
} from '@rengarenk/shared';
import { AdsService, olayPlatformu } from '../ads/ads.service.js';
import { AuditService } from '../audit/audit.service.js';
import { ENV, type Env } from '../config/env.js';
import { ConsentService, channelOf } from '../consents/consent.service.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { blockHash } from '../moderation/blocklist.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { RateLimiter } from '../ratelimit/rate-limiter.js';
import { IdentityError, type IdentityProvider } from '../staff/identity.js';
import { randomToken } from '../staff/secret-box.js';
import { AuthService } from './auth.service.js';
import { dummyHash, hashPassword, verifyPassword } from './password.js';
import { sha256 } from './tokens.js';
import { APPLE_VERIFIER, type AppleVerifier, USER_IDP } from './user-identity.js';

type Platform = 'IOS' | 'ANDROID' | 'WEB';
type Saglayici = 'google' | 'apple';

/** Üyelik isteğinin (bilgiler + telefon kodu) geçerlilik süresi */
const KAYIT_DAKIKA = 30;
const GOOGLE_DAKIKA = 10;

interface KayitJetonu {
  tur: 'kayit';
  saglayici: Saglayici;
  kimlik: string;
  eposta: string;
  dogru: boolean;
}

interface SosyalKimlik {
  sub: string;
  eposta: string | null;
  dogru: boolean;
  ad: string | null;
  soyad: string | null;
}

const tamAd = (ad: string, soyad: string) => `${ad} ${soyad}`.trim();

/**
 * Üyelik ve giriş (Karar 18, 12 Kasım 2026): Üye ol ve Giriş yap ayrıdır. Üyelikte ad, soyad, e-posta ve telefon
 * alınır; telefon bir kez kodla doğrulanır ve hesap ancak o zaman tek veritabanı işleminde açılır. Giriş e-posta ve
 * şifreyle ya da Google veya Apple ile yapılır; girişte telefon kodu istenmez.
 */
@Injectable()
export class SignupService {
  private readonly log = new Logger('Üyelik');
  private readonly redirectUri: string;

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    @Inject(USER_IDP) private readonly google: IdentityProvider | null,
    @Inject(APPLE_VERIFIER) private readonly apple: AppleVerifier | null,
    private readonly auth: AuthService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly limiter: RateLimiter,
    private readonly consents: ConsentService,
    @Optional() private readonly ads?: AdsService,
  ) {
    this.redirectUri = `${env.WEB_ORIGIN}/api/oturum/google/donus`;
  }

  // ── Üye ol ────────────────────────────────────────────────────────────────────

  /**
   * 1. adım: bilgiler denetlenir, telefona kod gider. E-posta, numara ya da Google/Apple hesabı başka bir üyelikte
   * varsa kod gönderilmez. Bilgiler kod doğrulanana kadar `pending_signups`'ta durur (şifre yalnızca özetiyle).
   */
  async start(b: RegisterStart & { platform: Platform }, ip?: string): Promise<RegisterStarted> {
    if (ip) await this.limiter.hit(`kayit:ip:${ip}`, 20, 3600);
    const eposta = b.eposta.trim().toLowerCase();
    let sosyal: KayitJetonu | null = null;
    if (b.kayitJetonu) sosyal = await this.kayitJetonuAc(b.kayitJetonu);

    await this.assertFree({ eposta, telefon: b.telefon, sosyal });
    await this.auth.assertNotBlocked({ phone: b.telefon, ip, kurulum: b.kurulum });

    const passwordHash = b.sifre ? await hashPassword(b.sifre) : null;
    const kod = await this.auth.sendCode(b.telefon, ip, b.kurulum);
    // Süresi dolan istekler kişisel veri taşıdığı için beklemeden silinir
    await this.db.pendingSignup.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await this.db.pendingSignup.create({
      data: {
        id: kod.challengeId,
        email: eposta,
        firstName: b.ad.trim(),
        lastName: b.soyad.trim(),
        passwordHash,
        provider: sosyal?.saglayici ?? null,
        providerSub: sosyal?.kimlik ?? null,
        // Google ya da Apple'ın doğruladığı adres, kişi değiştirmediyse doğrulanmış sayılır
        emailVerified: !!sosyal?.dogru && sosyal.eposta === eposta,
        consents: b.consents as unknown as Prisma.InputJsonValue,
        platform: b.platform,
        installHash: b.kurulum ? blockHash(this.env.JWT_SECRET, 'cihaz', b.kurulum) : null,
        expiresAt: new Date(Date.now() + KAYIT_DAKIKA * 60_000),
      },
    });
    return kod;
  }

  /** Kodu yeniden gönder: aynı üyelik isteği yeni koda taşınır */
  async resend(challengeId: string, ip?: string): Promise<RegisterStarted> {
    const p = await this.db.pendingSignup.findUnique({ where: { id: challengeId } });
    const ch = await this.db.otpChallenge.findUnique({ where: { id: challengeId } });
    if (!p || !ch || p.expiresAt < new Date()) {
      throw new NotFoundException('Üyelik isteğinin süresi doldu, bilgilerini yeniden gir');
    }
    const kod = await this.auth.sendCode(ch.phone, ip);
    await this.db.pendingSignup.update({ where: { id: p.id }, data: { id: kod.challengeId } });
    return kod;
  }

  /**
   * 2. adım: kod doğrulanınca hesap tek işlemde açılır (kullanıcı, bireysel hesap, rızalar, reklam ölçümü, oturum).
   * Formla üye olana e-posta doğrulama bağlantısı işçiden gider (`kullanici.kaydoldu`).
   */
  async verify(
    challengeId: string,
    code: string,
    ip?: string,
    kurulum?: string,
  ): Promise<TokenPair & { isNewUser: true }> {
    if (ip) await this.limiter.hit(`verify:ip:${ip}`, 60, 3600);
    const ch = await this.auth.checkCode(challengeId, code);
    const p = await this.db.pendingSignup.findUnique({ where: { id: ch.id } });
    if (!p || p.expiresAt < new Date()) {
      throw new NotFoundException('Üyelik isteğinin süresi doldu, bilgilerini yeniden gir');
    }
    await this.auth.assertNotBlocked({ phone: ch.phone, ip, kurulum });
    const platform = p.platform as Platform;
    try {
      return await this.db.$transaction(async (tx) => {
        await this.auth.consumeCode(tx, ch.id);
        const user = await tx.user.create({
          data: {
            id: uuidv7(),
            phone: ch.phone,
            phoneVerifiedAt: new Date(),
            email: p.email,
            emailVerifiedAt: p.emailVerified ? new Date() : null,
            firstName: p.firstName,
            lastName: p.lastName,
            displayName: tamAd(p.firstName, p.lastName),
            passwordHash: p.passwordHash,
            googleSub: p.provider === 'google' ? p.providerSub : null,
            appleSub: p.provider === 'apple' ? p.providerSub : null,
          },
        });
        await tx.account.create({
          data: {
            id: uuidv7(),
            kind: 'INDIVIDUAL',
            name: 'Bireysel',
            members: { create: { userId: user.id, role: 'OWNER' } },
          },
        });
        await this.outbox.add(tx, 'kullanici.kaydoldu', { userId: user.id });
        // Rıza kaydı (Karar 59): hangi metin sürümüne, hangi kanaldan, ne zaman
        await this.consents.recordSignup(
          tx,
          user.id,
          p.consents as unknown as SignupConsents,
          channelOf(platform),
          ip,
        );
        // Reklam ölçümü (Karar 35): telefonla doğrulanmış yeni üyelik; tarayıcı aynı kimliği (kod isteği) kullanır
        await this.ads?.olay(tx, user.id, 'CompleteRegistration', {
          ref: challengeId,
          platform: olayPlatformu(platform),
        });
        await this.audit.record(
          {
            actorType: 'USER',
            actorId: user.id,
            action: 'uye_oldu',
            entityType: 'user',
            entityId: user.id,
            after: { yol: p.provider ?? 'eposta' },
            ip,
          },
          tx,
        );
        await tx.pendingSignup.delete({ where: { id: p.id } });
        const pair = await this.auth.signInTx(tx, user.id, {
          platform,
          ip,
          kurulum,
          yol: 'uyelik',
        });
        return { ...pair, isNewUser: true as const };
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const alan = String((err.meta as { target?: unknown })?.target ?? '');
        if (alan.includes('phone')) throw new ConflictException(this.mesaj.telefon);
        if (alan.includes('email')) throw new ConflictException(this.mesaj.eposta);
        throw new ConflictException(this.mesaj.sosyal);
      }
      throw err;
    }
  }

  private readonly mesaj = {
    eposta: 'Bu e-postayla bir hesap var. Giriş yap ya da şifreni sıfırla.',
    telefon:
      'Bu numara başka bir hesapta doğrulanmış. Hesap senin ise giriş yap; numaran değiştiyse destek ekibimize yaz.',
    sosyal: 'Bu hesap zaten bir üyeliğe bağlı. Giriş yap.',
  };

  private async assertFree(p: { eposta: string; telefon: string; sosyal: KayitJetonu | null }) {
    const [eposta, telefon] = await Promise.all([
      this.db.user.findUnique({ where: { email: p.eposta }, select: { id: true } }),
      this.db.user.findUnique({ where: { phone: p.telefon }, select: { id: true } }),
    ]);
    if (eposta) throw new ConflictException(this.mesaj.eposta);
    if (telefon) throw new ConflictException(this.mesaj.telefon);
    if (p.sosyal) {
      const where =
        p.sosyal.saglayici === 'google' ? { googleSub: p.sosyal.kimlik } : { appleSub: p.sosyal.kimlik };
      if (await this.db.user.findFirst({ where, select: { id: true } })) {
        throw new ConflictException(this.mesaj.sosyal);
      }
    }
  }

  // ── Giriş ─────────────────────────────────────────────────────────────────────

  /** E-posta ve şifreyle giriş. Hesap yoksa da aynı sürede ve aynı hatayla yanıt verilir. */
  async login(
    b: { eposta: string; sifre: string; platform: Platform; kurulum?: string },
    ip?: string,
  ): Promise<TokenPair> {
    const eposta = b.eposta.trim().toLowerCase();
    if (ip) await this.limiter.hit(`giris:ip:${ip}`, 30, 900);
    await this.limiter.hit(`giris:eposta:${sha256(eposta)}`, 10, 900);
    const u = await this.db.user.findUnique({ where: { email: eposta } });
    const hatali = new UnauthorizedException('E-posta ya da şifre hatalı');
    if (!u?.passwordHash) {
      await verifyPassword(b.sifre, await dummyHash());
      throw hatali;
    }
    if (!(await verifyPassword(b.sifre, u.passwordHash))) throw hatali;
    if (u.status !== 'ACTIVE') throw new UnauthorizedException('Hesap kullanıma kapalı');
    await this.auth.assertNotBlocked({ phone: u.phone, ip, kurulum: b.kurulum });
    return this.db.$transaction((tx) =>
      this.auth.signInTx(tx, u.id, { platform: b.platform, ip, kurulum: b.kurulum, yol: 'eposta' }),
    );
  }

  /** Google ile giriş, 1. adım: yönlendirme adresi. Mobilde `state` "m." ile başlar (dönüş uygulamaya yönlenir). */
  async googleStart(platform: Platform, ip?: string): Promise<{ url: string; state: string }> {
    if (!this.google) throw new ServiceUnavailableException('Google ile giriş şu an kapalı');
    if (ip) await this.limiter.hit(`google:baslat:${ip}`, 30, 3600);
    const state = `${platform === 'WEB' ? 'w' : 'm'}.${randomToken(32)}`;
    const nonce = randomToken(16);
    const codeVerifier = randomToken(48);
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    await this.db.userOauthChallenge.deleteMany({
      where: { expiresAt: { lt: new Date(Date.now() - 86400_000) } },
    });
    await this.db.userOauthChallenge.create({
      data: {
        id: uuidv7(),
        stateHash: sha256(state),
        nonce,
        codeVerifier,
        platform,
        expiresAt: new Date(Date.now() + GOOGLE_DAKIKA * 60_000),
        ip: ip ?? null,
      },
    });
    const url = this.google.authorizationUrl({ state, nonce, codeChallenge, redirectUri: this.redirectUri });
    return { url, state };
  }

  /** Google ile giriş, 2. adım: dönüş. Hesap varsa oturum, yoksa üyelik formu bilgileri. */
  async googleCallback(
    state: string,
    code: string,
    ip?: string,
    kurulum?: string,
  ): Promise<SocialLoginResult> {
    if (!this.google) throw new ServiceUnavailableException('Google ile giriş şu an kapalı');
    if (ip) await this.limiter.hit(`google:donus:${ip}`, 30, 3600);
    const ch = await this.db.userOauthChallenge.findUnique({ where: { stateHash: sha256(state) } });
    const sure = new UnauthorizedException('Google girişinin süresi doldu, yeniden dene');
    if (!ch || ch.consumedAt || ch.expiresAt < new Date()) throw sure;
    const k = await this.db.userOauthChallenge.updateMany({
      where: { id: ch.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (k.count !== 1) throw sure;
    let id: Awaited<ReturnType<IdentityProvider['exchange']>>;
    try {
      id = await this.google.exchange({
        code,
        codeVerifier: ch.codeVerifier,
        redirectUri: this.redirectUri,
        nonce: ch.nonce,
      });
    } catch (err) {
      if (!(err instanceof IdentityError)) this.log.error(err);
      throw new UnauthorizedException('Google girişi doğrulanamadı, yeniden dene');
    }
    return this.sosyal(
      'google',
      {
        sub: id.sub,
        eposta: id.email || null,
        dogru: id.emailVerified,
        ad: id.givenName ?? null,
        soyad: id.familyName ?? null,
      },
      { platform: ch.platform as Platform, ip, kurulum },
    );
  }

  /** iPhone'da Apple ile giriş: kimlik jetonu doğrulanır; ad ve soyadı Apple yalnızca ilk seferde verir. */
  async appleLogin(
    b: { kimlikJetonu: string; ad?: string; soyad?: string; platform: Platform; kurulum?: string },
    ip?: string,
  ): Promise<SocialLoginResult> {
    if (!this.apple) throw new ServiceUnavailableException('Apple ile giriş şu an kapalı');
    if (ip) await this.limiter.hit(`apple:${ip}`, 30, 3600);
    let id: Awaited<ReturnType<AppleVerifier['verify']>>;
    try {
      id = await this.apple.verify(b.kimlikJetonu);
    } catch (err) {
      if (!(err instanceof IdentityError)) this.log.error(err);
      throw new UnauthorizedException('Apple girişi doğrulanamadı, yeniden dene');
    }
    return this.sosyal(
      'apple',
      { sub: id.sub, eposta: id.email, dogru: id.emailVerified, ad: b.ad || null, soyad: b.soyad || null },
      { platform: b.platform, ip, kurulum: b.kurulum },
    );
  }

  /**
   * Google ya da Apple kimliği: bağlı hesap varsa oturum açılır. Yoksa aynı e-postayla doğrulanmış bir hesap varsa
   * kimlik o hesaba bağlanır (adres iki tarafta da doğrulanmış). Hiçbiri yoksa üyelik formu için kısa ömürlü jeton.
   */
  private async sosyal(
    saglayici: Saglayici,
    k: SosyalKimlik,
    p: { platform: Platform; ip?: string; kurulum?: string },
  ): Promise<SocialLoginResult> {
    const alan = saglayici === 'google' ? 'googleSub' : 'appleSub';
    let u = await this.db.user.findFirst({ where: { [alan]: k.sub } });
    let baglandi = false;
    if (!u && k.eposta && k.dogru) {
      const ayni = await this.db.user.findUnique({ where: { email: k.eposta } });
      if (ayni && !ayni.emailVerifiedAt) {
        throw new ConflictException('Bu e-postayla bir hesap var. E-posta ve şifrenle giriş yap.');
      }
      if (ayni && !ayni[alan]) {
        u = ayni;
        baglandi = true;
      }
    }
    if (u) {
      if (u.status !== 'ACTIVE') throw new UnauthorizedException('Hesap kullanıma kapalı');
      await this.auth.assertNotBlocked({ phone: u.phone, ip: p.ip, kurulum: p.kurulum });
      const userId = u.id;
      const pair = await this.db.$transaction(async (tx) => {
        if (baglandi) {
          await tx.user.update({ where: { id: userId }, data: { [alan]: k.sub } });
          await this.audit.record(
            {
              actorType: 'USER',
              actorId: userId,
              action: `${saglayici}_baglandi`,
              entityType: 'user',
              entityId: userId,
              ip: p.ip,
            },
            tx,
          );
        }
        return this.auth.signInTx(tx, userId, { ...p, yol: saglayici });
      });
      return { tip: 'giris', ...pair };
    }
    const jeton: KayitJetonu = {
      tur: 'kayit',
      saglayici,
      kimlik: k.sub,
      eposta: k.eposta ?? '',
      dogru: k.dogru,
    };
    return {
      tip: 'kayit',
      kayitJetonu: await this.jwt.signAsync(jeton, { secret: this.kayitSirri, expiresIn: '30m' }),
      saglayici,
      ad: k.ad,
      soyad: k.soyad,
      eposta: k.eposta ?? '',
    };
  }

  /** Üyelik jetonu erişim jetonundan ayrı bir anahtarla imzalanır: oturum yerine kullanılamaz */
  private get kayitSirri() {
    return `${this.env.JWT_SECRET}:kayit`;
  }

  private async kayitJetonuAc(j: string): Promise<KayitJetonu> {
    try {
      const c = await this.jwt.verifyAsync<KayitJetonu>(j, { secret: this.kayitSirri });
      if (c.tur !== 'kayit' || !c.kimlik) throw new Error('tür');
      return c;
    } catch {
      throw new UnauthorizedException('Google ya da Apple girişinin süresi doldu, yeniden dene');
    }
  }

  // ── Şifre ─────────────────────────────────────────────────────────────────────

  /**
   * Şifremi unuttum: hesap varsa işçi e-postaya tek kullanımlık bağlantı gönderir (`hesap.sifre_istendi`). Yanıt her
   * durumda aynıdır (e-postanın kayıtlı olup olmadığı anlaşılmaz).
   */
  async forgot(eposta: string, ip?: string) {
    const adres = eposta.trim().toLowerCase();
    if (ip) await this.limiter.hit(`sifre:ip:${ip}`, 10, 3600);
    try {
      await this.limiter.hit(`sifre:eposta:${sha256(adres)}`, 3, 3600);
    } catch (err) {
      if (err instanceof HttpException && err.getStatus() === HttpStatus.TOO_MANY_REQUESTS) {
        return { gonderildi: true };
      }
      throw err;
    }
    const u = await this.db.user.findUnique({ where: { email: adres }, select: { id: true, status: true } });
    if (u?.status === 'ACTIVE') {
      await this.db.$transaction(async (tx) => {
        await this.audit.record(
          {
            actorType: 'USER',
            actorId: u.id,
            action: 'sifre_istendi',
            entityType: 'user',
            entityId: u.id,
            ip,
          },
          tx,
        );
        await this.outbox.add(tx, 'hesap.sifre_istendi', { userId: u.id });
      });
    }
    return { gonderildi: true };
  }

  /**
   * Bağlantıyla yeni şifre: bağlantı tek kullanımlıktır; bütün oturumlar kapanır. Bağlantı e-postaya geldiği için adres
   * doğrulanmış sayılır.
   */
  async reset(kod: string, sifre: string, ip?: string) {
    if (ip) await this.limiter.hit(`sifre:yenile:${ip}`, 30, 3600);
    const c = await this.db.emailChallenge.findUnique({ where: { tokenHash: sha256(kod) } });
    const gecersiz = new NotFoundException('Bağlantının süresi dolmuş ya da kullanılmış; yeniden iste');
    if (c?.purpose !== 'sifre' || c.usedAt || c.expiresAt < new Date()) throw gecersiz;
    const ozet = await hashPassword(sifre);
    await this.db.$transaction(async (tx) => {
      const k = await tx.emailChallenge.updateMany({
        where: { id: c.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (k.count !== 1) throw gecersiz;
      const u = await tx.user.findUnique({ where: { id: c.userId } });
      if (u?.status !== 'ACTIVE' || u.email !== c.email) throw gecersiz;
      await tx.user.update({
        where: { id: u.id },
        data: { passwordHash: ozet, emailVerifiedAt: u.emailVerifiedAt ?? new Date() },
      });
      await tx.session.updateMany({
        where: { userId: u.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: u.id,
          action: 'sifre_sifirlandi',
          entityType: 'user',
          entityId: u.id,
          ip,
        },
        tx,
      );
      await this.outbox.add(tx, 'hesap.sifre_degisti', { userId: u.id });
    });
    return { degisti: true };
  }

  /**
   * Ayarlar › Güvenlik: şifre değiştir. Şifresi olan mevcut şifresini girer; Google ya da Apple ile üye olan ilk kez
   * şifre belirleyebilir. Bu oturum dışındaki oturumlar kapanır.
   */
  async change(userId: string, sessionId: string, b: { mevcut?: string; yeni: string }, ip?: string) {
    await this.limiter.hit(`sifre:degistir:${userId}`, 10, 3600);
    const u = await this.db.user.findUniqueOrThrow({ where: { id: userId } });
    if (u.passwordHash && !(b.mevcut && (await verifyPassword(b.mevcut, u.passwordHash)))) {
      throw new ForbiddenException('Mevcut şifren hatalı');
    }
    const ozet = await hashPassword(b.yeni);
    return this.db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash: ozet } });
      const kapanan = await tx.session.updateMany({
        where: { userId, id: { not: sessionId }, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: userId,
          action: 'sifre_degisti',
          entityType: 'user',
          entityId: userId,
          ip,
        },
        tx,
      );
      await this.outbox.add(tx, 'hesap.sifre_degisti', { userId });
      return { degisti: true, kapananOturum: kapanan.count };
    });
  }
}
