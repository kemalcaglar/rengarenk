import { Inject, Injectable } from '@nestjs/common';
import type { BusinessKindKey, CheckOutcome } from '@rengarenk/shared';
import { ENV, type Env } from '../config/env.js';

export interface VerifyResult {
  sonuc: CheckOutcome;
  not?: string;
  /** Kaynaktaki ticari unvan ve il (ör. Bakanlık kaydı); başvurudakiyle karşılaştırılır */
  unvan?: string;
  il?: string;
}

/**
 * Galeri başvurusunun dış kontrolleri (Karar 03, 17): Ticaret Bakanlığı yetki belgesi (yönetmelik m.22/a), GİB vergi
 * kaydı ve MERSİS. Kurumlar erişim verince gerçek bağdaştırıcılar bu arayüzü uygular.
 */
export interface GalleryVerifier {
  readonly ad: string;
  yetkiBelgesi(no: string, tur: BusinessKindKey): Promise<VerifyResult>;
  vergi(vergiNo: string, vergiDairesi: string): Promise<VerifyResult>;
  mersis(no: string): Promise<VerifyResult>;
}
export const GALLERY_VERIFIER = Symbol('GALLERY_VERIFIER');

const YOK = 'Kurum bağlantısı henüz kurulmadı; belgeye bakarak elle kontrol et';

/** Bağlantı yok: hiçbir kontrol kendiliğinden geçmez, başvuru her zaman insana düşer. */
export class NoVerifier implements GalleryVerifier {
  readonly ad = 'none';
  async yetkiBelgesi(): Promise<VerifyResult> {
    return { sonuc: 'yapilamadi', not: YOK };
  }
  async vergi(): Promise<VerifyResult> {
    return { sonuc: 'yapilamadi', not: YOK };
  }
  async mersis(): Promise<VerifyResult> {
    return { sonuc: 'yapilamadi', not: YOK };
  }
}

/**
 * Geliştirme ve test: numaraya göre öngörülebilir sonuç. "0" ile başlayan yetki belgesi bulunamaz, "9" ile biten
 * yetki belgesinin süresi yakında dolar (uyarı); diğerleri geçer. Unvan olarak "Test Kaydı" döner. Canlıda açılamaz.
 */
export class FakeVerifier implements GalleryVerifier {
  readonly ad = 'fake';
  async yetkiBelgesi(no: string): Promise<VerifyResult> {
    if (no.startsWith('0')) return { sonuc: 'kaldi', not: 'Bakanlık kaydında bu numara bulunamadı' };
    if (no.endsWith('9'))
      return { sonuc: 'uyari', not: 'Belgenin süresi 12 gün sonra doluyor', unvan: 'Test Kaydı' };
    return { sonuc: 'gecti', unvan: 'Test Kaydı', il: 'İstanbul' };
  }
  async vergi(vergiNo: string): Promise<VerifyResult> {
    return vergiNo.startsWith('0')
      ? { sonuc: 'kaldi', not: 'Vergi kaydı faal değil' }
      : { sonuc: 'gecti', unvan: 'Test Kaydı' };
  }
  async mersis(no: string): Promise<VerifyResult> {
    return no.endsWith('0') ? { sonuc: 'kaldi', not: 'MERSİS kaydı bulunamadı' } : { sonuc: 'gecti' };
  }
}

@Injectable()
export class VerifierFactory {
  constructor(@Inject(ENV) private readonly env: Env) {}
  create(): GalleryVerifier {
    return this.env.GALLERY_VERIFY_PROVIDER === 'fake' ? new FakeVerifier() : new NoVerifier();
  }
}
