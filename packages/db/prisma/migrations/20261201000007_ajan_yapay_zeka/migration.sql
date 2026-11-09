-- CreateTable
CREATE TABLE "ai_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "limit_usd" INTEGER NOT NULL DEFAULT 150,
    "alert_month" TEXT,
    "cap_month" TEXT,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ai_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_task_switches" (
    "task" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ai_task_switches_pkey" PRIMARY KEY ("task")
);

-- CreateTable
CREATE TABLE "ai_calls" (
    "id" UUID NOT NULL,
    "task" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_micro_usd" INTEGER NOT NULL DEFAULT 0,
    "input_masked" TEXT,
    "output_masked" TEXT,
    "masked" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_actions" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "undo" JSONB,
    "undone_at" TIMESTAMPTZ(3),
    "undone_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_suggestions" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'acik',
    "closed_by" UUID,
    "closed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_calls_created_at_idx" ON "ai_calls"("created_at");

-- CreateIndex
CREATE INDEX "ai_calls_task_created_at_idx" ON "ai_calls"("task", "created_at");

-- CreateIndex
CREATE INDEX "agent_actions_created_at_idx" ON "agent_actions"("created_at");

-- CreateIndex
CREATE INDEX "agent_actions_kind_created_at_idx" ON "agent_actions"("kind", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "agent_suggestions_key_key" ON "agent_suggestions"("key");

-- CreateIndex
CREATE INDEX "agent_suggestions_status_created_at_idx" ON "agent_suggestions"("status", "created_at");


ALTER TABLE "ai_settings" ADD CONSTRAINT "ai_settings_single" CHECK ("id" = 1);
ALTER TABLE "ai_settings" ADD CONSTRAINT "ai_settings_limit_check" CHECK ("limit_usd" BETWEEN 25 AND 5000);
ALTER TABLE "ai_task_switches" ADD CONSTRAINT "ai_task_switches_task_check"
  CHECK ("task" IN ('moderasyon', 'destek', 'talep_asistani', 'mesaj_guvenligi', 'rapor', 'kampanya', 'toplu_yukleme'));
ALTER TABLE "ai_calls" ADD CONSTRAINT "ai_calls_status_check" CHECK ("status" IN ('tamam', 'kapali', 'butce', 'hata'));
ALTER TABLE "ai_calls" ADD CONSTRAINT "ai_calls_cost_check" CHECK ("cost_micro_usd" >= 0);
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_kind_check"
  CHECK ("kind" IN ('mesaj_gizle', 'galeri_onay', 'ticari_durdur', 'iade_onerisi', 'imha_sayimi', 'ozet', 'insana'));
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_undo_check" CHECK (("undone_at" IS NULL) = ("undone_by" IS NULL));
ALTER TABLE "agent_suggestions" ADD CONSTRAINT "agent_suggestions_kind_check" CHECK ("kind" IN ('kampanya', 'kural', 'gelir'));
ALTER TABLE "agent_suggestions" ADD CONSTRAINT "agent_suggestions_status_check" CHECK ("status" IN ('acik', 'kapandi'));

-- Çağrı ve ajan işlemi kaydı silinmez (maliyet ve karne bunlardan hesaplanır)
CREATE TRIGGER ai_calls_append_only BEFORE UPDATE OR DELETE ON "ai_calls" FOR EACH ROW EXECUTE FUNCTION rr_append_only();
CREATE TRIGGER agent_actions_no_delete BEFORE DELETE ON "agent_actions" FOR EACH ROW EXECUTE FUNCTION rr_append_only();

-- Başlangıç: aylık sınır 150 USD (Karar 57); ajan açık başlar (durdurma düğmesi bu anahtardır)
INSERT INTO "ai_settings" ("id", "limit_usd", "updated_at") VALUES (1, 150, CURRENT_TIMESTAMP);
INSERT INTO "feature_flags" ("key", "enabled", "note", "updated_at")
VALUES ('ajan', true, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("key") DO NOTHING;
