-- Konsoldan teknik özellik ve donanım girişi (sahip isteği, 18 Kasım 2026): düzeltme bir pakete bağlanabilir
-- (donanım pakete göre değişir) ve donanım listesi taşır. Kayıtlar yine silinmez.

ALTER TABLE "catalog_spec_overrides" ADD COLUMN "trim_id" UUID;
ALTER TABLE "catalog_spec_overrides" ADD COLUMN "equipment" JSONB;
ALTER TABLE "catalog_spec_overrides" ADD CONSTRAINT "catalog_spec_overrides_equipment_check"
  CHECK ("equipment" IS NULL OR jsonb_typeof("equipment") = 'array');
ALTER TABLE "catalog_spec_overrides" ADD CONSTRAINT "catalog_spec_overrides_trim_id_fkey"
  FOREIGN KEY ("trim_id") REFERENCES "catalog_trims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "catalog_spec_overrides_trim_id_idx" ON "catalog_spec_overrides"("trim_id");
