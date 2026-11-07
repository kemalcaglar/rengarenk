# Geliştirme planı

Sürüm 0.1 · 7 Kasım 2026. Geliştirmeyi sahip tek başına yapacak. Kapsam değişmedi: 59 kararın tamamı ilk sürümde (Karar 15). Altyapı tek geliştiriciye göre sadeleştirildi (Teknik tasarım, bölüm 1).

## Özet

|  |  |
| --- | --- |
| Başlangıç | 9 Kasım 2026 (Sprint 1) |
| Sprint | 2 hafta; toplam 31 sprint |
| Tahmini lansman | 14 Ocak 2028 (yaklaşık 14 ay) |
| Varsayım | Haftada yaklaşık 40 saat geliştirme; kod yazmada yapay zekâ desteği; her özellik aynı sprintte API, web ve mobil olarak biter |
| Pay | Her aşamaya %15 pay eklendi; dış bağımlılıklar gecikirse pay oradan kullanılır |

Tahmin belirsizdir: ilk 3 sprintin gerçek hızına bakıp planı yeniden ölçeceğiz. Hız beklenenden %30 düşükse lansman yaklaşık 4 ay kayar.

## Aşamalar

| Aşama | Sprint | Bitiş | Kapsam | Demo ölçütü |
| --- | --- | --- | --- | --- |
| 0 · Hazırlık | 1 | 20 Kas 2026 | Monorepo, yerel ortam, CI, tasarım dili (renk, yazı, bileşenler), veritabanı şemasının ilk hali | Boş web, yönetim ve mobil uygulama açılıyor; testler CI'da geçiyor |
| 1 · Temel | 2–4 | 1 Oca 2027 | Telefon ve SMS ile giriş, hesaplar, roller ve izinler, işlem kaydı, outbox ve kuyruk, yönetim girişi (Google Workspace + 2FA), izleme, Radore'ye dağıtım, test ortamı | Telefonla giriş canlı sunucuda çalışıyor |
| 2 · Katalog ve kategoriler | 5–7 | 12 Şub 2027 | Katalog veri modeli, TSB ve açık kaynak içe aktarma hattı, ad eşleme, Commons görselleri, 14 kategori şeması, katalog yönetimi | BMW 3 Serisi 320i'nin kasa, makyaj ve paketleri katalogdan geliyor |
| 3 · Talep | 8–10 | 26 Mar 2027 | Talep sihirbazı (web ve mobil), yaşam döngüsü, süre ve hatırlatmalar, liste ve arama, talep detayı, favori, kayıtlı arama, ana sayfa ve vitrin ızgarası | Talep yayınlanıp aramada bulunuyor |
| 4 · Galeri | 11–13 | 7 May 2027 | Kurumsal başvuru ve onay, yetki belgesi kontrolü, portföy (elle, Excel/CSV, API), EİDS, galeri profili, çalışanlar | Onaylı galeri portföyüne araç ekliyor |
| 5 · Eşleştirme ve mesajlaşma | 14–17 | 2 Tem 2027 | Eşleştirme motoru ve skor, ilk mesaj ve haklar defteri, sohbet (WebSocket), numara paylaşımı, mesaj güvenliği, yıldız ve rozetler | Uçtan uca: talep → eşleşme → ilk mesaj → sohbet |
| 6 · Ödemeler | 18–20 | 13 Ağu 2027 | PayTR, galeri abonelikleri, mağaza ödemeleri ve RevenueCat, e-Arşiv, iade akışı (4 kilit), ön bilgilendirme ve sözleşmeler | Test kartıyla üst sıra alınıyor, fatura kesiliyor, iade sahip onayı olmadan yapılamıyor |
| 7 · Bildirimler | 21–22 | 10 Eyl 2027 | Bildirim katmanı, FCM, kendi e-posta sunucusu ve ısınma, SMS ana ve yedek, İYS, şablonlar, otomatik akışlar | Talep süresi dolmadan 3 kanaldan hatırlatma gidiyor |
| 8 · Yönetim ve güven | 23–26 | 5 Kas 2027 | Yönetim konsolu modülleri, moderasyon, destek, Rengarenk Ajanı, KVKK araçları (veri indirme, başvuru, imha, rıza, ihlal) | Moderatör bir şikayeti uçtan uca kapatıyor |
| 9 · Büyüme | 27–28 | 3 Ara 2027 | Kampanyalar ve segmentler, açılış sayfaları, reklam ölçümü, raporlar ve kontrol paneli | Kampanya segmentli gönderiliyor, panel gerçek veriyle doluyor |
| 10 · Lansman hazırlığı | 29–31 | 14 Oca 2028 | Sızma ve yük testi, kapalı beta (10 galeri, 100 alıcı), mağaza incelemeleri, yasal metinlerin son hali, yedekten geri yükleme provası | Mağazalarda yayında, canlı trafik |

## Dış işler ve son tarihleri

Bunları sahip yürütüyor; tarihten sonra gelirse ilgili aşama bekler.

| İş | Gereken sprint | En geç |
| --- | --- | --- |
| SMS sağlayıcısı (ana) ve gönderici başlığı | 2 | 23 Kas 2026 |
| Radore sunucuları | 4 | 21 Ara 2026 |
| Google Workspace (yönetim girişi için) | 3 | 7 Ara 2026 |
| Apple geliştirici hesabı (D-U-N-S ile) ve Google Play hesabı | 8 | 1 Şub 2027 |
| EİDS entegrasyon erişimi | 12 | 29 Mar 2027 |
| Avukat görüşü ve yasal metinlerin son hali | 18 | 21 Haz 2027 |
| PayTR üye işyeri sözleşmesi | 18 | 21 Haz 2027 |
| e-Arşiv entegratörü | 19 | 5 Tem 2027 |
| İYS kaydı ve SMS yedek sağlayıcı | 21 | 2 Ağu 2027 |
| TSB yazılı izni (katalog zaten TSB ile kuruluyor) | — | Lansmandan önce |

## Çalışma düzeni

- **Her sprint çalışan bir sürümle biter.** Sprint sonunda test ortamında demo yapılır ve bu sekmedeki tablo güncellenir.
- **Dikey dilim:** bir özellik API, web, mobil ve yönetim tarafıyla birlikte biter; önce tüm API, sonra tüm ekranlar yapılmaz.
- **Tek dal ve küçük birleştirmeler:** ana dal her zaman dağıtılabilir; yarım özellikler özellik anahtarının arkasında kalır (T13).
- **Bitti tanımı:** testleri yazılmış, CI'da geçiyor, test ortamında çalışıyor, ilgili karar numarası değişiklik notunda anılıyor, kişisel veri alanları etiketlenmiş.
- **Haftalık:** pazartesi plan, cuma 30 dakika gözden geçirme; her ay yedekten geri yükleme denemesi (Karar 56).

## Riskler

| Risk | Etki | Önlem |
| --- | --- | --- |
| Tek kişiye bağımlılık (hastalık, yorgunluk) | Takvim kayar | %15 pay; her sprint sonunda çalışan sürüm; işletme el kitabı (runbook) ilk günden |
| Kapsamın büyüklüğü | Lansman 2028 ortasına kayabilir | 3. sprint sonunda hız ölçülür; gerekirse Karar 15 yeniden konuşulur |
| Dış onaylar (EİDS, PayTR, mağazalar) | İlgili aşama bekler | Başvurular erken; beklerken sıradaki aşamaya geçilir |
| Altyapı tek sunucuda | Sunucu çökerse kesinti | Günlük yedek ikinci veri merkezinde; geri yükleme provası; büyüme eşiklerinde k3s'e geçiş |
| Mağaza incelemesi reddi | Mobil lansman gecikir | Kapalı betada TestFlight ve iç test; ödeme kuralları Karar 38'e göre |

## Sprint 1 · 9–20 Kasım 2026

- [x] Monorepo: pnpm ve Turborepo; uygulamalar api, web, admin, mobile; paketler db, shared (renkler shared içinde)
- [x] Yerel ortam: Docker Compose ile PostgreSQL, Redis, OpenSearch, SeaweedFS (MinIO yerine, T08), e-posta yakalayıcı
- [x] API iskeleti: NestJS, sağlık kontrolü, yapılandırma, hata ve kayıt düzeni, OpenAPI
- [x] Veritabanı: Prisma şemasının ilk hali (hesaplar, roller, işlem kaydı, outbox, hak defteri)
- [x] Web, yönetim ve mobil: Next.js ve Expo iskeleti, Gökkuşağı renkleri ve yazı tipi, ortak API istemcisi
- [x] CI: GitHub Actions ile kurulum, tip kontrolü, lint, test; imaj derleme ve canlıya alma etiketli sürümde
- [x] Depoyu GitHub'a taşıma ve README ile çalıştırma talimatı

Sprint 1 işleri 7 Kasım 2026'da bitti; CI yeşil. Bilgisayarda Docker Desktop ile yerel kurulum ve ilk geçiş (pnpm db:migrate) sahip tarafından denenecek.

## Sprint 2 · 23 Kasım – 4 Aralık 2026 (öne çekildi, 7 Kasım 2026'da yapıldı)

- [x] SMS: ana ve yedek sağlayıcı yönlendirici (geçici hatada yedeğe geçiş, art arda 3 hatada ana sağlayıcı 5 dk devre dışı, kalıcı hatada geçiş yok)
- [x] İleti Merkezi bağdaştırıcısı (REST/JSON); geliştirmede `console`, testte `test` sağlayıcı
- [x] Hız sınırı: aynı IP'den saatte 20 kod isteği ve 60 doğrulama (Redis)
- [x] Günlük: pino JSON; telefon, kod, jeton, çerez ve yetki başlığı maskelenir (Karar 58)
- [x] İzleme: `GET /metrics` (Prometheus), 5xx hataları GlitchTip'e (Sentry uyumlu)
- [x] Hesabım: profil güncelleme, açık oturumları listeleme ve kapatma
- [x] Web oturumu: yenileme jetonu httpOnly çerezde (`rr_yenileme`), erişim jetonu yalnızca bellekte
- [ ] Yedek SMS sağlayıcısı bağdaştırıcısı (sağlayıcı seçilince; aday Netgsm)

## Sıradaki (Sprint 3–4)

- [ ] Yönetim konsoluna Google Workspace ile giriş ve zorunlu 2FA, 30 dk hareketsizlikte oturum kapanır (T10, Karar 40)
- [ ] Çalışan rolleri ve izin matrisi; her API uç noktası için izin denetimi (Karar 40)
- [ ] Dört göz onay motoru: istek, onaylayıcı, süre, sonuç (Teknik tasarım 11)
- [ ] Radore sunucularına ilk dağıtım (sunucular hazır olunca)
- [ ] GCP test ortamı (sentetik veri)

