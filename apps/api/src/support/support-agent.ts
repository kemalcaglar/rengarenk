import { Inject, Injectable, Optional } from '@nestjs/common';
import { uuidv7 } from '@rengarenk/db';
import { AGENT_LIMITS, AGENT_SUPPORT, type SupportTopic, suggestAnswer, ticketNo } from '@rengarenk/shared';
import { AgentService } from '../agent/agent.service.js';
import { AiGateway } from '../ai/ai-gateway.service.js';
import { ajanAktor } from '../approvals/agent-actor.js';
import { AuditService } from '../audit/audit.service.js';
import { ENV, type Env } from '../config/env.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { SecretBox } from '../staff/secret-box.js';
import { HelpService } from './help.service.js';

const DAY = 86_400_000;
const tarihSaat = (d: Date) =>
  new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  }).format(d);
const trGunBasi = (now = new Date()) => {
  const tr = new Date(now.getTime() + 3 * 3_600_000);
  return new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate()) - 3 * 3_600_000);
};

/** Ajanın sınıfı: insana kalanlar ve yanıtlayabildikleri */
type Sinif =
  | { tur: 'insana'; not: string }
  | { tur: 'yanit'; taslak: string; guven: number; not: string; gerekce: string };

// Türkçe harfler için \b yerine harf olmayan sınır (u bayrağı)
const IADE = /(?<!\p{L})(iade|geri\s*öde|paramı\s*geri|para(?:mı|yı)?\s*geri|cayma|ücret(?:imi)?\s*geri)/iu;
const KAPAT = /(?<!\p{L})hesab\p{L}*\s*(sil|kapat|kaldır)|(?<!\p{L})üyeliğ\p{L}*\s*(sil|iptal|kapat)/iu;
const HAK = /(?<!\p{L})(hak(?:kı|kım|kımı|larım|ları|lar)?|ilk\s*mesaj|bakiye|kredi)(?!\p{L})/iu;
const SATIN = /(?<!\p{L})(satın\s*al|ödedim|ödeme\s*yaptım|para\s*verdim)/iu;
const ASKI = /(?<!\p{L})(engel|askı|aski|kısıtla|mesaj\s*gönderemiyorum|yazamıyorum|bloke)/iu;

/**
 * Rengarenk Ajanı destek işleri (Karar 41, 54): yeni talebi sınıflandırır; sık sorulanlar, hak bakiyesi ve hesap
 * durumu gibi basit soruları yanıtlar. Güven %90 ve üstündeyse yanıtlayıp çözer, altındaysa taslağı insana bırakır.
 * İade, hesap kapatma, dolandırıcılık ve hesap engeline itiraz her zaman insana kalır; ajan iade önerisi açmaz.
 * Yanıt metni yapay zekâ ağ geçidinden (maskeli) geçebilir; sayılar ve gerçekler kuraldan gelir.
 */
@Injectable()
export class SupportAgent {
  private readonly box: SecretBox;

  /** Yayındaki yardım makalelerinden en uygun yanıt (konsoldaki öneri) */
  oneri(metin: string) {
    return this.help ? this.help.oner(metin) : Promise.resolve(suggestAnswer(metin));
  }

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(ENV) env: Env,
    private readonly agent: AgentService,
    private readonly ai: AiGateway,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    @Optional() private readonly help?: HelpService,
  ) {
    this.box = SecretBox.forMessages(env);
  }

  private async hesap(userId: string) {
    const m = await this.db.accountMember.findFirst({
      where: { userId, role: 'OWNER', account: { kind: 'INDIVIDUAL' } },
      select: { accountId: true },
    });
    return m?.accountId ?? null;
  }

  private async bakiye(accountId: string, kind: string) {
    const r = await this.db.entitlementLedger.aggregate({
      where: { accountId, kind },
      _sum: { delta: true },
    });
    return r._sum.delta ?? 0;
  }

  /** Kural tabanlı sınıflandırma ve kişinin kayıtlarından taslak */
  async siniflandir(t: { topic: string; userId: string | null }, metin: string): Promise<Sinif> {
    const konu = t.topic as SupportTopic;
    const k = metin.toLocaleLowerCase('tr-TR');
    if (konu === 'dolandiricilik')
      return { tur: 'insana', not: 'Dolandırıcılık şüphesi: moderasyon ekibi inceler, ajan yanıtlamaz' };
    if (IADE.test(k))
      return {
        tur: 'insana',
        not: 'İade isteği: öneriyi bir çalışan açar, iadeyi yalnızca sahip onaylar; ajan iade önerisi açmaz',
      };
    if (KAPAT.test(k))
      return {
        tur: 'insana',
        not: 'Hesap kapatma insana kalır · kullanılmamış haklar için iade hesaplaması gerekebilir',
      };

    // Hesap durumu: etkin askı varsa bitişi ve itiraz yolu kişinin kaydından
    if (t.userId && (konu === 'hesap' || ASKI.test(k))) {
      const s = await this.db.userSanction.findFirst({
        where: { userId: t.userId, kind: 'aski', liftedAt: null, until: { gt: new Date() } },
        orderBy: { until: 'desc' },
        select: { until: true, reportId: true },
      });
      if (s?.until) {
        return {
          tur: 'yanit',
          taslak: `Merhaba, hesabında ${tarihSaat(s.until)} saatine kadar süren bir kısıtlama var; bu süre içinde ilk mesaj ve mesaj gönderemezsin. Süre dolunca kısıtlama kendiliğinden kalkar. Karara katılmıyorsan bildirimdeki “Kararı gör, itiraz et” bağlantısından 7 gün içinde itiraz edebilirsin; itirazını kararı veren dışında bir moderatör inceler.`,
          guven: 93,
          not: 'Hesap durumu: etkin askı kişinin kaydından yanıtlandı',
          gerekce: 'Hesap durumu sorusu; askının bitişi ve itiraz yolu kayıttan',
        };
      }
      if (konu === 'hesap')
        return {
          tur: 'yanit',
          taslak:
            'Merhaba, hesabında şu an süren bir kısıtlama görünmüyor. Hâlâ mesaj gönderemiyorsan hangi ekranda ve hangi uyarıyı gördüğünü yazar mısın? Ekip inceleyip sana dönecek.',
          guven: 78,
          not: 'Hesap durumu: kayıtta kısıtlama yok, ekranın ayrıntısı gerekiyor',
          gerekce: 'Hesap durumu sorusu',
        };
    }

    // Hak bakiyesi: hak defterinden (Karar 11.2, 12)
    if (t.userId && HAK.test(k)) {
      const hesap = await this.hesap(t.userId);
      if (hesap) {
        const [ek, talep, gunluk] = await Promise.all([
          this.bakiye(hesap, 'ilk_mesaj'),
          this.bakiye(hesap, 'talep'),
          this.db.conversation.count({
            where: {
              sellerAccountId: hesap,
              origin: 'talep',
              entitlement: 'gunluk',
              createdAt: { gte: trGunBasi() },
            },
          }),
        ]);
        // Satın aldığını söylüyor ama ek hak görünmüyorsa ödeme kaydına bakılmalı: taslak insana
        const satinAldi = SATIN.test(k) && ek === 0;
        return {
          tur: 'yanit',
          taslak: `Merhaba, kayıtlarına baktım: bugün ${gunluk} ücretsiz ilk mesaj hakkını kullandın; günlük ücretsiz hak her gece 00.00’da yenilenir. Satın aldığın ve süresi olmayan ${ek} ek ilk mesaj hakkın duruyor; günlük hak bitince kendiliğinden kullanılır. Ayrıca ${talep} talep hakkın var. Haklarım sayfasından hepsini birlikte görebilirsin.`,
          guven: satinAldi ? 80 : 93,
          not: satinAldi
            ? 'Hak bakiyesi: satın aldığını söylüyor ama ek hak görünmüyor; ödeme kaydına bakılmalı'
            : 'Hak bakiyesi kişinin hak defterinden yanıtlandı',
          gerekce: 'Hak bakiyesi sorusu; hak defterinden',
        };
      }
    }

    // Sık sorulanlar ve hazır yanıtlar
    const o = this.help ? await this.help.oner(metin) : suggestAnswer(metin);
    if (o) {
      const oncelikli = konu === 'odeme' || konu === 'hesap';
      const guven = Math.min(oncelikli ? 89 : 95, Math.round(60 + o.skor * 35));
      return {
        tur: 'yanit',
        taslak: `Merhaba, ${o.cevap.charAt(0).toLocaleLowerCase('tr-TR')}${o.cevap.slice(1)}`,
        guven,
        not: `Sık sorulanlardan: “${o.soru}”`,
        gerekce: `Sık sorulan soru: “${o.soru}”`,
      };
    }
    if (konu === 'odeme')
      return {
        tur: 'insana',
        not: 'Ödeme sorusu: sık sorulanlarda karşılığı yok; ödeme kaydına bakılması gerekiyor',
      };
    return { tur: 'insana', not: 'Sık sorulanlarda karşılığı yok; yanıtı ekip yazar' };
  }

  /** Destek sohbeti (Karar 42): talep açılmadan önce hemen yanıt; konu insana kalıyorsa ya da yanıt yoksa boş */
  async hemenYanit(userId: string, konu: string, metin: string): Promise<{ yanit: string | null }> {
    if (!(await this.agent.calisiyor())) return { yanit: null };
    const s = await this.siniflandir({ topic: konu, userId }, metin);
    if (s.tur !== 'yanit' || s.guven < 75) return { yanit: null };
    const u = await this.db.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    const r = await this.ai.run({
      task: 'destek',
      promptVersion: 'destek-sohbet-v1',
      size: 'kucuk',
      system:
        'Rengarenk destek asistanı olarak kısa ve net yanıt ver. Taslaktaki sayıları ve gerçekleri değiştirme, yeni bilgi ekleme, iade ya da hukuki taahhütte bulunma. Türkçe, en çok dört cümle.',
      prompt: metin.slice(0, 2000),
      taslak: s.taslak,
      names: [u?.firstName, u?.lastName],
    });
    return { yanit: r.text.trim() || s.taslak };
  }

  /** İşçi: destek.acildi */
  async isle(ticketId: string): Promise<'islem_yok' | 'insana' | 'taslak' | 'yanitladi'> {
    if (!(await this.agent.calisiyor())) return 'islem_yok';
    const t = await this.db.supportTicket.findUnique({ where: { id: ticketId } });
    if (t?.status !== 'acik' || t.agentNote) return 'islem_yok';
    const ilk = await this.db.supportMessage.findFirst({
      where: { ticketId, side: 'kullanici' },
      orderBy: { createdAt: 'asc' },
    });
    if (!ilk) return 'islem_yok';
    let metin = '';
    try {
      metin = this.box.open(ilk.body);
    } catch {
      return 'islem_yok';
    }
    const s = await this.siniflandir(t, metin);
    const no = ticketNo(t.no);

    if (s.tur === 'insana') {
      await this.db.$transaction(async (tx) => {
        await tx.supportTicket.update({ where: { id: t.id }, data: { agentNote: s.not } });
        await this.agent.kaydet(tx, {
          kind: 'insana',
          title: `Destek talebi insana bırakıldı: ${no}`,
          reason: s.not,
          confidence: 'Kural',
          entityType: 'support_ticket',
          entityId: t.id,
        });
      });
      return 'insana';
    }

    // Metin yapay zekâ ağ geçidinden geçebilir (maskeli); sağlayıcı yoksa kural taslağı kalır
    const u = t.userId
      ? await this.db.user.findUnique({
          where: { id: t.userId },
          select: { firstName: true, lastName: true },
        })
      : null;
    const r = await this.ai.run({
      task: 'destek',
      promptVersion: 'destek-yanit-v1',
      size: 'kucuk',
      system:
        'Rengarenk destek ekibi adına kısa, sıcak ve net bir yanıt yaz. Taslaktaki sayıları ve gerçekleri değiştirme, yeni bilgi ekleme, iade ya da hukuki taahhütte bulunma. Türkçe, en çok dört cümle.',
      prompt: metin.slice(0, 2000),
      taslak: s.taslak,
      names: [u?.firstName, u?.lastName],
    });
    const taslak = r.text.trim() || s.taslak;

    const gunBasi = trGunBasi();
    const bugun = await this.db.agentAction.count({
      where: { kind: 'destek_yanit', createdAt: { gte: gunBasi } },
    });
    const otomatik = s.guven >= AGENT_SUPPORT.esik * 100 && bugun < AGENT_LIMITS.otomatikYanit;
    if (!otomatik) {
      await this.db.supportTicket.update({
        where: { id: t.id },
        data: { agentDraft: this.box.seal(taslak), agentConfidence: s.guven, agentNote: s.not },
      });
      return 'taslak';
    }

    const ajan = await ajanAktor(this.db);
    const now = new Date();
    await this.db.$transaction(async (tx) => {
      const n = await tx.supportTicket.updateMany({
        where: { id: t.id, status: 'acik' },
        data: {
          status: 'cozuldu',
          resolvedAt: now,
          resolvedBy: ajan.staff.id,
          firstResponseAt: t.firstResponseAt ?? now,
          lastMessageAt: now,
          agentConfidence: s.guven,
          agentNote: s.not,
          agentAnsweredAt: now,
        },
      });
      if (!n.count) return;
      const mid = uuidv7();
      await tx.supportMessage.create({
        data: {
          id: mid,
          ticketId: t.id,
          side: 'destek',
          staffId: ajan.staff.id,
          body: this.box.seal(taslak),
        },
      });
      await this.audit.record(
        {
          actorType: 'AGENT',
          actorId: ajan.staff.id,
          action: 'destek_yanitlandi_cozuldu',
          entityType: 'support_ticket',
          entityId: t.id,
          after: { guven: s.guven },
        },
        tx,
      );
      await this.agent.kaydet(tx, {
        kind: 'destek_yanit',
        title: `Destek talebi yanıtlandı: ${no}`,
        reason: s.gerekce,
        confidence: `Güven %${s.guven}`,
        entityType: 'support_ticket',
        entityId: t.id,
        undo: { ticketId: t.id },
      });
      await this.outbox.add(tx, 'destek.yanitlandi', { ticketId: t.id, messageId: mid });
    });
    return 'yanitladi';
  }

  /** Destek kuyruğu sayısı: son 30 günde ajanın kendi çözdüğü ve geri dönen oranı */
  async ozet(now = new Date()) {
    const otuz = new Date(now.getTime() - 30 * DAY);
    const [toplam, ajan] = await Promise.all([
      this.db.supportTicket.count({ where: { createdAt: { gte: otuz } } }),
      this.db.supportTicket.findMany({
        where: { createdAt: { gte: otuz }, agentAnsweredAt: { not: null } },
        select: { id: true, agentAnsweredAt: true },
      }),
    ]);
    let donen = 0;
    if (ajan.length) {
      const sonra = await this.db.supportMessage.findMany({
        where: { ticketId: { in: ajan.map((a) => a.id) }, side: 'kullanici' },
        select: { ticketId: true, createdAt: true },
      });
      const yanit = new Map(ajan.map((a) => [a.id, a.agentAnsweredAt as Date]));
      donen = new Set(
        sonra.filter((m) => m.createdAt > (yanit.get(m.ticketId) as Date)).map((m) => m.ticketId),
      ).size;
    }
    return { toplam, ajan: ajan.length, donen };
  }
}
