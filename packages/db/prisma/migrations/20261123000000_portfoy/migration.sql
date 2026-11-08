-- Galeri portföyü: araç, fotoğraf, EİDS istekleri, API anahtarları (Karar 07, 17)
-- CreateEnum
CREATE TYPE "PortfolioStatus" AS ENUM ('DRAFT', 'PENDING_EIDS', 'PUBLISHED', 'PASSIVE', 'SOLD', 'REJECTED');

-- CreateEnum
CREATE TYPE "EidsStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "portfolio_vehicles" (
    "id" UUID NOT NULL,
    "no" BIGSERIAL NOT NULL,
    "account_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "make_key" TEXT,
    "series_key" TEXT,
    "model_key" TEXT,
    "generation_key" TEXT,
    "trim_key" TEXT,
    "make_name" TEXT,
    "model_name" TEXT,
    "year" INTEGER NOT NULL,
    "km" INTEGER NOT NULL,
    "fuel" TEXT,
    "gearbox" TEXT,
    "color" TEXT,
    "price_tl" BIGINT NOT NULL,
    "plate" TEXT,
    "chassis_tail" TEXT,
    "first_registration" DATE,
    "lien" BOOLEAN NOT NULL DEFAULT false,
    "warranty" TEXT,
    "trade_in" BOOLEAN NOT NULL DEFAULT false,
    "damage" JSONB NOT NULL,
    "description" TEXT,
    "price_declared" BOOLEAN NOT NULL DEFAULT false,
    "manufacturer_price" BIGINT,
    "external_id" TEXT,
    "status" "PortfolioStatus" NOT NULL DEFAULT 'DRAFT',
    "status_note" TEXT,
    "assigned_to" UUID,
    "created_by" UUID NOT NULL,
    "report_key" TEXT,
    "report_name" TEXT,
    "report_date" DATE,
    "published_at" TIMESTAMPTZ(3),
    "passive_at" TIMESTAMPTZ(3),
    "sold_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "portfolio_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_photos" (
    "id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "sort" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eids_checks" (
    "id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "status" "EidsStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "plate" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMPTZ(3),

    CONSTRAINT "eids_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_vehicles_no_key" ON "portfolio_vehicles"("no");

-- CreateIndex
CREATE INDEX "portfolio_vehicles_account_id_status_idx" ON "portfolio_vehicles"("account_id", "status");

-- CreateIndex
CREATE INDEX "portfolio_vehicles_status_published_at_idx" ON "portfolio_vehicles"("status", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_vehicles_account_id_external_id_key" ON "portfolio_vehicles"("account_id", "external_id");

-- CreateIndex
CREATE INDEX "portfolio_photos_vehicle_id_sort_idx" ON "portfolio_photos"("vehicle_id", "sort");

-- CreateIndex
CREATE INDEX "portfolio_photos_sha256_idx" ON "portfolio_photos"("sha256");

-- CreateIndex
CREATE INDEX "eids_checks_status_requested_at_idx" ON "eids_checks"("status", "requested_at");

-- CreateIndex
CREATE INDEX "eids_checks_vehicle_id_idx" ON "eids_checks"("vehicle_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_hash_key" ON "api_keys"("hash");

-- CreateIndex
CREATE INDEX "api_keys_account_id_idx" ON "api_keys"("account_id");

-- AddForeignKey
ALTER TABLE "portfolio_vehicles" ADD CONSTRAINT "portfolio_vehicles_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_vehicles" ADD CONSTRAINT "portfolio_vehicles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_photos" ADD CONSTRAINT "portfolio_photos_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "portfolio_vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eids_checks" ADD CONSTRAINT "eids_checks_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "portfolio_vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ── Elle eklenen kısıtlar ─────────────────────────────────────
ALTER SEQUENCE "portfolio_vehicles_no_seq" RESTART WITH 77100001;
ALTER TABLE "portfolio_vehicles" ADD CONSTRAINT "portfolio_vehicles_price_check" CHECK ("price_tl" >= 1000);
ALTER TABLE "portfolio_vehicles" ADD CONSTRAINT "portfolio_vehicles_km_check" CHECK ("km" >= 0);
ALTER TABLE "portfolio_vehicles" ADD CONSTRAINT "portfolio_vehicles_make_check" CHECK ("make_key" IS NOT NULL OR "make_name" IS NOT NULL);
-- Yayındaki araçta yayın tarihi, satılan araçta satış tarihi vardır
ALTER TABLE "portfolio_vehicles" ADD CONSTRAINT "portfolio_vehicles_published_check"
  CHECK ("status" <> 'PUBLISHED' OR "published_at" IS NOT NULL);
ALTER TABLE "portfolio_vehicles" ADD CONSTRAINT "portfolio_vehicles_sold_check"
  CHECK ("status" <> 'SOLD' OR "sold_at" IS NOT NULL);
-- Aynı plaka aynı anda iki açık ilanda olamaz (satılan, reddedilen hariç)
CREATE UNIQUE INDEX "portfolio_vehicles_open_plate" ON "portfolio_vehicles"("plate")
  WHERE "plate" IS NOT NULL AND "status" IN ('PENDING_EIDS', 'PUBLISHED', 'PASSIVE');
-- Araç ve EİDS kayıtları silinmez (uyum kaydı)
CREATE TRIGGER portfolio_vehicles_no_delete BEFORE DELETE ON "portfolio_vehicles"
  FOR EACH ROW EXECUTE FUNCTION rr_append_only();
CREATE TRIGGER eids_checks_no_delete BEFORE DELETE ON "eids_checks"
  FOR EACH ROW EXECUTE FUNCTION rr_append_only();
