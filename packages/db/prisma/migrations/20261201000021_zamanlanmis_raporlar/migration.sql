-- CreateTable
CREATE TABLE "scheduled_reports" (
    "id" UUID NOT NULL,
    "key" TEXT,
    "name" TEXT NOT NULL,
    "source" JSONB NOT NULL,
    "frequency" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "recipients" UUID[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "approval_id" UUID,
    "created_by" UUID,
    "last_run_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "scheduled_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_report_runs" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "slot" TIMESTAMPTZ(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'calisiyor',
    "recipients" INTEGER NOT NULL DEFAULT 0,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),

    CONSTRAINT "scheduled_report_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_reports_key_key" ON "scheduled_reports"("key");

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_report_runs_report_id_slot_key" ON "scheduled_report_runs"("report_id", "slot");

-- AddForeignKey
ALTER TABLE "scheduled_report_runs" ADD CONSTRAINT "scheduled_report_runs_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "scheduled_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Kurallar
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_frequency_check"
  CHECK ("frequency" ~ '^(gun|hafta:[1-7]|ay:([1-9]|1[0-9]|2[0-8]))$');
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_time_check"
  CHECK ("time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_key_check"
  CHECK ("key" IS NULL OR "key" IN ('haftalik', 'aylik', 'galeri'));
ALTER TABLE "scheduled_report_runs" ADD CONSTRAINT "scheduled_report_runs_status_check"
  CHECK ("status" IN ('calisiyor', 'tamam', 'hata'));
