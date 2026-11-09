-- AlterTable
ALTER TABLE "users" ADD COLUMN     "call_from" INTEGER NOT NULL DEFAULT 9,
ADD COLUMN     "call_to" INTEGER NOT NULL DEFAULT 21,
ADD COLUMN     "il" TEXT,
ADD COLUMN     "ilce" TEXT,
ADD COLUMN     "name_mode" TEXT NOT NULL DEFAULT 'tam',
ADD COLUMN     "phone_visible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsapp_visible" BOOLEAN NOT NULL DEFAULT false;


-- Kurallar
ALTER TABLE "users" ADD CONSTRAINT "users_name_mode_check" CHECK ("name_mode" IN ('tam', 'kisa'));
ALTER TABLE "users" ADD CONSTRAINT "users_call_hours_check" CHECK ("call_from" BETWEEN 0 AND 23 AND "call_to" BETWEEN 1 AND 24 AND "call_from" < "call_to");
ALTER TABLE "users" ADD CONSTRAINT "users_whatsapp_check" CHECK (NOT "whatsapp_visible" OR "phone_visible");
