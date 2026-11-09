-- Talep görüntülenme sayısı (Taleplerim istatistiği)
ALTER TABLE "demands" ADD COLUMN "view_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "demands" ADD CONSTRAINT "demands_view_count_check" CHECK ("view_count" >= 0);
