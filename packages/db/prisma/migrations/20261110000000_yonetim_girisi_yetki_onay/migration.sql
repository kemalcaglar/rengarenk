-- Sprint 3: yönetim girişi (Google Workspace + zorunlu 2FA), rol ve izin matrisi, dört göz onay motoru.
-- Karar 40, T10, Teknik tasarım §11. İade kilidi tetikleyicilerine (rr_refund_guard, rr_approval_immutable)
-- dokunulmaz; yeni onay durumları (EXPIRED, CANCELLED) iade denetiminde 'onaylanmamış' sayılır.

-- CreateEnum
CREATE TYPE "ApprovalOutcome" AS ENUM ('SUCCEEDED', 'FAILED');

-- AlterEnum

ALTER TYPE "ApprovalKind" ADD VALUE 'BULK_SEND';
ALTER TYPE "ApprovalKind" ADD VALUE 'COUPON';
ALTER TYPE "ApprovalKind" ADD VALUE 'PERMANENT_BAN';
ALTER TYPE "ApprovalKind" ADD VALUE 'ACCOUNT_DELETE';

-- AlterEnum

ALTER TYPE "ApprovalStatus" ADD VALUE 'EXPIRED';
ALTER TYPE "ApprovalStatus" ADD VALUE 'CANCELLED';

-- AlterEnum

ALTER TYPE "StaffRole" ADD VALUE 'OPERATIONS';
ALTER TYPE "StaffRole" ADD VALUE 'MARKETING';
ALTER TYPE "StaffRole" ADD VALUE 'VIEWER';
ALTER TYPE "StaffRole" ADD VALUE 'CUSTOM';

-- AlterEnum
ALTER TYPE "StaffStatus" ADD VALUE 'INVITED';

-- AlterTable
ALTER TABLE "approvals" ADD COLUMN     "decision_note" TEXT,
ADD COLUMN     "expires_at" TIMESTAMPTZ(3),
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "title" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "staff_members" ADD COLUMN     "custom_role_id" UUID,
ADD COLUMN     "disabled_at" TIMESTAMPTZ(3),
ADD COLUMN     "google_sub" TEXT,
ADD COLUMN     "invite_expires_at" TIMESTAMPTZ(3),
ADD COLUMN     "invited_by" UUID,
ADD COLUMN     "last_login_at" TIMESTAMPTZ(3),
ADD COLUMN     "totp_last_step" BIGINT,
ADD COLUMN     "totp_secret_enc" TEXT;

-- CreateTable
CREATE TABLE "staff_roles" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "staff_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_login_challenges" (
    "id" UUID NOT NULL,
    "state_hash" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "code_verifier" TEXT NOT NULL,
    "staff_id" UUID,
    "google_sub" TEXT,
    "ticket_hash" TEXT,
    "pending_totp_enc" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "google_at" TIMESTAMPTZ(3),
    "consumed_at" TIMESTAMPTZ(3),
    "ip" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_login_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_sessions" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "device_id" UUID,
    "token_hash" TEXT NOT NULL,
    "last_active_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "ip" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_devices" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "device_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "first_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_recovery_codes" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMPTZ(3),

    CONSTRAINT "staff_recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_results" (
    "id" BIGSERIAL NOT NULL,
    "approval_id" UUID NOT NULL,
    "outcome" "ApprovalOutcome" NOT NULL,
    "detail" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_roles_name_key" ON "staff_roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "staff_login_challenges_state_hash_key" ON "staff_login_challenges"("state_hash");

-- CreateIndex
CREATE UNIQUE INDEX "staff_login_challenges_ticket_hash_key" ON "staff_login_challenges"("ticket_hash");

-- CreateIndex
CREATE INDEX "staff_login_challenges_expires_at_idx" ON "staff_login_challenges"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "staff_sessions_token_hash_key" ON "staff_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "staff_sessions_staff_id_idx" ON "staff_sessions"("staff_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_devices_staff_id_device_hash_key" ON "staff_devices"("staff_id", "device_hash");

-- CreateIndex
CREATE INDEX "staff_recovery_codes_staff_id_idx" ON "staff_recovery_codes"("staff_id");

-- CreateIndex
CREATE INDEX "approval_results_approval_id_idx" ON "approval_results"("approval_id");

-- CreateIndex
CREATE INDEX "approvals_status_expires_at_idx" ON "approvals"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "staff_members_google_sub_key" ON "staff_members"("google_sub");

-- AddForeignKey
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_custom_role_id_fkey" FOREIGN KEY ("custom_role_id") REFERENCES "staff_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_sessions_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_sessions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "staff_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_devices" ADD CONSTRAINT "staff_devices_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_recovery_codes" ADD CONSTRAINT "staff_recovery_codes_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_results" ADD CONSTRAINT "approval_results_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "approvals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────
-- Elle eklenen kurallar (Prisma şemada ifade edemez)
-- ─────────────────────────────────────────────────────────────

-- CATALOG eski bir roldür; sahip kararıyla (7 Kasım 2026) hazır roller dışında, atanamaz.
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_role_not_catalog"
  CHECK ("role"::text <> 'CATALOG');

-- Özel rol yalnızca CUSTOM rolüyle birlikte bulunur (yeni enum değeri bu işlemde metin olarak karşılaştırılır).
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_custom_role_check"
  CHECK (("role"::text = 'CUSTOM') = ("custom_role_id" IS NOT NULL));

-- Onay yürütme sonuçları yalnızca ekleme kabul eder.
CREATE TRIGGER approval_results_append_only BEFORE UPDATE OR DELETE ON "approval_results"
  FOR EACH ROW EXECUTE FUNCTION rr_append_only();
