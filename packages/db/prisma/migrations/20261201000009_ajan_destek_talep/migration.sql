-- AlterTable
ALTER TABLE "demands" ADD COLUMN     "correction_at" TIMESTAMPTZ(3),
ADD COLUMN     "correction_flags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "support_tickets" ADD COLUMN     "agent_answered_at" TIMESTAMPTZ(3),
ADD COLUMN     "agent_confidence" INTEGER,
ADD COLUMN     "agent_draft" TEXT,
ADD COLUMN     "agent_note" TEXT;


ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_agent_confidence_check"
  CHECK ("agent_confidence" IS NULL OR ("agent_confidence" >= 0 AND "agent_confidence" <= 100));

-- Ajanın yeni işlem türleri (Karar 41): talep düzeltme isteği, destek yanıtı, spam kısıtlama, SMS yedeğe geçiş
ALTER TABLE "agent_actions" DROP CONSTRAINT "agent_actions_kind_check";
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_kind_check"
  CHECK ("kind" IN ('mesaj_gizle', 'galeri_onay', 'ticari_durdur', 'iade_onerisi', 'imha_sayimi', 'ozet', 'insana',
                    'talep_duzeltme', 'destek_yanit', 'spam_kisit', 'sms_yedek'));
