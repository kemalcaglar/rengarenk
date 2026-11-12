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
| 1 · Temel | 2–4 | 1 Oca 2027 | Telefon ve SMS ile giriş, hesaplar, roller ve izinler, işlem kaydı, outbox ve kuyruk, yönetim girişi (Google Workspace + 2FA), izleme, AWS'ye dağıtım, test ortamı | Telefonla giriş canlı sunucuda çalışıyor |
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
| AWS hesabı, Activate kredisi ve KVKK standart sözleşmesi (Karar 37) | 4 | 21 Ara 2026 |
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

Sahip kararları (7 Kasım 2026): Sahip kendi açtığı isteği onaylayabilir, diğer herkes için isteyen ve onaylayan farklı kişidir. Onay motoru iade isteklerini taşır, yalnızca Sahip onaylar; iade kaydı ve yürütme ödeme aşamasında, iade kilidi tetikleyicilerine dokunulmadan yazılır. Eski "Katalog" rolü hazır rollerden çıkarıldı; gerekirse özel rol olarak açılır. Yönetim girişinin e-posta alanı rengarenksite.com.

## Sprint 4 · dağıtım hazırlığı ve özellik anahtarları (7 Kasım 2026'da başladı)

- [x] Canlı provası: dört imaj bu bilgisayarda derlendi, compose.prod.yml canlı kipinde ayağa kalktı, göçler uygulandı; üç dağıtım hatası bulunup düzeltildi (Prisma derlemesi, .dockerignore, web API adresi)
- [x] İşletme el kitabı: deploy/README.md (ilk kurulum, günlük işler, geri alma, prova)
- [x] Özellik anahtarları ve bakım modu (T13, Karar 47): kitle, yüzde, platform, deneme kullanıcıları; konsol ekranı; web ve mobilde bakım duyurusu
- [ ] AWS'ye ilk dağıtım: Lightsail sunucusu, `eu-central-1` (Karar 37; 12 Kasım 2026'da AWS'ye değişti), kapalı test ortamı olarak
- [ ] Yedek (pgBackRest), izleme yığını (Prometheus, Grafana, Loki, GlitchTip) ve SOPS (sunucuyla birlikte)
- [ ] Test ortamı (yalnızca sentetik veri; Lightsail)

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
- [x] Makyaj başına fotoğraf ve plaka bulanıklaştırma (10 Kasım 2026, Karar 34): seçimde makyaj (nesil geneli, makyaj
  öncesi, 1. ve 2. makyaj; `catalog_images.facelift`, nesil ve makyaj başına tek seçili). Gösterimde kasanın makyajı,
  yoksa nesil geneli, yoksa en erken makyaj (`catalog/photo-pick.ts`; seri ayrıntısı, talep sayfası, liste). Konsolda
  seçili fotoğrafta "Plakayı bulanıklaştır": kutu çizilir (en çok 6), API özgün kopyadan pikselleştirip bulanıklaştırır
  (sharp), düzenlenmiş kopya gösterilir, atıfta "düzenlendi"; özgün kopya saklanır ve "Geri al" ile döner
- [x] Galeri fotoğrafı ve önceki nesil (10 Kasım 2026, Karar 34 "Commons'ta fotoğraf yoksa"): Commons adayı ya da
  seçili Commons fotoğrafı olmayan nesle, yayındaki ve "Fotoğraflarım katalogda … kullanılabilir" işaretli portföy
  aracının ilk fotoğrafları aday olur (`catalog_images.origin = galeri`, kaynak foto, araç ve hesap; Commons kontrolüyle
  birlikte toplanır). Konsolda "Galeri fotoğrafı" etiketi; "Plakayı işaretle ve seç" (bulanıklaştırma seçimle aynı
  adımda, plakalı kopya yayına çıkmaz) ya da "Plaka görünmüyor, seç"; geri alma yok. Atıf "Fotoğraf: [galeri adı] ·
  galeri portföyü · temsilî görsel". İzin kapatılınca, fotoğraf silinince, araç moderasyonla kaldırılınca ya da hesap
  kapanınca aynı işlemde "geri_alindi" (`catalog/galeri-foto.ts`), artık gösterilmez; izin yeniden açılırsa aday geri
  gelir. Nesilde hiç fotoğraf yoksa talep sayfasında (web, mobil) aynı serinin en yakın önceki neslinin fotoğrafı
  "Temsili görsel · önceki nesil" etiketiyle (önceki yoksa sonraki nesil; `nesilFoto`). Liste ve vitrin kartları
  yalnızca neslin kendi fotoğrafını gösterir (kartta atıf satırı yok)

## Sprint 30 · üyelik ve giriş yeniden (Karar 18 ve 50, 12 Kasım 2026)

SMS sağlayıcısı özel gönderici adı için şirket ve marka tescili istediği için giriş telefona bağlı olmaktan çıkıyor
(sahip kararı). Üye ol ve Giriş yap ayrı; telefon üyelikte bir kez doğrulanır.

- [x] Karar 18 ve 50, teknik tasarım T09 ve §11 güncellendi
- [x] API: kullanıcıya şifre özeti, Google ve Apple kimliği, tekil e-posta; üyelik başlat (bilgiler + telefon kodu) ve
  tamamla (hesap tek işlemde açılır), e-posta ve şifreyle giriş, Google ve Apple ile giriş (hesap yoksa üyeliğe yönlendirir),
  şifremi unuttum, e-posta doğrulama; telefon koduyla giriş kalkar. Doğrulanmış numara başka hesapta doğrulanamaz; hız
  sınırı, kara liste, rıza kaydı ve reklam ölçümü olduğu gibi
- [x] Kod kanalı: WhatsApp bağdaştırıcısı (Cloud API, kimlik doğrulama şablonu), SMS yedek, yerelde ve testte sahte
  (gerçek Meta hesabıyla deneme bekliyor)
- [ ] E-posta: Amazon SES (SMTP); doğrulama ve şifre sıfırlama şablonları (şablonlar ve gönderim hazır; SES alan adı
  doğrulaması ve üretim erişimi bekliyor)
- [x] Web: `/uye-ol` ve `/giris` ayrı, Google ile devam, şifremi unuttum, e-posta doğrulama; Ayarlar'da e-posta ve şifre
- [x] Mobil: aynı ekranlar; Google ile, iPhone'da Apple ile giriş (gerçek cihazda deneme bekliyor)
- [x] Konsol: kullanıcı kartında giriş yolları ve e-posta doğrulama durumu
- [x] Hassas işlem onayı (verilerimi indir, KVKK başvurusu, hesap kapatma, numara değiştir) telefon koduyla sürer; kod
  WhatsApp'tan gider
- [x] Demo veri, testler, durum belgesi
- Sahibin işleri: Google Cloud'da kullanıcı girişi için OAuth istemcisi; SES alan adı doğrulaması (DNS kayıtları) ve
  üretim erişimi talebi; Meta İşletme hesabı ve WhatsApp numarası (geliştirmede Meta'nın test numarası); Apple geliştirici
  hesabı

## Sprint 29 · konsolun kalan dört ekranı ve web düzeltmeleri (10 Kasım 2026)

Konsolda "sonra" diye duran dört ekranın tasarımı hazır (YonetimPazar, YonetimIcerik, YonetimSistem); ekranlar ve
arkalarındaki işler yapılmadı. Sıra: önce yasal metinler (avukat metni gelince yayın buradan), sonra talepler ve portföy,
sistem sağlığı, tasarım değerleri.

- [x] Web düzeltmeleri (10 Kasım 2026): ana sayfa sol menüsündeki kategori bağlantısı olmayan `/kategori/…` adresine
  gidiyordu, talep listesine (`/talepler?kategori=…`) bağlandı. Yenileme sürerken sayfa değişince yeni jeton tarayıcıya
  ulaşmıyor, eski jeton çalınma sayılıp bütün oturumlar kapanıyordu: yenileme isteği `keepalive`, API'de kaybolan yanıt
  için 2 dakikalık hoşgörü (`REUSE_GRACE_MS`, `sessions.replaced_by`; yerine açılan oturum hiç kullanılmadıysa o kapanır
  ve yeni oturum verilir, kullanıldıysa yine çalınma). Oturuma bakılırken üst çubukta "Giriş yap" yanıp sönmez.
  Hesabım açılır menüsü (üzerine gelince ya da tıklayınca; tasarıma ek) ve "Çıkış yap"; çıkış ucu gövdesiz isteği JSON
  diye bildirdiği için API'de oturumu kapatmıyordu (400), düzeldi
- [x] Ana sayfada vitrin ve son talepler bazen görünmüyordu (10 Kasım 2026): sunucu API'ye ulaşamayınca (yeniden başlama,
  yavaşlık) iki bölümü sessizce gizliyordu. Sunucu bir kez daha dener; yine olmazsa bölüm tarayıcıda yaklaşık bir dakika
  aralıklarla yeniden çekilir (`ana-yedek.tsx`, vitrin `vitrin.tsx`'e taşındı); mobilde de aynı yeniden deneme. Galeri
  düzenine Anasayfa.dc.html'deki gibi vitrin eklendi (konsol tasarımının galeri listesinde yoktu); galerinin ilinde talep
  yoksa son talepler bütün Türkiye'den. Yayındaki eski düzen yeni bölümle tamamlanır (`completeHomeLayout`; eskiden şemaya
  uymayan sürüm varsayılana dönüyordu ve konsolda yapılan düzen kayboluyordu)
- [x] Yardım ve yasal metinler (10 Kasım 2026; YonetimIcerik.dc.html, Karar 46, 59): konsol `/yardim-ve-yasal`.
  Yasal metinler: liste (yayındaki sürüm, tarih, onaylayan sayısı, taslak), "s.N ile karşılaştır" (paragraf farkı, bölüm
  başlığıyla; `legalDiff`), taslak düzenleme, değişiklik notu ve "esaslı değişiklik" işareti, "Onaya gönder" (LEGAL_TEXT,
  yalnızca sahip onaylar; yetki `tasarim_yasal.duzenle`, öneri düzeyi taslak hazırlar). Onaylanan sürümü işçi yayına alır,
  önceki "eski" olur. Kullanıcıların onayladığı taslak da değişmez (RR042; düzenleme yeni sürüm açar). Esaslı değişiklikte
  `yasal.guncellendi` olayı (uygulama içi ve e-posta, metni onaylamış herkese) ve sonraki girişte web ve mobilde
  "Metinlerimizi güncelledik" penceresi: zorunlu metin kabul edilmeden devam edilmez (çıkış yapılabilir), daha önce onay
  verilmiş ticari ileti ve reklam ölçümü yeniden seçilir (bırakılırsa Ayarlar'daki yolla aynı sonuç). Yardım makaleleri
  `help_articles` (ilk kurulumda koddaki sık sorulanlar aktarılır): konsolda ekle, düzenle, taslak, yayın, arşiv; okunma ve
  "faydalı" oranı; web ve mobil yardım merkezi makaleleri API'den okur, makalenin altında tasarıma ek "Bu yanıt işine
  yaradı mı?"; destek sohbetindeki öneri ve ajanın destek yanıtı yayındaki makaleleri kullanır. Ajan notu: son 30 günün
  destek taleplerinde makalelerle karşılanmayan en büyük konu ve oranı; "Taslağı hazırla" yapay zekâ ağ geçidinden
  (maskeli) taslak açar, yayın insanla. Ana sayfadaki sık sorulanlar bölümü (varsayılan kapalı) hâlâ koddaki listeden
- [x] Talepler ve portföy (10 Kasım 2026; YonetimPazar.dc.html › talep, Karar 53): konsol `/talepler-ve-portfoy`
  (yetki `sikayet.coz`), Talepler ve Portföy araçları sekmeleri, tasarıma ek arama (no ya da başlık / galeri), son 100
  kayıt. Talep sütunları: kategori (öneri varsa "Otomobil → Kiralık"), ilk mesaj, durum (Yayında, Düzeltme istendi,
  Kategori öneriliyor, Gizlendi, Süresi doldu, Pasif, Kapandı); araç: doğrulama (EİDS, kopya şüphesi, galeri askıda), fiyat,
  durum. Seçip toplu işlem (en çok 50), gerekçe şablonu ve düzenlenebilir gerekçe (`ACTION_REASONS`). "Gizle" çalışan
  kaynaklı moderasyon kararı (bildirim gerekçeyle, itiraz yolu ve kullanıcı kartı geçmişi aynı). "Düzeltme iste"
  `demands.correction_note`; sahibine bildirim ve Taleplerim'de (web, mobil) "Destek ekibinin notu", düzenleyince kalkar.
  "Kategori değiştir" talebi taşımaz, öneri olarak kaydedilir (`suggested_category_id`) ve sahibine o kategoride talep
  oluşturma bağlantısıyla bildirilir. Araçta "Belge iste" ve "Galeriye bildir" galeri ekibine bildirim. Hepsi işlem
  kaydında
- [x] Sistem sağlığı ve yedek (10 Kasım 2026; YonetimSistem.dc.html › saglik, Karar 56): konsol `/sistem-sagligi`
  (yetki `sistem.ayarla`), dakikada bir yenilenir. İşçi dakikada bir web, API, PostgreSQL, OpenSearch, pg-boss kuyruğu,
  Redis, SeaweedFS ve SMTP'yi yoklar (`health_samples`, 35 gün). Çalışma süresi API yoklamasından (kesinti dakikası ve son
  tarih); hata oranı ve p95, API'nin her yanıtta Redis'e yazdığı dakikalık özetten (`observability/request-stats.ts`,
  Fastify `onResponse`; 5xx ve süre dilimi, kişi ve yol yok, 26 saat); kuyruk pg-boss bekleyen işleri ve aktarılmamış
  outbox. Tasarımdaki RabbitMQ yerine pg-boss yazıyor. Yedek bölümü `backup_runs`'tan; kayıtları sunucudaki pgBackRest
  betiği yazar (`deploy/README.md`), sunucu yokken "Sunucu kurulunca başlar". "Geri yükleme testini şimdi başlat" istek
  kaydı açar; sunucudaki görev alıp ayrı ortamda yürütür
- [x] Tasarım değerleri (10 Kasım 2026; YonetimIcerik.dc.html › tasarim, Karar 46): konsol `/tasarim-degerleri`
  (yetki `tasarim_yasal.duzenle`). Paletin sekiz rengi (renk seçici ve kod; mürekkep ve bağlantıda zemine karşıtlık notu),
  yazı tipi (Google Fonts kataloğundan doğrulanmış, Türkçe karakterli ve 400/700 kalınlıklı 70 seçenek; düz, tırnaklı,
  gösterişli gruplar, canlı örnek), kart, buton ve etiket köşeleri, logo sabit, tarihli mevsimsel temalar (üst bant ve
  yazı rengi, logonun yanında rozet, e-posta başlığı; ana sayfa bannerı Banner ve vitrin'den), taslak değerlerle canlı
  önizleme ve tema anahtarı. Okunmayan renk (metin ve bağlantı zemine ve beyaza karşı 4,5:1 altı, tema yazısı banda karşı)
  onaya gönderilemez. "Onaya gönder" sahip ya da yönetici onayı (DESIGN_TOKENS; isteyen kendi isteğini onaylayamaz,
  sahip hariç), işçi yayına alır; yayınlanan sürüm değişmez (RR043). `GET /tasarim` herkese açık. Web: kök düzen değerleri
  `:root` CSS değişkeni yazar ve yazı tipini yükler; sayfalardaki palet renkleri ve köşeler değişkene çevrildi (`lib/renk.ts`,
  `--rr-*`); mevsimsel temada üst çubuk bant renginde ve rozetli. Mobil: açılışta değerler okunur, ortak renkler ve köşeler
  (`radii`) güncellenir, yazı tipi TTF olarak yüklenir (API Google Fonts'tan çözer), ana sayfa üst bölümü temada.
  E-posta: yazı tipi, köşe, renkler ve tema başlığı yayındaki değerlerden. Konsolun kendi renkleri sabit kalır
- [x] Tasarım değerleri genişletme (10 Kasım 2026, sahip isteği): renkli zeminlerin üstündeki yazı (mavi, pembe, sarı,
  yeşil; ör. mavi butonda beyaz yazı), ikincil metin ve kart zemini düzenlenir; renkli zemin yazısı 3:1 altında
  gönderilemez, 3–4,5:1 arası uyarı. Bütün köşeler oranlı: web `calc(var(--rr-kart-kose) * N / 18)` /
  `calc(var(--rr-buton-kose) * N / 14)`, mobil `kartOran(N)` / `butonOran(N)`; 0 seçilince sitedeki bütün köşeler kalkar,
  tam daireler değişmez, haplar etiket köşesine bağlı. Konsolda köşe hazır seçimleri (Köşesiz, Az yuvarlak, Varsayılan,
  Çok yuvarlak), kaydırıcılar, renkleri varsayılana döndürme, onaydaki taslağı geri çekip düzenleme (`POST
  /staff/design/geri-cek`). Mobilde modül düzeyindeki stil sabitleri renkleri okurken hesaplar (getter).
- [x] Ana sayfa vitrini ve son talepler (10 Kasım 2026): yerelde Docker servisleri topluca kapanınca (bilgisayar uykusu,
  Docker Desktop yeniden başlaması) API her isteğe 500 veriyordu. Servislere `restart: unless-stopped`; bakım denetimi
  veritabanı okunamazsa son bilinen durumla sürer; tarayıcı ve mobil talepleri sayfa açık kaldıkça yeniden dener ve
  beklerken "Talepler yükleniyor…" gösterir.

## Sprint 28 · Aşama 9 · kontrol paneli ve raporlar (9 Kasım 2026)

- [x] Kontrol paneli (YonetimRapor.dc.html › panel; Karar 44): ana ölçü (son 30 gün, 48 saati dolan talepler; önceki 30
  gün farkı; 12 haftalık eğilim; ay hedefi), altı ölçü (yeni talep, ilk mesaj, açılan sohbet, aracı buldum, gelir
  (iadeler düşülür), yeni ücretli galeri) bugün / 7 gün / 30 gün ve önceki eşit dönem; ölçüye tıklayınca neden analizi
  (il, kategori, platform; gelirde platform ve kalem; galeride il ve paket) ve kurallardan tek cümlelik yorum; son 30
  günün günlük yeni talep grafiği ve notları (elle; fiyat ve kategori kuralı değişince kendiliğinden); bugün bakılacaklar
  (onay kuyruğu, başarısız galeri ödemesi, süresi aşan şikâyet, 48 saattir mesaj almayan talepler, denemesi biten
  galeriler, okunmamış uyarılar); aylık hedefler (Sahip ve yönetici girer, işlem kaydı), ay sonu tahmini, sapma %10'u
  geçerse çalışan uyarısı (`hedef_sapma`, ayda bir)
- [x] Talep açıldığı platformla kaydedilir (`demands.platform`, `x-rr-platform`)
- [x] Raporlar (YonetimRapor.dc.html › rapor): süzgeçler (tarih, karşılaştırma, il, kategori, platform), huni (üyelik →
  talep → 48 saatte ilk mesaj → sohbet → aracı buldum; en büyük kayıp adımı), il × kategori arz-talep haritası (mesaj
  almayan oran ve talep sayısı) ve en büyük arz açıkları, gelir (toplam, aylık tekrarlayan, galeri kayıp oranı,
  denemeden ücretliye, iade oranı, kalemler, 6 aylık tekrarlayan gelir, platform payı), en çok talep edilen modeller ve
  uygun araç (Dengeli / Arz az / Büyük açık), birim ekonomisi ve ücretli galeri kohortu; "Panoya kaydet" (kişisel),
  "Excel'e aktar" (CSV; sahip, yönetici, finans; kişisel veri yok; işlem kaydı)
- [x] Reklam ve edinim, deneyler (A/B, fiyat ve arayüz deneyleri): Sprint 28 sonraki bölümleri (aşağıda)
- [x] Ziyaretçi sayısı (web analitiği, 10 Kasım 2026): çerez ve kalıcı kimlik yok; web her yön değişiminde
  `POST /analitik/ziyaret` gönderir, ziyaretçi IP ve tarayıcının o güne özgü rastgele tuzla özetidir (tuz ertesi gün
  Redis'ten silinir), Redis HyperLogLog ile sayılır; işçi beş dakikada bir günlük sayıyı `web_traffic_daily`'ye yazar
  (yalnızca tekil ziyaretçi ve sayfa görüntüleme). Botlar ve başsız tarayıcılar sayılmaz. Huninin başında "N tekil
  ziyaretçi" ve üyelik satırında "% · ziyaretten" (YonetimRapor.dc.html); tekil ziyaretçi günlük tekillerin toplamıdır
- [x] Model aramaları (arama günlüğü, 10 Kasım 2026): web ve mobil talep listesi aramanın ilk sayfasını
  `POST /talepler/arama` ile bildirir (liste sunucuda çekildiği ve benzer talepler de listeyi çağırdığı için listeden
  ayrı). Marka ve seri seçimi ya da metinden bulunan model (`DemandAssistant.katalog`) sayılır; aynı kişi aynı gün aynı
  modeli bir kez. `search_log_daily` (gün, marka, seri, sayı); kişi, IP ve metin saklanmaz. Raporlar › En çok talep
  edilenler'de "Arama" sütunu (süzgeçten bağımsız)
- [ ] Çerezsiz ziyaretçi sayımı ve arama günlüğü aydınlatma metnine yazılacak (avukat görüşmesiyle; yasal metin
  sayfası henüz yer tutucu)
- [x] Zamanlanmış raporlar (YonetimRapor.dc.html › zaman; Karar 44): haftalık rapor (her pazartesi 09.30; sahip,
  yönetici, pazarlama; ana ölçü ve altı ölçü, huni, aylık hedefler, reklam ve deneyler) ve aylık rapor (her ayın 1'i
  10.00; sahip, finans; geçen ayın geliri, birim ekonomisi, kohort) şirket e-postasına PDF ekiyle (Plus Jakarta Sans
  gömülü; aylıkta dışa aktarma yetkisi olana Excel de); "Yeni zamanlanmış rapor" (rapor sekmesi ya da kayıtlı pano,
  sıklık, saat, alıcılar yalnızca raporları gören çalışanlar); rapor ve zaman başına tek gönderim; son ve sıradaki
  gönderim; hazır raporları sahip ve yönetici, yenisini ekleyen açıp kapatır; kayıtlı panolar listesi (Raporlar'da
  `?pano=` ile açılır). Rapor kişisel veri içermez
- [x] Galerilere "aranan modeller" raporu: her ayın 3'ü 10.00, ücretli galerilerin sahip ve yöneticilerine
  `galeri.aranan_modeller` şablonuyla (galeri konusu; ayarlardan kapatılabilir): galerinin ilinde son 30 günde en çok
  talep edilen 5 model (ilde 5 talepten azsa Türkiye geneli), portföydeki araç sayısı ve ajanın kural tabanlı önerisi.
  Varsayılan kapalı; açmak toplu gönderim onayı (BULK_SEND) ister
- [x] Ana sayfa düzeni (YonetimIcerik.dc.html › anasayfa; Karar 46): kitle (ziyaretçi, bireysel üye, galeri) ve platform
  (web, mobil) başına bölüm sırası ve görünürlüğü, anında önizleme; karşılama hep en üstte ve açık; yayın yeni sürüm
  (değişiklikler sürüm notuna yazılır, işlem kaydı), ileri tarihe zamanlama, eski sürüme dönüş. `GET /icerik/anasayfa`
  görüntüleyenin kitlesini, görünen bölümleri ve kişiye özel verileri verir. Varsayılan düzen ana sayfa
  tasarımlarıyla aynı; tasarımlarda olmayan bölümler hazır ve kapalı gelir: ziyaretçide nasıl çalışır (web), galeriler
  için çağrı, güven rozetleri, sık sorulanlar; bireyselde taleplerim özeti ve gelen ilk mesajlar; galeride kalan ilk
  mesaj hakkı ve bölgende aranan modeller. Galeri karşılaması (ad, paket, bugünkü hak, portföy, mesajlar) ve galeri
  için ildeki son talepler; mobilde kategori kutuları, kayıtlı aramalar ve portföy eşleşmeleri
- [x] Banner ve duyuru (YonetimIcerik.dc.html › banner; Karar 46): yer (ana sayfa üstü, galeri paneli üstü, talep
  listesi üstü, talep detayı, uygulama içi duyuru, bütün sayfalar üst şerit), kitle (herkes, ziyaretçi, bireysel üye,
  galeri; üye ve galeride isteğe bağlı il), platform, tarih aralığı (en çok 90 gün), renk; taslak öneri düzeyiyle,
  yayın ve durdurma görünüm yetkisi "tam"; yayındaki değişmez (durdur, kopyala); bitişte kendiliğinden kalkar;
  günlük gösterim ve tıklama (kişisel veri yok, IP başına sınır); web ve mobilde altı yerde (`components/banner.tsx`)
- [x] Ana sayfa vitrini (konsolda): 17 yer, ücretli vitrin sayısı, "boş yerlere editör seçimi" anahtarı (kapalıyken
  yalnızca ücretli talepler görünür)
- [x] Banner A/B testi (yukarıda)
- [x] Akış düzenleyicisi (YonetimKampanya.dc.html › akış; Karar 51; Teknik tasarım: JSON tanım, kişi başına durum):
  tetikleyici ve ilk ileti kodda; "Adım ekle" ile ilk iletiden sonra bekle (1 saat–30 gün), koşul (önceki ileti
  okunmadıysa, ticari onay varsa, doğrulanmış e-posta varsa; sağlanmazsa çıkış) ve ileti (başlık, metin, düğme;
  uygulama içi ve push, e-posta; SMS yok); akışın değişkenleri denetlenir; her düzenleme yeni sürüm ve işlem kaydı.
  Kişi akışa girince adımlar kaydına kopyalanır (`automation_runs`), işçi dakikada bir yürütür; her adımdan önce akış
  açık mı ve hedefe ulaşıldı mı bakılır (ilk talep, talep uzatıldı, mesaj okundu, galeri yazdı, paket alındı, ödeme
  alındı). İleti `akis.adim.<akış>` şablonuyla bildirim katmanından (tercih, ticari onay, haftada 2, sessiz saat).
  "Test kişisine gönder" akışın e-postalarını örnek değerlerle çalışanın adresine yollar; akıştaki ve hedefe ulaşan
  kişi sayısı. Hesap kapanınca süren akışlar durur, bağlam silinir
- [x] Segmentler (YonetimKampanya.dc.html › segment; Karar 51): rol, aktif talep, son giriş, il, talep kategorisi, ödeme,
  platform, açık sohbet, galeri paketi; "ve" ile birleşir; her kuraldan sonra kişi sayısı; kanal ulaşımı (ticari onay,
  kampanya bildirimi izni, push cihazı, doğrulanmış e-posta) ve haftalık sınıra takılanlar; kayıtlı segmentler
- [x] Kampanyalar (YonetimKampanya.dc.html › kampanya; Karar 49, 51): ad, hedef, segment, başlık, metin, düğme,
  bağlantı (site içi), kanal (uygulama içi ve push, ticari e-posta; SMS kapalı), zaman; gönderim özeti (ulaşım, sıklık
  sınırı, ısınma, maliyet); 1.000 kişiyi aşan gönderim BULK_SEND onayıyla; işçi zamanında segmenti yeniden hesaplayıp
  `kampanya.duyuru` şablonuyla bildirim katmanından gönderir (onay, tercih, haftada 2, sessiz saat orada); sonuç
  (kişi, uygulamada okunma, e-posta teslimi) ve grafik notu; iptal
- [x] Açılış sayfaları (YonetimIcerik.dc.html › acilis; Karar 46, 35): bloklar (başlık, rakamlar, avantajlar, form, nasıl
  çalışır, sık sorulanlar, güven rozetleri), sıralama ve içerik düzenleme, sitenin kök adresinde yayın (web yakalama
  rotası; site sayfalarıyla çakışan adres reddedilir), sürüm ve önceki sürüme dönüş, 1 saatlik imzalı önizleme, UTM'li
  reklam bağlantısı, hedefe göre ölçüm olayları listesi, günlük ziyaret ve düğme tıklaması (kişisel veri yok, IP başına
  sınır); düğme UTM'leri koruyarak talep oluşturmaya ya da galeri başvurusuna götürür
- [x] Reklam ölçümü (Karar 35): ilk ve son temas (UTM, gclid, fbclid, fbp, fbc, açılış sayfası, yönlendiren site)
  izin durumuyla (`user_attributions`; tıklama kimlikleri yalnızca reklam çerezi izniyle, izinden önce sekmenin oturum
  belleğinde bekler). Olaylar (CompleteRegistration, Lead, SubmitApplication, DealerApproved, Subscribe, Purchase)
  işlemle aynı veritabanı işleminde ve yalnızca "reklam ölçümü" onayı olan üyede (`ad_events`); işçi dakikada bir
  Meta'ya (web ve sunucu olayları, özet telefon ve kimlik, fbp, fbc, IP ve tarayıcı) ve Google'a (galeri onayı ve
  abonelik, gclid varsa) gönderir; tarayıcı olayı aynı kimlikle (`adEventId`) tekilleşir. Web'de Pixel ve Google
  etiketi yalnızca çerez izninden sonra (Consent Mode v2 temel mod), izin kalkınca ölçüm çerezleri silinir; alt bilgide
  ve Ayarlar › Gizlilik'te "Çerez tercihleri"; Ayarlar › Gizlilik ve mobil Kişisel verilerim'de reklam ölçümü onayı
  (geri alınınca bekleyen olaylar iptal, tıklama kimlikleri, IP ve tarayıcı silinir). Mesaj, talep açıklaması, plaka ve
  şasi gönderilmez. Sağlayıcılar `META_PROVIDER` (none, fake, capi) ve `GOOGLE_ADS_PROVIDER` (none, fake)
- [ ] Mobil Meta SDK (react-native-fbsdk-next), KVKK izin ekranı ve iOS takip izni (ATT): Meta uygulama kimliği gelince.
  O zamana kadar mobil olaylar sunucudan Meta'ya gitmez (`meta_status = yok`)
- [ ] Google çevrimdışı dönüşümün gerçek bağdaştırıcısı (Data Manager API) ve Google Ads harcama çekimi: Google Ads hesabı
  açılınca güncel belgeye göre
- [x] Kuponlar (Karar 40, 51, 56): pazarlama kampanyalar sayfasında hazırlar (kod, ad, yüzde, ürün grupları, kitle,
  tarih, toplam sınır); dört göz onayı (COUPON; sahip ya da yönetici, %50 üstünü yalnızca sahip, onay isteğinde
  `yalnizSahip`); web ödemesinde kod ("Uygula" önizlemesi sunucuda hesaplanır), hesap başına bir kez, kullanım ödeme
  alınınca aynı işlemde; galeri paketinde yalnızca ilk ödeme (yenileme tam fiyat), galeri ek paketlerinde de geçer;
  fatura satırında kupon adı; kampanyaya bağlanır, kupon onaylanmadan kampanya gönderilmez, kupon geçersizse kampanya
  iptal olur; listede kullanım ve toplam indirim. Uygulama içi (mağaza) satın almada kupon yok
- [x] A/B testi (Karar 44, 46, 51): kampanyada ve bannerda ikinci sürüm (başlık, metin, düğme); kişi kimliğinden
  (ziyaretçide cihazdaki rastgele kimlikten) sabit kol, %50 / %50; kampanyada ölçü uygulamada okunma, bannerda tıklama
  (kol başına günlük sayım); iki oranlı z testi, her kolda en az 100 kişi ve güven %95 ile kazanan; Raporlar › Deneyler
  kartları (tasarımdaki gibi), bannerda "B'yi herkese aç" (içerik B olur, ilk sürüm saklanır); ajan kazananı çalışan
  uyarısıyla bildirir (`deney`). Güven aşağı kesilerek yazılır
- [x] Fiyat deneyleri (Karar 44, 56; YonetimRapor.dc.html › deney kartı): Kurallar ve fiyatlar'ın altında öneri (ad,
  ürün, B fiyatı, 7–60 gün; B liste fiyatından en çok %50 farklı; ürün başına tek açık deney), yalnızca Sahip onaylar
  (PRICE_CHANGE, konu `price_experiment`), onaylanınca başlar, süre dolunca biter, erken durdurulabilir. Yalnızca web ve
  bireysel alım: kullanıcı kimliğinden sabit kol; B kolundaki kullanıcı sihirbazda, Taleplerim'de, Haklarım'da, kupon
  önizlemesinde ve ödemede aynı fiyatı görür (`PricingService.bookFor`, `GET /orders/fiyatlar`); galeri hesabıyla,
  mağazada ve herkese açık listede liste fiyatı. Fiyatı ilk görüş kaydedilir; ölçü o andan deney sonuna kadarki web
  ürün ödemesiyle kullanıcı başına gelir (Welch, her kolda en az 100 kişi, güven %95). Raporlar › Deneyler'de kart;
  biten deneyde B kazandıysa "B fiyatını öner" fiyat listesine öneri açar (yine Sahip onaylar); ajan kazananı bildirir
- [x] Arayüz deneyleri (Karar 44; YonetimSistem › "Sihirbaz bütçe adımı · B kolu", YonetimRapor › deney kartı):
  deney tanımı özellik anahtarında (`UI_EXPERIMENTS`); anahtar açık, kitle Herkes ve yüzde 1–99 iken deney dönemi
  açılır (`ui_experiment_runs`, anahtar değişikliğiyle aynı işlemde), dilimi yüzdenin altındaki kullanıcı B'yi görür.
  Web sihirbazında bütçe adımı: A kaydırıcı, B tasarımdaki iki kutu; `butce_b` başlangıçta %100 açık (tasarım). Adımı
  görme ve geçme `POST /flags/deney/:anahtar` (yalnızca web, kişi başı tek satır); ölçü geçen oranı. Raporlar ›
  Deneyler'de kart; "B'yi herkese aç" anahtarı %100'e, "A'da kal" kapatır, dönem kazananla biter; ajan kazananı bildirir
- [x] Raporlar › Reklam ve edinim (YonetimRapor.dc.html › reklam): toplam harcama, galeri başına edinme, üye başına
  maliyet, reklam getirisi; kanal ve kampanya tablosu (üyeler ilk temaslarının kampanyasına bağlanır; harcama, üyelik,
  talep, yeni galeri, üye başı, 30 günlük ödeme ÷ harcama), son çekim notu, ajanın kural tabanlı bütçe yorumu; kanal
  kırılımı (reklam, bildirim ve e-posta, organik). Harcama her gece 03.00'ten sonra dünü ve önceki günü çeker
  (`ad_spend`; elle giriş yok). PDF ve Excel aynı tablolarla. Entegrasyonlar'da Meta ve Google kartları gerçek durumla
- [ ] Ajanın reklam yorumu yapay zekâyla (şimdilik kural)

## Sprint 27 · Aşama 8 kalanları (9 Kasım 2026)

- [x] Galerinin 1 yıldıza itirazı (Karar 55): galeri panelinde (web Özet › Yıldızların ve rozetlerin, mobil Rozetlerin)
  son 30 günün 1 yıldızları yalnızca tarihiyle; sahip ya da yönetici her yıldıza 30 gün içinde bir kez itiraz eder.
  Konsol › Moderasyon › İtirazlar'da "Galeri · 1 yıldıza itiraz" (YonetimPazar.dc.html): sohbet kanıtı (mesaj sayıları,
  yıldızın son mesajdan ne kadar sonra verildiği, alıcı hesabının yaşı), maskeli son mesajlar, 7 günlük inceleme
  süresi. Kabulde yıldız `itiraz` işaretiyle hesaptan çıkar, göstergeler yenilenir; sonuç itirazı yazana bildirilir
- [x] Ayarlar › İletişim ve Profil (Ayarlar.dc.html, Karar 29): telefon ve WhatsApp izni, aranabilir saatler (varsayılan
  09.00–21.00; dışında talep sayfasında numara ve WhatsApp gizli, "Telefon ve WhatsApp 09.00–21.00 arasında görünür"),
  profilde il, ilçe ve görünen ad (tam ya da "Ayşe Y."). Yeni talep bu tercihlerle ve profildeki konumla açılır (web, mobil)
- [x] Numarayı değiştir (Yardim.dc.html): yeni numaraya SMS kodu; numara başka hesapta kayıtlıysa reddedilir; doğrulanınca
  diğer cihazlardaki oturumlar kapanır, işlem kaydı ve güvenlik bildirimi. Ücretsiz ilk talep numara ve hesap başına bir
  kez (numara değiştirmek hakkı yenilemez)
- [x] Oturum kapatma düzeltmesi: elle kapatılan oturumun (Ayarlar, numara değişikliği) jetonu yalnızca reddedilir; çalınma
  sayılıp bütün oturumları kapatma yalnızca yenilenmiş (döndürülmüş) jetonun tekrar gelmesinde (`sessions.rotated`)
- [x] Cihaz kara listesi (Karar 43): mobil uygulama ilk açılışta kurulum kimliği üretir (güvenli depo) ve girişte gönderir;
  sunucu yalnızca anahtarlı özetini tutar. Konsol › kişi kartı › Cihazlar › "Kara listeye al": o kurulumdan kod
  istenemez, giriş yapılamaz, açık oturumları kapanır; kara liste ekranından çıkarılır. Tarayıcı cihazı kara listeye
  alınamaz (IP kara listesi var)
- [x] Giriş bağlantısı gönder (Karar 52; YonetimPazar.dc.html): destek, kişinin doğrulanmış e-postasına tek kullanımlık
  bağlantı gönderir (15 dakika, bir kez; yenisi eskileri geçersiz kılar; kişi başına günde 3). Bağlantı özeti saklanır;
  e-postadaki kod teslim kaydında şifreli durur ve gönderimden sonra silinir. Web `/giris/baglanti`, kişi girince
  Ayarlar › Profil'e gider (numarasını değiştirebilir); kara liste denetimi girişle aynı
- [x] Galeri müşteri yönetimi (Karar 43): konsol › Pazar › Galeri müşterileri (tasarımda ayrı ekran yok; liste ve kart
  dili): ayrılma riski kurallarla (`churnRisk`: ödeme alınamadı, paket bitti, yenileme kapalı, deneme bitiyor, denemede
  mesaj yok, 14 gün giriş yok, ilk mesajlarda yarıdan fazla düşüş, portföy boş) ve gerekçeleri, yenileme tarihi, sorumlu
  çalışan (Sahip, Yönetici, Operasyon atar; işlem kaydına girer); süzgeçler: sorumlu olduklarım, riski yüksek, 30 gün
  içinde yenileme, sorumlusu yok. Galeri kartında "Müşteri yönetimi" bölümü; notlar kartın çalışan notları
- [x] Sistem › Kurallar ve fiyatlar (YonetimSistem.dc.html; Karar 47, 56): galeri paketlerinin fiyat ve sınırları ve
  bireysel ürünlerin web fiyatı fiyat listesinde (`price_books`); "Düzenle" → yürürlük tarihi → onaya gönder
  (PRICE_CHANGE, Sahip onaylar), işçi zamanlar, o gün geçerli olur. Mevcut aboneler yenileme tarihine kadar dönem
  fiyatından devam eder; fiyatı değişen paketin abonelerine duyuru (`fiyat.degisiyor`), yenileme hatırlatmasındaki tutar
  yenileme günündeki listeden. Sipariş, abonelik, paket sınırları (portföy, günlük mesaj, aylık talep, öne çıkarma,
  çalışan) yürürlükteki listeden; web sihirbazı ve Taleplerim `GET /fiyatlar` okur. Mobil fiyatlar mağazadan, yalnızca
  gösterilir. Kullanım kuralları gösterilir (ücretsiz ilk mesaj ve yayın süresi kategori kuralı)
- [x] Fiyat değişikliğinin grafiklere not olarak düşmesi (Sprint 28)
- [x] Rozet eşiklerinin konsoldan (10 Kasım 2026: Kurallar ve fiyatlar › Rozet eşikleri; aynı liste, Sahip onayı, yürürlük tarihi)
  değiştirilmesi (tasarımın Kurallar ve fiyatlar ekranında yok)

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
  (tasarımdaki görev listesi değişmedi); Bedrock erişimi açılınca gerçek modelle denenecek
- [x] Mobilde toplu yükleme (10 Kasım 2026): GaleriMobil.dc.html'deki "Excel/CSV ile toplu yükleme web panelde"
  düğmesi tarayıcıda web galeri panelinin Toplu yükleme bölümünü açar (`?bolum=toplu`, girişten sonra da korunur);
  tasarım gereği ayrı mobil ekran yok

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
- [ ] Yapay zekâ ile sınıflandırma ve taslak: Bedrock erişimi açılınca (şimdilik kurallar; ağ geçidi maskeli istekle hazır)

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
- [x] Haftalık ve aylık raporlar, galerilere "aranan modeller" raporu, yeni zamanlanmış rapor ve kayıtlı panolar
  (Sprint 28). "Hedef geride kalırsa" uyarısı hedeflerle geldi ("ana ölçü düşerse" Sprint 25'te)

## Sprint 23 · Rengarenk Ajanı ve yapay zekâ bütçesi (Aşama 8 altıncı bölüm, 9 Kasım 2026)

- [x] Yapay zekâ ağ geçidi (Teknik tasarım §10, T11): sağlayıcıdan bağımsız (`AI_PROVIDER` none | fake | vertex), Vertex AI
  Gemini bağdaştırıcısı yazıldı (gerçek anahtarla denenmedi; 12 Kasım 2026'da AWS Bedrock bağdaştırıcısı eklendi, canlı sağlayıcı Bedrock). Her istek maskelenir (telefon, e-posta, IBAN, T.C. kimlik no,
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
  %90 üstünde ajanın kendi yanıtı (Rengarenk Ajanı, Bedrock); hazır yanıtların konsoldan düzenlenmesi

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
- [x] Cihaz kara listesi ve "Giriş bağlantısı gönder" (Sprint 27)
- [x] Galeri müşteri yönetimi (Sprint 27) (sorumlu çalışan, yenileme takibi, ayrılma riski)

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
- [ ] Yapay zekâ değerlendirmesi ve güven oranı (Rengarenk Ajanı, Bedrock erişimi gelince); galerinin 1 yıldıza
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
- [ ] Gerçek hesaplar: Firebase projesi (iOS'ta FCM için Firebase SDK), Amazon SES (Karar 50, 12 Kasım 2026'da kendi posta sunucusu yerine; alan adı doğrulaması ve üretim erişimi), İYS bağdaştırıcısı, SMS fiyatları ve yedek sağlayıcı (Netgsm)
- [ ] E-postada açılma ve tıklama ölçülmüyor (izleme pikseli ve yönlendirme yok); raporda uygulama içi okunma var
- [x] Akış düzenleyicisi ("Adım ekle"): Sprint 28
- [x] Çalışan olaylarının (yeni cihaz, iade sonucu, ticari gönderim durdu) sahibe iletilmesi (Sprint 24)
- [x] Ön bilgilendirme formu ve sözleşmenin PDF olarak e-postayla gönderilmesi (10 Kasım 2026; Sprint 15 notuna bak)
- [x] Ayarlar'da İletişim ve Hesap sekmeleri (Hesap: hesap kapatma Sprint 21; İletişim Sprint 27)

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
- [x] Ön bilgilendirme formu ve sözleşmenin PDF olarak e-postayla gönderilmesi (10 Kasım 2026): ödeme alınınca işçi
  (`odeme.alindi` → `odeme-sozlesme`, `ContractMailService`) siparişte onaylanan metin sürümleriyle iki PDF üretir (ön
  bilgilendirme formu; mesafeli hizmet ya da galeri hizmet sözleşmesi; taraflar, tutar, onay zamanı; 12 punto, site yazı
  tipi, `common/document-pdf.ts`) ve fatura e-postasına gönderir. Yalnızca web siparişi (mağaza satışında belgeyi mağaza
  verir, otomatik yenileme yeni sözleşme değil); bir kez (`orders.contract_sent_at`), geçici hatada yeniden denenir,
  gönderim dışı adreste nedeni yazılır (`contract_note`). Konsol › Ödemeler'de fatura sütununun altında durum
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
- [x] Şikâyet oranı moderasyonla (Aşama 8, yapıldı); galerinin 1 yıldıza itirazı (Sprint 27, yapıldı); rozet eşiklerinin
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
- [x] Komşu il (0,5) (10 Kasım 2026): il komşulukları `packages/shared/src/il-komsulari.ts` (geoBoundaries TUR ADM1,
  OpenStreetMap, CC BY-SA; il sınırlarının ortak yayı ya da ~300 m ızgarada ortak noktası; 200 çift; Veri kaynakları'nda
  atıf). Eşleştirme ayarı › Sert koşullar'da kategori başına "Konum: Yalnızca alıcının ili / Komşu iller de" (şema
  sürümünde `konumKapsami`, dört göz onayıyla yayın). Başlangıç "il" (değişiklik yok); "komşu" seçilirse komşu ildeki
  galeri eşleşir, konum uyumu 0,5, uzak il yine dışarıda (OpenSearch sorgusu da komşu illeri alır). Alıcının kendi mesafe
  seçimi sihirbaz tasarımında yok
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
- [x] Araç kartında "Talebine uyuyor", eşleşme sayısı ve mesaj (Aşama 5); şikayet (Aşama 8)
- [x] Araç favorisi (10 Kasım 2026; PortfoyArac.dc.html "♡ Favorilere ekle"): `vehicle_favorites`, uçlar
  `PUT/DELETE/GET /araclar/:no/favori`, `GET /favoriler/araclar`; web araç sayfasında düğme, Favoriler'de "Favori araçlar"
  sekmesi (tasarıma ek), mobilde araç başlığında kalp ve Favoriler'de sekme. Kendi galerisinin aracı eklenmez; satıştan
  kalkan araç "Satışta değil" olarak kalır. Hesap kapatmada silinir, veri kopyasında var
- [x] Fotoğraf kopya tespiti (10 Kasım 2026; güvenlik önlemleri › ilan kopyalama): yüklemede algısal özet (dHash 64 bit,
  `portfolio_photos.phash`, `portfolio/photo-hash.ts`); başka galerinin aracındaki fotoğrafa en çok 5 bit farkla benzerse
  yükleme olur, araca "Kopya fotoğraf" kural şikâyeti açılır (yüksek öncelik, araç başına bir açık şikâyet, işaret:
  eşleşen araç no ve galeri). Aynı galerinin kendi fotoğrafı sayılmaz
- [x] Galeri fotoğrafının katalogda temsilî görsel olması (10 Kasım 2026, Karar 34; ayrıntı Sprint 6 › Galeri fotoğrafı ve önceki nesil)
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
- [x] Talep kartlarında görüntülenme, favori, mesaj ve uyan portföy sayıları (10 Kasım 2026; Taleplerim.dc.html,
  TaleplerimMobil.dc.html): `GET /demands/mine` `istatistik`; görüntülenme `demands.view_count`, talep sayfası açılınca
  `POST /talepler/:no/goruntu` (web ve mobil), sahibi, botlar ve 24 saat içinde aynı üye ya da IP sayılmaz (özet
  Redis'te 24 saat). Mesaj açılan sohbet, uyan portföy aracı etkin eşleşme sayısıdır
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
