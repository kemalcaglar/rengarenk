-- CreateTable
CREATE TABLE "ui_experiment_runs" (
    "id" UUID NOT NULL,
    "flag_key" TEXT NOT NULL,
    "percent" INTEGER NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(3),
    "winner" TEXT,

    CONSTRAINT "ui_experiment_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ui_experiment_events" (
    "run_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "arm" TEXT NOT NULL,
    "seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "passed_at" TIMESTAMPTZ(3),

    CONSTRAINT "ui_experiment_events_pkey" PRIMARY KEY ("run_id","user_id")
);

-- CreateIndex
CREATE INDEX "ui_experiment_runs_flag_key_ended_at_idx" ON "ui_experiment_runs"("flag_key", "ended_at");

-- AddForeignKey
ALTER TABLE "ui_experiment_events" ADD CONSTRAINT "ui_experiment_events_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "ui_experiment_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ui_experiment_events" ADD CONSTRAINT "ui_experiment_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Kısıtlar (Karar 44)
ALTER TABLE "ui_experiment_runs" ADD CONSTRAINT "ui_experiment_runs_check" CHECK ("percent" BETWEEN 1 AND 99 AND ("winner" IS NULL OR "winner" IN ('A','B')));
ALTER TABLE "ui_experiment_events" ADD CONSTRAINT "ui_experiment_events_arm_check" CHECK ("arm" IN ('A','B'));
-- Bir anahtarda aynı anda tek açık deney
CREATE UNIQUE INDEX "ui_experiment_runs_open_key" ON "ui_experiment_runs"("flag_key") WHERE "ended_at" IS NULL;

-- Sihirbazın bütçe adımı: tasarımdaki iki kutu (B) herkese açık başlar; deney yüzde 1–99'a çekilince başlar
INSERT INTO "feature_flags" ("key", "enabled", "percent", "platforms", "updated_at")
VALUES ('butce_b', true, 100, '{}', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
