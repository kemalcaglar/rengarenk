-- Favori araçlar (PortfoyArac.dc.html › Favorilere ekle)
-- CreateTable
CREATE TABLE "vehicle_favorites" (
    "user_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_favorites_pkey" PRIMARY KEY ("user_id","vehicle_id")
);

-- CreateIndex
CREATE INDEX "vehicle_favorites_vehicle_id_idx" ON "vehicle_favorites"("vehicle_id");

-- AddForeignKey
ALTER TABLE "vehicle_favorites" ADD CONSTRAINT "vehicle_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_favorites" ADD CONSTRAINT "vehicle_favorites_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "portfolio_vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

