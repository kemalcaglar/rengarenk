-- Alıcının yazdığı talep başlığı (Sihirbaz.dc.html, 5. adım "Talep başlığı"). Boşsa katalogdan üretilen başlık gösterilir.
ALTER TABLE "demands" ADD COLUMN "headline" TEXT;
ALTER TABLE "demands" ADD CONSTRAINT "demands_headline_check" CHECK ("headline" IS NULL OR char_length("headline") BETWEEN 5 AND 120);
