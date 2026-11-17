-- Ayrıntılı teknik özellikler (sahip isteği, 17 Kasım 2026): vehicle-makes-models motor kayıtları (0-100, azami hız,
-- tork, çekiş, kasa, ölçüler, depo, bagaj, lastik, fren) ADEME onay verisiyle aynı tabloda, kaynak "vmm".
ALTER TABLE "catalog_specs" ADD COLUMN "year_end" INTEGER;
ALTER TABLE "catalog_specs" ADD COLUMN "drive" TEXT;
ALTER TABLE "catalog_specs" ADD COLUMN "body" TEXT;
ALTER TABLE "catalog_specs" ADD COLUMN "details" JSONB NOT NULL DEFAULT '{}';

-- Tip özeti kaynak başına (gösterimde açık kaynaklar birleşir; kapatılan kaynağın değerleri düşer)
ALTER TABLE "catalog_variant_specs" DROP CONSTRAINT "catalog_variant_specs_pkey";
ALTER TABLE "catalog_variant_specs" ADD CONSTRAINT "catalog_variant_specs_pkey" PRIMARY KEY ("variant_id", "source");
