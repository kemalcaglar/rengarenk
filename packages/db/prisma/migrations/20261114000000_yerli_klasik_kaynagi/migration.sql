-- Türkiye'ye özgü eski modeller için kaynaklı başlangıç listesi (sahip kararı, 7 Kasım 2026).
-- Değerler Türkçe Vikipedi maddelerinden derlendi; her kayıt madde ve sürüm numarasını taşır (packages/catalog/src/yerli).
-- Liste depoda olduğu için ağ gerekmez; otomatik açık başlar, yeni liste sürümü işçi tarafından işlenir.
INSERT INTO "catalog_sources" ("key", "name", "license", "attribution", "url", "auto_fetch", "active", "updated_at")
VALUES ('yerli', 'Yerli klasikler (kaynaklı liste)', 'Vikipedi maddelerinden derlendi (CC BY-SA); kaynak her kayıtta',
        'Türkçe Vikipedi', 'https://tr.wikipedia.org/wiki/Tofa%C5%9F_Ku%C5%9F_Serisi', true, true, CURRENT_TIMESTAMP);
