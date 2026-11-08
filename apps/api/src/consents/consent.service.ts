import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { uuidv7 } from '@rengarenk/db';
import type { SignupConsents } from '@rengarenk/shared';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';

/** Yasal metin anahtarları (docs/kapsam/06-yasal-metin-taslaklari.md bölümleriyle aynı sıra) */
export const LEGAL_KEYS = [
  'kullanim_kosullari',
  'kvkk_aydinlatma',
  'reklam_olcum',
  'ticari_ileti',
  'cerez_politikasi',
  'on_bilgilendirme',
  'mesafeli_sozlesme',
  'galeri_sozlesmesi',
] as const;
export type LegalKey = (typeof LEGAL_KEYS)[number];

export type Channel = 'web' | 'ios' | 'android';
export const channelOf = (platform?: string): Channel =>
  platform === 'IOS' ? 'ios' : platform === 'ANDROID' ? 'android' : 'web';

/**
 * Rıza kayıtları (Karar 59: açık rıza, çerez tercihleri ve İYS onayları tarih, sürüm ve kanalıyla saklanır) ve
 * sürümlü yasal metinler (Karar 46). Kayıt yalnızca eklenir; güncel durum her türün son kaydıdır.
 */
@Injectable()
export class ConsentService {
  constructor(@Inject(PRISMA) private readonly db: Db) {}

  /** Gösterilecek sürüm: yayındaki; yoksa en yeni taslak (yayın öncesi dönem). */
  async current(key: string, db: Db | Tx = this.db) {
    const published = await db.consentText.findFirst({ where: { key, status: 'yayinda' } });
    if (published) return published;
    return db.consentText.findFirst({ where: { key }, orderBy: { version: 'desc' } });
  }

  async publicText(key: string) {
    const t = await this.current(key);
    if (!t) throw new NotFoundException('Metin bulunamadı');
    return {
      key: t.key,
      version: t.version,
      title: t.title,
      body: t.body,
      status: t.status,
      publishedAt: t.publishedAt,
    };
  }

  /** Üyelik onayları: zorunlu ikisi ve isteğe bağlı ikisi, hangi metin sürümüne verildiğiyle. */
  async recordSignup(tx: Tx, userId: string, c: SignupConsents, channel: Channel, ip?: string) {
    const rows: { kind: string; granted: boolean; key: LegalKey }[] = [
      { kind: 'kullanim_kosullari', granted: true, key: 'kullanim_kosullari' },
      { kind: 'kvkk_aydinlatma', granted: true, key: 'kvkk_aydinlatma' },
      { kind: 'ticari_ileti', granted: Boolean(c.ticariIleti), key: 'ticari_ileti' },
      { kind: 'reklam_olcum', granted: Boolean(c.reklamOlcum), key: 'reklam_olcum' },
    ];
    for (const r of rows) {
      const text = await this.current(r.key, tx);
      await tx.consent.create({
        data: {
          id: uuidv7(),
          userId,
          kind: r.kind,
          granted: r.granted,
          textKey: r.key,
          textVersion: text?.version ?? null,
          channel,
          ip: ip ?? null,
        },
      });
    }
  }

  /**
   * Galeri başvurusu (Karar 39): galeri hizmet sözleşmesi onayı ve isteğe bağlı ticari ileti onayı, metin sürümüyle.
   * Ticari ileti işaretlenmezse var olan tercih değişmez.
   */
  async recordGallery(tx: Tx, userId: string, ticariIleti: boolean, channel: Channel, ip?: string) {
    const rows: { kind: string; key: LegalKey }[] = [{ kind: 'galeri_sozlesmesi', key: 'galeri_sozlesmesi' }];
    if (ticariIleti) rows.push({ kind: 'ticari_ileti', key: 'ticari_ileti' });
    for (const r of rows) {
      const text = await this.current(r.key, tx);
      await tx.consent.create({
        data: {
          id: uuidv7(),
          userId,
          kind: r.kind,
          granted: true,
          textKey: r.key,
          textVersion: text?.version ?? null,
          channel,
          ip: ip ?? null,
        },
      });
    }
  }

  /**
   * Ödeme onayları (Karar 39): ön bilgilendirme formu ve mesafeli hizmet sözleşmesi; sepette hemen başlayan hizmet varsa
   * cayma süresinde başlatma talebi. Metin sürümüyle, siparişle aynı işlemde yazılır.
   */
  async recordPayment(tx: Tx, userId: string, hemenBaslat: boolean, channel: Channel, ip?: string) {
    const rows: { kind: string; key: LegalKey | null }[] = [
      { kind: 'on_bilgilendirme', key: 'on_bilgilendirme' },
      { kind: 'mesafeli_sozlesme', key: 'mesafeli_sozlesme' },
    ];
    if (hemenBaslat) rows.push({ kind: 'cayma_hemen_baslat', key: null });
    const surumler: Record<string, number | null> = {};
    for (const r of rows) {
      const text = r.key ? await this.current(r.key, tx) : null;
      surumler[r.kind] = text?.version ?? null;
      await tx.consent.create({
        data: {
          id: uuidv7(),
          userId,
          kind: r.kind,
          granted: true,
          textKey: r.key,
          textVersion: text?.version ?? null,
          channel,
          ip: ip ?? null,
        },
      });
    }
    return surumler;
  }

  /**
   * Galeri aboneliği onayları (Karar 12.7, 39): galeri hizmet sözleşmesi ve otomatik yenileme ayrı satırlar. Siparişle
   * aynı işlemde yazılır; metin sürümlerini döner.
   */
  async recordSubscription(tx: Tx, userId: string, ip?: string) {
    const text = await this.current('galeri_sozlesmesi', tx);
    const surumler: Record<string, number | null> = {
      galeri_sozlesmesi: text?.version ?? null,
      abonelik_otomatik_yenileme: null,
    };
    for (const kind of Object.keys(surumler)) {
      await tx.consent.create({
        data: {
          id: uuidv7(),
          userId,
          kind,
          granted: true,
          textKey: kind === 'galeri_sozlesmesi' ? 'galeri_sozlesmesi' : null,
          textVersion: surumler[kind] ?? null,
          channel: 'web',
          ip: ip ?? null,
        },
      });
    }
    return surumler;
  }

  /** Ticari elektronik ileti onayı ya da geri alınması (Ayarlar › Bildirimler › Kampanya; Karar 49, İYS) */
  async recordCommercial(tx: Tx, userId: string, granted: boolean, channel: Channel, ip?: string) {
    const text = await this.current('ticari_ileti', tx);
    await tx.consent.create({
      data: {
        id: uuidv7(),
        userId,
        kind: 'ticari_ileti',
        granted,
        textKey: 'ticari_ileti',
        textVersion: text?.version ?? null,
        channel,
        ip: ip ?? null,
      },
    });
  }

  /** Çerez tercihi: üye için kullanıcıya, ziyaretçi için rastgele ziyaretçi kimliğine bağlanır. */
  async recordCookie(
    subject: { userId?: string; visitorId?: string },
    t: { analiz: boolean; reklam: boolean },
    channel: Channel,
    ip?: string,
  ) {
    const text = await this.current('cerez_politikasi');
    await this.db.consent.createMany({
      data: (
        [
          ['cerez_analiz', t.analiz],
          ['cerez_reklam', t.reklam],
        ] as const
      ).map(([kind, granted]) => ({
        id: uuidv7(),
        userId: subject.userId ?? null,
        visitorId: subject.visitorId ?? null,
        kind,
        granted,
        textKey: 'cerez_politikasi',
        textVersion: text?.version ?? null,
        channel,
        ip: ip ?? null,
      })),
    });
  }

  /** Kullanıcının her türdeki son kararı */
  async latest(userId: string) {
    const rows = await this.db.consent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { kind: true, granted: true, textVersion: true, channel: true, createdAt: true },
    });
    const seen = new Map<string, (typeof rows)[number]>();
    for (const r of rows) if (!seen.has(r.kind)) seen.set(r.kind, r);
    return Object.fromEntries(seen);
  }
}
