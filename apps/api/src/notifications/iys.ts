import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { uuidv7 } from '@rengarenk/db';
import { NOTIFY_TOPICS } from '@rengarenk/shared';
import { AuditService } from '../audit/audit.service.js';
import { writeSheet } from '../common/files.js';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';
import { RequirePermission } from '../staff/permissions.js';
import { StaffGuard, type StaffRequest } from '../staff/staff.guard.js';

const DAY = 86_400_000;

/** İYS izin türleri ve bizdeki kampanya kanalı (uygulama içi ve push İYS kapsamında değil) */
export const IYS_TURLERI = [
  { tur: 'EPOSTA', kanal: 'eposta' },
  { tur: 'MESAJ', kanal: 'sms' },
] as const;
export type IysTur = (typeof IYS_TURLERI)[number]['tur'];

/** İYS paneline yüklenen Excel'in sütunları (İYS izin alanları: alıcı, tür, durum, alıcı tipi, kaynak, izin tarihi) */
export const IYS_SUTUNLAR = ['Alıcı', 'İzin türü', 'Durum', 'Alıcı tipi', 'İzin kaynağı', 'İzin tarihi'];

/** İYS izin tarihi Türkiye saatiyle "YYYY-AA-GG SS:DD:ss" */
export function iysTarih(d: Date) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? '00';
  return `${v('year')}-${v('month')}-${v('day')} ${v('hour')}:${v('minute')}:${v('second')}`;
}

/** Kapatılmış hesabın telefon alanı (`kapali:<id>`) ve yabancı numara İYS'ye gitmez */
const iysTelefon = (phone: string) => (/^\+905\d{9}$/.test(phone) ? phone : null);

/**
 * İYS izin kayıtları (Karar 49; sahip kararı 21 Kasım 2026): entegratör olmadan ticari ileti gönderilir, onay ve retler
 * kanal başına `iys_records`'a yazılır; çalışan gün sonunda bekleyenleri Excel olarak indirip İYS paneline yükler.
 * İYS kuralı: İYS dışında alınan onay ve ret 3 iş günü içinde İYS'ye kaydedilir.
 */
@Injectable()
export class IysKayitService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  /**
   * Kişinin İYS'deki olması gereken durumunu son kayıtla karşılaştırır ve fark varsa satır ekler (işçi,
   * `iys.izin_degisti`). Onay: ticari ileti onayı var, kampanya kanalı açık ve adres var. Adres değişince eski adrese
   * ret, yeni adrese onay yazılır. Aynı olay iki kez işlenirse yeni satır çıkmaz.
   */
  async esitle(userId: string, now = new Date()) {
    return this.db.$transaction(async (tx) => {
      // Aynı kişi için eşzamanlı iki eşitleme çift satır yazmasın
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`iys:${userId}`}))`;
      const [u, riza, prefs] = await Promise.all([
        tx.user.findUnique({ where: { id: userId }, select: { phone: true, email: true } }),
        tx.consent.findFirst({
          where: { userId, kind: 'ticari_ileti' },
          orderBy: { createdAt: 'desc' },
          select: { granted: true, createdAt: true, channel: true },
        }),
        tx.notificationPref.findMany({ where: { userId, konu: 'kampanya' } }),
      ]);
      if (!u) return 0;
      const kaynak = riza?.channel === 'ios' || riza?.channel === 'android' ? 'HS_MOBIL' : 'HS_WEB';
      let n = 0;
      for (const { tur, kanal } of IYS_TURLERI) {
        const pref = prefs.find((p) => p.kanal === kanal);
        const alici = tur === 'EPOSTA' ? (u.email?.trim().toLowerCase() ?? null) : iysTelefon(u.phone);
        const kanalAcik = pref?.acik ?? NOTIFY_TOPICS.kampanya.varsayilan[kanal];
        const onayli = Boolean(riza?.granted && kanalAcik && alici);
        const son = await tx.iysRecord.findFirst({
          where: { userId, type: tur },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        });
        const sonOnay = son?.status === 'ONAY' ? son.recipient : null;
        // Değişikliğin anı: rıza ya da kanal tercihi son kayıttan sonra değiştiyse onun zamanı, değilse şimdi
        // (adres değişti, hesap kapandı)
        const degisim = [riza?.createdAt, pref?.updatedAt]
          .filter((d): d is Date => !!d && d <= now)
          .reduce<Date | null>((a, d) => (!a || d > a ? d : a), null);
        const an = degisim && (!son || degisim > son.createdAt) ? degisim : now;
        if (sonOnay && (!onayli || sonOnay !== alici)) {
          await this.ekle(tx, { userId, tur, alici: sonOnay, durum: 'RET', kaynak, an: onayli ? now : an });
          n++;
        }
        if (onayli && alici && sonOnay !== alici) {
          await this.ekle(tx, { userId, tur, alici, durum: 'ONAY', kaynak, an });
          n++;
        }
      }
      return n;
    });
  }

  private ekle(
    tx: Tx,
    r: { userId: string; tur: IysTur; alici: string; durum: 'ONAY' | 'RET'; kaynak: string; an: Date },
  ) {
    return tx.iysRecord.create({
      data: {
        id: uuidv7(),
        userId: r.userId,
        type: r.tur,
        recipient: r.alici,
        status: r.durum,
        source: r.kaynak,
        consentAt: r.an,
      },
    });
  }

  /** Konsol › Rıza ve çerez kayıtları › İYS'ye aktarım: bekleyen sayısı ve paketler (kişisel veri yok) */
  async ozet(now = new Date()) {
    const [bekleyen, enEski, paketler] = await Promise.all([
      this.db.iysRecord.groupBy({ by: ['type', 'status'], where: { batchId: null }, _count: { _all: true } }),
      this.db.iysRecord.findFirst({
        where: { batchId: null },
        orderBy: { consentAt: 'asc' },
        select: { consentAt: true },
      }),
      this.db.iysBatch.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }),
    ]);
    const kisiler = await this.kisiAdlari([
      ...paketler.map((p) => p.createdBy),
      ...paketler.flatMap((p) => (p.uploadedBy ? [p.uploadedBy] : [])),
    ]);
    const say = (tur: string, durum: string) =>
      bekleyen.find((b) => b.type === tur && b.status === durum)?._count._all ?? 0;
    return {
      bekleyen: {
        toplam: bekleyen.reduce((a, b) => a + b._count._all, 0),
        eposta: { onay: say('EPOSTA', 'ONAY'), ret: say('EPOSTA', 'RET') },
        sms: { onay: say('MESAJ', 'ONAY'), ret: say('MESAJ', 'RET') },
        enEski: enEski?.consentAt ?? null,
        gecikti: !!enEski && isGunuFarki(enEski.consentAt, now) >= 3,
      },
      paketler: paketler.map((p) => ({
        id: p.id,
        no: p.no,
        sayi: p.count,
        zaman: p.createdAt,
        indiren: kisiler.get(p.createdBy) ?? '—',
        yuklendi: p.uploadedAt,
        yukleyen: p.uploadedBy ? (kisiler.get(p.uploadedBy) ?? '—') : null,
      })),
    };
  }

  private async kisiAdlari(ids: string[]) {
    const rows = await this.db.staffMember.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, name: true },
    });
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  /** Bekleyen bütün satırları yeni pakete alır; boşsa paket açılmaz */
  async paketle(staffId: string, ip?: string) {
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('iys:paket'))`;
      const ids = (
        await tx.iysRecord.findMany({ where: { batchId: null }, select: { id: true }, take: 50_000 })
      ).map((r) => r.id);
      if (!ids.length) return null;
      const p = await tx.iysBatch.create({ data: { id: uuidv7(), count: ids.length, createdBy: staffId } });
      await tx.iysRecord.updateMany({ where: { id: { in: ids } }, data: { batchId: p.id } });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'iys_paket',
          entityType: 'iys_batch',
          entityId: p.id,
          after: { no: p.no, sayi: ids.length },
          ip,
        },
        tx,
      );
      return { id: p.id, no: p.no, sayi: ids.length };
    });
  }

  /** Paketin Excel dosyası (kişisel veri içerir; her indirme işlem kaydına yazılır) */
  async excel(staffId: string, id: string, ip?: string) {
    const p = await this.db.iysBatch.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Paket bulunamadı');
    const rows = await this.db.iysRecord.findMany({
      where: { batchId: id },
      orderBy: [{ consentAt: 'asc' }, { createdAt: 'asc' }],
    });
    await this.audit.record({
      actorType: 'STAFF',
      actorId: staffId,
      action: 'iys_indir',
      entityType: 'iys_batch',
      entityId: id,
      after: { no: p.no, sayi: rows.length },
      ip,
    });
    return {
      ad: `iys_izinleri_${p.no}.xlsx`,
      dosya: writeSheet(
        [
          IYS_SUTUNLAR,
          ...rows.map((r) => [
            r.recipient,
            r.type,
            r.status,
            r.recipientType,
            r.source,
            iysTarih(r.consentAt),
          ]),
        ],
        'İzinler',
      ),
    };
  }

  /** Çalışan paketi İYS paneline yüklediğini işaretler */
  async yuklendi(staffId: string, id: string, ip?: string) {
    return this.db.$transaction(async (tx) => {
      const r = await tx.iysBatch.updateMany({
        where: { id, uploadedAt: null },
        data: { uploadedAt: new Date(), uploadedBy: staffId },
      });
      if (r.count !== 1) {
        if (!(await tx.iysBatch.findUnique({ where: { id }, select: { id: true } })))
          throw new NotFoundException('Paket bulunamadı');
        return { ok: true };
      }
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'iys_yuklendi',
          entityType: 'iys_batch',
          entityId: id,
          ip,
        },
        tx,
      );
      return { ok: true };
    });
  }

  /** Saatlik denetim: İYS'ye aktarılmamış en eski satır ve yüklendi işaretlenmemiş paket */
  async gecikme(now = new Date()) {
    const [enEski, bekleyenPaket, sayi] = await Promise.all([
      this.db.iysRecord.findFirst({
        where: { OR: [{ batchId: null }, { batch: { uploadedAt: null } }] },
        orderBy: { consentAt: 'asc' },
        select: { consentAt: true },
      }),
      this.db.iysBatch.count({ where: { uploadedAt: null } }),
      this.db.iysRecord.count({ where: { batchId: null } }),
    ]);
    if (!enEski) return null;
    return {
      enEski: enEski.consentAt,
      isGunu: isGunuFarki(enEski.consentAt, now),
      bekleyen: sayi,
      paket: bekleyenPaket,
    };
  }
}

/** İki an arasındaki tam iş günü (Cumartesi ve Pazar sayılmaz; resmî tatiller ayrıca düşülmez, erken uyarır) */
export function isGunuFarki(from: Date, to: Date) {
  const gun = (d: Date) => {
    const s = iysTarih(d).slice(0, 10);
    return new Date(`${s}T00:00:00Z`);
  };
  let d = gun(from);
  const son = gun(to);
  let n = 0;
  while (d < son) {
    d = new Date(d.getTime() + DAY);
    const g = d.getUTCDay();
    if (g !== 0 && g !== 6) n++;
  }
  return n;
}

type Reply = { header: (k: string, v: string) => unknown; send: (b: unknown) => unknown };

/** Konsol › Uyum ve KVKK › Rıza ve çerez kayıtları › İYS'ye aktarım */
@Controller('staff/iys')
@UseGuards(StaffGuard)
export class IysStaffController {
  constructor(private readonly iys: IysKayitService) {}

  @Get()
  @RequirePermission('kvkk.yanitla', 'oneri')
  ozet() {
    return this.iys.ozet();
  }

  @Post('paket')
  @HttpCode(200)
  @RequirePermission('kvkk.yanitla', 'tam')
  paketle(@Req() req: StaffRequest) {
    return this.iys.paketle(req.staff.staff.id, req.ip);
  }

  @Get('paket/:id/excel')
  @RequirePermission('kvkk.yanitla', 'tam')
  async excel(@Req() req: StaffRequest, @Param('id', new ParseUUIDPipe()) id: string, @Res() reply: Reply) {
    const f = await this.iys.excel(req.staff.staff.id, id, req.ip);
    reply.header('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('content-disposition', `attachment; filename="${f.ad}"`);
    reply.header('cache-control', 'no-store');
    return reply.send(Buffer.from(f.dosya));
  }

  @Post('paket/:id/yuklendi')
  @HttpCode(200)
  @RequirePermission('kvkk.yanitla', 'tam')
  yuklendi(@Req() req: StaffRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.iys.yuklendi(req.staff.staff.id, id, req.ip);
  }
}
