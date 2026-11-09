import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { uuidv7 } from '@rengarenk/db';
import {
  AGENT_ACTION_KINDS,
  BUILTIN_ROLES,
  DISPOSAL_KINDS,
  STAFF_ALERT_KEYS,
  STAFF_ALERT_LIMITS,
  STAFF_ALERT_RULES,
  type StaffAlertKey,
  type StaffAlertRule,
  tlYaz,
  VERBIS_THRESHOLDS,
} from '@rengarenk/shared';
import { AuditService } from '../audit/audit.service.js';
import { ENV, type Env } from '../config/env.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { EMAIL_SENDER, type EmailSender } from '../notifications/channels.js';
import { grantsFor } from '../staff/permissions.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const EPOSTA_DENEME = 5;

/** Olay → uyarı (outbox'tan işçiye gelen olaylar) */
export const STAFF_ALERT_EVENTS = [
  'calisan.yeni_cihaz',
  'calisan.kurtarma_kodu_kullandi',
  'ihlal.basladi',
  'imha.yapildi',
  'onay.istendi',
  'iade.yurutuldu',
  'iade.basarisiz',
  'iade.belirsiz',
  'odeme.uyusmazlik',
  'magaza.iade_bildirimi',
  'magaza.inceleme',
  'abonelik.bildirim_gelmedi',
  'ajan.ozet',
  'galeri.onaylandi',
  'ayar.degisti',
  'yz.butce_uyari',
  'yz.butce_doldu',
  'bildirim.ticari_durduruldu',
  'katalog.kaynak_gecikti',
  'katalog.reddedildi',
] as const;
export type StaffAlertEvent = (typeof STAFF_ALERT_EVENTS)[number];

const ROL_ADI: Record<string, string> = Object.fromEntries(BUILTIN_ROLES.map((r) => [r.key, r.ad]));
const saat = (d: Date) =>
  new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  }).format(d);
const gunAy = (d: Date) =>
  new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' }).format(d);
const yuzde = (v: number) =>
  `%${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(v * 100)}`;
const usd = (v: number) => `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(v)} USD`;

/** "Elif K." (çalışanın adı; e-posta şirket hesabına gider) */
const kisaAd = (name: string) => {
  const p = name.trim().split(/\s+/);
  return p.length > 1 ? `${p.slice(0, -1).join(' ')} ${p.at(-1)?.slice(0, 1)}.` : (p[0] ?? 'Bir çalışan');
};

export interface AlertInput {
  /** Kural içinde tekrarı önleyen anahtar */
  dedupe: string;
  title: string;
  body: string;
  /** Kuralın ekranı yerine başka bir ekran */
  link?: string;
}

/**
 * Çalışan uyarıları (Karar 03, 40, 41, 57, 58, 59). Olaylar ve dönemsel denetimler uyarı açar; alıcı başına bir satır
 * yazılır ve e-postayla şirket adresine gider. Kritik uyarılar kapatılamaz. Metin kişisel veri taşımaz.
 */
@Injectable()
export class StaffAlertService {
  private readonly log = new Logger(StaffAlertService.name);

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    private readonly audit: AuditService,
    @Optional() @Inject(EMAIL_SENDER) private readonly email?: EmailSender,
  ) {}

  private async acik(rule: StaffAlertKey) {
    const r: StaffAlertRule = STAFF_ALERT_RULES[rule];
    if (r.kritik) return true;
    const s = await this.db.staffAlertSetting.findUnique({ where: { rule } });
    return s?.enabled ?? true;
  }

  /** Kuralın alıcıları: Sahip her zaman; ayrıca kuralın yetkisine ya da rolüne sahip etkin çalışanlar (ajan hariç) */
  async alicilar(rule: StaffAlertKey) {
    const r: StaffAlertRule = STAFF_ALERT_RULES[rule];
    const staff = await this.db.staffMember.findMany({
      where: { status: 'ACTIVE', role: { not: 'AGENT' } },
      include: { customRole: true },
      orderBy: { createdAt: 'asc' },
    });
    return staff.filter(
      (s) =>
        s.role === 'OWNER' ||
        (r.roller as readonly string[] | undefined)?.includes(s.role) ||
        (r.izin ? Boolean(grantsFor(s)[r.izin]) : false),
    );
  }

  /** Uyarıyı açar; aynı anahtarla ikinci kez açılmaz. Açılan satır sayısını döner. */
  async raise(rule: StaffAlertKey, input: AlertInput): Promise<number> {
    if (!(await this.acik(rule))) return 0;
    const r: StaffAlertRule = STAFF_ALERT_RULES[rule];
    const alicilar = await this.alicilar(rule);
    if (alicilar.length === 0) return 0;
    const n = await this.db.staffAlert.createMany({
      data: alicilar.map((s) => ({
        id: uuidv7(),
        staffId: s.id,
        rule,
        dedupeKey: `${rule}:${input.dedupe}`,
        critical: r.kritik,
        title: input.title.slice(0, 200),
        body: input.body.slice(0, 2000),
        link: input.link ?? r.yol,
      })),
      skipDuplicates: true,
    });
    return n.count;
  }

  // ── Olaylar ────────────────────────────────────────────────

  private async calisan(id: string) {
    const s = await this.db.staffMember.findUnique({
      where: { id },
      select: { name: true, role: true, customRole: { select: { name: true } } },
    });
    return s
      ? { ad: kisaAd(s.name), rol: s.customRole?.name ?? ROL_ADI[s.role] ?? s.role }
      : { ad: 'Bir çalışan', rol: '' };
  }

  async onEvent(type: StaffAlertEvent, p: Record<string, unknown>): Promise<number> {
    const s = (k: string) => String(p[k] ?? '');
    switch (type) {
      case 'calisan.yeni_cihaz': {
        const c = await this.calisan(s('staffId'));
        const ilk = p.ilkGiris === true;
        return this.raise('yeni_cihaz', {
          dedupe: s('deviceId'),
          title: ilk ? `Çalışan ilk kez giriş yaptı: ${c.ad}` : `Yeni cihazdan giriş: ${c.ad}`,
          body: `${c.ad} (${c.rol}) ${ilk ? 'konsola ilk kez giriş yaptı' : 'konsola yeni bir cihazdan giriş yaptı'}. Tanımıyorsan Çalışanlar ekranından oturumlarını kapat ve hesabı durdur.`,
          link: '/calisanlar',
        });
      }
      case 'calisan.kurtarma_kodu_kullandi': {
        const id = s('staffId');
        const c = await this.calisan(id);
        const kalan = await this.db.staffRecoveryCode.count({ where: { staffId: id, usedAt: null } });
        return this.raise('kurtarma_kodu', {
          dedupe: `${id}:${kalan}`,
          title: `Kurtarma koduyla giriş: ${c.ad}`,
          body: `${c.ad} (${c.rol}) doğrulama uygulaması yerine kurtarma koduyla giriş yaptı; ${kalan} kodu kaldı. Çalışan telefonunu kaybettiyse doğrulama uygulamasını yeniden kurmalı.`,
          link: '/calisanlar',
        });
      }
      case 'ihlal.basladi': {
        const b = await this.db.breachIncident.findUnique({ where: { id: s('breachId') } });
        if (!b || b.drill) return 0;
        return this.raise('ihlal', {
          dedupe: b.id,
          title: `Veri ihlali kaydı açıldı: İ-${b.no}`,
          body: `Kurul’a bildirim için son tarih ${saat(b.deadline)} (öğrenildiği andan 72 saat). Adımlar Veri ihlali ekranında.`,
        });
      }
      case 'imha.yapildi': {
        const r = await this.db.disposalRun.findUnique({ where: { id: s('runId') } });
        if (!r) return 0;
        const rapor = (r.report ?? {}) as { kalemler?: { kalem: string; imha: number }[] };
        const toplam = (rapor.kalemler ?? []).reduce((a, k) => a + (k.imha ?? 0), 0);
        return this.raise('imha_yapildi', {
          dedupe: r.id,
          title: `Periyodik imha yapıldı: ${r.no}`,
          body: `Onaylı liste uygulandı${toplam ? `: ${toplam} kayıt imha edildi` : ''}. Tutanak Saklama, imha ve VERBİS ekranında.`,
        });
      }
      case 'onay.istendi': {
        if (s('kind') !== 'REFUND') return 0;
        const a = await this.db.approval.findUnique({ where: { id: s('approvalId') } });
        if (!a) return 0;
        const veri = (a.payload ?? {}) as { kapanis?: boolean };
        return this.raise('iade_onayi', {
          dedupe: a.id,
          title: `Onayını bekleyen iade: ${tlYaz(Number(a.amountKurus ?? 0n))}`,
          body: `${veri.kapanis ? 'Hesap kapatma nedeniyle ajan' : 'Bir çalışan'} iade önerdi. İade yalnızca senin onayınla yürütülür; onay 7 gün içinde verilmezse istek düşer.`,
        });
      }
      case 'iade.yurutuldu': {
        const r = await this.db.refund.findUnique({ where: { id: s('refundId') } });
        if (!r) return 0;
        return this.raise('iade_sonucu', {
          dedupe: `${r.id}:yurutuldu`,
          title: `İade yürütüldü: ${tlYaz(Number(r.amountKurus))}`,
          body: 'Ödeme kuruluşu iadeyi kabul etti; iade faturası işçide kesilir.',
        });
      }
      case 'iade.basarisiz':
        return this.raise('iade_sonucu', {
          dedupe: `${s('approvalId') || s('refundId')}:basarisiz`,
          title: 'İade yürütülemedi',
          body: `Neden: ${s('neden') || 'ödeme kuruluşu reddetti'}. Para iadesi yapılmadı; gerekirse yeni öneri açılır.`,
        });
      case 'iade.belirsiz': {
        const r = await this.db.refund.findUnique({ where: { id: s('refundId') } });
        return this.raise('iade_belirsiz', {
          dedupe: s('refundId'),
          title: `Sonucu belirsiz iade${r ? `: ${tlYaz(Number(r.amountKurus))}` : ''}`,
          body: 'Ödeme kuruluşundan sonuç alınamadı. İade yeniden denenmez; ödeme kuruluşu panelinden kontrol edip sonucu kaydet.',
        });
      }
      case 'odeme.uyusmazlik':
        return this.raise('odeme_inceleme', {
          dedupe: `uyusmazlik:${s('orderId')}`,
          title: 'Ödeme tutarı siparişle uyuşmuyor',
          body: `Hak tanımlanmadı; sipariş incelemede.${p.neden ? ` ${s('neden')}` : ''}`,
        });
      case 'magaza.iade_bildirimi':
        return this.raise('odeme_inceleme', {
          dedupe: `magaza-iade:${s('eventId') || s('orderId')}`,
          title: 'Mağazadan iade bildirimi',
          body: 'Mağaza bir satışı iade etti; kullanılmamış hak düşüldü. Ayrıntı Ödemeler ekranında.',
        });
      case 'magaza.inceleme':
        return this.raise('odeme_inceleme', {
          dedupe: `magaza:${s('eventId')}`,
          title: 'Tanınmayan mağaza satışı',
          body: 'Mağaza bildirimi bir hesapla eşleşmedi; elle inceleme gerekiyor.',
        });
      case 'abonelik.bildirim_gelmedi':
        return this.raise('odeme_inceleme', {
          dedupe: `abonelik:${s('orderId')}`,
          title: 'Otomatik çekimin bildirimi gelmedi',
          body: 'Galeri aboneliğinin yenileme çekiminden ödeme kuruluşu sonuç bildirmedi; ödeme kuruluşu panelinden kontrol et.',
        });
      case 'ajan.ozet': {
        const a = await this.db.agentAction.findUnique({ where: { id: s('actionId') } });
        if (!a) return 0;
        return this.raise('ajan_ozet', {
          dedupe: a.id,
          title: `Ajanın günlük özeti · ${gunAy(a.createdAt)}`,
          body: `${a.reason}\n\n${await this.ozetEki(a.createdAt)}`,
        });
      }
      case 'galeri.onaylandi':
        if (p.ajan !== true) return 0;
        return this.raise('ajan_galeri', {
          dedupe: s('applicationId'),
          title: 'Ajan bir galeri başvurusunu onayladı',
          body: 'Yetki belgesi, vergi numarası ve MERSİS kontrollerinin hepsi geçti. Yanlışsa Rengarenk Ajanı › Bugün yaptıkları’ndan geri al.',
        });
      case 'ayar.degisti': {
        if (s('key') !== 'ajan') return 0;
        const acik = p.enabled === true;
        return this.raise('ajan_durdu', {
          dedupe: `${acik ? 'basladi' : 'durdu'}:${Math.floor(Date.now() / 60_000)}`,
          title: acik ? 'Rengarenk Ajanı yeniden başladı' : 'Rengarenk Ajanı durduruldu',
          body: acik
            ? 'Ajan otomatik işlerine yeniden başladı.'
            : 'Kapora kontrolü, galeri başvurusu onayı ve ticari e-postayı durdurma artık insana kalır.',
        });
      }
      case 'yz.butce_uyari':
      case 'yz.butce_doldu': {
        const doldu = type === 'yz.butce_doldu';
        const sinir = Number(p.sinirUsd ?? 0);
        return this.raise('yz_butce', {
          dedupe: `${s('ay')}:${doldu ? 'sinir' : 'yuzde80'}`,
          title: doldu ? 'Yapay zekâ bütçesi doldu' : 'Yapay zekâ bütçesinin %80’i kullanıldı',
          body: `Bu ay ${usd(Number(p.harcamaUsd ?? 0))} harcandı, sınır ${usd(sinir)}. ${
            doldu
              ? 'Ay sonuna kadar yalnızca kritik görevler (moderasyon, mesaj güvenliği) çalışır; sınırı artırabilirsin.'
              : 'Sınıra ulaşılırsa yalnızca kritik görevler çalışır.'
          }`,
        });
      }
      case 'bildirim.ticari_durduruldu':
        return this.raise('ticari_durdu', {
          dedupe: `${Math.floor(Date.now() / HOUR)}`,
          title: 'Ticari e-posta kendiliğinden durdu',
          body: `${s('neden') || 'E-posta itibarı sınırı aşıldı'}. İşlem e-postaları gitmeye devam eder; Bildirim merkezinden yeniden başlatılır.`,
        });
      case 'katalog.kaynak_gecikti':
        return this.raise('katalog', {
          dedupe: `gecikti:${s('source')}:${Math.floor(Date.now() / DAY)}`,
          title: `Katalog kaynağı 48 saattir güncellenemedi: ${s('source')}`,
          body: `${p.lastError ? `Son hata: ${s('lastError').slice(0, 300)}. ` : ''}Dosya konsoldan yüklenebilir.`,
        });
      case 'katalog.reddedildi':
        return this.raise('katalog', {
          dedupe: `red:${s('importId')}`,
          title: `Katalog dosyası kalite kontrolünden geçmedi: ${s('source')}`,
          body: `Sürüm ${s('version') || '—'} yayına alınmadı; önceki liste geçerli.`,
        });
    }
    return 0;
  }

  /** Günlük özetin ikinci ve üçüncü bölümü (tasarım: dikkat isteyenler, ajanın yaptıkları); yalnızca sayılar */
  private async ozetEki(at: Date) {
    const once = new Date(at.getTime() - DAY);
    const [onay, sikayet, destek, kvkk, basvuru, islemler] = await Promise.all([
      this.db.approval.count({ where: { status: 'PENDING' } }),
      this.db.report.count({ where: { status: 'acik' } }),
      this.db.supportTicket.count({ where: { status: 'acik' } }),
      this.db.kvkkRequest.count({ where: { status: 'acik' } }),
      this.db.galleryApplication.count({ where: { status: { in: ['IN_REVIEW', 'DOCS_REQUESTED'] } } }),
      this.db.agentAction.groupBy({
        by: ['kind'],
        where: { createdAt: { gte: once, lt: at }, kind: { not: 'ozet' } },
        _count: { _all: true },
      }),
    ]);
    const dikkat = [
      onay && `${onay} onay isteği`,
      sikayet && `${sikayet} açık şikâyet`,
      destek && `${destek} açık destek talebi`,
      kvkk && `${kvkk} KVKK başvurusu`,
      basvuru && `${basvuru} galeri başvurusu incelemede`,
    ].filter(Boolean);
    const yaptiklari = islemler
      .filter((g) => g._count._all > 0)
      .map((g) => {
        const ad = (AGENT_ACTION_KINDS as Record<string, { ad: string }>)[g.kind]?.ad ?? g.kind;
        return `${g._count._all} ${ad.toLocaleLowerCase('tr-TR')}`;
      });
    return [
      `Dikkat isteyenler: ${dikkat.length ? dikkat.join(', ') : 'bekleyen iş yok'}.`,
      `Ajanın son 24 saatte yaptıkları: ${yaptiklari.length ? yaptiklari.join(', ') : 'otomatik işlem yok'}.`,
    ].join('\n');
  }

  // ── Dönemsel denetimler (işçi, saatte bir) ─────────────────

  async denetle(now = new Date()) {
    const sonuc = {
      kvkk: await this.kvkkSure(now),
      imha: await this.imhaOnayi(now),
      verbis: await this.verbis(now),
      odeme: await this.odemeHatasi(now),
      ajan: await this.ajanGeriAlma(now),
      olcu: await this.anaOlcu(now),
    };
    return sonuc;
  }

  /** KVKK başvurusunda yasal süreye 7 gün kala (Karar 58) */
  async kvkkSure(now = new Date()) {
    const rows = await this.db.kvkkRequest.findMany({
      where: {
        status: 'acik',
        dueAt: { lte: new Date(now.getTime() + STAFF_ALERT_LIMITS.kvkkKalanGun * DAY) },
      },
      select: { id: true, no: true, dueAt: true },
    });
    let n = 0;
    for (const r of rows) {
      const kalan = Math.ceil((r.dueAt.getTime() - now.getTime()) / DAY);
      n += await this.raise('kvkk_sure', {
        dedupe: r.id,
        title: `KVKK başvurusu K-${r.no}: ${kalan > 0 ? `${kalan} gün kaldı` : 'süre doldu'}`,
        body: `Yasal son tarih ${gunAy(r.dueAt)} (KVKK m.13, 30 gün). Başvuru KVKK başvuruları ekranında.`,
      });
    }
    return n;
  }

  /** Periyodik imhaya 14 gün kala liste onaylanmamışsa (Karar 59) */
  async imhaOnayi(now = new Date()) {
    const r = await this.db.disposalRun.findFirst({
      where: {
        status: 'liste',
        scheduledFor: { gt: now, lte: new Date(now.getTime() + STAFF_ALERT_LIMITS.imhaKalanGun * DAY) },
      },
      orderBy: { scheduledFor: 'asc' },
    });
    if (!r) return 0;
    const counts = (r.counts ?? {}) as Record<string, number>;
    const toplam = Object.keys(DISPOSAL_KINDS).reduce((a, k) => a + (counts[k] ?? 0), 0);
    return this.raise('imha_onayi', {
      dedupe: r.id,
      title: `İmha listesi onayını bekliyor: ${r.no}`,
      body: `Dönem günü ${gunAy(r.scheduledFor)}. Ajanın son sayımında ${toplam} kayıt var; liste onaylanmazsa imha yapılmaz.`,
    });
  }

  /** VERBİS muafiyet eşiği: %80'e ulaşınca ve aşınca bir kez (yıl başına) */
  async verbis(now = new Date()) {
    const [calisan, ciro] = await Promise.all([
      this.db.staffMember.count({ where: { role: { not: 'AGENT' }, status: 'ACTIVE' } }),
      this.db.order.aggregate({
        where: { status: 'PAID', paidAt: { gte: new Date(now.getTime() - 365 * DAY) } },
        _sum: { totalKurus: true },
      }),
    ]);
    const tl = Number(ciro._sum.totalKurus ?? 0n) / 100;
    const yil = now.getUTCFullYear();
    let n = 0;
    for (const [ad, deger, esik, bicim] of [
      ['calisan', calisan, VERBIS_THRESHOLDS.calisan, `${calisan} çalışan`],
      [
        'bilanco',
        tl,
        VERBIS_THRESHOLDS.bilancoTl,
        `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(tl / 1_000_000)} milyon TL yıllık satış`,
      ],
    ] as const) {
      const oran = deger / esik;
      if (oran < STAFF_ALERT_LIMITS.verbisOrani) continue;
      const asildi = oran >= 1;
      n += await this.raise('verbis', {
        dedupe: `${yil}:${ad}:${asildi ? 'asildi' : 'yaklasti'}`,
        title: asildi ? 'VERBİS kaydı gerekiyor' : 'VERBİS eşiğine yaklaşıldı',
        body: `${bicim}: eşiğin ${yuzde(oran)}’i. ${
          asildi
            ? 'Muafiyet koşulu aşıldı; VERBİS’e kayıt yapılmalı.'
            : 'Eşik aşılırsa VERBİS’e kayıt gerekir (Kurul kararı 2018/87).'
        }`,
      });
    }
    return n;
  }

  /** Son bir saatte ödeme hatası oranı %5'i aşarsa (YonetimRapor › Kritik uyarılar) */
  async odemeHatasi(now = new Date()) {
    const from = new Date(now.getTime() - HOUR);
    const [hata, basari] = await Promise.all([
      this.db.order.count({ where: { status: 'FAILED', createdAt: { gte: from, lte: now } } }),
      this.db.order.count({ where: { status: 'PAID', createdAt: { gte: from, lte: now } } }),
    ]);
    const toplam = hata + basari;
    if (toplam < STAFF_ALERT_LIMITS.odemeEnAzDeneme) return 0;
    const oran = hata / toplam;
    if (oran <= STAFF_ALERT_LIMITS.odemeHataOrani) return 0;
    return this.raise('odeme_hatasi', {
      dedupe: `${Math.floor(now.getTime() / HOUR)}`,
      title: `Ödeme hatası oranı ${yuzde(oran)}`,
      body: `Son bir saatte ${toplam} ödemenin ${hata} tanesi başarısız oldu (sınır %5). Ödeme kuruluşunun durumunu kontrol et.`,
    });
  }

  /**
   * Ana ölçü (Karar 44): 48 saat içinde en az bir satıcının yazdığı talep oranı. 48 saati dolan son 24 saatlik
   * yayınlar bir önceki 24 saatle karşılaştırılır; 5 puandan fazla düşerse günde bir uyarı.
   */
  async anaOlcu(now = new Date()) {
    const oran = async (bas: Date, bit: Date) => {
      const [r] = await this.db.$queryRaw<{ toplam: bigint; alan: bigint }[]>`
        SELECT count(*) AS toplam,
               count(*) FILTER (WHERE EXISTS (
                 SELECT 1 FROM conversations c
                 WHERE c.demand_id = d.id AND c.origin = 'talep'
                   AND c.created_at <= d.published_at + interval '48 hours')) AS alan
        FROM demands d
        WHERE d.published_at >= ${bas} AND d.published_at < ${bit}`;
      const toplam = Number(r?.toplam ?? 0);
      return { toplam, oran: toplam ? Number(r?.alan ?? 0) / toplam : 0 };
    };
    const t = now.getTime();
    const [son, once] = await Promise.all([
      oran(new Date(t - 72 * HOUR), new Date(t - 48 * HOUR)),
      oran(new Date(t - 96 * HOUR), new Date(t - 72 * HOUR)),
    ]);
    if (son.toplam < STAFF_ALERT_LIMITS.anaOlcuEnAz || once.toplam < STAFF_ALERT_LIMITS.anaOlcuEnAz) return 0;
    const fark = (once.oran - son.oran) * 100;
    if (fark <= STAFF_ALERT_LIMITS.anaOlcuPuan) return 0;
    return this.raise('ana_olcu', {
      dedupe: `${Math.floor(t / DAY)}`,
      title: `Ana ölçü ${Math.round(fark)} puan düştü: ${yuzde(son.oran)}`,
      body: `48 saat içinde ilk mesaj alan talep oranı bir önceki günde ${yuzde(once.oran)} iken ${yuzde(son.oran)} oldu (${son.toplam} talep). Rengarenk Ajanı › Ajana sor ile il ve kategori kırılımına bakabilirsin.`,
    });
  }

  /** Ajanın geri alınan işlem oranı son 7 günde %5'i aşarsa (haftada bir) */
  async ajanGeriAlma(now = new Date()) {
    const from = new Date(now.getTime() - 7 * DAY);
    const where = {
      kind: { in: ['mesaj_gizle', 'galeri_onay', 'ticari_durdur'] },
      createdAt: { gte: from, lte: now },
    };
    const [toplam, geri] = await Promise.all([
      this.db.agentAction.count({ where }),
      this.db.agentAction.count({ where: { ...where, undoneAt: { not: null } } }),
    ]);
    if (toplam < STAFF_ALERT_LIMITS.ajanEnAzIslem) return 0;
    const oran = geri / toplam;
    if (oran <= STAFF_ALERT_LIMITS.ajanGeriAlmaOrani) return 0;
    return this.raise('ajan_geri_alma', {
      dedupe: `${Math.floor(now.getTime() / (7 * DAY))}`,
      title: `Ajanın işlemlerinin ${yuzde(oran)}’i geri alındı`,
      body: `Son 7 günde ajanın ${toplam} işleminden ${geri} tanesi geri alındı (sınır %5). Kurallarını gözden geçir ya da ajanı durdur.`,
    });
  }

  // ── E-posta teslimi (işçi) ─────────────────────────────────

  /** Bekleyen uyarıları şirket adresine gönderir; kanal yoksa "yok" olarak işaretler */
  async teslim(limit = 50) {
    if (!this.email) return 0;
    const rows = await this.db.staffAlert.findMany({
      where: { emailStatus: 'bekliyor' },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    if (rows.length === 0) return 0;
    const staff = await this.db.staffMember.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.staffId))] } },
      select: { id: true, email: true, status: true },
    });
    const adres = new Map(staff.map((s) => [s.id, s]));
    let n = 0;
    for (const a of rows) {
      const s = adres.get(a.staffId);
      if (s?.status !== 'ACTIVE' || this.email.ad === 'none') {
        await this.db.staffAlert.update({ where: { id: a.id }, data: { emailStatus: 'yok' } });
        continue;
      }
      const url = `${this.env.ADMIN_ORIGIN}${a.link}`;
      const konu = `${a.critical ? '[Kritik] ' : ''}${a.title}`;
      const r = await this.email.send({
        to: s.email,
        from: this.env.EPOSTA_GONDEREN,
        subject: `Rengarenk yönetim · ${konu}`,
        text: `${a.body}\n\nKonsolda aç: ${url}\n\nBu e-posta Rengarenk yönetim konsolunun çalışan uyarısıdır.`,
        html: `<p style="font:15px/1.5 system-ui,sans-serif;color:#1E2333"><strong>${kacir(konu)}</strong></p><p style="font:14px/1.5 system-ui,sans-serif;color:#3A4052">${kacir(a.body).replace(/\n/g, '<br>')}</p><p><a href="${kacir(url)}" style="font:600 14px system-ui,sans-serif;color:#2450C8">Konsolda aç</a></p><p style="font:12px system-ui,sans-serif;color:#5A6073">Bu e-posta Rengarenk yönetim konsolunun çalışan uyarısıdır.</p>`,
      });
      const deneme = a.emailTries + 1;
      const durum =
        r.status === 'sent'
          ? 'gonderildi'
          : r.status === 'permanent' || deneme >= EPOSTA_DENEME
            ? 'hata'
            : 'bekliyor';
      await this.db.staffAlert.update({
        where: { id: a.id },
        data: {
          emailStatus: durum,
          emailTries: deneme,
          emailedAt: durum === 'gonderildi' ? new Date() : null,
        },
      });
      if (durum === 'gonderildi') n++;
      else if (durum === 'hata') this.log.warn(`çalışan uyarısı e-postası gönderilemedi: ${r.message ?? ''}`);
    }
    return n;
  }

  // ── Konsol ─────────────────────────────────────────────────

  unreadCount(staffId: string) {
    return this.db.staffAlert.count({ where: { staffId, readAt: null } });
  }

  async list(staffId: string) {
    const [rows, okunmamis] = await Promise.all([
      this.db.staffAlert.findMany({ where: { staffId }, orderBy: { createdAt: 'desc' }, take: 100 }),
      this.unreadCount(staffId),
    ]);
    return {
      okunmamis,
      uyarilar: rows.map((a) => ({
        id: a.id,
        kural: a.rule,
        kuralAdi: (STAFF_ALERT_RULES as Record<string, StaffAlertRule>)[a.rule]?.ad ?? a.rule,
        kritik: a.critical,
        baslik: a.title,
        metin: a.body,
        yol: a.link,
        okundu: a.readAt !== null,
        eposta: a.emailStatus,
        zaman: a.createdAt,
      })),
    };
  }

  async read(staffId: string, b: { ids?: string[]; hepsi?: boolean }) {
    const r = await this.db.staffAlert.updateMany({
      where: { staffId, readAt: null, ...(b.hepsi ? {} : { id: { in: b.ids ?? [] } }) },
      data: { readAt: new Date() },
    });
    return { okundu: r.count };
  }

  /** Zamanlanmış raporlar ve uyarılar: kurallar, alıcılar, kanal ve açık/kapalı */
  async rules(viewer: { id: string }) {
    const ayarlar = new Map((await this.db.staffAlertSetting.findMany()).map((s) => [s.rule, s.enabled]));
    const out = [];
    for (const key of STAFF_ALERT_KEYS) {
      const r: StaffAlertRule = STAFF_ALERT_RULES[key];
      const alicilar = await this.alicilar(key);
      const adlar = alicilar.map((s) => (s.id === viewer.id ? 'Sen' : kisaAd(s.name)));
      // "Sen" başta
      adlar.sort((a, b) => (a === 'Sen' ? -1 : b === 'Sen' ? 1 : 0));
      out.push({
        key,
        ad: r.ad,
        kosul: r.kosul,
        kritik: r.kritik,
        acik: r.kritik ? true : (ayarlar.get(key) ?? true),
        kanal: 'Konsol ve e-posta',
        alicilar: adlar,
      });
    }
    return out;
  }

  /** Kritik olmayan kuralı kapatır ya da açar; yalnızca Sahip (işlem kaydına girer) */
  async setRule(actor: { id: string; role: string }, rule: StaffAlertKey, enabled: boolean, ip?: string) {
    if (actor.role !== 'OWNER') throw new ForbiddenException('Uyarı kurallarını yalnızca sahip değiştirir');
    const r: StaffAlertRule = STAFF_ALERT_RULES[rule];
    if (r.kritik) throw new BadRequestException('Kritik uyarılar kapatılamaz');
    await this.db.$transaction(async (tx) => {
      const once = await tx.staffAlertSetting.findUnique({ where: { rule } });
      await tx.staffAlertSetting.upsert({
        where: { rule },
        update: { enabled, updatedBy: actor.id },
        create: { rule, enabled, updatedBy: actor.id },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: actor.id,
          action: 'uyari_kurali_degisti',
          entityType: 'staff_alert_rule',
          entityId: rule,
          before: { acik: once?.enabled ?? true },
          after: { acik: enabled },
          ip,
        },
        tx,
      );
    });
    return { key: rule, acik: enabled };
  }
}

const kacir = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
