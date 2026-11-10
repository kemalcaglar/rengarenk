-- Sistem sağlığı ve yedek (Karar 56): servis yoklaması ve yedek kayıtları
-- CreateTable
CREATE TABLE "health_samples" (
    "at" TIMESTAMPTZ(3) NOT NULL,
    "results" JSONB NOT NULL,

    CONSTRAINT "health_samples_pkey" PRIMARY KEY ("at")
);

-- CreateTable
CREATE TABLE "backup_runs" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "size_bytes" BIGINT,
    "location" TEXT,
    "note" TEXT,
    "requested_by" UUID,
    "started_at" TIMESTAMPTZ(3),
    "finished_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backup_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "backup_runs_kind_created_at_idx" ON "backup_runs"("kind", "created_at");


ALTER TABLE "backup_runs" ADD CONSTRAINT "backup_runs_kind_check" CHECK ("kind" IN ('tam', 'artimli', 'geri_yukleme_testi'));
ALTER TABLE "backup_runs" ADD CONSTRAINT "backup_runs_status_check" CHECK ("status" IN ('istendi', 'calisiyor', 'basarili', 'hata'));
