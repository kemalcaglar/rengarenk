-- CreateTable
CREATE TABLE "home_layout_versions" (
    "id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "layout" JSONB NOT NULL,
    "note" TEXT NOT NULL,
    "publish_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "home_layout_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "home_layout_versions_version_key" ON "home_layout_versions"("version");

-- CreateIndex
CREATE INDEX "home_layout_versions_publish_at_idx" ON "home_layout_versions"("publish_at");


-- Kurallar
ALTER TABLE "home_layout_versions" ADD CONSTRAINT "home_layout_versions_version_check" CHECK ("version" > 0);
