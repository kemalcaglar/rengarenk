-- Araç kataloğu (Aşama 2; Teknik tasarım §4–5, Karar 32–33). Kasko bedeli hiçbir tabloda tutulmaz.
-- CreateEnum
CREATE TYPE "CatalogImportStatus" AS ENUM ('APPLIED', 'REJECTED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "catalog_sources" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "license" TEXT NOT NULL,
    "attribution" TEXT,
    "url" TEXT,
    "auto_fetch" BOOLEAN NOT NULL DEFAULT false,
    "last_checked_at" TIMESTAMPTZ(3),
    "last_success_at" TIMESTAMPTZ(3),
    "last_version" TEXT,
    "last_file_name" TEXT,
    "last_error" TEXT,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "catalog_sources_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "catalog_imports" (
    "id" UUID NOT NULL,
    "source_key" TEXT NOT NULL,
    "version" TEXT,
    "file_name" TEXT,
    "sha256" TEXT,
    "trigger" TEXT NOT NULL,
    "status" "CatalogImportStatus" NOT NULL,
    "stats" JSONB NOT NULL DEFAULT '{}',
    "quality" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_makes" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_makes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_series" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "make_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "categories" TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_models" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "make_id" UUID NOT NULL,
    "series_id" UUID,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_trims" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "make_id" UUID NOT NULL,
    "series_id" UUID,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_trims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_variants" (
    "id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "source_key" TEXT NOT NULL,
    "make_id" UUID NOT NULL,
    "series_id" UUID,
    "model_id" UUID NOT NULL,
    "trim_id" UUID,
    "categories" TEXT[],
    "body" TEXT,
    "engine_l" DOUBLE PRECISION,
    "power_hp" INTEGER,
    "power_kw" INTEGER,
    "fuel" TEXT,
    "gearbox" TEXT,
    "drive" TEXT,
    "facelift" BOOLEAN NOT NULL DEFAULT false,
    "years" INTEGER[],
    "raw_name" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "in_latest" BOOLEAN NOT NULL DEFAULT true,
    "first_version" TEXT NOT NULL,
    "last_version" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "catalog_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "catalog_imports_source_key_created_at_idx" ON "catalog_imports"("source_key", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_makes_key_key" ON "catalog_makes"("key");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_series_key_key" ON "catalog_series"("key");

-- CreateIndex
CREATE INDEX "catalog_series_make_id_idx" ON "catalog_series"("make_id");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_models_key_key" ON "catalog_models"("key");

-- CreateIndex
CREATE INDEX "catalog_models_series_id_idx" ON "catalog_models"("series_id");

-- CreateIndex
CREATE INDEX "catalog_models_make_id_idx" ON "catalog_models"("make_id");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_trims_key_key" ON "catalog_trims"("key");

-- CreateIndex
CREATE INDEX "catalog_trims_series_id_idx" ON "catalog_trims"("series_id");

-- CreateIndex
CREATE INDEX "catalog_variants_series_id_idx" ON "catalog_variants"("series_id");

-- CreateIndex
CREATE INDEX "catalog_variants_model_id_idx" ON "catalog_variants"("model_id");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_variants_source_source_key_key" ON "catalog_variants"("source", "source_key");

-- AddForeignKey
ALTER TABLE "catalog_imports" ADD CONSTRAINT "catalog_imports_source_key_fkey" FOREIGN KEY ("source_key") REFERENCES "catalog_sources"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_series" ADD CONSTRAINT "catalog_series_make_id_fkey" FOREIGN KEY ("make_id") REFERENCES "catalog_makes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_models" ADD CONSTRAINT "catalog_models_make_id_fkey" FOREIGN KEY ("make_id") REFERENCES "catalog_makes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_models" ADD CONSTRAINT "catalog_models_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "catalog_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_trims" ADD CONSTRAINT "catalog_trims_make_id_fkey" FOREIGN KEY ("make_id") REFERENCES "catalog_makes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_trims" ADD CONSTRAINT "catalog_trims_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "catalog_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_variants" ADD CONSTRAINT "catalog_variants_make_id_fkey" FOREIGN KEY ("make_id") REFERENCES "catalog_makes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_variants" ADD CONSTRAINT "catalog_variants_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "catalog_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_variants" ADD CONSTRAINT "catalog_variants_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "catalog_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_variants" ADD CONSTRAINT "catalog_variants_trim_id_fkey" FOREIGN KEY ("trim_id") REFERENCES "catalog_trims"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Elle eklenen: kaynaklar ve kaynaktan düşen kayıtlar silinmez (Karar 33); içe aktarma geçmişi yalnızca ekleme.
CREATE TRIGGER catalog_imports_append_only BEFORE UPDATE OR DELETE ON "catalog_imports"
  FOR EACH ROW EXECUTE FUNCTION rr_append_only();
CREATE TRIGGER catalog_variants_no_delete BEFORE DELETE ON "catalog_variants"
  FOR EACH ROW EXECUTE FUNCTION rr_append_only();

-- İlk kaynak: TSB kasko değer listesi. Otomatik çekme kapalı başlar; konsoldan açılır.
INSERT INTO "catalog_sources" ("key", "name", "license", "attribution", "url", "auto_fetch", "updated_at")
VALUES ('tsb', 'TSB kasko değer listesi', 'TSB yayını; yazılı izin henüz istenmedi (Karar 33)', 'Türkiye Sigorta Birliği',
        'https://www.tsb.org.tr/tr/kasko-deger-listesi', false, CURRENT_TIMESTAMP);
