-- Teknik özellik tablosunun satır düzeni araç başına (sahip isteği, 18 Kasım 2026: "segmenti göstermek istemiyorum, o araç
-- için çıkarabilmeliyim; başka bir şey istiyorum ekleyebilmeliyim"). Gizlenen satır anahtarları ve serbest ek satırlar
-- ({ bolum, etiket, deger }); kaydın yıl, paket ve vites hedeflemesine uyar.

ALTER TABLE "catalog_spec_overrides" ADD COLUMN "hidden_rows" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "catalog_spec_overrides" ADD COLUMN "extra_rows" JSONB;
ALTER TABLE "catalog_spec_overrides" ADD CONSTRAINT "catalog_spec_overrides_extra_rows_check"
  CHECK ("extra_rows" IS NULL OR jsonb_typeof("extra_rows") = 'array');
