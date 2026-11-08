-- Ödeme onayları (Karar 39): ön bilgilendirme formu, mesafeli hizmet sözleşmesi ve hemen başlayan hizmetlerde cayma
-- hakkından feragat; zaman damgası ve metin sürümüyle saklanır
ALTER TABLE "consents" DROP CONSTRAINT "consents_kind_check";
ALTER TABLE "consents" ADD CONSTRAINT "consents_kind_check" CHECK ("kind" IN (
  'kullanim_kosullari', 'kvkk_aydinlatma', 'ticari_ileti', 'reklam_olcum', 'cerez_analiz', 'cerez_reklam',
  'galeri_sozlesmesi', 'on_bilgilendirme', 'mesafeli_sozlesme', 'cayma_hemen_baslat'
));
