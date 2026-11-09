-- AlterTable
ALTER TABLE "demands" ADD COLUMN     "platform" TEXT;

-- CreateTable
CREATE TABLE "monthly_goals" (
    "month" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "updated_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "monthly_goals_pkey" PRIMARY KEY ("month","key")
);

-- CreateTable
CREATE TABLE "chart_notes" (
    "id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "text" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "ref_id" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chart_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chart_notes_day_idx" ON "chart_notes"("day");


-- Kurallar
ALTER TABLE "demands" ADD CONSTRAINT "demands_platform_check" CHECK ("platform" IS NULL OR "platform" IN ('WEB', 'IOS', 'ANDROID'));
ALTER TABLE "monthly_goals" ADD CONSTRAINT "monthly_goals_key_check" CHECK ("key" IN ('talep', 'buldum', 'gelir', 'ucretli_galeri', 'ana_olcu'));
ALTER TABLE "chart_notes" ADD CONSTRAINT "chart_notes_source_check" CHECK ("source" IN ('elle', 'fiyat', 'kural', 'kampanya'));
