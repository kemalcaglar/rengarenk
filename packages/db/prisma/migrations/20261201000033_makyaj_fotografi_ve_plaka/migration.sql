-- Makyaj başına fotoğraf ve plaka bulanıklaştırma (Karar 34)
-- AlterTable
ALTER TABLE "catalog_images" ADD COLUMN     "blur_areas" JSONB,
ADD COLUMN     "edited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "facelift" INTEGER,
ADD COLUMN     "original_key" TEXT;


ALTER TABLE "catalog_images" ADD CONSTRAINT "catalog_images_facelift_check" CHECK ("facelift" IS NULL OR "facelift" BETWEEN 0 AND 5);
ALTER TABLE "catalog_images" ADD CONSTRAINT "catalog_images_edited_check" CHECK (NOT "edited" OR "original_key" IS NOT NULL);
-- Nesil ve makyaj başına tek seçili fotoğraf (önceden nesil başına tekti)
DROP INDEX "catalog_images_one_selected";
CREATE UNIQUE INDEX "catalog_images_one_selected" ON "catalog_images"("generation_id", COALESCE("facelift", -1)) WHERE "status" = 'secildi';
