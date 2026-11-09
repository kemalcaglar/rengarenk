-- CreateTable
CREATE TABLE "price_experiments" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "product_key" TEXT NOT NULL,
    "price_a_kurus" INTEGER NOT NULL,
    "price_b_kurus" INTEGER NOT NULL,
    "days" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'onay_bekliyor',
    "approval_id" UUID,
    "starts_at" TIMESTAMPTZ(3),
    "ends_at" TIMESTAMPTZ(3),
    "created_by" UUID NOT NULL,
    "stopped_by" UUID,
    "proposed_book" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_experiments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_experiment_exposures" (
    "experiment_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "arm" TEXT NOT NULL,
    "seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_experiment_exposures_pkey" PRIMARY KEY ("experiment_id","user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "price_experiments_approval_id_key" ON "price_experiments"("approval_id");

-- CreateIndex
CREATE INDEX "price_experiments_status_ends_at_idx" ON "price_experiments"("status", "ends_at");

-- AddForeignKey
ALTER TABLE "price_experiment_exposures" ADD CONSTRAINT "price_experiment_exposures_experiment_id_fkey" FOREIGN KEY ("experiment_id") REFERENCES "price_experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_experiment_exposures" ADD CONSTRAINT "price_experiment_exposures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Kısıtlar (Karar 56)
ALTER TABLE "price_experiments" ADD CONSTRAINT "price_experiments_status_check" CHECK ("status" IN ('onay_bekliyor','suruyor','durduruldu'));
ALTER TABLE "price_experiments" ADD CONSTRAINT "price_experiments_price_check" CHECK ("price_a_kurus" > 0 AND "price_b_kurus" > 0 AND "price_a_kurus" <> "price_b_kurus");
ALTER TABLE "price_experiments" ADD CONSTRAINT "price_experiments_days_check" CHECK ("days" BETWEEN 7 AND 60);
ALTER TABLE "price_experiment_exposures" ADD CONSTRAINT "price_experiment_exposures_arm_check" CHECK ("arm" IN ('A','B'));
