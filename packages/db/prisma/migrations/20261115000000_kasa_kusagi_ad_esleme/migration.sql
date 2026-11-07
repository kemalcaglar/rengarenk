-- Sprint 6: kasa kuşağı (nesil kodu, makyaj sırası) ve ad eşleme (Teknik tasarım §5, Karar 33–34).

-- Kasa kuşağı: kasa tipi, makyaj sırası, Wikidata kimliği, Commons kategorisi, yılların kaynağı
ALTER TABLE "catalog_generations"
  ADD COLUMN "body" TEXT,
  ADD COLUMN "facelift" INTEGER,
  ADD COLUMN "wikidata_id" TEXT,
  ADD COLUMN "commons_category" TEXT,
  ADD COLUMN "years_source" TEXT,
  ADD COLUMN "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "catalog_generations"
  ADD CONSTRAINT "catalog_generations_facelift_check" CHECK ("facelift" IS NULL OR "facelift" BETWEEN 0 AND 9);

-- Ad eşleme: kaynaktaki seri yazımı → katalogdaki seri. Kayıtlar silinmez; karar değişirse durum güncellenir.
CREATE TABLE "catalog_aliases" (
  "id" UUID NOT NULL,
  "source" TEXT NOT NULL,
  "from_key" TEXT NOT NULL,
  "from_name" TEXT NOT NULL,
  "to_key" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'onerildi',
  "method" TEXT NOT NULL,
  "reason" TEXT,
  "variants" INTEGER NOT NULL DEFAULT 0,
  "created_by" UUID,
  "decided_by" UUID,
  "decided_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "catalog_aliases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "catalog_aliases_status_check" CHECK ("status" IN ('onerildi', 'onaylandi', 'reddedildi')),
  CONSTRAINT "catalog_aliases_method_check" CHECK ("method" IN ('kural', 'elle', 'ajan')),
  CONSTRAINT "catalog_aliases_self_check" CHECK ("from_key" <> "to_key")
);
CREATE UNIQUE INDEX "catalog_aliases_source_from_key_key" ON "catalog_aliases"("source", "from_key");
CREATE INDEX "catalog_aliases_status_idx" ON "catalog_aliases"("status");

CREATE TRIGGER catalog_aliases_no_delete BEFORE DELETE ON "catalog_aliases"
  FOR EACH ROW EXECUTE FUNCTION rr_append_only();

-- Wikidata: nesil kodu, sırası ve Commons kategorisi (CC0). Wikidata'da yıl yoksa yıllar İngilizce Vikipedi
-- bilgi kutusundaki üretim yıllarından alınır; madde ve sürüm numarası her satırda saklanır.
INSERT INTO "catalog_sources" ("key", "name", "license", "attribution", "url", "auto_fetch", "active", "updated_at")
VALUES ('wikidata', 'Wikidata (kasa kuşağı kodları)', 'CC0 1.0; yıllar Vikipedi bilgi kutusundan (olgu)',
        'Wikidata, İngilizce Vikipedi', 'https://www.wikidata.org/wiki/Q59773381', true, true, CURRENT_TIMESTAMP);
