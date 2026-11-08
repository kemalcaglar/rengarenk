import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { type GalleryApplication, type Prisma, uuidv7 } from '@rengarenk/db';
import {
  APPLICATION_CHECKS,
  type ApplicationCheck,
  type ApplicationSubmit,
  BUSINESS_KIND_DEFS,
  type BusinessKindKey,
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MIMES,
  GALLERY_TRIAL,
  type GalleryApplicationData,
  type GalleryApplicationDraft,
  galleryApplicationSchema,
  gallerySlug,
  ilBul,
} from '@rengarenk/shared';
import { AuditService } from '../audit/audit.service.js';
import { ConsentService } from '../consents/consent.service.js';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { STORAGE, type Storage } from '../storage/storage.service.js';
import { type GalleryVerifier, VerifierFactory } from './verification.js';

const OPEN = ['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'DOCS_REQUESTED'] as const;
const EDITABLE = ['DRAFT', 'DOCS_REQUESTED'];
const DAY = 86_400_000;

/** Dosyanın ilk baytlarından gerçek türü (uzantıya ya da başlığa güvenilmez) */
function sniff(b: Uint8Array): (typeof DOCUMENT_MIMES)[number] | null {
  const s = (i: number, n: number) => Buffer.from(b.subarray(i, i + n)).toString('latin1');
  if (s(0, 5) === '%PDF-') return 'application/pdf';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (s(1, 3) === 'PNG' && b[0] === 0x89) return 'image/png';
  if (s(0, 4) === 'RIFF' && s(8, 4) === 'WEBP') return 'image/webp';
  return null;
}

/** Karar veren: çalışan ya da kurallarla ajan (Karar 41) */
export type Decider = { staffId: string; ip?: string } | 'ajan';

/**
 * Kurumsal hesap başvurusu (Karar 03, 12.5, 17). Başvuran sihirbazda taslağı kaydeder, belgeleri yükler, gönderir.
 * İşçi beş kontrolü çalıştırır; hepsi geçerse ajan onaylar ve sahibe bildirilir, biri bile geçmezse başvuru
 * konsoldaki kuyruğa düşer. Onayda galeri hesabı açılır ve 30 günlük deneme başlar.
 */
@Injectable()
export class GalleryApplicationService {
  private readonly verifier: GalleryVerifier;

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(STORAGE) private readonly storage: Storage,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly consents: ConsentService,
    verifiers: VerifierFactory,
  ) {
    this.verifier = verifiers.create();
  }

  // ── Başvuran ──────────────────────────────────────────────────

  private latest(userId: string) {
    return this.db.galleryApplication.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { documents: { orderBy: { createdAt: 'asc' } } },
    });
  }

  /** Başvuranın son başvurusu (sihirbaz ve durum sayfası); yoksa null */
  async mine(userId: string) {
    const a = await this.latest(userId);
    if (!a) return null;
    // Her belge türünün en son yüklenen dosyası geçerlidir
    const belgeler = new Map<
      string,
      { id: string; kind: string; ad: string; boyut: number; yuklendi: Date }
    >();
    for (const d of a.documents) {
      belgeler.set(d.kind, { id: d.id, kind: d.kind, ad: d.fileName, boyut: d.size, yuklendi: d.createdAt });
    }
    const gallery = a.accountId
      ? await this.db.gallery.findUnique({ where: { accountId: a.accountId }, select: { slug: true } })
      : null;
    return {
      id: a.id,
      durum: a.status,
      veri: a.data as GalleryApplicationDraft,
      belgeler: [...belgeler.values()],
      gonderildi: a.submittedAt,
      kontrolEdildi: a.checkedAt,
      karar: a.decidedAt,
      // Başvurana yalnızca yetki belgesi sonucu ve karar notu gösterilir; ajan notu çalışanlar içindir
      yetki: ((a.checks as ApplicationCheck[] | null) ?? []).find((c) => c.key === 'yetki')?.sonuc ?? null,
      not: a.status === 'REJECTED' || a.status === 'DOCS_REQUESTED' ? a.decisionNote : null,
      galeri: gallery ? { accountId: a.accountId, slug: gallery.slug } : null,
    };
  }

  private async editable(userId: string) {
    const a = await this.db.galleryApplication.findFirst({
      where: { userId, status: { in: [...OPEN] } },
    });
    if (!a) return null;
    if (!EDITABLE.includes(a.status)) {
      throw new ConflictException('Başvurun inceleniyor; şu an değiştirilemez');
    }
    return a;
  }

  /** Sihirbaz her adımda taslağı kaydeder (Karar 21 ile aynı davranış). */
  async saveDraft(userId: string, draft: GalleryApplicationDraft) {
    const member = await this.db.accountMember.findFirst({
      where: { userId, account: { kind: 'BUSINESS', status: { in: ['ACTIVE', 'SUSPENDED'] } } },
    });
    if (member) throw new ConflictException('Zaten bir kurumsal hesabın var');
    const a = await this.editable(userId);
    const data = { ...((a?.data as GalleryApplicationDraft | undefined) ?? {}), ...draft };
    if (draft.sahip)
      data.sahip = { ...((a?.data as GalleryApplicationDraft | undefined)?.sahip ?? {}), ...draft.sahip };
    const businessKind = data.tur ?? null;
    if (a) {
      await this.db.galleryApplication.update({
        where: { id: a.id },
        data: { data: data as Prisma.InputJsonValue, businessKind },
      });
      return this.mine(userId);
    }
    await this.db.galleryApplication.create({
      data: { id: uuidv7(), userId, data: data as Prisma.InputJsonValue, businessKind },
    });
    return this.mine(userId);
  }

  /** Belge yükler; aynı türün yeni dosyası öncekinin yerine geçer (eskisi kayıtta kalır). */
  async upload(userId: string, kind: string, fileName: string, body: Uint8Array) {
    const a = await this.editable(userId);
    if (!a) throw new NotFoundException('Önce başvuru taslağını başlat');
    const tur = (a.data as GalleryApplicationDraft).tur;
    if (!tur) throw new BadRequestException('Önce işletme türünü seç');
    if (!BUSINESS_KIND_DEFS[tur].belgeler.some((b) => b.key === kind)) {
      throw new BadRequestException('Bu belge türü seçilen işletme türünde istenmiyor');
    }
    if (body.byteLength === 0 || body.byteLength > DOCUMENT_MAX_BYTES) {
      throw new BadRequestException('Dosya en çok 10 MB olabilir');
    }
    const mime = sniff(body);
    if (!mime) throw new BadRequestException('Yalnızca PDF, JPEG, PNG ya da WEBP yükleyebilirsin');
    const id = uuidv7();
    const storageKey = `basvuru/${a.id}/${id}`;
    await this.storage.put(storageKey, body, mime);
    await this.db.galleryDocument.create({
      data: {
        id,
        applicationId: a.id,
        kind,
        fileName: fileName.slice(0, 200) || 'belge',
        mime,
        size: body.byteLength,
        sha256: createHash('sha256').update(body).digest('hex'),
        storageKey,
      },
    });
    return this.mine(userId);
  }

  /** "Bakanlık sisteminden doğrula" (Basvuru.dc.html 3. adım) */
  async verifyAuthority(userId: string) {
    const a = await this.editable(userId);
    const d = (a?.data as GalleryApplicationDraft | undefined) ?? {};
    if (!d.tur || !BUSINESS_KIND_DEFS[d.tur].yetkiVar) {
      throw new BadRequestException('Bu işletme türünde yetki belgesi istenmiyor');
    }
    if (!d.yetkiNo?.trim()) throw new BadRequestException('Yetki belgesi numarasını gir');
    return this.verifier.yetkiBelgesi(d.yetkiNo.trim(), d.tur);
  }

  /** Başvuruyu gönderir; kontroller işçide çalışır. */
  async submit(userId: string, onay: ApplicationSubmit, ip?: string) {
    const a = await this.editable(userId);
    if (!a) throw new NotFoundException('Gönderilecek başvuru yok');
    const parsed = galleryApplicationSchema.safeParse(a.data);
    if (!parsed.success) {
      const i = parsed.error.issues[0];
      throw new UnprocessableEntityException({
        message: i?.message,
        issues: parsed.error.issues.map((x) => ({ path: x.path.join('.'), message: x.message })),
      });
    }
    // Eksik belgeyle gönderilebilir (BasvuruMobil.dc.html): kontrol başvuruyu belge beklemeye alır, ajan onaylamaz
    await this.db.$transaction(async (tx) => {
      await tx.galleryApplication.update({
        where: { id: a.id },
        data: {
          status: 'SUBMITTED',
          submittedAt: a.submittedAt ?? new Date(),
          data: parsed.data as unknown as Prisma.InputJsonValue,
          businessKind: parsed.data.tur,
          decisionNote: null,
        },
      });
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: userId,
          action:
            a.status === 'DOCS_REQUESTED' ? 'galeri_basvuru_yeniden_gonderildi' : 'galeri_basvuru_gonderildi',
          entityType: 'gallery_application',
          entityId: a.id,
          ip,
        },
        tx,
      );
      await this.consents.recordGallery(tx, userId, Boolean(onay.ticariIleti), onay.kanal, ip);
      await this.outbox.add(tx, 'galeri.basvuru_alindi', { applicationId: a.id });
    });
    return this.mine(userId);
  }

  private async missingDocs(applicationId: string, tur: BusinessKindKey) {
    const kinds = new Set(
      (await this.db.galleryDocument.findMany({ where: { applicationId }, select: { kind: true } })).map(
        (x) => x.kind,
      ),
    );
    return BUSINESS_KIND_DEFS[tur].belgeler.filter((b) => b.zorunlu && !kinds.has(b.key)).map((b) => b.ad);
  }

  // ── Kontroller ve ajan kararı ─────────────────────────────────

  /**
   * Beş kontrol (YonetimPazar.dc.html): yetki belgesi, vergi, MERSİS, adres, telefon. Hepsi geçerse ajan onaylar;
   * aksi hâlde başvuru "Yönetici incelemesi"ne düşer. Aynı başvuru iki kez işlenmez (yalnızca SUBMITTED).
   */
  async runChecks(applicationId: string) {
    const a = await this.db.galleryApplication.findUnique({
      where: { id: applicationId },
      include: { user: { select: { phoneVerifiedAt: true } } },
    });
    if (a?.status !== 'SUBMITTED') return null;
    const d = a.data as unknown as GalleryApplicationData;
    const def = BUSINESS_KIND_DEFS[d.tur];
    const eksik = await this.missingDocs(a.id, d.tur);
    if (eksik.length) {
      const not = `Eksik belge: ${eksik.join(', ')}`;
      await this.db.galleryApplication.update({
        where: { id: a.id },
        data: {
          status: 'DOCS_REQUESTED',
          decisionNote: not,
          agentNote: `${not}. Belge yüklenince yeniden kontrol edilir.`,
          checkedAt: new Date(),
        },
      });
      return { hepsi: false, checks: [] as ApplicationCheck[] };
    }
    const guvenli = <T>(p: Promise<T>, yedek: T) => p.catch(() => yedek);
    const hata = { sonuc: 'yapilamadi' as const, not: 'Kurum sistemi yanıt vermedi' };
    const [yetki, vergi, mersis] = await Promise.all([
      def.yetkiVar
        ? guvenli(this.verifier.yetkiBelgesi(d.yetkiNo ?? '', d.tur), hata)
        : Promise.resolve({ sonuc: 'gecti' as const, not: 'Bu işletme türünde yetki belgesi yok' }),
      guvenli(this.verifier.vergi(d.vergiNo, d.vergiDairesi), hata),
      guvenli(this.verifier.mersis(d.mersis), hata),
    ]);
    // Kaynaktaki unvan başvurudakinden farklıysa kontrol geçmez (marka adı olabilir; insan bakar)
    const unvanUyusmuyor = (u?: string) =>
      u && u !== 'Test Kaydı' && u.toLocaleLowerCase('tr-TR') !== d.unvan.toLocaleLowerCase('tr-TR');
    const checks: ApplicationCheck[] = [
      { key: 'yetki', sonuc: yetki.sonuc, not: yetki.not },
      unvanUyusmuyor(vergi.unvan)
        ? { key: 'vergi', sonuc: 'kaldi', not: `Vergi kaydındaki unvan “${vergi.unvan}”` }
        : { key: 'vergi', sonuc: vergi.sonuc, not: vergi.not },
      { key: 'mersis', sonuc: mersis.sonuc, not: mersis.not },
      // Adres: il ve ilçe listeden; haritada bulma ve görüntülü doğrulama insan incelemesinde
      ilBul(d.il)?.ilceler.includes(d.ilce)
        ? { key: 'adres', sonuc: 'gecti' }
        : { key: 'adres', sonuc: 'kaldi', not: 'İl ve ilçe listede yok' },
      // Telefon: hesap sahibinin cep numarası SMS koduyla doğrulandı
      a.user.phoneVerifiedAt
        ? { key: 'telefon', sonuc: 'gecti', not: 'SMS koduyla doğrulandı' }
        : { key: 'telefon', sonuc: 'kaldi', not: 'Telefon doğrulanmadı' },
    ];
    const hepsi = checks.every((c) => c.sonuc === 'gecti');
    const sorunlu = checks.filter((c) => c.sonuc !== 'gecti');
    const agentNote = hepsi
      ? `${APPLICATION_CHECKS.length}/${APPLICATION_CHECKS.length} kontrol geçti; kurallara göre onaylandı.`
      : `${sorunlu
          .map((c) => `${APPLICATION_CHECKS.find((x) => x.key === c.key)?.ad}: ${c.not ?? 'geçmedi'}`)
          .join(' · ')}. Belgelere bakarak karar ver.`;
    await this.db.galleryApplication.update({
      where: { id: a.id },
      data: {
        checks: checks as unknown as Prisma.InputJsonValue,
        agentNote,
        checkedAt: new Date(),
        ...(hepsi ? {} : { status: 'IN_REVIEW' }),
      },
    });
    if (hepsi) await this.approve(a.id, 'ajan');
    return { hepsi, checks };
  }

  // ── Karar (konsol ve ajan) ────────────────────────────────────

  private async decidable(id: string, statuses: GalleryApplication['status'][]) {
    const a = await this.db.galleryApplication.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Başvuru bulunamadı');
    if (!statuses.includes(a.status))
      throw new ConflictException('Başvuru bu işlem için uygun durumda değil');
    return a;
  }

  private actor(by: Decider) {
    return by === 'ajan'
      ? { actorType: 'AGENT' as const, actorId: 'ajan', ip: null }
      : { actorType: 'STAFF' as const, actorId: by.staffId, ip: by.ip ?? null };
  }

  /**
   * Onay: galeri hesabı (accounts), sahip üyeliği, galeri profili, 30 günlük deneme ve deneme talep hakkı aynı
   * işlemde açılır (Karar 12.5).
   */
  async approve(id: string, by: Decider) {
    const a = await this.decidable(
      id,
      by === 'ajan' ? ['SUBMITTED'] : ['SUBMITTED', 'IN_REVIEW', 'DOCS_REQUESTED'],
    );
    const d = galleryApplicationSchema.parse(a.data);
    const now = new Date();
    const accountId = uuidv7();
    const slug = await this.uniqueSlug(d.gorunenAd);
    await this.db.$transaction(async (tx) => {
      await tx.account.create({
        data: { id: accountId, kind: 'BUSINESS', name: d.gorunenAd, businessKind: d.tur, status: 'ACTIVE' },
      });
      await tx.accountMember.create({ data: { accountId, userId: a.userId, role: 'OWNER' } });
      await tx.gallery.create({
        data: {
          accountId,
          slug,
          businessKind: d.tur,
          displayName: d.gorunenAd,
          legalName: d.unvan,
          taxNo: d.vergiNo,
          taxOffice: d.vergiDairesi,
          mersisNo: d.mersis,
          il: d.il,
          ilce: d.ilce,
          address: d.adres,
          authorityNo: BUSINESS_KIND_DEFS[d.tur].yetkiVar ? (d.yetkiNo ?? null) : null,
          plan: 'deneme',
          trialEndsAt: new Date(now.getTime() + GALLERY_TRIAL.gun * DAY),
          applicationId: a.id,
          approvedAt: now,
        },
      });
      // Kullanıcının adı boşsa başvurudaki adla doldurulur (mesajlarda çalışan adı görünür, Karar 20)
      await tx.user.updateMany({
        where: { id: a.userId, firstName: null },
        data: { firstName: d.sahip.ad, lastName: d.sahip.soyad, email: d.sahip.eposta },
      });
      await tx.galleryApplication.update({
        where: { id: a.id },
        data: {
          status: 'APPROVED',
          accountId,
          decidedAt: now,
          decidedBy: by === 'ajan' ? null : by.staffId,
          decidedByAgent: by === 'ajan',
          decisionNote: null,
        },
      });
      await this.grantTrial(tx, accountId, by === 'ajan' ? 'ajan' : by.staffId);
      await this.audit.record(
        {
          ...this.actor(by),
          action: 'galeri_basvuru_onaylandi',
          entityType: 'gallery_application',
          entityId: a.id,
          after: { accountId, slug },
        },
        tx,
      );
      // Ajan onayında sahibe bilgi gider (Karar 03); başvurana hoş geldin iletisi (bildirim katmanı, Aşama 7)
      await this.outbox.add(tx, 'galeri.onaylandi', { applicationId: a.id, accountId, ajan: by === 'ajan' });
    });
    return { accountId, slug };
  }

  /** Deneme hakları: 1 talep hakkı (portföy ve mesaj sınırları paket kurallarıyla uygulanır) */
  private async grantTrial(tx: Tx, accountId: string, createdBy: string) {
    await tx.entitlementLedger.create({
      data: {
        accountId,
        kind: 'talep',
        delta: GALLERY_TRIAL.talep,
        reason: 'paket',
        sourceType: 'galeri_deneme',
        sourceId: accountId,
        createdBy,
      },
    });
  }

  private async uniqueSlug(ad: string) {
    const base = gallerySlug(ad);
    for (let i = 1; i < 100; i++) {
      const slug = i === 1 ? base : `${base}-${i}`;
      if (!(await this.db.gallery.findUnique({ where: { slug }, select: { slug: true } }))) return slug;
    }
    return `${base}-${uuidv7().slice(-6)}`;
  }

  async reject(id: string, by: { staffId: string; ip?: string }, gerekce: string) {
    const a = await this.decidable(id, ['SUBMITTED', 'IN_REVIEW', 'DOCS_REQUESTED']);
    await this.db.$transaction(async (tx) => {
      await tx.galleryApplication.update({
        where: { id: a.id },
        data: { status: 'REJECTED', decidedAt: new Date(), decidedBy: by.staffId, decisionNote: gerekce },
      });
      await this.audit.record(
        {
          ...this.actor(by),
          action: 'galeri_basvuru_reddedildi',
          entityType: 'gallery_application',
          entityId: a.id,
          after: { gerekce },
        },
        tx,
      );
      await this.outbox.add(tx, 'galeri.reddedildi', { applicationId: a.id });
    });
  }

  /** Ek belge ister: başvuru başvurana açılır, yeni belgeyle yeniden gönderilir */
  async requestDocs(id: string, by: { staffId: string; ip?: string }, not: string) {
    const a = await this.decidable(id, ['SUBMITTED', 'IN_REVIEW']);
    await this.db.$transaction(async (tx) => {
      await tx.galleryApplication.update({
        where: { id: a.id },
        data: { status: 'DOCS_REQUESTED', decisionNote: not },
      });
      await this.audit.record(
        {
          ...this.actor(by),
          action: 'galeri_basvuru_belge_istendi',
          entityType: 'gallery_application',
          entityId: a.id,
          after: { not },
        },
        tx,
      );
      await this.outbox.add(tx, 'galeri.belge_istendi', { applicationId: a.id });
    });
  }

  /** Ajanın onayını geri alır: galeri hesabı askıya alınır, galeriye bildirilir (YonetimPazar.dc.html) */
  async revoke(id: string, by: { staffId: string; ip?: string }, gerekce: string) {
    const a = await this.decidable(id, ['APPROVED']);
    if (!a.accountId) throw new ConflictException('Başvurunun hesabı yok');
    await this.db.$transaction(async (tx) => {
      await tx.galleryApplication.update({
        where: { id: a.id },
        data: { status: 'REVOKED', decidedAt: new Date(), decidedBy: by.staffId, decisionNote: gerekce },
      });
      await tx.account.update({ where: { id: a.accountId as string }, data: { status: 'SUSPENDED' } });
      await this.audit.record(
        {
          ...this.actor(by),
          action: 'galeri_basvuru_onay_geri_alindi',
          entityType: 'gallery_application',
          entityId: a.id,
          after: { gerekce, accountId: a.accountId },
        },
        tx,
      );
      await this.outbox.add(tx, 'galeri.onay_geri_alindi', { applicationId: a.id, accountId: a.accountId });
    });
  }

  // ── Konsol ────────────────────────────────────────────────────

  /** "Sana bırakılanlar" ve "Ajanın onayladıkları · son 7 gün" */
  async queue() {
    const satir = (a: GalleryApplication & { user: { phone: string } }) => {
      const d = a.data as GalleryApplicationDraft;
      return {
        id: a.id,
        durum: a.status,
        ad: d.gorunenAd ?? d.unvan ?? 'Adsız başvuru',
        tur: a.businessKind ? BUSINESS_KIND_DEFS[a.businessKind as BusinessKindKey].kisa : null,
        il: d.il ?? null,
        ilce: d.ilce ?? null,
        gonderildi: a.submittedAt,
        karar: a.decidedAt,
        kontroller: (a.checks as ApplicationCheck[] | null) ?? [],
        ajan: a.agentNote,
        not: a.decisionNote,
      };
    };
    const [bekleyen, ajan] = await Promise.all([
      this.db.galleryApplication.findMany({
        where: { status: { in: ['SUBMITTED', 'IN_REVIEW', 'DOCS_REQUESTED'] } },
        orderBy: { submittedAt: 'asc' },
        include: { user: { select: { phone: true } } },
      }),
      this.db.galleryApplication.findMany({
        where: {
          decidedByAgent: true,
          status: { in: ['APPROVED', 'REVOKED'] },
          decidedAt: { gte: new Date(Date.now() - 7 * DAY) },
        },
        orderBy: { decidedAt: 'desc' },
        include: { user: { select: { phone: true } } },
      }),
    ]);
    return { bekleyen: bekleyen.map(satir), ajan: ajan.map(satir) };
  }

  /** Başvuru ayrıntısı (çalışan): form, kontroller, belgeler */
  async detail(id: string) {
    const a = await this.db.galleryApplication.findUnique({
      where: { id },
      include: { documents: { orderBy: { createdAt: 'asc' } } },
    });
    if (!a) throw new NotFoundException('Başvuru bulunamadı');
    return {
      id: a.id,
      durum: a.status,
      veri: a.data,
      kontroller: a.checks ?? [],
      ajan: a.agentNote,
      not: a.decisionNote,
      gonderildi: a.submittedAt,
      karar: a.decidedAt,
      ajanKarari: a.decidedByAgent,
      belgeler: a.documents.map((d) => ({
        id: d.id,
        kind: d.kind,
        ad: d.fileName,
        mime: d.mime,
        boyut: d.size,
        yuklendi: d.createdAt,
      })),
    };
  }

  /** Belgeyi açar; kişisel veri içerdiği için her görüntüleme işlem kaydına girer (Karar 40) */
  async document(id: string, docId: string, by: { staffId: string; ip?: string }) {
    const d = await this.db.galleryDocument.findFirst({ where: { id: docId, applicationId: id } });
    if (!d) throw new NotFoundException('Belge bulunamadı');
    await this.audit.record({
      ...this.actor(by),
      action: 'galeri_basvuru_belge_goruntulendi',
      entityType: 'gallery_document',
      entityId: d.id,
      after: { applicationId: id, kind: d.kind },
    });
    const file = await this.storage.get(d.storageKey);
    return { ...file, mime: d.mime, ad: d.fileName };
  }
}
