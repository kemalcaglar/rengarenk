-- CreateTable
CREATE TABLE "data_exports" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'hazirlaniyor',
    "storage_key" TEXT,
    "size_bytes" INTEGER,
    "ready_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    "downloaded_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kvkk_requests" (
    "id" UUID NOT NULL,
    "no" SERIAL NOT NULL,
    "user_id" UUID,
    "applicant_name" TEXT,
    "applicant_email" TEXT,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "verification" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'acik',
    "due_at" TIMESTAMPTZ(3) NOT NULL,
    "response" TEXT,
    "responded_by" UUID,
    "responded_at" TIMESTAMPTZ(3),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kvkk_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "data_exports_user_id_created_at_idx" ON "data_exports"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "data_exports_status_created_at_idx" ON "data_exports"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "kvkk_requests_no_key" ON "kvkk_requests"("no");

-- CreateIndex
CREATE INDEX "kvkk_requests_status_due_at_idx" ON "kvkk_requests"("status", "due_at");

-- CreateIndex
CREATE INDEX "kvkk_requests_user_id_created_at_idx" ON "kvkk_requests"("user_id", "created_at");


-- ─────────────────────────────────────────────────────────────
-- Elle eklenen kurallar
-- ─────────────────────────────────────────────────────────────
ALTER SEQUENCE "kvkk_requests_no_seq" RESTART WITH 1001;
ALTER TABLE "data_exports" ADD CONSTRAINT "data_exports_status_check" CHECK ("status" IN ('hazirlaniyor', 'hazir', 'hata', 'suresi_doldu'));
ALTER TABLE "kvkk_requests" ADD CONSTRAINT "kvkk_requests_kind_check" CHECK ("kind" IN ('bilgi', 'duzeltme', 'silme', 'itiraz'));
ALTER TABLE "kvkk_requests" ADD CONSTRAINT "kvkk_requests_verification_check" CHECK ("verification" IN ('hesap_kodu', 'kimlik'));
ALTER TABLE "kvkk_requests" ADD CONSTRAINT "kvkk_requests_channel_check" CHECK ("channel" IN ('uygulama', 'eposta', 'posta'));
ALTER TABLE "kvkk_requests" ADD CONSTRAINT "kvkk_requests_status_check" CHECK ("status" IN ('acik', 'yanitlandi'));
ALTER TABLE "kvkk_requests" ADD CONSTRAINT "kvkk_requests_owner_check" CHECK ("user_id" IS NOT NULL OR "applicant_email" IS NOT NULL);
ALTER TABLE "kvkk_requests" ADD CONSTRAINT "kvkk_requests_answered_check"
  CHECK (("status" = 'yanitlandi') = ("response" IS NOT NULL AND "responded_at" IS NOT NULL));
-- Başvuru ve yanıtı silinmez (3 yıl saklanır; imha süreci ayrıca yönetir, Karar 59)
CREATE TRIGGER kvkk_requests_no_delete BEFORE DELETE ON "kvkk_requests" FOR EACH ROW EXECUTE FUNCTION rr_append_only();
