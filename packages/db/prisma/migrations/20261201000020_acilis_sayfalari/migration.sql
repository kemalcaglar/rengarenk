-- CreateTable
CREATE TABLE "landing_pages" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seo_title" TEXT NOT NULL,
    "utm" JSONB NOT NULL,
    "blocks" JSONB NOT NULL,
    "published_blocks" JSONB,
    "status" TEXT NOT NULL DEFAULT 'taslak',
    "version" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMPTZ(3),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "landing_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landing_page_versions" (
    "id" UUID NOT NULL,
    "page_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "blocks" JSONB NOT NULL,
    "seo_title" TEXT NOT NULL,
    "published_by" UUID NOT NULL,
    "published_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "landing_page_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landing_stats" (
    "page_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "visits" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "landing_stats_pkey" PRIMARY KEY ("page_id","day")
);

-- CreateIndex
CREATE UNIQUE INDEX "landing_pages_slug_key" ON "landing_pages"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "landing_page_versions_page_id_version_key" ON "landing_page_versions"("page_id", "version");

-- AddForeignKey
ALTER TABLE "landing_page_versions" ADD CONSTRAINT "landing_page_versions_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "landing_pages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landing_stats" ADD CONSTRAINT "landing_stats_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "landing_pages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Kurallar
ALTER TABLE "landing_pages" ADD CONSTRAINT "landing_pages_status_check" CHECK ("status" IN ('taslak', 'yayinda', 'kapali'));
