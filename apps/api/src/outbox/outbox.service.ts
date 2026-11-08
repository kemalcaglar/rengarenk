import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@rengarenk/db';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';

/** Olay adları Teknik tasarım §12'deki listeden gelir. */
export type EventType =
  | 'kullanici.giris'
  | 'kullanici.kaydoldu'
  | 'talep.yayinlandi'
  | 'talep.suresi_doluyor'
  // Talep yaşam döngüsü (Karar 09, 10): favoriye ekleyenlere ve arama indeksine
  | 'talep.guncellendi'
  | 'talep.pasife_alindi'
  | 'talep.suresi_doldu'
  | 'talep.uzatildi'
  | 'talep.kapandi'
  | 'arac.bulundu'
  | 'odeme.alindi'
  // Ödenen tutar siparişle uyuşmuyor: hak tanımlanmadı, inceleme (sahip)
  | 'odeme.uyusmazlik'
  // Galeri abonelikleri (Karar 12.2, 12.7, 39): bildirim katmanı galeri sahibine iletir (Aşama 7)
  | 'abonelik.basladi'
  | 'abonelik.degisti'
  | 'abonelik.yenilendi'
  | 'abonelik.yenileme_yaklasti'
  | 'abonelik.odeme_basarisiz'
  | 'abonelik.iptal_edildi'
  | 'abonelik.bitti'
  | 'abonelik.kart_kaydedildi'
  | 'abonelik.bildirim_gelmedi'
  // Mağaza ödemeleri (Karar 38): iade bildirimi ve tanınmayan satış sahibe ve desteğe iletilir
  | 'magaza.iade_bildirimi'
  | 'magaza.inceleme'
  // Ticari ileti onayı değişti: İYS'ye bildirilir (Karar 49)
  | 'iys.izin_degisti'
  // E-posta itibarı sınırı aşıldı, ticari e-posta kendiliğinden durdu: sahibe iletilir
  | 'bildirim.ticari_durduruldu'
  | 'iade.onaylandi'
  // İade yürütücü (Teknik tasarım §7): sonuç sahibe iletilir; yürütülen iadenin faturası işçide kesilir
  | 'iade.yurutuldu'
  | 'iade.basarisiz'
  | 'iade.belirsiz'
  // Yönetim (Karar 40): bildirim katmanı bunları sahibe iletir.
  | 'calisan.giris'
  | 'calisan.yeni_cihaz'
  | 'calisan.kurtarma_kodu_kullandi'
  | 'calisan.davet_edildi'
  | 'calisan.kapatildi'
  // Dört göz onay motoru (Teknik tasarım §11)
  | 'onay.istendi'
  | 'onay.onaylandi'
  | 'onay.reddedildi'
  | 'onay.suresi_doldu'
  // Ayarlar (T13): özellik anahtarı veya bakım modu değişti
  | 'ayar.degisti'
  // Katalog hattı (Teknik tasarım §5, Karar 33)
  | 'katalog.guncellendi'
  | 'katalog.reddedildi'
  | 'katalog.kaynak_gecikti'
  | 'katalog.ad_esleme'
  // Kategori şeması (Karar 45): yeni sürüm yayına girdi; arama eşlemesi ve önbellekler yenilenir
  | 'kategori.yayinlandi'
  | 'kategori.degisti'
  // Galeri hesapları (Karar 03, 12.5, 20): kontroller işçide, bildirimler bildirim katmanında (Aşama 7)
  | 'galeri.basvuru_alindi'
  | 'galeri.onaylandi'
  | 'galeri.reddedildi'
  | 'galeri.belge_istendi'
  | 'galeri.onay_geri_alindi'
  | 'galeri.davet_edildi'
  | 'galeri.calisan_eklendi'
  | 'galeri.calisan_cikarildi'
  | 'galeri.deneme_bitiyor'
  | 'galeri.deneme_bitti'
  // Portföy (Karar 07, 17): EİDS işçide; yayın ve değişiklikler eşleştirmeye (Aşama 5)
  | 'portfoy.eids_istendi'
  | 'portfoy.eids_reddedildi'
  | 'portfoy.yayinlandi'
  | 'portfoy.guncellendi'
  | 'portfoy.kalkti'
  // Eşleştirme (Karar 06.2, Teknik tasarım §6): eşiği geçen yeni eşleşme; anlık ya da günlük özet (Aşama 7)
  | 'eslesme.bulundu'
  // Mesajlaşma (Karar 11, 25, 27): bildirim katmanı (Aşama 7) ve moderasyon sinyali (Aşama 8)
  | 'mesaj.ilk'
  | 'mesaj.geldi'
  | 'mesaj.uyari'
  // Moderasyon (Karar 53): şikâyet açıldı, karar, ajanın askısı, itiraz ve sonucu
  | 'sikayet.acildi'
  | 'moderasyon.karar'
  | 'moderasyon.ajan_aski'
  | 'itiraz.acildi'
  | 'moderasyon.itiraz_sonuc'
  // Kullanıcı kartından hak tanımlandı (Karar 52): kişiye bildirim
  | 'hak.tanimlandi'
  // Destek (Karar 54): talep açıldı, destek yanıtladı (kullanıcıya bildirim), memnuniyet sorusu
  | 'destek.acildi'
  | 'destek.yanitlandi'
  | 'destek.memnuniyet'
  // KVKK (Karar 58): veri kopyası istendi (işçi hazırlar) ve hazır; başvuru ve yanıtı
  | 'veri.indirme_istendi'
  | 'veri.hazir'
  | 'kvkk.basvuru'
  | 'kvkk.yanitlandi'
  | 'sohbet.numara_paylasildi'
  | 'sohbet.engellendi'
  // Güven (Karar 28, 55): yıldız ve takip edilen galerinin günlük özeti
  | 'puan.verildi'
  | 'takip.ozet';

@Injectable()
export class OutboxService {
  private readonly log = new Logger(OutboxService.name);
  constructor(@Inject(PRISMA) private readonly db: Db) {}

  /** Olayı, iş verisiyle aynı veritabanı işleminde kaydeder. */
  add(tx: Tx, type: EventType, payload: Prisma.InputJsonValue) {
    return tx.outboxEvent.create({ data: { type, payload } });
  }

  /**
   * Yayınlanmamış olayları sırayla kilitleyip `publish` ile iletir. Birden çok işçi aynı anda
   * çalışabilir (SKIP LOCKED). Yayın başarısızsa olay sonraki turda tekrar denenir.
   */
  async relayBatch(publish: (type: string, payload: unknown) => Promise<void>, limit = 100): Promise<number> {
    return this.db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: bigint; type: string; payload: unknown }[]>`
        SELECT id, type, payload FROM outbox
        WHERE published_at IS NULL
        ORDER BY id
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED`;
      let sent = 0;
      for (const row of rows) {
        try {
          await publish(row.type, row.payload);
          await tx.outboxEvent.update({ where: { id: row.id }, data: { publishedAt: new Date() } });
          sent++;
        } catch (err) {
          this.log.warn(`olay ${row.id} iletilemedi: ${(err as Error).message}`);
          await tx.outboxEvent.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
        }
      }
      return sent;
    });
  }
}
