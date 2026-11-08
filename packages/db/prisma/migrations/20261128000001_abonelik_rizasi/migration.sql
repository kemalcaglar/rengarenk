-- Galeri aboneliği (Karar 12.7, 39): galeri sözleşmesi onayına ek olarak otomatik yenileme onayı ayrı kaydedilir
ALTER TABLE "consents" DROP CONSTRAINT "consents_kind_check";
ALTER TABLE "consents" ADD CONSTRAINT "consents_kind_check" CHECK ("kind" IN (
  'kullanim_kosullari', 'kvkk_aydinlatma', 'ticari_ileti', 'reklam_olcum', 'cerez_analiz', 'cerez_reklam',
  'galeri_sozlesmesi', 'on_bilgilendirme', 'mesafeli_sozlesme', 'cayma_hemen_baslat', 'abonelik_otomatik_yenileme'
));

-- Abonelik yenilemesi işçide, saklı karttan: kanal "otomatik"
ALTER TABLE "orders" DROP CONSTRAINT "orders_channel_check";
ALTER TABLE "orders" ADD CONSTRAINT "orders_channel_check" CHECK ("channel" IN ('web', 'ios', 'android', 'otomatik'));

-- Paketi sona eren ya da askıya alınan galeri "pasif": yalnızca portföyünü görüntüler (Karar 12.5)
ALTER TABLE "galleries" DROP CONSTRAINT "galleries_plan_check";
ALTER TABLE "galleries" ADD CONSTRAINT "galleries_plan_check"
  CHECK ("plan" IN ('deneme', 'baslangic', 'profesyonel', 'kurumsal', 'pasif'));
