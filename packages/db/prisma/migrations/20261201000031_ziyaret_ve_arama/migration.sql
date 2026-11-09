-- Web ziyaret sayıları ve talep araması günlüğü (Raporlar: huni ve en çok aranan modeller); kişisel veri yok
-- CreateTable
CREATE TABLE "web_traffic_daily" (
    "day" DATE NOT NULL,
    "visitors" INTEGER NOT NULL DEFAULT 0,
    "pageviews" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "web_traffic_daily_pkey" PRIMARY KEY ("day")
);

-- CreateTable
CREATE TABLE "search_log_daily" (
    "day" DATE NOT NULL,
    "make_key" TEXT NOT NULL,
    "series_key" TEXT NOT NULL DEFAULT '',
    "count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_log_daily_pkey" PRIMARY KEY ("day","make_key","series_key")
);


ALTER TABLE "web_traffic_daily" ADD CONSTRAINT "web_traffic_daily_counts_check" CHECK ("visitors" >= 0 AND "pageviews" >= 0);
ALTER TABLE "search_log_daily" ADD CONSTRAINT "search_log_daily_count_check" CHECK ("count" >= 0);
