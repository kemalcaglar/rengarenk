-- CreateTable
CREATE TABLE "matches" (
    "id" UUID NOT NULL,
    "demand_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "alternative" INTEGER NOT NULL,
    "criteria" JSONB NOT NULL,
    "schema_version" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "seen_at" TIMESTAMPTZ(3),
    "notified" TEXT,
    "notified_at" TIMESTAMPTZ(3),
    "ended_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "matches_account_id_active_score_idx" ON "matches"("account_id", "active", "score");

-- CreateIndex
CREATE INDEX "matches_vehicle_id_active_idx" ON "matches"("vehicle_id", "active");

-- CreateIndex
CREATE INDEX "matches_account_id_notified_at_idx" ON "matches"("account_id", "notified_at");

-- CreateIndex
CREATE UNIQUE INDEX "matches_demand_id_vehicle_id_key" ON "matches"("demand_id", "vehicle_id");

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "portfolio_vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Elle eklenenler
ALTER TABLE "matches" ADD CONSTRAINT "matches_score_check" CHECK ("score" BETWEEN 0 AND 100);
ALTER TABLE "matches" ADD CONSTRAINT "matches_notified_check" CHECK ("notified" IS NULL OR "notified" IN ('anlik', 'ozet'));
