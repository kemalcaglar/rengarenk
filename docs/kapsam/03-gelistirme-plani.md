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

## Sprint 3 · yönetim girişi, roller, dört göz (öne çekildi, 7 Kasım 2026'da yapıldı)

- [x] Yönetim konsoluna Google Workspace ile giriş ve zorunlu 2FA, 30 dk hareketsizlikte oturum kapanır (T10, Karar 40)
- [x] Çalışan rolleri ve izin matrisi; her API uç noktası için izin denetimi (Karar 40)
- [x] Dört göz onay motoru: istek, onaylayıcı, süre, sonuç (Teknik tasarım 11)
- [ ] Gerçek Google Workspace istemcisiyle deneme (hesap açılınca; şimdilik sahte sağlayıcı)

Sahip kararları (7 Kasım 2026): Sahip kendi açtığı isteği onaylayabilir, diğer herkes için isteyen ve onaylayan farklı kişidir. Onay motoru iade isteklerini taşır, yalnızca Sahip onaylar; iade kaydı ve yürütme ödeme aşamasında, iade kilidi tetikleyicilerine dokunulmadan yazılır. Eski "Katalog" rolü hazır rollerden çıkarıldı; gerekirse özel rol olarak açılır. Yönetim girişinin e-posta alanı rengarenk.com.tr.

## Sprint 4 · dağıtım hazırlığı ve özellik anahtarları (7 Kasım 2026'da başladı)

- [x] Canlı provası: dört imaj bu bilgisayarda derlendi, compose.prod.yml canlı kipinde ayağa kalktı, göçler uygulandı; üç dağıtım hatası bulunup düzeltildi (Prisma derlemesi, .dockerignore, web API adresi)
- [x] İşletme el kitabı: deploy/README.md (ilk kurulum, günlük işler, geri alma, prova)
- [x] Özellik anahtarları ve bakım modu (T13, Karar 47): kitle, yüzde, platform, deneme kullanıcıları; konsol ekranı; web ve mobilde bakım duyurusu
- [ ] Radore sunucularına ilk dağıtım (sunucular hazır olunca)
- [ ] Yedek (pgBackRest), izleme yığını (Prometheus, Grafana, Loki, GlitchTip) ve SOPS (sunucuyla birlikte)
- [ ] GCP test ortamı (sentetik veri; GCP erişimi gelince)

## Sprint 5 · katalog veri modeli ve TSB hattı (Aşama 2, 7 Kasım 2026'da başladı)

- [x] Katalog veri modeli: marka, seri, model (motor sürümü), donanım paketi, kaynak tipi; her kayıt kaynağıyla, TSB ayrılabilir; düşen kayıt silinmez (Karar 33)
- [x] Katalog hattı: okuma → normalize → önceki sürümle karşılaştırma → kalite kontrolü → Ed25519 imzalı paket → kataloğa yazma (Teknik tasarım §5)
- [x] TSB okuyucu ve ayrıştırıcı: seri, model, kasa, motor, güç, yakıt, vites, çekiş, makyaj (LCI/FL), paket; marka birleştirme; kategori ataması. Ekim 2026 dosyası: 23.054 tip, 4,2 sn
- [x] TSB iki yoldan: konsoldan yükleme ve otomatik çekme (sahip kararı); 48 saat güncellenmezse uyarı olayı
- [x] Katalog okuma uçları ve konsolda "Katalog kaynakları" ekranı (izleme, geçmiş, gezgin)
- [x] Demo: BMW 3 Serisi 320i'nin kasa ve paketleri katalogdan geliyor
- [x] Eski model yılları (sahip isteği: en az 1990'lar): TSB arşivi (Nisan 2020'den beri; 2006–2011 yılları, 5.160 düşmüş tip) ve vehicle-makes-models (1985–2005, 11.052 tip, 2.259 kasa kuşağı). Katalog şimdi 1985–2026'yı kapsıyor
- [x] Kaynak açma/kapama: kapatılan kaynağın kayıtları silinmez, katalogda görünmez (vehicle-makes-models için avukat görüşüne hazırlık)
- [x] Türkiye'ye özgü eski modeller (sahip kararı: kaynaklı liste): Tofaş Şahin, Doğan, Kartal, Serçe, Murat 124 ve 131; Renault 12 ve Toros; Anadol A1, A2, STC-16, SV-1600, Böcek, A8-16, Kamyonet. Wikidata'da yılları yoktu; değerler Türkçe Vikipedi maddelerinden, her kayıt kaynağıyla. Katalog 1967–2026
- [x] Kasa kuşağı ve makyaj yılları → Sprint 6
- [x] Ad eşleme → Sprint 6
- [ ] Açık kaynaklar: EEA teknik değerleri, VehiclesDB (motosiklet, kamyon, otobüs), Commons fotoğrafları (Sprint 6)
- [x] 14 kategori şeması ve kategori yönetimi (Karar 45) → Sprint 7

## Sprint 6 · kasa kuşağı, nesil kodu, ad eşleme (8 Kasım 2026'da başladı)

- [x] TSB seri yazımları tek biçim: marka tekrarı (LEXUS ES), Jeep (TSB'de Chrysler altında), Range Rover (TSB seri adı yazmıyor), MINI ve DS, Transit'in 20 ayrı yazımı, Mercedes-AMG ve McLaren, iki kelimelik seriler (Grande Punto, Grand Vitara …). Seri sayısı 1.720'den 1.635'e indi. Ayrıştırıcı sürümü: kurallar değişince aynı dosya yeniden işlenir
- [x] vehicle-makes-models: marka önekleri ("SKODA Octavia", "CITROEN C4") ve kasa ekleri ("Focus CC") ayıklanır; kasa kuşakları bütün yıllar için (tipler yine yalnızca 1985–2005). 6.762 kasa kuşağı
- [x] Wikidata nesil kodları (E46, W205, Mk7, B8) ve Commons kategorisi; yıl Wikidata'da yoksa İngilizce Vikipedi bilgi kutusundan (madde ve sürüm numarasıyla). Haftada bir, konsoldan "Şimdi kontrol et"
- [x] Kod ↔ kasa kuşağı eşleşmesi ve makyaj sırası (0 makyajsız, 1. makyaj …). Kodu eksik nesil önceki kodun makyajı sayılmaz (kuşak çakışması ve bitiş yılı denetimi)
- [x] Seri ayrıntısında yıl başına kasa kuşağı, kod ve makyaj; kodsuz yıllarda TSB işareti (LCI, FL)
- [x] Ad eşleme (catalog_aliases): kural önerir (ek, bitişik yazım, noktalama farkı, yazım hatası, elektrikli sürüm), katalog sorumlusu onaylar; onayda tipler hedef seriye taşınır, sonraki dosyalarda da uygulanır; kayıt silinmez. Konsolda Katalog › Ad eşleme. İlk çalıştırmada 177 öneri
- Kapsam ölçümü (Ekim 2026 TSB otomobil serileri): 966 serinin 571'inde kasa kuşağı (tiplerin %83'ü), 33'ünde nesil kodu (tiplerin %22'si). Wikidata'da nesil kodu ve yılı yaygın Avrupa modellerinde iyi, diğerlerinde eksik
- [x] VehiclesDB (CC BY 4.0): 7.432 motosiklet ve moped, 1.356 kamyon ve otobüs, 739 van modeli (yılsız). Seri katmanı olmayan türlerde aynı model tek kayıt (444 motosiklet modeli TSB ile birleşti)
- [x] Veri kaynakları sayfası (web /veri-kaynaklari, mobil ekran, alt bilgide "Vehicle data by VehiclesDB"): her kaynağın lisansı ve zorunlu atıf metni
- [x] Nesil fotoğrafları (Karar 34): nesil kodunun Commons kategorisinden aday (yalnızca kamu malı, CC0, CC BY, CC BY-SA; en az 1200 piksel), sıralama, konsolda seçim; seçilen fotoğraf SeaweedFS'e kopyalanır ve atfıyla sunulur. Veritabanı NC/ND lisansı, depoya alınmamış seçimi ve nesil başına ikinci fotoğrafı reddeder. İlk çalıştırmada 79 nesil için aday
- [x] İçe aktarma tek veritabanı işleminde (katalog, kayıt, işlem kaydı, olay) ve kaynak başına kilitli
- [ ] EEA teknik değerleri: sahip EEA'dan erişim istiyor (8 Kasım 2026 kararı). 2020 sonrası veri yalnızca Discodata'dan dağıtılıyor ve ağ geçidi sütun seçen, toplulaştıran ya da birden çok koşullu sorguları reddediyor; ayrı toplu dosya yok (ZIP yalnızca 2010–2019). Erişim biçimi netleşince hat yazılacak
- [ ] Makyaj başına fotoğraf (şimdilik nesil başına); plaka bulanıklaştırma (şimdilik plakası okunan fotoğraf seçilmiyor)

## Sprint 11 · eşleştirme motoru ve skor (Aşama 5 ilk bölüm, 8 Kasım 2026)

- [x] Skor (Teknik tasarım §6): `evaluateMatch` ortak pakette; motor, galeri ekranları ve konsoldaki deneme alanı aynı
  işlevi kullanır. Skor talebin yayına girdiği şema sürümünün ağırlıklarıyla hesaplanır (yeni ağırlıklar yalnızca yeni
  ve güncellenen taleplere); her alternatif ayrı skorlanır, en iyisi alınır; araçta karşılığı olmayan alan hesaba katılmaz
- [x] Sert koşullar: kategori, alıcının ili, bütçe üst sınırı +%5, alıcının seçtiği marka, "Kimden" yalnızca sahibinden
  ise galeri yok, alıcının kabul etmediği işlemler (şasi, podye, airbag, ağır hasar), kategoride sert koşul olan alanlar;
  galeri kendi çalışanının talebiyle eşleşmez
- [x] İki yön OpenSearch'te (T04): yayındaki araçlar indekste, yayındaki talepler kayıtlı sorgu (percolator); talep ve araç
  olaylarında işçi yeniden skorlar, her gece ikisi de yeniden kurulur. `matches` tablosu skoru, ölçütleri ve şema
  sürümünü saklar; skoru 60'ın altındaki eşleşme saklanmaz, kapanan eşleşme silinmez
- [x] Bildirim olayı: eşiği (kategori kuralı, başlangıç %80) geçen yeni eşleşme için `eslesme.bulundu`; galeri başına
  günde 20 anlık, fazlası günlük özet (iletim Aşama 7). Otomatik eşleşme Profesyonel, Kurumsal ve denemede (Karar 12.2)
- [x] Web galeri paneli › Eşleşmeler (GaleriPanel.dc.html): araç → talep kartı, uyum özeti, "yeni" sayısı menüde ve
  Özet'te; portföy listesinde "Eşleşme" sütunu; ana sayfada "Portföyünüze uyan talepler" (Anasayfa.dc.html, Karar 22)
- [x] Mobil galeri paneli: Eşleşmeler sekmesi (araç süzgeci, %uyum, zaman), Panel'de "Yeni eşleşmeler" (GaleriMobil.dc.html)
- [x] Araç sayfasında "… talebine uyuyor. N kriterin M'si tutuyor" bandı girişli alıcının yayındaki talepleriyle (PortfoyArac)
- [x] Konsol › Eşleştirme ayarı › Deneme alanı: gerçek talep, taslak ve yayındaki ayarla skor, sıra değişimi, bildirim
  alacak galeri sayısı (YonetimIcerik.dc.html)
- [ ] "Araç kartıyla mesaj at" / "İlk mesaj at": ilk mesaj ve haklarla (Aşama 5 ikinci bölüm); şimdilik pasif
- [ ] Komşu il (0,5): sert koşul il olduğu için şimdilik uygulanmıyor; alıcıya mesafe seçimi gelince açılır. Wikidata'nın
  il komşuluk verisi eksik (İstanbul–Kırklareli yok), kaynak ayrıca seçilmeli
- [ ] Galeri takibi (Karar 28) eşleşmeyle birlikte günlük özet; galeri ana sayfası düzeni (Karar 46) konsolla
- Kararlar: alıcının seçtiği marka sert koşul sayıldı (başka markadan araç galeriye eşleşme diye düşmesin); sihirbazda
  "kesin" seçimi olmadığından vites ve yakıt yalnızca skora girer; katalogda paket sırası olmadığından farklı paket 0,4
- Tasarıma ek: konsol deneme alanında talep numarasıyla talep seçme; web eşleşme kartında araç adı araç sayfasına gider

## Sprint 10 · galeri portföyü (Aşama 4 ikinci bölüm, 8 Kasım 2026)

- [x] Veri modeli: portfolio_vehicles (portföy no 77100001'den, silinmez), portfolio_photos, eids_checks, api_keys;
  aynı plaka aynı anda tek açık ilanda (veritabanı kısıtı); yakıt, vites, renk ve hasar anahtarları talep şemasıyla aynı
- [x] Elle ekleme web (GaleriPanel.dc.html › Araç ekle) ve mobil (GaleriMobil.dc.html): katalogdan seçim, yasal
  bilgiler, parça parça boya beyanı, en az 6 fotoğraf (kapak seçimi), ekspertiz raporu; taslak ve düzenleme
- [x] Kurallar (Karar 17): 6 ay / 6.000 km (ilk tescil; 1 Ocak 2027'ye kadar) ve üretici fiyatı (beyan ya da yazılan
  üretici fiyatı) engel; ekspertiz (m.16, son 10 gün) uyarı; satış temsilcisi yalnızca kendine atanan aracı düzenler
- [x] EİDS: "Kaydet ve EİDS'e gönder" → işçi sorar → onayda yayın, retle geri döner; plaka değişince yeniden doğrulama;
  deniz, hava ve kiralıkta EİDS yok; satılan araç alıcılardan hemen kalkar (m.21)
- [ ] Gerçek EİDS bağlantısı (Ticaret Bakanlığı): erişim gelene kadar canlıda `EIDS_PROVIDER=none` ve araçlar alıcılara
  görünmez; `fake` canlıda açılamaz
- [x] Toplu yükleme (Profesyonel, Kurumsal, deneme): Excel şablonu, Excel/CSV (noktalı virgül dahil) önizleme, katalog
  adlarıyla eşleşme, satır hataları ve hata raporu, içe aktarma, stok no ile güncelleme, paket sınırı
- [x] API (Kurumsal): anahtar (yalnızca özeti saklanır, bir kez gösterilir), `/entegrasyon/v1/araclar` ile stok no
  üzerinden ekle, güncelle, satıldı, pasif
- [x] Herkese açık araç sayfası web (PortfoyArac.dc.html) ve mobil (GaleriProfilMobil.dc.html): fotoğraflar, bilgiler,
  boya şeması ve hasar, ekspertiz, doğrulamalar; plakanın yalnızca il kodu; telefon ve WhatsApp girişli kullanıcıya;
  galeri profilinde yayındaki araçlar
- [ ] Araç kartında "Talebine uyuyor", eşleşme sayısı ve mesaj (Aşama 5); araç favorisi; şikayet (Aşama 8); fotoğraf
  kopya tespiti (özet saklanıyor); galeri fotoğrafının katalogda temsilî görsel olması (izin kaydediliyor)
- Tasarımdan farklar: araç formunda ilk tescil, vites, üretici fiyatı beyanı ve stok no; web formunda mobildeki
  "fotoğraflarım katalogda kullanılabilir" izni; motor ve şanzıman bilgisi katalogdan sonra gösterilecek; toplu
  yüklemede satır düzeltmesi dosyada yapılıp yeniden yüklenir; API anahtarı bölümü toplu yükleme ekranında

## Sprint 9 · kurumsal başvuru, galeri hesabı ve ekip (Aşama 4 ilk bölüm, 8 Kasım 2026)

- [x] Başvuru veri modeli: gallery_applications, gallery_documents (silinmez), galleries, account_invites; kullanıcı
  başına tek açık başvuru (veritabanı kısıtı)
- [x] Başvuru sihirbazı web (Basvuru.dc.html) ve mobil (BasvuruMobil.dc.html): dört işletme türü, türüne göre belgeler,
  belgeler özel depoda (Türkiye), türü dosyanın baytlarından denetlenir; "Bakanlık sisteminden doğrula"; galeri
  hizmet sözleşmesi onayı ve isteğe bağlı ticari ileti rıza kaydına sürümüyle girer
- [x] Beş kontrol (yetki belgesi, vergi, MERSİS, adres, telefon) işçide; hepsi geçerse ajan onaylar ve sahibe olay
  gider, biri bile geçmezse insan incelemesi (Karar 03, 41). Eksik belgeyle gönderilen başvuru belge bekler
- [ ] Gerçek kurum bağlantıları: Ticaret Bakanlığı yetki belgesi (m.22/a), GİB vergi, MERSİS. Erişim gelene kadar
  canlıda `GALLERY_VERIFY_PROVIDER=none` (kontroller "yapılamadı", her başvuru insana düşer); `fake` canlıda açılamaz
- [x] Konsol › Galeri başvuruları (YonetimPazar.dc.html): kontrol çipleri, ajan notu, onayla, reddet, belge iste,
  ajanın onayladıkları ve onayı geri alma (hesap askıya alınır); belge görüntüleme işlem kaydına girer
- [x] Onayda galeri hesabı, sahip üyeliği, profil, 30 gün deneme (Profesyonel özellikleri, sınırlı haklar) ve deneme
  talep hakkı; bitişe 7/3/1 gün kala ve bitince olay (Karar 12.5)
- [x] Ekip (Karar 20): davet (7 gün), kabul, rol değişimi yalnızca sahipte, yönetici yalnızca satış temsilcisi ekler,
  paket kullanıcı sınırı; web galeri panelinde Ekip, mobilde bekleyen davetler
- [x] Galeri paneli web (GaleriPanel.dc.html: Özet, Ekip, Paket ve faturalar) ve mobil (GaleriMobil.dc.html: Panel);
  herkese açık galeri profili web ve mobil (işletme adı ve yetki belgesi no, m.21)
- [ ] Galeri takibi (Karar 28), rozetler (Karar 55), çalışan başına günlük mesaj sınırı (Aşama 5)
- Tasarımdan farklar: web sihirbazında adres il, ilçe ve açık adres olarak üç alan; mobildeki sözleşme onayı web'e de
  eklendi; mobil özetteki "Paketler aylık 1.490 TL’den başlar" cümlesi Karar 38 gereği yazılmadı; mobil panelde ekip
  yalnızca özet (yönetim web panelde); konsolda "Ayrıntılar ve belgeler" ve ret/belge isteğinde gerekçe kutusu

## Sprint 8 · talep sihirbazı, yaşam döngüsü, liste ve arama (Aşama 3, 8 Kasım 2026'da başladı)

- [x] Talep veri modeli: demands (sık filtrelenen alanlar ayrı sütun, gerisi JSONB) ve yalnızca ekleme yapılan
  demand_events; talep silinmez, kapatılır; talep yayına girdiği kategori şeması sürümünü taşır (Karar 45)
- [x] Yayın: kategori şemasıyla doğrulama, katalog seçiminin katalogda denetimi; ilk talep telefon numarası
  başına ücretsiz (hak defterinde numara özetiyle, yeni hesap hakkı yenilemez; Karar 12), sonrakiler hak ister
- [x] Yaşam döngüsü (Kullanıcı akışları, 5 durum): düzenle (yayında kalır), pasife al, yeniden aç, uzat (ilk uzatma
  ücretsiz, sonrası hak), kapat, aracı buldum (nereden bulundu satıcıya gösterilmez; Karar 31)
- [x] Süre: kategori kuralındaki yayın süresi (Hava 90 gün, Kiralık alış tarihine kadar); işçi süresi dolanı pasife
  alır, bitişe 7/3/1 gün kala hatırlatma olayı yazar (bildirim katmanı Aşama 7'de iletecek)
- [x] Türkiye'nin 81 ili ve 973 ilçesi ortak pakette (Vikipedi ve İçişleri envanteri; plakalar Wikidata'dan, iki
  hata düzeltildi); konum bu listeyle doğrulanır
- [x] Arama: OpenSearch, Türkçe çözümleyici; indeks talep olaylarıyla işçide güncellenir ve her gece eşitlenir.
  Filtreler: kategori, marka, seri, makyaj, paket, yıl ve bütçe aralığı örtüşmesi, il/ilçe, telefon, talep no; sıralama
- [x] Web: talep sihirbazı (Sihirbaz.dc.html), Taleplerim, talep listesi (Liste.dc.html), talep sayfası (Main.dc.html;
  sunucuda çizilir, temsilî fotoğraf Commons'tan atfıyla), girişli üst bilgi (avatar ve ad)
- [x] Mobil: sihirbaz (SihirbazMobilAkis, SihirbazMobil), Taleplerim, liste (ListeMobil), talep sayfası (Mobil.dc.html)
- [x] Favoriler (Karar 06.4) ve kayıtlı arama (Karar 30): talep sayfasında kalp, listede "Aramayı kaydet", web
  /favoriler (Favoriler.dc.html) ve mobil "Favoriler ve aramalar" (HesapMobil); en fazla 10 arama, her biri için
  anlık / günlük özet / kapalı; "N yeni talep" son bakıştan sonra yayınlananları sayar. Kendi talebi favoriye eklenmez
- [ ] Favori ve kayıtlı arama bildirimlerinin iletimi: olaylar yazılıyor (talep güncellendi, pasife alındı, kapandı,
  yeni talep), uygulama/e-posta/SMS iletimi bildirim katmanıyla (Aşama 7)
- [x] Ana sayfada vitrin, son talepler ve girişli kullanıcıya "Kayıtlı aramalarınız" (Karar 22, 46; Anasayfa,
  AnasayfaMobil): vitrin her açılışta karışır, fotoğraflı talepler önce; ücretli vitrin ödeme modülüyle (Aşama 6)
  önce gelecek, boş yerleri yayındaki talepler doldurur (editör seçimi konsolla, Karar 46). Liste ve vitrin kartlarında
  temsilî nesil fotoğrafı arama indeksinden gelir
- [ ] Galeri ana sayfası ("Portföyünüze uyan talepler"): portföy ve eşleştirmeyle (Aşama 4–5)
- [x] Mobilde uygulama içi fiyatlar (Karar 38: ,99 ile biten mobil fiyat; web fiyatından söz edilmez)
- [ ] Öne çıkarma ve ek talep/uzatma satın alma: ödeme modülüyle (Aşama 6); şimdilik seçenekler görünür ama pasif
- [ ] Talep sayfasında "Mesaj at" (Aşama 5) ve "Şikayet et" (Aşama 8): şimdilik pasif
- [ ] Talep kartlarında görüntülenme, favori, mesaj ve uyan portföy sayıları (ilgili modüllerle)
- Tasarımdan farklar: mobil tasarımda 2. adımda alternatif başka araç olarak ekleniyor; Karar 05 ve web tasarımına
  göre alternatifler aynı aracın farklı kriterleri olarak yapıldı. Mobil kategori kartlarına tasarımda olmayan
  Hasarlı, Klasik ve Hava eklendi (Karar 19). Kiralamada araç türü kartı kiralık kategorisine gider, uygun olanlarda
  segmenti önceden seçer. Talep sayfasındaki ilk mesaj hakkı sayacı mesajlaşma modülüyle gelecek
- Tasarımda olmayıp eklenenler: sihirbazda "Adım talep sayfasında kısaltılsın" (Karar 29), yayındaki talebin
  sihirbazla düzenlenmesi, Taleplerim'de "Taslağı sil", listede sonuç yokken bilgi kutusu; Favoriler'de kayıtlı
  aramanın adını değiştirme (tasarımda "Düzenle" bağlantısı), mobilde kayıtlı arama kartına dokununca açılan
  bildirim ve silme bölümü; mobil Hesabım özetinde aktif talep ve favori sayısı

## Sprint 7 · 14 kategori şeması ve kategori yönetimi (8 Kasım 2026)

- [x] Kategori ağacı: 14 vasıta kategorisi (Karar 19) ve Ticari Araçlar'ın alt kategorileri (Kamyon & Çekici, Kamyonet,
  Otobüs, Minibüs & Midibüs, Dorse & Römork, Karoser & Üst Yapı, Oto Kurtarıcı & Taşıyıcı, Ticari Hat & Plaka).
  Ticari Hat & Plaka kapalı (Karar 19). Kategori silinmez, kapatılır; sıra ve nokta rengi konsoldan
- [x] Kategori şeması: taban şema (konum, bütçe, açıklama; kilitli) ve her kategorinin alanları
  `docs/kapsam/04-kategori-semalari.md`, sihirbaz tasarımı ve konsol tasarımındaki örneklerden. Alan tipleri: seçim,
  çoklu seçim, aralık, sayı, evet/hayır, metin; sistem tipleri: katalog seçimi, konum, boya ve değişen şeması (13 parça),
  tarih aralığı. Koşullu alanlar (ör. pickup kabini yalnızca pickup seçilince, çekme karavanda km yok)
- [x] Talep doğrulayıcı ve JSON Schema ortak pakette: ana araç ve talep alanları bir kez, bütçe ve kriterler her
  alternatifte (Karar 05, en çok 5 alternatif)
- [x] Sürüm ve yayın: taslak → web/mobil önizleme → dört göz onayı (CATEGORY_SCHEMA, sahip veya yönetici) → işçi yayına
  alır; eski sürüme yeni taslakla dönülür; talepler oluşturuldukları sürümle okunur (`?surum=`). Veritabanı kilidi:
  yayındaki sürüm değişmez, silinmez, onaysız yayına girmez (RR030–RR033)
- [x] Kategori kuralları sürümün içinde: yayın süresi (Hava 90 gün, Kiralık alış tarihine kadar), fiyat tarifesi, yasal
  uyarı metni, galeri için zorunlu doğrulama, katalog kaynağı, bireysel günlük ücretsiz ilk mesaj, bildirim eşiği
- [x] Eşleştirme ayarı: ağırlıklar şemanın parçası (tasarımdaki Sürümler ağırlık değişikliğini de sürüm sayıyor),
  ikişer adımla; skor işlevi ortak pakette (Teknik tasarım §6 uyum kuralları)
- [x] Konsol: Katalog › Kategoriler ve alanlar, Eşleştirme ayarı; Onay kuyruğunda "Kategori şeması" türü
- [x] Web ana sayfası ve mobil menü kategorileri `GET /categories`'ten (konsolda kapatılan kategori menüden kalkar)
- [ ] Deneme alanı: talep (Aşama 3) ve portföy (Aşama 4) gelince; skor işlevi hazır
- [ ] Arama eşlemesi: "filtrede" alanların OpenSearch'e eklenmesi talep aramasıyla (Aşama 3); `kategori.yayinlandi`
  olayı yazılıyor
- [ ] Aktif talep sayıları ağaçta: talep modülüyle (şimdilik 0)
- Tasarımdan farklar: konsol tasarımındaki ağaçta "ATV & UTV" tek satır, Karar 19 ve sihirbaz tasarımında ayrı; ayrı
  tutuldu. Ticari Hat & Plaka tasarımda en altta ana kategori gibi duruyor, 04 dokümanında Ticari'nin alt kategorisi;
  alt kategori yapıldı. Ticari'de 04 dokümanındaki Dorse & Römork, Karoser & Üst Yapı ve Oto Kurtarıcı & Taşıyıcı da
  eklendi. Tasarımdaki "Elif Kara'nın onayında" yerine onay belirli kişiye atanmadığı için "Sahip veya yönetici
  onayında" yazıyor. Önizleme 3. adımı (Kriterler) gösteriyor; ana araç 2. adımda
- Tasarımda olmayıp eklenenler: ağaçta sıra (↑ ↓) ve nokta rengi (Karar 45 "sıralama, simge ve renk"), alan adına
  tıklayınca düzenleme ve "Alanı kaldır", seçim alanında seçenekler ve sayı alanında birim kutusu, "Taslağı sil",
  Eşleştirme ayarında kategori seçimi

## Tasarım uyum geçişi (8 Kasım 2026, Sprint 7 öncesi)

Sahip isteği: yapılmış her ekran `docs/tasarim/*.dc.html`, kapsam dokümanındaki (PDF) ekran görüntüleri ve tasarım
tuvaliyle karşılaştırıldı; eksik ve farklı olan her şey düzeltildi.

- [x] Web: ana sayfa (kategori yanındaki renkli noktalar, Vasıta ve Yakında grupları, karşılama ve üç adım), giriş
  (telefon, dört rıza kutusu, kod adımında geri sayım ve "Numarayı değiştir", ad soyad adımı), üst ve alt bilgi, çerez
  bandı, yasal metin sayfaları, bulunamadı sayfası. Rıza kayıtları ve sürümlü yasal metinler (Karar 29, 46, 59)
- [x] Mobil: Plus Jakarta Sans, alt sekme çubuğu, ana sayfa, menü ve kategoriler çekmecesi, giriş, Hesabım, Taleplerim,
  Mesajlar, Bildirimler, boş durumlar
- [x] Konsol: menüde tasarımdaki 8 grup (yapılmamış ekranlar "yakında" ile pasif), Onay kuyruğu (tek liste, türe göre
  onay düğmesi, göreli zaman, karar sonrası yalnızca sonuç), Çalışanlar ("Bu hafta" sütunu, durum rozetleri, davet
  yalnızca e-posta ve rolle; ad ilk Google girişinde hesaptan gelir), İşlem kaydı (Bugün/Dün saatleri, okunur
  değişim özeti, kişi ve işlem adıyla arama), Özellik anahtarları ve bakım (kapalıyken "Kapalı", duyuru metni yalnızca
  bakım açıkken), Entegrasyonlar (tasarımdaki 15 kart; katalog, ad eşleme ve nesil fotoğrafları buraya taşındı)
- Sahip kararları (8 Kasım 2026): web'de zorunlu rıza kutuları boş başlar, mobilde edilgen cümle; katalog sayfaları
  Sistem › Entegrasyonlar kartlarında; ad eşleme onaylı kalır (Karar 33); konsol menüsünde bütün gruplar görünür,
  yapılmamışlar pasif
- Tasarımda olup ilgili modülü gelince eklenecekler: ana sayfada vitrin, son talepler ve galeri ana sayfası; girişli web
  üst bilgisi; mobil sihirbazın 2. adımdan sonrası ve "Kaydet"; arama kutularının çalışması; Hesabım sayıları;
  Çalışanlar'da Rengarenk Ajanı satırı ve ajan performansı; İşlem kaydında tarayıcı ve şehir (şimdilik IP)
- Tasarımda olmayıp bilerek eklenenler: alt bilgide "Veri kaynakları" ve VehiclesDB atfı (lisans şartı), çıkış
  bağlantısı, Onay kuyruğunda kendi isteğini "Geri çek", Çalışanlar'da rol seçimi, "Daveti yenile", "2 adımı sıfırla",
  Sistem'de çalışanların kullanıcı hesapları listesi ("Yalnızca çalışanlar" kapsamı için)
