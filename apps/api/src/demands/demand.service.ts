import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { type Demand, type DemandStatus, type Prisma, uuidv7 } from '@rengarenk/db';
import {
  aranabilir,
  type CategoryDefinition,
  type CategoryField,
  DEMAND_STATUS_NAMES,
  DEMAND_TEXT_FLAGS,
  type DemandStatusKey,
  type DemandTextFlag,
  demandOwnerName,
  demandSchema,
  EXTEND_WINDOW_DAYS,
  effectiveFields,
  type FoundViaKey,
  galleryAccess,
  hideDemandText,
  PROMOTE_DAYS,
  REMINDER_DAYS,
} from '@rengarenk/shared';
import type { Redis } from 'ioredis';
import { AdsService, olayPlatformu } from '../ads/ads.service.js';
import { AuditService } from '../audit/audit.service.js';
import { sha256 } from '../auth/tokens.js';
import { CatalogImageService } from '../catalog/catalog-image.service.js';
import { nesilFoto } from '../catalog/photo-pick.js';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';
import { EntitlementService } from '../entitlements/entitlement.service.js';
import { ContentRulesService } from '../moderation/content-rules.service.js';
import { ModerationService } from '../moderation/moderation.service.js';
import { type EventType, OutboxService } from '../outbox/outbox.service.js';
import { REDIS, ready } from '../redis/redis.module.js';

const DAY = 86_400_000;

type Values = Record<string, unknown>;
interface DemandData {
  alanlar: Values;
  alternatifler: Values[];
}

export interface DemandUpdate {
  kategori?: string;
  step?: number;
  data?: DemandData;
  contact?: { phoneVisible: boolean; whatsappVisible: boolean; nameMode: 'tam' | 'kisa' };
  headline?: string | null;
}

const range = (v: unknown) =>
  v && typeof v === 'object' ? (v as { min?: number; max?: number }) : undefined;

/** Alternatiflerdeki aralıkların en düşüğü ve en yükseği (liste ve arama sütunları). */
function span(alts: Values[], key: string) {
  const rs = alts.map((a) => range(a[key])).filter((r): r is { min?: number; max?: number } => Boolean(r));
  const mins = rs.map((r) => r.min ?? r.max).filter((x): x is number => typeof x === 'number');
  const maxs = rs.map((r) => r.max ?? r.min).filter((x): x is number => typeof x === 'number');
  return { min: mins.length ? Math.min(...mins) : null, max: maxs.length ? Math.max(...maxs) : null };
}

function invalid(issues: { path: PropertyKey[]; message: string }[]): never {
  throw new BadRequestException({
    message: issues[0]?.message ?? 'Talep eksik ya da hatalı',
    issues: issues.map((i) => ({ path: i.path.map(String).join('.'), message: i.message })),
  });
}

/**
 * Talepler (Karar 04, 05, 09, 10, 12, 21). Taslak her adımda kaydedilir; yayında şema doğrulanır ve hak
 * defterinden bir talep hakkı düşer (ilk talep telefon numarası başına ücretsiz). Süre dolunca talep silinmez,
 * pasife düşer ve uzatılabilir (ilk uzatma ücretsiz). Her durum değişikliği geçmişe, işlem kaydına ve outbox'a
 * aynı veritabanı işleminde yazılır.
 */
@Injectable()
export class DemandService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly entitlements: EntitlementService,
    private readonly icerik: ContentRulesService,
    private readonly moderation: ModerationService,
    @Optional() private readonly ads?: AdsService,
    @Optional() @Inject(REDIS) private readonly redis?: Redis,
  ) {}

  // ── Okuma ─────────────────────────────────────────────────────

  /**
   * Talep sayfası görüntülendi (Taleplerim istatistiği). Yalnızca yayındaki talepte ve sahibi dışındakiler sayılır;
   * aynı üye (girişsizse aynı IP) 24 saatte bir kez. Kimlik yalnızca özetiyle ve 24 saat Redis'te durur; Redis yoksa
   * sayılmaz. Botlar ve başsız tarayıcılar sayılmaz. `updated_at` değişmez (Taleplerim sırası bozulmasın).
   */
  async goruntulendi(no: number, kim: { userId?: string; ip?: string; ua?: string }) {
    if (!this.redis || (kim.ua && /bot|crawl|spider|slurp|headless|preview/i.test(kim.ua))) return false;
    const d = await this.db.demand.findUnique({
      where: { no: BigInt(no) },
      select: { id: true, userId: true, status: true },
    });
    if (d?.status !== 'PUBLISHED' || d.userId === kim.userId) return false;
    const kisi = kim.userId ? `u:${kim.userId}` : kim.ip ? `ip:${kim.ip}` : null;
    if (!kisi) return false;
    const anahtar = `goruntu:${d.id}:${sha256(kisi).slice(0, 24)}`;
    const yeni = await ready(this.redis)
      .then((r) => r.set(anahtar, '1', 'EX', 86_400, 'NX'))
      .catch(() => null);
    if (yeni !== 'OK') return false;
    await this.db.$executeRaw`UPDATE demands SET view_count = view_count + 1 WHERE id = ${d.id}::uuid`;
    return true;
  }

  /** Taleplerim: taslak dahil bütün talepler, durum sayılarıyla. */
  async mine(userId: string) {
    const rows = await this.db.demand.findMany({
      where: { userId },
      orderBy: [{ updatedAt: 'desc' }],
      take: 200,
      include: {
        category: { select: { slug: true, name: true } },
        account: { select: { kind: true, gallery: { select: { displayName: true, slug: true } } } },
      },
    });
    // Hesap başına öne çıkarma hakları (paketin aylık hakkı, talep seçilmeden alınan hak): Taleplerim'de "Öne çıkar"
    const hesaplar = [...new Set(rows.map((r) => r.accountId))];
    const haklar: Record<string, Record<string, number>> = {};
    for (const h of hesaplar) {
      const r = await this.db.entitlementLedger.groupBy({
        by: ['kind'],
        where: { accountId: h, kind: { in: ['ust_sira', 'acil', 'vitrin'] } },
        _sum: { delta: true },
      });
      haklar[h] = Object.fromEntries(r.map((x) => [x.kind, x._sum.delta ?? 0]));
    }
    // Kart istatistikleri (Taleplerim.dc.html): favori, mesaj (açılan sohbet) ve uyan portföy aracı
    const ids = rows.map((r) => r.id);
    const [favs, sohbetler, uyanlar] = await Promise.all([
      this.db.favorite.groupBy({
        by: ['demandId'],
        where: { demandId: { in: ids } },
        _count: { _all: true },
      }),
      this.db.conversation.groupBy({
        by: ['demandId'],
        where: { demandId: { in: ids } },
        _count: { _all: true },
      }),
      this.db.match.groupBy({
        by: ['demandId'],
        where: { demandId: { in: ids }, active: true },
        _count: { _all: true },
      }),
    ]);
    const say = (l: { demandId: string | null; _count: { _all: number } }[], id: string) =>
      l.find((x) => x.demandId === id)?._count._all ?? 0;
    const counts = Object.fromEntries(
      (Object.keys(DEMAND_STATUS_NAMES) as DemandStatusKey[]).map((k) => [
        k,
        rows.filter((r) => r.status === k).length,
      ]),
    );
    return {
      counts,
      items: rows.map((d) => ({
        ...this.summary(d),
        galeri: d.account.gallery
          ? { ad: d.account.gallery.displayName, slug: d.account.gallery.slug }
          : null,
        oneCikarmaHakki: haklar[d.accountId] ?? {},
        istatistik: {
          goruntu: d.viewCount,
          favori: say(favs, d.id),
          mesaj: say(sohbetler, d.id),
          eslesen: say(uyanlar, d.id),
        },
      })),
    };
  }

  /** Sahibin gördüğü talep: taslağın verisi, şeması ve yapılabilecek işler. */
  async ownerDetail(userId: string, id: string) {
    const d = await this.own(userId, id);
    const category = await this.db.category.findUniqueOrThrow({ where: { id: d.categoryId } });
    const version = d.schemaVersion ?? category.publishedVersion;
    const def = version ? await this.definition(d.categoryId, version) : null;
    const g = await this.db.gallery.findUnique({
      where: { accountId: d.accountId },
      select: { displayName: true },
    });
    return {
      ...this.summary({ ...d, category }),
      /** Sahibi asıl başlığı görür ve düzeltir */
      headline: d.headline,
      /** Galeri adına talep: hangi galeri (hak galerinin paketinden düşer) */
      hesap: g ? { id: d.accountId, ad: g.displayName } : null,
      data: d.data,
      step: d.step,
      contact: { phoneVisible: d.phoneVisible, whatsappVisible: d.whatsappVisible, nameMode: d.nameMode },
      schema: def && { version, fields: effectiveFields(def), rules: def.rules },
      actions: this.actions(d),
    };
  }

  /** Herkese açık talep sayfası. Telefon yalnızca izin verildiyse ve giriş yapmış kullanıcıya görünür (Karar 11.4). */
  async publicDetail(no: number, viewerUserId?: string) {
    const d = await this.db.demand.findUnique({
      where: { no: BigInt(no) },
      include: {
        category: { select: { slug: true, name: true } },
        user: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            createdAt: true,
            callFrom: true,
            callTo: true,
          },
        },
        account: { select: { gallery: { select: { displayName: true, slug: true } } } },
      },
    });
    if (!d || d.status === 'DRAFT') throw new NotFoundException('Talep bulunamadı');
    const galeri = d.account.gallery;
    const def = await this.definition(d.categoryId, d.schemaVersion as number);
    const data = d.data as unknown as DemandData;
    // Aranabilir saatler dışında numara ve WhatsApp gizlenir; uygulama içi mesaj her zaman açık (Karar 29)
    const saatte = aranabilir(d.user.callFrom, d.user.callTo);
    const izinli = d.status === 'PUBLISHED' && d.phoneVisible && Boolean(viewerUserId);
    const showPhone = izinli && (saatte || viewerUserId === d.userId);
    return {
      ...this.summary(d),
      data: {
        ...data,
        alanlar:
          typeof data.alanlar?.aciklama === 'string'
            ? { ...data.alanlar, aciklama: hideDemandText(data.alanlar.aciklama) }
            : data.alanlar,
      },
      gorunum: await this.gorunum(d, data),
      schema: { version: d.schemaVersion, fields: effectiveFields(def), rules: def.rules },
      owner: {
        name: galeri
          ? galeri.displayName
          : demandOwnerName(d.user.firstName, d.user.lastName, d.nameMode as 'tam' | 'kisa'),
        /** Galeri adına açılmış talep (Karar 12.2): alıcı galeri */
        galeri: galeri ? { ad: galeri.displayName, slug: galeri.slug } : null,
        /** "Kasım 2025'ten beri üye" */
        memberSince: d.user.createdAt,
        isYou: viewerUserId === d.userId,
        /** Bakan kişinin favorisinde mi (Karar 06.4) */
        favori: viewerUserId
          ? Boolean(
              await this.db.favorite.findUnique({
                where: { userId_demandId: { userId: viewerUserId, demandId: d.id } },
              }),
            )
          : false,
        phone: showPhone ? d.user.phone : null,
        phoneHidden: d.phoneVisible && !viewerUserId,
        whatsapp: showPhone && d.whatsappVisible,
        /** Telefon izinli ama şu an aranabilir saatlerin dışında: "Telefon 09.00–21.00 arasında görünür" */
        aramaSaati:
          d.phoneVisible && d.status === 'PUBLISHED'
            ? { bas: d.user.callFrom, bit: d.user.callTo, simdiGizli: izinli && !showPhone }
            : null,
      },
    };
  }

  /**
   * Talep sayfasının katalog görünümü (Main.dc.html; Karar 24, 32): marka/seri/model adları; her alternatif için
   * kasa kuşakları (yıllarıyla ve nesil fotoğrafıyla), paket adları ve katalogdaki örnek teknik değerler.
   */
  private async gorunum(d: Demand, data: DemandData) {
    const [make, series, model] = await Promise.all([
      d.makeKey
        ? this.db.catalogMake.findUnique({ where: { key: d.makeKey }, select: { name: true } })
        : null,
      d.seriesKey
        ? this.db.catalogSeries.findUnique({ where: { key: d.seriesKey }, select: { id: true, name: true } })
        : null,
      d.modelKey
        ? this.db.catalogModel.findUnique({ where: { key: d.modelKey }, select: { id: true, name: true } })
        : null,
    ]);
    const sources = (
      await this.db.catalogSource.findMany({ where: { active: true }, select: { key: true } })
    ).map((x) => x.key);
    const gens = series
      ? await this.db.catalogGeneration.findMany({
          where: { seriesId: series.id, source: { in: sources } },
          select: {
            id: true,
            key: true,
            code: true,
            facelift: true,
            body: true,
            startYear: true,
            endYear: true,
            source: true,
            wikidataId: true,
          },
        })
      : [];
    const fotolar = gens.length
      ? await this.db.catalogImage.findMany({
          where: {
            status: 'secildi',
            generationId: { in: gens.filter((g) => g.source === 'wikidata').map((g) => g.id) },
          },
        })
      : [];
    const yil = new Date().getFullYear();
    const AD: Record<string, Record<string, string>> = {
      fuel: { benzin: 'Benzin', dizel: 'Dizel', hibrit: 'Hibrit', elektrik: 'Elektrik', lpg: 'LPG & Benzin' },
      gearbox: { manuel: 'Manuel', otomatik: 'Otomatik', yari_otomatik: 'Yarı otomatik' },
      drive: { onden: 'Önden çekiş', arkadan: 'Arkadan itiş', '4x4': '4x4' },
    };
    const alternatifler = [];
    for (const a of data.alternatifler ?? []) {
      const kasa = ((a.kasa as string[] | undefined) ?? []).map((v) => {
        const m = /^([^:/]+):(\d+)$/.exec(v);
        const grup = m
          ? gens.filter(
              (g) => g.source !== 'wikidata' && g.code === m[1] && (g.facelift ?? 0) === Number(m[2]),
            )
          : gens.filter((g) => g.key === v);
        const bas = grup.length ? Math.min(...grup.map((g) => g.startYear)) : null;
        const son = grup.length ? Math.max(...grup.map((g) => g.endYear ?? yil)) : null;
        const kod = m ? gens.find((g) => g.source === 'wikidata' && g.code === m[1]) : undefined;
        // Nesilde fotoğraf yoksa en yakın neslin fotoğrafı "önceki nesil" etiketiyle (Karar 34); yalnızca kodlu kasada
        const secim = m
          ? nesilFoto(
              gens.filter((g) => g.source === 'wikidata'),
              fotolar,
              { id: kod?.id, startYear: kod?.startYear ?? bas },
              Number(m[2]),
            )
          : undefined;
        return {
          value: v,
          label: m ? `${m[1]} ${m[2] === '0' ? 'makyajsız' : 'makyajlı'}` : (grup[0]?.body ?? 'Kasa'),
          yillar: bas === null ? null : son !== null && son >= yil ? `${bas} ve sonrası` : `${bas}–${son}`,
          foto: secim ? CatalogImageService.publicPhoto(secim.foto, secim.yakin) : null,
        };
      });
      const paketKeys = (a.paket as string[] | undefined) ?? [];
      const paket = paketKeys.length
        ? (
            await this.db.catalogTrim.findMany({ where: { key: { in: paketKeys } }, select: { name: true } })
          ).map((t) => t.name)
        : [];
      const y = a.yil as { min?: number; max?: number } | undefined;
      const variants = model
        ? await this.db.catalogVariant.findMany({
            where: {
              modelId: model.id,
              source: { in: sources },
              ...(y?.min || y?.max
                ? {
                    years: {
                      hasSome: Array.from(
                        { length: (y.max ?? yil) - (y.min ?? 1950) + 1 },
                        (_, i) => (y.min ?? 1950) + i,
                      ).slice(-60),
                    },
                  }
                : {}),
            },
            select: { engineL: true, powerHp: true, fuel: true, gearbox: true, drive: true, body: true },
            take: 400,
          })
        : [];
      // Katalogdaki en yaygın donanım (talepteki yıl aralığında)
      const say = new Map<string, { n: number; v: (typeof variants)[number] }>();
      for (const v of variants) {
        const k = JSON.stringify([v.engineL, v.powerHp, v.fuel, v.gearbox]);
        say.set(k, { n: (say.get(k)?.n ?? 0) + 1, v });
      }
      const ornek = [...say.values()].sort((p, q) => q.n - p.n)[0]?.v;
      const teknik = ornek
        ? [
            ornek.engineL
              ? {
                  label: 'Motor hacmi',
                  value: `${new Intl.NumberFormat('tr-TR').format(Math.round(ornek.engineL * 1000))} cm³`,
                }
              : null,
            ornek.powerHp ? { label: 'Güç', value: `${ornek.powerHp} hp` } : null,
            ornek.fuel ? { label: 'Yakıt', value: AD.fuel?.[ornek.fuel] ?? ornek.fuel } : null,
            ornek.gearbox ? { label: 'Şanzıman', value: AD.gearbox?.[ornek.gearbox] ?? ornek.gearbox } : null,
            ornek.drive ? { label: 'Çekiş', value: AD.drive?.[ornek.drive] ?? ornek.drive } : null,
            ornek.body ? { label: 'Kasa', value: ornek.body } : null,
          ].filter((x): x is { label: string; value: string } => x !== null)
        : [];
      alternatifler.push({
        kasa,
        paket,
        teknik,
        teknikOrnek: ornek && model ? `${model.name}${ornek.powerHp ? ` (${ornek.powerHp} hp)` : ''}` : null,
      });
    }
    return {
      katalog: { marka: make?.name ?? null, seri: series?.name ?? null, model: model?.name ?? null },
      alternatifler,
    };
  }

  /** Kalan haklar (Sihirbaz 6. adım: "Bu telefon numarasıyla 1 ücretsiz talep hakkın var"). */
  async rights(userId: string, hesap?: string) {
    if (hesap) {
      const g = await this.galleryOf(userId, hesap);
      const [talep, uzatma] = await Promise.all([
        this.entitlements.balance(hesap, 'talep'),
        this.entitlements.balance(hesap, 'uzatma'),
      ]);
      return { ucretsizTalep: false, talep, uzatma, telefonMaske: null, galeri: g.ad };
    }
    const accountId = await this.accountOf(userId);
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { phone: true } });
    // Ücretsiz ilk talep hem numara hem hesap başına bir kez: numarayı değiştirmek hakkı yenilemez
    const freeUsed =
      (await this.db.entitlementLedger.findUnique({
        where: {
          sourceType_sourceId_kind: {
            sourceType: 'ucretsiz_talep',
            sourceId: sha256(`rr-ucretsiz-talep:${user.phone}`),
            kind: 'talep',
          },
        },
        select: { id: true },
      })) ??
      (await this.db.entitlementLedger.findFirst({
        where: { accountId, sourceType: 'ucretsiz_talep' },
        select: { id: true },
      }));
    const [talep, uzatma] = await Promise.all([
      this.entitlements.balance(accountId, 'talep'),
      this.entitlements.balance(accountId, 'uzatma'),
    ]);
    const phone = user.phone.replace(/\D/g, '');
    return {
      ucretsizTalep: !freeUsed,
      talep: talep + (freeUsed ? 0 : 1),
      uzatma,
      /** "0 (5XX) XXX XX 67" */
      telefonMaske: `0 (5XX) XXX XX ${phone.slice(-2)}`,
      galeri: null,
    };
  }

  // ── Taslak ────────────────────────────────────────────────────

  async create(userId: string, kategori: string, hesap?: string, platform?: string) {
    const accountId = hesap ? (await this.galleryOf(userId, hesap)).accountId : await this.accountOf(userId);
    const category = await this.leafCategory(kategori);
    // Yeni talep Ayarlar'daki iletişim tercihleriyle ve profildeki konumla açılır (Karar 29); her talepte değişir
    const u = await this.db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { il: true, ilce: true, nameMode: true, phoneVisible: true, whatsappVisible: true },
    });
    const def = await this.definition(category.id, category.publishedVersion as number);
    const konum =
      u.il && effectiveFields(def).some((f) => f.key === 'konum' && f.type === 'location')
        ? { konum: u.ilce ? { il: u.il, ilce: u.ilce } : { il: u.il } }
        : {};
    return this.db.$transaction(async (tx) => {
      const d = await tx.demand.create({
        data: {
          id: uuidv7(),
          accountId,
          userId,
          categoryId: category.id,
          step: 2,
          data: { alanlar: konum, alternatifler: [{}] },
          // Kontrol paneli kırılımı (Karar 44); başlığı göndermeyen istemci boş kalır
          platform: platform && ['WEB', 'IOS', 'ANDROID'].includes(platform) ? platform : null,
          ...(hesap
            ? {}
            : { phoneVisible: u.phoneVisible, whatsappVisible: u.whatsappVisible, nameMode: u.nameMode }),
        },
        include: { category: { select: { slug: true, name: true } } },
      });
      await this.event(tx, d.id, 'olusturuldu', userId, { kategori: category.slug });
      return this.summary(d);
    });
  }

  /**
   * Taslağı kaydeder (yarım veri kabul edilir). Yayındaki ya da pasif talepte bu "Düzenle"dir: veri, talebin
   * yayına girdiği şema sürümüyle eksiksiz doğrulanır; talep yayında kalır (Karar 09).
   */
  async update(userId: string, id: string, input: DemandUpdate, ip?: string) {
    const d = await this.own(userId, id);
    if (d.status === 'CLOSED' || d.status === 'COMPLETED')
      throw new ConflictException('Kapanmış talep düzenlenemez');
    if (d.status === 'DRAFT') {
      let categoryId = d.categoryId;
      if (input.kategori) categoryId = (await this.leafCategory(input.kategori)).id;
      const changedCategory = categoryId !== d.categoryId;
      const updated = await this.db.demand.update({
        where: { id },
        data: {
          categoryId,
          ...(input.step ? { step: input.step } : {}),
          // Kategori değişince eski kategorinin alanları anlamsızdır.
          ...(changedCategory ? { data: { alanlar: {}, alternatifler: [{}] } } : {}),
          ...(input.data && !changedCategory ? { data: input.data as unknown as Prisma.InputJsonValue } : {}),
          ...(input.contact ?? {}),
          ...(input.headline !== undefined ? { headline: input.headline } : {}),
        },
        include: { category: { select: { slug: true, name: true } } },
      });
      return this.summary(updated);
    }
    if (input.kategori) throw new BadRequestException('Yayındaki talebin kategorisi değiştirilemez');
    const def = await this.definition(d.categoryId, d.schemaVersion as number);
    const data = input.data ? await this.validate(def, input.data) : (d.data as unknown as DemandData);
    return this.db.$transaction(async (tx) => {
      const cols = input.data ? await this.columns(tx, def, data) : {};
      const updated = await tx.demand.update({
        where: { id },
        data: {
          ...cols,
          ...(input.data ? { data: data as unknown as Prisma.InputJsonValue } : {}),
          ...(input.contact ?? {}),
          ...(input.headline !== undefined ? { headline: input.headline } : {}),
        },
        include: { category: { select: { slug: true, name: true } } },
      });
      await this.transition(tx, updated, userId, 'duzenlendi', 'talep.guncellendi', ip);
      return this.summary(updated);
    });
  }

  // ── Yayın ve yaşam döngüsü ───────────────────────────────────

  /** Taslağı yayınlar: şema doğrulanır, bir talep hakkı düşer, bitiş tarihi kurallardan hesaplanır. */
  async publish(userId: string, id: string, ip?: string) {
    const d = await this.own(userId, id);
    if (d.status !== 'DRAFT') throw new ConflictException('Talep zaten yayına girmiş');
    const category = await this.db.category.findUniqueOrThrow({ where: { id: d.categoryId } });
    if (!category.enabled || !category.publishedVersion)
      throw new ConflictException('Bu kategori şu an kapalı');
    const def = await this.definition(category.id, category.publishedVersion);
    const data = await this.validate(def, d.data as unknown as DemandData);
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { phone: true } });
    if (this.expiry(def, data, new Date()).getTime() - Date.now() < 3600_000) {
      throw new BadRequestException('Alış tarihi en az bir saat sonrası olmalı');
    }
    const galeri =
      (await this.db.account.findUniqueOrThrow({ where: { id: d.accountId } })).kind !== 'INDIVIDUAL';
    if (galeri) await this.galleryOf(userId, d.accountId);
    // Yasaklı kelime (Karar 13.2): talep yayına girer, kural şikâyeti moderasyona düşer
    const kelimeler = await this.icerik.yasakli(
      [
        d.headline ?? '',
        String((data as unknown as { alanlar?: { aciklama?: unknown } }).alanlar?.aciklama ?? ''),
      ].join(' '),
    );
    return this.db.$transaction(async (tx) => {
      // İlk talep telefon numarası başına ücretsiz; yeni hesap açmak hakkı yenilemez (Karar 12). Galeri adına talepte
      // ücretsiz hak yoktur, paketin aylık talep hakkı (ya da galerinin aldığı ek hak) kullanılır.
      // Hesap daha önce ücretsiz talep aldıysa (ör. numarasını değiştirdiyse) yeniden verilmez
      const hesapAldi =
        !galeri &&
        (await tx.entitlementLedger.count({
          where: { accountId: d.accountId, sourceType: 'ucretsiz_talep' },
        })) > 0;
      const free =
        galeri || hesapAldi
          ? { count: 0 }
          : await tx.entitlementLedger.createMany({
              data: [
                {
                  accountId: d.accountId,
                  kind: 'talep',
                  delta: 1,
                  reason: 'tanimlama',
                  sourceType: 'ucretsiz_talep',
                  sourceId: sha256(`rr-ucretsiz-talep:${user.phone}`),
                  createdBy: userId,
                },
              ],
              skipDuplicates: true,
            });
      await this.entitlements.consume(tx, d.accountId, 'talep', {
        sourceType: 'demand',
        sourceId: d.id,
        createdBy: userId,
      });
      const now = new Date();
      const updated = await tx.demand.update({
        where: { id, status: 'DRAFT' },
        data: {
          ...(await this.columns(tx, def, data)),
          data: data as unknown as Prisma.InputJsonValue,
          schemaVersion: category.publishedVersion,
          status: 'PUBLISHED',
          entitlement: galeri ? 'paket' : free.count === 1 ? 'ucretsiz' : 'ek',
          publishedAt: now,
          expiresAt: this.expiry(def, data, now),
          step: 6,
        },
        include: { category: { select: { slug: true, name: true } } },
      });
      await this.transition(tx, updated, userId, 'yayinlandi', 'talep.yayinlandi', ip);
      // Reklam ölçümü (Karar 35): ana optimizasyon olayı; talep metni gitmez, yalnızca kategori
      await this.ads?.olay(tx, userId, 'Lead', {
        ref: id,
        platform: olayPlatformu(updated.platform),
        kategori: updated.category.name,
      });
      await this.moderation.kuralSikayeti(
        tx,
        { targetType: 'talep', targetId: d.id, targetUserId: userId, targetAccountId: d.accountId },
        kelimeler,
      );
      return this.summary(updated);
    });
  }

  /** Moderasyonun kaldırdığı talebi sahibi yeniden yayına alamaz ya da uzatamaz; itiraz kabul edilirse geri gelir */
  private moderasyonKontrol(d: { status: string; passiveReason: string | null }) {
    if (d.status === 'PASSIVE' && d.passiveReason === 'moderasyon') {
      throw new ConflictException(
        'Talep moderasyon kararıyla yayından kaldırıldı; kararı bildirimlerden görüp itiraz edebilirsin',
      );
    }
  }

  /** Pasife al: talep silinmeden yayından kalkar, satıcılar yazamaz (Karar 09). */
  async passivate(userId: string, id: string, ip?: string) {
    const d = await this.own(userId, id);
    this.expect(d, ['PUBLISHED']);
    return this.change(
      d,
      userId,
      { status: 'PASSIVE', passiveAt: new Date(), passiveReason: 'kullanici' },
      'pasife_alindi',
      'talep.pasife_alindi',
      ip,
    );
  }

  /** Pasif talebi yeniden yayına alır; süresi dolduysa uzatmak gerekir. */
  async activate(userId: string, id: string, ip?: string) {
    const d = await this.own(userId, id);
    this.expect(d, ['PASSIVE']);
    this.moderasyonKontrol(d);
    if (!d.expiresAt || d.expiresAt <= new Date()) {
      throw new ConflictException('Talebin süresi doldu; yeniden yayına almak için uzat');
    }
    return this.change(
      d,
      userId,
      { status: 'PUBLISHED', passiveAt: null, passiveReason: null },
      'aktif_edildi',
      'talep.yayinlandi',
      ip,
    );
  }

  /**
   * Uzat (Karar 10, 12.1): süresi dolan ya da son 7 güne giren talep yeniden tam süre yayında kalır. İlk uzatma
   * ücretsizdir; sonrakiler için hak defterinden bir uzatma hakkı düşer (satın alma ödeme modülüyle gelir).
   */
  async extend(userId: string, id: string, ip?: string) {
    const d = await this.own(userId, id);
    this.expect(d, ['PUBLISHED', 'PASSIVE']);
    this.moderasyonKontrol(d);
    const now = new Date();
    if (
      d.status === 'PUBLISHED' &&
      d.expiresAt &&
      d.expiresAt.getTime() - now.getTime() > EXTEND_WINDOW_DAYS * DAY
    ) {
      throw new ConflictException(`Talep bitişine ${EXTEND_WINDOW_DAYS} günden az kalınca uzatılabilir`);
    }
    if (d.status === 'PASSIVE' && d.passiveReason !== 'sure_doldu' && d.expiresAt && d.expiresAt > now) {
      throw new ConflictException('Talebin süresi dolmadı; yeniden yayına alabilirsin');
    }
    const def = await this.definition(d.categoryId, d.schemaVersion as number);
    const data = d.data as unknown as DemandData;
    const expiresAt = this.expiry(def, data, now);
    if (expiresAt.getTime() - now.getTime() < DAY)
      throw new ConflictException('Alış tarihi geçtiği için talep uzatılamaz');
    return this.db.$transaction(async (tx) => {
      const free = !d.freeExtensionUsed;
      if (!free) {
        await this.entitlements.consume(tx, d.accountId, 'uzatma', {
          sourceType: 'demand_extension',
          sourceId: `${d.id}:${d.extensionCount + 1}`,
          createdBy: userId,
        });
      }
      const updated = await tx.demand.update({
        where: { id },
        data: {
          status: 'PUBLISHED',
          expiresAt,
          passiveAt: null,
          passiveReason: null,
          reminderDays: null,
          freeExtensionUsed: true,
          extensionCount: { increment: 1 },
        },
        include: { category: { select: { slug: true, name: true } } },
      });
      await this.transition(tx, updated, userId, 'uzatildi', 'talep.uzatildi', ip, {
        ucretsiz: free,
        bitis: expiresAt,
      });
      return this.summary(updated);
    });
  }

  /** Kapat: artık araç aranmıyor (Karar 09). Taslak da kapatılarak listeden kalkar. */
  async close(userId: string, id: string, ip?: string) {
    const d = await this.own(userId, id);
    this.expect(d, ['DRAFT', 'PUBLISHED', 'PASSIVE']);
    return this.change(
      d,
      userId,
      { status: 'CLOSED', closedAt: new Date() },
      'kapatildi',
      'talep.kapandi',
      ip,
    );
  }

  /** Aracı buldum: talep "tamamlandı" olarak kapanır; aracın nereden bulunduğu satıcıya gösterilmez (Karar 31). */
  async complete(userId: string, id: string, foundVia: FoundViaKey, ip?: string) {
    const d = await this.own(userId, id);
    this.expect(d, ['PUBLISHED', 'PASSIVE']);
    return this.change(
      d,
      userId,
      { status: 'COMPLETED', closedAt: new Date(), foundVia },
      'tamamlandi',
      'arac.bulundu',
      ip,
      {
        nereden: foundVia,
      },
    );
  }

  // ── İşçi ──────────────────────────────────────────────────────

  /** Süresi dolan talepler pasife düşer (silinmez); sahibine "süreyi uzat" bildirimi gider (Karar 10). */
  async expireDue(now = new Date()): Promise<number> {
    const due = await this.db.demand.findMany({
      where: { status: 'PUBLISHED', expiresAt: { lte: now } },
      take: 500,
    });
    let n = 0;
    for (const d of due) {
      await this.db.$transaction(async (tx) => {
        const r = await tx.demand.updateMany({
          where: { id: d.id, status: 'PUBLISHED', expiresAt: { lte: now } },
          data: { status: 'PASSIVE', passiveAt: now, passiveReason: 'sure_doldu' },
        });
        if (r.count !== 1) return;
        await this.event(tx, d.id, 'suresi_doldu', null);
        await this.audit.record(
          { actorType: 'SYSTEM', action: 'talep_suresi_doldu', entityType: 'demand', entityId: d.id },
          tx,
        );
        await this.outbox.add(tx, 'talep.suresi_doldu', { demandId: d.id, userId: d.userId });
        n++;
      });
    }
    return n;
  }

  /** Bitişten 7, 3 ve 1 gün önce hatırlatma olayı (bildirim katmanı iletir). Her eşik bir kez. */
  async remindDue(now = new Date()): Promise<number> {
    let n = 0;
    // En yakın eşikten başlanır: 2,5 gün kalan talebe yalnızca "3 gün" hatırlatması gider, "7 gün" atlanır.
    for (const days of [...REMINDER_DAYS].sort((a, b) => a - b)) {
      const due = await this.db.demand.findMany({
        where: {
          status: 'PUBLISHED',
          expiresAt: { gt: now, lte: new Date(now.getTime() + days * DAY) },
          OR: [{ reminderDays: null }, { reminderDays: { gt: days } }],
        },
        select: { id: true, userId: true, expiresAt: true },
        take: 500,
      });
      for (const d of due) {
        await this.db.$transaction(async (tx) => {
          const r = await tx.demand.updateMany({
            where: { id: d.id, OR: [{ reminderDays: null }, { reminderDays: { gt: days } }] },
            data: { reminderDays: days },
          });
          if (r.count !== 1) return;
          await this.event(tx, d.id, 'hatirlatma', null, { gun: days });
          await this.outbox.add(tx, 'talep.suresi_doluyor', { demandId: d.id, userId: d.userId, gun: days });
          n++;
        });
      }
    }
    return n;
  }

  // ── Yardımcılar ───────────────────────────────────────────────

  summary(d: Demand & { category: { slug: string; name: string } }) {
    return {
      id: d.id,
      no: Number(d.no),
      status: d.status,
      statusName: DEMAND_STATUS_NAMES[d.status as DemandStatusKey],
      title: d.title,
      // Telefon, IBAN, e-posta ve bağlantı herkese açık başlıkta gizlenir (Karar 41, 13.2); sahibi ownerDetail'de asıl
      // metni görür
      headline: hideDemandText(d.headline),
      /** Gösterilecek başlık: alıcının yazdığı, yoksa katalogdan üretilen */
      baslik: hideDemandText(d.headline) || d.title || d.category.name,
      category: d.category,
      il: d.il,
      ilce: d.ilce,
      budgetMin: d.budgetMin === null ? null : Number(d.budgetMin),
      budgetMax: d.budgetMax === null ? null : Number(d.budgetMax),
      yearMin: d.yearMin,
      yearMax: d.yearMax,
      alternatives: Array.isArray((d.data as unknown as DemandData)?.alternatifler)
        ? (d.data as unknown as DemandData).alternatifler.length
        : 0,
      step: d.step,
      publishedAt: d.publishedAt,
      expiresAt: d.expiresAt,
      passiveReason: d.passiveReason,
      closedAt: d.closedAt,
      freeExtensionUsed: d.freeExtensionUsed,
      /** Ajanın düzeltme isteği (Karar 41): talep yayında, bu bilgiler gizli */
      duzeltme: d.correctionAt
        ? {
            zaman: d.correctionAt,
            alanlar: d.correctionFlags.map((f) => DEMAND_TEXT_FLAGS[f as DemandTextFlag] ?? f),
          }
        : null,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  }

  /** Taleplerim ekranındaki düğmeler */
  private actions(d: Demand) {
    const now = Date.now();
    const exp = d.expiresAt?.getTime() ?? 0;
    const open = d.status === 'PUBLISHED' || d.status === 'PASSIVE';
    return {
      edit: d.status === 'DRAFT' || open,
      publish: d.status === 'DRAFT',
      passivate: d.status === 'PUBLISHED',
      activate: d.status === 'PASSIVE' && exp > now,
      extend:
        (d.status === 'PUBLISHED' && exp - now <= EXTEND_WINDOW_DAYS * DAY) ||
        (d.status === 'PASSIVE' && (d.passiveReason === 'sure_doldu' || exp <= now)),
      extendFree: !d.freeExtensionUsed,
      close: d.status === 'DRAFT' || open,
      complete: open,
    };
  }

  private async own(userId: string, id: string) {
    const d = await this.db.demand.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Talep bulunamadı');
    if (d.userId !== userId) throw new ForbiddenException('Bu talep senin değil');
    return d;
  }

  private expect(d: Demand, allowed: DemandStatus[]) {
    if (!allowed.includes(d.status)) {
      throw new ConflictException(
        `Talep "${DEMAND_STATUS_NAMES[d.status as DemandStatusKey]}" durumunda; bu işlem yapılamaz`,
      );
    }
  }

  /** Galeri adına talep: sahip ya da yönetici, hesap etkin ve paketi açık (Karar 12.2, 20) */
  private async galleryOf(userId: string, accountId: string) {
    const m = await this.db.accountMember.findUnique({
      where: { accountId_userId: { accountId, userId } },
      include: { account: { include: { gallery: true } } },
    });
    const g = m?.account.gallery;
    if (!m || !g) throw new NotFoundException('Galeri bulunamadı');
    if (m.role === 'SALES') throw new ForbiddenException('Galeri adına talebi sahip ya da yönetici açar');
    if (m.account.status !== 'ACTIVE') throw new ForbiddenException('Galeri hesabı askıda');
    if (galleryAccess(g).saltOkunur) {
      throw new ForbiddenException('Galeri adına talep için paket gerekli');
    }
    return { accountId, ad: g.displayName };
  }

  /**
   * Hakla öne çıkarma: hesabın kullanılmamış öne çıkarma hakkı (galeri paketinin aylık hakkı ya da talep seçilmeden
   * alınmış hak) yayındaki talebe 7 gün uygulanır; aynı türden süren varsa ardına eklenir. Hak ve öne çıkarma aynı işlemde.
   */
  async promote(userId: string, id: string, tur: 'ust_sira' | 'acil' | 'vitrin', ip?: string) {
    const d = await this.own(userId, id);
    this.expect(d, ['PUBLISHED']);
    return this.db.$transaction(async (tx) => {
      const pid = uuidv7();
      await this.entitlements.consume(tx, d.accountId, tur, {
        sourceType: 'promotion',
        sourceId: pid,
        createdBy: userId,
      });
      const now = new Date();
      const son = await tx.demandPromotion.findFirst({
        where: { demandId: d.id, kind: tur, endsAt: { gt: now } },
        orderBy: { endsAt: 'desc' },
      });
      const baslangic = son ? son.endsAt : now;
      const p = await tx.demandPromotion.create({
        data: {
          id: pid,
          demandId: d.id,
          kind: tur,
          startsAt: baslangic,
          endsAt: new Date(baslangic.getTime() + PROMOTE_DAYS * DAY),
        },
      });
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: userId,
          action: 'talep_one_cikarildi',
          entityType: 'demand',
          entityId: d.id,
          after: { tur, bitis: p.endsAt.toISOString() },
          ip: ip ?? null,
        },
        tx,
      );
      await this.outbox.add(tx, 'talep.guncellendi', { demandId: d.id });
      return { tur, baslangic: p.startsAt, bitis: p.endsAt };
    });
  }

  private async accountOf(userId: string) {
    const m = await this.db.accountMember.findFirst({
      where: { userId, role: 'OWNER', account: { kind: 'INDIVIDUAL', status: 'ACTIVE' } },
      select: { accountId: true },
    });
    if (!m) throw new ForbiddenException('Bireysel hesap bulunamadı');
    return m.accountId;
  }

  /** Talep açılabilen kategori: açık, yayında sürümü olan ve açık alt kategorisi olmayan (Ticari'de alt kategori seçilir). */
  private async leafCategory(slug: string) {
    const c = await this.db.category.findUnique({
      where: { slug },
      include: { children: { where: { enabled: true }, select: { id: true } } },
    });
    if (!c?.enabled || !c.publishedVersion) throw new BadRequestException('Kategori bulunamadı ya da kapalı');
    if (c.children.length) throw new BadRequestException('Alt kategori seç');
    return c;
  }

  private async definition(categoryId: string, version: number): Promise<CategoryDefinition> {
    const v = await this.db.categorySchemaVersion.findUnique({
      where: { categoryId_version: { categoryId, version } },
    });
    if (!v) throw new NotFoundException('Kategori şeması bulunamadı');
    return v.definition as unknown as CategoryDefinition;
  }

  /** Şema doğrulaması ve katalog seçiminin katalogda var olduğu denetimi. */
  private async validate(def: CategoryDefinition, raw: DemandData): Promise<DemandData> {
    const r = demandSchema(def).safeParse(raw);
    if (!r.success) invalid(r.error.issues);
    const data = r.data as DemandData;
    for (const f of effectiveFields(def).filter((x) => x.type === 'catalog')) {
      const v = data.alanlar[f.key] as { make: string; series?: string; model?: string } | undefined;
      if (!v) continue;
      const make = await this.db.catalogMake.findUnique({ where: { key: v.make }, select: { id: true } });
      const series = v.series
        ? await this.db.catalogSeries.findUnique({
            where: { key: v.series },
            select: { id: true, makeId: true },
          })
        : null;
      const model = v.model
        ? await this.db.catalogModel.findUnique({
            where: { key: v.model },
            select: { makeId: true, seriesId: true },
          })
        : null;
      const ok =
        make &&
        (!v.series || series?.makeId === make.id) &&
        (!v.model || (model?.makeId === make.id && (!v.series || model.seriesId === series?.id)));
      if (!ok) invalid([{ path: ['alanlar', f.key], message: `${f.label}: katalogda bulunamadı` }]);
    }
    return data;
  }

  /** Liste ve arama için ayrı sütunlar ve katalogdan başlık. */
  private async columns(tx: Tx, def: CategoryDefinition, data: DemandData) {
    const fields = effectiveFields(def);
    const cat = fields.find((f) => f.type === 'catalog' && data.alanlar[f.key]);
    const v = cat ? (data.alanlar[cat.key] as { make: string; series?: string; model?: string }) : undefined;
    const konum = data.alanlar.konum as { il?: string; ilce?: string } | undefined;
    const budget = span(data.alternatifler, 'butce');
    const year = span(data.alternatifler, 'yil');
    return {
      title: await this.title(tx, fields, data, v),
      makeKey: v?.make ?? null,
      seriesKey: v?.series ?? null,
      modelKey: v?.model ?? null,
      il: konum?.il ?? null,
      ilce: konum?.ilce ?? null,
      budgetMin: budget.min === null ? null : BigInt(Math.round(budget.min)),
      budgetMax: budget.max === null ? null : BigInt(Math.round(budget.max)),
      yearMin: year.min,
      yearMax: year.max,
    };
  }

  /** "BMW 3 Serisi 320i"; katalog yoksa ana araç adımındaki seçim ("Motorlu yat") ya da kategori adı. */
  private async title(
    tx: Tx,
    fields: CategoryField[],
    data: DemandData,
    v?: { make: string; series?: string; model?: string },
  ) {
    const parts: string[] = [];
    const lead = fields.find(
      (f) => f.step === 'ana_arac' && f.type === 'select' && typeof data.alanlar[f.key] === 'string',
    );
    if (lead) {
      const label = lead.options?.find((o) => o.value === data.alanlar[lead.key])?.label;
      if (label) parts.push(label);
    }
    if (v) {
      const make = await tx.catalogMake.findUnique({ where: { key: v.make }, select: { name: true } });
      const series = v.series
        ? await tx.catalogSeries.findUnique({ where: { key: v.series }, select: { name: true } })
        : null;
      const model = v.model
        ? await tx.catalogModel.findUnique({ where: { key: v.model }, select: { name: true } })
        : null;
      const tr = (x?: string) => x?.toLocaleLowerCase('tr-TR') ?? '';
      // Seri adı marka adıyla başlıyorsa (ör. "Range Rover Sport") marka tekrar yazılmaz.
      const showMake = !(make && series && tr(series.name).startsWith(tr(make.name)));
      parts.push([showMake ? make?.name : null, series?.name, model?.name].filter(Boolean).join(' '));
    }
    return parts.filter(Boolean).join(' · ').slice(0, 160);
  }

  /** Bitiş: kategori yayın süresi; alış tarihi olan talepte (kiralık) alış tarihini geçmez. */
  private expiry(def: CategoryDefinition, data: DemandData, from: Date) {
    let end = from.getTime() + def.rules.listingDays * DAY;
    for (const f of effectiveFields(def).filter((x) => x.type === 'daterange')) {
      const v = data.alanlar[f.key] as { from?: string } | undefined;
      if (v?.from) end = Math.min(end, new Date(v.from).getTime());
    }
    return new Date(end);
  }

  private event(
    tx: Tx,
    demandId: string,
    type: string,
    userId: string | null,
    data: Prisma.InputJsonValue = {},
  ) {
    return tx.demandEvent.create({ data: { demandId, type, userId, data } });
  }

  private async transition(
    tx: Tx,
    d: Demand,
    userId: string,
    type: string,
    eventType: EventType,
    ip?: string,
    extra: Record<string, unknown> = {},
  ) {
    await this.event(tx, d.id, type, userId, extra as Prisma.InputJsonValue);
    await this.audit.record(
      {
        actorType: 'USER',
        actorId: userId,
        action: `talep_${type}`,
        entityType: 'demand',
        entityId: d.id,
        after: { no: Number(d.no), durum: d.status, ...extra } as Prisma.InputJsonValue,
        ip,
      },
      tx,
    );
    await this.outbox.add(tx, eventType, {
      demandId: d.id,
      no: Number(d.no),
      userId,
      categoryId: d.categoryId,
    });
  }

  private change(
    d: Demand,
    userId: string,
    data: Prisma.DemandUpdateInput,
    type: string,
    eventType: EventType,
    ip?: string,
    extra: Record<string, unknown> = {},
  ) {
    return this.db.$transaction(async (tx) => {
      const r = await tx.demand.updateMany({
        where: { id: d.id, status: d.status },
        data: data as Prisma.DemandUpdateManyMutationInput,
      });
      if (r.count !== 1) throw new ConflictException('Talep bu sırada değişti; sayfayı yenile');
      const updated = await tx.demand.findUniqueOrThrow({
        where: { id: d.id },
        include: { category: { select: { slug: true, name: true } } },
      });
      await this.transition(tx, updated, userId, type, eventType, ip, extra);
      return this.summary(updated);
    });
  }
}
