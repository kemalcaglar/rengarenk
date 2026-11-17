-- Talep görseli (sahip isteği, 17 Kasım 2026; Karar 34): her talep görselle yayına girer. Fotoğraf nesil koduna,
-- kasa kuşağına ya da seriye (model geneli) bağlanabilir; konsoldan elle yüklenebilir (kaynak, yazar ve lisansla);
-- seçili fotoğraf kaldırılıp yerine başkası seçilebilir. Kayıtlar yine silinmez.

ALTER TABLE "catalog_images" ALTER COLUMN "generation_id" DROP NOT NULL;
ALTER TABLE "catalog_images" ADD COLUMN "series_id" UUID,
ADD COLUMN "year_from" INTEGER,
ADD COLUMN "year_to" INTEGER;
ALTER TABLE "catalog_images" ADD CONSTRAINT "catalog_images_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "catalog_series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Ya nesil/kuşak ya da seri: ikisi birden değil
ALTER TABLE "catalog_images" ADD CONSTRAINT "catalog_images_target_check" CHECK (("generation_id" IS NULL) <> ("series_id" IS NULL));
ALTER TABLE "catalog_images" ADD CONSTRAINT "catalog_images_years_check" CHECK (
  ("year_from" IS NULL OR "year_from" BETWEEN 1900 AND 2100) AND ("year_to" IS NULL OR "year_to" >= COALESCE("year_from", 1900))
);
CREATE UNIQUE INDEX "catalog_images_series_id_commons_file_key" ON "catalog_images"("series_id", "commons_file");
CREATE INDEX "catalog_images_series_id_idx" ON "catalog_images"("series_id");
-- Seride yıl aralığı başına tek seçili fotoğraf
CREATE UNIQUE INDEX "catalog_images_one_selected_series" ON "catalog_images"("series_id", COALESCE("year_from", 0), COALESCE("year_to", 0)) WHERE "status" = 'secildi';

-- yukleme: katalog sorumlusunun elle eklediği fotoğraf (kaynak sayfası, yazar ve lisans zorunlu)
ALTER TABLE "catalog_images" DROP CONSTRAINT "catalog_images_origin_check";
ALTER TABLE "catalog_images" ADD CONSTRAINT "catalog_images_origin_check" CHECK ("origin" IN ('commons', 'galeri', 'yukleme'));
-- kaldirildi: seçili fotoğraf konsoldan kaldırıldı (yerine başkası seçilebilir)
ALTER TABLE "catalog_images" DROP CONSTRAINT "catalog_images_status_check";
ALTER TABLE "catalog_images" ADD CONSTRAINT "catalog_images_status_check" CHECK ("status" IN ('aday', 'secildi', 'reddedildi', 'geri_alindi', 'kaldirildi'));

-- Serinin Commons kategorisi (model geneli fotoğraf adayları) ve son bakılma zamanı
ALTER TABLE "catalog_series" ADD COLUMN "commons_category" TEXT,
ADD COLUMN "commons_checked_at" TIMESTAMPTZ(3);
