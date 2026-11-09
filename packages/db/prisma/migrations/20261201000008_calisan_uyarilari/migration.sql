-- CreateTable
CREATE TABLE "staff_alerts" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "rule" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "critical" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "read_at" TIMESTAMPTZ(3),
    "email_status" TEXT NOT NULL DEFAULT 'bekliyor',
    "email_tries" INTEGER NOT NULL DEFAULT 0,
    "emailed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_alert_settings" (
    "rule" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_alert_settings_pkey" PRIMARY KEY ("rule")
);

-- CreateIndex
CREATE INDEX "staff_alerts_staff_id_created_at_idx" ON "staff_alerts"("staff_id", "created_at");

-- CreateIndex
CREATE INDEX "staff_alerts_email_status_created_at_idx" ON "staff_alerts"("email_status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "staff_alerts_staff_id_dedupe_key_key" ON "staff_alerts"("staff_id", "dedupe_key");


-- Teslim durumu ve deneme sayısı
ALTER TABLE "staff_alerts" ADD CONSTRAINT "staff_alerts_email_status_check"
  CHECK ("email_status" IN ('bekliyor', 'gonderildi', 'hata', 'yok'));
ALTER TABLE "staff_alerts" ADD CONSTRAINT "staff_alerts_email_tries_check" CHECK ("email_tries" >= 0);
