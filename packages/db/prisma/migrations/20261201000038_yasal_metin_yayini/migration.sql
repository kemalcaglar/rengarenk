-- Yasal metinlerin konsoldan yayını (Karar 46, 59): sahip onayı (LEGAL_TEXT), taslak notu ve onay bağlantısı
-- AlterEnum
ALTER TYPE "ApprovalKind" ADD VALUE 'LEGAL_TEXT';

-- AlterTable
ALTER TABLE "consent_texts" ADD COLUMN     "approval_id" UUID,
ADD COLUMN     "change_note" TEXT;

-- Yayın öncesi dönemde kullanıcılar en yeni taslağı onaylar: onay almış taslağın metni de değişmez (RR042);
-- düzenleme yeni taslak sürüm açar. Yayınlanmış ya da eskimiş sürüm zaten değişmez (RR041).
CREATE OR REPLACE FUNCTION rr_consent_text_frozen() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'consent_texts kayıtları silinmez' USING ERRCODE = 'RR040';
  END IF;
  IF OLD.status <> 'taslak' AND (NEW.body <> OLD.body OR NEW.title <> OLD.title OR NEW.version <> OLD.version OR NEW.key <> OLD.key) THEN
    RAISE EXCEPTION 'Yayınlanmış yasal metin değiştirilemez; yeni sürüm açın' USING ERRCODE = 'RR041';
  END IF;
  IF OLD.status = 'taslak'
     AND (NEW.body <> OLD.body OR NEW.title <> OLD.title OR NEW.version <> OLD.version OR NEW.key <> OLD.key)
     AND EXISTS (SELECT 1 FROM consents c WHERE c.text_key = OLD.key AND c.text_version = OLD.version) THEN
    RAISE EXCEPTION 'Kullanıcıların onayladığı taslak değiştirilemez; yeni sürüm açın' USING ERRCODE = 'RR042';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
