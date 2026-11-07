-- Nesil fotoğrafları (Karar 34): Wikimedia Commons adayları ve seçilen fotoğrafın depodaki kopyası.
CREATE TABLE "catalog_images" (
  "id" UUID NOT NULL,
  "generation_id" UUID NOT NULL,
  "commons_file" TEXT NOT NULL,
  "page_url" TEXT NOT NULL,
  "source_url" TEXT NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "mime" TEXT NOT NULL,
  "author" TEXT NOT NULL,
  "license" TEXT NOT NULL,
  "license_url" TEXT,
  "score" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'aday',
  "storage_key" TEXT,
  "sha256" TEXT,
  "decided_by" UUID,
  "decided_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "catalog_images_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "catalog_images_status_check" CHECK ("status" IN ('aday', 'secildi', 'reddedildi')),
  -- Seçilen fotoğrafın kopyası depoda olmalı (Commons'taki değişiklik siteyi bozmasın)
  CONSTRAINT "catalog_images_stored_check" CHECK ("status" <> 'secildi' OR ("storage_key" IS NOT NULL AND "sha256" IS NOT NULL)),
  -- Karar 34: ticari kullanıma izin vermeyen (NC) ve değiştirilemez (ND) lisans alınmaz
  CONSTRAINT "catalog_images_license_check" CHECK ("license" !~* '(\mNC\M|\mND\M|non-?commercial|no ?deriv)')
);
CREATE UNIQUE INDEX "catalog_images_generation_id_commons_file_key" ON "catalog_images"("generation_id", "commons_file");
CREATE INDEX "catalog_images_status_idx" ON "catalog_images"("status");
-- Bir nesilde en çok bir seçili fotoğraf
CREATE UNIQUE INDEX "catalog_images_one_selected" ON "catalog_images"("generation_id") WHERE "status" = 'secildi';
ALTER TABLE "catalog_images" ADD CONSTRAINT "catalog_images_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "catalog_generations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TRIGGER catalog_images_no_delete BEFORE DELETE ON "catalog_images"
  FOR EACH ROW EXECUTE FUNCTION rr_append_only();

INSERT INTO "catalog_sources" ("key", "name", "license", "attribution", "url", "auto_fetch", "active", "updated_at")
VALUES ('commons', 'Wikimedia Commons (nesil fotoğrafları)', 'Fotoğraf başına: kamu malı, CC0, CC BY, CC BY-SA',
        'Fotoğraflar: Wikimedia Commons katkıcıları', 'https://commons.wikimedia.org', true, true, CURRENT_TIMESTAMP);
