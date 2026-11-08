-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'ENDED');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'urun',
ADD COLUMN     "subscription_id" UUID;

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "price_kurus" BIGINT NOT NULL,
    "current_period_start" TIMESTAMPTZ(3) NOT NULL,
    "current_period_end" TIMESTAMPTZ(3) NOT NULL,
    "quota_cycle_start" TIMESTAMPTZ(3) NOT NULL,
    "quota_cycle_no" INTEGER NOT NULL DEFAULT 0,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "cancel_requested_at" TIMESTAMPTZ(3),
    "next_plan" TEXT,
    "next_period" TEXT,
    "card_token" TEXT,
    "card_label" TEXT,
    "billing_email" TEXT NOT NULL,
    "fail_count" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMPTZ(3),
    "reminded_for" TIMESTAMPTZ(3),
    "ended_at" TIMESTAMPTZ(3),
    "end_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_account_id_key" ON "subscriptions"("account_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_current_period_end_idx" ON "subscriptions"("status", "current_period_end");

-- CreateIndex
CREATE INDEX "orders_account_id_created_at_idx" ON "orders"("account_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_subscription_id_created_at_idx" ON "orders"("subscription_id", "created_at");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Elle: kurallar ve silme kilidi (abonelik kaydı 10 yıl saklanır, Karar 59)
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_check"
  CHECK ("plan" IN ('baslangic', 'profesyonel', 'kurumsal'));
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_period_check" CHECK ("period" IN ('aylik', 'yillik'));
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_next_check"
  CHECK (("next_plan" IS NULL OR "next_plan" IN ('baslangic', 'profesyonel', 'kurumsal'))
     AND ("next_period" IS NULL OR "next_period" IN ('aylik', 'yillik')));
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_period_order_check"
  CHECK ("current_period_end" > "current_period_start" AND "price_kurus" > 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_kind_check"
  CHECK ("kind" IN ('urun', 'abonelik', 'yukseltme', 'yenileme'));
ALTER TABLE "orders" ADD CONSTRAINT "orders_subscription_kind_check"
  CHECK (("kind" = 'urun') = ("subscription_id" IS NULL) OR "kind" = 'abonelik');
CREATE TRIGGER subscriptions_no_delete BEFORE DELETE ON "subscriptions"
  FOR EACH ROW EXECUTE FUNCTION rr_append_only();
