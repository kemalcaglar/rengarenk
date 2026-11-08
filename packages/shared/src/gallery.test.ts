import { describe, expect, it } from 'vitest';
import {
  canInvite,
  galleryApplicationSchema,
  gallerySlug,
  memberLimit,
  tcknGecerli,
  vknGecerli,
} from './gallery';

const BASVURU = {
  tur: 'DEALER',
  unvan: 'Yıldız Otomotiv Ltd. Şti.',
  gorunenAd: 'Yıldız Otomotiv',
  vergiNo: '1234567890',
  vergiDairesi: 'Kadıköy',
  mersis: '0123456789000015',
  il: 'İstanbul',
  ilce: 'Kadıköy',
  adres: 'Caferağa Mah. Moda Cad. No: 1',
  yetkiNo: '34-2021-001',
  sahip: { ad: 'Selin', soyad: 'Yıldız', gorev: 'Kurucu', eposta: 'Selin@Ornek.com.tr' },
};

describe('kimlik numaraları', () => {
  it('VKN sağlama hanesi', () => {
    expect(vknGecerli('1234567890')).toBe(true);
    expect(vknGecerli('9876543217')).toBe(true);
    expect(vknGecerli('1234567891')).toBe(false);
    expect(vknGecerli('123456789')).toBe(false);
  });
  it('TCKN sağlama haneleri', () => {
    expect(tcknGecerli('10000000146')).toBe(true);
    expect(tcknGecerli('10000000147')).toBe(false);
    expect(tcknGecerli('00000000146')).toBe(false);
  });
});

describe('galeri başvurusu (Karar 03, 17)', () => {
  it('eksiksiz başvuru geçer; e-posta küçük harfe iner', () => {
    const r = galleryApplicationSchema.parse(BASVURU);
    expect(r.sahip.eposta).toBe('selin@ornek.com.tr');
  });
  it('vasıta galerisinde yetki belgesi zorunlu, teknede değil', () => {
    const { yetkiNo: _y, ...yetkisiz } = BASVURU;
    const r = galleryApplicationSchema.safeParse(yetkisiz);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['yetkiNo']);
    expect(galleryApplicationSchema.safeParse({ ...yetkisiz, tur: 'BOAT' }).success).toBe(true);
  });
  it('il ve ilçe listeden; vergi no ve MERSİS biçimi', () => {
    expect(galleryApplicationSchema.safeParse({ ...BASVURU, ilce: 'Çankaya' }).success).toBe(false);
    expect(galleryApplicationSchema.safeParse({ ...BASVURU, vergiNo: '1234567891' }).success).toBe(false);
    expect(galleryApplicationSchema.safeParse({ ...BASVURU, vergiNo: '10000000146' }).success).toBe(true);
    expect(galleryApplicationSchema.safeParse({ ...BASVURU, mersis: '123' }).success).toBe(false);
  });
});

describe('çalışanlar ve paket (Karar 12.2, 20)', () => {
  it('davet yetkisi', () => {
    expect(canInvite('OWNER', 'MANAGER')).toBe(true);
    expect(canInvite('MANAGER', 'SALES')).toBe(true);
    expect(canInvite('MANAGER', 'MANAGER')).toBe(false);
    expect(canInvite('SALES', 'SALES')).toBe(false);
    expect(canInvite('OWNER', 'OWNER')).toBe(false);
  });
  it('çalışan sınırı: deneme Profesyonel kadar', () => {
    expect(memberLimit('deneme')).toBe(5);
    expect(memberLimit('baslangic')).toBe(2);
    expect(memberLimit('kurumsal')).toBe(15);
  });
  it('profil adresi', () => {
    expect(gallerySlug('Yıldız Otomotiv')).toBe('yildiz-otomotiv');
    expect(gallerySlug('Çağ & Şükrü Oto Ğ')).toBe('cag-sukru-oto-g');
  });
});
