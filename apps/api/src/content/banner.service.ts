import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { uuidv7 } from '@rengarenk/db';
import {
  BANNER_AUDIENCES,
  BANNER_LIMIT,
  BANNER_PLACES,
  BANNER_PLATFORMS,
  BANNER_STATUSES,
  BANNER_TINTS,
  type BannerInput,
  type BannerPlace,
  bannerDateText,
  bannerMatches,
  bannerStatus,
  ekle,
  VITRIN_YER,
  type Viewer,
} from '@rengarenk/shared';
import { AuditService } from '../audit/audit.service.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { RateLimiter } from '../ratelimit/rate-limiter.js';

const gun = (d: Date) =>
  new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(d)}T00:00:00Z`);
const yuzde = (x: number) =>
  `%${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(x * 100)}`;
const sayi = (n: number) => new Intl.NumberFormat('tr-TR').format(n);
export const VITRIN_EDITOR = 'vitrin_editor';

/**
 * Banner, duyuru ve vitrin (Karar 46; YonetimIcerik.dc.html › banner). Taslak her zaman düzenlenir; yayın yalnızca
 * görünüm yetkisi "tam" olanla ve tarih aralığıyla olur; durdurulan banner yeniden yayınlanmaz (kopyası açılır).
 * Görüntüleyene uyan bannerlar yer, kitle (ziyaretçi, bireysel, galeri ve il), platform ve tarihe göre seçilir.
 * Gösterim ve tıklama günlük toplamdır; IP başına sınırlıdır.
 */
@Injectable()
export class BannerService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly audit: AuditService,
    private readonly limiter: RateLimiter,
  ) {}

  // ── Herkese açık ───────────────────────────────────────────

  /** Görüntüleyenin kitlesi: giriş yoksa ziyaretçi; kurumsal hesap üyesiyse galeri (galerinin ili), değilse bireysel */
  async viewer(userId: string | undefined): Promise<{ kitle: Viewer; il: string | null }> {
    if (!userId) return { kitle: 'ziyaretci', il: null };
    const [u, uye] = await Promise.all([
      this.db.user.findUnique({ where: { id: userId }, select: { il: true } }),
      this.db.accountMember.findFirst({
        where: { userId, account: { kind: 'BUSINESS', status: 'ACTIVE' } },
        select: { account: { select: { gallery: { select: { il: true } } } } },
      }),
    ]);
    if (uye) return { kitle: 'galeri', il: uye.account.gallery?.il ?? null };
    return { kitle: 'bireysel', il: u?.il ?? null };
  }

  async active(yer: BannerPlace, platform: 'web' | 'mobil', userId?: string, now = new Date()) {
    const v = await this.viewer(userId);
    const rows = await this.db.banner.findMany({
      where: {
        place: yer,
        published: true,
        stoppedAt: null,
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      orderBy: { startsAt: 'desc' },
      take: 20,
    });
    return rows
      .filter((b) => bannerMatches(b, { ...v, platform }))
      .slice(0, BANNER_LIMIT[yer])
      .map((b) => ({
        id: b.id,
        baslik: b.title,
        metin: b.body,
        dugme: b.button,
        url: b.url,
        renk: b.color,
        zemin: BANNER_TINTS[b.color as keyof typeof BANNER_TINTS] ?? '#EEF3FF',
      }));
  }

  async event(id: string, tur: 'gosterim' | 'tiklama', ip?: string) {
    if (ip) await this.limiter.hit(`banner:${tur}:${ip}`, 120, 3600);
    const b = await this.db.banner.findUnique({
      where: { id },
      select: { id: true, published: true, stoppedAt: true, startsAt: true, endsAt: true },
    });
    if (!b || bannerStatus(b) !== 'yayinda') return { ok: false };
    const g = gun(new Date());
    await this.db.bannerStat.upsert({
      where: { bannerId_day: { bannerId: id, day: g } },
      create: { bannerId: id, day: g, views: tur === 'gosterim' ? 1 : 0, clicks: tur === 'tiklama' ? 1 : 0 },
      update: tur === 'gosterim' ? { views: { increment: 1 } } : { clicks: { increment: 1 } },
    });
    return { ok: true };
  }

  async vitrinEditor() {
    const s = await this.db.contentSetting.findUnique({ where: { key: VITRIN_EDITOR } });
    return s ? s.value === true : true;
  }

  // ── Konsol ─────────────────────────────────────────────────

  async list(now = new Date()) {
    const rows = await this.db.banner.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    const st = await this.db.bannerStat.groupBy({
      by: ['bannerId'],
      where: { bannerId: { in: rows.map((r) => r.id) } },
      _sum: { views: true, clicks: true },
    });
    const s = new Map(st.map((x) => [x.bannerId, x._sum]));
    const sira: Record<string, number> = { yayinda: 0, zamanlandi: 1, taslak: 2, durduruldu: 3, bitti: 4 };
    const bannerlar = rows
      .map((b) => {
        const durum = bannerStatus(b, now);
        const t = s.get(b.id);
        const g = t?.views ?? 0;
        const c = t?.clicks ?? 0;
        return {
          id: b.id,
          ad: b.title,
          yer: BANNER_PLACES[b.place as BannerPlace]?.ad ?? b.place,
          kitle: `${BANNER_AUDIENCES[b.audience as keyof typeof BANNER_AUDIENCES] ?? b.audience}${b.il ? ` · ${b.il}` : ''}`,
          platform: BANNER_PLATFORMS[b.platform as keyof typeof BANNER_PLATFORMS] ?? b.platform,
          tarih: bannerDateText(b.startsAt, b.endsAt),
          sonuc:
            durum === 'taslak'
              ? 'Taslak · yayınlanınca gösterim ve tıklama sayılır'
              : g
                ? `${sayi(g)} gösterim · tıklama ${yuzde(c / g)}`
                : durum === 'zamanlandi'
                  ? 'Başlangıç tarihinde yayına girer, bitişte kendiliğinden kalkar'
                  : 'Henüz gösterim yok',
          durumKey: durum,
          durum: BANNER_STATUSES[durum].ad,
          bg: BANNER_STATUSES[durum].bg,
          fg: BANNER_STATUSES[durum].fg,
          renk: b.color,
          zemin: BANNER_TINTS[b.color as keyof typeof BANNER_TINTS] ?? '#F6F8FD',
          icerik: {
            baslik: b.title,
            metin: b.body,
            dugme: b.button,
            url: b.url,
            yer: b.place,
            kitle: b.audience,
            il: b.il,
            platform: b.platform,
            renk: b.color,
            baslangic: b.startsAt?.toISOString() ?? null,
            bitis: b.endsAt?.toISOString() ?? null,
          },
        };
      })
      .sort((a, b) => (sira[a.durumKey] ?? 9) - (sira[b.durumKey] ?? 9));

    // Vitrin: ücretli vitrin (süren öne çıkarma) ve editör seçimi
    const ucretli = await this.db.demandPromotion.findMany({
      where: { kind: 'vitrin', startsAt: { lte: now }, endsAt: { gt: now }, demand: { status: 'PUBLISHED' } },
      distinct: ['demandId'],
      select: { demandId: true },
    });
    const editor = await this.vitrinEditor();
    return {
      bannerlar,
      vitrin: {
        yer: VITRIN_YER,
        ucretli: ucretli.length,
        editor,
        not: `${VITRIN_YER} yer · ${ekle(Math.min(ucretli.length, VITRIN_YER), 'iyelik')} ücretli · ${
          ucretli.length > VITRIN_YER
            ? 'ücretli talepler her açılışta karışık sırayla döner'
            : 'ücretli talepler her zaman önce, sırası her açılışta karışır'
        }`,
      },
    };
  }

  private async yaz(staffId: string, b: BannerInput, id?: string) {
    const veri = {
      title: b.baslik,
      body: b.metin,
      button: b.dugme,
      url: b.url,
      place: b.yer,
      audience: b.kitle,
      il: b.il,
      platform: b.platform,
      color: b.renk,
      startsAt: b.baslangic ? new Date(b.baslangic) : null,
      endsAt: b.bitis ? new Date(b.bitis) : null,
    };
    if (!id) {
      const yeni = uuidv7();
      await this.db.$transaction(async (tx) => {
        await tx.banner.create({ data: { id: yeni, ...veri, createdBy: staffId } });
        await this.audit.record(
          {
            actorType: 'STAFF',
            actorId: staffId,
            action: 'banner_eklendi',
            entityType: 'banner',
            entityId: yeni,
          },
          tx,
        );
      });
      return yeni;
    }
    const b0 = await this.db.banner.findUnique({ where: { id } });
    if (!b0) throw new NotFoundException('Banner bulunamadı');
    if (b0.published || b0.stoppedAt)
      throw new ConflictException('Yayınlanan banner değiştirilemez; durdurup kopyasını aç');
    await this.db.banner.update({ where: { id }, data: veri });
    return id;
  }

  async save(staffId: string, b: BannerInput, id?: string) {
    await this.yaz(staffId, b, id);
    return this.list();
  }

  /** Yayın: tarih aralığı gerekir; başlangıç geçmişte olamaz (bugün dahil) */
  async publish(staffId: string, id: string, ip?: string) {
    const b = await this.db.banner.findUnique({ where: { id } });
    if (!b) throw new NotFoundException('Banner bulunamadı');
    if (b.published || b.stoppedAt) throw new ConflictException('Banner zaten yayınlandı');
    if (!b.startsAt || !b.endsAt) throw new BadRequestException('Yayın için başlangıç ve bitiş tarihi seç');
    if (b.endsAt.getTime() <= Date.now()) throw new BadRequestException('Bitiş tarihi geçmiş');
    await this.db.$transaction(async (tx) => {
      await tx.banner.update({ where: { id }, data: { published: true, publishedBy: staffId } });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'banner_yayinlandi',
          entityType: 'banner',
          entityId: id,
          after: { yer: b.place, kitle: b.audience, baslangic: b.startsAt, bitis: b.endsAt },
          ip,
        },
        tx,
      );
    });
    return this.list();
  }

  async stop(staffId: string, id: string, ip?: string) {
    const k = await this.db.banner.updateMany({
      where: { id, published: true, stoppedAt: null },
      data: { stoppedAt: new Date() },
    });
    if (!k.count) throw new ConflictException('Yayında ya da zamanlanmış banner yok');
    await this.audit.record({
      actorType: 'STAFF',
      actorId: staffId,
      action: 'banner_durduruldu',
      entityType: 'banner',
      entityId: id,
      ip,
    });
    return this.list();
  }

  /** Durdurulan ya da biten bannerın taslak kopyası (tarihsiz) */
  async copy(staffId: string, id: string) {
    const b = await this.db.banner.findUnique({ where: { id } });
    if (!b) throw new NotFoundException('Banner bulunamadı');
    await this.yaz(staffId, {
      baslik: b.title,
      metin: b.body,
      dugme: b.button,
      url: b.url,
      yer: b.place as BannerPlace,
      kitle: b.audience as BannerInput['kitle'],
      il: b.il,
      platform: b.platform as BannerInput['platform'],
      renk: b.color as BannerInput['renk'],
      baslangic: null,
      bitis: null,
    });
    return this.list();
  }

  async remove(staffId: string, id: string) {
    const k = await this.db.banner.deleteMany({ where: { id, published: false, stoppedAt: null } });
    if (!k.count) throw new ConflictException('Yalnızca taslak silinir');
    await this.audit.record({
      actorType: 'STAFF',
      actorId: staffId,
      action: 'banner_silindi',
      entityType: 'banner',
      entityId: id,
    });
    return this.list();
  }

  async setVitrinEditor(staffId: string, acik: boolean, ip?: string) {
    await this.db.$transaction(async (tx) => {
      await tx.contentSetting.upsert({
        where: { key: VITRIN_EDITOR },
        update: { value: acik, updatedBy: staffId },
        create: { key: VITRIN_EDITOR, value: acik, updatedBy: staffId },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'vitrin_editor_degisti',
          entityType: 'content_setting',
          entityId: VITRIN_EDITOR,
          after: { acik },
          ip,
        },
        tx,
      );
    });
    return this.list();
  }
}
