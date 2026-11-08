-- Galeri başvurusunda galeri hizmet sözleşmesi onayı rıza kaydına girer (Karar 39; BasvuruMobil.dc.html)
ALTER TABLE "consents" DROP CONSTRAINT "consents_kind_check";
ALTER TABLE "consents" ADD CONSTRAINT "consents_kind_check" CHECK ("kind" IN (
  'kullanim_kosullari', 'kvkk_aydinlatma', 'ticari_ileti', 'reklam_olcum', 'cerez_analiz', 'cerez_reklam',
  'galeri_sozlesmesi'
));
