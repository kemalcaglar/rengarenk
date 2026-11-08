import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { z } from 'zod';
import { ENV, type Env } from '../config/env.js';
import { ConsentService } from '../consents/consent.service.js';
import { type Db, PRISMA } from '../database/prisma.js';

const DAY = 86_400_000;

/**
 * Ticari e-posta ısınma sınırı (Karar 50): yeni IP'ler 4–6 haftada ısıtılır. İlk hafta yalnızca işlemsel e-posta,
 * ikinci hafta günde 200 ticari e-posta, sonra her hafta iki katı; altıncı haftadan sonra sınır yok. İşlemsel e-posta
 * sınıra takılmaz.
 */
export function isinmaLimiti(baslangic: Date | null, now: Date): number {
  if (!baslangic) return 0;
  const hafta = Math.floor((now.getTime() - baslangic.getTime()) / (7 * DAY));
  if (hafta < 1) return 0;
  if (hafta >= 6) return Number.POSITIVE_INFINITY;
  return 200 * 2 ** (hafta - 1);
}

/** Tek tıkla ayrılma bağlantısının imzası (teslim no + HMAC); tahmin edilemez, süresizdir */
export function ayrilmaKodu(secret: string, deliveryId: string) {
  const imza = createHmac('sha256', `rr-ayril:${secret}`).update(deliveryId).digest('base64url').slice(0, 22);
  return `${deliveryId}.${imza}`;
}

function kodCoz(secret: string, k: string) {
  const [id = '', imza = ''] = k.split('.');
  const beklenen = ayrilmaKodu(secret, id).split('.')[1] ?? '';
  const a = Buffer.from(imza);
  const b = Buffer.from(beklenen);
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}

// ── İYS (İleti Yönetim Sistemi; Karar 49) ──────────────────────

export interface IysProvider {
  readonly ad: string;
  /** Ticari ileti onayının ya da retinin İYS'ye bildirilmesi */
  bildir(i: { telefon: string; eposta: string | null; onay: boolean; zaman: Date }): Promise<void>;
}

/**
 * İYS hesabı açılana kadar kayıt bekler (onaylar rıza kaydında, zaman ve sürümle). Hesap açılınca İYS API'sine göre
 * bağdaştırıcı yazılır; bekleyen kayıtlar `iys.izin_degisti` olaylarından yeniden gönderilir.
 */
export class NoIys implements IysProvider {
  readonly ad = 'none';
  async bildir(): Promise<void> {
    throw new Error('İYS bağlantısı henüz yok');
  }
}

export class FakeIys implements IysProvider {
  readonly ad = 'fake';
  readonly kayitlar: { telefon: string; onay: boolean }[] = [];
  async bildir(i: { telefon: string; onay: boolean }) {
    this.kayitlar.push({ telefon: i.telefon, onay: i.onay });
  }
}

export const IYS = Symbol('IYS');

/**
 * Ticari iletiden ayrılma (Karar 49, 50): e-postadaki bağlantı ya da List-Unsubscribe-Post tek tıkla ayrılma. Kampanya
 * e-postaları kapanır, ticari ileti onayı geri alınır (İYS'ye bildirilir), adres ticari gönderim dışı listeye alınır.
 */
@Injectable()
export class CommercialService {
  private readonly log = new Logger(CommercialService.name);
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    private readonly consents: ConsentService,
  ) {}

  async ayril(k: string) {
    const id = kodCoz(this.env.JWT_SECRET, k);
    const d = id ? await this.db.delivery.findUnique({ where: { id } }) : null;
    if (!d?.userId) throw new NotFoundException('Bağlantı geçersiz');
    const u = await this.db.user.findUniqueOrThrow({ where: { id: d.userId }, select: { email: true } });
    await this.db.$transaction(async (tx) => {
      for (const kanal of ['uygulama', 'eposta', 'sms']) {
        await tx.notificationPref.upsert({
          where: { userId_konu_kanal: { userId: d.userId as string, konu: 'kampanya', kanal } },
          create: { userId: d.userId as string, konu: 'kampanya', kanal, acik: false },
          update: { acik: false },
        });
      }
      await this.consents.recordCommercial(tx, d.userId as string, false, 'web');
      await tx.outboxEvent.create({
        data: { type: 'iys.izin_degisti', payload: { userId: d.userId, onay: false } },
      });
      if (u.email) {
        await tx.emailSuppression.upsert({
          where: { email: u.email.toLowerCase() },
          create: { email: u.email.toLowerCase(), reason: 'ayrildi', onlyCommercial: true },
          update: {},
        });
      }
    });
    return { ayrildi: true };
  }

  /**
   * E-posta sunucusunun geri bildirimi (Postal webhook; Karar 50): kalıcı hata adresi hemen, geçici hata 3. kezde,
   * spam şikâyeti ticari gönderimden çıkarır. İmza: `x-rr-eposta-imza` = HMAC-SHA256(EPOSTA_WEBHOOK_SECRET, gövde).
   */
  async geriBildirim(tur: 'kalici' | 'gecici' | 'sikayet', eposta: string) {
    const adres = eposta.trim().toLowerCase();
    if (tur === 'kalici') {
      await this.db.emailSuppression.upsert({
        where: { email: adres },
        create: { email: adres, reason: 'kalici_hata' },
        update: { reason: 'kalici_hata', onlyCommercial: false },
      });
    } else if (tur === 'sikayet') {
      await this.db.emailSuppression.upsert({
        where: { email: adres },
        create: { email: adres, reason: 'sikayet', onlyCommercial: true },
        update: { reason: 'sikayet' },
      });
    } else {
      await this.db.emailSuppression.upsert({
        where: { email: adres },
        create: { email: adres, reason: 'gecici_hata', count: 1 },
        update: { count: { increment: 1 } },
      });
    }
    this.log.log(`e-posta geri bildirimi: ${tur}`);
    return { ok: true };
  }

  /** İşçi: ticari ileti onayı değişince İYS'ye bildirir; İYS bağlantısı yoksa rıza kaydında bekler */
  async iysEsitle(iys: IysProvider, userId: string, onay: boolean) {
    if (iys.ad === 'none') return false;
    const u = await this.db.user.findUnique({ where: { id: userId }, select: { phone: true, email: true } });
    if (!u) return false;
    await iys.bildir({ telefon: u.phone, eposta: u.email, onay, zaman: new Date() });
    return true;
  }

  imzaDogru(govde: string, imza: string | undefined) {
    const sir = this.env.EPOSTA_WEBHOOK_SECRET;
    if (!sir || !imza) return false;
    const b = Buffer.from(createHmac('sha256', sir).update(govde).digest('hex'));
    const a = Buffer.from(imza);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}

const geriSchema = z.object({ tur: z.enum(['kalici', 'gecici', 'sikayet']), eposta: z.email() }).strict();

@Controller()
export class CommercialController {
  constructor(private readonly c: CommercialService) {}

  /** Web sayfası ve tek tıkla ayrılma (RFC 8058: List-Unsubscribe-Post) aynı ucu kullanır */
  @Post('iletisim/ayril')
  @HttpCode(200)
  ayril(@Query('k') k: string) {
    return this.c.ayril(k ?? '');
  }

  @Post('eposta/geri-bildirim')
  @HttpCode(200)
  geri(@Headers('x-rr-eposta-imza') imza: string | undefined, @Body() body: unknown) {
    if (!this.c.imzaDogru(JSON.stringify(body ?? {}), imza)) throw new UnauthorizedException();
    const b = geriSchema.parse(body);
    return this.c.geriBildirim(b.tur, b.eposta);
  }
}
