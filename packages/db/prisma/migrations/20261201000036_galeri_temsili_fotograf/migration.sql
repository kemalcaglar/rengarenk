-- Galeri fotoğrafı temsilî görsel (Karar 34): Commons'ta fotoğraf yoksa galerinin izin verdiği portföy fotoğrafı
-- AlterTable
ALTER TABLE "catalog_images" ADD COLUMN     "gallery_account_id" UUID,
ADD COLUMN     "origin" TEXT NOT NULL DEFAULT 'commons',
ADD COLUMN     "portfolio_photo_id" UUID,
ADD COLUMN     "portfolio_vehicle_id" UUID;

-- CreateIndex
CREATE INDEX "catalog_images_portfolio_vehicle_id_idx" ON "catalog_images"("portfolio_vehicle_id");

ALTER TABLE "catalog_images" ADD CONSTRAINT "catalog_images_origin_check" CHECK ("origin" IN ('commons', 'galeri'));
-- Galeri fotoğrafı kaynağını taşır; izin kalkınca "geri_alindi" olur ve gösterilmez
ALTER TABLE "catalog_images" ADD CONSTRAINT "catalog_images_gallery_check" CHECK (
  "origin" <> 'galeri' OR ("portfolio_photo_id" IS NOT NULL AND "portfolio_vehicle_id" IS NOT NULL AND "gallery_account_id" IS NOT NULL)
);
ALTER TABLE "catalog_images" DROP CONSTRAINT "catalog_images_status_check";
ALTER TABLE "catalog_images" ADD CONSTRAINT "catalog_images_status_check" CHECK ("status" IN ('aday', 'secildi', 'reddedildi', 'geri_alindi'));
