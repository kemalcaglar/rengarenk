-- Elle girilen teknik özellik ve donanım vitese bağlanabilir (sahip isteği, 18 Kasım 2026: aynı paketin manuel ve
-- otomatik tipi ayrı bilgi taşır). Boşsa bütün vitesler.

ALTER TABLE "catalog_spec_overrides" ADD COLUMN "gearbox" TEXT;
ALTER TABLE "catalog_spec_overrides" ADD CONSTRAINT "catalog_spec_overrides_gearbox_check"
  CHECK ("gearbox" IS NULL OR "gearbox" IN ('manuel', 'otomatik', 'yari_otomatik'));
-- Düzenlenen kaydın yerine geçen kayıt (eski kayıt silinmez, kaldırılır)
ALTER TABLE "catalog_spec_overrides" ADD COLUMN "replaced_by" UUID;
