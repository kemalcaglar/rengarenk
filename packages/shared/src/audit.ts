/**
 * İşlem kaydındaki işlem adlarının okunur karşılığı (konsol › İşlem kaydı). Listede olmayan ad olduğu gibi
 * gösterilir. Arama bu adlarla da yapılır ("iade onaylandı" yazınca ilgili kayıtlar gelir).
 */
export const AUDIT_ACTIONS: Record<string, string> = {
  giris: 'Kullanıcı girişi',
  profil_guncelle: 'Profil güncellendi',
  oturum_kapat: 'Oturum kapatıldı',
  yonetim_giris: 'Yönetim girişi',
  yonetim_cikis: 'Yönetimden çıkış',
  yonetim_giris_reddedildi: 'Yönetim girişi reddedildi',
  yonetim_kod_hatali: 'Hatalı doğrulama kodu',
  calisan_davet: 'Çalışan davet edildi',
  calisan_davet_yenilendi: 'Davet yenilendi',
  calisan_rol_degisti: 'Çalışan rolü değişti',
  calisan_kapatildi: 'Çalışan hesabı kapatıldı',
  calisan_2fa_sifirlandi: 'İki adımlı doğrulama sıfırlandı',
  sahip_hesabi_acildi: 'Sahip hesabı açıldı',
  ozel_rol_olustur: 'Özel rol oluşturuldu',
  ozel_rol_degisti: 'Özel rol değişti',
  onay_istendi: 'Onay istendi',
  onay_onaylandi: 'Onaylandı',
  onay_reddedildi: 'Reddedildi',
  onay_geri_cekildi: 'İstek geri çekildi',
  onay_suresi_doldu: 'Onay isteğinin süresi doldu',
  onay_yurutuldu: 'Onaylanan işlem yürütüldü',
  ozellik_degisti: 'Özellik anahtarı değişti',
  bakim_degisti: 'Bakım modu değişti',
  deneme_kullanicisi_eklendi: 'Deneme kullanıcısı eklendi',
  deneme_kullanicisi_cikarildi: 'Deneme kullanıcısı çıkarıldı',
  katalog_ice_aktarildi: 'Katalog içe aktarıldı',
  katalog_arsiv_ice_aktarildi: 'Katalog arşivi içe aktarıldı',
  katalog_ice_aktarma_atlandi: 'Katalog içe aktarma atlandı',
  katalog_ice_aktarma_reddedildi: 'Katalog içe aktarma reddedildi',
  katalog_kaynak_ayari: 'Katalog kaynağı ayarı değişti',
  katalog_ad_esleme_onaylandi: 'Ad eşleme onaylandı',
  katalog_ad_esleme_reddedildi: 'Ad eşleme reddedildi',
  katalog_fotograf_secildi: 'Nesil fotoğrafı seçildi',
  katalog_fotograf_elendi: 'Nesil fotoğrafı elendi',
};

/** Aranan metnin geçtiği işlem adları (Türkçe büyük-küçük harf duyarsız) */
export function auditActionsMatching(q: string): string[] {
  const n = q.toLocaleLowerCase('tr-TR');
  return Object.entries(AUDIT_ACTIONS)
    .filter(([, ad]) => ad.toLocaleLowerCase('tr-TR').includes(n))
    .map(([k]) => k);
}
