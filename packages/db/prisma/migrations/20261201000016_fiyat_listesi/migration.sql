-- CreateTable
CREATE TABLE "price_books" (
    "id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'onay_bekliyor',
    "data" JSONB NOT NULL,
    "effective_at" TIMESTAMPTZ(3) NOT NULL,
    "changes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT,
    "approval_id" UUID,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduled_at" TIMESTAMPTZ(3),

    CONSTRAINT "price_books_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "price_books_approval_id_key" ON "price_books"("approval_id");

-- CreateIndex
CREATE INDEX "price_books_status_effective_at_idx" ON "price_books"("status", "effective_at");


-- Kurallar
ALTER TABLE "price_books" ADD CONSTRAINT "price_books_status_check" CHECK ("status" IN ('onay_bekliyor', 'zamanlandi', 'reddedildi', 'iptal'));
