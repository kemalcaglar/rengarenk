-- Galeri başvurusu, belgeler, galeri profili ve çalışan davetleri (Karar 03, 12.5, 17, 20)
-- CreateEnum
CREATE TYPE "GalleryApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'DOCS_REQUESTED', 'APPROVED', 'REJECTED', 'REVOKED');

-- CreateTable
CREATE TABLE "gallery_applications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "business_kind" "BusinessKind",
    "status" "GalleryApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "data" JSONB NOT NULL DEFAULT '{}',
    "checks" JSONB,
    "agent_note" TEXT,
    "submitted_at" TIMESTAMPTZ(3),
    "checked_at" TIMESTAMPTZ(3),
    "decided_at" TIMESTAMPTZ(3),
    "decided_by" UUID,
    "decided_by_agent" BOOLEAN NOT NULL DEFAULT false,
    "decision_note" TEXT,
    "account_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "gallery_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gallery_documents" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gallery_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "galleries" (
    "account_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "business_kind" "BusinessKind" NOT NULL,
    "display_name" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "tax_no" TEXT NOT NULL,
    "tax_office" TEXT NOT NULL,
    "mersis_no" TEXT NOT NULL,
    "il" TEXT NOT NULL,
    "ilce" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "authority_no" TEXT,
    "about" TEXT,
    "working_hours" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'deneme',
    "trial_ends_at" TIMESTAMPTZ(3),
    "trial_reminder_days" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "application_id" UUID NOT NULL,
    "approved_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "galleries_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "account_invites" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,
    "invited_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "accepted_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "account_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gallery_applications_account_id_key" ON "gallery_applications"("account_id");

-- CreateIndex
CREATE INDEX "gallery_applications_user_id_idx" ON "gallery_applications"("user_id");

-- CreateIndex
CREATE INDEX "gallery_applications_status_submitted_at_idx" ON "gallery_applications"("status", "submitted_at");

-- CreateIndex
CREATE INDEX "gallery_documents_application_id_kind_idx" ON "gallery_documents"("application_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "galleries_slug_key" ON "galleries"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "galleries_application_id_key" ON "galleries"("application_id");

-- CreateIndex
CREATE INDEX "galleries_il_idx" ON "galleries"("il");

-- CreateIndex
CREATE INDEX "account_invites_phone_idx" ON "account_invites"("phone");

-- CreateIndex
CREATE INDEX "account_invites_account_id_idx" ON "account_invites"("account_id");

-- AddForeignKey
ALTER TABLE "gallery_applications" ADD CONSTRAINT "gallery_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_documents" ADD CONSTRAINT "gallery_documents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "gallery_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "galleries" ADD CONSTRAINT "galleries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_invites" ADD CONSTRAINT "account_invites_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ── Elle eklenen kısıtlar (Karar 03, 20) ──────────────────────
-- Kullanıcı başına tek açık başvuru
CREATE UNIQUE INDEX "gallery_applications_open_per_user" ON "gallery_applications"("user_id")
  WHERE "status" IN ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'DOCS_REQUESTED');
-- Onaylanan başvurunun galeri hesabı vardır; karar verilmiş başvurunun karar tarihi vardır
ALTER TABLE "gallery_applications" ADD CONSTRAINT "gallery_applications_account_check"
  CHECK ("status" NOT IN ('APPROVED', 'REVOKED') OR "account_id" IS NOT NULL);
ALTER TABLE "gallery_applications" ADD CONSTRAINT "gallery_applications_decided_check"
  CHECK ("status" NOT IN ('APPROVED', 'REJECTED', 'REVOKED') OR "decided_at" IS NOT NULL);
ALTER TABLE "gallery_applications" ADD CONSTRAINT "gallery_applications_submitted_check"
  CHECK ("status" = 'DRAFT' OR "submitted_at" IS NOT NULL);
-- Başvuru ve belgeler silinmez (inceleme ve uyum kaydı)
CREATE TRIGGER gallery_applications_no_delete BEFORE DELETE ON "gallery_applications"
  FOR EACH ROW EXECUTE FUNCTION rr_append_only();
CREATE TRIGGER gallery_documents_no_delete BEFORE DELETE ON "gallery_documents"
  FOR EACH ROW EXECUTE FUNCTION rr_append_only();

ALTER TABLE "galleries" ADD CONSTRAINT "galleries_plan_check"
  CHECK ("plan" IN ('deneme', 'baslangic', 'profesyonel', 'kurumsal'));
ALTER TABLE "galleries" ADD CONSTRAINT "galleries_trial_check"
  CHECK ("plan" <> 'deneme' OR "trial_ends_at" IS NOT NULL);
ALTER TABLE "galleries" ADD CONSTRAINT "galleries_slug_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- Hesap sahibi davet edilmez; aynı numaraya aynı galeriden tek açık davet
ALTER TABLE "account_invites" ADD CONSTRAINT "account_invites_role_check" CHECK ("role" <> 'OWNER');
CREATE UNIQUE INDEX "account_invites_open" ON "account_invites"("account_id", "phone")
  WHERE "accepted_at" IS NULL AND "revoked_at" IS NULL;
