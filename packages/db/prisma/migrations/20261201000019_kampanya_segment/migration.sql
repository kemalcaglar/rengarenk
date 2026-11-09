-- AlterTable
ALTER TABLE "deliveries" ADD COLUMN     "campaign_id" UUID;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "campaign_id" UUID;

-- CreateTable
CREATE TABLE "segments" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "rules" JSONB NOT NULL,
    "last_count" INTEGER,
    "counted_at" TIMESTAMPTZ(3),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "segment_id" UUID NOT NULL,
    "channels" TEXT[],
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "button_text" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "scheduled_at" TIMESTAMPTZ(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'taslak',
    "approval_id" UUID,
    "estimate" JSONB,
    "target_count" INTEGER,
    "sent_count" INTEGER,
    "sent_at" TIMESTAMPTZ(3),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_approval_id_key" ON "campaigns"("approval_id");

-- CreateIndex
CREATE INDEX "campaigns_status_scheduled_at_idx" ON "campaigns"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "deliveries_campaign_id_idx" ON "deliveries"("campaign_id");

-- CreateIndex
CREATE INDEX "notifications_campaign_id_idx" ON "notifications"("campaign_id");

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "segments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Kurallar
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_status_check" CHECK ("status" IN ('taslak', 'onay_bekliyor', 'zamanlandi', 'gonderiliyor', 'gonderildi', 'reddedildi', 'iptal'));
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_channels_check" CHECK ("channels" <@ ARRAY['uygulama', 'eposta']::TEXT[]);
