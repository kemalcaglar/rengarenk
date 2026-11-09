-- CreateTable
CREATE TABLE "rating_appeals" (
    "id" UUID NOT NULL,
    "rating_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'acik',
    "due_at" TIMESTAMPTZ(3) NOT NULL,
    "decided_by_staff_id" UUID,
    "decision_note" TEXT,
    "decided_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rating_appeals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rating_appeals_rating_id_key" ON "rating_appeals"("rating_id");

-- CreateIndex
CREATE INDEX "rating_appeals_status_created_at_idx" ON "rating_appeals"("status", "created_at");

-- CreateIndex
CREATE INDEX "rating_appeals_account_id_created_at_idx" ON "rating_appeals"("account_id", "created_at");

-- AddForeignKey
ALTER TABLE "rating_appeals" ADD CONSTRAINT "rating_appeals_rating_id_fkey" FOREIGN KEY ("rating_id") REFERENCES "ratings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Kurallar
ALTER TABLE "rating_appeals" ADD CONSTRAINT "rating_appeals_status_check" CHECK ("status" IN ('acik', 'kabul', 'red'));
ALTER TABLE "rating_appeals" ADD CONSTRAINT "rating_appeals_decided_check" CHECK (("status" = 'acik') = ("decided_at" IS NULL));
ALTER TABLE "ratings" DROP CONSTRAINT "ratings_flag_check";
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_flag_check" CHECK ("flag" IS NULL OR "flag" IN ('yeni_hesap', 'ayni_cihaz', 'bagli_hesap', 'itiraz'));
