-- Teknik özellikler (Karar 33, sahip isteği 16 Kasım 2026): ADEME araç onay verisi (Fransa, Licence Ouverte) ve
-- Türkiye'de satılan tiplerle (TSB) eşleşmesinden türeyen teknik özet.
CREATE TABLE "catalog_specs" (
    "id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "source_key" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "make_name" TEXT NOT NULL,
    "series_name" TEXT,
    "match_key" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "fuel" TEXT,
    "power_kw" INTEGER,
    "power_hp" INTEGER,
    "engine_l" DOUBLE PRECISION,
    "gearbox" TEXT,
    "gears" INTEGER,
    "consumption_min" DOUBLE PRECISION,
    "consumption_max" DOUBLE PRECISION,
    "co2_min" INTEGER,
    "co2_max" INTEGER,
    "weight_min" INTEGER,
    "weight_max" INTEGER,
    "euro" TEXT,
    "row_count" INTEGER NOT NULL,
    "version" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_specs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "catalog_specs_source_source_key_key" ON "catalog_specs"("source", "source_key");
CREATE INDEX "catalog_specs_match_key_idx" ON "catalog_specs"("match_key");

CREATE TABLE "catalog_variant_specs" (
    "variant_id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "signature" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_variant_specs_pkey" PRIMARY KEY ("variant_id")
);

ALTER TABLE "catalog_variant_specs" ADD CONSTRAINT "catalog_variant_specs_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "catalog_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Kaynak: atıf "Veri kaynakları" sayfasında gösterilir; dosyalar data.gouv.fr ve data.ademe.fr'den, ayda bir denetlenir
INSERT INTO "catalog_sources" ("key", "name", "license", "attribution", "url", "auto_fetch", "active", "updated_at")
VALUES ('ademe', 'ADEME araç onay verisi (Fransa): güç, vites, tüketim, CO2, ağırlık', 'Licence Ouverte / Open Licence 2.0 (Etalab)',
  'Kaynak: ADEME, "Emissions de CO2 et de polluants des véhicules commercialisés en France" ve "ADEME - Car Labelling" (data.gouv.fr, data.ademe.fr). Değerler Avrupa onay ölçümleridir; Türkiye''de satılan sürüm TSB listesiyle belirlenir.',
  'https://www.data.gouv.fr/datasets/53ba4c07a3a729219b7bead3', true, true, CURRENT_TIMESTAMP);
