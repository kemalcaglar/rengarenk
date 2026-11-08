import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { type Conversation, Prisma, uuidv7 } from '@rengarenk/db';
import {
  type CategoryDefinition,
  COLORS,
  demandOwnerName,
  FLAG_TITLES,
  FUELS,
  GALLERY_PLANS,
  GALLERY_TRIAL,
  type GalleryPlanKey,
  GEARBOXES,
  MEMBER_ROLE_NAMES,
  type MessageFlag,
  SECURITY_WARNING,
  scanMessage,
  VEHICLE_MESSAGE_DAILY,
} from '@rengarenk/shared';
import { ENV, type Env } from '../config/env.js';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';
import { EntitlementService } from '../entitlements/entitlement.service.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { vehicleNames } from '../portfolio/vehicle-names.js';
import { SecretBox } from '../staff/secret-box.js';
import { rozetler } from '../trust/badges.js';
import { TrustService } from '../trust/trust.service.js';
import { RealtimeService } from './realtime.service.js';

/** Bireysel satıcının günlük ücretsiz ilk mesajı; kategori kuralı yoksa (Karar 11.2) */
const VARSAYILAN_UCRETSIZ = 5;

/** Türkiye saatiyle bugünün başlangıcı (UTC+3, yaz saati yok); günlük haklar 00.00'da yenilenir (Karar 12.3) */
const bugun = () => {
  const tr = new Date(Date.now() + 3 * 3600_000);
  return new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate()) - 3 * 3600_000);
};
const telefonYaz = (e164: string) => {
  const d = e164.replace(/^\+90/, '');
  return `0${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8)}`;
};
const basHarf = (ad: string) =>
  ad
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toLocaleUpperCase('tr-TR'))
    .join('');
const ad = <T extends { key: string; ad: string }>(list: readonly T[], k: string | null) =>
  k ? (list.find((x) => x.key === k)?.ad ?? null) : null;
const binlik = (n: number | bigint) => new Intl.NumberFormat('tr-TR').format(n);
const tekrar = (e: unknown, mesaj: string) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' ? new ConflictException(mesaj) : e;

/** Satıcı bağlamı: galeri adına ya da bireysel */
interface Satici {
  userId: string;
  accountId: string;
  galeri: { ad: string; gunlukMesaj: number; kisiSiniri: number | null } | null;
}

type Taraf = 'alici' | 'satici';

/**
 * Mesajlaşma (Karar 08, 11, 25, 26, 27; Teknik tasarım §7, §8). Satıcı bir talebe hesabı adına tek ilk mesaj atar;
 * hak sırası: günlük ücretsiz (bireysel) ya da paketin günlük hakkı (galeri), sonra satın alınan ek hak. Hakkın düşmesi
 * ve mesajın yazılması aynı işlemdedir. Alıcı yanıtlarsa sohbet açılır, "İlgilenmiyorum" derse satıcı yeniden yazamaz.
 * Açık sohbette yazışmak hak tüketmez. Mesaj gövdesi şifreli saklanır; şüpheli kalıplar uyarı bandı ve moderasyon
 * sinyali üretir.
 */
@Injectable()
export class MessagesService {
  private readonly box: SecretBox;

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(ENV) env: Env,
    private readonly entitlements: EntitlementService,
    private readonly outbox: OutboxService,
    private readonly realtime: RealtimeService,
    private readonly trust: TrustService,
  ) {
    this.box = SecretBox.forMessages(env);
  }

  // ── Bağlam ve haklar ──────────────────────────────────────────

  private async personal(userId: string) {
    const m = await this.db.accountMember.findFirst({
      where: { userId, role: 'OWNER', account: { kind: 'INDIVIDUAL', status: 'ACTIVE' } },
      select: { accountId: true },
    });
    if (!m) throw new ForbiddenException('Bireysel hesap bulunamadı');
    return m.accountId;
  }

  private async satici(userId: string, hesap?: string): Promise<Satici> {
    if (!hesap) return { userId, accountId: await this.personal(userId), galeri: null };
    const m = await this.db.accountMember.findUnique({
      where: { accountId_userId: { accountId: hesap, userId } },
      include: { account: { include: { gallery: true } } },
    });
    const g = m?.account.gallery;
    if (!m || !g) {
      if (m?.account.kind === 'INDIVIDUAL') return { userId, accountId: hesap, galeri: null };
      throw new ForbiddenException('Bu hesap adına yazamazsın');
    }
    if (m.account.status !== 'ACTIVE') throw new ForbiddenException('Galeri hesabı askıda');
    const plan = g.plan as GalleryPlanKey;
    if (plan === 'deneme' && g.trialEndsAt && g.trialEndsAt < new Date()) {
      throw new ForbiddenException('Deneme süren bitti; paket seçene kadar mesaj gönderemezsin');
    }
    const ozellik = plan === 'deneme' ? GALLERY_TRIAL : GALLERY_PLANS[plan];
    return {
      userId,
      accountId: hesap,
      galeri: { ad: g.displayName, gunlukMesaj: ozellik.gunlukMesaj, kisiSiniri: m.dailyMessageLimit },
    };
  }

  private async rules(categoryId: string, version: number | null) {
    if (!version) return null;
    const v = await this.db.categorySchemaVersion.findUnique({
      where: { categoryId_version: { categoryId, version } },
      select: { definition: true },
    });
    return (v?.definition as unknown as CategoryDefinition | undefined) ?? null;
  }

  /** Günlük hak: galeride paketin günlük ilk mesajı, bireyselde kategorinin ücretsiz hakkı (Karar 11.2, 12.2) */
  private async gunluk(s: Satici, toplamBireysel: number, tx: Tx | Db = this.db) {
    const toplam = s.galeri ? s.galeri.gunlukMesaj : toplamBireysel;
    const kullanilan = await tx.conversation.count({
      where: {
        sellerAccountId: s.accountId,
        origin: 'talep',
        entitlement: s.galeri ? 'paket' : 'gunluk',
        createdAt: { gte: bugun() },
      },
    });
    return { toplam, kalan: Math.max(0, toplam - kullanilan) };
  }

  /** Sahibin çalışana koyduğu günlük ilk mesaj sınırı (Karar 20); paket hakkı ortak havuzdur */
  private async kisiSiniri(s: Satici, tx: Tx | Db = this.db) {
    const sinir = s.galeri?.kisiSiniri;
    if (!sinir) return;
    const bugunku = await tx.conversation.count({
      where: {
        sellerAccountId: s.accountId,
        sellerUserId: s.userId,
        origin: 'talep',
        createdAt: { gte: bugun() },
      },
    });
    if (bugunku >= sinir) {
      throw new ForbiddenException(
        `Bugünkü kişisel ilk mesaj sınırın (${sinir}) doldu; sınırı galeri sahibi değiştirebilir`,
      );
    }
  }

  /**
   * Talep sayfasındaki iletişim kutusu (Main.dc.html): bu talebe yazılabilir mi, hangi hesaplarla, kalan hak.
   * "Bu talebe yalnızca bir ilk mesaj atabilirsiniz. Bugün kalan ücretsiz mesaj hakkınız: 4 / 5"
   */
  async demandState(userId: string, no: number, hesap?: string) {
    const d = await this.db.demand.findUnique({
      where: { no: BigInt(no) },
      select: {
        id: true,
        accountId: true,
        userId: true,
        categoryId: true,
        schemaVersion: true,
        status: true,
      },
    });
    if (!d) throw new NotFoundException('Talep bulunamadı');
    const ms = await this.db.accountMember.findMany({
      where: { userId, account: { status: 'ACTIVE' } },
      include: { account: { select: { kind: true, gallery: { select: { displayName: true } } } } },
    });
    const hesaplar = ms
      .filter((m) => m.account.gallery || (m.account.kind === 'INDIVIDUAL' && m.role === 'OWNER'))
      .map((m) => ({
        id: m.accountId,
        ad: m.account.gallery?.displayName ?? 'Bireysel',
        galeri: !!m.account.gallery,
      }));
    if (d.userId === userId || hesaplar.some((h) => h.id === d.accountId)) {
      return { kendi: true, yazildi: null, hesaplar: [], gunluk: null, ek: 0, engel: null };
    }
    const secili = hesaplar.find((h) => h.id === hesap) ?? hesaplar.find((h) => !h.galeri) ?? hesaplar[0];
    if (!secili) throw new ForbiddenException('Bireysel hesap bulunamadı');
    const def = await this.rules(d.categoryId, d.schemaVersion);
    let gunluk: { toplam: number; kalan: number } | null = null;
    let engel: string | null = d.status === 'PUBLISHED' ? null : 'Talep yayında değil; satıcılar yazamaz';
    try {
      const s = await this.satici(userId, secili.galeri ? secili.id : undefined);
      gunluk = await this.gunluk(s, def?.rules.freeFirstMessages ?? VARSAYILAN_UCRETSIZ);
      await this.kisiSiniri(s);
    } catch (e) {
      engel ??= (e as Error).message;
    }
    const [yazildi, ek, blok] = await Promise.all([
      this.db.conversation.findFirst({
        where: { demandId: d.id, sellerAccountId: secili.id, origin: 'talep' },
        select: { id: true },
      }),
      this.entitlements.balance(secili.id, 'ilk_mesaj'),
      this.db.userBlock.findUnique({
        where: { userId_accountId: { userId: d.userId, accountId: secili.id } },
      }),
    ]);
    if (blok) engel ??= 'Talep sahibi bu hesaptan mesaj almak istemiyor';
    return { kendi: false, yazildi: yazildi?.id ?? null, hesap: secili.id, hesaplar, gunluk, ek, engel };
  }

  // ── İlk mesaj ─────────────────────────────────────────────────

  /** Talebe ilk mesaj (Karar 08.1, 11.1, 26). Galeri isterse yayındaki portföy aracını kart olarak ekler. */
  async sendFirst(userId: string, no: number, b: { metin: string; hesap?: string; aracId?: string }) {
    const d = await this.db.demand.findUnique({ where: { no: BigInt(no) } });
    if (!d) throw new NotFoundException('Talep bulunamadı');
    if (d.status !== 'PUBLISHED') throw new ConflictException('Talep yayında değil; satıcılar yazamaz');
    const s = await this.satici(userId, b.hesap);
    if (d.userId === userId || d.accountId === s.accountId) {
      throw new ForbiddenException('Kendi talebine mesaj atamazsın');
    }
    if (s.galeri) {
      const uye = await this.db.accountMember.findUnique({
        where: { accountId_userId: { accountId: s.accountId, userId: d.userId } },
      });
      if (uye) throw new ForbiddenException('Kendi galerinin çalışanının talebine yazamazsın');
    }
    if (
      await this.db.userBlock.findUnique({
        where: { userId_accountId: { userId: d.userId, accountId: s.accountId } },
      })
    ) {
      throw new ForbiddenException('Talep sahibi bu hesaptan mesaj almak istemiyor');
    }
    const def = await this.rules(d.categoryId, d.schemaVersion);
    const alanlar = ((d.data as { alanlar?: Record<string, unknown> }).alanlar ?? {}) as Record<
      string,
      unknown
    >;
    const kimden = alanlar.kimden;
    if (Array.isArray(kimden) && kimden.length && !kimden.includes(s.galeri ? 'galeri' : 'sahibinden')) {
      throw new ForbiddenException(
        s.galeri ? 'Alıcı yalnızca sahibinden araç arıyor' : 'Alıcı yalnızca galerilerden araç arıyor',
      );
    }
    if (b.aracId) await this.kartKontrol(s, b.aracId, alanlar, def);
    const flags = scanMessage(b.metin);
    const id = uuidv7();
    const now = new Date();
    try {
      await this.db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ilkmesaj:${s.accountId}`}))`;
        await this.kisiSiniri(s, tx);
        const g = await this.gunluk(s, def?.rules.freeFirstMessages ?? VARSAYILAN_UCRETSIZ, tx);
        let entitlement: 'gunluk' | 'paket' | 'ek' = s.galeri ? 'paket' : 'gunluk';
        if (g.kalan < 1) {
          await this.entitlements.consume(tx, s.accountId, 'ilk_mesaj', {
            sourceType: 'message',
            sourceId: id,
            createdBy: userId,
          });
          entitlement = 'ek';
        }
        await tx.conversation.create({
          data: {
            id,
            origin: 'talep',
            demandId: d.id,
            buyerUserId: d.userId,
            sellerAccountId: s.accountId,
            sellerUserId: userId,
            status: 'WAITING',
            entitlement,
            warned: flags.length > 0,
            lastMessageAt: now,
            sellerReadAt: now,
          },
        });
        await this.yaz(tx, id, 'satici', userId, b.metin, flags);
        if (b.aracId) await this.kart(tx, id, 'satici', userId, b.aracId);
        await this.outbox.add(tx, 'mesaj.ilk', {
          conversationId: id,
          demandId: d.id,
          sellerAccountId: s.accountId,
          entitlement,
        });
        if (flags.length) await this.outbox.add(tx, 'mesaj.uyari', { conversationId: id, flags });
      });
    } catch (e) {
      throw tekrar(e, 'Bu talebe bu hesaptan zaten ilk mesaj atıldı');
    }
    await this.bildir(id);
    return { id };
  }

  /** Araç kartı: galerinin kendi, yayındaki (EİDS onaylı) aracı; alıcının kabul etmediği işlem varsa yazamaz */
  private async kartKontrol(
    s: Satici,
    aracId: string,
    alanlar: Record<string, unknown>,
    def: CategoryDefinition | null,
  ) {
    if (!s.galeri) throw new ForbiddenException('Bireysel satıcılar araç kartı gönderemez');
    const v = await this.db.portfolioVehicle.findFirst({
      where: { id: aracId, accountId: s.accountId, status: 'PUBLISHED' },
      select: { damage: true },
    });
    if (!v) throw new UnprocessableEntityException('Yalnızca yayındaki, EİDS doğrulanmış araç eklenebilir');
    // "Seçmediğin işlemlerden biri olan araçlar sana yazamaz" (talep sihirbazı, Kabul ettiğin işlemler)
    if (def?.fields.some((f) => f.key === 'islemKabul')) {
      const kabul = (alanlar.islemKabul as string[] | undefined) ?? [];
      const h = v.damage as Record<string, unknown>;
      const islem = (
        [
          ['sasi', 'sasiIslem'],
          ['podye', 'podyeIslem'],
          ['airbag', 'airbagAcildi'],
          ['agir', 'agirHasar'],
        ] as const
      ).some(([k, alan]) => h[alan] === true && !kabul.includes(k));
      if (islem) {
        throw new UnprocessableEntityException(
          'Bu araçta alıcının kabul etmediği bir işlem var; bu araçla yazamazsın',
        );
      }
    }
  }

  private async yaz(
    tx: Tx,
    conversationId: string,
    side: Taraf,
    userId: string,
    metin: string,
    flags: MessageFlag[],
  ) {
    await tx.message.create({
      data: {
        id: uuidv7(),
        conversationId,
        side,
        senderUserId: userId,
        kind: 'metin',
        body: this.box.seal(metin),
        flags,
      },
    });
  }

  private async kart(
    tx: Tx,
    conversationId: string,
    side: Taraf | 'sistem',
    userId: string | null,
    aracId: string,
  ) {
    await tx.message.create({
      data: {
        id: uuidv7(),
        conversationId,
        side,
        senderUserId: userId,
        kind: 'kart',
        body: this.box.seal(''),
        vehicleId: aracId,
      },
    });
  }

  private async sistem(tx: Tx, conversationId: string, metin: string) {
    await tx.message.create({
      data: { id: uuidv7(), conversationId, side: 'sistem', kind: 'sistem', body: this.box.seal(metin) },
    });
  }

  /** Alıcı portföy aracı için galeriye yazar (Karar 27): ücretsiz, günde en çok 10 farklı araç, sohbet araç kartıyla başlar */
  async sendToVehicle(userId: string, no: number, metin: string) {
    const v = await this.db.portfolioVehicle.findUnique({
      where: { no: BigInt(no) },
      select: { id: true, accountId: true, status: true, assignedTo: true, createdBy: true },
    });
    if (v?.status !== 'PUBLISHED') throw new NotFoundException('Araç bulunamadı');
    const uye = await this.db.accountMember.findUnique({
      where: { accountId_userId: { accountId: v.accountId, userId } },
    });
    if (uye) throw new ForbiddenException('Kendi galerinin aracına yazamazsın');
    const var_ = await this.db.conversation.findFirst({
      where: { origin: 'arac', vehicleId: v.id, buyerUserId: userId },
      select: { id: true },
    });
    if (var_) {
      await this.send(userId, var_.id, { metin });
      return { id: var_.id };
    }
    const flags = scanMessage(metin);
    const id = uuidv7();
    const now = new Date();
    try {
      await this.db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`aracmesaj:${userId}`}))`;
        const bugunku = await tx.conversation.count({
          where: { buyerUserId: userId, origin: 'arac', createdAt: { gte: bugun() } },
        });
        if (bugunku >= VEHICLE_MESSAGE_DAILY) {
          throw new HttpException(
            `Bugün en çok ${VEHICLE_MESSAGE_DAILY} farklı araç için yazabilirsin`,
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        await tx.conversation.create({
          data: {
            id,
            origin: 'arac',
            vehicleId: v.id,
            buyerUserId: userId,
            sellerAccountId: v.accountId,
            sellerUserId: v.assignedTo ?? v.createdBy,
            status: 'OPEN',
            entitlement: 'alici',
            lastMessageAt: now,
            buyerReadAt: now,
          },
        });
        await this.kart(tx, id, 'sistem', null, v.id);
        await this.yaz(tx, id, 'alici', userId, metin, flags);
        await this.outbox.add(tx, 'mesaj.geldi', { conversationId: id, origin: 'arac' });
      });
    } catch (e) {
      throw tekrar(e, 'Bu araç için zaten bir sohbetin var');
    }
    await this.bildir(id);
    return { id };
  }

  // ── Sohbet ────────────────────────────────────────────────────

  /** Kullanıcının hesapları: kişisel ve üyesi olduğu galeriler */
  private async hesaplar(userId: string) {
    const ms = await this.db.accountMember.findMany({ where: { userId }, select: { accountId: true } });
    return ms.map((m) => m.accountId);
  }

  private async erisim(userId: string, id: string): Promise<{ c: Conversation; taraf: Taraf }> {
    const c = await this.db.conversation.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Sohbet bulunamadı');
    if (c.buyerUserId === userId) return { c, taraf: 'alici' };
    const m = await this.db.accountMember.findUnique({
      where: { accountId_userId: { accountId: c.sellerAccountId, userId } },
    });
    if (!m) throw new NotFoundException('Sohbet bulunamadı');
    return { c, taraf: 'satici' };
  }

  /** Sohbete mesaj. Alıcının ilk yanıtı sohbeti açar; satıcı alıcı yanıtlamadan ikinci mesaj atamaz (Karar 11.1). */
  async send(userId: string, id: string, b: { metin: string; aracId?: string }) {
    const { c, taraf } = await this.erisim(userId, id);
    if (c.status === 'DECLINED') throw new ConflictException('Bu sohbet kapandı');
    if (taraf === 'satici') {
      if (c.status === 'WAITING')
        throw new ConflictException('Alıcı yanıt verene kadar ikinci mesaj atılamaz');
      const blok = await this.db.userBlock.findUnique({
        where: { userId_accountId: { userId: c.buyerUserId, accountId: c.sellerAccountId } },
      });
      if (blok) throw new ForbiddenException('Alıcı bu hesaptan mesaj almak istemiyor');
    }
    if (b.aracId) {
      if (taraf !== 'satici') throw new ForbiddenException('Araç kartını yalnızca galeri ekleyebilir');
      const s = await this.satici(userId, c.sellerAccountId);
      const d = c.demandId
        ? await this.db.demand.findUnique({
            where: { id: c.demandId },
            select: { data: true, categoryId: true, schemaVersion: true },
          })
        : null;
      const alanlar = ((d?.data as { alanlar?: Record<string, unknown> } | undefined)?.alanlar ??
        {}) as Record<string, unknown>;
      await this.kartKontrol(
        s,
        b.aracId,
        alanlar,
        d ? await this.rules(d.categoryId, d.schemaVersion) : null,
      );
    }
    const flags = scanMessage(b.metin);
    const now = new Date();
    await this.db.$transaction(async (tx) => {
      if (taraf === 'alici' && c.status === 'WAITING') {
        await tx.conversation.update({ where: { id }, data: { status: 'OPEN' } });
        await this.sistem(tx, id, 'Sohbet açıldı. Artık iki taraf da serbestçe yazışabilir.');
      }
      await this.yaz(tx, id, taraf, userId, b.metin, flags);
      if (b.aracId) await this.kart(tx, id, 'satici', userId, b.aracId);
      await tx.conversation.update({
        where: { id },
        data: {
          lastMessageAt: now,
          ...(taraf === 'alici' ? { buyerReadAt: now } : { sellerReadAt: now }),
          ...(taraf === 'satici' && flags.length ? { warned: true } : {}),
        },
      });
      await this.outbox.add(tx, 'mesaj.geldi', { conversationId: id, side: taraf });
      if (flags.length) await this.outbox.add(tx, 'mesaj.uyari', { conversationId: id, flags, side: taraf });
    });
    await this.bildir(id);
    return this.detail(userId, id);
  }

  /** "İlgilenmiyorum": satıcı bu talebe yeniden yazamaz */
  async decline(userId: string, id: string) {
    const { c, taraf } = await this.erisim(userId, id);
    if (taraf !== 'alici') throw new ForbiddenException();
    if (c.status !== 'WAITING') throw new ConflictException('Yalnızca yanıtlanmamış ilk mesaj reddedilir');
    await this.db.$transaction(async (tx) => {
      await tx.conversation.update({ where: { id }, data: { status: 'DECLINED', buyerReadAt: new Date() } });
      await this.sistem(tx, id, 'Alıcı ilgilenmediğini belirtti. Bu talebe yeniden yazılamaz.');
      await this.outbox.add(tx, 'mesaj.geldi', { conversationId: id, side: 'sistem' });
    });
    await this.bildir(id);
    return this.detail(userId, id);
  }

  /** "Numaramı paylaş" (MesajlarMobil.dc.html): satıcı numarayı yalnızca alıcı paylaşınca görür; olay kaydedilir */
  async sharePhone(userId: string, id: string) {
    const { c, taraf } = await this.erisim(userId, id);
    if (taraf !== 'alici') throw new ForbiddenException();
    if (c.status !== 'OPEN') throw new ConflictException('Numara açık sohbette paylaşılır');
    if (c.phoneSharedAt) return this.detail(userId, id);
    const u = await this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { phone: true } });
    await this.db.$transaction(async (tx) => {
      const now = new Date();
      await tx.conversation.update({ where: { id }, data: { phoneSharedAt: now, lastMessageAt: now } });
      await this.sistem(tx, id, `Alıcı numarasını paylaştı: ${telefonYaz(u.phone)}`);
      await this.outbox.add(tx, 'sohbet.numara_paylasildi', {
        conversationId: id,
        sellerAccountId: c.sellerAccountId,
      });
    });
    await this.bildir(id);
    return this.detail(userId, id);
  }

  /** Engelle (Karar 11.3): alıcı satıcı hesabını engeller; engellenen hesap o alıcıya yazamaz */
  async block(userId: string, id: string, engelle: boolean) {
    const { c, taraf } = await this.erisim(userId, id);
    if (taraf !== 'alici') throw new ForbiddenException('Satıcıyı yalnızca alıcı engelleyebilir');
    const key = { userId_accountId: { userId, accountId: c.sellerAccountId } };
    if (engelle) {
      await this.db.$transaction(async (tx) => {
        await tx.userBlock.upsert({
          where: key,
          create: { userId, accountId: c.sellerAccountId },
          update: {},
        });
        await this.outbox.add(tx, 'sohbet.engellendi', {
          conversationId: id,
          sellerAccountId: c.sellerAccountId,
        });
      });
    } else await this.db.userBlock.deleteMany({ where: { userId, accountId: c.sellerAccountId } });
    return this.detail(userId, id);
  }

  async read(userId: string, id: string) {
    const { taraf } = await this.erisim(userId, id);
    await this.db.conversation.update({
      where: { id },
      data: taraf === 'alici' ? { buyerReadAt: new Date() } : { sellerReadAt: new Date() },
    });
    return { ok: true };
  }

  /** Anlık iletim: sohbetin iki tarafındaki herkese "sohbet değişti" (istemci yeniden çeker) */
  private async bildir(id: string) {
    const c = await this.db.conversation.findUnique({
      where: { id },
      select: { buyerUserId: true, sellerAccountId: true },
    });
    if (!c) return;
    const ms = await this.db.accountMember.findMany({
      where: { accountId: c.sellerAccountId },
      select: { userId: true },
    });
    await this.realtime
      .publish([c.buyerUserId, ...ms.map((m) => m.userId)], { tip: 'sohbet', id })
      .catch(() => undefined);
  }

  // ── Görünümler ────────────────────────────────────────────────

  private async okunmamis(userId: string, ids: string[]) {
    if (!ids.length) return new Map<string, number>();
    const rows = await this.db.$queryRaw<{ id: string; n: number }[]>`
      SELECT m.conversation_id AS id, count(*)::int AS n
      FROM messages m JOIN conversations c ON c.id = m.conversation_id
      WHERE c.id = ANY(${ids}::uuid[]) AND (
        (c.buyer_user_id = ${userId}::uuid AND m.side <> 'alici' AND (c.buyer_read_at IS NULL OR m.created_at > c.buyer_read_at))
        OR (c.buyer_user_id <> ${userId}::uuid AND m.side <> 'satici' AND (c.seller_read_at IS NULL OR m.created_at > c.seller_read_at))
      )
      GROUP BY m.conversation_id`;
    return new Map(rows.map((r) => [r.id, r.n]));
  }

  private async sonMesajlar(ids: string[]) {
    if (!ids.length) return new Map<string, { kind: string; body: string; side: string }>();
    const rows = await this.db.$queryRaw<{ id: string; kind: string; body: string; side: string }[]>`
      SELECT DISTINCT ON (conversation_id) conversation_id AS id, kind, body, side
      FROM messages WHERE conversation_id = ANY(${ids}::uuid[])
      ORDER BY conversation_id, created_at DESC, id DESC`;
    return new Map(rows.map((r) => [r.id, r]));
  }

  private acik(body: string) {
    try {
      return this.box.open(body);
    } catch {
      return '';
    }
  }

  /** Mesajlarım (Mesajlar.dc.html, MesajlarMobil.dc.html): alıcı ve satıcı olarak bütün sohbetler, son mesaja göre */
  async list(userId: string) {
    const hesaplar = await this.hesaplar(userId);
    const cs = await this.db.conversation.findMany({
      where: { OR: [{ buyerUserId: userId }, { sellerAccountId: { in: hesaplar } }] },
      orderBy: { lastMessageAt: 'desc' },
      take: 200,
      include: {
        demand: {
          select: {
            no: true,
            title: true,
            headline: true,
            nameMode: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
        vehicle: true,
        buyer: { select: { firstName: true, lastName: true } },
        sellerAccount: { select: { kind: true, gallery: { select: { displayName: true } } } },
      },
    });
    const ids = cs.map((c) => c.id);
    const [okunmamis, son, saticilar, engeller] = await Promise.all([
      this.okunmamis(userId, ids),
      this.sonMesajlar(ids),
      this.db.user.findMany({
        where: { id: { in: [...new Set(cs.map((c) => c.sellerUserId))] } },
        select: { id: true, firstName: true, lastName: true },
      }),
      this.db.userBlock.findMany({ where: { userId }, select: { accountId: true } }),
    ]);
    const n = await vehicleNames(
      this.db,
      cs.flatMap((c) => (c.vehicle ? [c.vehicle] : [])),
    );
    const satici = new Map(saticilar.map((u) => [u.id, u]));
    const engelli = new Set(engeller.map((e) => e.accountId));
    const rz = await rozetler(
      this.db,
      cs.filter((c) => c.buyerUserId === userId).map((c) => c.sellerAccountId),
    );
    return cs.map((c) => {
      const taraf: Taraf = c.buyerUserId === userId ? 'alici' : 'satici';
      const s = son.get(c.id);
      const sonMetin = !s ? '' : s.kind === 'kart' ? 'Araç kartı' : this.acik(s.body);
      const karsi = this.karsiAd(c, taraf, satici.get(c.sellerUserId));
      return {
        id: c.id,
        taraf,
        ad: karsi.ad,
        bas: basHarf(karsi.ad),
        galeri: karsi.galeri,
        talep: c.demand ? { no: Number(c.demand.no), baslik: c.demand.headline ?? c.demand.title } : null,
        arac: c.vehicle ? { no: Number(c.vehicle.no), ad: n(c.vehicle).ad } : null,
        son: sonMetin,
        zaman: c.lastMessageAt,
        durum: c.status,
        ilkMesaj: c.origin === 'talep' && c.entitlement !== 'alici',
        bekliyor: c.status === 'WAITING',
        uyari: taraf === 'alici' && c.warned,
        numara: !!c.phoneSharedAt,
        engelli: taraf === 'alici' && engelli.has(c.sellerAccountId),
        // Alıcı satıcının rozetlerini görür (Karar 55)
        rozetler: taraf === 'alici' ? (rz.get(c.sellerAccountId) ?? []) : [],
        okunmamis: okunmamis.get(c.id) ?? 0,
      };
    });
  }

  /** Okunmamış mesaj sayısı; `hesap` verilirse yalnızca o galerinin sohbetleri (galeri paneli › Özet) */
  async unreadCount(userId: string, hesap?: string) {
    const hesaplar = await this.hesaplar(userId);
    if (hesap && !hesaplar.includes(hesap)) throw new NotFoundException('Galeri bulunamadı');
    const cs = await this.db.conversation.findMany({
      where: hesap
        ? { sellerAccountId: hesap }
        : { OR: [{ buyerUserId: userId }, { sellerAccountId: { in: hesaplar } }] },
      select: { id: true },
      take: 500,
      orderBy: { lastMessageAt: 'desc' },
    });
    const m = await this.okunmamis(
      userId,
      cs.map((c) => c.id),
    );
    let toplam = 0;
    for (const v of m.values()) toplam += v;
    return { okunmamis: toplam, sohbet: m.size };
  }

  private karsiAd(
    c: Conversation & {
      demand: { nameMode: string; user: { firstName: string | null; lastName: string | null } } | null;
      buyer: { firstName: string | null; lastName: string | null };
      sellerAccount: { kind: string; gallery: { displayName: string } | null };
    },
    taraf: Taraf,
    saticiKisi?: { firstName: string | null; lastName: string | null },
  ) {
    if (taraf === 'satici') {
      const mod = (c.demand?.nameMode as 'tam' | 'kisa' | undefined) ?? 'kisa';
      return { ad: demandOwnerName(c.buyer.firstName, c.buyer.lastName, mod), galeri: false };
    }
    if (c.sellerAccount.gallery) return { ad: c.sellerAccount.gallery.displayName, galeri: true };
    return {
      ad: demandOwnerName(saticiKisi?.firstName, saticiKisi?.lastName, 'kisa', 'Bireysel satıcı'),
      galeri: false,
    };
  }

  /** Sohbet ekranı: başlık, talep ya da araç bağlantısı, mesajlar (kart ve uyarı bandıyla), yapılabilecekler */
  async detail(userId: string, id: string, okundu = true) {
    const { taraf } = await this.erisim(userId, id);
    const c = await this.db.conversation.findUniqueOrThrow({
      where: { id },
      include: {
        demand: {
          select: {
            no: true,
            title: true,
            headline: true,
            nameMode: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
        vehicle: true,
        buyer: { select: { firstName: true, lastName: true, phone: true } },
        sellerAccount: {
          select: { kind: true, gallery: { select: { displayName: true, slug: true, authorityNo: true } } },
        },
        messages: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 500 },
      },
    });
    const kisiIds = [
      ...new Set([c.sellerUserId, ...c.messages.flatMap((m) => (m.senderUserId ? [m.senderUserId] : []))]),
    ];
    const [kisiler, uyelik, blok] = await Promise.all([
      this.db.user.findMany({
        where: { id: { in: kisiIds } },
        select: { id: true, firstName: true, lastName: true },
      }),
      this.db.accountMember.findUnique({
        where: { accountId_userId: { accountId: c.sellerAccountId, userId: c.sellerUserId } },
        select: { role: true },
      }),
      this.db.userBlock.findUnique({
        where: { userId_accountId: { userId: c.buyerUserId, accountId: c.sellerAccountId } },
      }),
    ]);
    const kisi = new Map(kisiler.map((k) => [k.id, k]));
    const satici = kisi.get(c.sellerUserId);
    const karsi = this.karsiAd(c, taraf, satici);
    const saticiAd = [satici?.firstName, satici?.lastName].filter(Boolean).join(' ');
    const g = c.sellerAccount.gallery;
    const alt =
      taraf === 'satici'
        ? c.demand
          ? 'Talep sahibi'
          : 'Portföy aracın için yazdı'
        : g
          ? [
              'Galeri',
              saticiAd && uyelik
                ? `${saticiAd}, ${MEMBER_ROLE_NAMES[uyelik.role].toLocaleLowerCase('tr-TR')}`
                : null,
              g.authorityNo ? `Yetki belgesi no: ${g.authorityNo}` : null,
            ]
              .filter(Boolean)
              .join(' · ')
          : 'Bireysel satıcı · Telefon numarası doğrulandı';

    // Araç kartları
    const kartIds = [...new Set(c.messages.flatMap((m) => (m.vehicleId ? [m.vehicleId] : [])))];
    const araclar = kartIds.length
      ? await this.db.portfolioVehicle.findMany({
          where: { id: { in: kartIds } },
          include: { photos: { orderBy: { sort: 'asc' }, take: 1, select: { id: true } } },
        })
      : [];
    const n = await vehicleNames(this.db, [...araclar, ...(c.vehicle ? [c.vehicle] : [])]);
    const kartlar = new Map(
      araclar.map((v) => [
        v.id,
        {
          no: Number(v.no),
          ad: n(v).ad,
          ozet: [`${binlik(v.km)} km`, ad(FUELS, v.fuel), ad(GEARBOXES, v.gearbox), ad(COLORS, v.color)]
            .filter(Boolean)
            .join(' · '),
          fiyat: Number(v.priceTl),
          foto: v.photos[0] ? `/portfoy/fotolar/${v.photos[0].id}` : null,
          // Satılan ya da kaldırılan araç: "Bu araç artık satışta değil" (Karar 26)
          satista: v.status === 'PUBLISHED',
        },
      ]),
    );

    const mesajlar = c.messages.map((m) => {
      const benim = m.side === taraf;
      const flags = m.flags as MessageFlag[];
      const gonderen = m.senderUserId ? kisi.get(m.senderUserId) : null;
      return {
        id: m.id,
        tip: m.kind as 'metin' | 'kart' | 'sistem',
        yon: m.side === 'sistem' && m.kind === 'sistem' ? 'sistem' : benim ? 'giden' : 'gelen',
        metin: m.kind === 'kart' ? '' : this.acik(m.body),
        zaman: m.createdAt,
        // Galeride kimin yazdığı (ekip içinde ve alıcıya "galeri adıyla birlikte kendi adı", Karar 20)
        gonderen:
          m.side === 'satici' && g && gonderen
            ? [gonderen.firstName, gonderen.lastName].filter(Boolean).join(' ')
            : null,
        kart: m.vehicleId ? (kartlar.get(m.vehicleId) ?? null) : null,
        // Uyarı bandı yalnızca alıcıya, satıcının mesajında (Karar 25)
        uyari:
          taraf === 'alici' && m.side === 'satici' && flags.length
            ? { baslik: FLAG_TITLES[flags[0] as MessageFlag], metin: SECURITY_WARNING }
            : null,
      };
    });
    if (okundu) await this.read(userId, id);
    const [rz, puan] = await Promise.all([
      taraf === 'alici' ? rozetler(this.db, [c.sellerAccountId]) : Promise.resolve(new Map()),
      taraf === 'alici'
        ? this.trust.eligibility(userId, id)
        : Promise.resolve({ uygun: false, verilen: null }),
    ]);
    return {
      id: c.id,
      taraf,
      durum: c.status,
      karsi: {
        ad: karsi.ad,
        bas: basHarf(karsi.ad),
        alt,
        galeri: g ? { slug: g.slug } : null,
        // Satıcı numarayı yalnızca alıcı paylaşınca görür
        telefon: taraf === 'satici' && c.phoneSharedAt ? telefonYaz(c.buyer.phone) : null,
        rozetler: rz.get(c.sellerAccountId) ?? [],
      },
      // Yıldız (Karar 55): uygunsa alıcıya "Puan ver"
      puan: puan,
      talep: c.demand ? { no: Number(c.demand.no), baslik: c.demand.headline ?? c.demand.title } : null,
      arac: c.vehicle ? { no: Number(c.vehicle.no), ad: n(c.vehicle).ad } : null,
      numaraPaylasildi: !!c.phoneSharedAt,
      engelli: !!blok,
      // Alıcıya: "Bu satıcı sana ilk mesajını gönderdi. Yanıtlarsan sohbet açılır."
      ilkMesajBekliyor: taraf === 'alici' && c.status === 'WAITING',
      yazabilir:
        c.status === 'OPEN' ? taraf === 'alici' || !blok : c.status === 'WAITING' ? taraf === 'alici' : false,
      kartEkleyebilir: taraf === 'satici' && !!g,
      saticiHesap: taraf === 'satici' ? c.sellerAccountId : null,
      mesajlar,
    };
  }
}
