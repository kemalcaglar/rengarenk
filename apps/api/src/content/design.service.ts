import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
  Optional,
} from '@nestjs/common';
import { type Approval, type Prisma, uuidv7 } from '@rengarenk/db';
import {
  activeTheme,
  applyDesignColors,
  colorNote,
  DEFAULT_DESIGN,
  DESIGN_COLOR_GROUPS,
  DESIGN_COLOR_KEYS,
  DESIGN_COLORS,
  type DesignTokens,
  designProblems,
  designTokensSchema,
  designWarnings,
  FONT_TYPES,
  FONTS,
  fontCssUrl,
  type PublicDesign,
  themeStatus,
} from '@rengarenk/shared';
import { type Actor, ApprovalService } from '../approvals/approval.service.js';
import { ApprovalExecutor } from '../approvals/approval-executor.js';
import { AuditService } from '../audit/audit.service.js';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';

const SUBJECT = 'design_version';
const tarih = (d: Date) =>
  new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Istanbul',
  }).format(d);
const gun = (s: string) =>
  new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${s}T00:00:00Z`));

/**
 * Tasarım değerleri (Karar 46; YonetimIcerik.dc.html › Tasarım değerleri). Yayındaki sürüm web (CSS değişkenleri ve
 * yazı tipi), mobil (açılışta) ve e-posta (gönderimde) tarafından okunur. Taslak, sahip ya da yönetici onayıyla
 * (DESIGN_TOKENS) yayına girer; yayınlanan sürüm değişmez (RR043). Okunmayan renk birleşimi onaya gönderilemez.
 */
@Injectable()
export class DesignService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(DesignService.name);
  private onbellek: {
    at: number;
    surum: number;
    degerler: DesignTokens;
    id: string | null;
    dosyalar: Record<string, string>;
  } | null = null;
  private zamanlayici?: NodeJS.Timeout;

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly audit: AuditService,
    @Optional() private readonly approvals?: ApprovalService,
    @Optional() private readonly executor?: ApprovalExecutor,
  ) {}

  onModuleInit() {
    this.executor?.register('DESIGN_TOKENS', (a, tx) => this.publishApproved(a, tx), SUBJECT);
    // E-posta ve sunucuda çizilen içerik için ortak renkler yayındaki değerlere geçer (dakikada bir tazelenir)
    void this.uygula();
    this.zamanlayici = setInterval(() => void this.uygula(), 60_000);
    this.zamanlayici.unref();
  }

  onModuleDestroy() {
    if (this.zamanlayici) clearInterval(this.zamanlayici);
  }

  async uygula() {
    try {
      applyDesignColors((await this.aktif()).degerler);
    } catch (e) {
      this.log.warn(`tasarım değerleri uygulanamadı: ${(e as Error).message}`);
    }
  }

  /** Yayındaki sürüm (30 sn önbellek); hiç yayın yoksa varsayılan, sürüm 0 */
  async aktif() {
    if (this.onbellek && Date.now() - this.onbellek.at < 30_000) return this.onbellek;
    const v = await this.db.designVersion.findFirst({ where: { status: 'yayinda' } });
    const p = v ? designTokensSchema.safeParse(v.tokens) : null;
    this.onbellek = {
      at: Date.now(),
      surum: v && p?.success ? v.version : 0,
      degerler: p?.success ? p.data : DEFAULT_DESIGN,
      id: v?.id ?? null,
      dosyalar: (v?.fontFiles as Record<string, string> | null) ?? {},
    };
    return this.onbellek;
  }

  /**
   * Mobil yazı tipi dosyaları: Google Fonts CSS'i eski tarayıcı kimliğiyle istenince TTF adresleri döner (React Native
   * TTF yükler). Bir kez çözülüp sürüme yazılır; çözülemezse mobil varsayılan yazı tipiyle açılır.
   */
  private async dosyalar(ad: string): Promise<Record<string, string>> {
    try {
      const r = await fetch(fontCssUrl(ad), {
        headers: { 'user-agent': 'Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)' },
        signal: AbortSignal.timeout(4000),
      });
      if (!r.ok) return {};
      const css = await r.text();
      const out: Record<string, string> = {};
      for (const blok of css.split('@font-face').slice(1)) {
        const w = /font-weight:\s*(\d+)/.exec(blok)?.[1];
        const u = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/.exec(blok)?.[1];
        if (w && u && !out[w]) out[w] = u;
      }
      return out;
    } catch {
      return {};
    }
  }

  async publicDesign(now = new Date()): Promise<PublicDesign> {
    const a = await this.aktif();
    if (a.id && !Object.keys(a.dosyalar).length && a.degerler.yaziTipi !== DEFAULT_DESIGN.yaziTipi) {
      const d = await this.dosyalar(a.degerler.yaziTipi);
      if (Object.keys(d).length) {
        await this.db.designVersion.update({ where: { id: a.id }, data: { fontFiles: d } });
        a.dosyalar = d;
      }
    }
    return {
      surum: a.surum,
      degerler: a.degerler,
      tema: activeTheme(a.degerler, now),
      font: { ad: a.degerler.yaziTipi, css: fontCssUrl(a.degerler.yaziTipi), dosyalar: a.dosyalar },
    };
  }

  // ── Konsol ─────────────────────────────────────────────────

  private async bekleyen(id: string | null) {
    if (!id) return false;
    return Boolean(
      await this.db.approval.findFirst({ where: { id, status: 'PENDING' }, select: { id: true } }),
    );
  }

  async staffView(now = new Date()) {
    const a = await this.aktif();
    const t = await this.db.designVersion.findFirst({
      where: { status: 'taslak' },
      orderBy: { version: 'desc' },
    });
    const taslak = t && t.version > a.surum ? t : null;
    const tp = taslak ? designTokensSchema.safeParse(taslak.tokens) : null;
    const goster = tp?.success ? tp.data : a.degerler;
    const yayin = a.id ? await this.db.designVersion.findUnique({ where: { id: a.id } }) : null;
    return {
      yayinda: {
        surum: a.surum,
        degerler: a.degerler,
        tarih: yayin?.publishedAt ? tarih(yayin.publishedAt) : null,
      },
      taslak: taslak
        ? {
            surum: taslak.version,
            degerler: goster,
            not: taslak.changeNote,
            onayda: await this.bekleyen(taslak.approvalId),
          }
        : null,
      renkler: DESIGN_COLOR_KEYS.map((k) => ({
        key: k,
        ad: DESIGN_COLORS[k].ad,
        not: colorNote(k, goster),
        grup: DESIGN_COLOR_GROUPS[DESIGN_COLORS[k].grup],
      })),
      fontlar: FONTS.map((f) => ({ ...f, turAd: FONT_TYPES[f.tur] })),
      temalar: goster.temalar.map((th) => ({
        ...th,
        tarihler: `${gun(th.baslangic)} – ${gun(th.bitis)}`,
        durum: taslak && !a.degerler.temalar.some((x) => x.id === th.id) ? 'Taslak' : themeStatus(th, now),
      })),
      sorunlar: designProblems(goster),
      uyarilar: designWarnings(goster),
    };
  }

  /** Taslak kaydı: onaydaki taslak düzenlenince yeni sürüm açılır */
  async saveDraft(actor: Actor, degerler: DesignTokens, not: string | undefined, ip?: string) {
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('rr_tasarim'))`;
      const son = await tx.designVersion.findFirst({ orderBy: { version: 'desc' } });
      const yerinde = son?.status === 'taslak' && !(await this.bekleyen(son.approvalId));
      let version: number;
      if (yerinde && son) {
        await tx.designVersion.update({
          where: { id: son.id },
          data: {
            tokens: degerler as unknown as Prisma.InputJsonValue,
            changeNote: not ?? null,
            approvalId: null,
          },
        });
        version = son.version;
      } else {
        version = (son?.version ?? 0) + 1;
        await tx.designVersion.create({
          data: {
            id: uuidv7(),
            version,
            tokens: degerler as unknown as Prisma.InputJsonValue,
            changeNote: not ?? null,
            createdBy: actor.staff.id,
          },
        });
      }
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: actor.staff.id,
          action: 'tasarim_taslak_kaydedildi',
          entityType: 'design_version',
          entityId: String(version),
          after: { yaziTipi: degerler.yaziTipi, tema: degerler.temalar.length },
          ip,
        },
        tx,
      );
      return { surum: version };
    });
  }

  /** Değişiklik listesi (onay isteğinde ve sürüm notunda) */
  degisiklikler(once: DesignTokens, sonra: DesignTokens): string[] {
    const out: string[] = [];
    for (const k of DESIGN_COLOR_KEYS)
      if (once.renkler[k] !== sonra.renkler[k])
        out.push(`${DESIGN_COLORS[k].ad}: ${once.renkler[k]} → ${sonra.renkler[k]}`);
    if (once.yaziTipi !== sonra.yaziTipi) out.push(`Yazı tipi: ${once.yaziTipi} → ${sonra.yaziTipi}`);
    if (once.kartKose !== sonra.kartKose) out.push(`Kart köşesi: ${once.kartKose} → ${sonra.kartKose} px`);
    if (once.butonKose !== sonra.butonKose)
      out.push(`Buton köşesi: ${once.butonKose} → ${sonra.butonKose} px`);
    if (once.etiketKose !== sonra.etiketKose)
      out.push(`Etiket köşesi: ${once.etiketKose} → ${sonra.etiketKose} px`);
    for (const th of sonra.temalar) {
      const o = once.temalar.find((x) => x.id === th.id);
      if (!o) out.push(`Tema eklendi: ${th.ad} (${th.baslangic} – ${th.bitis})`);
      else if (JSON.stringify(o) !== JSON.stringify(th)) out.push(`Tema değişti: ${th.ad}`);
    }
    for (const o of once.temalar)
      if (!sonra.temalar.some((x) => x.id === o.id)) out.push(`Tema kaldırıldı: ${o.ad}`);
    return out;
  }

  /** Onaya gönderilmiş taslağı geri çeker (yalnızca gönderen); taslak aynı sürümle düzenlenmeye devam eder */
  async geriCek(actor: Actor, ip?: string) {
    if (!this.approvals) throw new ConflictException('Onay motoru yok');
    const t = await this.db.designVersion.findFirst({
      where: { status: 'taslak' },
      orderBy: { version: 'desc' },
    });
    if (!t?.approvalId || !(await this.bekleyen(t.approvalId)))
      throw new ConflictException('Onay bekleyen tasarım yok');
    await this.approvals.cancel(actor, t.approvalId, ip);
    return { surum: t.version };
  }

  async submit(actor: Actor, ip?: string) {
    if (!this.approvals) throw new ConflictException('Onay motoru yok');
    const approvals = this.approvals;
    const a = await this.aktif();
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('rr_tasarim'))`;
      const t = await tx.designVersion.findFirst({
        where: { status: 'taslak' },
        orderBy: { version: 'desc' },
      });
      if (!t || t.version <= a.surum) throw new BadRequestException('Gönderilecek taslak yok');
      if (await this.bekleyen(t.approvalId)) throw new ConflictException('Taslak zaten onayda');
      const degerler = designTokensSchema.parse(t.tokens);
      const sorun = designProblems(degerler);
      if (sorun.length) throw new BadRequestException(sorun[0]);
      const liste = this.degisiklikler(a.degerler, degerler);
      if (!liste.length) throw new BadRequestException('Yayındaki değerlerle aynı');
      const approval = await approvals.request(
        actor,
        {
          kind: 'DESIGN_TOKENS',
          subjectType: SUBJECT,
          subjectId: t.id,
          title: `Tasarım değerleri s.${t.version}`,
          reason: [t.changeNote, liste.slice(0, 10).join(' · ')].filter(Boolean).join(' · ').slice(0, 1000),
          payload: { surum: t.version, degisiklikler: liste },
        },
        tx,
        ip,
      );
      await tx.designVersion.update({ where: { id: t.id }, data: { approvalId: approval.id } });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: actor.staff.id,
          action: 'tasarim_onaya_gonderildi',
          entityType: 'design_version',
          entityId: String(t.version),
          after: { onay: approval.id, degisiklik: liste.length },
          ip,
        },
        tx,
      );
      return { surum: t.version, approvalId: approval.id, degisiklikler: liste };
    });
  }

  /** Onaylanan sürümü yayına alır (onay yürütücüsü, işçi). Önceki yayın "eski" olur. */
  async publishApproved(a: Approval, tx: Tx): Promise<Prisma.InputJsonValue> {
    if (a.subjectType !== SUBJECT) throw new Error('Tasarım onayı değil');
    const t = await tx.designVersion.findUnique({ where: { id: a.subjectId } });
    if (!t) throw new Error('Tasarım sürümü bulunamadı');
    if (t.status === 'yayinda' && t.approvalId === a.id) return { surum: t.version, durum: 'zaten_yayinda' };
    if (t.status !== 'taslak' || t.approvalId !== a.id) throw new Error('Taslak bu onayı beklemiyor');
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('rr_tasarim'))`;
    await tx.designVersion.updateMany({ where: { status: 'yayinda' }, data: { status: 'eski' } });
    await tx.designVersion.update({
      where: { id: t.id },
      data: { status: 'yayinda', publishedAt: new Date(), publishedBy: a.decidedBy },
    });
    await this.audit.record(
      {
        actorType: 'STAFF',
        actorId: a.decidedBy ?? a.requestedBy,
        action: 'tasarim_yayinlandi',
        entityType: 'design_version',
        entityId: String(t.version),
        after: { onay: a.id },
      },
      tx,
    );
    this.onbellek = null;
    return { surum: t.version };
  }
}
