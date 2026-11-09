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

## Sprint 27 · Aşama 8 kalanları (9 Kasım 2026)

- [x] Galerinin 1 yıldıza itirazı (Karar 55): galeri panelinde (web Özet › Yıldızların ve rozetlerin, mobil Rozetlerin)
  son 30 günün 1 yıldızları yalnızca tarihiyle; sahip ya da yönetici her yıldıza 30 gün içinde bir kez itiraz eder.
  Konsol › Moderasyon › İtirazlar'da "Galeri · 1 yıldıza itiraz" (YonetimPazar.dc.html): sohbet kanıtı (mesaj sayıları,
  yıldızın son mesajdan ne kadar sonra verildiği, alıcı hesabının yaşı), maskeli son mesajlar, 7 günlük inceleme
  süresi. Kabulde yıldız `itiraz` işaretiyle hesaptan çıkar, göstergeler yenilenir; sonuç itirazı yazana bildirilir

## Sprint 26 · kullanıcı tarafı yapay zekâ (Aşama 8 dokuzuncu bölüm, 9 Kasım 2026)

- [x] Talep asistanı (`talep_asistani` anahtarı, Karar 42): serbest metinden yıl, bütçe, km, yakıt, vites, renk, hasar,
  il ve ilçe, takas, kimden kurallarla (`parseDemandText`), marka/seri/model katalogdan; yapay zekâ önerisi şemayla
  (`fieldValueSchema`) doğrulanır, araç her zaman katalogdan. Taslağı doldurur, yayınlamaz. Web ve mobil sihirbazın
  Ana araç adımında "✦ Aradığın aracı kendi cümlelerinle yaz", doldurulan ve eksik alanların listesi
- [x] İlk mesaj taslağı: pencere açılınca taslak; galeride eşleştirmenin en uygun portföy aracı önerilir; "✦ Taslağı
  yeniden yaz" (GaleriMobil.dc.html); telefon, IBAN, bağlantı ya da kapora içeren yapay zekâ metni kullanılmaz; gönderen
  her zaman satıcı (web, mobil)
- [x] Mesaj güvenliği (`mesaj_guvenligi` anahtarı): para, teslim ya da iletişimle ilgili satıcı mesajı (işçide) kurallar
  ve yapay zekâyla sınıflandırılır; şüpheliyse `supheli` işareti, alıcıya uyarı bandı, `mesaj.uyari`; gizleme ve askı yok
- [x] Toplu yükleme yardımı (`toplu_portfoy` anahtarı): karışık araç adları kataloğa bağlanır ("VW passat", "3.20i",
  model sütununda "BMW 320i"), açıklaması boş araca açıklama taslağı (yapay zekâ tek istekte, plaka ve şasi gönderilmez);
  galeri panelinde önizlemede "✦ Asistan … bağladı" özeti
- [x] Destek sohbeti: destek formunda "Gönder"den önce hemen yanıt (sık sorulanlar, hak bakiyesi, hesap durumu);
  "Sorunum çözüldü" ya da "Yine de ekibe gönder"; iade ve hesap kapatma insana (web, mobil)
- [x] İstemciler `x-rr-platform` başlığı gönderir (özellik anahtarları platforma göre)
- [ ] İlk mesaj taslağı ve destek sohbeti yapay zekâ bütçesinde "Talep asistanı" ve "Destek" görevlerine yazılır
  (tasarımdaki görev listesi değişmedi); Vertex AI hesabı açılınca gerçek modelle denenecek
- [ ] Mobilde toplu yükleme ekranı yok (Excel yüklemesi web galeri panelinde)

## Sprint 25 · ajanın kalan işleri (Aşama 8 sekizinci bölüm, 9 Kasım 2026)

- [x] Talep metni (Karar 41, 13.2): başlık ve açıklamadaki telefon, IBAN, e-posta ve bağlantı herkese açık her yerde
  (talep sayfası, liste ve arama, favoriler, eşleşmeler, sohbet başlığı) gizlenir; sahibi kendi taleplerinde asıl metni
  görür. Ajan yayında ve düzenlemede tarar, yasaklı kelime listesini de kullanır; bulursa "düzeltme istendi"
  (`correction_flags`), sahibine bildirim (`talep.duzeltme_istendi`, uygulama içi ve e-posta), web ve mobil Taleplerim'de
  not. Düzeltilince işaret kalkar; moderatör geri alabilir
- [x] Destek (Karar 41, 54): ajan yeni talebi sınıflandırır. Hak bakiyesi (hak defterinden) ve hesap durumu (etkin askı
  ve itiraz yolu) kişinin kaydından, diğerleri sık sorulanlardan. Güven %90 ve üstünde yanıtlayıp çözer (günde en çok
  500), altında taslağı konsolda "Ajanın taslağı · Güven %X · eşik %90 altında" olarak bırakır. İade, hesap kapatma,
  dolandırıcılık her zaman insana; ajan iade önerisi açmaz. Satın aldığını söyleyip ek hakkı görünmeyen kişide taslak
  insana. Kullanıcıya "Rengarenk Destek · otomatik yanıt" görünür; geri alınca talep yeniden insana açılır. Kuyrukta
  "Ajanın kendi çözdüğü" ve geri dönen oranı
- [x] Spam (Karar 41): son bir saatte aynı ilk mesajı en az 10 talebe gönderen ya da 24 saatte en az 5 farklı kişiden
  şikâyet alan hesap 24 saat kısıtlanır (günlük askı sınırı, durdurma düğmesi), şikâyet insan incelemesine düşer,
  kişiye nedenli bildirim; geri alınabilir
- [x] SMS ana sağlayıcı art arda hata verip yedeğe geçince ajanın akışına yazılır
- [x] Ana ölçü uyarısı (Karar 44): 48 saatte ilk mesaj alan talep oranı bir günde 5 puandan fazla düşerse Sahip ve
  yöneticiye
- [x] Kritik uyarılar SMS ile gitmez (sahip kararı, 9 Kasım 2026)
- [ ] Yapay zekâ ile sınıflandırma ve taslak: Vertex AI hesabı açılınca (şimdilik kurallar; ağ geçidi maskeli istekle hazır)

## Sprint 24 · çalışan uyarıları (Aşama 8 yedinci bölüm, 9 Kasım 2026)

- [x] Uyarı kuralları ortak pakette (`packages/shared/src/staff-alerts.ts`, 19 kural): Sahip her uyarıyı alır; ayrıca
  kuralın yetkisine (ör. KVKK yanıtlama, iade, katalog ayarı) ya da rolüne sahip etkin çalışanlar. Kritik uyarılar (yeni
  cihaz, kurtarma kodu, gerçek ihlal, sonucu belirsiz iade, ödeme hatası oranı, yapay zekâ bütçesi) kapatılamaz;
  diğerlerini yalnızca Sahip kapatır (işlem kaydı)
- [x] Olaydan uyarı (işçi): yeni cihaz ve kurtarma kodu (Karar 40), gerçek ihlal (tatbikat hariç) ve imha (Karar 59),
  Sahibin onayını bekleyen iade, iade sonucu ve belirsiz iade (Teknik tasarım §7), ödeme uyuşmazlığı, mağaza iadesi ve
  tanınmayan satış, otomatik çekimin bildirimi gelmedi, ajanın günlük özeti, ajanın galeri onayı (Karar 03), ajanın
  durması, bütçe %80 ve sınır (Karar 57), ticari e-postanın durması, katalog kaynağı gecikti ya da reddedildi
- [x] Saatlik denetimler: KVKK başvurusunda 7 gün kala (Karar 58), imhaya 14 gün kala onaylanmamış liste, VERBİS
  eşiğinin %80'i ve aşılması, bir saatte ödeme hatası oranı %5'i aşarsa, ajanın geri alınan işlem oranı haftalık %5'i
  aşarsa (YonetimRapor › Kritik uyarılar)
- [x] Teslim: alıcı başına bir satır (`staff_alerts`, aynı uyarı bir kez), konsolda üst çubukta "Uyarı N" ve Uyarılar
  listesi, şirket e-postasına gönderim (işçi, 5 deneme). Metin kişisel veri taşımaz (e-posta Google Workspace'e gider,
  Karar 37); günlük özete dikkat isteyenler ve ajanın yaptıkları eklenir
- [x] Konsol › Büyüme › Zamanlanmış raporlar ve uyarılar: ajanın günlük özeti (aç/kapat), kritik ve diğer uyarılar,
  kanal ve alıcılar
- [x] Kritik uyarı SMS olarak gönderilmez (sahip kararı, 9 Kasım 2026): konsol ve şirket e-postası yeterli; e-posta
  telefonda bildirim olarak düşer
- [ ] Haftalık ve aylık raporlar, galerilere "aranan modeller" raporu, yeni zamanlanmış rapor ve kayıtlı panolar:
  Raporlar ekranıyla (Aşama 9). "Hedef geride kalırsa" uyarısı hedeflerle gelir ("ana ölçü düşerse" Sprint 25'te)

## Sprint 23 · Rengarenk Ajanı ve yapay zekâ bütçesi (Aşama 8 altıncı bölüm, 9 Kasım 2026)

- [x] Yapay zekâ ağ geçidi (Teknik tasarım §10, T11): sağlayıcıdan bağımsız (`AI_PROVIDER` none | fake | vertex), Vertex AI
  Gemini bağdaştırıcısı yazıldı (gerçek anahtarla denenmedi). Her istek maskelenir (telefon, e-posta, IBAN, T.C. kimlik no,
  plaka, bilinen ad soyad; `maskPii`), yanıtta yer tutucular geri konur; her çağrı görev, istem sürümü, model, token ve
  maliyetle `ai_calls`'a yazılır (maskeli içerik, silinmez). Sağlayıcı yoksa ya da hata verirse kural metni döner
- [x] Bütçe (Karar 57): aylık sınır 150 USD, yalnızca Sahip değiştirir (işlem kaydı); %80'de ve sınırda ayda bir olay
  (`yz.butce_uyari`, `yz.butce_doldu`); sınırda yalnızca kritik görevler (moderasyon, mesaj güvenliği); görev başına
  aç/kapat. Konsol › Sistem › Yapay zekâ ve bütçe: harcama, ay sonu tahmini, sınır, değişiklik geçmişi, görevlere göre
  harcama, maskeleme kuralları
- [x] Rengarenk Ajanı (Karar 41): durdurma düğmesi `ajan` özellik anahtarı (durunca kapora kontrolü, galeri başvurusu
  onayı ve ticari e-posta durdurma yapılmaz, karar insana kalır); ajanın işlemleri `agent_actions`'ta, mesaj gizleme ve
  askı, galeri onayı ve ticari e-posta durdurma tek tıkla geri alınır (türüne göre yetki). Kurallarla öneriler (denemesi
  biten sessiz galeriler, dolandırıcılıkta bağlantı oranı, il ve kategoride talep artışı), 09.00'dan sonra günlük özet,
  "Ajana sor" (sayılar kuraldan, kişisel veri yok; yapay zekâ yalnızca cümleyi kurar). Konsol › Rengarenk Ajanı;
  Çalışanlar listesinde ajan satırı
- [x] Ajanın kalan "sormadan yapar" işleri (Sprint 25): destek yanıtı, talep düzeltme isteği, spam kısıtlama, ana ölçü
  ve ödeme hata oranı uyarısı, SMS yedeğe geçişin akışa yazılması
- [ ] Gönderim saati ve A/B kazananı: kampanyalar ve deneylerle (Aşama 9)
- [x] Kullanıcı tarafı yapay zekâ (Karar 42): Sprint 26
- [x] Bütçe uyarısı, günlük özet ve ajanın durması sahibe iletiliyor (Sprint 24, çalışan uyarıları)

## Sprint 22 · saklama, imha, VERBİS; ihlal ve resmi talepler (Aşama 8 beşinci bölüm, 9 Kasım 2026)

- [x] Konsol › Saklama, imha ve VERBİS (Karar 59): saklama süreleri tablosu; ajan her gün süresi dolan kayıtları sayar
  (sohbet mesajları 1 yıl, kapatılan hesabın kimlik kaydı 5 yıl, erişim kayıtları 2 yıl, çözülmüş destek talebi 1 yıl,
  KVKK başvurusu 3 yıl, fatura bilgisi 10 yıl); liste yalnızca Sahip onayıyla 1 Ocak / 1 Temmuz 03.00'te imha edilir,
  tutanak (`disposal_runs`) indirilir. Şikâyetli sohbet ve resmi talebi süren kişinin kaydı bekletilir. İşlem kaydı, hak
  defteri ve rıza kayıtları yalnızca ekleme yapılan tablolar olduğu için satırları hiç değişmez (sahip kararı: Claude'a
  bırakıldı, 9 Kasım 2026)
- [x] İşlem kaydındaki IP adresi yarıyıl dönem anahtarıyla şifreli (`pii_keys`, `apps/api/src/audit/ip-vault.ts`); 2 yılı
  dolan dönemin anahtarı periyodik imhada silinir, IP okunamaz olur, satır yerinde kalır. Anahtar değiştirilemez, süresi
  dolmadan silinemez (RR040)
- [x] VERBİS kartı: çalışan sayısı ve son 12 ay satış toplamı (bilanço tahmini) eşiklere göre; envanter şemadaki `@pii`
- [x] Veri ihlali prosedürü: tatbikat ya da gerçek kayıt, 72 saat sayacı, beş adım (işlem kaydında), Kurul formu
  başlıkları ve kişilere bildirim taslağı; gerçek ihlal Kurul adımı olmadan kapanmaz; sorumlu ve yedek, son tatbikat
- [x] Resmi makam talepleri: yalnız sahip ve yönetici; resmi yazı yüklenmeden veri verilmez, verilen her veri kaydedilir;
  yazı yasaklamıyorsa kullanıcıya bildirim (`resmi.bilgi`)
- [x] Süresi dolan veri kopyası dosyaları ve kapatılan hesabın kopyaları depodan silinir (işçi, saatte bir)
- [x] Çalışan uyarıları (gerçek ihlal başladı, imha yapıldı, VERBİS eşiği) sahibe iletiliyor (Sprint 24)

## Sprint 21 · KVKK başvuruları, verilerimi indir, rıza kayıtları (Aşama 8 dördüncü bölüm, 9 Kasım 2026)

- [x] Verilerimi indir (Karar 58): SMS koduyla istenir; işçi profil, talepler, mesajlar, ödemeler, rızalar, destek ve
  başvuruları JSON olarak hazırlar; yalnızca hesabıyla 7 gün indirilir; istek ve indirme işlem kaydına girer. Web Ayarlar ›
  Gizlilik ve güvenlik, mobil Hesabım › Kişisel verilerim (indirme web'den)
- [x] KVKK başvurusu (m.11): hesaptan SMS koduyla ya da konsoldan dışarıdan (kimlik çalışanca doğrulanır); 30 gün süre
  (m.13). Konsol › KVKK başvuruları: dört sayı, süre sayacı, ajanın topladığı veriler ve türe göre taslak, "okudum"
  onayıyla yalnızca tam yetkili çalışan gönderir; yanıt uygulama içi ve e-postayla; menüde açık başvuru sayısı
- [x] Konsol › Rıza ve çerez kayıtları: reklam ölçümü, analitik çerez ve ticari ileti oranları, kişinin rıza geçmişi
  (metin sürümü, tarih, kanal)
- [x] Ayarlar › Gizlilik ve güvenlik: Engellediklerin (engeli kaldır)
- [x] Hesap kapatma ve anonimleştirme (Karar 31, 39, 59; sahip onayı 9 Kasım 2026): SMS koduyla; talepler kapanır,
  araçlar kalkar, sohbetler karşı tarafta "Kapatılmış hesap" ve yalnızca okunur; ad, e-posta, telefon, cihaz anahtarları,
  favoriler, kayıtlı aramalar, takipler, engeller ve bildirim metinleri silinir; kimlik ve telefon doğrulaması 5 yıl şifreli
  (`account_closures`), mesajlar 1 yıl sonra imha listesine. Web'den alınıp kullanılmamış hakların iadesi yalnızca öneri:
  ajan her sipariş için Onay kuyruğunda REFUND açar, yalnızca Sahip onaylar, yürütücü yapar (iade kilidi değişmedi).
  Galeri sahibi ve askıdaki hesap buradan kapatamaz. Web Ayarlar › Hesap, mobil Kişisel verilerim › Hesabı kapat
- [x] Saklama, imha ve VERBİS; veri ihlali prosedürü ve resmi makam talepleri; süresi dolan kopya dosyasının silinmesi
  (Sprint 22)
- [x] KVKK başvurusunda 7 gün kala uyarı (Sprint 24, çalışan uyarıları)

## Sprint 20 · destek ve yardım merkezi (Aşama 8 üçüncü bölüm, 8 Kasım 2026)

- [x] Yardım merkezi (Yardim.dc.html): web `/yardim` (konular, sık sorulanlar, arama, güvenli alışveriş, destek talebi
  formu), mobil Yardım ve destek ekranı (Hesabım menüsünden)
- [x] Destek talebi (Karar 54): uygulama içi ve e-posta tek kuyrukta; ilk yanıt hedefi mesai içinde 2 saat, mesai dışında
  ertesi iş günü 11.00; ödeme ve hesap güvenliği öne alınır. Destek taleplerim (web `/destek`, mobil), Mesajlarım'da
  sabit "Rengarenk Destek" satırı; yazışma şifreli saklanır
- [x] Konsol › Destek: dört sayı (açık ve süre aşan, ortalama ilk yanıt, ajanın çözdüğü, memnuniyet), kuyruk ve süre
  sayacı, telefon maskeli yazışma, sık sorulanlardan ve hazır yanıtlardan önerilen yanıt, hazır yanıtlar, "Gönder ve
  çözüldü say", kullanıcı kartına geçiş; menüde açık talep sayısı
- [x] Yanıt kullanıcıya uygulama içi ve e-postayla; çözümden 24 saat sonra 1–5 memnuniyet sorusu (işçi); kullanıcı yazınca
  çözülen talep yeniden açılır
- [x] Destek e-postası için imzalı uç `POST /destek/eposta`; eşleşmeyen adrese yanıt doğrudan e-postayla
- [ ] Gelen e-postanın posta sunucusundan iletilmesi (kendi posta sunucumuz kurulunca); yapay zekâ taslağı ve güven oranı,
  %90 üstünde ajanın kendi yanıtı (Rengarenk Ajanı, Vertex AI); hazır yanıtların konsoldan düzenlenmesi

## Sprint 19 · kullanıcı ve galeri kartı, kara liste (Aşama 8 ikinci bölüm, 8 Kasım 2026)

- [x] Konsol › Pazar › Kullanıcılar ve galeriler (Karar 52): arama (ad, galeri adı, talep no, e-postanın ilk harfleri,
  telefonun son haneleri), süzgeç (bireysel, galeri, askıda), kart: rozetler, maskeli telefon ve e-posta (gerekçe yazınca
  açılır, işlem kaydına girer, 5 dakika sonra yeniden maskelenir), beş sayı, geçmiş (talepler, ödemeler, şikâyetler ve
  kararlar, yıldızlar, notlar, çalışan işlemleri). Pazarlama ve izleyici kartı göremez (Karar 40)
- [x] Karttan işlemler: uyar, 24 saat askı, kalıcı engelleme önerisi (moderasyon kaydı olarak açılır; bildirim ve itiraz
  aynı akış), hak tanımlama (destek ayda hesap başına 10, üstü yönetici; kişiye bildirim), oturumları kapatma, not ekleme,
  iade önerisi için Ödemeler ekranı
- [x] Kara liste (Karar 43): telefon ve IP'ye giriş kodu gönderilmez; kara listedeki IBAN içeren mesaj gizlenir ve kritik
  şikâyet açılır. Değerin kendisi değil anahtarlı özeti saklanır; çıkarma kaydı kapatır
- [ ] Cihaz kara listesi: uygulama kurulum kimliği girişte gönderilince; "Giriş bağlantısı gönder" (e-postayla tek
  kullanımlık giriş) güvenlik tasarımıyla birlikte; galeri müşteri yönetimi (sorumlu çalışan, yenileme takibi, ayrılma riski)

## Sprint 18 · şikâyet ve moderasyon (Aşama 8 ilk bölüm, 8 Kasım 2026)

- [x] Şikâyet (Karar 13.2, 53): mesaj, talep ve portföy aracı; neden önceliği belirler (kritik 1 saat, yüksek 4 saat,
  normal 24 saat); kişi başına günde 10; aynı hedefe açık şikâyet tekrar açılmaz. Web ve mobilde mesajın altında,
  sohbet başlığında, talep ve araç sayfasında "Şikayet et"
- [x] Konsol › Pazar › Moderasyon: kuyruk (süre sayacı, menüde "N süre aştı"), maskeli kanıt (telefon ve IBAN maskeli,
  işaretler), kural önerisi, karar (uyarı, gizle, 24 saat askı, kalıcı engelleme önerisi, red), aynı içeriğin diğer
  şikâyetleri birlikte kapanır; itirazlar; otomatik içerik filtreleri ve yasaklı kelimeler
- [x] Yaptırımlar: uyarı (30 gün içinde ikincisi otomatik askı), askı (ilk mesaj ve mesaj gönderemez), gizleme
  (mesaj "gizlendi" görünür; talep ve araç yayından kalkar, sahibi yeniden yayınlayamaz), kalıcı engelleme dört göz
  onayıyla (hesap kapanır, oturumlar düşer, talepler kalkar, galeri sahibiyse galeri askıya alınır)
- [x] Ajan (Karar 41, kural tabanlı): satıcı mesajında açık kapora ve IBAN ya da ödeme isteği varsa mesajı gizler,
  24 saat askı (günde en çok 50), kararı insana bırakır; insan kararı geçici işlemin yerine geçer
- [x] İtiraz: karar bildirimindeki bağlantı (web `/itiraz/[id]`, mobil), 7 gün içinde bir kez; ilk kararı veren
  inceleyemez; kabulde yaptırım kalkar, içerik geri gelir. Karar iki tarafa şablonla bildirilir
- [x] Yasaklı kelime kuralı mesaj ve talep yayınında moderasyona şikâyet açar; telefon izni kapalı alıcıda satıcı
  mesajındaki numara gizlenir; satıcı puanında şikâyet oranı (90 gün, karara bağlanan ve geri alınmayan)
- [ ] Yapay zekâ değerlendirmesi ve güven oranı (Rengarenk Ajanı, Vertex AI hesabı gelince); galerinin 1 yıldıza
  itirazı (Sprint 27'de yapıldı); kara liste (telefon, IBAN, cihaz, IP) kullanıcı kartıyla

, şablonlar, otomatik akışlar (Aşama 7, 8 Kasım 2026)

- [x] Tek bildirim katmanı (Karar 48): olay → alıcı → tercih ve rıza → kanal sırası (uygulama içi ve push hemen,
  e-posta bildirim okunmadıysa gecikmeyle, SMS yalnızca kritik: talebin son günü, ödeme sorunu) → teslim kaydı
  (`deliveries`, silinmez). Olay eşlemesi: talep süresi 7/3/1 gün, talep yayında, ilk ve yeni mesaj, güvenlik uyarısı,
  eşleşme, takip özeti, kayıtlı arama (anlık ve günlük özet), ödeme, abonelik, iade, galeri başvurusu, deneme, EİDS
- [x] Kanallar: SMTP (yerelde Mailpit; işlemsel ve ticari ayrı gönderen), FCM HTTP v1, mevcut SMS ana ve yedek; kalıcı
  hata ve 3 geçici hata gönderim dışı listesine, geçersiz cihaz anahtarı kapanır
- [x] Tercihler (Karar 30): konu × kanal tablosu; ödeme bildirimleri uygulama içi ve e-postada kapatılamaz; kampanya
  tercihi ticari ileti onayını rıza kaydına yazar
- [x] Ticari ileti (Karar 49, 50): onay, kişi başına haftada 2, 21.00–09.00 sessiz saat; tek tıkla ayrılma (imzalı
  bağlantı, List-Unsubscribe-Post); İYS bildirimi `iys.izin_degisti` olayıyla (bağlantı yokken bekler)
- [x] E-posta ısınması (ilk hafta ticari yok, sonra günde 200 ve haftada iki katı, 6. haftadan sonra sınırsız), sunucu
  geri bildirimi (kalıcı/geçici hata, spam şikâyeti), itibar denetimi: son 7 günde geri dönme %2'yi ya da şikâyet %0,1'i
  aşarsa ajan ticari e-postayı durdurur (işlem kaydı ve `bildirim.ticari_durduruldu` olayı)
- [x] Web: başlıkta zil, `/bildirimler`, `/ayarlar` (profil ve e-posta doğrulama, bildirim tercihleri, oturumlar),
  `/eposta-dogrula`, `/iletisim/ayril`. Mobil: zil rozeti, bildirimler, ayarlar, push izni ve cihaz kaydı
- [x] Konsol › Büyüme: Şablonlar (kanal sekmeleri, değişkenler, "Ayşe için" önizleme, kendime test, yeni sürüm olarak
  kaydet; bilinmeyen değişken reddedilir), Bildirim merkezi (kanal sağlığı, SMS ana/yedek, gönderen kimlikleri, ısınma
  planı, gönderim dışı adresler, itibar, kurallar, ticari gönderimi durdur/başlat), Teslim raporu (kanallar, şablonlara
  göre okunma), Otomatik akışlar (yedi akış, aç/kapat, adımlar, son 30 gün)
- [x] Zamanlı akışlar (Karar 51) her gün 09.30'dan sonra: ilk talebini oluştur (üyeliğin 3. günü, ticari), ilk mesajı
  okumadın (varsayılan kapalı), galeri 7 gündür mesaj göndermedi; hoş geldin kayıt olayıyla
- [ ] Gerçek hesaplar: Firebase projesi (iOS'ta FCM için Firebase SDK), kendi posta sunucusu (Radore, SPF/DKIM/DMARC,
  ters DNS, kara liste denetimi), İYS bağdaştırıcısı, SMS fiyatları ve yedek sağlayıcı (Netgsm)
- [ ] E-postada açılma ve tıklama ölçülmüyor (izleme pikseli ve yönlendirme yok); raporda uygulama içi okunma var
- [ ] Akış düzenleyicisi ("Adım ekle"), kampanyalar ve segmentler: Aşama 9
- [x] Çalışan olaylarının (yeni cihaz, iade sonucu, ticari gönderim durdu) sahibe iletilmesi (Sprint 24)
- [ ] Ön bilgilendirme formu ve sözleşmenin PDF olarak e-postayla gönderilmesi
- [ ] Ayarlar'da İletişim ve Hesap sekmeleri (hesabı kapatma KVKK araçlarıyla, Aşama 8)

## Sprint 16 · iade akışı ve dört kilit (Aşama 6 son bölüm, 8 Kasım 2026)

- [x] İade önerisi (konsol › Ödemeler ve faturalar › "İade öner"): iade yetkisi öneri ya da tam olan çalışan (Finans,
  Destek, ajan); sistem tutarı önerir (Karar 39: 14 gün içinde kullanılmayan hak tam, kısmen kullanılan oranlı; başlamış
  öne çıkarma 0; yıllık paket 14 gün içinde ve kullanılmadıysa tam; aylık pakette kısmi iade yok), en çok ödenen eksi
  önceki iadeler. Mağaza satışları buradan iade edilmez
- [x] Onay kuyruğu: iadeyi yalnızca Sahip onaylar; onaylarken tutarı düşürebilir, artıramaz (karar anında yazılır)
- [x] Kilit 1 değişmedi (rr_refund_guard, rr_approval_immutable); onay başına tek iade kaydı (tekil dizin)
- [x] Kilit 2: iade kodu yalnızca ayrı `iade-yurutucu` sürecinde (`src/refund-executor.ts`, `IADE_YURUTUCU=1`), PayTR
  iade bilgileri ayrı ortam dosyasında (`.env.iade`, `IADE_PAYTR_*`); API ve işçinin iade kodunu içe aktarmadığını test
  denetler. Not: PayTR iadeyi ödemeyle aynı mağaza anahtarıyla imzalar; PayTR'den iade API'sinin yalnızca yürütücünün
  IP adresine açılması istenecek
- [x] Kilit 3: yürütücü iadeden hemen önce onayı kilitleyip yeniden doğrular (Sahip, etkin, 72 saat, tutar ödemeyi
  aşmıyor), iade kaydı ve işlem kaydı aynı işlemde; sonucu belirsiz iade yeniden denenmez, sahibe iletilir
- [x] Kilit 4: ajan yalnızca öneri açabilir (onay motoru), iade kaydını yalnızca yürütücü açar
- [x] İadenin etkisi: siparişten kalan kullanılmamış hak düşer, süren öne çıkarma biter; aboneliğin güncel dönemi
  tamamen iade edilirse abonelik biter ve galeri "paket yok" durumuna düşer. İade faturası kuyruğa girer (e-Arşiv)
- [x] Web Haklarım ve galeri faturalarında "İade: X TL"; konsolda "İade edildi / Kısmi iade" ve İadeler tablosu
- [ ] Kullanıcının kendisinin "İade talep et" demesi (şimdilik destek üzerinden; sahip önerisiyle yapılmadı)
- [ ] Gerçek PayTR iadesi ve iade faturası: sözleşme ve entegratör gelince (`REFUND_PROVIDER=paytr`)

## Sprint 15 · galeri abonelikleri, mağaza ödemeleri, konsolda ödemeler (Aşama 6 ikinci bölüm, 8 Kasım 2026)

- [x] Galeri abonelikleri (Karar 12.2, 12.3, 12.7, 39): `subscriptions` (galeri başına tek satır, silinmez), paket alma
  yalnızca web'den ve yalnızca galeri sahibi; sözleşme ve otomatik yenileme onayı ayrı. Fiyat KDV hariç, faturaya %20 KDV
- [x] PayTR Kart Saklama: ilk ödemede kart PayTR'de saklanır (Direkt API `store_card`, kart formu doğrudan PayTR'ye
  gönderilir), sonraki dönemler saklı karttan (CAPI LIST + `recurring_payment`); kart anahtarı şifreli
- [x] Üst pakete geçiş hemen (kalan sürenin farkı, bu ayın hak farkı); alt paket ve aylık/yıllık değişikliği sonraki
  dönemde; iptal dönem sonunda ve geri alınabilir; başarısız yenileme 3 gün günde bir, sonra askı ("pasif" paket, salt
  okunur); "Kartı güncelle ve öde"
- [x] Aylık paket hakları (talep, üst sıra) devretmez; yıllıkta da her ay yenilenir; denemenin hakkı paketle düşer.
  Hatırlatma aylıkta 7, yıllıkta 30 gün önce. Bildirimi gelmeyen otomatik çekim yeniden çekilmez, incelemeye düşer
- [x] Galeri ek paketi (10/30 ilk mesaj): KDV hariç fiyat + KDV, galerinin ticari bilgileriyle fatura
- [x] Erişim kuralı tek yerde (`galleryAccess`): mesaj, portföy, eşleşme ve panel aynı kuralı kullanır
- [x] Web galeri paneli › Paket ve faturalar (GaleriPanel.dc.html): mevcut paket, üst pakete geç, yıllık ödemeye geç,
  paket karşılaştırma, ek paket, ödeme (kart çerçevesi), faturalar; ekip ve portföy paket sınırını aşarsa uyarı
- [x] Mağaza ödemeleri (Karar 38): satın alma niyeti, RevenueCat bildirimi (Authorization ile doğrulanır, bakımda da
  açık), aynı bildirim ve aynı satış bir kez, `store_events` (yalnızca ekleme). Mağaza satışının faturasını mağaza keser.
  Mağaza iadesinde o satıştan kalan kullanılmamış hak düşülür, öne çıkarma biter (sahip kararı, 8 Kasım 2026); para
  iadesini mağaza yapar
- [x] Mobil Haklarım (HaklarimMobil.dc.html): haklar, mobil fiyatlarla ürünler, öne çıkarmada talep seçimi, App Store /
  Google Play düğmesi, uygulama içinde ödeme geçmişi
- [x] Konsol › Ödemeler ve faturalar (Yonetim.dc.html › Ödemeler): tahsilat özeti, sipariş tablosu (durum ve kanal
  süzgeci), galeri abonelikleri, incelenecek mağaza bildirimleri; kişisel veri yetkisi yoksa ad kısaltılır
- [ ] Gerçek mağaza: Apple ve Google hesapları açılınca RevenueCat SDK (`react-native-purchases`), ürünler `rr_<ürün>`
  adıyla mağazalarda; canlıda `STORE_PROVIDER=none` (uygulamada satın alma kapalı)
- [x] Galeri adına talep (Karar 12.2, 20): sihirbazda "Kimin adına?" (sahip ve yönetici; web ve mobil), yayında paketin
  talep hakkı düşer (kişinin ücretsiz hakkı kullanılmaz), talep sayfasında alıcı olarak galeri adı; Taleplerim'de rozet
  ve "hakkını kullan" (paketin üst sıra hakkı ya da talepsiz alınmış hak, 7 gün, sıradakinin ardına); galeri ek paketinde
  talep ve üst sıra (hak olarak); galeri paneli özetinde bu dönem açılan talep ve "Galerin adına talep aç"
- [x] Mağaza iadesinde kullanılmamış hak düşme (sahip onayladı)
- [x] Web iadeleri: iade akışı (4 kilit), sahip onayıyla (Sprint 16)
- Tasarımdan farklar: mobilde "Ödeme geçmişi ve faturalar" web sayfasına gitmez (mağaza kuralı), aynı ekranda açılır;
  konsolda "Ödemeler ve faturalar" Pazar grubunda (eski konsol tasarımındaki ekran), özet kutuları ve abonelik tablosu ek

## Sprint 14 · web ödemeleri, haklar ve öne çıkarma (Aşama 6 ilk bölüm, 8 Kasım 2026)

- [x] Veri modeli: orders (sepet, fatura bilgileri, onaylar, doldurulmuş ön bilgilendirme formu), payments (yalnızca
  ekleme), invoices, demand_promotions; sipariş, fatura ve öne çıkarma silinmez (10 yıl saklama, Karar 59). İade tablosuna
  ve iade kilidine dokunulmadı
- [x] Ürünler ve fiyatlar (Karar 12.8; mobil fiyatlar Karar 38): ek talep, talep paketi, uzatma, 10/30 ilk mesaj, üst sıra
  7/30 gün, acil arıyorum, ana sayfa vitrini
- [x] Ödeme onayları (Karar 39): sözleşme onayı her zaman, hemen başlayan hizmette ayrı ikinci onay; onaylar metin
  sürümüyle rıza kaydına, doldurulmuş ön bilgilendirme formu siparişe yazılır. Kurumsal fatura (vergi no) seçeneği
- [x] PayTR iFrame API bağdaştırıcısı (dev.paytr.com: token isteği, çerçeve, bildirim özeti HMAC-SHA256). Bildirim
  imzayla doğrulanır, sipariş satırı kilitlenir, yalnızca ilk bildirim işlenir; tutar uyuşmazsa hak tanımlanmaz ve
  `odeme.uyusmazlik` olayı. Bildirim ucu bakım modunda da açık
- [x] Ödeme onaylanınca haklar hak defterine, öne çıkarmalar hemen başlar (aynı türden süren varsa ardına eklenir);
  işlem kaydı ve olaylar aynı işlemde. Ödenmeyen sipariş 45 dakika sonra iptal
- [x] Öne çıkarmanın etkisi: üst sıra listede ve galeri eşleşmelerinde önce ("Öne çıkan"), "Acil arıyorum" etiketi,
  ücretli vitrin ana sayfada önce (web ve mobil liste)
- [x] e-Arşiv: sağlayıcı arayüzü, işçi ödeme alınınca keser, başarısızsa yeniden dener; "Faturayı indir"
- [x] Web: Haklarım ve ödemeler (Haklarim.dc.html: haklar, aktif öne çıkarma, sepet, ödeme, sonuç, ödeme geçmişi),
  sihirbazın 6. adımında öne çıkarma seçimi yayından sonra sepete gelir, ön bilgilendirme ve mesafeli sözleşme sayfaları
- [ ] Gerçek PayTR ve e-Arşiv: sözleşme ve entegratör gelene kadar canlıda `PAYMENT_PROVIDER=none` (satın alma kapalı),
  `EARSIV_PROVIDER=none` (faturalar kuyrukta); `fake` canlıda açılamaz
- [x] Sonraki bölümler: galeri abonelikleri, mağaza ödemeleri ve RevenueCat, mobil Haklarım, konsolda Ödemeler ve
  faturalar (Sprint 15); iade akışı (4 kilit) sahibe sorulduktan sonra
- [ ] Ön bilgilendirme formu ve sözleşmenin PDF olarak e-postayla gönderilmesi (bildirim katmanıyla, Aşama 7)
- Tasarımdan farklar: ödeme çerçevesi "Siparişi onayla ve öde" düğmesinden sonra açılır (PayTR çerçevesi siparişin
  tutarıyla oluşturulur); fatura il ve ilçesi listeden seçilir

## Sprint 13 · yıldız, rozetler, galeri takibi, çalışan sınırı (Aşama 5 son bölüm, 8 Kasım 2026)

- [x] Veri modeli: ratings (sohbet başına bir), seller_stats (göstergeler ve rozetler), gallery_follows,
  account_members.daily_message_limit
- [x] Yıldız (Karar 55): yalnızca 1–5, yorum yok; satıcıyla sohbeti açılmış ve alıcının mesajından sonra satıcının yanıt
  verdiği alıcı, sohbet başına bir kez, son mesajdan sonraki 30 gün içinde. Web sohbette "Puan ver", mobilde Mesajlar'da
  "… puan ver" kartı ve sohbetin diğer işlemlerinde (MesajlarMobil.dc.html puan penceresi)
- [x] Manipülasyon (ajan gelene kadar kural): son 3 günde açılmış hesap, aynı cihaz ve ağdan (IP ve tarayıcının anahtarlı
  özeti; kendisi saklanmaz) birden çok hesap, satıcıyla aynı işletmede üye olan hesap → yıldız hesaba katılmaz
- [x] Göstergeler: yıldız sayısı, ortalaması, dağılımı; son 30 günde ortanca ve ortalama ilk yanıt (yanıtsız sohbet sonsuz
  sayılır); iç puan (yıldız %40, yanıt %25, şikâyet %25, doğrulama %10). Yeni yıldızda ve her gece işçide
- [x] Rozetler: Onaylı galeri, Hızlı yanıt (10+ sohbet, ortanca < 1 saat), Güvenilir satıcı (10+ yıldız, ortalama ≥ 4,5,
  şikâyet < %1, onaylı galeri). Alıcı galeri profilinde (web, mobil), sohbet listesinde ve sohbette görür; puanı görmez
- [x] Galeri paneli: yıldız ortalaması, dağılımı, rozete ne kadar kaldığı, takipçi sayısı (web Özet; mobil "Rozetlerin")
- [x] Konsol › Satıcı puanı ve rozetler (YonetimPazar.dc.html): ücretli galerilerde rozet sayıları, son 90 günün yıldız
  dağılımı, iç puan bileşenleri, hesaba katılmayan yıldızlar
- [x] Galeri takibi (Karar 28): profilde "Galeriyi takip et" (web; mobilde tasarıma ek), galeri takipçi sayısını görür;
  takip edilen galeriye eklenen ve yayındaki taleplere uyan araçlar her gece `takip.ozet` olayı (iletim Aşama 7)
- [x] Çalışan başına günlük ilk mesaj sınırı (Karar 20): sahip Ekip'te koyar (işlem kaydına girer), "Günde en fazla N ilk
  mesaj"; paket hakkı ortak havuzdur
- [ ] Şikâyet oranı moderasyonla (Aşama 8, yapıldı); galerinin 1 yıldıza itirazı (Sprint 27, yapıldı); rozet eşiklerinin
  konsoldan değiştirilmesi (Kurallar ve fiyatlar, Karar 47, 56); ajanın yıldız incelemesi (Karar 41)
- Kararlar: "Hızlı yanıt" bireysel satıcıya da verilir (Karar 55'te galeri şartı yalnızca Güvenilir satıcıda); profildeki
  "ortalama yanıt süresi" son 30 günde yanıtlanan sohbetlerin ortalamasıdır

## Sprint 12 · ilk mesaj, haklar ve sohbet (Aşama 5 ikinci bölüm, 8 Kasım 2026)

- [x] Veri modeli: conversations (talebe bir satıcı hesabından tek ilk mesaj, araç için alıcı başına tek sohbet; ikisi de
  veritabanı kısıtı), messages (gövde AES-256-GCM ile şifreli, `MESSAGE_SECRET_KEY` canlıda zorunlu), user_blocks
- [x] İlk mesaj (Karar 08, 11.1): satıcı bir talebe hesabı adına tek ilk mesaj atar; alıcı yanıtlarsa sohbet açılır,
  "İlgilenmiyorum" derse satıcı yeniden yazamaz; yanıt gelmeden ikinci mesaj yok. Talep yayında değilse, alıcı
  engellediyse ya da "Kimden" uymuyorsa yazılamaz; kendi talebine ve galerinin çalışanının talebine yazılmaz
- [x] Haklar (Karar 11.2, 12; Teknik tasarım §7): önce günlük hak (bireyselde kategorinin ücretsiz hakkı, başlangıç 5;
  galeride paketin günlük ilk mesajı), sonra hak defterindeki ek hak; hakkın düşmesi ve mesaj aynı işlemde, hesap
  başına kilitle. Açık sohbette yazışmak hak tüketmez. Günlük haklar İstanbul saatiyle 00.00'da yenilenir
- [x] Araç kartı (Karar 26): yalnızca galerinin yayındaki (EİDS onaylı) aracı; alıcının kabul etmediği işlem (şasi,
  podye, airbag, ağır hasar) varsa kartla yazılamaz; satılan araç kartı "Bu araç artık satışta değil" olur; bireysel
  satıcı kart gönderemez
- [x] Alıcı portföy aracına yazar (Karar 27): sohbet araç kartıyla açık başlar, alıcıya ücretsiz, günde en çok 10 farklı
  araç; aynı araç için ikinci yazış aynı sohbete gider; galerinin yanıtı hak tüketmez
- [x] Mesaj güvenliği (Karar 25): kapora, ödeme isteği, IBAN, telefon ve bağlantı kalıpları; satıcının mesajı işaretlenirse
  alıcıya kırmızı bant, sohbet "Güvenlik uyarısı" ve "Uyarılı" süzgeci, `mesaj.uyari` olayı (moderasyon sinyali, Aşama 8)
- [x] Numara paylaşımı: satıcı alıcının numarasını yalnızca alıcı "Numaramı paylaş" deyince görür; olay kaydedilir.
  Engelle / engeli kaldır (Karar 11.3)
- [x] Anlık iletim: `/ws` WebSocket; jeton ilk iletide (adres satırında değil), süresi dolunca yeniden bağlanma; birden
  çok API sürecinde Redis yayını. Çevrimdışı kullanıcıya `mesaj.geldi` olayı bildirim katmanında (Aşama 7) iletilecek
- [x] Web: Mesajlarım (Mesajlar.dc.html), talep sayfasında "Mesaj at" ve kalan hak, ilk mesaj penceresi (galeri adına,
  araç kartıyla), Eşleşmeler'den "Araç kartıyla mesaj at" ve "İlk mesaj gönderildi", araç sayfasında "Bu araç için mesaj
  gönder", galeri Özet'te okunmamış mesaj ve bugünkü ilk mesaj
- [x] Mobil: Mesajlar sekmesi talebe göre gruplu (MesajlarMobil.dc.html), sohbet ekranı (MesajMobil.dc.html), ilk mesaj
  penceresi (GaleriMobil.dc.html), galeri panelinde "İlk mesaj at" ve Mesajlar sekmesi, araç ekranından mesaj
- [ ] Şikayet et (Aşama 8, moderasyon); yapay zekâ sınıflandırması ve "Taslağı yeniden yaz" (Karar 41, 42); ek mesaj paketi
  satın alma (Aşama 6); çalışan başına günlük mesaj sınırı (Karar 20); mesajların 1 yıl sonra silinmesi (Karar 59)
- [ ] Yıldız ve rozetler (Karar 55), galeri takibi (Karar 28): sonraki bölüm
- Kararlar: talep pasife düşünce yeni ilk mesaj atılamaz, açılmış sohbet sürer (geçmiş korunur, Karar 10.5); alıcının
  araç için günlük sınırı şimdilik sabit 10 (konsoldan ayarı yönetim modülüyle)
- Tasarıma ek: web sohbette "Numaramı paylaş" düğmesi (mobil tasarımdaki açıklamadan), ilk mesaj penceresinde "Kimin
  adına" seçimi (bireysel ve galeri hesabı olanlar için), sohbette galeri için araç kartı seçimi

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
