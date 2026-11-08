-- Galerinin fotoğraflarını katalogda temsilî görsel olarak kullanma izni (GaleriMobil.dc.html)
-- AlterTable
ALTER TABLE "portfolio_vehicles" ADD COLUMN     "photo_catalog_ok" BOOLEAN NOT NULL DEFAULT false;

