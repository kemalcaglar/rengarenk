-- CreateTable
CREATE TABLE "user_attributions" (
    "user_id" UUID NOT NULL,
    "first" JSONB,
    "last" JSONB,
    "channel" TEXT NOT NULL DEFAULT 'organik',
    "network" TEXT,
    "campaign" TEXT,
    "cookie_ok" BOOLEAN NOT NULL DEFAULT false,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_attributions_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "ad_events" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "value_kurus" INTEGER,
    "category" TEXT,
    "meta_status" TEXT NOT NULL DEFAULT 'bekliyor',
    "google_status" TEXT NOT NULL DEFAULT 'yok',
    "tries" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "sent_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_spend" (
    "network" TEXT NOT NULL,
    "campaign" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "spend_kurus" INTEGER NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "fetched_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_spend_pkey" PRIMARY KEY ("network","campaign","day")
);

-- CreateTable
CREATE TABLE "ad_network_status" (
    "network" TEXT NOT NULL,
    "last_sent_at" TIMESTAMPTZ(3),
    "last_spend_at" TIMESTAMPTZ(3),
    "last_error" TEXT,
    "last_error_at" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_network_status_pkey" PRIMARY KEY ("network")
);

-- CreateIndex
CREATE INDEX "user_attributions_channel_campaign_idx" ON "user_attributions"("channel", "campaign");

-- CreateIndex
CREATE INDEX "ad_events_meta_status_created_at_idx" ON "ad_events"("meta_status", "created_at");

-- CreateIndex
CREATE INDEX "ad_events_google_status_created_at_idx" ON "ad_events"("google_status", "created_at");

-- CreateIndex
CREATE INDEX "ad_events_user_id_idx" ON "ad_events"("user_id");

-- AddForeignKey
ALTER TABLE "user_attributions" ADD CONSTRAINT "user_attributions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_events" ADD CONSTRAINT "ad_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Kısıtlar (Karar 35)
ALTER TABLE "ad_events" ADD CONSTRAINT "ad_events_name_check" CHECK ("name" IN ('CompleteRegistration','Lead','SubmitApplication','DealerApproved','Subscribe','Purchase'));
ALTER TABLE "ad_events" ADD CONSTRAINT "ad_events_meta_status_check" CHECK ("meta_status" IN ('bekliyor','gonderildi','hata','yok','iptal'));
ALTER TABLE "ad_events" ADD CONSTRAINT "ad_events_google_status_check" CHECK ("google_status" IN ('bekliyor','gonderildi','hata','yok','iptal'));
ALTER TABLE "user_attributions" ADD CONSTRAINT "user_attributions_channel_check" CHECK ("channel" IN ('reklam','bildirim','organik'));
ALTER TABLE "ad_spend" ADD CONSTRAINT "ad_spend_check" CHECK ("spend_kurus" >= 0 AND "impressions" >= 0 AND "clicks" >= 0);
