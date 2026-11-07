# Belgeler

Bu klasördeki dosyalar, Claude'da tutulan ürün kapsam dokümanının ve tasarımların 7 Kasım 2026
tarihli kopyasıdır. Amaç, IDE içinde çalışırken her şeyin depoda okunabilir olmasıdır.

- Ürün kapsam dokümanı (asıl kaynak, 7 sekme): https://claude.ai/artifact/RMkAC6ibrZAduxGnkhdLNK
- Tasarımlar (canlı tuval, 37 ekran): https://claude.ai/artifact/RyR9zdEhL6JcTHgL5tDS72
- PDF (v0.59, 71 sayfa, ekran görüntüleriyle): depo kökündeki `Rengarenk_Urun_Kapsam_Dokumani_v0.59.pdf`
  (git'e eklenmez, yalnızca bu bilgisayarda durur)

## kapsam/

| Dosya | İçerik |
| --- | --- |
| `01-urun-kapsami.md` | Ürün özeti ve 59 karar (Karar 01–59), açık konular |
| `02-teknik-tasarim.md` | Teknik kararlar T01–T14, tek geliştirici için sadeleştirme, veri modeli, eşleştirme skoru, iade güvencesi, bildirim, yapay zekâ, güvenlik |
| `03-gelistirme-plani.md` | 31 sprintlik plan, aşamalar, dış işlerin son tarihleri, riskler, sprint listeleri |
| `04-kategori-semalari.md` | 14 vasıta kategorisinin alanları, katalog kaynakları, eşleşme kuralları |
| `05-kullanici-akislari.md` | Ana akışlar ve ekran listesi |
| `06-yasal-metin-taslaklari.md` | Avukat incelemesi için yasal metin taslakları |

Kopyalanmayan sekme: **Yazışma taslakları** (TSB, sağlayıcılar vb. ile yazışmalar). Yalnızca
Claude dokümanında durur.

**Çelişki olursa:** altyapıyla ilgili konularda `02-teknik-tasarim.md` (sürüm 0.2) geçerlidir.
`01-urun-kapsami.md` içindeki Karar 16 ve 37, sadeleştirmeden önce yazıldı ve hâlâ RabbitMQ, k3s
kümesi ve MinIO'dan söz eder. Bunların yerine şimdilik pg-boss (PostgreSQL kuyruğu), tek sunucuda
Docker Compose ve SeaweedFS kullanılıyor; k3s'e büyüme eşikleri aşılınca geçilecek.

**Güncelleme:** bir ürün kararı değişirse önce sahibine sorulur, sonra hem bu kopya hem Claude
dokümanı güncellenir. İkisi ayrışırsa Claude dokümanı esas alınır.

## tasarim/

`*.dc.html` dosyaları Claude tasarım tuvalinin kaynaklarıdır; ekranları kodlarken renk, boşluk,
yazı boyutu ve yerleşim için başvuru olarak kullanılır. Biçim:

- Her dosya bir ekran (tuvalde bir pano). Pano adları ve boyutları `canvas.json` içinde.
- Stiller satır içi yazılıdır (`style="..."`); yazı tipi Plus Jakarta Sans.
- `<x-dc>`, `<helmet>`, `sc-for`, `sc-if` tasarım aracının şablon etiketleridir. Dosyalar
  tarayıcıda tek başına doğru görünmez; görmek için yukarıdaki tasarım bağlantısı veya PDF kullanılır.
- Renkler kodda `packages/shared/src/tokens.ts` içinde tanımlıdır (ana renk #5B8CFF; pembe
  #FF6FB5, sarı #FFC84A, yeşil #3DD68C).

| Dosya | Ekran |
| --- | --- |
| Main, Mobil | Talep detayı · web, mobil (onaylanan referans tasarım) |
| Anasayfa, AnasayfaMobil | Ana sayfa (vitrin: web 6 sütun, mobil 3 sütun; mobilde kategori menüsü) |
| Sihirbaz, SihirbazMobil, SihirbazMobilAkis | Talep oluşturma sihirbazı |
| Liste, ListeMobil | Talep listesi |
| Mesajlar, MesajMobil, MesajlarMobil | Mesajlar, sohbet, yıldız verme |
| Taleplerim, TaleplerimMobil | Taleplerim |
| Haklarim, HaklarimMobil | Haklarım ve ödeme |
| Favoriler | Favoriler ve kayıtlı aramalar |
| Giris, GirisMobil | Giriş ve üyelik |
| Basvuru, BasvuruMobil | Kurumsal hesap başvurusu |
| GaleriPanel, GaleriMobil | Galeri paneli |
| GaleriProfil, GaleriProfilMobil, PortfoyArac | Galeri profili ve portföy aracı |
| Ayarlar, HesapMobil | Ayarlar, hesabım, KVKK |
| Yardim | Yardım merkezi |
| Yonetim, YonetimEkip, YonetimRapor, YonetimIcerik, YonetimKampanya, YonetimPazar, YonetimSistem | Yönetim konsolu |
| Paletler | Renk paleti seçenekleri |
