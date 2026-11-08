-- Talepler ve talep geçmişi (Aşama 3; Karar 04, 05, 09, 10, 21). Prisma'nın ürettiği tablolar ve elle kurallar.
-- CreateEnum
CREATE TYPE "DemandStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PASSIVE', 'CLOSED', 'COMPLETED');

-- CreateTable
CREATE TABLE "demands" (
    "id" UUID NOT NULL,
    "no" BIGSERIAL NOT NULL,
    "account_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "schema_version" INTEGER,
    "status" "DemandStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL DEFAULT '',
    "data" JSONB NOT NULL DEFAULT '{}',
    "step" INTEGER NOT NULL DEFAULT 1,
    "make_key" TEXT,
    "series_key" TEXT,
    "model_key" TEXT,
    "il" TEXT,
    "ilce" TEXT,
    "budget_min" BIGINT,
    "budget_max" BIGINT,
    "year_min" INTEGER,
    "year_max" INTEGER,
    "phone_visible" BOOLEAN NOT NULL DEFAULT false,
    "whatsapp_visible" BOOLEAN NOT NULL DEFAULT false,
    "name_mode" TEXT NOT NULL DEFAULT 'tam',
    "entitlement" TEXT,
    "published_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    "reminder_days" INTEGER,
    "passive_at" TIMESTAMPTZ(3),
    "passive_reason" TEXT,
    "closed_at" TIMESTAMPTZ(3),
    "found_via" TEXT,
    "free_extension_used" BOOLEAN NOT NULL DEFAULT false,
    "extension_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "demands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demand_events" (
    "id" BIGSERIAL NOT NULL,
    "demand_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "user_id" UUID,
    "data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demand_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "demands_no_key" ON "demands"("no");

-- CreateIndex
CREATE INDEX "demands_account_id_status_idx" ON "demands"("account_id", "status");

-- CreateIndex
CREATE INDEX "demands_status_category_id_published_at_idx" ON "demands"("status", "category_id", "published_at");

-- CreateIndex
CREATE INDEX "demands_status_expires_at_idx" ON "demands"("status", "expires_at");

-- CreateIndex
CREATE INDEX "demand_events_demand_id_id_idx" ON "demand_events"("demand_id", "id");

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_events" ADD CONSTRAINT "demand_events_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Talep numarası 7 haneli başlar ("Talep No 1052187")
ALTER SEQUENCE "demands_no_seq" RESTART WITH 1000001;

ALTER TABLE "demands" ADD CONSTRAINT "demands_name_mode_check" CHECK ("name_mode" IN ('tam', 'kisa'));
ALTER TABLE "demands" ADD CONSTRAINT "demands_passive_reason_check" CHECK ("passive_reason" IS NULL OR "passive_reason" IN ('sure_doldu', 'kullanici'));
ALTER TABLE "demands" ADD CONSTRAINT "demands_found_via_check" CHECK ("found_via" IS NULL OR "found_via" IN ('rengarenk', 'baska_site', 'tanidik', 'vazgectim'));
-- WhatsApp yalnızca telefon görünürse (Karar 08.3)
ALTER TABLE "demands" ADD CONSTRAINT "demands_whatsapp_check" CHECK (NOT "whatsapp_visible" OR "phone_visible");
-- Yayında, pasif ya da tamamlanmış talep bir şema sürümüyle, yayın ve bitiş tarihiyle yayına girmiştir.
-- Kapatılan taslak (hiç yayınlanmamış) bu kuralın dışındadır.
ALTER TABLE "demands" ADD CONSTRAINT "demands_published_check" CHECK (
  "status" IN ('DRAFT', 'CLOSED') OR ("schema_version" IS NOT NULL AND "published_at" IS NOT NULL AND "expires_at" IS NOT NULL)
);
CREATE INDEX "demands_open_expiry_idx" ON "demands"("expires_at") WHERE "status" = 'PUBLISHED';

-- Talep silinmez (geçmiş ve mesajlar korunur, Karar 10); geçmiş yalnızca ekleme
CREATE TRIGGER demands_no_delete BEFORE DELETE ON "demands"
  FOR EACH ROW EXECUTE FUNCTION rr_append_only();
CREATE TRIGGER demand_events_append_only BEFORE UPDATE OR DELETE ON "demand_events"
  FOR EACH ROW EXECUTE FUNCTION rr_append_only();
