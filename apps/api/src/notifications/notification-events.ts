import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  DEMAND_TEXT_FLAGS,
  type DemandTextFlag,
  FLAG_TITLES,
  GALLERY_PLANS,
  GRANT_KINDS,
  type GrantKind,
  hideDemandText,
  LEGAL_PATHS,
  LEGAL_TEXTS,
  type LegalKey,
  type MessageFlag,
  type PaidPlanKey,
  type PriceBook,
  REPORT_REASONS,
  type ReportReasonKey,
  tlYaz,
} from '@rengarenk/shared';
import { type Db, PRISMA } from '../database/prisma.js';
import { kalemler } from '../payments/order-item.js';
import { vehicleNames } from '../portfolio/vehicle-names.js';
import { DemandSearchService } from '../search/demand-search.service.js';
import { SupportService } from '../support/support.service.js';
import { DeliveryService } from './delivery.service.js';
import { FlowService } from './flows.js';
import { NotificationService } from './notification.service.js';

const DAY = 86_400_000;
/** Moderasyon kararının kullanıcıya görünen adı (hedef türüne göre) */
const KARAR_METNI: Record<string, Record<string, string>> = {
  mesaj: {
    uyari: 'Uyarı',
    gizle: 'Mesajın gizlendi',
    aski: '24 saat askı: mesaj gönderemezsin',
    engel: 'Hesabın incelemede: kalıcı engelleme önerildi',
  },
  talep: {
    uyari: 'Uyarı',
    gizle: 'Talebin yayından kaldırıldı',
    aski: '24 saat askı: mesaj gönderemezsin',
    engel: 'Hesabın incelemede: kalıcı engelleme önerildi',
  },
  arac: {
    uyari: 'Uyarı',
    gizle: 'Aracın yayından kaldırıldı',
    aski: '24 saat askı: mesaj gönderemezsin',
    engel: 'Hesabın incelemede: kalıcı engelleme önerildi',
  },
  kullanici: {
    uyari: 'Uyarı',
    aski: '24 saat askı: mesaj gönderemezsin',
    engel: 'Hesabın incelemede: kalıcı engelleme önerildi',
  },
};
const kisa = (s: string, n = 30) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const tarih = (d: Date | string) =>
  new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' }).format(
    new Date(d),
  );

/** Bildirime dönüşen olaylar (outbox → kuyruk → bu eşleme → bildirim katmanı) */
export const NOTIFY_EVENTS = [
  'talep.suresi_doluyor',
  'talep.suresi_doldu',
  'talep.yayinlandi',
  'talep.duzeltme_istendi',
  'mesaj.ilk',
  'mesaj.geldi',
  'mesaj.uyari',
  'eslesme.bulundu',
  'takip.ozet',
  'odeme.alindi',
  'abonelik.odeme_basarisiz',
  'abonelik.yenileme_yaklasti',
  'abonelik.bitti',
  'iade.yurutuldu',
  'galeri.onaylandi',
  'galeri.reddedildi',
  'galeri.belge_istendi',
  'galeri.deneme_bitiyor',
  'galeri.deneme_bitti',
  'portfoy.eids_reddedildi',
  'kullanici.kaydoldu',
  'moderasyon.karar',
  'moderasyon.ajan_aski',
  'moderasyon.itiraz_sonuc',
  'yildiz.itiraz_sonuc',
  'hesap.telefon_degisti',
  'fiyat.zamanlandi',
  'hak.tanimlandi',
  'destek.yanitlandi',
  'destek.memnuniyet',
  'veri.hazir',
  'kvkk.yanitlandi',
  'resmi.yanitlandi',
  'yasal.guncellendi',
] as const;
export type NotifyEvent = (typeof NOTIFY_EVENTS)[number];

/**
 * Olay → alıcılar ve şablon değişkenleri (Karar 48). Kişisel veri olay yükünde taşınmaz; burada veritabanından okunur.
 * Galeri olayları hesabın sahip ve yöneticilerine gider (eşleşme bildirimi satış temsilcilerine de).
 */
@Injectable()
export class NotificationEvents {
  private readonly log = new Logger(NotificationEvents.name);

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly notifications: NotificationService,
    private readonly search: DemandSearchService,
    @Optional() private readonly support?: SupportService,
    @Optional() private readonly teslim?: DeliveryService,
    @Optional() private readonly flows?: FlowService,
  ) {}

  private async ekip(accountId: string, satisDahil = false) {
    const m = await this.db.accountMember.findMany({
      where: { accountId, role: { in: satisDahil ? ['OWNER', 'MANAGER', 'SALES'] : ['OWNER', 'MANAGER'] } },
      select: { userId: true },
    });
    return m.map((x) => x.userId);
  }

  /** "Ayşe Y." */
  private async kisi(userId: string) {
    const u = await this.db.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    return (
      [u?.firstName, u?.lastName ? `${u.lastName.slice(0, 1)}.` : null].filter(Boolean).join(' ') ||
      'Bir kullanıcı'
    );
  }

  private async galeriAdi(accountId: string) {
    const g = await this.db.gallery.findUnique({
      where: { accountId },
      select: { displayName: true, slug: true },
    });
    return g ?? { displayName: 'Galerin', slug: '' };
  }

  private async talep(demandId: string) {
    const d = await this.db.demand.findUnique({
      where: { id: demandId },
      select: {
        id: true,
        no: true,
        userId: true,
        title: true,
        headline: true,
        il: true,
        ilce: true,
        publishedAt: true,
      },
    });
    return d ? { ...d, ad: d.headline || d.title || 'Talebin' } : null;
  }

  async handle(type: NotifyEvent, p: Record<string, unknown>) {
    const s = (k: string) => String(p[k] ?? '');
    switch (type) {
      case 'talep.suresi_doluyor':
      case 'talep.suresi_doldu': {
        const d = await this.talep(s('demandId'));
        if (!d) return 0;
        const yazan = await this.db.conversation.count({ where: { demandId: d.id, origin: 'talep' } });
        const veri = { talep: d.ad, talepKisa: kisa(d.ad, 40), gun: p.gun ?? 0, yazan };
        const n = await this.notifications.notify({ userIds: [d.userId], sablon: type, veri });
        // Akışın eklenen adımları (Karar 51): talep ve bitiş tarihi başına bir kez
        if (type === 'talep.suresi_doluyor' && this.flows) {
          const bitis = (
            await this.db.demand.findUnique({ where: { id: d.id }, select: { expiresAt: true } })
          )?.expiresAt;
          await this.flows.baslat(
            'doluyor',
            [d.userId],
            { veri, demandId: d.id, bitis: bitis?.toISOString() },
            `${d.id}:${bitis?.toISOString() ?? ''}`,
          );
        }
        return n;
      }
      case 'talep.yayinlandi': {
        const d = await this.talep(s('demandId'));
        if (!d) return 0;
        const n = await this.notifications.notify({
          userIds: [d.userId],
          sablon: type,
          veri: { talep: d.ad },
        });
        return n + (await this.kayitliAramalar(d));
      }
      case 'talep.duzeltme_istendi': {
        const d = await this.talep(s('demandId'));
        if (!d) return 0;
        const adlar = ((p.isaretler as string[] | undefined) ?? []).map(
          (f) => DEMAND_TEXT_FLAGS[f as DemandTextFlag] ?? f,
        );
        return this.notifications.notify({
          userIds: [d.userId],
          sablon: type,
          veri: {
            // Başlıkta iletişim bilgisi olabilir: bildirimde de gizli
            talep: hideDemandText(d.ad),
            alanlar:
              adlar.length > 1
                ? `${adlar.slice(0, -1).join(', ')} ve ${adlar.at(-1)}`
                : (adlar[0] ?? 'iletişim bilgisi'),
          },
        });
      }
      case 'mesaj.ilk': {
        const c = await this.db.conversation.findUnique({
          where: { id: s('conversationId') },
          include: {
            demand: { select: { title: true, headline: true } },
            sellerAccount: { select: { kind: true, gallery: { select: { displayName: true } } } },
          },
        });
        if (!c) return 0;
        const seller = await this.kisi(c.sellerUserId);
        return this.notifications.notify({
          userIds: [c.buyerUserId],
          sablon: type,
          veri: {
            conversationId: c.id,
            satici: c.sellerAccount.gallery?.displayName ?? seller,
            talep: c.demand?.headline || c.demand?.title || 'Talebin',
          },
        });
      }
      case 'mesaj.geldi':
      case 'mesaj.uyari': {
        const c = await this.db.conversation.findUnique({
          where: { id: s('conversationId') },
          include: {
            demand: { select: { title: true, headline: true } },
            sellerAccount: { select: { gallery: { select: { displayName: true } } } },
          },
        });
        if (!c) return 0;
        // Gönderen: alıcıdan araca mesaj (origin arac, ilk) ya da `side`; alıcıya satıcı yazdıysa
        const side = s('side') || (s('origin') === 'arac' ? 'alici' : '');
        if (side === 'sistem' || !side) return 0;
        const aliciya = side === 'satici';
        const gonderen = aliciya
          ? (c.sellerAccount.gallery?.displayName ?? (await this.kisi(c.sellerUserId)))
          : await this.kisi(c.buyerUserId);
        const flags = (p.flags as MessageFlag[] | undefined) ?? [];
        return this.notifications.notify({
          userIds: [aliciya ? c.buyerUserId : c.sellerUserId],
          sablon: type,
          veri: {
            conversationId: c.id,
            gonderen,
            konu: c.demand?.headline || c.demand?.title || 'Araç',
            neden: flags
              .map((f) => FLAG_TITLES[f]?.replace('Dikkat: bu mesajda ', '').replace(' var.', ''))
              .join(', '),
          },
        });
      }
      case 'eslesme.bulundu': {
        if (!p.anlik) return 0; // fazlası günlük özete (galeri paneli)
        const [d, v, g] = await Promise.all([
          this.talep(s('demandId')),
          this.db.portfolioVehicle.findUnique({ where: { id: s('vehicleId') } }),
          this.galeriAdi(s('accountId')),
        ]);
        if (!d || !v) return 0;
        const ad = (await vehicleNames(this.db, [v]))(v).ad;
        return this.notifications.notify({
          userIds: await this.ekip(s('accountId'), true),
          sablon: type,
          veri: { arac: ad, talep: d.ad, skor: Math.round(Number(p.score ?? 0)), galeri: g.displayName },
        });
      }
      case 'takip.ozet': {
        const g = await this.galeriAdi(s('accountId'));
        return this.notifications.notify({
          userIds: [s('userId')],
          sablon: type,
          veri: {
            galeri: g.displayName,
            slug: g.slug,
            sayi: (p.araclar as unknown[] | undefined)?.length ?? 1,
          },
        });
      }
      case 'odeme.alindi': {
        const o = await this.db.order.findUnique({ where: { id: s('orderId') } });
        if (!o) return 0;
        // Galeri siparişi ekibe değil, ödemeyi yapana; otomatik yenilemede abonelik sahibine
        return this.notifications.notify({
          userIds: [o.userId],
          sablon: type,
          veri: {
            siparis: o.no,
            tutar: tlYaz(Number(o.totalKurus)),
            kalem: kalemler(o.items)
              .map((k) => k.ad)
              .join(', '),
          },
        });
      }
      case 'abonelik.odeme_basarisiz':
      case 'abonelik.yenileme_yaklasti':
      case 'abonelik.bitti':
      case 'galeri.deneme_bitiyor':
      case 'galeri.deneme_bitti': {
        const g = await this.galeriAdi(s('accountId'));
        const ekip = await this.ekip(s('accountId'));
        const veri = {
          galeri: g.displayName,
          galeriKisa: kisa(g.displayName, 24),
          neden: s('neden') || 'Kart reddedildi',
          tarih: p.tarih ? tarih(s('tarih')) : '',
          tutar: p.tutarKurus ? tlYaz(Number(p.tutarKurus)) : '',
          gun: p.kalanGun ?? '',
        };
        const n = await this.notifications.notify({ userIds: ekip, sablon: type, veri });
        // Akışın eklenen adımları: ödeme hatasında sipariş, denemede galeri başına bir kez
        if (this.flows && type === 'abonelik.odeme_basarisiz')
          await this.flows.baslat('odeme', ekip, { veri, accountId: s('accountId') }, s('orderId'));
        if (this.flows && (type === 'galeri.deneme_bitiyor' || type === 'galeri.deneme_bitti'))
          await this.flows.baslat('deneme', ekip, { veri, accountId: s('accountId') }, s('accountId'));
        return n;
      }
      case 'iade.yurutuldu': {
        const r = await this.db.refund.findUnique({
          where: { id: s('refundId') },
          include: { order: { select: { userId: true, no: true } } },
        });
        if (!r?.order) return 0;
        return this.notifications.notify({
          userIds: [r.order.userId],
          sablon: type,
          veri: { siparis: r.order.no, tutar: tlYaz(Number(r.amountKurus)) },
        });
      }
      case 'galeri.onaylandi':
      case 'galeri.reddedildi':
      case 'galeri.belge_istendi': {
        const a = await this.db.galleryApplication.findUnique({
          where: { id: s('applicationId') },
          select: { userId: true, accountId: true, data: true },
        });
        if (!a) return 0;
        const g = a.accountId ? await this.galeriAdi(a.accountId) : null;
        const veri = a.data as { gorunenAd?: string; unvan?: string };
        return this.notifications.notify({
          userIds: [a.userId],
          sablon: type,
          veri: { galeri: g?.displayName ?? veri.gorunenAd ?? veri.unvan ?? 'Galerin' },
        });
      }
      case 'moderasyon.karar': {
        const r = await this.db.report.findUnique({ where: { id: s('reportId') } });
        if (!r?.decision) return 0;
        let n = 0;
        // Şikâyet edene sonuç (şikâyet edilenin adı ve kararın ayrıntısı verilmez)
        if (r.source === 'kullanici' && r.reporterUserId) {
          n += await this.notifications.notify({
            userIds: [r.reporterUserId],
            sablon: 'moderasyon.sikayet_sonuc',
            veri: {
              no: r.no,
              sonuc:
                r.decision === 'red'
                  ? 'İnceledik; kurallarımıza aykırı bir durum bulmadık.'
                  : 'İnceledik ve gerekli işlemi yaptık.',
            },
          });
        }
        // Şikâyet edilene karar ve itiraz bağlantısı; reddedilen şikâyet bildirilmez. Aynı içeriğin diğer şikâyetleri
        // birlikte kapandığında şikâyet edilene tek bildirim gider
        if (r.decision !== 'red' && !p.yalnizcaSikayetEden) {
          n += await this.notifications.notify({
            userIds: [r.targetUserId],
            sablon: 'moderasyon.karar',
            veri: {
              rapor: r.id,
              karar: KARAR_METNI[r.targetType]?.[r.decision] ?? 'Uyarı',
              gerekce: r.decisionNote ?? REPORT_REASONS[r.reason as ReportReasonKey]?.ad ?? '',
            },
          });
        }
        return n;
      }
      case 'destek.yanitlandi':
      case 'destek.memnuniyet': {
        const t = await this.db.supportTicket.findUnique({ where: { id: s('ticketId') } });
        if (!t) return 0;
        const sablon = type === 'destek.yanitlandi' ? 'destek.yanit' : 'destek.memnuniyet';
        const veri = {
          no: t.no,
          numara: `D-${t.no}`,
          konu: kisa(t.subject, 60),
          yanit:
            type === 'destek.yanitlandi' && this.support ? await this.support.replyText(s('messageId')) : '',
        };
        if (t.userId) return this.notifications.notify({ userIds: [t.userId], sablon, veri });
        // E-postayla gelen ve kullanıcıyla eşleşmeyen talep: yanıt doğrudan adrese gider
        if (t.email && this.teslim && type === 'destek.yanitlandi') {
          return (await this.teslim.dogrudanEposta(t.email, sablon, veri)) ? 1 : 0;
        }
        return 0;
      }
      case 'veri.hazir': {
        const e = await this.db.dataExport.findUnique({ where: { id: s('exportId') } });
        if (!e?.expiresAt) return 0;
        return this.notifications.notify({
          userIds: [e.userId],
          sablon: type,
          veri: { tarih: tarih(e.expiresAt) },
        });
      }
      case 'yasal.guncellendi': {
        // Metni onaylamış, hesabı açık kullanıcılar; 500'erli sayfalarla
        const key = s('key');
        const ad = LEGAL_TEXTS[key as LegalKey]?.ad;
        if (!ad) return 0;
        const veri = { metin: ad, surum: s('version'), yol: LEGAL_PATHS[key as LegalKey] ?? 'yardim' };
        let n = 0;
        let after: string | undefined;
        for (;;) {
          const rows = await this.db.consent.findMany({
            where: { textKey: key, granted: true, userId: { not: null, ...(after ? { gt: after } : {}) } },
            distinct: ['userId'],
            orderBy: { userId: 'asc' },
            select: { userId: true },
            take: 500,
          });
          if (!rows.length) break;
          after = rows.at(-1)?.userId as string;
          const acik = await this.db.user.findMany({
            where: {
              id: { in: rows.map((r) => r.userId as string) },
              NOT: { phone: { startsWith: 'kapali:' } },
            },
            select: { id: true },
          });
          n += await this.notifications.notify({ userIds: acik.map((u) => u.id), sablon: type, veri });
        }
        return n;
      }
      case 'resmi.yanitlandi': {
        const r = await this.db.officialRequest.findUnique({ where: { id: s('requestId') } });
        if (!r?.userId || r.noNotify) return 0;
        return this.notifications.notify({
          userIds: [r.userId],
          sablon: 'resmi.bilgi',
          veri: { makam: r.authority },
        });
      }
      case 'kvkk.yanitlandi': {
        const k = await this.db.kvkkRequest.findUnique({ where: { id: s('requestId') } });
        if (!k?.response) return 0;
        const veri = { numara: `K-${k.no}`, yanit: k.response };
        if (k.userId) return this.notifications.notify({ userIds: [k.userId], sablon: 'kvkk.yanit', veri });
        if (k.applicantEmail && this.teslim) {
          return (await this.teslim.dogrudanEposta(k.applicantEmail, 'kvkk.yanit', {
            ...veri,
            ad: k.applicantName ?? '',
          }))
            ? 1
            : 0;
        }
        return 0;
      }
      case 'hak.tanimlandi': {
        const tur = GRANT_KINDS[s('tur') as GrantKind] ?? 'Hak';
        return this.notifications.notify({
          userIds: [s('userId')],
          sablon: type,
          veri: { hak: `${Number(p.adet ?? 0)} ${tur.toLocaleLowerCase('tr-TR')}` },
        });
      }
      case 'moderasyon.ajan_aski': {
        const r = await this.db.report.findUnique({
          where: { id: s('reportId') },
          select: { targetUserId: true, reason: true },
        });
        if (!r) return 0;
        const spam = r.reason === 'spam';
        return this.notifications.notify({
          userIds: [r.targetUserId],
          sablon: 'moderasyon.aski',
          veri: spam
            ? {
                neden: 'Hesabından gelen mesajlar spam kuralına takıldı',
                nedenUzun:
                  'Hesabından kısa sürede çok sayıda talebe aynı mesaj gönderildiği ya da birçok kişi şikâyet ettiği için hesabın kısıtlandı.',
              }
            : {
                neden: 'Bir mesajın güvenlik kurallarına takıldı',
                nedenUzun: 'Gönderdiğin bir mesaj kapora ya da ödeme isteği içerdiği için gizlendi.',
              },
        });
      }
      case 'moderasyon.itiraz_sonuc': {
        const a = await this.db.reportAppeal.findUnique({ where: { id: s('appealId') } });
        if (!a || a.status === 'acik') return 0;
        return this.notifications.notify({
          userIds: [a.userId],
          sablon: type,
          veri: {
            rapor: a.reportId,
            sonuc:
              a.status === 'kabul'
                ? 'İtirazını haklı bulduk; karar geri alındı.'
                : `İtirazını inceledik; karar geçerli.${a.decisionNote ? ` ${a.decisionNote}` : ''}`,
          },
        });
      }
      case 'fiyat.zamanlandi': {
        // Fiyatı değişen paketin aboneleri (Karar 56): yürürlük tarihi ve yenilemeye kadar eski fiyat
        const r = await this.db.priceBook.findUnique({ where: { id: s('priceBookId') } });
        if (r?.status !== 'zamanlandi') return 0;
        const yeni = r.data as unknown as PriceBook;
        const subs = await this.db.subscription.findMany({
          where: { status: { not: 'ENDED' } },
          select: { accountId: true, plan: true, period: true, priceKurus: true },
        });
        let n = 0;
        for (const sub of subs) {
          const p = yeni.paketler[sub.plan as PaidPlanKey];
          if (!p) continue;
          const net = (sub.period === 'aylik' ? p.aylik : p.yillik) * 100;
          if (BigInt(net) === sub.priceKurus) continue;
          const g = await this.galeriAdi(sub.accountId);
          n += await this.notifications.notify({
            userIds: await this.ekip(sub.accountId),
            sablon: 'fiyat.degisiyor',
            veri: {
              galeri: g.displayName,
              paket: GALLERY_PLANS[sub.plan as PaidPlanKey].ad,
              tarih: tarih(r.effectiveAt.toISOString()),
              fiyat: `${tlYaz(net)} + KDV / ${sub.period === 'aylik' ? 'ay' : 'yıl'}`,
            },
          });
        }
        return n;
      }
      case 'hesap.telefon_degisti': {
        const u = await this.db.user.findUnique({ where: { id: s('userId') }, select: { phone: true } });
        if (!u) return 0;
        // Numaranın yalnızca son iki hanesi yazılır
        return this.notifications.notify({
          userIds: [s('userId')],
          sablon: type,
          veri: { tel: `+90 5XX XXX XX ${u.phone.slice(-2)}` },
        });
      }
      case 'yildiz.itiraz_sonuc': {
        const a = await this.db.ratingAppeal.findUnique({ where: { id: s('appealId') } });
        if (!a || a.status === 'acik') return 0;
        const g = await this.galeriAdi(a.accountId);
        return this.notifications.notify({
          userIds: [a.userId],
          sablon: type,
          veri: {
            galeri: g.displayName,
            sonuc:
              a.status === 'kabul'
                ? 'İtirazını haklı bulduk; bu yıldız ortalamana katılmayacak.'
                : `İtirazını inceledik; yıldız geçerli.${a.decisionNote ? ` ${a.decisionNote}` : ''}`,
          },
        });
      }
      case 'kullanici.kaydoldu': {
        const n = await this.notifications.notify({
          userIds: [s('userId')],
          sablon: 'akis.hosgeldin',
          veri: {},
        });
        await this.flows?.baslat('hosgeldin', [s('userId')], { veri: {} }, s('userId'));
        return n;
      }
      case 'portfoy.eids_reddedildi': {
        const v = await this.db.portfolioVehicle.findUnique({ where: { id: s('vehicleId') } });
        if (!v) return 0;
        return this.notifications.notify({
          userIds: await this.ekip(v.accountId),
          sablon: type,
          veri: { arac: (await vehicleNames(this.db, [v]))(v).ad },
        });
      }
    }
  }

  /** Kayıtlı aramalar (Karar 30): yeni talep "anlık" seçili aramalara uyuyorsa sahibine bildirim */
  private async kayitliAramalar(d: {
    id: string;
    no: bigint;
    userId: string;
    ad: string;
    il: string | null;
    ilce: string | null;
    publishedAt: Date | null;
  }) {
    if (!d.publishedAt) return 0;
    const aramalar = await this.db.savedSearch.findMany({
      where: { notify: 'anlik', userId: { not: d.userId } },
    });
    let n = 0;
    for (const a of aramalar) {
      try {
        const r = await this.search.search({
          ...(a.query as Record<string, unknown>),
          boyut: 50,
          yayinSonra: new Date(d.publishedAt.getTime() - 1000),
        } as Parameters<DemandSearchService['search']>[0]);
        if (!r.sonuclar.some((x: { no: number }) => x.no === Number(d.no))) continue;
        n += await this.notifications.notify({
          userIds: [a.userId],
          sablon: 'arama.yeni_talep',
          veri: {
            arama: a.name,
            talep: d.ad,
            no: Number(d.no),
            yer: [d.ilce, d.il].filter(Boolean).join(', '),
          },
        });
      } catch (e) {
        this.log.warn(`kayıtlı arama ${a.id}: ${(e as Error).message}`);
      }
    }
    return n;
  }

  /** Günlük özet (Karar 30): "günlük" seçili aramalara son 24 saatte uyan talepler; kişi başına günde bir */
  async dailyDigest(now = new Date()) {
    const aramalar = await this.db.savedSearch.findMany({ where: { notify: 'gunluk' } });
    const kisi = new Map<string, { ad: string; sayi: number }[]>();
    for (const a of aramalar) {
      const r = await this.search
        .search({
          ...(a.query as Record<string, unknown>),
          boyut: 1,
          yayinSonra: new Date(now.getTime() - DAY),
        } as Parameters<DemandSearchService['search']>[0])
        .catch(() => null);
      if (!r?.toplam) continue;
      kisi.set(a.userId, [...(kisi.get(a.userId) ?? []), { ad: a.name, sayi: r.toplam }]);
    }
    let n = 0;
    for (const [userId, liste] of kisi) {
      const bugun = await this.db.notification.count({
        where: {
          userId,
          sablon: 'arama.gunluk_ozet',
          createdAt: { gte: new Date(now.getTime() - 20 * 3600_000) },
        },
      });
      if (bugun) continue;
      n += await this.notifications.notify({
        userIds: [userId],
        sablon: 'arama.gunluk_ozet',
        veri: {
          sayi: liste.reduce((t, x) => t + x.sayi, 0),
          aramalar: liste.map((x) => `${x.ad} (${x.sayi})`).join(', '),
        },
      });
    }
    return n;
  }
}
