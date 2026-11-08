-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "external_id" TEXT;

-- CreateTable
CREATE TABLE "store_events" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "user_id" UUID,
    "product_id" TEXT,
    "transaction_id" TEXT,
    "store" TEXT,
    "environment" TEXT,
    "result" TEXT NOT NULL,
    "note" TEXT,
    "order_id" UUID,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "store_events_event_id_key" ON "store_events"("event_id");

-- CreateIndex
CREATE INDEX "store_events_user_id_created_at_idx" ON "store_events"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "store_events_result_created_at_idx" ON "store_events"("result", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_external_id_key" ON "orders"("external_id");


-- Elle: mağaza bildirimi değiştirilemez ve silinemez
ALTER TABLE "store_events" ADD CONSTRAINT "store_events_result_check" CHECK ("result" IN ('islendi', 'yok_sayildi', 'inceleme'));
CREATE TRIGGER store_events_append_only BEFORE UPDATE OR DELETE ON "store_events"
  FOR EACH ROW EXECUTE FUNCTION rr_append_only();
