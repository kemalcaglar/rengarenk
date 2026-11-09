-- CreateTable
CREATE TABLE "automation_flows" (
    "key" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "automation_flows_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "automation_runs" (
    "id" UUID NOT NULL,
    "flow_key" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "steps" JSONB NOT NULL,
    "flow_version" INTEGER NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'aktif',
    "next_at" TIMESTAMPTZ(3) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "automation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "automation_runs_dedupe_key_key" ON "automation_runs"("dedupe_key");

-- CreateIndex
CREATE INDEX "automation_runs_status_next_at_idx" ON "automation_runs"("status", "next_at");

-- CreateIndex
CREATE INDEX "automation_runs_flow_key_created_at_idx" ON "automation_runs"("flow_key", "created_at");

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Kurallar
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_status_check"
  CHECK ("status" IN ('aktif', 'hedef', 'bitti', 'cikti', 'kapali'));
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_step_check" CHECK ("step" >= 0);
