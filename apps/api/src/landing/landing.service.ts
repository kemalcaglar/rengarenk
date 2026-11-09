import { createHmac, timingSafeEqual } from 'node:crypto';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { type Prisma, uuidv7 } from '@rengarenk/db';
import {
  LANDING_BLOCKS,
  type LandingBlock,
  type LandingInput,
  landingAdUrl,
  landingEvents,
} from '@rengarenk/shared';
import { AuditService } from '../audit/audit.service.js';
import { ENV, type Env } from '../config/env.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { RateLimiter } from '../ratelimit/rate-limiter.js';

const DAY = 86_400_000;
const ONIZLEME_MS = 60 * 60_000;
const gun = (d: Date) =>
  new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(d)}T00:00:00Z`);

/** Konsol listesinde blok satırının kısa içeriği */
function blokOzet(b: LandingBlock): string {
  switch (b.tur) {
    case 'baslik':
      return b.baslik;
    case 'rakamlar':
      return b.maddeler.map((m) => `${m.deger} ${m.etiket}`).join(' · ');
    case 'avantajlar':
      return b.maddeler.map((m) => m.baslik).join(' · ');
    case 'form':
      return `${b.baslik} · ${b.hedef === 'talep' ? 'talep oluşturmaya' : 'galeri başvurusuna'} götürür`;
    case 'nasil':
      return `${b.adimlar.length} adım`;
    case 'sss':
      return `${b.sorular.length} soru`;
    default:
      return b.maddeler.join(' · ');
  }
}

/**
 * Açılış sayfaları (Karar 46, 35; YonetimIcerik.dc.html › acilis). Pazarlama taslağı düzenler ve yayınlar (onay gerekmez,
 * Karar 46); her yayın sürüm olarak saklanır, önceki sürüme dönülür. Sayfa sitenin kök adresinde sunulur. Ziyaret ve
 * tıklama günlük toplamdır; IP başına hız sınırı vardır, kişisel veri tutulmaz. Taslak, kısa ömürlü imzalı bağlantıyla
 * önizlenir.
 */
@Injectable()
export class LandingService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    private readonly audit: AuditService,
    private readonly limiter: RateLimiter,
  ) {}

  private imza(id: string, son: number) {
    return createHmac('sha256', `rr-acilis:${this.env.JWT_SECRET}`)
      .update(`${id}:${son}`)
      .digest('base64url');
  }

  private onizlemeGecerli(id: string, token?: string) {
    if (!token) return false;
    const [son, imza] = token.split('.');
    if (!son || !imza || Number(son) < Date.now()) return false;
    const beklenen = Buffer.from(this.imza(id, Number(son)));
    const gelen = Buffer.from(imza);
    return beklenen.length === gelen.length && timingSafeEqual(beklenen, gelen);
  }

  // ── Herkese açık ──────────────────────────────────────────────

  /** Yayındaki sayfa; geçerli önizleme bağlantısıyla taslak */
  async publicPage(slug: string, onizleme?: string) {
    const p = await this.db.landingPage.findUnique({ where: { slug } });
    if (!p) throw new NotFoundException('Sayfa bulunamadı');
    const taslak = this.onizlemeGecerli(p.id, onizleme);
    if (!taslak && (p.status !== 'yayinda' || !p.publishedBlocks))
      throw new NotFoundException('Sayfa bulunamadı');
    return {
      slug: p.slug,
      seoBaslik: p.seoTitle,
      bloklar: (taslak ? p.blocks : p.publishedBlocks) as unknown as LandingBlock[],
      onizleme: taslak,
    };
  }

  /** Ziyaret ve düğme tıklaması (yalnızca yayındaki sayfada; IP başına sınırlı, IP saklanmaz) */
  async event(slug: string, tur: 'ziyaret' | 'tiklama', ip?: string) {
    if (ip) await this.limiter.hit(`acilis:${tur}:${ip}`, 60, 3600);
    const p = await this.db.landingPage.findUnique({ where: { slug }, select: { id: true, status: true } });
    if (p?.status !== 'yayinda') return { ok: false };
    const g = gun(new Date());
    await this.db.landingStat.upsert({
      where: { pageId_day: { pageId: p.id, day: g } },
      create: { pageId: p.id, day: g, visits: tur === 'ziyaret' ? 1 : 0, clicks: tur === 'tiklama' ? 1 : 0 },
      update: tur === 'ziyaret' ? { visits: { increment: 1 } } : { clicks: { increment: 1 } },
    });
    return { ok: true };
  }

  // ── Konsol ────────────────────────────────────────────────────

  async list() {
    const rows = await this.db.landingPage.findMany({ orderBy: { updatedAt: 'desc' }, take: 50 });
    const otuz = gun(new Date(Date.now() - 29 * DAY));
    const st = await this.db.landingStat.groupBy({
      by: ['pageId'],
      where: { pageId: { in: rows.map((r) => r.id) }, day: { gte: otuz } },
      _sum: { visits: true, clicks: true },
    });
    const s = new Map(st.map((x) => [x.pageId, x._sum]));
    return rows.map((r) => {
      const t = s.get(r.id);
      const v = t?.visits ?? 0;
      const c = t?.clicks ?? 0;
      return {
        id: r.id,
        ad: r.name,
        adres: `/${r.slug}`,
        durum: r.status,
        taslakDegisti:
          r.status === 'yayinda' && JSON.stringify(r.blocks) !== JSON.stringify(r.publishedBlocks),
        sonuc:
          r.status === 'yayinda' || v
            ? `${new Intl.NumberFormat('tr-TR').format(v)} ziyaret · %${v ? new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format((c / v) * 100) : 0} düğmeye tıkladı · son 30 gün`
            : 'Yayında değil',
      };
    });
  }

  async get(id: string) {
    const p = await this.db.landingPage.findUnique({
      where: { id },
      include: { versions: { orderBy: { version: 'desc' }, take: 10 } },
    });
    if (!p) throw new NotFoundException('Sayfa bulunamadı');
    const kisi = new Map(
      (
        await this.db.staffMember.findMany({
          where: { id: { in: p.versions.map((v) => v.publishedBy) } },
          select: { id: true, name: true },
        })
      ).map((k) => [k.id, k.name]),
    );
    const bloklar = p.blocks as unknown as LandingBlock[];
    const utm = p.utm as { source: string; medium: string; campaign: string };
    const son = Date.now() + ONIZLEME_MS;
    return {
      id: p.id,
      ad: p.name,
      slug: p.slug,
      seoBaslik: p.seoTitle,
      utm,
      bloklar,
      ozet: bloklar.map((b) => ({
        ad: LANDING_BLOCKS[b.tur].ad,
        renk: LANDING_BLOCKS[b.tur].renk,
        icerik: blokOzet(b),
      })),
      durum: p.status,
      surum: p.version,
      reklamBaglantisi: landingAdUrl(this.env.WEB_ORIGIN, p.slug, utm),
      olaylar: landingEvents(bloklar),
      onizleme: `${this.env.WEB_ORIGIN.replace(/\/$/, '')}/${p.slug}?onizleme=${son}.${this.imza(p.id, son)}`,
      surumler: p.versions.map((v) => ({
        surum: v.version,
        zaman: v.publishedAt,
        kim: kisi.get(v.publishedBy) ?? 'Çalışan',
      })),
    };
  }

  async save(staffId: string, b: LandingInput, id?: string) {
    const veri = {
      name: b.ad,
      slug: b.slug,
      seoTitle: b.seoBaslik,
      utm: b.utm as unknown as Prisma.InputJsonValue,
      blocks: b.bloklar as unknown as Prisma.InputJsonValue,
    };
    const cakisan = await this.db.landingPage.findUnique({ where: { slug: b.slug }, select: { id: true } });
    if (cakisan && cakisan.id !== id) throw new ConflictException('Bu adreste başka bir sayfa var');
    const sayfaId = id ?? uuidv7();
    if (id) {
      const r = await this.db.landingPage.updateMany({ where: { id }, data: veri });
      if (!r.count) throw new NotFoundException('Sayfa bulunamadı');
    } else {
      await this.db.landingPage.create({ data: { id: sayfaId, ...veri, createdBy: staffId } });
    }
    await this.audit.record({
      actorType: 'STAFF',
      actorId: staffId,
      action: id ? 'acilis_guncellendi' : 'acilis_olusturuldu',
      entityType: 'landing_page',
      entityId: sayfaId,
    });
    return this.get(sayfaId);
  }

  /** Taslağı yayınlar: yeni sürüm saklanır */
  async publish(staffId: string, id: string, ip?: string) {
    const p = await this.db.landingPage.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Sayfa bulunamadı');
    const surum = p.version + 1;
    await this.db.$transaction(async (tx) => {
      await tx.landingPage.update({
        where: { id },
        data: {
          status: 'yayinda',
          publishedBlocks: p.blocks as Prisma.InputJsonValue,
          version: surum,
          publishedAt: new Date(),
        },
      });
      await tx.landingPageVersion.create({
        data: {
          id: uuidv7(),
          pageId: id,
          version: surum,
          blocks: p.blocks as Prisma.InputJsonValue,
          seoTitle: p.seoTitle,
          publishedBy: staffId,
        },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'acilis_yayinlandi',
          entityType: 'landing_page',
          entityId: id,
          after: { surum, adres: `/${p.slug}` },
          ip,
        },
        tx,
      );
    });
    return this.get(id);
  }

  async unpublish(staffId: string, id: string, ip?: string) {
    const r = await this.db.landingPage.updateMany({
      where: { id, status: 'yayinda' },
      data: { status: 'kapali' },
    });
    if (!r.count) throw new ConflictException('Sayfa yayında değil');
    await this.audit.record({
      actorType: 'STAFF',
      actorId: staffId,
      action: 'acilis_kapatildi',
      entityType: 'landing_page',
      entityId: id,
      ip,
    });
    return this.get(id);
  }

  /** Önceki sürüme dön: o sürümün blokları taslağa alınır ve yeniden yayınlanır */
  async rollback(staffId: string, id: string, surum: number, ip?: string) {
    const v = await this.db.landingPageVersion.findUnique({
      where: { pageId_version: { pageId: id, version: surum } },
    });
    if (!v) throw new NotFoundException('Sürüm bulunamadı');
    await this.db.landingPage.update({
      where: { id },
      data: { blocks: v.blocks as Prisma.InputJsonValue, seoTitle: v.seoTitle },
    });
    return this.publish(staffId, id, ip);
  }
}
