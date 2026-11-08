-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'ISSUED', 'FAILED');

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "no" TEXT NOT NULL,
    "account_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "items" JSONB NOT NULL,
    "total_kurus" BIGINT NOT NULL,
    "vat_kurus" BIGINT NOT NULL,
    "billing" JSONB NOT NULL,
    "consents" JSONB NOT NULL,
    "pre_info" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "user_ip" TEXT,
    "fail_reason" TEXT,
    "paid_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amount_kurus" BIGINT NOT NULL,
    "total_kurus" BIGINT NOT NULL,
    "method" TEXT,
    "fail_code" TEXT,
    "fail_message" TEXT,
    "test_mode" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL,
    "no" TEXT,
    "pdf_key" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "issued_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demand_promotions" (
    "id" UUID NOT NULL,
    "demand_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "order_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demand_promotions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_no_key" ON "orders"("no");

-- CreateIndex
CREATE INDEX "orders_user_id_created_at_idx" ON "orders"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_status_created_at_idx" ON "orders"("status", "created_at");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_order_id_key" ON "invoices"("order_id");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "demand_promotions_demand_id_kind_ends_at_idx" ON "demand_promotions"("demand_id", "kind", "ends_at");

-- CreateIndex
CREATE INDEX "demand_promotions_kind_ends_at_idx" ON "demand_promotions"("kind", "ends_at");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_promotions" ADD CONSTRAINT "demand_promotions_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_promotions" ADD CONSTRAINT "demand_promotions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Elle eklenenler
ALTER TABLE "orders" ADD CONSTRAINT "orders_channel_check" CHECK ("channel" IN ('web', 'ios', 'android'));
ALTER TABLE "orders" ADD CONSTRAINT "orders_total_check" CHECK ("total_kurus" > 0 AND "vat_kurus" >= 0 AND "vat_kurus" < "total_kurus");
ALTER TABLE "payments" ADD CONSTRAINT "payments_status_check" CHECK ("status" IN ('success', 'failed'));
ALTER TABLE "demand_promotions" ADD CONSTRAINT "demand_promotions_kind_check" CHECK ("kind" IN ('ust_sira', 'acil', 'vitrin'));
ALTER TABLE "demand_promotions" ADD CONSTRAINT "demand_promotions_range_check" CHECK ("ends_at" > "starts_at");

-- Ödeme ve fatura kayıtları 10 yıl saklanır (Karar 59): sipariş, fatura ve öne çıkarma silinmez; ödeme bildirimi
-- yalnızca eklenir
CREATE TRIGGER orders_no_delete BEFORE DELETE ON "orders"
  FOR EACH ROW EXECUTE FUNCTION rr_append_only();
CREATE TRIGGER invoices_no_delete BEFORE DELETE ON "invoices"
  FOR EACH ROW EXECUTE FUNCTION rr_append_only();
CREATE TRIGGER demand_promotions_no_delete BEFORE DELETE ON "demand_promotions"
  FOR EACH ROW EXECUTE FUNCTION rr_append_only();
CREATE TRIGGER payments_append_only BEFORE UPDATE OR DELETE ON "payments"
  FOR EACH ROW EXECUTE FUNCTION rr_append_only();
