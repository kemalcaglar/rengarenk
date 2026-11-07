-- Kasa kuşağı (nesil), kaynak açma/kapama ve eski yıllar için vehicle-makes-models kaynağı (Karar 32–33).
-- AlterTable
ALTER TABLE "catalog_sources" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "catalog_variants" ADD COLUMN     "generation_id" UUID;

-- CreateTable
CREATE TABLE "catalog_generations" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "series_id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "start_year" INTEGER NOT NULL,
    "end_year" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_generations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "catalog_generations_key_key" ON "catalog_generations"("key");

-- CreateIndex
CREATE INDEX "catalog_generations_series_id_idx" ON "catalog_generations"("series_id");

-- AddForeignKey
ALTER TABLE "catalog_generations" ADD CONSTRAINT "catalog_generations_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "catalog_series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_variants" ADD CONSTRAINT "catalog_variants_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "catalog_generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Elle eklenen: 1990–2005 için açık kaynak. ODbL 1.0, autoevolution.com kökenli; Teknik tasarım §5'e göre avukat
-- teyidine kadar kataloğu başlatmak için kullanılır, kayıtları ayrı tutulur ve konsoldan kapatılabilir.
INSERT INTO "catalog_sources" ("key", "name", "license", "attribution", "url", "auto_fetch", "active", "updated_at")
VALUES ('vmm', 'vehicle-makes-models', 'ODbL 1.0 · autoevolution.com kökenli; avukat teyidine kadar yalnızca eski yıllar (Teknik tasarım §5)',
        'vehicle-makes-models (gor3a), ODbL 1.0', 'https://github.com/gor3a/vehicle-makes-models', false, true, CURRENT_TIMESTAMP);
