-- Ad ve soyad ayrı (tasarım: Giris.dc.html son adım; Karar 29 "Ayşe Y." gösterimi). Kişisel veri.
ALTER TABLE "users" ADD COLUMN "first_name" TEXT, ADD COLUMN "last_name" TEXT;
