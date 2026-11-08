-- AlterTable
ALTER TABLE "account_members" ADD COLUMN     "daily_message_limit" INTEGER;

-- CreateTable
CREATE TABLE "ratings" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "buyer_user_id" UUID NOT NULL,
    "seller_account_id" UUID NOT NULL,
    "stars" INTEGER NOT NULL,
    "flag" TEXT,
    "counted" BOOLEAN NOT NULL DEFAULT true,
    "fingerprint" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_stats" (
    "account_id" UUID NOT NULL,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "rating_avg" DOUBLE PRECISION,
    "rating_dist" INTEGER[] DEFAULT ARRAY[0, 0, 0, 0, 0]::INTEGER[],
    "response_convs" INTEGER NOT NULL DEFAULT 0,
    "response_median" INTEGER,
    "response_avg" INTEGER,
    "complaint_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL DEFAULT 0,
    "badges" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "computed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_stats_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "gallery_follows" (
    "user_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "digest_at" TIMESTAMPTZ(3),

    CONSTRAINT "gallery_follows_pkey" PRIMARY KEY ("user_id","account_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ratings_conversation_id_key" ON "ratings"("conversation_id");

-- CreateIndex
CREATE INDEX "ratings_seller_account_id_created_at_idx" ON "ratings"("seller_account_id", "created_at");

-- CreateIndex
CREATE INDEX "ratings_seller_account_id_fingerprint_idx" ON "ratings"("seller_account_id", "fingerprint");

-- CreateIndex
CREATE INDEX "gallery_follows_account_id_idx" ON "gallery_follows"("account_id");

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_buyer_user_id_fkey" FOREIGN KEY ("buyer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_seller_account_id_fkey" FOREIGN KEY ("seller_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_stats" ADD CONSTRAINT "seller_stats_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_follows" ADD CONSTRAINT "gallery_follows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_follows" ADD CONSTRAINT "gallery_follows_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Elle eklenenler
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_stars_check" CHECK ("stars" BETWEEN 1 AND 5);
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_flag_check" CHECK ("flag" IS NULL OR "flag" IN ('yeni_hesap', 'ayni_cihaz', 'bagli_hesap'));
ALTER TABLE "account_members" ADD CONSTRAINT "account_members_daily_limit_check" CHECK ("daily_message_limit" IS NULL OR "daily_message_limit" > 0);
