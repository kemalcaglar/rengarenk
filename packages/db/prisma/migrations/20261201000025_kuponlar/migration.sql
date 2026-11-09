-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "coupon_id" UUID;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "coupon_id" UUID,
ADD COLUMN     "discount_kurus" BIGINT NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "coupons" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percent" INTEGER NOT NULL,
    "targets" TEXT[],
    "audience" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "max_uses" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'onay_bekliyor',
    "approval_id" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_redemptions" (
    "id" UUID NOT NULL,
    "coupon_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "discount_kurus" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_approval_id_key" ON "coupons"("approval_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_redemptions_order_id_key" ON "coupon_redemptions"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_redemptions_coupon_id_account_id_key" ON "coupon_redemptions"("coupon_id", "account_id");

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Kurallar
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_code_check" CHECK ("code" ~ '^[A-Z0-9]{4,16}$');
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_percent_check" CHECK ("percent" BETWEEN 1 AND 100);
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_dates_check" CHECK ("ends_at" > "starts_at");
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_status_check" CHECK ("status" IN ('onay_bekliyor', 'onaylandi', 'iptal'));
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_audience_check" CHECK ("audience" IN ('herkes', 'bireysel', 'galeri'));
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_discount_check" CHECK ("discount_kurus" > 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_discount_check" CHECK ("discount_kurus" >= 0 AND ("discount_kurus" = 0 OR "coupon_id" IS NOT NULL));
