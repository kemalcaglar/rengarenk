-- Özellik anahtarları ve bakım modu (T13, Karar 47). Anahtar listesi kodda: packages/shared/src/flags.ts
-- CreateEnum
CREATE TYPE "FlagAudience" AS ENUM ('ALL', 'BUSINESS', 'TESTERS');

-- CreateTable
CREATE TABLE "feature_flags" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "audience" "FlagAudience" NOT NULL DEFAULT 'ALL',
    "percent" INTEGER NOT NULL DEFAULT 100,
    "platforms" "DevicePlatform"[] DEFAULT ARRAY[]::"DevicePlatform"[],
    "note" TEXT,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "feature_testers" (
    "user_id" UUID NOT NULL,
    "added_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_testers_pkey" PRIMARY KEY ("user_id")
);

-- AddForeignKey
ALTER TABLE "feature_testers" ADD CONSTRAINT "feature_testers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Elle eklenen: yüzde 0 ile 100 arasında olmalı.
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_percent_range" CHECK ("percent" BETWEEN 0 AND 100);
