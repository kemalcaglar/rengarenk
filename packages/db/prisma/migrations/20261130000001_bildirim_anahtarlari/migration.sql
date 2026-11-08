-- CreateTable
CREATE TABLE "notification_switches" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notification_switches_pkey" PRIMARY KEY ("key")
);

