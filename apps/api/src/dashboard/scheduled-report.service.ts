import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { type Approval, Prisma, type ScheduledReport, uuidv7 } from '@rengarenk/db';
import {
  BUILTIN_REPORT_KEYS,
  BUILTIN_REPORTS,
  type BuiltinReport,
  type BuiltinReportKey,
  ekle,
  GALLERY_REPORT_MIN_DEMANDS,
  GALLERY_REPORT_MODELS,
  lastSlot,
  nextSlot,
  type PermissionGrants,
  REPORT_RANGES,
  REPORT_TABS,
  type ReportFilter,
  type ReportFrequency,
  type ReportTab,
  type ScheduledReportInput,
  type ScheduledSource,
  satisfies,
  scheduleText,
  tlYaz,
} from '@rengarenk/shared';
import { ApprovalService } from '../approvals/approval.service.js';
import { ApprovalExecutor } from '../approvals/approval-executor.js';
import { AuditService } from '../audit/audit.service.js';
import { ENV, type Env } from '../config/env.js';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';
import { EMAIL_SENDER, type EmailSender } from '../notifications/channels.js';
import { NotificationService } from '../notifications/notification.service.js';
import { grantsFor } from '../staff/permissions.js';
import { DashboardService, trAy } from './dashboard.service.js';
import { ReportService } from './report.service.js';
import { type ReportSection, type ReportTable, reportCsv, reportPdf } from './report-pdf.js';

const SUBJECT = 'scheduled_report';
const DAY = 86_400_000;
/** İşçi uzun süre durduysa bu kadar eski gönderim zamanı atlanır */
const GEC_SINIR = DAY;

interface StaffActor {
  staff: { id: string; role: string; status: string };
  grants: PermissionGrants;
}

const kisaAd = (name: string) => {
  const p = name.trim().split(/\s+/);
  return p.length > 1 ? `${p.slice(0, -1).join(' ')} ${p.at(-1)?.slice(0, 1)}.` : (p[0] ?? 'Bir çalışan');
};
const tarihSaat = (d: Date) =>
  new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  }).format(d);
const ayYil = (d: Date) =>
  new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' }).format(d);
const yuzde = (v: number | null) =>
  v === null ? '—' : `%${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(v * 100)}`;
const kacir = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );

interface Icerik {
  baslik: string;
  alt: string;
  bolumler: ReportSection[];
  /** E-postanın gövdesindeki kısa özet */
  ozet: string[];
  /** Excel eki (aylık rapor; yalnızca dışa aktarma yetkisi olana) */
  excel: ReportTable[] | null;
}

/**
 * Zamanlanmış raporlar (Karar 44; YonetimRapor.dc.html › zaman). Haftalık ve aylık rapor ile çalışanın eklediği
 * raporlar şirket e-postasına PDF ekiyle gider; alıcılar gönderim anında yeniden denetlenir (raporları görme yetkisi
 * "tam"). Galerilere "aranan modeller" raporu bildirim katmanından gider ve açılması toplu gönderim onayı ister.
 * Rapor ve zaman başına tek gönderim (`scheduled_report_runs` tekil dizini).
 */
@Injectable()
export class ScheduledReportService {
  private readonly log = new Logger(ScheduledReportService.name);

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    private readonly reports: ReportService,
    private readonly dashboard: DashboardService,
    private readonly approvals: ApprovalService,
    private readonly audit: AuditService,
    executor: ApprovalExecutor,
    @Optional() @Inject(EMAIL_SENDER) private readonly email?: EmailSender,
    @Optional() private readonly notifications?: NotificationService,
  ) {
    executor.register('BULK_SEND', (a, tx) => this.approved(a, tx), SUBJECT);
  }

  /** Hazır raporlar ilk kez görülünce varsayılan durumlarıyla yazılır */
  async ensureBuiltins() {
    await this.db.scheduledReport.createMany({
      data: BUILTIN_REPORT_KEYS.map((key) => {
        const b: BuiltinReport = BUILTIN_REPORTS[key];
        return {
          id: uuidv7(),
          key,
          name: b.ad,
          source: { tur: 'hazir' },
          frequency: b.siklik,
          time: b.saat,
          recipients: [],
          enabled: b.varsayilan,
        };
      }),
      skipDuplicates: true,
    });
  }

  /** Raporları görebilen etkin çalışanlar (ajan hariç) */
  private async uygunCalisanlar() {
    const staff = await this.db.staffMember.findMany({
      where: { status: 'ACTIVE', role: { not: 'AGENT' } },
      include: { customRole: true },
      orderBy: { createdAt: 'asc' },
    });
    return staff
      .map((s) => ({ s, g: grantsFor(s) }))
      .filter((x) => x.g['rapor.gor'] === 'tam')
      .map((x) => ({
        id: x.s.id,
        name: x.s.name,
        email: x.s.email,
        role: x.s.role,
        excel: x.g['rapor.disa_aktar'] === 'tam',
      }));
  }

  /** Çalışan raporunun alıcıları: hazırlarda role göre, yenilerde seçilenlerden hâlâ yetkisi olanlar */
  private async alicilar(r: ScheduledReport) {
    const uygun = await this.uygunCalisanlar();
    if (r.key) {
      const roller = (BUILTIN_REPORTS as Record<string, BuiltinReport>)[r.key]?.roller ?? [];
      return uygun.filter((s) => (roller as readonly string[]).includes(s.role));
    }
    return uygun.filter((s) => r.recipients.includes(s.id));
  }

  /** Ücretli galeriler: aboneliği süren (yenileme ödemesi bekleyen dahil) */
  private async ucretliGaleriler() {
    const subs = await this.db.subscription.findMany({
      where: { status: { in: ['ACTIVE', 'PAST_DUE'] } },
      select: { accountId: true },
    });
    if (!subs.length) return [];
    return this.db.gallery.findMany({
      where: { accountId: { in: subs.map((s) => s.accountId) } },
      select: { accountId: true, displayName: true, il: true },
    });
  }

  private yetki(actor: StaffActor, r: ScheduledReport, acmak: boolean) {
    if (r.key === 'galeri') {
      // Açmak toplu gönderim isteğidir; kapatmayı yönetici de yapabilir
      const gonderim = satisfies(actor.grants.toplu_gonderim, 'oneri');
      if (!gonderim && (acmak || !satisfies(actor.grants['sistem.ayarla'], 'tam')))
        throw new ForbiddenException('Galeri raporu toplu gönderimdir; toplu gönderim yetkisi gerekir');
      return;
    }
    if (r.key) {
      if (!satisfies(actor.grants['sistem.ayarla'], 'tam'))
        throw new ForbiddenException('Hazır raporları sahip ve yönetici açıp kapatır');
      return;
    }
    if (r.createdBy !== actor.staff.id && !satisfies(actor.grants['sistem.ayarla'], 'tam'))
      throw new ForbiddenException('Bu raporu ekleyen çalışan ya da yönetici değiştirebilir');
  }

  // ── Konsol ─────────────────────────────────────────────────

  private async panoNotlari() {
    const [views, kategoriler, staff] = await Promise.all([
      this.db.reportView.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
      this.db.category.findMany({ select: { slug: true, name: true } }),
      this.db.staffMember.findMany({ select: { id: true, name: true } }),
    ]);
    const katAd = new Map(kategoriler.map((k) => [k.slug, k.name]));
    const kim = new Map(staff.map((s) => [s.id, s.name]));
    return views.map((v) => {
      const f = v.filter as ReportFilter;
      const parca = [
        REPORT_TABS.find((t) => t.key === v.tab)?.ad.toLocaleLowerCase('tr-TR') ?? v.tab,
        REPORT_RANGES.find((r) => r.key === f.tarih)?.ad.toLocaleLowerCase('tr-TR'),
        f.il,
        f.kategori ? (katAd.get(f.kategori) ?? f.kategori) : null,
        f.platform ? { WEB: 'web', IOS: 'iOS', ANDROID: 'Android' }[f.platform] : null,
        f.karsilastir === 'onceki' ? 'önceki dönemle' : null,
      ].filter(Boolean);
      return {
        id: v.id,
        staffId: v.staffId,
        ad: v.name,
        sekme: v.tab,
        sahip: kim.get(v.staffId) ?? 'Bir çalışan',
        not: parca.join(', '),
      };
    });
  }

  private izinli(actor: StaffActor, r: ScheduledReport, acmak: boolean) {
    try {
      this.yetki(actor, r, acmak);
      return true;
    } catch {
      return false;
    }
  }

  async list(actor: StaffActor, now = new Date()) {
    const viewer = actor.staff;
    await this.ensureBuiltins();
    const [rows, uygun, galeriler, panolar] = await Promise.all([
      this.db.scheduledReport.findMany({
        orderBy: { createdAt: 'asc' },
        include: { runs: { orderBy: { slot: 'desc' }, take: 1 } },
      }),
      this.uygunCalisanlar(),
      this.ucretliGaleriler(),
      this.panoNotlari(),
    ]);
    const ad = (s: { id: string; name: string }) => (s.id === viewer.id ? 'Sen' : kisaAd(s.name));
    const sirala = (adlar: string[]) => adlar.sort((a, b) => (a === 'Sen' ? -1 : b === 'Sen' ? 1 : 0));
    const sira = (r: ScheduledReport) =>
      r.key ? BUILTIN_REPORT_KEYS.indexOf(r.key as BuiltinReportKey) : 99;
    const bekleyen = new Set(
      (
        await this.db.approval.findMany({
          where: {
            status: 'PENDING',
            id: { in: rows.map((r) => r.approvalId).filter((x): x is string => Boolean(x)) },
          },
          select: { id: true },
        })
      ).map((a) => a.id),
    );
    const raporlar = [...rows]
      .sort((a, b) => sira(a) - sira(b) || a.createdAt.getTime() - b.createdAt.getTime())
      .map((r) => {
        const b = r.key ? (BUILTIN_REPORTS as Record<string, BuiltinReport>)[r.key] : null;
        const kaynak = r.source as ScheduledSource | { tur: 'hazir' };
        let alici: string;
        if (r.key === 'galeri') alici = `Tüm ücretli galeriler (${galeriler.length})`;
        else if (b) {
          const a = uygun.filter((s) => (b.roller as readonly string[]).includes(s.role)).map(ad);
          alici = a.length ? sirala(a).join(', ') : 'Alıcı yok';
        } else {
          const a = uygun.filter((s) => r.recipients.includes(s.id)).map(ad);
          alici = a.length ? sirala(a).join(', ') : 'Alıcı yok (yetkisi kalmadı)';
        }
        const kaynakAd =
          kaynak.tur === 'sekme'
            ? (REPORT_TABS.find((t) => t.key === kaynak.sekme)?.ad ?? kaynak.sekme)
            : kaynak.tur === 'pano'
              ? `Kayıtlı pano: ${panolar.find((p) => p.id === kaynak.panoId)?.ad ?? 'silinmiş'}`
              : null;
        const son = r.runs[0];
        const onay = r.approvalId && bekleyen.has(r.approvalId);
        return {
          id: r.id,
          key: r.key,
          ad: b?.ad ?? r.name,
          zaman: scheduleText(r.frequency as ReportFrequency, r.time),
          alici,
          bicim: b?.bicim ?? `E-posta (PDF) · ${kaynakAd}`,
          acik: r.enabled,
          durum: r.enabled ? 'Açık' : onay ? 'Onay bekliyor' : 'Kapalı',
          onayBekliyor: Boolean(onay),
          sonraki: r.enabled ? tarihSaat(nextSlot(r.frequency as ReportFrequency, r.time, now)) : null,
          son: son
            ? `${tarihSaat(son.slot)} · ${
                son.status === 'calisiyor'
                  ? 'gönderiliyor'
                  : son.status === 'hata'
                    ? `gönderilemedi${son.error ? `: ${son.error}` : ''}`
                    : `${son.sent}/${son.recipients} ${r.key === 'galeri' ? 'galeriye' : 'kişiye'} gitti`
              }`
            : null,
          silinebilir: !r.key && this.izinli(actor, r, false),
          degistirebilir: this.izinli(actor, r, !r.enabled) && !onay,
        };
      });
    return {
      raporlar,
      panolar: panolar.map((p) => ({
        id: p.id,
        ad: p.ad,
        not: `${p.staffId === viewer.id ? 'Sen' : kisaAd(p.sahip)} · ${p.not}`,
      })),
      // "Yeni zamanlanmış rapor" formu
      kaynaklar: [
        ...REPORT_TABS.map((t) => ({ kaynak: { tur: 'sekme', sekme: t.key }, ad: t.ad })),
        ...panolar.map((p) => ({ kaynak: { tur: 'pano', panoId: p.id }, ad: `Kayıtlı pano: ${p.ad}` })),
      ],
      calisanlar: sirala(uygun.map((s) => s.id)).map((id) => {
        const s = uygun.find((x) => x.id === id) as (typeof uygun)[number];
        return { id: s.id, ad: ad(s) };
      }),
    };
  }

  async create(actor: StaffActor, b: ScheduledReportInput, ip?: string) {
    const uygun = new Set((await this.uygunCalisanlar()).map((s) => s.id));
    const disarda = b.alicilar.filter((id) => !uygun.has(id));
    if (disarda.length)
      throw new BadRequestException('Alıcılar yalnızca raporları görebilen çalışanlar arasından seçilir');
    let ad: string;
    if (b.kaynak.tur === 'pano') {
      const v = await this.db.reportView.findUnique({ where: { id: b.kaynak.panoId } });
      if (!v) throw new NotFoundException('Kayıtlı pano bulunamadı');
      ad = v.name;
    } else {
      const sekme = b.kaynak.sekme;
      ad = REPORT_TABS.find((t) => t.key === sekme)?.ad ?? sekme;
    }
    const id = uuidv7();
    await this.db.$transaction(async (tx) => {
      await tx.scheduledReport.create({
        data: {
          id,
          name: ad,
          source: b.kaynak,
          frequency: b.siklik,
          time: b.saat,
          recipients: [...new Set(b.alicilar)],
          createdBy: actor.staff.id,
        },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: actor.staff.id,
          action: 'zamanli_rapor_eklendi',
          entityType: SUBJECT,
          entityId: id,
          after: { ad, siklik: b.siklik, saat: b.saat, alici: b.alicilar.length },
          ip,
        },
        tx,
      );
    });
    return this.list(actor);
  }

  /** Aç/kapat. Galeri raporunu açmak toplu gönderim onayı ister; kapatmak hemen olur. */
  async setEnabled(actor: StaffActor, id: string, acik: boolean, ip?: string) {
    const r = await this.db.scheduledReport.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Rapor bulunamadı');
    this.yetki(actor, r, acik);
    if (r.enabled === acik) return this.list(actor);
    await this.db.$transaction(async (tx) => {
      if (r.key === 'galeri' && acik) {
        if (r.approvalId) {
          const a = await tx.approval.findUnique({ where: { id: r.approvalId } });
          if (a?.status === 'PENDING') throw new ConflictException('Açma isteği zaten onay bekliyor');
        }
        const n = (await this.ucretliGaleriler()).length;
        const a = await this.approvals.request(
          actor,
          {
            kind: 'BULK_SEND',
            subjectType: SUBJECT,
            subjectId: r.id,
            title: `Galerilere aylık “aranan modeller” raporu · ${n} galeri`,
            reason: `${scheduleText(r.frequency as ReportFrequency, r.time)} · ücretli galerilerin sahip ve yöneticilerine e-posta ve bildirim`,
            payload: { rapor: r.id, galeri: n },
          },
          tx,
          ip,
        );
        await tx.scheduledReport.update({ where: { id }, data: { approvalId: a.id } });
      } else {
        await tx.scheduledReport.update({ where: { id }, data: { enabled: acik } });
      }
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: actor.staff.id,
          action: r.key === 'galeri' && acik ? 'zamanli_rapor_onay_istendi' : 'zamanli_rapor_degisti',
          entityType: SUBJECT,
          entityId: id,
          before: { acik: r.enabled },
          after: { acik },
          ip,
        },
        tx,
      );
    });
    // Kapatılan galeri raporunun bekleyen açma isteği düşer
    if (!acik && r.approvalId) await this.approvals.cancel(actor, r.approvalId, ip).catch(() => undefined);
    return this.list(actor);
  }

  async remove(actor: StaffActor, id: string, ip?: string) {
    const r = await this.db.scheduledReport.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Rapor bulunamadı');
    if (r.key) throw new BadRequestException('Hazır raporlar silinmez; kapatılabilir');
    this.yetki(actor, r, false);
    await this.db.$transaction(async (tx) => {
      await tx.scheduledReport.delete({ where: { id } });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: actor.staff.id,
          action: 'zamanli_rapor_silindi',
          entityType: SUBJECT,
          entityId: id,
          before: { ad: r.name },
          ip,
        },
        tx,
      );
    });
    return this.list(actor);
  }

  /** Onaylanan toplu gönderim: galeri raporu açılır (işçi, onay yürütücüsü) */
  async approved(a: Approval, tx: Tx): Promise<Prisma.InputJsonValue> {
    if (a.subjectType !== SUBJECT) throw new Error('Zamanlanmış rapor onayı değil');
    const k = await tx.scheduledReport.updateMany({
      where: { id: a.subjectId, approvalId: a.id, enabled: false },
      data: { enabled: true },
    });
    return { durum: k.count ? 'acildi' : 'zaten_acik' };
  }

  // ── Gönderim (işçi) ────────────────────────────────────────

  /** Zamanı gelen raporlar (işçi, dakikada bir) */
  async dispatchDue(now = new Date()) {
    await this.ensureBuiltins();
    const rows = await this.db.scheduledReport.findMany({ where: { enabled: true } });
    let n = 0;
    for (const r of rows) {
      const slot = lastSlot(r.frequency as ReportFrequency, r.time, now);
      // Rapor eklendikten ya da açıldıktan sonraki ilk zaman; çok gecikmişse atlanır
      const taban = Math.max(r.createdAt.getTime(), r.updatedAt.getTime(), r.lastRunAt?.getTime() ?? 0);
      if (slot.getTime() <= taban || now.getTime() - slot.getTime() > GEC_SINIR) continue;
      if (await this.run(r, slot, now)) n++;
    }
    return n;
  }

  /** Raporu bir kez gönderir; aynı zaman için ikinci kez çalışmaz */
  async run(r: ScheduledReport, slot: Date, now = new Date()) {
    const runId = uuidv7();
    try {
      await this.db.scheduledReportRun.create({ data: { id: runId, reportId: r.id, slot } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return false;
      throw e;
    }
    await this.db.scheduledReport.update({ where: { id: r.id }, data: { lastRunAt: now } });
    try {
      const sonuc = r.key === 'galeri' ? await this.galeriRaporu(now) : await this.calisanRaporu(r, now);
      await this.db.scheduledReportRun.update({
        where: { id: runId },
        data: {
          status: sonuc.hata && !sonuc.sent ? 'hata' : 'tamam',
          recipients: sonuc.recipients,
          sent: sonuc.sent,
          error: sonuc.hata,
          finishedAt: new Date(),
        },
      });
    } catch (e) {
      this.log.error(`zamanlanmış rapor ${r.id}: ${(e as Error).message}`);
      await this.db.scheduledReportRun.update({
        where: { id: runId },
        data: { status: 'hata', error: (e as Error).message.slice(0, 300), finishedAt: new Date() },
      });
    }
    return true;
  }

  private async calisanRaporu(r: ScheduledReport, now: Date) {
    const alicilar = await this.alicilar(r);
    if (!alicilar.length) return { recipients: 0, sent: 0, hata: 'Alıcı yok' };
    if (!this.email || this.email.ad === 'none')
      return { recipients: alicilar.length, sent: 0, hata: 'E-posta kanalı kapalı' };
    const ic = await this.icerik(r, now);
    const pdf = await reportPdf(ic);
    const gun = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(now);
    const dosya = `rengarenk-${(r.key ?? 'rapor').replace(/[^a-z0-9-]/g, '')}-${gun}`;
    const csv = ic.excel?.length ? reportCsv(ic.excel) : null;
    const url = `${this.env.ADMIN_ORIGIN}/raporlar`;
    let sent = 0;
    let hata: string | null = null;
    for (const s of alicilar) {
      const ekler = [
        { filename: `${dosya}.pdf`, content: pdf, contentType: 'application/pdf' },
        ...(csv && s.excel
          ? [{ filename: `${dosya}.csv`, content: csv, contentType: 'text/csv; charset=utf-8' }]
          : []),
      ];
      const res = await this.email.send({
        to: s.email,
        from: this.env.EPOSTA_GONDEREN,
        subject: `Rengarenk yönetim · ${ic.baslik} · ${ic.alt}`,
        text: `${ic.ozet.join('\n')}\n\nRaporun tamamı ekteki PDF’te${csv && s.excel ? ' (Excel dosyası da ekte)' : ''}. Konsolda aç: ${url}\n\nBu e-posta Rengarenk yönetim konsolunun zamanlanmış raporudur; kişisel veri içermez.`,
        html: `<p style="font:800 17px/1.4 system-ui,sans-serif;color:#1E2333">${kacir(ic.baslik)}</p><p style="font:14px/1.5 system-ui,sans-serif;color:#5A6073">${kacir(ic.alt)}</p><ul style="font:14px/1.6 system-ui,sans-serif;color:#1E2333">${ic.ozet.map((o) => `<li>${kacir(o)}</li>`).join('')}</ul><p style="font:14px/1.5 system-ui,sans-serif;color:#3A4052">Raporun tamamı ekteki PDF’te${csv && s.excel ? ' (Excel dosyası da ekte)' : ''}.</p><p><a href="${kacir(url)}" style="font:600 14px system-ui,sans-serif;color:#2450C8">Konsolda aç</a></p><p style="font:12px system-ui,sans-serif;color:#5A6073">Bu e-posta Rengarenk yönetim konsolunun zamanlanmış raporudur; kişisel veri içermez.</p>`,
        attachments: ekler,
      });
      if (res.status === 'sent') sent++;
      else hata = res.message ?? 'gönderilemedi';
    }
    return { recipients: alicilar.length, sent, hata };
  }

  /** Raporun içeriği: hazır raporlar kendi bölümleriyle, yenileri sekme ya da kayıtlı panodan */
  async icerik(r: ScheduledReport, now = new Date()): Promise<Icerik> {
    const hazirlandi = `hazırlandı ${tarihSaat(now)}`;
    if (r.key === 'haftalik') {
      const [olcumler, ana, huni, hedef, reklam, deney] = await Promise.all([
        this.dashboard.olcumler('hafta', now),
        this.dashboard.anaOzet(now),
        this.reports.report('huni', { tarih: '7', karsilastir: 'onceki' }, now),
        this.dashboard.hedefler(trAy(now), now),
        this.reports.report('reklam', { tarih: '7', karsilastir: 'onceki' }, now),
        this.reports.report('deney', { tarih: '7', karsilastir: 'onceki' }, now),
      ]);
      const anaSatir: (string | number | null)[] = [
        'Ana ölçü (48 saatte ilk mesaj alan talep, son 30 gün)',
        yuzde(ana.oran),
        yuzde(ana.once),
        ana.oran !== null && ana.once !== null
          ? `${Math.round((ana.oran - ana.once) * 100) >= 0 ? '+' : ''}${Math.round((ana.oran - ana.once) * 100)} puan`
          : '—',
      ];
      const bolumler: ReportSection[] = [
        {
          baslik: 'Ana ölçü ve ölçüler · son 7 gün',
          kolonlar: ['Ölçü', 'Son 7 gün', 'Önceki 7 gün', 'Değişim'],
          satirlar: [
            anaSatir,
            ...olcumler.map((o) => [
              o.ad,
              o.yazi,
              o.key === 'gelir'
                ? tlYaz(Math.round(o.onceki * 100))
                : new Intl.NumberFormat('tr-TR').format(o.onceki),
              o.fark.metin,
            ]),
          ],
        },
        ...this.reports.tablolar('huni', huni as Record<string, unknown>),
        {
          baslik: `Aylık hedefler · ${ayYil(now)}`,
          kolonlar: ['Hedef', 'Gerçekleşen', 'Hedef', 'Durum', 'Not'],
          satirlar: hedef.satirlar.map((h) => [
            h.ad,
            h.mevcut,
            h.hedef,
            'durumAd' in h ? (h.durumAd as string) : 'Hedef girilmedi',
            'not' in h ? (h.not as string) : null,
          ]),
        },
        { baslik: 'Reklam ve edinim', metin: String((reklam as { bos?: string }).bos ?? '') },
        { baslik: 'Deneyler', metin: String((deney as { bos?: string }).bos ?? '') },
      ];
      const talep = olcumler.find((o) => o.key === 'talep');
      return {
        baslik: 'Haftalık rapor',
        alt: `Son 7 gün · ${hazirlandi}`,
        bolumler,
        ozet: [
          `Ana ölçü: ${yuzde(ana.oran)} (önceki 30 gün ${yuzde(ana.once)})`,
          ...(talep ? [`Yeni talep: ${talep.yazi} (${talep.fark.metin})`] : []),
          String((huni as { yorum?: string }).yorum ?? ''),
        ].filter(Boolean),
        excel: null,
      };
    }
    if (r.key === 'aylik') {
      const f: ReportFilter = { tarih: 'gecen_ay', karsilastir: 'onceki' };
      const [gelir, birim] = await Promise.all([
        this.reports.report('gelir', f, now),
        this.reports.report('birim', f, now),
      ]);
      const tablolar = [
        ...this.reports.tablolar('gelir', gelir as Record<string, unknown>),
        ...this.reports.tablolar('birim', birim as Record<string, unknown>),
      ];
      const sayilar = (gelir as { sayilar: { ad: string; deger: string }[] }).sayilar;
      return {
        baslik: 'Aylık rapor',
        alt: `${String((gelir as { donem: string }).donem)} · ${hazirlandi}`,
        bolumler: tablolar,
        ozet: sayilar.slice(0, 3).map((s) => `${s.ad}: ${s.deger}`),
        excel: tablolar,
      };
    }
    // Çalışanın eklediği rapor: sekme ya da kayıtlı pano
    const kaynak = r.source as ScheduledSource;
    let tab: ReportTab;
    let filtre: ReportFilter;
    if (kaynak.tur === 'pano') {
      const v = await this.db.reportView.findUnique({ where: { id: kaynak.panoId } });
      if (!v) throw new Error('Kayıtlı pano silinmiş');
      tab = v.tab as ReportTab;
      filtre = v.filter as ReportFilter;
    } else {
      tab = kaynak.sekme;
      filtre = {
        tarih: r.frequency.startsWith('ay:') ? 'gecen_ay' : '7',
        karsilastir: 'onceki',
      };
    }
    const veri = (await this.reports.report(tab, filtre, now)) as Record<string, unknown>;
    const tablolar = this.reports.tablolar(tab, veri);
    const sekmeAd = REPORT_TABS.find((t) => t.key === tab)?.ad ?? tab;
    const yorum = typeof veri.yorum === 'string' ? veri.yorum : null;
    return {
      baslik: r.name,
      alt: `${sekmeAd} · ${String(veri.donem)}${filtre.il ? ` · ${filtre.il}` : ''} · ${hazirlandi}`,
      bolumler: tablolar.length ? tablolar : [{ baslik: sekmeAd, metin: String(veri.bos ?? '') }],
      ozet: [yorum ?? (tablolar.length ? `${sekmeAd} raporu ekte.` : String(veri.bos ?? ''))],
      excel: null,
    };
  }

  // ── Galerilere "aranan modeller" raporu ───────────────────────

  /**
   * Ücretli galeri başına: galerinin ilinde son 30 günde en çok talep edilen modeller (ilde yeterli talep yoksa Türkiye
   * geneli), galerinin portföyündeki araç sayısı ve ajanın kural tabanlı önerisi. Kişisel veri yok: yalnızca sayılar.
   */
  async galeriModelleri(now = new Date()) {
    const galeriler = await this.ucretliGaleriler();
    if (!galeriler.length) return [];
    const talepler = await this.db.demand.findMany({
      where: { publishedAt: { gte: new Date(now.getTime() - 30 * DAY), lt: now } },
      select: { il: true, data: true },
    });
    const genel = new Map<string, number>();
    const ilde = new Map<string, Map<string, number>>();
    for (const d of talepler) {
      const m = (d.data as { alanlar?: { model?: { make?: string; series?: string } } })?.alanlar?.model;
      const key = m?.series;
      if (!key) continue;
      genel.set(key, (genel.get(key) ?? 0) + 1);
      if (!d.il) continue;
      const x = ilde.get(d.il) ?? new Map<string, number>();
      x.set(key, (x.get(key) ?? 0) + 1);
      ilde.set(d.il, x);
    }
    const ilk = (m: Map<string, number>) =>
      [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, GALLERY_REPORT_MODELS);
    const keys = new Set<string>();
    const secim = galeriler.map((g) => {
      const il = ilde.get(g.il);
      const toplam = il ? [...il.values()].reduce((t, v) => t + v, 0) : 0;
      const yerel = toplam >= GALLERY_REPORT_MIN_DEMANDS;
      const liste = ilk(yerel && il ? il : genel);
      for (const [k] of liste) keys.add(k);
      return { g, yerel, liste };
    });
    const [seriler, portfoy] = await Promise.all([
      this.db.catalogSeries.findMany({
        where: { key: { in: [...keys] } },
        select: { key: true, name: true, make: { select: { name: true } } },
      }),
      this.db.portfolioVehicle.groupBy({
        by: ['accountId', 'seriesKey'],
        where: {
          status: 'PUBLISHED',
          seriesKey: { in: [...keys] },
          accountId: { in: galeriler.map((g) => g.accountId) },
        },
        _count: true,
      }),
    ]);
    const ad = new Map(seriler.map((s) => [s.key, `${s.make.name} ${s.name}`]));
    const elde = new Map(portfoy.map((p) => [`${p.accountId}|${p.seriesKey}`, p._count]));
    return secim
      .filter((s) => s.liste.length > 0)
      .map(({ g, yerel, liste }) => {
        const bolge = yerel ? ekle(g.il, 'bulunma') : 'Türkiye genelinde';
        const modeller = liste.map(([key, n], i) => {
          const arac = elde.get(`${g.accountId}|${key}`) ?? 0;
          return { sira: i + 1, ad: ad.get(key) ?? key, talep: n, arac };
        });
        const eksik = modeller.find((m) => m.arac === 0 && m.talep >= 2);
        return {
          accountId: g.accountId,
          galeri: g.displayName,
          bolge,
          modeller,
          oneri: eksik
            ? `${eksik.ad} için ${bolge} son 30 günde ${eksik.talep} talep açıldı; portföyünde yok. Bu modelden araç eklersen talep sahipleriyle eşleşirsin.`
            : 'En çok aranan modellerin portföyünde var; fiyat ve fotoğrafları güncel tutmak eşleşmeleri artırır.',
        };
      });
  }

  private async galeriRaporu(now: Date) {
    if (!this.notifications) return { recipients: 0, sent: 0, hata: 'Bildirim katmanı yok' };
    const liste = await this.galeriModelleri(now);
    let sent = 0;
    for (const r of liste) {
      const ekip = await this.db.accountMember.findMany({
        where: { accountId: r.accountId, role: { in: ['OWNER', 'MANAGER'] } },
        select: { userId: true },
      });
      const n = await this.notifications.notify({
        userIds: ekip.map((m) => m.userId),
        sablon: 'galeri.aranan_modeller',
        veri: {
          galeri: r.galeri,
          bolge: r.bolge,
          ay: ayYil(now),
          ilkModel: r.modeller[0]?.ad ?? '',
          modeller: r.modeller.map(
            (m) => `${m.ad} (${m.talep} talep, ${m.arac ? `portföyünde ${m.arac} araç` : 'portföyünde yok'})`,
          ),
          oneri: r.oneri,
        },
      });
      if (n) sent++;
    }
    return { recipients: liste.length, sent, hata: null };
  }
}
