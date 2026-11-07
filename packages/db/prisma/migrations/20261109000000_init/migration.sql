-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AccountKind" AS ENUM ('INDIVIDUAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "BusinessKind" AS ENUM ('DEALER', 'RENTAL', 'BOAT', 'AIRCRAFT');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING_REVIEW', 'ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('OWNER', 'MANAGER', 'SALES');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('IOS', 'ANDROID', 'WEB');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('OWNER', 'ADMIN', 'MODERATOR', 'SUPPORT', 'CATALOG', 'FINANCE', 'AGENT');

-- CreateEnum
CREATE TYPE "StaffStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'STAFF', 'AGENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ApprovalKind" AS ENUM ('REFUND', 'PRICE_CHANGE', 'STAFF_ROLE');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING_EXECUTION', 'EXECUTED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "phone_verified_at" TIMESTAMPTZ(3),
    "display_name" TEXT,
    "email" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "kind" "AccountKind" NOT NULL,
    "name" TEXT NOT NULL,
    "business_kind" "BusinessKind",
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_members" (
    "account_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "MemberRole" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_members_pkey" PRIMARY KEY ("account_id","user_id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "push_token" TEXT,
    "trusted" BOOLEAN NOT NULL DEFAULT false,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" UUID,
    "refresh_token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_challenges" (
    "id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "ip" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_members" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "status" "StaffStatus" NOT NULL DEFAULT 'ACTIVE',
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "actor_type" "ActorType" NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox" (
    "id" BIGSERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(3),

    CONSTRAINT "outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlement_ledger" (
    "id" BIGSERIAL NOT NULL,
    "account_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entitlement_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" UUID NOT NULL,
    "kind" "ApprovalKind" NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "subject_type" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "amount_kurus" BIGINT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "requested_by" UUID NOT NULL,
    "decided_by" UUID,
    "decided_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "payment_id" TEXT NOT NULL,
    "amount_kurus" BIGINT NOT NULL,
    "approval_id" UUID NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING_EXECUTION',
    "executed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "account_members_user_id_idx" ON "account_members"("user_id");

-- CreateIndex
CREATE INDEX "devices_user_id_idx" ON "devices"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "otp_challenges_phone_created_at_idx" ON "otp_challenges"("phone", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "staff_members_email_key" ON "staff_members"("email");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- CreateIndex
CREATE INDEX "outbox_published_at_id_idx" ON "outbox"("published_at", "id");

-- CreateIndex
CREATE INDEX "entitlement_ledger_account_id_kind_idx" ON "entitlement_ledger"("account_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "entitlement_ledger_source_type_source_id_kind_key" ON "entitlement_ledger"("source_type", "source_id", "kind");

-- CreateIndex
CREATE INDEX "approvals_kind_status_idx" ON "approvals"("kind", "status");

-- CreateIndex
CREATE INDEX "refunds_approval_id_idx" ON "refunds"("approval_id");

-- AddForeignKey
ALTER TABLE "account_members" ADD CONSTRAINT "account_members_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_members" ADD CONSTRAINT "account_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement_ledger" ADD CONSTRAINT "entitlement_ledger_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "approvals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────
-- Elle eklenen kurallar (Prisma şemada ifade edemez)
-- ─────────────────────────────────────────────────────────────

-- Yalnızca ekleme yapılan tablolar: işlem kaydı ve hak defteri değiştirilemez, silinemez.
CREATE FUNCTION rr_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% tablosu yalnızca ekleme kabul eder', TG_TABLE_NAME USING ERRCODE = 'RR001';
END;
$$;

CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION rr_append_only();

CREATE TRIGGER entitlement_ledger_append_only BEFORE UPDATE OR DELETE ON "entitlement_ledger"
  FOR EACH ROW EXECUTE FUNCTION rr_append_only();

-- İade kilidi 1 (Teknik tasarım §7): iade kaydı yalnızca Sahip rolündeki etkin bir çalışanın
-- verdiği, 72 saatten eski olmayan, aynı ödeme ve aynı tutar için bir onayla oluşturulabilir
-- ve yürütülebilir. Onay sonradan geri çekilirse yürütme de engellenir.
CREATE FUNCTION rr_refund_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  a RECORD;
  decider_role "StaffRole";
  decider_status "StaffStatus";
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.amount_kurus = OLD.amount_kurus AND NEW.approval_id = OLD.approval_id THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.amount_kurus <> OLD.amount_kurus OR NEW.approval_id <> OLD.approval_id
     OR NEW.payment_id <> OLD.payment_id) THEN
    RAISE EXCEPTION 'iade kaydının tutarı, ödemesi veya onayı değiştirilemez' USING ERRCODE = 'RR010';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status <> 'EXECUTED' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO a FROM approvals WHERE id = NEW.approval_id;
  IF NOT FOUND OR a.kind <> 'REFUND' THEN
    RAISE EXCEPTION 'iade için onay bulunamadı' USING ERRCODE = 'RR011';
  END IF;
  IF a.status <> 'APPROVED' OR a.decided_by IS NULL OR a.decided_at IS NULL THEN
    RAISE EXCEPTION 'iade onaylanmamış' USING ERRCODE = 'RR012';
  END IF;
  SELECT role, status INTO decider_role, decider_status FROM staff_members WHERE id = a.decided_by;
  IF decider_role IS DISTINCT FROM 'OWNER' OR decider_status IS DISTINCT FROM 'ACTIVE' THEN
    RAISE EXCEPTION 'iadeyi yalnızca Sahip onaylayabilir' USING ERRCODE = 'RR013';
  END IF;
  IF a.decided_at < now() - interval '72 hours' THEN
    RAISE EXCEPTION 'iade onayı 72 saatten eski' USING ERRCODE = 'RR014';
  END IF;
  IF a.amount_kurus IS DISTINCT FROM NEW.amount_kurus OR a.subject_type <> 'payment'
     OR a.subject_id <> NEW.payment_id THEN
    RAISE EXCEPTION 'iade tutarı veya ödemesi onayla eşleşmiyor' USING ERRCODE = 'RR015';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER refunds_guard BEFORE INSERT OR UPDATE ON "refunds"
  FOR EACH ROW EXECUTE FUNCTION rr_refund_guard();

-- İade kayıtları silinemez.
CREATE TRIGGER refunds_no_delete BEFORE DELETE ON "refunds"
  FOR EACH ROW EXECUTE FUNCTION rr_append_only();

-- Onay kararı verildikten sonra karar değiştirilemez (yeni onay istenir).
CREATE FUNCTION rr_approval_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'PENDING' THEN
    RAISE EXCEPTION 'karara bağlanmış onay değiştirilemez' USING ERRCODE = 'RR020';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER approvals_immutable BEFORE UPDATE ON "approvals"
  FOR EACH ROW EXECUTE FUNCTION rr_approval_immutable();
