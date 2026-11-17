-- Teknik özelliğin elle düzeltilmesi ve kullanıcının "yanlış" bildirimi (sahip isteği, 17 Kasım 2026)

CREATE TABLE "catalog_spec_overrides" (
  "id" UUID NOT NULL,
  "model_id" UUID NOT NULL,
  "year_from" INTEGER,
  "year_to" INTEGER,
  "values" JSONB NOT NULL,
  "note" TEXT,
  "status" TEXT NOT NULL DEFAULT 'aktif',
  "created_by" UUID NOT NULL,
  "removed_by" UUID,
  "removed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "catalog_spec_overrides_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "catalog_spec_overrides_status_check" CHECK ("status" IN ('aktif', 'kaldirildi')),
  CONSTRAINT "catalog_spec_overrides_years_check" CHECK (
    ("year_from" IS NULL OR "year_from" BETWEEN 1900 AND 2100) AND ("year_to" IS NULL OR "year_to" >= COALESCE("year_from", 1900))
  ),
  CONSTRAINT "catalog_spec_overrides_values_check" CHECK (jsonb_typeof("values") = 'object')
);
CREATE INDEX "catalog_spec_overrides_model_id_status_idx" ON "catalog_spec_overrides"("model_id", "status");
ALTER TABLE "catalog_spec_overrides" ADD CONSTRAINT "catalog_spec_overrides_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "catalog_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Kayıtlar silinmez (kaldırılınca durum değişir)
CREATE TRIGGER catalog_spec_overrides_no_delete BEFORE DELETE ON "catalog_spec_overrides"
  FOR EACH ROW EXECUTE FUNCTION rr_append_only();

CREATE TABLE "catalog_spec_reports" (
  "id" UUID NOT NULL,
  "demand_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "model_id" UUID,
  "motor" TEXT NOT NULL,
  "field" TEXT,
  "note" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'acik',
  "decided_by" UUID,
  "decided_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "catalog_spec_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "catalog_spec_reports_status_check" CHECK ("status" IN ('acik', 'duzeltildi', 'reddedildi')),
  CONSTRAINT "catalog_spec_reports_note_check" CHECK (char_length("note") <= 1000)
);
CREATE INDEX "catalog_spec_reports_status_created_at_idx" ON "catalog_spec_reports"("status", "created_at");
-- Aynı kullanıcı, aynı talep ve sürüm için tek açık bildirim
CREATE UNIQUE INDEX "catalog_spec_reports_one_open" ON "catalog_spec_reports"("user_id", "demand_id", "motor") WHERE "status" = 'acik';
ALTER TABLE "catalog_spec_reports" ADD CONSTRAINT "catalog_spec_reports_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "catalog_spec_reports" ADD CONSTRAINT "catalog_spec_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "catalog_spec_reports" ADD CONSTRAINT "catalog_spec_reports_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "catalog_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
