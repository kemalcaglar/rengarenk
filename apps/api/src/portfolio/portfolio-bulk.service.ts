import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type Cell, parseCsv, readFirstSheet } from '@rengarenk/catalog';
import { uuidv7 } from '@rengarenk/db';
import {
  API_KEY_PREFIX,
  BULK_COLUMNS,
  BULK_MAX_ROWS,
  COLORS,
  FUELS,
  GEARBOXES,
  type PortfolioVehicleData,
  portfolioVehicleSchema,
} from '@rengarenk/shared';
import { AuditService } from '../audit/audit.service.js';
import { writeSheet } from '../common/files.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { type Ctx, PortfolioService } from './portfolio.service.js';

const kucuk = (s: string) => s.trim().toLocaleLowerCase('tr-TR');
const evet = (v: string) => ['e', 'evet', 'x', '1', 'true', 'var'].includes(kucuk(v));
const secenek = (list: readonly { key: string; ad: string }[], v: string) =>
  list.find((x) => kucuk(x.ad) === kucuk(v) || x.key === kucuk(v))?.key;

export interface BulkRow {
  satir: number;
  arac: string;
  veri?: PortfolioVehicleData;
  hata?: string;
  aksiyon?: string;
  /** Aynı stok no ile var olan aracın güncellenmesi */
  guncelleme?: string;
}

/**
 * Excel/CSV ile toplu yükleme (Karar 07.2; GaleriPanel.dc.html › Toplu yükleme) ve API entegrasyonu (Karar 07.3).
 * Satırlar katalogdaki adlarla eşleşir; hatalı satırlar raporlanır, hazır olanlar taslak olarak aktarılır (fotoğraf
 * eklenip EİDS'e gönderilince yayına girer). Aynı stok numarası var olan aracı günceller.
 */
@Injectable()
export class PortfolioBulkService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly portfolio: PortfolioService,
    private readonly audit: AuditService,
  ) {}

  template(): Uint8Array {
    return writeSheet(
      [
        BULK_COLUMNS.map(([b]) => b),
        [
          'S-1001',
          'Otomobil',
          'BMW',
          '3 Serisi',
          '320i',
          'M Sport',
          2020,
          62000,
          'Benzin',
          'Otomatik',
          'Beyaz',
          2390000,
          '34 ABC 123',
          'A12345',
          '15.03.2020',
          12000,
          'E',
          'E',
          'İlk sahibinden, bakımları yetkili serviste',
        ],
      ],
      'Portföy',
    );
  }

  /** Dosyadaki satırlar: başlık → değer */
  private rows(body: Uint8Array, contentType: string): Record<string, string>[] {
    if (contentType.includes('csv')) {
      const text = Buffer.from(body).toString('utf8').replace(/^﻿/, '');
      // Türkçe Excel CSV'yi noktalı virgülle yazar
      const ilk = text.split('\n')[0] ?? '';
      const ayrac = (ilk.match(/;/g)?.length ?? 0) > (ilk.match(/,/g)?.length ?? 0) ? ';' : ',';
      return parseCsv(text, ayrac);
    }
    let cells: Cell[][];
    try {
      cells = readFirstSheet(body);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    const [baslik, ...veri] = cells;
    if (!baslik) return [];
    const keys = baslik.map((h) => String(h ?? '').trim());
    return veri
      .filter((r) => r.some((c) => c !== null && String(c).trim() !== ''))
      .map((r) =>
        Object.fromEntries(keys.map((k, i) => [k, r[i] === null || r[i] === undefined ? '' : String(r[i])])),
      );
  }

  private async resolve(raw: Record<string, string>, satir: number, accountId: string): Promise<BulkRow> {
    const al = (alan: string) => {
      const b = BULK_COLUMNS.find(([, a]) => a === alan)?.[0] as string;
      return (raw[b] ?? '').trim();
    };
    const arac =
      [al('yil'), al('marka'), al('seri'), al('model'), al('paket')].filter(Boolean).join(' ') ||
      `Satır ${satir}`;
    const hata = (h: string, aksiyon = 'Düzelt'): BulkRow => ({ satir, arac, hata: h, aksiyon });

    const kategori = await this.db.category.findFirst({
      where: {
        OR: [{ slug: kucuk(al('kategori')) }, { name: { equals: al('kategori'), mode: 'insensitive' } }],
        enabled: true,
      },
      select: { slug: true },
    });
    if (!kategori) return hata('Kategori bulunamadı', 'Kategori seç');
    const make = al('marka')
      ? await this.db.catalogMake.findFirst({
          where: { name: { equals: al('marka'), mode: 'insensitive' } },
          select: { id: true, key: true },
        })
      : null;
    if (al('marka') && !make && !['deniz', 'hava'].includes(kategori.slug))
      return hata(`“${al('marka')}” markası katalogda yok`, 'Marka seç');
    const series =
      make && al('seri')
        ? await this.db.catalogSeries.findFirst({
            where: { makeId: make.id, name: { equals: al('seri'), mode: 'insensitive' } },
            select: { id: true, key: true },
          })
        : null;
    if (make && al('seri') && !series) return hata(`“${al('seri')}” serisi bu markada yok`, 'Seri seç');
    const model =
      make && al('model')
        ? await this.db.catalogModel.findFirst({
            where: {
              makeId: make.id,
              ...(series ? { seriesId: series.id } : {}),
              name: { equals: al('model'), mode: 'insensitive' },
            },
            select: { key: true },
          })
        : null;
    if (make && al('model') && !model) return hata(`“${al('model')}” modeli katalogda yok`, 'Model seç');
    let paket: string | undefined;
    if (series && al('paket')) {
      const t = await this.db.catalogTrim.findFirst({
        where: { seriesId: series.id, name: { equals: al('paket'), mode: 'insensitive' } },
        select: { key: true },
      });
      if (!t) {
        const secenekler = await this.db.catalogTrim.findMany({
          where: { seriesId: series.id },
          select: { name: true },
          take: 6,
        });
        return hata(
          `“${al('paket')}” paketi bu seride yok${secenekler.length ? ` (${secenekler.map((x) => x.name).join(', ')})` : ''}`,
          'Paket seç',
        );
      }
      paket = t.key;
    }
    const tescil = al('ilkTescil');
    const tescilIso = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(tescil);
    const sayi = (s: string) => s.replace(/[^\d]/g, '');
    const girdi = {
      kategori: kategori.slug,
      marka: make?.key,
      seri: series?.key,
      model: model?.key,
      paket,
      markaAd: make ? undefined : al('marka') || undefined,
      modelAd: model ? undefined : al('model') || undefined,
      yil: al('yil'),
      km: sayi(al('km')),
      yakit: al('yakit') ? secenek(FUELS, al('yakit')) : undefined,
      vites: al('vites') ? secenek(GEARBOXES, al('vites')) : undefined,
      renk: al('renk') ? secenek(COLORS, al('renk')) : undefined,
      fiyat: sayi(al('fiyat')),
      plaka: al('plaka') || undefined,
      sasiSon6: al('sasiSon6') || undefined,
      ilkTescil: tescilIso
        ? `${tescilIso[3]}-${tescilIso[2]?.padStart(2, '0')}-${tescilIso[1]?.padStart(2, '0')}`
        : undefined,
      takas: evet(al('takas')),
      fiyatBeyani: evet(al('fiyatBeyani')),
      hasar: { parcalar: {}, tramer: sayi(al('tramer')) || 0 },
      aciklama: al('aciklama') || undefined,
      disNo: al('disNo') || undefined,
    };
    if (!al('km')) return hata('Kilometre alanı boş');
    if (!al('fiyat')) return hata('Fiyat alanı boş', 'Fiyatı düzelt');
    if (al('sasiSon6') && al('sasiSon6').length < 6) return hata('Şasi numarası 6 haneden kısa');
    if (tescil && !tescilIso) return hata('İlk tescil tarihi GG.AA.YYYY biçiminde olmalı');
    const r = portfolioVehicleSchema.safeParse(girdi);
    if (!r.success) return hata(r.error.issues[0]?.message ?? 'Satır geçerli değil');
    const varolan = r.data.disNo
      ? await this.db.portfolioVehicle.findFirst({
          where: { accountId, externalId: r.data.disNo },
          select: { id: true, status: true },
        })
      : null;
    if (varolan?.status === 'SOLD')
      return hata('Bu stok numarasıyla satılmış bir araç var', 'Stok no değiştir');
    return { satir, arac, veri: r.data, guncelleme: varolan?.id };
  }

  /** Önizleme: hazır satırlar ve düzeltme gerekenler */
  async preview(c: Ctx, body: Uint8Array, contentType: string) {
    if (!c.toplu) throw new ForbiddenException('Toplu yükleme Profesyonel ve Kurumsal pakettedir');
    if (c.role === 'SALES') throw new ForbiddenException('Toplu yüklemeyi sahip ya da yönetici yapar');
    const rows = this.rows(body, contentType);
    if (rows.length === 0) throw new BadRequestException('Dosyada araç satırı yok');
    if (rows.length > BULK_MAX_ROWS)
      throw new BadRequestException(`Bir dosyada en çok ${BULK_MAX_ROWS} satır olabilir`);
    const out: BulkRow[] = [];
    for (const [i, r] of rows.entries()) out.push(await this.resolve(r, i + 2, c.accountId));
    const hazir = out.filter((r) => r.veri);
    const yeni = hazir.filter((r) => !r.guncelleme).length;
    const kapasite =
      c.limit === null ? Number.POSITIVE_INFINITY : c.limit - (await this.activeCount(c.accountId));
    return {
      toplam: out.length,
      hazir: hazir.length,
      yeni,
      guncelleme: hazir.length - yeni,
      kapasite: Number.isFinite(kapasite) ? kapasite : null,
      hatalar: out
        .filter((r) => r.hata)
        .map(({ satir, arac, hata, aksiyon }) => ({ satir, arac, hata, aksiyon })),
      satirlar: out,
    };
  }

  private activeCount(accountId: string) {
    return this.db.portfolioVehicle.count({
      where: { accountId, status: { in: ['DRAFT', 'PENDING_EIDS', 'PUBLISHED', 'PASSIVE'] } },
    });
  }

  /** Hazır satırları aktarır; paket sınırını aşan yeni satırlar aktarılmaz */
  async import(c: Ctx, body: Uint8Array, contentType: string, ip?: string) {
    const p = await this.preview(c, body, contentType);
    let eklendi = 0;
    let guncellendi = 0;
    let sinir = 0;
    for (const r of p.satirlar) {
      if (!r.veri) continue;
      if (r.guncelleme) {
        await this.portfolio.update(c, r.guncelleme, r.veri, ip).catch(() => undefined);
        guncellendi++;
        continue;
      }
      try {
        await this.portfolio.create(c, r.veri, ip);
        eklendi++;
      } catch (e) {
        if (e instanceof ConflictException) sinir++;
        else throw e;
      }
    }
    await this.audit.record({
      actorType: 'USER',
      actorId: c.userId,
      action: 'portfoy_toplu_yuklendi',
      entityType: 'account',
      entityId: c.accountId,
      after: { eklendi, guncellendi, hatali: p.hatalar.length, sinir },
      ip,
    });
    return { eklendi, guncellendi, hatali: p.hatalar.length, sinirDisi: sinir };
  }

  /** Hata raporu (Excel): satır, araç, hata */
  errorReport(hatalar: { satir: number; arac: string; hata?: string }[]) {
    return writeSheet(
      [['Satır', 'Araç', 'Hata'], ...hatalar.map((h) => [h.satir, h.arac, h.hata ?? ''])],
      'Hatalar',
    );
  }

  // ── API anahtarları (Karar 07.3) ──────────────────────────────

  private hash = (key: string) => createHash('sha256').update(key).digest('hex');

  async keys(c: Ctx) {
    const rows = await this.db.apiKey.findMany({
      where: { accountId: c.accountId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((k) => ({
      id: k.id,
      ad: k.name,
      onek: k.prefix,
      olusturuldu: k.createdAt,
      sonKullanim: k.lastUsedAt,
      iptal: k.revokedAt,
    }));
  }

  /** Yeni anahtar: kendisi yalnızca bir kez gösterilir, özeti saklanır */
  async createKey(c: Ctx, ad: string, ip?: string) {
    if (!c.api) throw new ForbiddenException('API entegrasyonu Kurumsal pakettedir');
    if (c.role === 'SALES') throw new ForbiddenException('API anahtarını sahip ya da yönetici oluşturur');
    const key = `${API_KEY_PREFIX}${randomBytes(24).toString('base64url')}`;
    const id = uuidv7();
    await this.db.$transaction(async (tx) => {
      await tx.apiKey.create({
        data: {
          id,
          accountId: c.accountId,
          name: ad,
          prefix: key.slice(0, 10),
          hash: this.hash(key),
          createdBy: c.userId,
        },
      });
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: c.userId,
          action: 'api_anahtari_olusturuldu',
          entityType: 'api_key',
          entityId: id,
          ip,
        },
        tx,
      );
    });
    return { id, anahtar: key };
  }

  async revokeKey(c: Ctx, id: string, ip?: string) {
    if (c.role === 'SALES') throw new ForbiddenException('API anahtarını sahip ya da yönetici iptal eder');
    const r = await this.db.apiKey.updateMany({
      where: { id, accountId: c.accountId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!r.count) throw new NotFoundException('Anahtar bulunamadı');
    await this.audit.record({
      actorType: 'USER',
      actorId: c.userId,
      action: 'api_anahtari_iptal',
      entityType: 'api_key',
      entityId: id,
      ip,
    });
  }

  /** Entegrasyon isteğinin anahtarı → galeri bağlamı (sahibin adına; paket Kurumsal olmalı) */
  async contextFromKey(key: string): Promise<Ctx> {
    const k = await this.db.apiKey.findUnique({ where: { hash: this.hash(key) } });
    if (!k || k.revokedAt) throw new ForbiddenException('API anahtarı geçersiz');
    const owner = await this.db.accountMember.findFirst({
      where: { accountId: k.accountId, role: 'OWNER' },
      select: { userId: true },
    });
    if (!owner) throw new ForbiddenException('Galeri bulunamadı');
    const c = await this.portfolio.ctx(owner.userId, k.accountId, true);
    if (!c.api) throw new ForbiddenException('API entegrasyonu Kurumsal pakettedir');
    await this.db.apiKey.update({ where: { id: k.id }, data: { lastUsedAt: new Date() } });
    return c;
  }

  /** Entegrasyon: stok no ile ekle ya da güncelle */
  async upsertByExternal(c: Ctx, disNo: string, d: PortfolioVehicleData) {
    const v = await this.db.portfolioVehicle.findFirst({
      where: { accountId: c.accountId, externalId: disNo },
      select: { id: true, status: true },
    });
    const veri = { ...d, disNo };
    if (!v) return this.portfolio.create(c, veri);
    if (v.status === 'SOLD') throw new ConflictException('Bu stok numarasıyla satılmış bir araç var');
    return this.portfolio.update(c, v.id, veri);
  }

  async byExternal(c: Ctx, disNo: string) {
    const v = await this.db.portfolioVehicle.findFirst({
      where: { accountId: c.accountId, externalId: disNo },
      select: { id: true },
    });
    if (!v) throw new NotFoundException('Bu stok numarasıyla araç yok');
    return v.id;
  }
}
