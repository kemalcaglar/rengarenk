-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "rotated" BOOLEAN NOT NULL DEFAULT false;


-- Var olan kapatılmış oturumlar döndürmeyle mi elle mi kapandı bilinmiyor; eski davranış (çalınma sayılır) korunur
UPDATE "sessions" SET "rotated" = true WHERE "revoked_at" IS NOT NULL;
