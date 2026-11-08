-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('WAITING', 'OPEN', 'DECLINED');

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "origin" TEXT NOT NULL,
    "demand_id" UUID,
    "vehicle_id" UUID,
    "buyer_user_id" UUID NOT NULL,
    "seller_account_id" UUID NOT NULL,
    "seller_user_id" UUID NOT NULL,
    "status" "ConversationStatus" NOT NULL,
    "entitlement" TEXT NOT NULL,
    "warned" BOOLEAN NOT NULL DEFAULT false,
    "phone_shared_at" TIMESTAMPTZ(3),
    "last_message_at" TIMESTAMPTZ(3) NOT NULL,
    "buyer_read_at" TIMESTAMPTZ(3),
    "seller_read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "side" TEXT NOT NULL,
    "sender_user_id" UUID,
    "kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "vehicle_id" UUID,
    "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_blocks" (
    "user_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("user_id","account_id")
);

-- CreateIndex
CREATE INDEX "conversations_buyer_user_id_last_message_at_idx" ON "conversations"("buyer_user_id", "last_message_at");

-- CreateIndex
CREATE INDEX "conversations_seller_account_id_last_message_at_idx" ON "conversations"("seller_account_id", "last_message_at");

-- CreateIndex
CREATE INDEX "conversations_seller_account_id_created_at_idx" ON "conversations"("seller_account_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "portfolio_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_buyer_user_id_fkey" FOREIGN KEY ("buyer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_seller_account_id_fkey" FOREIGN KEY ("seller_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Elle eklenenler
-- Bir talebe bir satıcı hesabından tek ilk mesaj (Karar 11.1); bir araç için alıcı başına tek sohbet (Karar 27)
CREATE UNIQUE INDEX "conversations_talep_satici_key" ON "conversations"("demand_id", "seller_account_id") WHERE "origin" = 'talep';
CREATE UNIQUE INDEX "conversations_arac_alici_key" ON "conversations"("vehicle_id", "buyer_user_id") WHERE "origin" = 'arac';
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_origin_check" CHECK (
  ("origin" = 'talep' AND "demand_id" IS NOT NULL) OR ("origin" = 'arac' AND "vehicle_id" IS NOT NULL)
);
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_entitlement_check"
  CHECK ("entitlement" IN ('gunluk', 'paket', 'ek', 'alici'));
ALTER TABLE "messages" ADD CONSTRAINT "messages_side_check" CHECK ("side" IN ('alici', 'satici', 'sistem'));
ALTER TABLE "messages" ADD CONSTRAINT "messages_kind_check" CHECK ("kind" IN ('metin', 'kart', 'sistem'));
ALTER TABLE "messages" ADD CONSTRAINT "messages_card_check" CHECK ("kind" <> 'kart' OR "vehicle_id" IS NOT NULL);
