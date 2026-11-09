-- CreateTable
CREATE TABLE "banners" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "button" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL DEFAULT '',
    "place" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "il" TEXT,
    "platform" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(3),
    "ends_at" TIMESTAMPTZ(3),
    "published" BOOLEAN NOT NULL DEFAULT false,
    "published_by" UUID,
    "stopped_at" TIMESTAMPTZ(3),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banner_stats" (
    "banner_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "banner_stats_pkey" PRIMARY KEY ("banner_id","day")
);

-- CreateTable
CREATE TABLE "content_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "content_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "banners_place_published_idx" ON "banners"("place", "published");

-- AddForeignKey
ALTER TABLE "banner_stats" ADD CONSTRAINT "banner_stats_banner_id_fkey" FOREIGN KEY ("banner_id") REFERENCES "banners"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Kurallar
ALTER TABLE "banners" ADD CONSTRAINT "banners_place_check"
  CHECK ("place" IN ('anasayfa_ust', 'galeri_paneli', 'talep_listesi', 'talep_detay', 'duyuru', 'ust_serit'));
ALTER TABLE "banners" ADD CONSTRAINT "banners_audience_check"
  CHECK ("audience" IN ('herkes', 'ziyaretci', 'bireysel', 'galeri'));
ALTER TABLE "banners" ADD CONSTRAINT "banners_platform_check" CHECK ("platform" IN ('hepsi', 'web', 'mobil'));
ALTER TABLE "banners" ADD CONSTRAINT "banners_dates_check"
  CHECK (("starts_at" IS NULL) = ("ends_at" IS NULL) AND ("ends_at" IS NULL OR "ends_at" > "starts_at"));
ALTER TABLE "banners" ADD CONSTRAINT "banners_published_dates_check" CHECK (NOT "published" OR "starts_at" IS NOT NULL);
ALTER TABLE "banner_stats" ADD CONSTRAINT "banner_stats_counts_check" CHECK ("views" >= 0 AND "clicks" >= 0);
