-- CreateTable
CREATE TABLE "report_views" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "tab" TEXT NOT NULL,
    "filter" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_views_staff_id_idx" ON "report_views"("staff_id");

