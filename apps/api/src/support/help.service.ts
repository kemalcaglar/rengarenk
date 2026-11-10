import { createHash } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
  Optional,
} from '@nestjs/common';
import { uuidv7 } from '@rengarenk/db';
import {
  HELP_TOPICS,
  type HelpArticleInput,
  type PublicHelpTopic,
  SUPPORT_TOPICS,
  type SupportTopic,
  suggestAnswer,
} from '@rengarenk/shared';
import type { Redis } from 'ioredis';
import { AgentService } from '../agent/agent.service.js';
import { AiGateway } from '../ai/ai-gateway.service.js';
import type { Actor } from '../approvals/approval.service.js';
import { AuditService } from '../audit/audit.service.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { REDIS } from '../redis/redis.module.js';

const DAY = 86_400_000;
const tarih = (d: Date) =>
  new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', timeZone: 'Europe/Istanbul' }).format(d);
/** Destek konusunun yardım merkezindeki karşılığı */
const DESTEK_YARDIM: Record<SupportTopic, string> = {
  odeme: 'hak',
  talep: 'talep',
  dolandiricilik: 'guven',
  hesap: 'hesap',
  diger: 'talep',
};
const konuAd = (k: string) => HELP_TOPICS.find((t) => t.key === k)?.ad ?? k;

/**
 * Yardım makaleleri (Karar 46, 54; YonetimIcerik.dc.html › Yardım makaleleri, Yardim.dc.html). Yardım merkezi, ana
 * sayfadaki sık sorulanlar, destek sohbetindeki öneri ve ajanın destek yanıtı yayındaki makaleleri kullanır. Okunma ve
 * "işine yaradı mı" yanıtı sayaçtır; kişi ya da IP saklanmaz (aynı ziyaretçinin tekrarı günlük özetle elenir).
 */
@Injectable()
export class HelpService implements OnModuleInit {
  private readonly log = new Logger(HelpService.name);
  private onbellek: { at: number; adaylar: [string, string][] } | null = null;

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly audit: AuditService,
    @Optional() @Inject(REDIS) private readonly redis?: Redis,
    @Optional() private readonly ai?: AiGateway,
    @Optional() private readonly agent?: AgentService,
  ) {}

  /** İlk kurulum: makale yoksa koddaki sık sorulanlar yayındaki makale olarak aktarılır (API ve işçi aynı anda açılabilir) */
  async onModuleInit() {
    try {
      await this.kur();
    } catch (e) {
      this.log.warn(`yardım makaleleri kurulamadı: ${(e as Error).message}`);
    }
  }

  async kur() {
    if (await this.db.helpArticle.count()) return 0;
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('rr_yardim_kurulum'))`;
      if (await tx.helpArticle.count()) return 0;
      const now = new Date();
      const rows = HELP_TOPICS.flatMap((t) =>
        t.sorular.map(([soru, cevap], i) => ({
          id: uuidv7(),
          topic: t.key,
          title: soru,
          body: cevap,
          status: 'yayinda',
          sort: i,
          source: 'kurulum',
          publishedAt: now,
        })),
      );
      await tx.helpArticle.createMany({ data: rows });
      return rows.length;
    });
  }

  // ── Herkese açık ──────────────────────────────────────────────

  async publicTopics(): Promise<PublicHelpTopic[]> {
    const list = await this.db.helpArticle.findMany({
      where: { status: 'yayinda' },
      orderBy: [{ sort: 'asc' }, { publishedAt: 'asc' }],
      select: { id: true, topic: true, title: true, body: true },
    });
    return HELP_TOPICS.map((t) => ({
      key: t.key,
      ad: t.ad,
      not: t.not,
      renk: t.renk,
      makaleler: list
        .filter((a) => a.topic === t.key)
        .map((a) => ({ id: a.id, soru: a.title, cevap: a.body })),
    }));
  }

  /** Destek önerisi ve ajan yanıtı için yayındaki makaleler (1 dakika önbellekte) */
  async adaylar(): Promise<[string, string][]> {
    if (this.onbellek && Date.now() - this.onbellek.at < 60_000) return this.onbellek.adaylar;
    const list = await this.db.helpArticle.findMany({
      where: { status: 'yayinda' },
      select: { title: true, body: true },
    });
    const adaylar = list.map((a) => [a.title, a.body] as [string, string]);
    this.onbellek = { at: Date.now(), adaylar };
    return adaylar;
  }

  /** En uygun makale (destek sohbeti ve konsoldaki öneri) */
  async oner(metin: string) {
    const a = await this.adaylar();
    return suggestAnswer(metin, a.length ? a : undefined);
  }

  /** Aynı ziyaretçinin aynı makaledeki tekrarı günde bir sayılır (özet saklanır, IP saklanmaz) */
  private async ilkKez(tur: string, id: string, kisi: { ip?: string; ua?: string }) {
    if (!this.redis) return true;
    const ozet = createHash('sha256')
      .update(`${kisi.ip ?? ''}|${kisi.ua ?? ''}`)
      .digest('hex')
      .slice(0, 24);
    return (await this.redis.set(`yardim:${tur}:${id}:${ozet}`, '1', 'EX', 86_400, 'NX')) === 'OK';
  }

  async okundu(id: string, kisi: { ip?: string; ua?: string }) {
    if (!(await this.ilkKez('okundu', id, kisi))) return;
    await this.db.helpArticle.updateMany({
      where: { id, status: 'yayinda' },
      data: { views: { increment: 1 } },
    });
  }

  async faydali(id: string, evet: boolean, kisi: { ip?: string; ua?: string }) {
    if (!(await this.ilkKez('faydali', id, kisi))) return;
    await this.db.helpArticle.updateMany({
      where: { id, status: 'yayinda' },
      data: evet ? { helpfulYes: { increment: 1 } } : { helpfulNo: { increment: 1 } },
    });
  }

  // ── Konsol ─────────────────────────────────────────────────

  async staffList() {
    const list = await this.db.helpArticle.findMany({
      where: { status: { not: 'arsiv' } },
      orderBy: [{ status: 'asc' }, { views: 'desc' }, { updatedAt: 'desc' }],
    });
    return {
      konular: HELP_TOPICS.map((t) => ({ key: t.key, ad: t.ad })),
      makaleler: list.map((a) => {
        const oy = a.helpfulYes + a.helpfulNo;
        return {
          id: a.id,
          topic: a.topic,
          konu: konuAd(a.topic),
          title: a.title,
          body: a.body,
          status: a.status,
          source: a.source,
          tarih: tarih(a.updatedAt),
          okunma: a.views,
          faydali: oy ? Math.round((a.helpfulYes / oy) * 100) : null,
          oy,
        };
      }),
      ajan: await this.ajanOneri(),
    };
  }

  async save(actor: Actor, id: string | null, d: HelpArticleInput, ip?: string) {
    return this.db.$transaction(async (tx) => {
      const once = id ? await tx.helpArticle.findUnique({ where: { id } }) : null;
      if (id && !once) throw new NotFoundException('Makale bulunamadı');
      const yayin = d.status === 'yayinda' && once?.status !== 'yayinda';
      const sira = once ? once.sort : await tx.helpArticle.count({ where: { topic: d.topic } });
      const data = {
        topic: d.topic,
        title: d.title,
        body: d.body,
        status: d.status,
        updatedBy: actor.staff.id,
        ...(yayin ? { publishedAt: new Date() } : {}),
      };
      const a = once
        ? await tx.helpArticle.update({ where: { id: once.id }, data })
        : await tx.helpArticle.create({
            data: { id: uuidv7(), ...data, sort: sira, source: 'ekip', createdBy: actor.staff.id },
          });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: actor.staff.id,
          action: once ? 'yardim_makalesi_guncellendi' : 'yardim_makalesi_eklendi',
          entityType: 'help_article',
          entityId: a.id,
          before: once ? { durum: once.status, baslik: once.title } : undefined,
          after: { durum: a.status, baslik: a.title, konu: a.topic },
          ip,
        },
        tx,
      );
      this.onbellek = null;
      return { id: a.id };
    });
  }

  /**
   * Ajanın notu (tasarımdaki "Ajan:" satırı): son 30 günün destek taleplerinden yayındaki makalelerle karşılanmayanlar,
   * destek konusuna göre. En büyük boşluk ve oranı döner; taslak hazırlanabilir.
   */
  async ajanOneri(now = new Date()) {
    const talepler = await this.db.supportTicket.findMany({
      where: { createdAt: { gte: new Date(now.getTime() - 30 * DAY) }, purgedAt: null },
      select: { topic: true, subject: true },
    });
    if (talepler.length < 5) return null;
    const adaylar = await this.adaylar();
    const bosluk = new Map<string, string[]>();
    for (const t of talepler) {
      if (suggestAnswer(t.subject, adaylar.length ? adaylar : undefined)) continue;
      bosluk.set(t.topic, [...(bosluk.get(t.topic) ?? []), t.subject]);
    }
    const en = [...bosluk.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    if (!en || en[1].length < 3) return null;
    const oran = Math.round((en[1].length / talepler.length) * 100);
    return {
      konu: en[0],
      konuAd: SUPPORT_TOPICS[en[0] as SupportTopic]?.ad ?? en[0],
      sayi: en[1].length,
      toplam: talepler.length,
      oran,
      metin: `Destek taleplerinin %${oran}’i “${SUPPORT_TOPICS[en[0] as SupportTopic]?.ad ?? en[0]}” konusunda ve yayındaki makalelerde karşılığı yok.`,
    };
  }

  /**
   * Ajanın taslağı: karşılanmayan taleplerin konu satırlarından (maskelenerek) yapay zekâ bir soru ve yanıt yazar;
   * yapay zekâ kullanılamazsa kural taslağı. Taslak olarak kaydedilir, yayın insanla.
   */
  async ajanTaslak(actor: Actor, ip?: string) {
    const o = await this.ajanOneri();
    if (!o) throw new BadRequestException('Karşılanmayan bir destek konusu yok');
    if (this.agent && !(await this.agent.calisiyor()))
      throw new BadRequestException('Rengarenk Ajanı durdurulmuş');
    const ornekler = (
      await this.db.supportTicket.findMany({
        where: { topic: o.konu, createdAt: { gte: new Date(Date.now() - 30 * DAY) }, purgedAt: null },
        select: { subject: true },
        take: 40,
        orderBy: { createdAt: 'desc' },
      })
    ).map((t) => t.subject);
    const kural = {
      soru: `${o.konuAd} hakkında sık sorulanlar`,
      cevap: `Destek ekibimize bu konuda sık soru geliyor. Kısa yanıt: … (ekip dolduracak)\n\nSık gelen sorular:\n${ornekler
        .slice(0, 5)
        .map((s) => `• ${s}`)
        .join('\n')}`,
    };
    let soru = kural.soru;
    let cevap = kural.cevap;
    if (this.ai) {
      const r = await this.ai.run({
        task: 'destek',
        promptVersion: 'yardim-makale-v1',
        size: 'buyuk',
        system:
          'Rengarenk tersine ilan pazaryerinin yardım merkezi için Türkçe, sade bir soru ve yanıt yaz. İlk satır soru, ' +
          'boş satırdan sonra en çok 120 kelimelik yanıt. Platform araç satışına aracılık etmez; ödeme, iade ve hukuki ' +
          'konularda kesin söz verme, gerekirse destek ekibine yönlendir.',
        prompt: `Konu: ${o.konuAd}\nSon 30 günde gelen destek taleplerinin konu satırları:\n${ornekler.join('\n')}`,
        taslak: `${kural.soru}\n\n${kural.cevap}`,
        maxOutputTokens: 600,
      });
      if (r.kaynak === 'yz') {
        const [ilk, ...kalan] = r.text.trim().split(/\n\s*\n/);
        if (ilk && kalan.length) {
          soru = ilk
            .replace(/^#+\s*/, '')
            .trim()
            .slice(0, 160);
          cevap = kalan.join('\n\n').trim().slice(0, 5000);
        }
      }
    }
    const konu = DESTEK_YARDIM[o.konu as SupportTopic] ?? HELP_TOPICS[0].key;
    return this.db.$transaction(async (tx) => {
      const a = await tx.helpArticle.create({
        data: {
          id: uuidv7(),
          topic: konu,
          title: soru.length >= 5 ? soru : kural.soru,
          body: cevap.length >= 20 ? cevap : kural.cevap,
          status: 'taslak',
          source: 'ajan',
          sort: await tx.helpArticle.count({ where: { topic: konu } }),
          createdBy: actor.staff.id,
        },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: actor.staff.id,
          action: 'yardim_ajan_taslagi',
          entityType: 'help_article',
          entityId: a.id,
          after: { konu, destekKonusu: o.konu, oran: o.oran },
          ip,
        },
        tx,
      );
      return { id: a.id };
    });
  }
}
