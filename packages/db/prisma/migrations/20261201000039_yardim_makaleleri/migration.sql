-- Yardım makaleleri (Karar 46): konsoldan yönetilir, okunma ve faydalı sayaçları
-- CreateTable
CREATE TABLE "help_articles" (
    "id" UUID NOT NULL,
    "topic" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'taslak',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'ekip',
    "views" INTEGER NOT NULL DEFAULT 0,
    "helpful_yes" INTEGER NOT NULL DEFAULT 0,
    "helpful_no" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "updated_by" UUID,
    "published_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "help_articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "help_articles_status_topic_sort_idx" ON "help_articles"("status", "topic", "sort");


ALTER TABLE "help_articles" ADD CONSTRAINT "help_articles_status_check" CHECK ("status" IN ('taslak', 'yayinda', 'arsiv'));
ALTER TABLE "help_articles" ADD CONSTRAINT "help_articles_source_check" CHECK ("source" IN ('ekip', 'ajan', 'kurulum'));
ALTER TABLE "help_articles" ADD CONSTRAINT "help_articles_counts_check" CHECK ("views" >= 0 AND "helpful_yes" >= 0 AND "helpful_no" >= 0);
