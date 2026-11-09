import {
  BadRequestException,
  ConflictException,
  Global,
  Inject,
  Injectable,
  Module,
  NotFoundException,
} from '@nestjs/common';
import { type Approval, type Prisma, uuidv7 } from '@rengarenk/db';
import {
  COUPON_MAX_PERCENT,
  DEFAULT_PRICE_BOOK,
  GALLERY_TRIAL,
  type PermissionGrants,
  type PlanTable,
  type PriceBook,
  plansOf,
  priceBookSchema,
  priceChanges,
  productPrice,
  REFUND_WINDOW_DAYS,
} from '@rengarenk/shared';
import { ApprovalService } from '../approvals/approval.service.js';
import { ApprovalExecutor } from '../approvals/approval-executor.js';
import { ApprovalsModule } from '../approvals/approvals.module.js';
import { AuditService } from '../audit/audit.service.js';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';
import { OutboxService } from '../outbox/outbox.service.js';

const SUBJECT = 'price_book';
const DAY = 86_400_000;
/** Yürürlükteki liste bu kadar süre bellekte tutulur (API ve işçi ayrı süreçler) */
const CACHE_MS = 60_000;

interface StaffActor {
  staff: { id: string; role: string; status: string };
  grants: PermissionGrants;
}

/** "2026-12-01" → Türkiye saatiyle o günün başı (Türkiye UTC+3, yaz saati yok) */
export const yururlukAni = (gun: string) => new Date(`${gun}T00:00:00+03:00`);

/**
 * Kurallar ve fiyatlar (Karar 47, 56): yürürlükteki fiyat listesi ve değişiklik önerileri. Öneri dört göz onayına gider
 * (PRICE_CHANGE, Sahip onaylar); onaylanınca zamanlanır ve yürürlük tarihi gelince geçerli olur. Mevcut aboneler
 * yenileme tarihine kadar aboneliklerinde saklı dönem fiyatından devam eder. Liste yoksa başlangıç değerleri geçerlidir.
 */
@Injectable()
export class PricingService {
  private cache: { book: PriceBook; until: number } | null = null;

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly approvals: ApprovalService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    executor: ApprovalExecutor,
  ) {
    executor.register('PRICE_CHANGE', (a, tx) => this.scheduleApproved(a, tx));
  }

  /** Belirli bir andaki fiyat listesi (en son yürürlüğe giren onaylı liste) */
  async bookAt(
    at: Date,
    db: Db | Tx = this.db,
  ): Promise<{ book: PriceBook; id: string | null; since: Date | null }> {
    const r = await db.priceBook.findFirst({
      where: { status: 'zamanlandi', effectiveAt: { lte: at } },
      orderBy: { effectiveAt: 'desc' },
    });
    return r
      ? { book: r.data as unknown as PriceBook, id: r.id, since: r.effectiveAt }
      : { book: DEFAULT_PRICE_BOOK, id: null, since: null };
  }

  /** Yürürlükteki liste (kısa süre önbellekte) */
  async current(): Promise<PriceBook> {
    if (this.cache && this.cache.until > Date.now()) return this.cache.book;
    const { book } = await this.bookAt(new Date());
    this.cache = { book, until: Date.now() + CACHE_MS };
    return book;
  }

  forget() {
    this.cache = null;
  }

  async plans(): Promise<PlanTable> {
    return plansOf(await this.current());
  }

  /** Ürünün web fiyatı (TL, KDV dahil) */
  async productTl(key: string): Promise<number | null> {
    return productPrice(await this.current(), key);
  }

  // ── Konsol ────────────────────────────────────────────────────

  /** Kurallar ve fiyatlar ekranı: yürürlükteki liste, bekleyen ve zamanlanmış değişiklikler, geçmiş */
  async overview() {
    const now = new Date();
    const simdi = await this.bookAt(now);
    const rows = await this.db.priceBook.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
    const onaylar = await this.db.approval.findMany({
      where: { id: { in: rows.flatMap((r) => (r.approvalId ? [r.approvalId] : [])) } },
      select: { id: true, status: true },
    });
    const durum = new Map(onaylar.map((a) => [a.id, a.status]));
    const kisiler = new Map(
      (
        await this.db.staffMember.findMany({
          where: { id: { in: [...new Set(rows.map((r) => r.createdBy))] } },
          select: { id: true, name: true },
        })
      ).map((s) => [s.id, s.name]),
    );
    return {
      yururlukte: { kitap: simdi.book, since: simdi.since, baslangic: simdi.id === null },
      kurallar: await this.kurallar(),
      degisiklikler: rows.map((r) => {
        const onay = r.approvalId ? durum.get(r.approvalId) : undefined;
        const d =
          r.status === 'zamanlandi'
            ? r.effectiveAt <= now
              ? r.id === simdi.id
                ? 'yururlukte'
                : 'eski'
              : 'zamanlandi'
            : r.status === 'onay_bekliyor' &&
                (onay === 'REJECTED' || onay === 'EXPIRED' || onay === 'CANCELLED')
              ? 'reddedildi'
              : r.status;
        return {
          id: r.id,
          durum: d,
          yururluk: r.effectiveAt,
          degisiklikler: r.changes,
          not: r.note,
          kim: kisiler.get(r.createdBy) ?? 'Çalışan',
          zaman: r.createdAt,
          kitap: r.data as unknown as PriceBook,
        };
      }),
    };
  }

  /**
   * Kullanım kuralları (YonetimSistem.dc.html): ücretsiz ilk mesaj ve yayın süresi kategori kuralıdır (Katalog ›
   * Kategoriler ve alanlar, dört göz onayıyla); diğerleri sabittir. Burada gösterilir.
   */
  private async kurallar() {
    const c = await this.db.category.findUnique({
      where: { slug: 'otomobil' },
      select: { id: true, publishedVersion: true },
    });
    const v = c?.publishedVersion
      ? await this.db.categorySchemaVersion.findUnique({
          where: { categoryId_version: { categoryId: c.id, version: c.publishedVersion } },
          select: { definition: true },
        })
      : null;
    const r = (v?.definition as { rules?: { freeFirstMessages?: number; listingDays?: number } } | null)
      ?.rules;
    return [
      {
        ad: 'Bireysel günlük ücretsiz ilk mesaj',
        not: 'Her gece 00.00’da yenilenir · kategori kuralı',
        deger: String(r?.freeFirstMessages ?? 5),
      },
      {
        ad: 'Talep yayın süresi',
        not: 'Kategori kuralıyla değişebilir',
        deger: `${r?.listingDays ?? 30} gün`,
      },
      { ad: 'Ücretsiz uzatma', not: 'Talep başına', deger: '1' },
      {
        ad: 'Galeri deneme süresi',
        not: `${GALLERY_TRIAL.portfoy} araç, günde ${GALLERY_TRIAL.gunlukMesaj} ilk mesaj`,
        deger: `${GALLERY_TRIAL.gun} gün`,
      },
      { ad: 'Kupon en yüksek indirim', not: 'Üstü sahip onayı ister', deger: `%${COUPON_MAX_PERCENT}` },
      {
        ad: 'Kullanılmamış hak iadesi',
        not: 'Satın almadan itibaren · sahip onayıyla',
        deger: `${REFUND_WINDOW_DAYS} gün`,
      },
    ];
  }

  /** Değişiklik önerisi: onay kuyruğuna gider, onaylanınca yürürlük tarihine zamanlanır */
  async propose(actor: StaffActor, kitap: PriceBook, gun: string, not: string | undefined, ip?: string) {
    const v = priceBookSchema.safeParse(kitap);
    if (!v.success) throw new BadRequestException(v.error.issues[0]?.message ?? 'Fiyat listesi geçersiz');
    const yururluk = yururlukAni(gun);
    const now = Date.now();
    if (yururluk.getTime() < now + DAY) throw new BadRequestException('Yürürlük en erken yarın olabilir');
    if (yururluk.getTime() > now + 366 * DAY)
      throw new BadRequestException('Yürürlük en geç bir yıl sonra olabilir');
    const temel = await this.bookAt(yururluk);
    const degisiklik = priceChanges(temel.book, v.data as PriceBook);
    if (!degisiklik.length) throw new BadRequestException('Değişiklik yok');
    // Aynı anda tek öneri onay bekler (ikisi aynı tarihe çakışmasın)
    const bekleyen = await this.db.priceBook.findMany({
      where: { status: 'onay_bekliyor' },
      select: { approvalId: true },
    });
    const acik = await this.db.approval.count({
      where: { id: { in: bekleyen.flatMap((b) => (b.approvalId ? [b.approvalId] : [])) }, status: 'PENDING' },
    });
    if (acik) throw new ConflictException('Onay bekleyen bir fiyat değişikliği var');
    const id = uuidv7();
    await this.db.$transaction(async (tx) => {
      const onay = await this.approvals.request(
        actor,
        {
          kind: 'PRICE_CHANGE',
          subjectType: SUBJECT,
          subjectId: id,
          title: `Fiyat değişikliği · ${new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' }).format(yururluk)}`,
          reason: degisiklik.slice(0, 12).join(' · ').slice(0, 1000),
          payload: { yururluk: gun, degisiklikler: degisiklik } as Prisma.InputJsonValue,
        },
        tx,
        ip,
      );
      await tx.priceBook.create({
        data: {
          id,
          data: v.data as unknown as Prisma.InputJsonValue,
          effectiveAt: yururluk,
          changes: degisiklik,
          note: not || null,
          approvalId: onay.id,
          createdBy: actor.staff.id,
        },
      });
    });
    return this.overview();
  }

  /** Onaylanan değişiklik zamanlanır (işçi); abonelere ve galerilere duyuru olayı */
  async scheduleApproved(a: Approval, tx: Tx): Promise<Prisma.InputJsonValue> {
    if (a.subjectType !== SUBJECT) throw new Error('Fiyat onayı değil');
    const r = await tx.priceBook.findUnique({ where: { id: a.subjectId } });
    if (!r) throw new Error('Fiyat listesi bulunamadı');
    if (r.status === 'zamanlandi' && r.approvalId === a.id) return { durum: 'zaten_zamanlandi' };
    if (r.status !== 'onay_bekliyor' || r.approvalId !== a.id) throw new Error('Liste bu onayı beklemiyor');
    await tx.priceBook.update({
      where: { id: r.id },
      data: { status: 'zamanlandi', scheduledAt: new Date() },
    });
    await this.audit.record(
      {
        actorType: 'SYSTEM',
        action: 'fiyat_zamanlandi',
        entityType: 'price_book',
        entityId: r.id,
        after: { yururluk: r.effectiveAt.toISOString(), degisiklik: r.changes.length },
      },
      tx,
    );
    await this.outbox.add(tx, 'fiyat.zamanlandi', { priceBookId: r.id });
    this.forget();
    return { yururluk: r.effectiveAt.toISOString(), degisiklik: r.changes };
  }

  /** Henüz yürürlüğe girmemiş, zamanlanmış değişikliği iptal eder (yeni öneri gibi onay istemez; işlem kaydına girer) */
  async cancel(actor: StaffActor, id: string, ip?: string) {
    const r = await this.db.priceBook.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Değişiklik bulunamadı');
    if (r.status !== 'zamanlandi' || r.effectiveAt <= new Date())
      throw new ConflictException('Yalnızca yürürlüğe girmemiş zamanlanmış değişiklik iptal edilir');
    await this.db.$transaction(async (tx) => {
      await tx.priceBook.update({ where: { id }, data: { status: 'iptal' } });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: actor.staff.id,
          action: 'fiyat_iptal',
          entityType: 'price_book',
          entityId: id,
          ip,
        },
        tx,
      );
    });
    this.forget();
    return this.overview();
  }
}

/** API ve işçide her yerden yürürlükteki fiyat listesi; onaylanan değişikliği işçideki yürütücü zamanlar */
@Global()
@Module({
  imports: [ApprovalsModule],
  providers: [PricingService, AuditService, OutboxService],
  exports: [PricingService],
})
export class PricingCoreModule {}
