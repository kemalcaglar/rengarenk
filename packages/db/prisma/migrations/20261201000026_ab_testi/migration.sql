-- AlterTable
ALTER TABLE "banner_stats" DROP CONSTRAINT "banner_stats_pkey",
ADD COLUMN     "arm" TEXT NOT NULL DEFAULT 'A',
ADD CONSTRAINT "banner_stats_pkey" PRIMARY KEY ("banner_id", "day", "arm");

-- AlterTable
ALTER TABLE "banners" ADD COLUMN     "ab_ended_at" TIMESTAMPTZ(3),
ADD COLUMN     "ab_winner" TEXT,
ADD COLUMN     "variant_b" JSONB;

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "variant_b" JSONB;


-- Kurallar
ALTER TABLE "banner_stats" ADD CONSTRAINT "banner_stats_arm_check" CHECK ("arm" IN ('A', 'B'));
ALTER TABLE "banners" ADD CONSTRAINT "banners_ab_winner_check" CHECK ("ab_winner" IS NULL OR "ab_winner" IN ('A', 'B'));
