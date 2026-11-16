-- Rengarenk ana listesi (sahip kararı, 16 Kasım 2026): sahibin derlediği Türkiye otomobil ve SUV listesi
-- (packages/catalog/src/ana-liste). Otomobil ve SUV kategorilerinde seri seçeneklerini ve yıllarını belirler.
CREATE TABLE "catalog_lineup" (
    "series_id" UUID NOT NULL,
    "make_id" UUID NOT NULL,
    "categories" TEXT[],
    "years" INTEGER[],
    "version" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_lineup_pkey" PRIMARY KEY ("series_id")
);

CREATE INDEX "catalog_lineup_make_id_idx" ON "catalog_lineup"("make_id");

ALTER TABLE "catalog_lineup" ADD CONSTRAINT "catalog_lineup_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "catalog_series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "catalog_lineup" ADD CONSTRAINT "catalog_lineup_make_id_fkey" FOREIGN KEY ("make_id") REFERENCES "catalog_makes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Liste depoda olduğu için ağ gerekmez; otomatik açık başlar, yeni liste sürümü işçi tarafından işlenir.
INSERT INTO "catalog_sources" ("key", "name", "license", "attribution", "url", "auto_fetch", "active", "updated_at")
VALUES ('ana', 'Rengarenk ana listesi', 'Rengarenk (sahibin derlediği liste)', NULL, NULL, true, true, CURRENT_TIMESTAMP);
