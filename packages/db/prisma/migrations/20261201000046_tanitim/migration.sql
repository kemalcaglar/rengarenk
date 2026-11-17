-- Sihirbaz tanıtımı (sahip isteği, 17 Kasım 2026): her adımın tanıtımı her üyeye bir kez gösterilir.
ALTER TABLE "users" ADD COLUMN "tanitim" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
