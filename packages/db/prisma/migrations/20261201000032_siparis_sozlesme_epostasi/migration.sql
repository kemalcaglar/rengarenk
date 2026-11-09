-- Ön bilgilendirme formu ve sözleşmenin e-postayla gönderimi (Mesafeli Sözleşmeler Yönetmeliği; Karar 39)
-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "contract_note" TEXT,
ADD COLUMN     "contract_sent_at" TIMESTAMPTZ(3);

