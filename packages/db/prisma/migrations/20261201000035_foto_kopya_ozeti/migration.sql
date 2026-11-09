-- Portföy fotoğrafının algısal özeti (ilan kopyalama tespiti)
-- AlterTable
ALTER TABLE "portfolio_photos" ADD COLUMN     "phash" BIGINT;

CREATE INDEX "portfolio_photos_phash_idx" ON "portfolio_photos"("phash") WHERE "phash" IS NOT NULL;
