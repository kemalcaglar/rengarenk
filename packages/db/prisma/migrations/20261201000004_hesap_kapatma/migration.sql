-- CreateTable
CREATE TABLE "account_closures" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reason" TEXT,
    "phone_enc" TEXT,
    "phone_hash" TEXT NOT NULL,
    "phone_verified_at" TIMESTAMPTZ(3),
    "refund_kurus" BIGINT NOT NULL DEFAULT 0,
    "refunds" JSONB NOT NULL DEFAULT '[]',
    "keep_identity_until" TIMESTAMPTZ(3) NOT NULL,
    "purge_messages_at" TIMESTAMPTZ(3) NOT NULL,
    "identity_purged_at" TIMESTAMPTZ(3),
    "messages_purged_at" TIMESTAMPTZ(3),
    "closed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_closures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_closures_user_id_key" ON "account_closures"("user_id");

-- CreateIndex
CREATE INDEX "account_closures_phone_hash_idx" ON "account_closures"("phone_hash");

-- CreateIndex
CREATE INDEX "account_closures_keep_identity_until_idx" ON "account_closures"("keep_identity_until");

-- CreateIndex
CREATE INDEX "account_closures_purge_messages_at_idx" ON "account_closures"("purge_messages_at");


-- Kurallar (Karar 31, 59): neden listeden gelir; imha telefonu siler ama satırı silmez
ALTER TABLE "account_closures" ADD CONSTRAINT "account_closures_reason_check"
  CHECK ("reason" IS NULL OR "reason" IN ('buldum', 'cok_mesaj', 'baska_platform', 'diger'));
ALTER TABLE "account_closures" ADD CONSTRAINT "account_closures_refund_check" CHECK ("refund_kurus" >= 0);
ALTER TABLE "account_closures" ADD CONSTRAINT "account_closures_purge_check"
  CHECK ("identity_purged_at" IS NULL OR "phone_enc" IS NULL);
CREATE TRIGGER account_closures_no_delete BEFORE DELETE ON "account_closures" FOR EACH ROW EXECUTE FUNCTION rr_append_only();
