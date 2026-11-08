-- CreateTable
CREATE TABLE "staff_notes" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "account_id" UUID,
    "staff_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocklist" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "value_hash" TEXT NOT NULL,
    "masked" TEXT NOT NULL,
    "note" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_at" TIMESTAMPTZ(3),
    "removed_by" UUID,

    CONSTRAINT "blocklist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_notes_user_id_created_at_idx" ON "staff_notes"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "staff_notes_account_id_created_at_idx" ON "staff_notes"("account_id", "created_at");

-- CreateIndex
CREATE INDEX "blocklist_kind_value_hash_idx" ON "blocklist"("kind", "value_hash");


-- ─────────────────────────────────────────────────────────────
-- Elle eklenen kurallar
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "blocklist" ADD CONSTRAINT "blocklist_kind_check" CHECK ("kind" IN ('telefon', 'iban', 'ip'));
-- Etkin kayıtta aynı değer bir kez
CREATE UNIQUE INDEX "blocklist_active_key" ON "blocklist"("kind", "value_hash") WHERE "removed_at" IS NULL;
ALTER TABLE "staff_notes" ADD CONSTRAINT "staff_notes_target_check" CHECK ("user_id" IS NOT NULL OR "account_id" IS NOT NULL);
-- Notlar ve kara liste geçmişi silinmez (kara listeden çıkarma kaydı kapatır)
CREATE TRIGGER staff_notes_no_delete BEFORE DELETE ON "staff_notes" FOR EACH ROW EXECUTE FUNCTION rr_append_only();
CREATE TRIGGER blocklist_no_delete BEFORE DELETE ON "blocklist" FOR EACH ROW EXECUTE FUNCTION rr_append_only();

-- Kullanıcı kartından çalışan kararı (Karar 52): şikâyet kaydı çalışan kaynaklı ve hedefi kullanıcı olarak açılır
ALTER TABLE "reports" DROP CONSTRAINT "reports_source_check";
ALTER TABLE "reports" ADD CONSTRAINT "reports_source_check" CHECK ("source" IN ('kullanici', 'kural', 'ajan', 'calisan'));
ALTER TABLE "reports" DROP CONSTRAINT "reports_target_type_check";
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_type_check" CHECK ("target_type" IN ('mesaj', 'talep', 'arac', 'kullanici'));
