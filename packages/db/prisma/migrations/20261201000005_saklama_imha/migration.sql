-- AlterTable
ALTER TABLE "kvkk_requests" ADD COLUMN     "purged_at" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "support_tickets" ADD COLUMN     "purged_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "disposal_runs" (
    "id" UUID NOT NULL,
    "no" TEXT NOT NULL,
    "scheduled_for" TIMESTAMPTZ(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'liste',
    "counts" JSONB NOT NULL DEFAULT '{}',
    "counted_at" TIMESTAMPTZ(3),
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ(3),
    "approved_counts" JSONB,
    "ran_at" TIMESTAMPTZ(3),
    "report" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disposal_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "breach_incidents" (
    "id" UUID NOT NULL,
    "no" SERIAL NOT NULL,
    "drill" BOOLEAN NOT NULL,
    "summary" TEXT NOT NULL,
    "learned_at" TIMESTAMPTZ(3) NOT NULL,
    "deadline" TIMESTAMPTZ(3) NOT NULL,
    "steps" JSONB NOT NULL DEFAULT '{}',
    "opened_by" UUID NOT NULL,
    "closed_at" TIMESTAMPTZ(3),
    "closed_by" UUID,
    "report" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "breach_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "official_requests" (
    "id" UUID NOT NULL,
    "no" SERIAL NOT NULL,
    "authority" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "user_id" UUID,
    "account_id" UUID,
    "no_notify" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'belge_bekleniyor',
    "document_key" TEXT,
    "document_type" TEXT,
    "given" JSONB NOT NULL DEFAULT '[]',
    "note" TEXT,
    "created_by" UUID NOT NULL,
    "responded_by" UUID,
    "responded_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "official_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "disposal_runs_no_key" ON "disposal_runs"("no");

-- CreateIndex
CREATE INDEX "disposal_runs_status_scheduled_for_idx" ON "disposal_runs"("status", "scheduled_for");

-- CreateIndex
CREATE UNIQUE INDEX "breach_incidents_no_key" ON "breach_incidents"("no");

-- CreateIndex
CREATE INDEX "breach_incidents_closed_at_idx" ON "breach_incidents"("closed_at");

-- CreateIndex
CREATE UNIQUE INDEX "official_requests_no_key" ON "official_requests"("no");

-- CreateIndex
CREATE INDEX "official_requests_user_id_idx" ON "official_requests"("user_id");

-- CreateIndex
CREATE INDEX "official_requests_account_id_idx" ON "official_requests"("account_id");

-- CreateIndex
CREATE INDEX "official_requests_status_created_at_idx" ON "official_requests"("status", "created_at");


-- Kurallar (Karar 59)
ALTER TABLE "disposal_runs" ADD CONSTRAINT "disposal_runs_status_check" CHECK ("status" IN ('liste', 'onaylandi', 'calisti'));
ALTER TABLE "disposal_runs" ADD CONSTRAINT "disposal_runs_approval_check"
  CHECK ("status" = 'liste' OR ("approved_by" IS NOT NULL AND "approved_at" IS NOT NULL AND "approved_counts" IS NOT NULL));
ALTER TABLE "disposal_runs" ADD CONSTRAINT "disposal_runs_ran_check"
  CHECK (("status" = 'calisti') = ("ran_at" IS NOT NULL AND "report" IS NOT NULL));
ALTER TABLE "breach_incidents" ADD CONSTRAINT "breach_incidents_close_check"
  CHECK (("closed_at" IS NULL) = ("closed_by" IS NULL AND "report" IS NULL));
ALTER TABLE "official_requests" ADD CONSTRAINT "official_requests_status_check"
  CHECK ("status" IN ('belge_bekleniyor', 'inceleniyor', 'yanitlandi', 'reddedildi'));
ALTER TABLE "official_requests" ADD CONSTRAINT "official_requests_document_check"
  CHECK ("status" = 'belge_bekleniyor' OR "status" = 'reddedildi' OR "document_key" IS NOT NULL);
ALTER TABLE "official_requests" ADD CONSTRAINT "official_requests_reply_check"
  CHECK (("status" IN ('yanitlandi', 'reddedildi')) = ("responded_by" IS NOT NULL AND "responded_at" IS NOT NULL));
ALTER SEQUENCE "official_requests_no_seq" RESTART WITH 1001;
CREATE TRIGGER disposal_runs_no_delete BEFORE DELETE ON "disposal_runs" FOR EACH ROW EXECUTE FUNCTION rr_append_only();
CREATE TRIGGER breach_incidents_no_delete BEFORE DELETE ON "breach_incidents" FOR EACH ROW EXECUTE FUNCTION rr_append_only();
CREATE TRIGGER official_requests_no_delete BEFORE DELETE ON "official_requests" FOR EACH ROW EXECUTE FUNCTION rr_append_only();
