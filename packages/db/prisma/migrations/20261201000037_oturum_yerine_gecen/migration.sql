-- Kaybolan yenileme yanıtı: döndürmede yerine açılan oturum (kısa hoşgörü süresinde eski jeton çalınma sayılmaz)
-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "replaced_by" UUID;
