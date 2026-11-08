import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type SupportTicket, uuidv7 } from '@rengarenk/db';
import {
  firstResponseDue,
  hidePhones,
  SUPPORT_CHANNELS,
  SUPPORT_MACROS,
  SUPPORT_STATUSES,
  SUPPORT_TOPICS,
  type SupportChannel,
  type SupportStatus,
  type SupportTopic,
  shortName,
  suggestAnswer,
  ticketNo,
} from '@rengarenk/shared';
import { AuditService } from '../audit/audit.service.js';
import { ENV, type Env } from '../config/env.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { SecretBox } from '../staff/secret-box.js';

const DAY = 86_400_000;
/** Kişi başına aynı anda açık talep ve günlük yeni talep sınırı (kötüye kullanıma karşı) */
const ACIK_SINIR = 5;
const GUNLUK_SINIR = 10;

/**
 * Destek (Karar 54): uygulama içi talep ve e-posta tek kuyrukta. İlk yanıt hedefi mesai içinde 2 saat, mesai dışında
 * ertesi iş günü 11.00; ödeme ve hesap güvenliği öne alınır. Yanıt kullanıcıya uygulama içi ve e-postayla gider;
 * çözümden 24 saat sonra 1–5 memnuniyet sorusu. Destek ekranında telefon numarası maskelidir. Yazışma şifreli saklanır.
 */
@Injectable()
export class SupportService {
  private readonly box: SecretBox;

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(ENV) env: Env,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {
    this.box = SecretBox.forMessages(env);
  }

  private acik(body: string) {
    try {
      return this.box.open(body);
    } catch {
      return '';
    }
  }

  // ── Kullanıcı ─────────────────────────────────────────────────

  async create(userId: string, b: { konu: SupportTopic; referans?: string; metin: string }) {
    const [acik, bugun] = await Promise.all([
      this.db.supportTicket.count({ where: { userId, status: { not: 'cozuldu' } } }),
      this.db.supportTicket.count({ where: { userId, createdAt: { gte: new Date(Date.now() - DAY) } } }),
    ]);
    if (acik >= ACIK_SINIR || bugun >= GUNLUK_SINIR) {
      throw new HttpException(
        'Açık destek taleplerin yanıtlanınca yenisini açabilirsin; mevcut talebine yazabilirsin',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const t = await this.ac({
      userId,
      email: null,
      channel: 'uygulama',
      topic: b.konu,
      reference: b.referans || null,
      subject: b.metin.slice(0, 120),
      metin: b.metin,
    });
    return { no: t.no, numara: ticketNo(t.no) };
  }

  private async ac(p: {
    userId: string | null;
    email: string | null;
    channel: SupportChannel;
    topic: SupportTopic;
    reference: string | null;
    subject: string;
    metin: string;
  }) {
    const now = new Date();
    const id = uuidv7();
    return this.db.$transaction(async (tx) => {
      const t = await tx.supportTicket.create({
        data: {
          id,
          userId: p.userId,
          email: p.email,
          channel: p.channel,
          topic: p.topic,
          reference: p.reference,
          subject: p.subject,
          priority: SUPPORT_TOPICS[p.topic].oncelikli,
          dueAt: firstResponseDue(now),
          lastMessageAt: now,
          userReadAt: now,
        },
      });
      await tx.supportMessage.create({
        data: { id: uuidv7(), ticketId: id, side: 'kullanici', body: this.box.seal(p.metin) },
      });
      await this.outbox.add(tx, 'destek.acildi', { ticketId: id });
      return t;
    });
  }

  async mine(userId: string) {
    const ts = await this.db.supportTicket.findMany({
      where: { userId },
      orderBy: { lastMessageAt: 'desc' },
      take: 50,
    });
    return ts.map((t) => ({
      no: t.no,
      numara: ticketNo(t.no),
      konu: SUPPORT_TOPICS[t.topic as SupportTopic].ad,
      ozet: t.subject,
      durum: t.status,
      durumAd: SUPPORT_STATUSES[t.status as SupportStatus],
      son: t.lastMessageAt,
      okunmamis: !!t.firstResponseAt && (!t.userReadAt || t.userReadAt < t.lastMessageAt),
    }));
  }

  private async benim(userId: string, no: number) {
    const t = await this.db.supportTicket.findUnique({ where: { no } });
    if (t?.userId !== userId) throw new NotFoundException('Destek talebi bulunamadı');
    return t;
  }

  async thread(userId: string, no: number) {
    const t = await this.benim(userId, no);
    await this.db.supportTicket.update({ where: { id: t.id }, data: { userReadAt: new Date() } });
    return this.gorunum(t, 'kullanici');
  }

  /** Kullanıcı yazınca çözülmüş talep yeniden açılır ve süre baştan işler */
  async userMessage(userId: string, no: number, metin: string) {
    const t = await this.benim(userId, no);
    const now = new Date();
    await this.db.$transaction(async (tx) => {
      await tx.supportMessage.create({
        data: { id: uuidv7(), ticketId: t.id, side: 'kullanici', body: this.box.seal(metin) },
      });
      await tx.supportTicket.update({
        where: { id: t.id },
        data: {
          lastMessageAt: now,
          userReadAt: now,
          ...(t.status !== 'acik' ? { status: 'acik', dueAt: firstResponseDue(now), resolvedAt: null } : {}),
        },
      });
    });
    return this.thread(userId, no);
  }

  async rate(userId: string, no: number, puan: number) {
    const t = await this.benim(userId, no);
    if (t.status !== 'cozuldu') throw new ConflictException('Talep çözülünce puan verebilirsin');
    if (t.rating) throw new ConflictException('Bu talebe puan verdin');
    await this.db.supportTicket.update({ where: { id: t.id }, data: { rating: puan } });
    return this.thread(userId, no);
  }

  /**
   * Destek e-postası (posta sunucusunun imzalı bildirimi): doğrulanmış e-postası eşleşen kullanıcının talebi olur, yoksa
   * adresle açılır. Konu satırında "D-12345" varsa o talebe eklenir.
   */
  async inbound(b: { kimden: string; konu: string; metin: string }) {
    const adres = b.kimden.toLowerCase();
    const u = await this.db.user.findFirst({
      where: { email: { equals: adres, mode: 'insensitive' }, emailVerifiedAt: { not: null } },
      select: { id: true },
    });
    const ref = b.konu.match(/D-(\d{5,})/);
    if (ref) {
      const t = await this.db.supportTicket.findUnique({ where: { no: Number(ref[1]) } });
      if (t && ((u && t.userId === u.id) || (!t.userId && t.email === adres))) {
        const now = new Date();
        await this.db.$transaction(async (tx) => {
          await tx.supportMessage.create({
            data: {
              id: uuidv7(),
              ticketId: t.id,
              side: 'kullanici',
              body: this.box.seal(b.metin.slice(0, 4000)),
            },
          });
          await tx.supportTicket.update({
            where: { id: t.id },
            data: {
              lastMessageAt: now,
              ...(t.status !== 'acik'
                ? { status: 'acik', dueAt: firstResponseDue(now), resolvedAt: null }
                : {}),
            },
          });
        });
        return { no: t.no };
      }
    }
    const t = await this.ac({
      userId: u?.id ?? null,
      email: u ? null : adres,
      channel: 'eposta',
      topic: 'diger',
      reference: null,
      subject: (b.konu || b.metin).slice(0, 120),
      metin: b.metin.slice(0, 4000),
    });
    return { no: t.no };
  }

  // ── Konsol ────────────────────────────────────────────────────

  async queue() {
    const otuz = new Date(Date.now() - 30 * DAY);
    const now = new Date();
    const [acik, cozulen, ilkYanit, puan] = await Promise.all([
      this.db.supportTicket.findMany({
        where: { status: { not: 'cozuldu' } },
        orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }],
        take: 200,
      }),
      this.db.supportTicket.findMany({
        where: { status: 'cozuldu' },
        orderBy: { resolvedAt: 'desc' },
        take: 20,
      }),
      this.db.supportTicket.findMany({
        where: { createdAt: { gte: otuz }, firstResponseAt: { not: null } },
        select: { createdAt: true, firstResponseAt: true },
      }),
      this.db.supportTicket.aggregate({
        where: { rating: { not: null }, resolvedAt: { gte: otuz } },
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);
    const kisiler = new Map(
      (
        await this.db.user.findMany({
          where: { id: { in: [...acik, ...cozulen].flatMap((t) => (t.userId ? [t.userId] : [])) } },
          select: { id: true, firstName: true, lastName: true },
        })
      ).map((u) => [u.id, shortName(u.firstName, u.lastName)]),
    );
    const dk = ilkYanit.map((t) => ((t.firstResponseAt as Date).getTime() - t.createdAt.getTime()) / 60_000);
    const ort = dk.length ? dk.reduce((a, b) => a + b, 0) / dk.length : null;
    const asan = acik.filter((t) => t.status === 'acik' && t.dueAt < now).length;
    const satir = (t: SupportTicket) => ({
      id: t.id,
      no: ticketNo(t.no),
      kanal: t.channel === 'eposta' ? 'E-posta' : 'Sohbet',
      konu: t.subject,
      kim: t.userId ? (kisiler.get(t.userId) ?? 'Kullanıcı') : 'E-posta ile',
      etiket: SUPPORT_TOPICS[t.topic as SupportTopic].etiket,
      durum: t.status,
      oncelikli: t.priority,
      sonTarih: t.status === 'acik' ? t.dueAt : null,
      bekliyorDk:
        t.status === 'acik' ? Math.round((now.getTime() - t.lastMessageAt.getTime()) / 60_000) : null,
    });
    return {
      sayilar: [
        { ad: 'Açık talep', deger: String(acik.length), not: asan ? `${asan}’i süre aştı` : 'Süre aşan yok' },
        {
          ad: 'Ort. ilk yanıt',
          deger:
            ort === null
              ? '—'
              : ort < 60
                ? `${Math.round(ort)} dk`
                : `${(ort / 60).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} sa`,
          not: 'Hedef: mesai içi 2 saat',
        },
        { ad: 'Ajanın kendi çözdüğü', deger: '—', not: 'Yapay zekâ yanıtları Rengarenk Ajanı ile' },
        {
          ad: 'Memnuniyet',
          deger: puan._count.rating
            ? `${(puan._avg.rating ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} / 5`
            : '—',
          not: `${puan._count.rating.toLocaleString('tr-TR')} yanıt · son 30 gün`,
        },
      ],
      acik: acik.map(satir),
      cozulen: cozulen.map(satir),
      suresiAsan: asan,
    };
  }

  async detail(id: string) {
    const t = await this.db.supportTicket.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Destek talebi bulunamadı');
    return this.gorunum(t, 'destek');
  }

  private async gorunum(t: SupportTicket, kim: 'kullanici' | 'destek') {
    const [mesajlar, u] = await Promise.all([
      this.db.supportMessage.findMany({ where: { ticketId: t.id }, orderBy: { createdAt: 'asc' } }),
      t.userId
        ? this.db.user.findUnique({ where: { id: t.userId }, select: { firstName: true, lastName: true } })
        : null,
    ]);
    const calisan = new Map(
      (
        await this.db.staffMember.findMany({
          where: { id: { in: mesajlar.flatMap((m) => (m.staffId ? [m.staffId] : [])) } },
          select: { id: true, name: true },
        })
      ).map((s) => [s.id, s.name.split(' ')[0] ?? s.name]),
    );
    const kisiAd = u ? shortName(u.firstName, u.lastName) : (t.email ?? 'Kullanıcı');
    const liste = mesajlar.map((m) => {
      const metin = this.acik(m.body);
      return {
        id: m.id,
        taraf: m.side as 'kullanici' | 'destek',
        kim:
          m.side === 'destek'
            ? `Rengarenk Destek${kim === 'destek' && m.staffId ? ` · ${calisan.get(m.staffId) ?? ''}` : ''}`
            : kisiAd,
        // Destek ekranında telefon numarası maskelidir (Karar 54)
        metin: kim === 'destek' && m.side === 'kullanici' ? hidePhones(metin) : metin,
        zaman: m.createdAt,
      };
    });
    const sonKullanici = [...liste].reverse().find((m) => m.taraf === 'kullanici');
    return {
      id: t.id,
      no: t.no,
      numara: ticketNo(t.no),
      konu: t.subject,
      konuTur: SUPPORT_TOPICS[t.topic as SupportTopic].ad,
      etiket: SUPPORT_TOPICS[t.topic as SupportTopic].etiket,
      kanal: SUPPORT_CHANNELS[t.channel as SupportChannel],
      referans: t.reference,
      durum: t.status,
      durumAd: SUPPORT_STATUSES[t.status as SupportStatus],
      puan: t.rating,
      puanVerebilir: kim === 'kullanici' && t.status === 'cozuldu' && !t.rating,
      mesajlar: liste,
      ...(kim === 'destek'
        ? {
            kisi: { ad: kisiAd, userId: t.userId },
            sonTarih: t.status === 'acik' ? t.dueAt : null,
            oncelikli: t.priority,
            oneri: sonKullanici ? suggestAnswer(sonKullanici.metin) : null,
            makrolar: SUPPORT_MACROS,
          }
        : {}),
    };
  }

  /** Yanıt: ilk yanıt zamanı yazılır; "çözüldü say" ile kapanır. Kullanıcıya uygulama içi ve e-postayla gider */
  async reply(staffId: string, id: string, b: { metin: string; coz?: boolean }, ip?: string) {
    const t = await this.db.supportTicket.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Destek talebi bulunamadı');
    const now = new Date();
    await this.db.$transaction(async (tx) => {
      const mid = uuidv7();
      await tx.supportMessage.create({
        data: { id: mid, ticketId: id, side: 'destek', staffId, body: this.box.seal(b.metin) },
      });
      await tx.supportTicket.update({
        where: { id },
        data: {
          lastMessageAt: now,
          firstResponseAt: t.firstResponseAt ?? now,
          status: b.coz ? 'cozuldu' : 'yanitlandi',
          ...(b.coz ? { resolvedAt: now, resolvedBy: staffId } : {}),
        },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: b.coz ? 'destek_yanitlandi_cozuldu' : 'destek_yanitlandi',
          entityType: 'support_ticket',
          entityId: id,
          ip,
        },
        tx,
      );
      await this.outbox.add(tx, 'destek.yanitlandi', { ticketId: id, messageId: mid });
    });
    return this.detail(id);
  }

  async resolve(staffId: string, id: string, ip?: string) {
    const t = await this.db.supportTicket.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Destek talebi bulunamadı');
    if (t.status === 'cozuldu') throw new ConflictException('Talep zaten çözüldü');
    await this.db.$transaction(async (tx) => {
      await tx.supportTicket.update({
        where: { id },
        data: { status: 'cozuldu', resolvedAt: new Date(), resolvedBy: staffId },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'destek_cozuldu',
          entityType: 'support_ticket',
          entityId: id,
          ip,
        },
        tx,
      );
    });
    return this.detail(id);
  }

  /** İşçi: çözümden 24 saat sonra memnuniyet sorusu (Karar 54) */
  async askRatings(now = new Date()) {
    const ts = await this.db.supportTicket.findMany({
      where: {
        status: 'cozuldu',
        rating: null,
        ratingAskedAt: null,
        userId: { not: null },
        resolvedAt: { lte: new Date(now.getTime() - DAY) },
      },
      take: 200,
      select: { id: true },
    });
    for (const t of ts) {
      await this.db.$transaction(async (tx) => {
        const k = await tx.supportTicket.updateMany({
          where: { id: t.id, ratingAskedAt: null },
          data: { ratingAskedAt: now },
        });
        if (k.count) await this.outbox.add(tx, 'destek.memnuniyet', { ticketId: t.id });
      });
    }
    return ts.length;
  }

  /** Bildirim için: son destek yanıtının açık metni */
  async replyText(messageId: string) {
    const m = await this.db.supportMessage.findUnique({ where: { id: messageId } });
    return m ? this.acik(m.body) : '';
  }

  async openCount() {
    return this.db.supportTicket.count({ where: { status: 'acik' } });
  }
}
