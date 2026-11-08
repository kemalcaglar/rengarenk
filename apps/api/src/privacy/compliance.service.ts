import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type Prisma, uuidv7 } from '@rengarenk/db';
import {
  BREACH_FORM_FIELDS,
  BREACH_HOURS,
  BREACH_PERSON_NOTICE,
  BREACH_STEP_KEYS,
  BREACH_STEPS,
  type BreachStep,
  OFFICIAL_STATUSES,
  type OfficialStatus,
} from '@rengarenk/shared';
import { AuditService } from '../audit/audit.service.js';
import { sniff } from '../common/files.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { STORAGE, type Storage } from '../storage/storage.service.js';

const HOUR = 3_600_000;
type Adim = { zaman: string; calisan: string; not?: string };

/**
 * Veri ihlali prosedürü ve resmi makam talepleri (Karar 59; YonetimSistem.dc.html › ihlal). Yalnız sahip ve yönetici
 * görür (`sistem.ayarla`); her adım işlem kaydına girer.
 *
 * - İhlal ya da tatbikat: öğrenildiği andan 72 saat içinde Kurul'a bildirim; beş adım, hazır form başlıkları ve kişilere
 *   bildirim taslağı. Aynı anda tek açık kayıt olur.
 * - Resmi talep: resmi yazı yüklenmeden veri verilmez (e-postayla gelen talep tek başına yeterli değil); verilen her veri
 *   kaydedilir; kullanıcıya, talep yazısı aksini söylemiyorsa yanıt sonrası bildirim gider. Talep sürdükçe kişinin verisi
 *   imhada bekletilir.
 */
@Injectable()
export class ComplianceService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(STORAGE) private readonly storage: Storage,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  private async adlar(ids: (string | null | undefined)[]) {
    const rows = await this.db.staffMember.findMany({
      where: { id: { in: [...new Set(ids.filter(Boolean) as string[])] } },
      select: { id: true, name: true },
    });
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  // ── Veri ihlali ───────────────────────────────────────────────

  async breach(me: string) {
    const [acik, sonTatbikat, sahip, yonetici] = await Promise.all([
      this.db.breachIncident.findFirst({ where: { closedAt: null }, orderBy: { createdAt: 'desc' } }),
      this.db.breachIncident.findFirst({
        where: { drill: true, closedAt: { not: null } },
        orderBy: { closedAt: 'desc' },
        select: { closedAt: true },
      }),
      this.db.staffMember.findFirst({
        where: { role: 'OWNER', status: 'ACTIVE' },
        select: { id: true, name: true },
      }),
      this.db.staffMember.findFirst({
        where: { role: 'ADMIN', status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
        select: { name: true },
      }),
    ]);
    const steps = (acik?.steps ?? {}) as Record<string, Adim>;
    const ad = await this.adlar(Object.values(steps).map((s) => s.calisan));
    return {
      aktif: acik
        ? {
            id: acik.id,
            no: acik.no,
            tatbikat: acik.drill,
            ozet: acik.summary,
            ogrenildi: acik.learnedAt,
            sonTarih: acik.deadline,
            kurulBildirildi: !!steps.kurul,
          }
        : null,
      adimlar: BREACH_STEPS.map((s, i) => ({
        no: i + 1,
        key: s.key,
        ad: s.ad,
        not: s.not,
        tamam: steps[s.key]
          ? {
              zaman: steps[s.key]?.zaman,
              calisan: ad.get(steps[s.key]?.calisan ?? '') ?? 'Çalışan',
              not: steps[s.key]?.not ?? null,
            }
          : null,
      })),
      form: BREACH_FORM_FIELDS,
      kisiBildirimi: BREACH_PERSON_NOTICE,
      sorumlu: sahip ? (sahip.id === me ? 'Sen' : sahip.name) : '—',
      yedek: yonetici?.name ?? null,
      sonTatbikat: sonTatbikat?.closedAt ?? null,
    };
  }

  async startBreach(
    staffId: string,
    b: { tatbikat: boolean; ogrenildi?: string; ozet: string },
    ip?: string,
  ) {
    const ogrenildi = b.ogrenildi ? new Date(b.ogrenildi) : new Date();
    if (ogrenildi.getTime() > Date.now() + 60_000)
      throw new BadRequestException('Öğrenilme zamanı gelecekte olamaz');
    return this.db.$transaction(async (tx) => {
      // Aynı anda tek açık kayıt
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('rr_ihlal'))`;
      if (await tx.breachIncident.count({ where: { closedAt: null } })) {
        throw new ConflictException('Açık bir ihlal ya da tatbikat kaydı var; önce onu kapat');
      }
      const r = await tx.breachIncident.create({
        data: {
          id: uuidv7(),
          drill: b.tatbikat,
          summary: b.ozet,
          learnedAt: ogrenildi,
          deadline: new Date(ogrenildi.getTime() + BREACH_HOURS * HOUR),
          openedBy: staffId,
        },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: b.tatbikat ? 'ihlal_tatbikati_basladi' : 'ihlal_kaydi_acildi',
          entityType: 'breach',
          entityId: r.id,
          after: { no: r.no, ogrenildi: ogrenildi.toISOString(), sonTarih: r.deadline.toISOString() },
          ip,
        },
        tx,
      );
      // Gerçek ihlalde sahip ve yöneticiye uyarı (çalışan uyarıları kanalı)
      if (!b.tatbikat) await this.outbox.add(tx, 'ihlal.basladi', { breachId: r.id, no: r.no });
      return { id: r.id, no: r.no, sonTarih: r.deadline };
    });
  }

  async stepBreach(staffId: string, id: string, step: string, not?: string, ip?: string) {
    if (!BREACH_STEP_KEYS.includes(step as BreachStep) || step === 'kapat') {
      throw new BadRequestException('Bilinmeyen adım');
    }
    const r = await this.db.breachIncident.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Kayıt bulunamadı');
    if (r.closedAt) throw new ConflictException('Kayıt kapandı');
    const steps = { ...((r.steps ?? {}) as Record<string, Adim>) };
    if (steps[step]) throw new ConflictException('Bu adım zaten tamamlandı');
    steps[step] = { zaman: new Date().toISOString(), calisan: staffId, ...(not ? { not } : {}) };
    await this.db.$transaction(async (tx) => {
      await tx.breachIncident.update({ where: { id }, data: { steps: steps as Prisma.InputJsonValue } });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'ihlal_adimi',
          entityType: 'breach',
          entityId: id,
          after: { adim: step, gecikti: step === 'kurul' && Date.now() > r.deadline.getTime() },
          ip,
        },
        tx,
      );
    });
    return { ok: true };
  }

  async closeBreach(staffId: string, id: string, rapor: string, ip?: string) {
    const r = await this.db.breachIncident.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Kayıt bulunamadı');
    if (r.closedAt) throw new ConflictException('Kayıt zaten kapandı');
    const steps = (r.steps ?? {}) as Record<string, Adim>;
    // Gerçek ihlalde Kurul bildirimi yapılmadan kayıt kapanmaz
    if (!r.drill && !steps.kurul)
      throw new ConflictException('Kurul’a bildirim adımı tamamlanmadan kayıt kapanmaz');
    await this.db.$transaction(async (tx) => {
      await tx.breachIncident.update({
        where: { id },
        data: {
          closedAt: new Date(),
          closedBy: staffId,
          report: rapor,
          steps: { ...steps, kapat: { zaman: new Date().toISOString(), calisan: staffId } },
        },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: r.drill ? 'ihlal_tatbikati_bitti' : 'ihlal_kaydi_kapandi',
          entityType: 'breach',
          entityId: id,
          after: { no: r.no, sure: Math.round((Date.now() - r.learnedAt.getTime()) / HOUR) },
          ip,
        },
        tx,
      );
    });
    return { ok: true };
  }

  // ── Resmi makam talepleri ─────────────────────────────────────

  async officialList() {
    const rows = await this.db.officialRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    const ad = await this.adlar(rows.flatMap((r) => [r.respondedBy, r.createdBy]));
    const kisiler = await this.db.user.findMany({
      where: { id: { in: rows.flatMap((r) => (r.userId ? [r.userId] : [])) } },
      select: { id: true, firstName: true, lastName: true, status: true },
    });
    const galeriler = await this.db.gallery.findMany({
      where: { accountId: { in: rows.flatMap((r) => (r.accountId ? [r.accountId] : [])) } },
      select: { accountId: true, displayName: true },
    });
    const kisi = new Map(
      kisiler.map((k) => [
        k.id,
        k.status === 'CLOSED'
          ? 'Kapatılmış hesap'
          : [k.firstName, k.lastName].filter(Boolean).join(' ') || 'Üye',
      ]),
    );
    const galeri = new Map(galeriler.map((g) => [g.accountId, g.displayName]));
    const gun = (d: Date) =>
      new Intl.DateTimeFormat('tr-TR', {
        day: 'numeric',
        month: 'short',
        timeZone: 'Europe/Istanbul',
      }).format(d);
    return rows.map((r) => {
      const verilen = (r.given ?? []) as { ne: string; zaman: string; calisan: string }[];
      const hedef = (r.accountId && galeri.get(r.accountId)) || (r.userId && kisi.get(r.userId)) || null;
      const durum = r.status as OfficialStatus;
      return {
        id: r.id,
        no: `R-${r.no}`,
        makam: r.authority,
        konu: r.subject,
        hedef,
        hesap: r.accountId
          ? { tip: 'galeri', id: r.accountId }
          : r.userId
            ? { tip: 'kisi', id: r.userId }
            : null,
        durum,
        durumAd: OFFICIAL_STATUSES[durum],
        belge: !!r.documentKey,
        bildirimYasak: r.noNotify,
        verilen: verilen.map((v) => ({ ne: v.ne, zaman: v.zaman, calisan: ad.get(v.calisan) ?? 'Çalışan' })),
        not: r.note,
        acilis: r.createdAt,
        detay: [
          hedef ? `${r.subject} · ${hedef}` : r.subject,
          durum === 'belge_bekleniyor'
            ? 'resmi yazı henüz yüklenmedi · e-posta ile gelen talep tek başına yeterli değil'
            : null,
          r.respondedAt ? gun(r.respondedAt) : gun(r.createdAt),
          r.respondedBy ? `yanıtlayan ${ad.get(r.respondedBy) ?? 'Çalışan'}` : null,
          verilen.length ? `${verilen.length} veri verildi` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      };
    });
  }

  async officialCreate(
    staffId: string,
    b: { makam: string; konu: string; kisi?: string; galeri?: string; bildirimYasak: boolean },
    ip?: string,
  ) {
    if (b.kisi && !(await this.db.user.count({ where: { id: b.kisi } })))
      throw new NotFoundException('Kişi bulunamadı');
    if (b.galeri && !(await this.db.account.count({ where: { id: b.galeri, kind: 'BUSINESS' } }))) {
      throw new NotFoundException('Galeri bulunamadı');
    }
    return this.db.$transaction(async (tx) => {
      const r = await tx.officialRequest.create({
        data: {
          id: uuidv7(),
          authority: b.makam,
          subject: b.konu,
          userId: b.kisi ?? null,
          accountId: b.galeri ?? null,
          noNotify: b.bildirimYasak,
          createdBy: staffId,
        },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'resmi_talep_acildi',
          entityType: 'official_request',
          entityId: r.id,
          after: { no: r.no, makam: b.makam, kisi: b.kisi ?? null, galeri: b.galeri ?? null },
          ip,
        },
        tx,
      );
      return { id: r.id, no: `R-${r.no}` };
    });
  }

  /** Resmi yazının yüklenmesi (PDF ya da görsel); yüklenince talep incelemeye geçer */
  async officialDocument(staffId: string, id: string, body: Uint8Array, ip?: string) {
    const r = await this.db.officialRequest.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Talep bulunamadı');
    if (r.status === 'yanitlandi' || r.status === 'reddedildi') throw new ConflictException('Talep kapandı');
    const tur = sniff(body);
    if (!tur) throw new BadRequestException('Resmi yazı PDF ya da görsel olmalı');
    const key = `resmi-talep/${id}/${uuidv7()}`;
    await this.storage.put(key, body, tur);
    await this.db.$transaction(async (tx) => {
      await tx.officialRequest.update({
        where: { id },
        data: {
          documentKey: key,
          documentType: tur,
          status: r.status === 'belge_bekleniyor' ? 'inceleniyor' : r.status,
        },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'resmi_yazi_yuklendi',
          entityType: 'official_request',
          entityId: id,
          after: { tur, boyut: body.byteLength },
          ip,
        },
        tx,
      );
    });
    return { ok: true };
  }

  async officialDocumentFile(staffId: string, id: string, ip?: string) {
    const r = await this.db.officialRequest.findUnique({ where: { id } });
    if (!r?.documentKey) throw new NotFoundException('Resmi yazı yüklenmedi');
    await this.audit.record({
      actorType: 'STAFF',
      actorId: staffId,
      action: 'resmi_yazi_acildi',
      entityType: 'official_request',
      entityId: id,
      ip,
    });
    const f = await this.storage.get(r.documentKey);
    return { body: f.body, tur: r.documentType ?? 'application/octet-stream' };
  }

  /** Verilen veri kaydı: ne verildiği, kimin verdiği ve ne zaman (Karar 59) */
  async officialGive(staffId: string, id: string, ne: string, ip?: string) {
    const r = await this.db.officialRequest.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Talep bulunamadı');
    if (r.status !== 'inceleniyor') {
      throw new ConflictException(
        r.status === 'belge_bekleniyor'
          ? 'Resmi yazı yüklenmeden veri verilmez'
          : 'Talep kapandı; yeni veri verilemez',
      );
    }
    const verilen = [
      ...((r.given ?? []) as unknown[]),
      { ne, zaman: new Date().toISOString(), calisan: staffId },
    ];
    await this.db.$transaction(async (tx) => {
      await tx.officialRequest.update({ where: { id }, data: { given: verilen as Prisma.InputJsonValue } });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'resmi_veri_verildi',
          entityType: 'official_request',
          entityId: id,
          after: { ne },
          ip,
        },
        tx,
      );
    });
    return { ok: true };
  }

  async officialReply(
    staffId: string,
    id: string,
    b: { durum: 'yanitlandi' | 'reddedildi'; not: string },
    ip?: string,
  ) {
    const r = await this.db.officialRequest.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Talep bulunamadı');
    if (r.status === 'yanitlandi' || r.status === 'reddedildi')
      throw new ConflictException('Talep zaten kapandı');
    if (b.durum === 'yanitlandi' && r.status !== 'inceleniyor') {
      throw new ConflictException('Resmi yazı yüklenmeden talep yanıtlanamaz');
    }
    await this.db.$transaction(async (tx) => {
      await tx.officialRequest.update({
        where: { id },
        data: { status: b.durum, note: b.not, respondedBy: staffId, respondedAt: new Date() },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: b.durum === 'yanitlandi' ? 'resmi_talep_yanitlandi' : 'resmi_talep_reddedildi',
          entityType: 'official_request',
          entityId: id,
          after: { no: r.no, verilen: ((r.given ?? []) as unknown[]).length },
          ip,
        },
        tx,
      );
      // Talep yazısı aksini söylemiyorsa ve veri verildiyse kullanıcıya bildirim
      if (b.durum === 'yanitlandi' && !r.noNotify && r.userId && ((r.given ?? []) as unknown[]).length) {
        await this.outbox.add(tx, 'resmi.yanitlandi', { requestId: id });
      }
    });
    return { ok: true };
  }
}
