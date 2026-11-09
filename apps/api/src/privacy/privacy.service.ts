import {
  ConflictException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { uuidv7 } from '@rengarenk/db';
import {
  EXPORT_VALID_DAYS,
  KVKK_DAYS,
  KVKK_KINDS,
  KVKK_WARN_DAYS,
  type KvkkKind,
  kvkkDraft,
  maskEposta,
  shortName,
} from '@rengarenk/shared';
import { AuditService } from '../audit/audit.service.js';
import { AuthService } from '../auth/auth.service.js';
import { ENV, type Env } from '../config/env.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { SecretBox } from '../staff/secret-box.js';
import { STORAGE, type Storage } from '../storage/storage.service.js';

const DAY = 86_400_000;

/** Rıza türlerinin adı (Rıza ve çerez kayıtları ekranı) */
export const CONSENT_NAMES: Record<string, string> = {
  kullanim_kosullari: 'Kullanım koşulları',
  kvkk_aydinlatma: 'KVKK aydınlatma metni',
  ticari_ileti: 'Ticari ileti (İYS)',
  reklam_olcum: 'Reklam ölçümü',
  cerez_analiz: 'Analitik çerez',
  cerez_reklam: 'Reklam çerezi',
  galeri_sozlesmesi: 'Galeri sözleşmesi',
  abonelik_otomatik_yenileme: 'Abonelik otomatik yenileme',
};

/**
 * Gizlilik ve KVKK (Karar 58, 59): kendi verini indirme, KVKK başvuruları, rıza kayıtları.
 *
 * - Veri indirme SMS koduyla istenir; işçi kopyayı (profil, talepler, mesajlar, ödemeler, rızalar, destek ve başvurular)
 *   hazırlar, bağlantı 7 gün geçerlidir. Her adım işlem kaydına girer.
 * - KVKK başvurusu hesaptan SMS koduyla ya da konsoldan (dışarıdan, kimlik çalışanca doğrulanmış) açılır; 30 gün içinde
 *   yanıtlanır. Ajan kişinin verilerini sayar ve taslak hazırlar; yanıtı her zaman bir çalışan gönderir.
 */
@Injectable()
export class PrivacyService {
  private readonly box: SecretBox;

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(ENV) env: Env,
    @Inject(STORAGE) private readonly storage: Storage,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    @Optional() private readonly auth?: AuthService,
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

  private async dogrula(userId: string, b: { challengeId: string; code: string }) {
    if (!this.auth) throw new Error('Kimlik doğrulama bu süreçte yok');
    await this.auth.confirmCode(userId, b.challengeId, b.code);
  }

  // ── Verilerimi indir ──────────────────────────────────────────

  async requestExport(userId: string, b: { challengeId: string; code: string }, ip?: string) {
    await this.dogrula(userId, b);
    // Son 24 saatte hazırlanan ya da hazırlanmakta olan kopya varsa yenisi açılmaz
    const var_ = await this.db.dataExport.findFirst({
      where: {
        userId,
        status: { in: ['hazirlaniyor', 'hazir'] },
        createdAt: { gte: new Date(Date.now() - DAY) },
      },
    });
    if (var_) return this.exports(userId);
    const id = uuidv7();
    await this.db.$transaction(async (tx) => {
      await tx.dataExport.create({ data: { id, userId } });
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: userId,
          action: 'veri_indirme_istendi',
          entityType: 'data_export',
          entityId: id,
          ip,
        },
        tx,
      );
      await this.outbox.add(tx, 'veri.indirme_istendi', { exportId: id });
    });
    return this.exports(userId);
  }

  async exports(userId: string) {
    const now = new Date();
    const rows = await this.db.dataExport.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    return rows.map((r) => ({
      id: r.id,
      durum: r.status === 'hazir' && r.expiresAt && r.expiresAt < now ? 'suresi_doldu' : r.status,
      istendi: r.createdAt,
      hazir: r.readyAt,
      gecerlilik: r.expiresAt,
      boyut: r.sizeBytes,
    }));
  }

  async download(userId: string, id: string, ip?: string) {
    const r = await this.db.dataExport.findUnique({ where: { id } });
    if (r?.userId !== userId) throw new NotFoundException('Dosya bulunamadı');
    if (r.status !== 'hazir' || !r.storageKey) throw new ConflictException('Dosya henüz hazır değil');
    if (r.expiresAt && r.expiresAt < new Date())
      throw new GoneException('Bağlantının süresi doldu; yeniden iste');
    const f = await this.storage.get(r.storageKey);
    await this.db.$transaction(async (tx) => {
      await tx.dataExport.update({ where: { id }, data: { downloadedAt: new Date() } });
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: userId,
          action: 'veri_indirildi',
          entityType: 'data_export',
          entityId: id,
          ip,
        },
        tx,
      );
    });
    return f;
  }

  /** İşçi: kopyayı hazırlar (JSON) ve depolamaya yazar */
  async buildExport(id: string) {
    const r = await this.db.dataExport.findUnique({ where: { id } });
    if (r?.status !== 'hazirlaniyor') return 'atlandi';
    const userId = r.userId;
    const u = await this.db.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        phone: true,
        firstName: true,
        lastName: true,
        displayName: true,
        email: true,
        emailVerifiedAt: true,
        createdAt: true,
        il: true,
        ilce: true,
        nameMode: true,
        phoneVisible: true,
        whatsappVisible: true,
        callFrom: true,
        callTo: true,
        memberships: { select: { accountId: true, role: true } },
      },
    });
    const hesaplar = u.memberships.map((m) => m.accountId);
    const [
      talepler,
      sohbetler,
      siparisler,
      rizalar,
      tercihler,
      aramalar,
      favoriler,
      yildizlar,
      destek,
      kvkk,
    ] = await Promise.all([
      this.db.demand.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: {
          no: true,
          title: true,
          headline: true,
          status: true,
          data: true,
          il: true,
          ilce: true,
          publishedAt: true,
          expiresAt: true,
          closedAt: true,
          createdAt: true,
        },
      }),
      this.db.conversation.findMany({
        where: { OR: [{ buyerUserId: userId }, { sellerUserId: userId }] },
        orderBy: { createdAt: 'asc' },
        include: {
          demand: { select: { no: true } },
          messages: { orderBy: { createdAt: 'asc' }, where: { kind: { in: ['metin', 'sistem'] } } },
        },
      }),
      this.db.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: {
          no: true,
          channel: true,
          status: true,
          items: true,
          totalKurus: true,
          billing: true,
          paidAt: true,
          createdAt: true,
        },
      }),
      this.db.consent.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: {
          kind: true,
          granted: true,
          textKey: true,
          textVersion: true,
          channel: true,
          createdAt: true,
        },
      }),
      this.db.notificationPref.findMany({
        where: { userId },
        select: { konu: true, kanal: true, acik: true },
      }),
      this.db.savedSearch.findMany({ where: { userId } }),
      this.db.favorite.findMany({
        where: { userId },
        select: { demand: { select: { no: true } }, createdAt: true },
      }),
      this.db.rating.findMany({ where: { buyerUserId: userId }, select: { stars: true, createdAt: true } }),
      this.db.supportTicket.findMany({
        where: { userId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      }),
      this.db.kvkkRequest.findMany({ where: { userId } }),
    ]);
    const veri = {
      aciklama:
        'Rengarenk hesabındaki kişisel verilerinin kopyası (KVKK m.11). Fatura ve ödeme kayıtları yasal süre boyunca saklanır.',
      hazirlandi: new Date().toISOString(),
      profil: {
        telefon: u.phone,
        ad: u.firstName,
        soyad: u.lastName,
        gorunenAd: u.displayName,
        eposta: u.email,
        epostaDogrulandi: !!u.emailVerifiedAt,
        uyelik: u.createdAt,
        il: u.il,
        ilce: u.ilce,
        talepteAd: u.nameMode,
        iletisim: {
          telefonGorunsun: u.phoneVisible,
          whatsapp: u.whatsappVisible,
          aranabilirSaatler: `${u.callFrom}–${u.callTo}`,
        },
        hesaplar: u.memberships,
      },
      talepler: talepler.map((d) => ({ ...d, no: Number(d.no) })),
      sohbetler: sohbetler.map((c) => ({
        talep: c.demand ? Number(c.demand.no) : null,
        rolum: c.buyerUserId === userId ? 'alici' : 'satici',
        baslangic: c.createdAt,
        mesajlar: c.messages.map((m) => ({
          taraf: m.side,
          benim: m.senderUserId === userId,
          metin: m.hiddenAt ? '(moderasyon tarafından gizlendi)' : this.acik(m.body),
          zaman: m.createdAt,
        })),
      })),
      odemeler: siparisler.map((o) => ({ ...o, totalKurus: Number(o.totalKurus) })),
      rizalar,
      bildirimTercihleri: tercihler,
      kayitliAramalar: aramalar.map((a) => ({
        ad: a.name,
        sorgu: a.query,
        bildirim: a.notify,
        olusturma: a.createdAt,
      })),
      favoriler: favoriler.map((f) => ({ talep: f.demand ? Number(f.demand.no) : null, zaman: f.createdAt })),
      verdigimYildizlar: yildizlar,
      destek: destek.map((t) => ({
        no: `D-${t.no}`,
        konu: t.subject,
        durum: t.status,
        mesajlar: t.messages.map((m) => ({ taraf: m.side, metin: this.acik(m.body), zaman: m.createdAt })),
      })),
      kvkkBasvurulari: kvkk.map((k) => ({
        no: `K-${k.no}`,
        tur: k.kind,
        metin: k.text,
        yanit: k.response,
        zaman: k.createdAt,
      })),
      hesapNotu:
        hesaplar.length > 1
          ? 'Galeri hesaplarının kurumsal verileri galeri panelinden indirilir.'
          : undefined,
    };
    const govde = new TextEncoder().encode(JSON.stringify(veri, null, 2));
    const key = `veri-indirme/${id}.json`;
    await this.storage.put(key, govde, 'application/json');
    const now = new Date();
    await this.db.$transaction(async (tx) => {
      await tx.dataExport.update({
        where: { id },
        data: {
          status: 'hazir',
          storageKey: key,
          sizeBytes: govde.byteLength,
          readyAt: now,
          expiresAt: new Date(now.getTime() + EXPORT_VALID_DAYS * DAY),
        },
      });
      await this.outbox.add(tx, 'veri.hazir', { exportId: id });
    });
    return 'hazir';
  }

  // ── Engellediklerin (Ayarlar.dc.html › Gizlilik) ─────────────

  async blocks(userId: string) {
    const rows = await this.db.userBlock.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        account: {
          select: {
            gallery: { select: { displayName: true } },
            members: {
              where: { role: 'OWNER' },
              select: { user: { select: { firstName: true, lastName: true } } },
            },
          },
        },
      },
    });
    return rows.map((b) => ({
      hesap: b.accountId,
      ad:
        b.account.gallery?.displayName ??
        shortName(b.account.members[0]?.user.firstName, b.account.members[0]?.user.lastName),
      not: `${b.account.gallery ? 'Galeri' : 'Bireysel satıcı'} · ${new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' }).format(b.createdAt)}’da engellendi`,
    }));
  }

  async unblock(userId: string, accountId: string) {
    await this.db.userBlock.deleteMany({ where: { userId, accountId } });
    return this.blocks(userId);
  }

  // ── KVKK başvurusu (kullanıcı) ────────────────────────────────

  async createRequest(
    userId: string,
    b: { tur: KvkkKind; metin: string; challengeId: string; code: string },
    ip?: string,
  ) {
    await this.dogrula(userId, b);
    const id = uuidv7();
    const r = await this.db.$transaction(async (tx) => {
      const r = await tx.kvkkRequest.create({
        data: {
          id,
          userId,
          kind: b.tur,
          text: b.metin,
          verification: 'hesap_kodu',
          channel: 'uygulama',
          dueAt: new Date(Date.now() + KVKK_DAYS * DAY),
        },
      });
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: userId,
          action: 'kvkk_basvurusu',
          entityType: 'kvkk_request',
          entityId: id,
          ip,
        },
        tx,
      );
      await this.outbox.add(tx, 'kvkk.basvuru', { requestId: id });
      return r;
    });
    return { no: r.no, numara: `K-${r.no}`, sonTarih: r.dueAt };
  }

  async myRequests(userId: string) {
    const rows = await this.db.kvkkRequest.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    return rows.map((r) => ({
      numara: `K-${r.no}`,
      tur: KVKK_KINDS[r.kind as KvkkKind],
      durum: r.status,
      sonTarih: r.dueAt,
      yanit: r.response,
      zaman: r.createdAt,
    }));
  }

  // ── KVKK başvuruları (konsol) ─────────────────────────────────

  async staffList() {
    const now = Date.now();
    const otuz = new Date(now - 30 * DAY);
    const [acik, kapali, yanitlanan, indiren] = await Promise.all([
      this.db.kvkkRequest.findMany({ where: { status: 'acik' }, orderBy: { dueAt: 'asc' } }),
      this.db.kvkkRequest.findMany({
        where: { status: 'yanitlandi' },
        orderBy: { respondedAt: 'desc' },
        take: 20,
      }),
      this.db.kvkkRequest.findMany({
        where: { status: 'yanitlandi', respondedAt: { gte: new Date(now - 90 * DAY) } },
        select: { createdAt: true, respondedAt: true },
      }),
      this.db.dataExport.count({ where: { createdAt: { gte: otuz } } }),
    ]);
    const kisiler = await this.adlar([...acik, ...kapali].flatMap((r) => (r.userId ? [r.userId] : [])));
    const gunler = yanitlanan.map((r) => ((r.respondedAt as Date).getTime() - r.createdAt.getTime()) / DAY);
    const ort = gunler.length ? gunler.reduce((a, b) => a + b, 0) / gunler.length : null;
    const enYakin = acik[0] ? Math.ceil((acik[0].dueAt.getTime() - now) / DAY) : null;
    const satir = (r: (typeof acik)[number]) => {
      const kalan = Math.ceil((r.dueAt.getTime() - now) / DAY);
      return {
        id: r.id,
        numara: `K-${r.no}`,
        tur: KVKK_KINDS[r.kind as KvkkKind],
        kim: r.userId ? (kisiler.get(r.userId) ?? 'Kullanıcı') : (r.applicantName ?? 'Başvuran'),
        alt: kaynakAd(r),
        durum: r.status,
        kalanGun: r.status === 'acik' ? kalan : null,
        uyari: r.status === 'acik' && kalan <= KVKK_WARN_DAYS,
      };
    };
    return {
      sayilar: [
        {
          ad: 'Açık başvuru',
          deger: String(acik.length),
          not: enYakin === null ? 'Açık başvuru yok' : `En yakın süre ${Math.max(0, enYakin)} gün`,
        },
        {
          ad: 'Ortalama yanıt',
          deger: ort === null ? '—' : `${Math.max(1, Math.round(ort))} gün`,
          not: 'Yasal üst sınır 30 gün',
        },
        {
          ad: 'Kendi verisini indiren',
          deger: String(indiren),
          not: 'Son 30 gün · başvuruya gerek kalmadan',
        },
        { ad: 'Hesap kapatma', deger: '—', not: 'Hesap kapatma ve anonimleştirme sahip kararıyla gelecek' },
      ],
      acik: acik.map(satir),
      kapali: kapali.map(satir),
    };
  }

  private async adlar(ids: string[]) {
    const u = await this.db.user.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, firstName: true, lastName: true },
    });
    return new Map(u.map((x) => [x.id, shortName(x.firstName, x.lastName)]));
  }

  async staffDetail(id: string) {
    const r = await this.db.kvkkRequest.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Başvuru bulunamadı');
    const veriler = r.userId ? await this.veriOzeti(r.userId) : [];
    const ad = r.userId
      ? ((await this.adlar([r.userId])).get(r.userId) ?? 'Kullanıcı')
      : (r.applicantName ?? 'Başvuran');
    const u = r.userId
      ? await this.db.user.findUnique({
          where: { id: r.userId },
          select: { firstName: true, lastName: true },
        })
      : null;
    const hitap = u
      ? [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Değerli kullanıcımız'
      : (r.applicantName ?? '');
    const kalan = Math.ceil((r.dueAt.getTime() - Date.now()) / DAY);
    return {
      id: r.id,
      numara: `K-${r.no}`,
      baslik: `${KVKK_KINDS[r.kind as KvkkKind]} başvurusu · ${ad}`,
      alt: `${kaynakAd(r)} · ${r.status === 'acik' ? `Kalan ${Math.max(0, kalan)} gün` : 'Yanıtlandı'}`,
      metin: r.text,
      veriler,
      taslak: r.status === 'acik' ? kvkkDraft(r.kind as KvkkKind, hitap, veriler) : null,
      yanit: r.response,
      durum: r.status,
      eposta: r.applicantEmail ? maskEposta(r.applicantEmail) : null,
      userId: r.userId,
      silme: r.kind === 'silme',
    };
  }

  /** Ajanın topladığı veriler (KVKK başvurusu ekranındaki etiketler) */
  private async veriOzeti(userId: string) {
    const [talep, sohbet, odeme, riza, destek, uyelik] = await Promise.all([
      this.db.demand.count({ where: { userId } }),
      this.db.conversation.count({ where: { OR: [{ buyerUserId: userId }, { sellerUserId: userId }] } }),
      this.db.order.count({ where: { userId, status: 'PAID' } }),
      this.db.consent.count({ where: { userId } }),
      this.db.supportTicket.count({ where: { userId } }),
      this.db.accountMember.count({ where: { userId, account: { kind: 'BUSINESS' } } }),
    ]);
    return [
      'Profil',
      ...(talep ? [`${talep} talep`] : []),
      ...(sohbet ? [`${sohbet} sohbet`] : []),
      ...(odeme ? [`${odeme} ödeme · 10 yıl saklanır`] : []),
      ...(riza ? ['Rıza geçmişi'] : []),
      ...(destek ? [`${destek} destek talebi`] : []),
      ...(uyelik ? ['Galeri üyeliği'] : []),
      'Paylaşılan taraflar',
    ];
  }

  async staffCreate(
    staffId: string,
    b: { ad: string; eposta: string; tur: KvkkKind; metin: string; kanal: 'eposta' | 'posta' },
    ip?: string,
  ) {
    const adres = b.eposta.toLowerCase();
    const u = await this.db.user.findFirst({
      where: { email: { equals: adres, mode: 'insensitive' }, emailVerifiedAt: { not: null } },
      select: { id: true },
    });
    const id = uuidv7();
    await this.db.$transaction(async (tx) => {
      await tx.kvkkRequest.create({
        data: {
          id,
          userId: u?.id ?? null,
          applicantName: b.ad,
          applicantEmail: adres,
          kind: b.tur,
          text: b.metin,
          verification: 'kimlik',
          channel: b.kanal,
          dueAt: new Date(Date.now() + KVKK_DAYS * DAY),
          createdBy: staffId,
        },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'kvkk_basvurusu_kaydedildi',
          entityType: 'kvkk_request',
          entityId: id,
          ip,
        },
        tx,
      );
    });
    return this.staffDetail(id);
  }

  /** Yanıtı her zaman bir çalışan gönderir (Karar 58); kişiye uygulama içi ve e-postayla gider */
  async reply(staffId: string, id: string, metin: string, ip?: string) {
    const r = await this.db.kvkkRequest.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Başvuru bulunamadı');
    if (r.status !== 'acik') throw new ConflictException('Başvuru zaten yanıtlandı');
    await this.db.$transaction(async (tx) => {
      const k = await tx.kvkkRequest.updateMany({
        where: { id, status: 'acik' },
        data: { status: 'yanitlandi', response: metin, respondedBy: staffId, respondedAt: new Date() },
      });
      if (!k.count) throw new ConflictException('Başvuru zaten yanıtlandı');
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'kvkk_yanitlandi',
          entityType: 'kvkk_request',
          entityId: id,
          ip,
        },
        tx,
      );
      await this.outbox.add(tx, 'kvkk.yanitlandi', { requestId: id });
    });
    return this.staffDetail(id);
  }

  // ── Rıza ve çerez kayıtları (konsol) ──────────────────────────

  async consentOverview() {
    const oran = async (kind: string, ziyaretci = false) => {
      const rows = await this.db.$queryRawUnsafe<{ verdi: bigint; toplam: bigint }[]>(
        `SELECT count(*) FILTER (WHERE granted) AS verdi, count(*) AS toplam FROM (
           SELECT DISTINCT ON (${ziyaretci ? 'coalesce(user_id::text, visitor_id)' : 'user_id'}) granted
           FROM consents WHERE kind = $1 ${ziyaretci ? '' : 'AND user_id IS NOT NULL'}
           ORDER BY ${ziyaretci ? 'coalesce(user_id::text, visitor_id)' : 'user_id'}, created_at DESC) t`,
        kind,
      );
      const v = Number(rows[0]?.verdi ?? 0);
      const t = Number(rows[0]?.toplam ?? 0);
      return { v, t };
    };
    const [reklam, analiz, ticari, iys] = await Promise.all([
      oran('reklam_olcum'),
      oran('cerez_analiz', true),
      oran('ticari_ileti'),
      this.db.outboxEvent.findFirst({
        where: { type: 'iys.izin_degisti', publishedAt: { not: null } },
        orderBy: { publishedAt: 'desc' },
        select: { publishedAt: true },
      }),
    ]);
    const yuzde = (x: { v: number; t: number }) => (x.t ? `%${Math.round((x.v / x.t) * 100)}` : '—');
    return [
      {
        ad: 'Reklam ölçümü rızası',
        deger: yuzde(reklam),
        not: `${reklam.v} rıza · ${reklam.t - reklam.v} ret`,
      },
      { ad: 'Analitik çerez', deger: yuzde(analiz), not: 'Web ziyaretçileri' },
      { ad: 'Ticari ileti onayı', deger: yuzde(ticari), not: `${ticari.v} onay` },
      {
        ad: 'Son İYS bildirimi',
        deger: iys?.publishedAt
          ? new Intl.DateTimeFormat('tr-TR', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'Europe/Istanbul',
            }).format(iys.publishedAt)
          : '—',
        not: 'İYS bağlantısı hesap açılınca kurulacak',
      },
    ];
  }

  /** Kişinin rıza geçmişi (ad ya da telefonun son haneleriyle aranır); kayıtlar değişmez */
  async consentHistory(q: string) {
    const t = q.trim();
    if (t.length < 2) return { kisi: null, gecmis: [] };
    const sayi = t.replace(/\D/g, '');
    const u = await this.db.user.findFirst({
      where:
        sayi.length >= 4
          ? { phone: { endsWith: sayi.slice(-7) } }
          : {
              OR: [
                { firstName: { contains: t.split(' ')[0], mode: 'insensitive' } },
                { lastName: { contains: t.split(' ').slice(-1)[0], mode: 'insensitive' } },
              ],
            },
      orderBy: { createdAt: 'desc' },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!u) return { kisi: null, gecmis: [] };
    const rows = await this.db.consent.findMany({
      where: { userId: u.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return {
      kisi: { ad: [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Kullanıcı', userId: u.id },
      gecmis: rows.map((c) => ({
        ad: CONSENT_NAMES[c.kind] ?? c.kind,
        durum: c.granted ? 'Verdi' : 'Vermedi',
        surum: c.textKey && c.textVersion ? `${c.textKey} s.${c.textVersion}` : '—',
        zaman: c.createdAt,
        kanal: c.channel === 'ios' ? 'iOS' : c.channel === 'android' ? 'Android' : 'Web',
      })),
    };
  }
}

function kaynakAd(r: { verification: string; channel: string }) {
  return r.verification === 'hesap_kodu'
    ? 'Hesaptan · doğrulama koduyla'
    : `${r.channel === 'posta' ? 'Posta' : 'E-posta'} · kimlik doğrulandı`;
}
