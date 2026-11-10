-- Konsol › Talepler ve portföy (Karar 53): çalışanın düzeltme notu ve kategori önerisi
-- AlterTable
ALTER TABLE "demands" ADD COLUMN     "correction_note" TEXT,
ADD COLUMN     "suggested_category_id" UUID;

