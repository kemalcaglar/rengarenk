-- Tasarım değerleri (Karar 46): sürümlü renk, yazı tipi, köşe ve mevsimsel temalar; onay DESIGN_TOKENS
-- AlterEnum
ALTER TYPE "ApprovalKind" ADD VALUE 'DESIGN_TOKENS';

-- CreateTable
CREATE TABLE "design_versions" (
    "id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "tokens" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'taslak',
    "change_note" TEXT,
    "approval_id" UUID,
    "font_files" JSONB,
    "created_by" UUID,
    "published_by" UUID,
    "published_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "design_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "design_versions_version_key" ON "design_versions"("version");


ALTER TABLE "design_versions" ADD CONSTRAINT "design_versions_status_check" CHECK ("status" IN ('taslak', 'yayinda', 'eski'));
CREATE UNIQUE INDEX "design_versions_one_published" ON "design_versions"((true)) WHERE "status" = 'yayinda';
-- Yayınlanmış ya da eskimiş sürümün değerleri değişmez; silinmez (RR043)
CREATE OR REPLACE FUNCTION rr_design_frozen() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'design_versions kayıtları silinmez' USING ERRCODE = 'RR043';
  END IF;
  IF OLD.status <> 'taslak' AND (NEW.tokens <> OLD.tokens OR NEW.version <> OLD.version) THEN
    RAISE EXCEPTION 'Yayınlanmış tasarım sürümü değiştirilemez; yeni sürüm açın' USING ERRCODE = 'RR043';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER design_versions_frozen BEFORE UPDATE OR DELETE ON "design_versions"
  FOR EACH ROW EXECUTE FUNCTION rr_design_frozen();
