-- VehiclesDB (CC BY 4.0) ve kaynak atıf notları (Teknik tasarım §5: atıflar sitenin "Veri kaynakları" sayfasında).

-- Kaynağın zorunlu atıf metni (ör. VehiclesDB ATTRIBUTION.md: üst kaynak tescil kayıtlarının lisans beyanları).
-- Her sürümle birlikte güncellenir; site ve uygulama bu metni gösterir.
ALTER TABLE "catalog_sources" ADD COLUMN "notice" TEXT;

INSERT INTO "catalog_sources" ("key", "name", "license", "attribution", "url", "auto_fetch", "active", "updated_at")
VALUES ('vehiclesdb', 'VehiclesDB (motosiklet, kamyon, otobüs, van)', 'CC BY 4.0',
        'Vehicle data by VehiclesDB', 'https://vehiclesdb.com', true, true, CURRENT_TIMESTAMP);
