-- DropIndex
DROP INDEX "refunds_approval_id_idx";

-- AlterTable
ALTER TABLE "refunds" ADD COLUMN     "fail_reason" TEXT,
ADD COLUMN     "order_id" UUID,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "reference_no" TEXT;

-- CreateTable
CREATE TABLE "refund_invoices" (
    "id" UUID NOT NULL,
    "refund_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "no" TEXT,
    "pdf_key" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "issued_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refund_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refund_invoices_refund_id_key" ON "refund_invoices"("refund_id");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_approval_id_key" ON "refunds"("approval_id");

-- CreateIndex
CREATE INDEX "refunds_order_id_idx" ON "refunds"("order_id");

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_invoices" ADD CONSTRAINT "refund_invoices_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "refunds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Elle: iade faturası silinmez (10 yıl, Karar 59). İade kilidi (rr_refund_guard, rr_approval_immutable) değişmedi;
-- onay başına tek iade kaydı (yukarıdaki tekil dizin) aynı onayın ikinci kez yürütülmesini de engeller.
CREATE TRIGGER refund_invoices_no_delete BEFORE DELETE ON "refund_invoices"
  FOR EACH ROW EXECUTE FUNCTION rr_append_only();
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_amount_positive" CHECK ("amount_kurus" > 0);
