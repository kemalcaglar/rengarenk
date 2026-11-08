
-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "hidden_at" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "portfolio_vehicles" ADD COLUMN     "moderated_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "no" SERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "reporter_user_id" UUID,
    "target_type" TEXT NOT NULL,
    "target_id" UUID NOT NULL,
    "target_user_id" UUID NOT NULL,
    "target_account_id" UUID,
    "reason" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "note" TEXT,
    "signals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "due_at" TIMESTAMPTZ(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'acik',
    "decision" TEXT,
    "decision_note" TEXT,
    "decided_by_staff_id" UUID,
    "decided_by_agent" BOOLEAN NOT NULL DEFAULT false,
    "decided_at" TIMESTAMPTZ(3),
    "agent_action" TEXT,
    "approval_id" UUID,
    "reversed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_appeals" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'acik',
    "decided_by_staff_id" UUID,
    "decision_note" TEXT,
    "decided_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_appeals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sanctions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "account_id" UUID,
    "kind" TEXT NOT NULL,
    "report_id" UUID,
    "until" TIMESTAMPTZ(3),
    "approval_id" UUID,
    "created_by_staff" UUID,
    "by_agent" BOOLEAN NOT NULL DEFAULT false,
    "lifted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sanctions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banned_words" (
    "word" TEXT NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banned_words_pkey" PRIMARY KEY ("word")
);

-- CreateTable
CREATE TABLE "content_filters" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "content_filters_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "reports_no_key" ON "reports"("no");

-- CreateIndex
CREATE INDEX "reports_status_due_at_idx" ON "reports"("status", "due_at");

-- CreateIndex
CREATE INDEX "reports_target_user_id_created_at_idx" ON "reports"("target_user_id", "created_at");

-- CreateIndex
CREATE INDEX "reports_target_account_id_decided_at_idx" ON "reports"("target_account_id", "decided_at");

-- CreateIndex
CREATE INDEX "reports_reporter_user_id_created_at_idx" ON "reports"("reporter_user_id", "created_at");

-- CreateIndex
CREATE INDEX "reports_target_type_target_id_idx" ON "reports"("target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "report_appeals_report_id_key" ON "report_appeals"("report_id");

-- CreateIndex
CREATE INDEX "report_appeals_status_created_at_idx" ON "report_appeals"("status", "created_at");

-- CreateIndex
CREATE INDEX "user_sanctions_user_id_kind_created_at_idx" ON "user_sanctions"("user_id", "kind", "created_at");

-- CreateIndex
CREATE INDEX "user_sanctions_account_id_kind_created_at_idx" ON "user_sanctions"("account_id", "kind", "created_at");

-- AddForeignKey
ALTER TABLE "report_appeals" ADD CONSTRAINT "report_appeals_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sanctions" ADD CONSTRAINT "user_sanctions_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────
-- Elle eklenen kurallar
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "reports" ADD CONSTRAINT "reports_source_check" CHECK ("source" IN ('kullanici', 'kural', 'ajan'));
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_type_check" CHECK ("target_type" IN ('mesaj', 'talep', 'arac'));
ALTER TABLE "reports" ADD CONSTRAINT "reports_priority_check" CHECK ("priority" IN ('kritik', 'yuksek', 'normal'));
ALTER TABLE "reports" ADD CONSTRAINT "reports_status_check" CHECK ("status" IN ('acik', 'kapali'));
ALTER TABLE "reports" ADD CONSTRAINT "reports_decision_check"
  CHECK ("decision" IS NULL OR "decision" IN ('uyari', 'gizle', 'aski', 'engel', 'red'));
-- Kapalı şikâyetin kararı ve karar zamanı vardır; kullanıcı şikâyetinin şikâyet edeni vardır
ALTER TABLE "reports" ADD CONSTRAINT "reports_decided_check"
  CHECK (("status" = 'acik') = ("decision" IS NULL AND "decided_at" IS NULL));
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_check"
  CHECK ("source" <> 'kullanici' OR "reporter_user_id" IS NOT NULL);
ALTER TABLE "report_appeals" ADD CONSTRAINT "report_appeals_status_check" CHECK ("status" IN ('acik', 'kabul', 'red'));
ALTER TABLE "user_sanctions" ADD CONSTRAINT "user_sanctions_kind_check" CHECK ("kind" IN ('uyari', 'aski', 'engel'));

-- Şikâyet, itiraz ve yaptırım kayıtları silinmez (moderasyon geçmişi ve itiraz için)
CREATE TRIGGER reports_no_delete BEFORE DELETE ON "reports" FOR EACH ROW EXECUTE FUNCTION rr_append_only();
CREATE TRIGGER report_appeals_no_delete BEFORE DELETE ON "report_appeals" FOR EACH ROW EXECUTE FUNCTION rr_append_only();
CREATE TRIGGER user_sanctions_no_delete BEFORE DELETE ON "user_sanctions" FOR EACH ROW EXECUTE FUNCTION rr_append_only();

-- İlk yasaklı kelimeler (konsoldan değişir)
INSERT INTO "banned_words" ("word") VALUES ('kapora'), ('ön ödeme'), ('IBAN'), ('ödeme iste'), ('güvenli ödeme linki');

-- Moderasyonun yayından kaldırdığı talep (sahibi yeniden yayına alamaz)
ALTER TABLE "demands" DROP CONSTRAINT "demands_passive_reason_check";
ALTER TABLE "demands" ADD CONSTRAINT "demands_passive_reason_check"
  CHECK ("passive_reason" IS NULL OR "passive_reason" IN ('sure_doldu', 'kullanici', 'moderasyon'));
