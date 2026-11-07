# Tersine İlan Uygulaması – Ürün Kapsam Dokümanı

3 Kasım 2026

## Ürün özeti

Platform, aradığı aracı tanımlayan alıcıyla o araca sahip satıcıyı buluşturan bir tersine ilan pazaryeridir. Alıcı talep yayınlar, satıcı talebi bulur ve doğrudan iletişime geçer.

Araç için platform üzerinden teklif, fiyat pazarlığı, ödeme, kapora veya satış işlemi yapılmaz; platform yalnızca kendi hizmetleri için ücret alır (Karar 12). İşleyiş sahibinden.com mantığındadır: anlaşma tamamen taraflar arasındadır.

Sürüm 0.59 · 59 karar kesinleşti; hukuki varsayılanlar (Karar 31 ve 39) avukat görüşmesinde gözden geçirilecek.

## Kararlar

| No | Konu | Karar | Durum |
| --- | --- | --- | --- |
| 01 | Pazar modeli | Açık pazar | Kesinleşti |
| 02 | Kullanıcı hesapları | Tek hesap, hem alıcı hem satıcı | Kesinleşti |
| 03 | Galeri hesapları | Otomatik kontrollü kurumsal hesap; kontrollerin hepsi geçerse ajan onaylar ve sahibe bildirir | Kesinleşti |
| 04 | Talep oluşturma | Detaylı, katalog tabanlı, 30 gün yayın | Kesinleşti |
| 05 | Alternatifler | Ana araç bilgileri sabit, diğer kriterler alternatifli | Kesinleşti |
| 06 | Talep keşfi | Talep arama, otomatik eşleşme, özelleştirilebilir filtreler, favori, bildirim | Kesinleşti |
| 07 | Galeri portföyü | Manuel ekleme + Excel/CSV + API; alıcıya da görünür | Kesinleşti |
| 08 | İletişim modeli | Teklif ve fiyat yok; mesaj, izinli telefon ve WhatsApp | Kesinleşti |
| 09 | Talep yönetimi | Kapat, pasife al, düzenle, aracı buldum | Kesinleşti |
| 10 | Talep yayın süresi | 30 gün; 7 / 3 / 1 gün önce hatırlatma; süre dolunca pasif, tek dokunuşla uzatma | Kesinleşti |
| 11 | Mesaj kontrolü ve iletişim kutusu | Tek ilk mesaj + günlük limit + engelle/şikayet; sahibinden.com tarzı iletişim kutusu | Kesinleşti |
| 12 | Gelir modeli ve kotalar | Bireysel kotalar ve ek hizmetler; galeri paketleri 1.490 / 3.490 / 7.490 TL; 30 gün sınırlı deneme; PayTR | Kesinleşti |
| 13 | Yönetim paneli | Tam panel: onay, moderasyon, içerik filtreleri, paket/fiyat, ödeme, katalog, raporlar | Kesinleşti |
| 14 | Platformlar | Web + iOS + Android birlikte, ortak arka uç, mobilde tek kod tabanı | Kesinleşti |
| 15 | İlk sürüm kapsamı | Kararların tamamı ilk sürümde, fazlara bölünmeden | Kesinleşti |
| 16 | Teknoloji yığını | TypeScript monorepo: Next.js + React Native (Expo) + NestJS; PostgreSQL, Redis, OpenSearch; Kubernetes | Kesinleşti |
| 17 | Portföy görünürlüğü ve ilan platformu yükümlülükleri | Portföy alıcıya görünür; EİDS, yetki belgesi kontrolü ve diğer yükümlülükler kapsamda; avukat teyidi | Kesinleşti |
| 18 | Bireysel kullanıcı doğrulaması | Yalnızca telefon doğrulaması; e-Devlet yok | Kesinleşti |
| 19 | Vasıta kategorileri | 14 kategorinin tamamı ilk sürümde | Kesinleşti |
| 20 | Galeri çalışan hesapları | Birden fazla çalışan; sahip, yönetici ve satış temsilcisi rolleri; haklar ortak havuz | Kesinleşti |
| 21 | Talep oluşturma arayüzü | Adım adım sihirbaz, ilerleme çubuğu ve taslak kaydı | Kesinleşti |
| 22 | Satıcının ana sayfası | Kategori listesi ile kayıtlı arama ve eşleşmeler ayrı bölümler | Kesinleşti |
| 23 | Kategori menüsü ve genişleme | Sahibinden gibi solda dikey kategori menüsü; ileride emlak ve diğer ikinci el kategorileri aynı yapıya eklenir | Kesinleşti |
| 24 | Talepte araç görseli | Model ve kasa kuşağına göre katalogdan otomatik seçilen temsili görsel; görsel kaynağı karar bekliyor | Kesinleşti |
| 25 | Mesaj güvenliği uyarısı | Kapora, IBAN, ödeme isteği ve harici bağlantı tespiti; mesajın altında uyarı bandı | Kesinleşti |
| 26 | Galeri mesajında araç kartı | Galeriler portföydeki EİDS doğrulanmış aracı mesaja kart olarak ekleyebilir; bireysel satıcıda yasak sürer | Kesinleşti |
| 27 | Alıcıdan galeriye mesaj | Alıcı portföy aracı için galeriye ilk mesajı atabilir; ücretsiz, günlük sınırlı | Kesinleşti |
| 28 | Galeri takibi | Takip edilen galerinin talebe uyan yeni araçları günlük özetle bildirilir | Kesinleşti |
| 29 | Görünen ad ve aranabilir saatler | Tam ad veya soyadının baş harfi; saat dışında telefon ve WhatsApp gizli | Kesinleşti |
| 30 | Kayıtlı arama ve bildirimler | En fazla 10 arama; anlık, günlük özet veya kapalı; kanal bazında tercih | Kesinleşti |
| 31 | Ödeme ve hesap kapatma | Sözleşme ve cayma onayı, aracı buldum anketi, SMS onaylı hesap kapatma | Kesinleşti (avukatla gözden geçirilecek) |
| 32 | Donanım paketi ve makyaj | Katalogda paket ve makyajlı / makyajsız kasa ayrı tutulur; talep, filtre ve eşleştirmede kullanılır | Kesinleşti |
| 33 | Kendi kendini güncelleyen katalog | TSB ana kaynak, eksikler açık kaynaklardan (VehiclesDB, AB Çevre Ajansı, Wikidata), otomatik; kaynaksız kategoriler kullanıcı girişleriyle büyür; elle veri girişi ve onay yok | Kesinleşti |
| 34 | Lisanslı araç görseli | Wikimedia Commons'tan açık lisanslı gerçek fotoğraf, nesil ve makyaj başına, atfıyla; ücretsiz | Kesinleşti |
| 35 | Büyüme ve reklam ölçümü | Lansman yok; online reklam; Meta Pixel + Conversions API, izinli ölçüm | Kesinleşti |
| 36 | Maliyet ilkesi | Sabit bütçe, ekip, takvim kuralı yok; önce ücretsiz veya kredili seçenek | Kesinleşti |
| 37 | Kişisel veriler Türkiye'de | Kişisel veri işleyen sistemler Türkiye'de; diğer işler GCP kredileriyle; GCP Türkiye bölgesi açılınca taşıma | Kesinleşti |
| 38 | Mobil ödeme | Bireysel haklar mobilde App Store / Google Play, web'de PayTR; galeri aboneliği yalnızca web | Kesinleşti |
| 39 | Tüketici hakları ve platform yükümlülükleri | Onay metinleri, cayma, iade ve yayın öncesi yükümlülükler için varsayılanlar | Kesinleşti (avukatla gözden geçirilecek) |
| 40 | Çalışanlar ve yetkiler | Hazır ve özel roller, dört göz onayı, iki adımlı giriş, veri maskeleme, silinemez işlem kaydı | Kesinleşti |
| 41 | Rengarenk Ajanı | Operasyon ajanı kural içinde kendi işler, gerisini önerir; iade asla sahibin onayı olmadan yapılmaz | Kesinleşti |
| 42 | Kullanıcı tarafında yapay zekâ | Talep asistanı, ilk mesaj taslağı, mesaj güvenliği, toplu yükleme yardımı, destek sohbeti; ilk sürümde | Kesinleşti |
| 43 | Yönetim konsolunun kapsamı | 13 modül ve 10 ek başlık ilk sürümde; tasarım beş turda | Kesinleşti |
| 44 | Kontrol paneli ve raporlar | Ana ölçü ilk mesaj alan talep oranı; hedefler, neden analizi, otomatik reklam harcaması, zamanlanmış raporlar | Kesinleşti |
| 45 | Kategori ve alan yönetimi | Kategori ağacı, alan şeması, eşleştirme ağırlıkları ve kategori kuralları kodsuz ve sürümlü yönetilir | Kesinleşti |
| 46 | Görünüm ve içerik yönetimi | Ana sayfa düzeni, vitrin, bannerlar, duyurular, açılış sayfaları ve tasarım değerleri panelden; önizleme, zamanlama, sürüm | Kesinleşti |
| 47 | Genişletilebilirlik ilkesi | Kural, şema ve içerik ayar olarak tutulur; yeni modüller ortak yetki, kayıt, bildirim ve rapor altyapısına takılır | Kesinleşti |
| 48 | Bildirim katmanı ve kanallar | Tek bildirim katmanı; uygulama içi → push → e-posta → SMS sırası; tek şablondan çok kanal | Kesinleşti |
| 49 | İleti türleri, İYS ve sıklık | Ticari ileti yalnızca İYS onaylılara, kişi başı haftada en fazla 2, 21.00–09.00 arası yok; SMS ilk sürümde yalnız kod ve kritik durum | Kesinleşti |
| 50 | Kendi e-posta sunucumuz | E-postalar sağlayıcısız, Radore'deki kendi SMTP sunucumuzdan; işlemsel ve ticari ayrı alan adı ve IP; ısınma planı ve itibar izleme | Kesinleşti |
| 51 | Kampanya ve otomatik akışlar | Segment, şablon, kampanya, otomatik akış ve teslim raporu panelden; ajan önerir, toplu gönderimi başlatmaz | Kesinleşti |
| 52 | Kullanıcı ve galeri kartı | Tek ekranda tüm geçmiş, maskeli kişisel veri; uyarı, askı, hak tanımlama; başvuru kuyruğu | Kesinleşti |
| 53 | Moderasyon kuyruğu | Öncelik ve süre sınırı, maskeli kanıt, hazır gerekçeler, 7 gün itiraz hakkı ve başka moderatör incelemesi | Kesinleşti |
| 54 | Destek yalnızca yazılı | Uygulama içi sohbet ve e-posta tek kuyrukta; ilk sürümde telefon desteği yok; ajan taslak yazar | Kesinleşti |
| 55 | Satıcı puanı ve rozetler | Puan içeride hesaplanır, alıcıya yalnızca rozet görünür; alıcı yalnızca yıldız verir, yorum yok | Kesinleşti |
| 56 | Sistem ayarları | Kurallar ve fiyatlar, entegrasyonlar, özellik anahtarları, bakım modu, sistem sağlığı ve yedek tek yerde | Kesinleşti |
| 57 | Yapay zekâ bütçesi | Başlangıç sınırı aylık 150 USD; sahip panelden artırıp azaltır; %80'de uyarı, sınırda yalnız kritik görevler | Kesinleşti |
| 58 | KVKK başvuruları ve veri indirme | Başvurulara ajan taslak yazar, yanıtı insan gönderir; kullanıcı kendi verisini Ayarlar'dan indirir | Kesinleşti |
| 59 | Saklama, imha, ihlal ve VERBİS | Silmede anonimleştirme, 6 ayda bir periyodik imha, 72 saat ihlal bildirimi; VERBİS eşik altında, eşik izlenir | Kesinleşti |

## Karar 01–05: Temel yapı

- **01 Pazar modeli:** Açık pazar; bireysel kullanıcılar ve galeriler aynı platformda yer alır.
- **02 Kullanıcı hesapları:** Tek hesapla hem alıcı hem satıcı olunabilir.
- **03 Galeri hesapları:** Galeriler kurumsal hesap açar; yetki belgesi, vergi numarası ve MERSİS kontrollerinin hepsi geçerse hesap Rengarenk Ajanı tarafından onaylanır ve sahibe bildirilir; bir kontrol bile geçmezse başvuru insan incelemesine düşer (Karar 41).
- **04 Talep oluşturma:** Alıcı aradığı aracı katalog tabanlı, detaylı kriterlerle tanımlar. Talep 30 gün yayında kalır (Karar 10).
- **05 Alternatifler:** Ana araç bilgileri (marka, model vb.) sabittir; diğer tüm kriterler alternatif bazlı tanımlanabilir. Örneğin bir BMW 320i talebinde iki farklı alternatif bulunabilir.

## Karar 06: Talep keşfi, eşleşme ve bildirimler

Satıcı uygun alıcı taleplerini arayarak veya otomatik eşleşmeyle bulur ve doğrudan mesaj atar; teklif gönderme adımı yoktur.

### 6.1 Talep keşfi

- Satıcı tüm aktif alıcı taleplerini inceleyebilir.
- Filtrelerle uygun talepleri bulabilir.
- İlgilendiği talebin sahibine doğrudan mesaj atabilir (Karar 08).

### 6.2 Otomatik eşleşme

- Galeriler araç portföylerini sisteme ekler (Karar 07).
- Sistem portföydeki araçları alıcı talepleriyle karşılaştırır.
- Uygun eşleşmeler satıcıya gösterilir; satıcı eşleşme üzerinden alıcıya hızlıca mesaj atabilir.

### 6.3 Özelleştirilebilir arama

Kullanıcı gelişmiş filtrelerle arama yapabilir. Filtreler birbirine bağlı kataloglardan beslenir:

- Marka ve model
- Model yılı
- Motor ve motor kodu
- Kilometre
- Bütçe
- Yakıt ve şanzıman
- Kasa tipi
- Hasar ve kondisyon
- Konum

### 6.4 Favoriler

- Kullanıcı ilgilendiği talepleri favorilerine ekleyebilir.
- Favorileri ayrı bir ekrandan takip eder.
- Talep güncellendiğinde değişiklikleri görür.
- Pasife alınan veya kapanan taleplerin durumunu görür.

### 6.5 Bildirimler

| Olay | Kime |
| --- | --- |
| Kayıtlı aramaya uygun yeni talep | Satıcı |
| Otomatik eşleşme bulundu | Satıcı (galeri) |
| Favori talep güncellendi | Favoriye ekleyen |
| Favori talep pasife alındı veya kapandı | Favoriye ekleyen |
| Yeni mesaj geldi | Alıcı ve satıcı |

Bildirim kanalları ileride uygulama içi, push ve e-posta olarak yapılandırılabilir.

## Karar 07: Galeri araç portföyü

Kurumsal hesaplı galeriler araçlarını üç yöntemle sisteme aktarır; portföy otomatik eşleşmenin (6.2) kaynağıdır. Portföydeki araçlar fotoğraf ve fiyatlarıyla galeri profilinde alıcılara da gösterilir.

1. **Manuel ekleme**
   1. Araç kaydını tek tek oluşturma, özellikleri kataloglardan seçme
   2. Fotoğraf, fiyat ve açıklama girme
   3. Kaydı düzenleme ve pasife alma
2. **Excel / CSV ile toplu yükleme**
   1. Hazır şablonu indirme
   2. Aktarım öncesi önizleme ve onay
   3. Hatalı satırların raporlanması ve eksik bilgilerin tamamlanması
3. **API entegrasyonu**
   1. Galerinin mevcut stok sisteminden araç aktarımı
   2. Stok, fiyat ve araç durumu senkronizasyonu

## Karar 08: İletişim modeli

Satıcı teklif göndermez; alıcının talebine doğrudan mesaj atarak iletişime geçer, sonrası taraflar arasındadır.

### 8.1 Satıcının iletişime geçmesi

- Satıcı uygun talebi bulduğunda talep sahibine mesaj atar (ör. "Aradığınız araç elimde bulunuyor").
- Teklif formu, satış fiyatı alanı veya araç seçme adımı yoktur.

### 8.2 Fiyatlandırma

- Fiyatı yalnızca alıcı belirler: talebinde bütçesini ve alternatiflerin fiyat aralığını girer.
- Satıcı tarafında fiyat alanı yoktur; fiyat konuşması mesajda veya telefonda yapılır.
- Araç bedeli için platformda ödeme, kapora, pazarlık mekanizması veya açık artırma bulunmaz; tahsil edilen tek ücret platform hizmetleridir (Karar 12).

### 8.3 İletişim kanalları

- **Uygulama içi mesajlaşma:** Yalnızca metin; fotoğraf veya dosya gönderimi yoktur. Tek istisna, galerilerin portföylerindeki EİDS doğrulanmış bir aracı araç kartı olarak ekleyebilmesidir (Karar 26).
- **Telefon numarası:** Alıcı telefonla iletişime izin verdiyse talep sayfasındaki iletişim kutusunda görünür (11.4); taraflar telefonla görüşüp anlaşır.
- **WhatsApp:** Telefon numarası görünen taleplerde "WhatsApp'tan yaz" butonu sohbeti doğrudan WhatsApp'ta açar.

### 8.4 Platformun sorumluluk sınırı

Platform talep yayınlar, talep ile satıcıyı eşleştirir ve iletişimi sağlar. Araç satışı, ödeme, ekspertiz ve devir işlemleri tarafların kendi sorumluluğundadır.

## Karar 09: Alıcı talebi yönetimi

Alıcı yayındaki talebi üzerinde dört ayrı işlem yapabilir; her biri farklı bir sonuç doğurur.

| İşlem | Ne zaman | Sonuç |
| --- | --- | --- |
| Düzenle | Kriter, bütçe, alternatif veya açıklama değiştiğinde | Talep yayında kalır, favoriye ekleyenlere bildirim gider |
| Pasife al | Aramaya geçici ara verildiğinde | Talep silinmeden yayından kalkar, sonra yeniden aktif edilebilir |
| Kapat | Artık araç aranmadığında | Talep sonlanır |
| Aracı buldum | Araç bulunduğunda | Talep "tamamlandı" olarak kapanır |

Pasife almak ile aracı bulup tamamlamak ayrı durumlardır; satıcılar güncel olmayan taleplere boşuna yazmaz.

## Karar 10: Talep yayın süresi

Süresi dolan talep silinmez; otomatik pasife alınır ve alıcı tek dokunuşla süreyi uzatarak yeniden yayına alabilir.

1. Talep yayına girdiği andan itibaren 30 gün yayında kalır.
2. Bitişten 7, 3 ve 1 gün önce alıcıya hatırlatma bildirimi gider.
3. Süre dolunca talep yayından kalkar ve "Pasif" durumuna geçer; satıcılar artık mesaj atamaz.
4. Alıcıya "süreyi uzat" bildirimi gider; uzatırsa talep aynı içerikle yeniden yayına girer.
5. Talep geçmişi ve mesajlar korunur; favoriye ekleyenler talebin pasife alındığını görür (6.4).

Talep 1 kez ücretsiz uzatılabilir, sonraki uzatmalar ücretlidir (12.1). Uzatılan talep yeniden 30 gün yayında kalır.

## Karar 11: Mesaj kontrolü ve iletişim kutusu

Satıcı bir talebe yalnızca bir ilk mesaj atabilir; günlük limit ve engelle/şikayet araçları alıcıyı toplu mesajdan korur.

### 11.1 Tek ilk mesaj

- Satıcı her talebe yalnızca bir ilk mesaj gönderebilir.
- Alıcı yanıtlarsa sohbet açılır ve iki taraf serbestçe yazışır.
- Alıcı yanıtlamazsa satıcı aynı talebe tekrar yazamaz.

### 11.2 Günlük ilk mesaj limiti

- Bireysel kullanıcı günde 5 farklı talebe ücretsiz ilk mesaj atabilir; sonrası ücretlidir (Karar 12).
- Galerilerin günlük ilk mesaj hakkı paketlerine göre daha yüksektir.
- Açılmış bir sohbette yazışmak bu hakkı tüketmez.

### 11.3 Engelle ve şikayet et

- Alıcı istediği satıcıyı engelleyebilir; engellenen satıcı o alıcıya mesaj atamaz.
- Alıcı mesajı şikayet edebilir; şikayet yönetici incelemesine düşer.

### 11.4 Talep sayfası iletişim kutusu

sahibinden.com'daki gibi talep sayfasının sağ tarafında talep sahibinin iletişim kutusu yer alır:

- Alıcının adı soyadı
- "Mesaj at" butonu
- Telefon numarası ve "WhatsApp'tan yaz" butonu: yalnızca alıcı telefonla iletişime izin verdiyse görünür

## Karar 12: Gelir modeli ve kotalar

Platform kota bazlı çalışır: bireysel kullanıcı sınırlı ücretsiz hakla başlar, galeriler aylık paket öder, ek haklar ve öne çıkarma ücretlidir.

| Hak | Bireysel kullanıcı | Galeri (kurumsal) |
| --- | --- | --- |
| Hesap doğrulama | Telefon numarasıyla | Otomatik kontrol ve ajan onayı (Karar 03, 41) |
| Talep açma | Telefon numarası başına 1 ücretsiz; sonrakiler ücretli | Aylık pakete göre |
| Günlük ilk mesaj | 5 farklı talep ücretsiz; sonrası ücretli | Pakete göre, bireyselden yüksek |
| Öne çıkarma | Ücretli | Ücretli |
| Ödeme şekli | Kullandıkça öde | Aylık abonelik |

- Ücretsiz talep hakkı hesaba değil doğrulanmış telefon numarasına bağlıdır; yeni hesap açmak hakkı yenilemez.
- Ücretli öne çıkarma, talebin satıcıların listelerinde ve aramalarında üstte görünmesini sağlar.

### 12.1 Talep süresinin uzatılması

- Her talep süresi dolduğunda 1 kez ücretsiz uzatılabilir; sonraki uzatmalar ücretlidir.
- Böylece tek ücretsiz talep hakkı süresiz kullanılamaz.

### 12.2 Galeri paketleri

Paketler Karar 07'deki özellikleri kademeli açar. Fiyatlar aylık ve KDV hariçtir; yıllık ödemede 2 ay ücretsizdir. Profesyonel paket, sahibinden.com'daki 10 araçlık galeri paketinin (kullanıcı şikayetlerine göre Kasım 2026 itibarıyla aylık yaklaşık 16.400 TL) beşte biri civarındadır.

| Özellik | Başlangıç | Profesyonel | Kurumsal |
| --- | --- | --- | --- |
| Aylık fiyat (KDV hariç) | 1.490 TL | 3.490 TL | 7.490 TL |
| Yıllık fiyat (KDV hariç) | 14.900 TL | 34.900 TL | 74.900 TL |
| Portföy araç limiti | 25 | 100 | Sınırsız |
| Günlük ilk mesaj hakkı | 20 | 50 | 150 |
| Aylık talep açma hakkı | 2 | 5 | 15 |
| Aylık öne çıkarma hakkı (7 gün üst sıra) | Yok | 2 | 5 |
| Manuel portföy | Var | Var | Var |
| Excel/CSV toplu yükleme | Yok | Var | Var |
| Otomatik eşleşme | Yok | Var | Var |
| API entegrasyonu | Yok | Yok | Var |
| Çalışan kullanıcı sayısı (Karar 20) | 2 | 5 | 15 |

### 12.3 Hakların yenilenmesi

- Galerilerin aylık hakları fatura döneminin sonunda sıfırlanır; kullanılmayan haklar devretmez.
- Bireysel kullanıcının günlük 5 ücretsiz mesaj hakkı her gece 00:00'da (Türkiye saati) yenilenir.

### 12.4 Tek seferlik ek paketler

- Bireysel kullanıcı ücretli hakları paket halinde satın alabilir (ör. 10 ek mesaj, 3 talep hakkı).
- Galeriler paket limitini aştığında ay sonunu beklemeden ek paket alabilir.

### 12.5 Galeri deneme süresi

- Hesap onaylandıktan sonra galeriye 30 günlük ücretsiz deneme tanınır.
- Deneme Profesyonel paketin özelliklerini açar ama hakları sınırlıdır: 15 portföy aracı, günde 10 ilk mesaj, 1 talep hakkı; öne çıkarma ve API yoktur.
- Deneme için kart bilgisi istenmez ve deneme bitince otomatik ücretli pakete geçilmez.
- Bitişten 7, 3 ve 1 gün önce galeriye paket seçme hatırlatması gider; paket seçmeyen galeri yalnızca portföyünü görüntüleyebilir.

### 12.6 Öne çıkarma seçenekleri

| Seçenek | Etkisi |
| --- | --- |
| Üst sıra | Talep, satıcıların listelerinde ve aramalarında üstte görünür |
| "Acil arıyorum" etiketi | Talep kartında dikkat çeken etiket görünür |
| Ana sayfa vitrini | Talep ana sayfadaki vitrin alanında gösterilir |

Her seçenek ayrı fiyatlı ve süreli satılır; fiyatlar 12.8'dedir.

### 12.7 Ödeme altyapısı

- Hizmet ücretleri web'de PayTR, uygulamalarda App Store ve Google Play üzerinden tahsil edilir (Karar 38).
- Galeri abonelikleri otomatik yenilenir; başarısız ödemede galeriye bildirim gider.
- Tüm satışlar için e-fatura / e-arşiv fatura kesilir.

### 12.8 Bireysel hizmet ve öne çıkarma fiyatları

Bireysel fiyatlar KDV dahildir; galerilere aynı tutarlar KDV hariç faturalanır. Karşılaştırma için sahibinden.com'da bireysel otomobil ilanı 2026'da 30 gün için birkaç bin TL'dir ([kullanıcı şikayetleri](https://www.sikayetvar.com/sahibinden/fiyat/paket)).

| Hizmet | Süre / miktar | Fiyat |
| --- | --- | --- |
| Ek talep | 1 talep, 30 gün | 199 TL |
| Talep paketi | 3 talep | 499 TL |
| Ücretli uzatma (ücretsiz uzatmadan sonra) | 30 gün | 99 TL |
| Ek mesaj paketi | 10 ilk mesaj, 30 gün geçerli | 99 TL |
| Ek mesaj paketi | 30 ilk mesaj, 30 gün geçerli | 249 TL |
| Üst sıra | 7 gün | 149 TL |
| Üst sıra | 30 gün | 449 TL |
| "Acil arıyorum" etiketi | 7 gün | 79 TL |
| Ana sayfa vitrini | 7 gün | 299 TL |

### 12.9 Fiyat güncelleme kuralı

- Ekim 2026'da yıllık TÜFE %29,77, aylık %2,58'dir ([TÜİK verisi, Timeturk](https://www.timeturk.com/2026-ekim-enflasyonu-aciklandi-tufe-aylik-258-yillik-2977)).
- Fiyatlar yılda iki kez, Ocak ve Temmuz'da, son 6 ayın gerçekleşen TÜFE'si oranında güncellenir ve 90 / 99 ile biten tutarlara yuvarlanır.
- Aylık abonelere zam 30 gün önceden bildirilir; yıllık ödeyenlerin fiyatı dönem sonuna kadar sabittir.
- Fiyatlar yönetim panelinden değiştirilir (13.3).

### 12.10 Maliyet ve başabaş

- PayTR'nin yeni üyeler için sanal POS komisyonu %2,19'dan başlar ([karekod.org, Eylül 2026](https://www.karekod.org/blog/sanal-pos-komisyon-oranlari/)); bu, Profesyonel paketten yaklaşık 76 TL eder.
- Bir galeri veya talebin değişken maliyeti (SMS, depolama, bildirim) düşük olduğundan asıl belirleyici sabit giderlerdir (ekip, sunucu, pazarlama).
- Örnek: aylık 500.000 TL sabit giderde başabaş için komisyon sonrası yaklaşık 3.413 TL bırakan Profesyonel paketten 147 adet (veya eşdeğer gelir) gerekir. Gerçek sabit gider netleşince bu hesap güncellenmeli.

## Karar 13: Yönetim paneli ve moderasyon

Platform tam bir yönetim paneliyle yönetilir; paketler, kotalar ve katalog kod değişikliği olmadan panelden güncellenir.

### 13.1 Hesap onayı ve kullanıcı yönetimi

- Galeri başvurularını inceleme, onaylama ve gerekçeyle reddetme (Karar 03)
- Kullanıcıyı uyarma, geçici veya kalıcı engelleme
- Kullanıcının talep, mesaj, şikayet ve ödeme geçmişini görüntüleme

### 13.2 Moderasyon ve içerik denetimi

- Şikayet kuyruğu: şikayet edilen mesaj ve talepleri inceleme, sonuçlandırma (11.3)
- Talep ve mesajlarda yasaklı kelime filtresi
- Mesajlarda telefon numarası paylaşımının otomatik tespiti; telefon izni vermeyen alıcılara numara isteme veya paylaşma ile kota dolanılmasını engeller
- Talep veya mesajı yayından kaldırma
- Filtre kuralları panelden yönetilir

### 13.3 Paket, kota ve öne çıkarma yönetimi

- Galeri paketlerinin hak, özellik ve fiyatlarını düzenleme (12.2)
- Bireysel ücretsiz kotaları ve ek paket fiyatlarını düzenleme (12.4)
- Öne çıkarma seçeneklerinin fiyat ve sürelerini düzenleme (12.6)
- Deneme süresini ayarlama (12.5)

### 13.4 Ödeme ve fatura takibi

- Abonelik, tek seferlik satın alma ve iade kayıtları
- Başarısız ödemeler ve askıya alınan abonelikler
- Kesilen e-fatura / e-arşiv faturaların takibi (12.7)

### 13.5 Katalog yönetimi

- Katalog kendi kendini günceller; panel kaynak durumunu, otomatik eklenenleri ve kendiliğinden çözülen durumları gösterir, işlem gerektirmez (Karar 33)
- Bir kaynak 48 saat güncellenmezse yöneticiye e-posta uyarısı gider

### 13.6 Raporlar

- Aktif, pasif ve tamamlanan talep sayıları
- Gönderilen mesaj ve açılan sohbet sayıları
- Gelir: paket, ek paket ve öne çıkarma kırılımında
- Şikayet ve engelleme istatistikleri

## Karar 14: Platformlar

Web, iOS ve Android uygulamaları aynı anda, ortak bir arka uç üzerinden yayına çıkar.

| Platform | Öncelikli kullanıcı | Öne çıkan işler |
| --- | --- | --- |
| Web | Galeriler, yöneticiler, masaüstü kullanıcılar | Portföy yönetimi, Excel/CSV yükleme, yönetim paneli, talep arama |
| iOS / Android | Bireysel alıcılar ve satıcılar | Talep açma, mesajlaşma, push bildirimleri, favoriler |

- Mobil uygulamalar React Native (Expo) ile tek kod tabanından geliştirilir (Karar 16).
- Tüm platformlar aynı API'yi kullanır; kotalar, mesajlar ve bildirimler platformlar arasında senkron çalışır.
- Yönetim paneli (Karar 13) yalnızca web üzerinden erişilir.

* **Tasarım yönü:** Kullanıcılar alıştığı için yerleşim ve akışlar sahibinden.com'a benzer olacak; görünüm daha güncel ve renk paleti farklı olacak. Çalışma adı "Rengarenk" (rengarenksite); palet açık ve canlı tonlardan oluşur, koyu tonlar kullanılmaz. Seçilen palet Gökkuşağı: ana renk mavi #5B8CFF, eşlik eden pembe #FF6FB5, sarı #FFC84A ve yeşil #3DD68C; yazılar okunurluk için koyu gri (#1E2333).

Ana akışlar ve ekran listesi ayrı sekmede: Kullanıcı akışları

## Karar 15: İlk sürüm kapsamı

Karar 01–14'ün tamamı ilk sürümde, fazlara bölünmeden yayına çıkar; web, iOS ve Android aynı anda açılır.

- Otomatik eşleşme, Excel/CSV yükleme, öne çıkarma, favoriler, bildirimler, raporlar ve tam yönetim paneli lansmanda hazır olur.
- Galeri API entegrasyonu da ilk sürüme dahildir (Karar 07'de önceden ileriki sürüm olarak planlanmıştı).

## Karar 16: Teknoloji yığını

Web, mobil ve arka uç tek bir TypeScript monorepo'sunda geliştirilir; tüm istemciler aynı API sözleşmesini kullanır ve yatay ölçeklenen bir altyapıda çalışır.

### 16.1 Web ve mobil uyumu

- **Web: Next.js (React, TypeScript).** Talep sayfaları ve galeri profilleri sunucu tarafında oluşturulur; arama motorlarında görünür ve hızlı açılır.
- **Mobil: React Native + Expo.** Web ile aynı dil ve React yaklaşımı; iOS ve Android tek kod tabanından çıkar, uygulama mağazası beklemeden güncelleme (OTA) yapılabilir.
- **Ortak paketler:** API istemcisi, tipler, form doğrulama kuralları (Zod), kota ve fiyat hesapları, tasarım değişkenleri web ve mobilde aynı kodu kullanır.
- **Uyum kuralı:** Her özellik web ve mobilde aynı anda yayına çıkar; tek istisna yönetim panelidir (yalnızca web).
- Flutter, web tarafında arama motoru görünürlüğü zayıf olduğu ve Next.js ile kod paylaşamadığı için seçilmedi.

### 16.2 Arka uç ve veri

| Katman | Teknoloji | Görevi |
| --- | --- | --- |
| API | NestJS (TypeScript), REST + OpenAPI | Tek API; istemci kodu OpenAPI'den otomatik üretilir |
| Ana veritabanı | PostgreSQL (birincil + okuma replikaları) | Kullanıcı, talep, portföy, ödeme kayıtları |
| Önbellek ve sayaçlar | Redis | Oturum, günlük kota sayaçları, hız sınırlama |
| Arama ve eşleşme | OpenSearch | Filtreli talep araması; percolator ile portföy aracı–talep otomatik eşleşmesi |
| Gerçek zamanlı mesaj | WebSocket (Redis yayın katmanıyla) | Anlık mesajlaşma, birden çok sunucuda |
| Kuyruk | RabbitMQ | Bildirim, eşleşme, hatırlatma ve fatura işleri |
| Bildirim | FCM + APNs, e-posta | Push ve e-posta bildirimleri |
| Dosya | S3 uyumlu nesne depolama + CDN | Portföy fotoğrafları, otomatik boyutlandırma |
| Dış servisler | PayTR, yerli SMS sağlayıcısı, e-fatura entegratörü | Ödeme, telefon doğrulama, fatura |

### 16.3 Ölçeklenme ve işletim

- Kubernetes üzerinde, trafiğe göre otomatik yatay ölçeklenen servisler.
- Mesajlaşma ve eşleşme yük altında ayrı servis olarak ölçeklenebilecek şekilde modüler yazılır.
- İzleme: Prometheus + Grafana, OpenTelemetry ile dağıtık izleme, Sentry ile hata takibi.
- Barındırma: kişisel veriyi işleyen API, veritabanı ve kuyruklar Türkiye'deki bir sağlayıcıda (k3s); CI/CD, staging ve kişisel veri içermeyen işler GCP kredileriyle. GCP Türkiye bölgesi açılınca üretim oraya taşınır (Karar 37).
- CI/CD: her değişiklik web, mobil ve API için otomatik test ve dağıtım hattından geçer.

## Araç kataloğu (öneri, görüşülecek)

Katalog sahibinden.com'un otomobil şablonunu temel alır; omurga TSB Kasko Değer Listesi, motor kodu ve teknik veriler ise ayrı bir sağlayıcıdan gelir. Motor kodu zorunlu değil, isteğe bağlıdır.

### Sahibinden'in otomobil yapısı (referans)

Sahibinden ve arabam.com otomatik erişimi engellediği için yapı canlı siteden doğrulanamadı; sahibinden'in bilinen ilan şablonuna dayanır ve tasarım aşamasında kontrol edilmelidir.

- **Kategoriler:** Vasıta altında ayrı kategoriler vardır: Otomobil; Arazi, SUV & Pickup; Elektrikli Araçlar; Minivan & Panelvan; Ticari Araçlar; Motosiklet; Hasarlı Araçlar; Klasik Araçlar.
- **Hiyerarşi:** Marka > Seri > Model; model adı motor ve donanımı birlikte taşır (ör. Volkswagen > Golf > 1.6 TDI Highline).
- **Motor kodu:** Sahibinden'de alan olarak yoktur; bizde fark yaratan ama isteğe bağlı bir alan olur.

| Alan | Sahibinden'deki değerler | Alıcı talebinde | Galeri portföyünde |
| --- | --- | --- | --- |
| Marka / Seri / Model | Katalogdan | Ana araç (sabit, Karar 05) | Katalogdan |
| Yıl | Tek değer | Aralık | Tek değer |
| Yakıt | Benzin, Dizel, LPG & Benzin, Hibrit, Elektrik | Çoklu seçim | Tek değer |
| Vites | Manuel, Otomatik, Yarı otomatik | Çoklu seçim | Tek değer |
| Araç durumu | İkinci el, Sıfır | Çoklu seçim | Tek değer |
| Kilometre | Sayı | Üst sınır | Sayı |
| Kasa tipi | Sedan, Hatchback 5 kapı, Hatchback 3 kapı, Station wagon, Coupe, Cabrio, MPV vb. | Çoklu seçim | Tek değer |
| Motor gücü | hp aralıkları | Aralık | Sayı |
| Motor hacmi | cm³ aralıkları | Aralık | Sayı |
| Çekiş | Önden çekiş, Arkadan itiş, 4x4 | Çoklu seçim | Tek değer |
| Renk | Renk listesi | Çoklu seçim | Tek değer |
| Garanti | Var / Yok | İstiyor / fark etmez | Var / Yok |
| Ağır hasar kaydı | Evet / Hayır | Kabul eder / etmez | Evet / Hayır |
| Boya / değişen | Parça bazında durum | Parça bazında kabul düzeyi (orijinal olmalı / lokal boya / boya / değişen kabul) ve toplam parça sınırı | Parça bazında durum |
| Tramer tutarı | Tutar | Üst sınır | Tutar |
| Plaka / uyruk | Türkiye plakalı, yabancı plakalı | Tercih | Tek değer |
| Kimden | Sahibinden, Galeriden, Yetkili bayiden | Tercih | Hesap türünden otomatik |
| Takas | Evet / Hayır | Alıcının takasa vereceği araç var mı | Takas kabul eder mi |
| Donanım | Güvenlik, iç, dış, multimedya listeleri | Olmazsa olmaz donanımlar | Donanım listesi |
| Motor kodu | Yok | İsteğe bağlı | İsteğe bağlı |
| Şasi işlemi | — | Kabul eder / etmez | Var / Yok |
| Podye işlemi | — | Kabul eder / etmez | Var / Yok |
| Airbag açılmış | — | Kabul eder / etmez | Evet / Hayır |
| Teknik özellikler | İlan detayında | Katalogdan otomatik gösterilir (motor, güç, tork, şanzıman, çekiş, performans, tüketim, ölçüler) | Katalogdan otomatik |

Boya/değişen parçaları sahibinden şemasındaki gibi 13 parçadır: ön tampon, motor kaputu, tavan, arka kaput, arka tampon, sağ ve sol ön çamurluk, sağ ve sol ön kapı, sağ ve sol arka kapı, sağ ve sol arka çamurluk. Her parça için durumlar: orijinal, lokal boyalı, boyalı, değişmiş.

Talepte aralık ve çoklu seçim, portföyde tek değer kullanılması otomatik eşleşmeyi (6.2) doğrudan mümkün kılar: her portföy aracı talebin aralıklarına düşüp düşmediğine göre eşleşir.

Talep sayfasında boya ve değişen kriterleri sahibinden'deki gibi üstten görünüm bir araç şeması üzerinde, 13 parçanın her biri kabul düzeyine göre renklendirilerek gösterilir; şasi, podye, airbag ve ağır hasar kriterleri ayrı bir "Hasar geçmişi" bölümünde yer alır. Bu alanlar otomatik eşleşmede kesin koşul olarak kullanılır: ör. şasi işlemini kabul etmeyen talep, şasi işlemli portföy aracıyla eşleşmez.

### Veri kaynakları

Türkiye için lisansla alınabilecek, motor kodunu da içeren hazır bir katalog bulunamadı; sahibinden ve arabam.com'un katalog kaynağına dair kamuya açık bilgi yok.

| Kaynak | İçerik | Motor kodu | Maliyet ve lisans |
| --- | --- | --- | --- |
| [TSB Kasko Değer Listesi](https://www.tsb.org.tr/en/casco-value-list) | Marka kodu, tip kodu, model yılı, değer; 15 model yaşına kadar; aylık Excel | Yok; motor ve donanım tip adının içinde metin olarak | Ücretsiz yayımlanıyor; ticari kullanım için TSB'den yazılı izin gerekli (doğrulanmadı) |
| [auto-data.net API](https://api.auto-data.net) | 350+ marka, 55.000+ versiyon, Türkçe dahil | Var; yerli ve elektrikli modellerde eksik (ör. Togg) | Parametre başına teklif |
| TecDoc / TecAlliance | Yedek parça kataloğu, araç tipine bağlı | Var | Hacme göre yıllık sözleşme, ağır lisans |
| [Cardata](https://tr.motor1.com/news/706328/cardata-chatgpt-fiyat-sorgulama/) | Yerli; marka/model, donanım, teknik veri, ikinci el fiyatı; 29 sigorta şirketi ve 1.200 galeriyle çalışıyor | Belirsiz | Teklif usulü; API ve fiyat bilgisi yok |
| JATO, Eurotax/Autovista, DAT | Kurumsal teknik veri | Belirsiz | Teklif usulü; Türkiye kapsamı belirsiz |
| [EİDS (Ticaret Bakanlığı)](https://www.alomaliye.com/2026/01/27/tasit-ilanlarinda-eidsye-entegre-olan-firmalara-iliskin-duyuru/amp/) | Plakadan marka, ticari ad, model yılı | Yok | Katalog değil; portföy kaydını doğrulama sinyali |

### Önerilen strateji

1. **Omurga:** TSB listesi kanonik kaynak olur; TSB marka/tip kodu her model kaydının anahtarıdır. Tip adı ayrıştırılarak seri, model/donanım, motor hacmi, yakıt ve vites alanları çıkarılır.
2. **Zenginleştirme:** Güç, motor hacmi, yakıt, kasa, nesil ve makyaj açık kaynaklardan (AB Çevre Ajansı, Wikidata, VehiclesDB, vehicle-makes-models) alınır; TSB kayıtlarıyla marka, model, yıl, motor hacmi, güç ve yakıt üzerinden eşleştirilir. Motor kodu açık kaynaklarda çoğunlukla yoktur ve isteğe bağlı kalır.
3. **Güncelleme:** TSB listesi her ay, kasa ve teknik veri her gece otomatik çekilir; yeni ve değişen tipler kurallarla eşleştirilip onay beklemeden yayına girer (Karar 33).
4. **Eksik modeller:** "Listede yok" seçeneği kaldırıldı. Otomatik kaynağı olmayan kategorilerde kullanıcı ve galeri girişleri yapılandırılmış alanlarla kaydedilir ve aynı model birkaç kez girilince kataloğa kendiliğinden eklenir. 15 yaşından eski araçlar TSB arşivleri ve açık kaynaklarla korunur.
5. **Galeri yüklemeleri:** Excel/CSV/API ile gelen satırlar yaklaşık eşleştirmeyle kataloğa otomatik bağlanır; bağlanamayan alanlar galeriye satır hatası olarak gösterilir. EİDS'ten gelen plaka verisi eşleşmeyi doğrular.
6. **Eşleşme kuralı:** Otomatik eşleşme motor hacmi, güç, yakıt ve vites üzerinden yapılır; motor kodu yalnızca "tam eşleşme" sinyali olarak kullanılır.

### Bu bölümde karar bekleyenler

- TSB'den yazılı ticari kullanım izni (katalog kurulduktan sonra resmî kanaldan istenecek; Karar 33)

## Güvenlik ve dolandırıcılık önlemleri (öneri, görüşülecek)

Ters yönlü modelde asıl risk, talebini ve telefonunu açan alıcının sahte satıcıların doğrudan hedefi olmasıdır. Ayrıca galeri portföyünü fotoğraf ve fiyatla gösterdiğimiz için yasal olarak büyük olasılıkla "ilan platformu" sayılıyoruz ve bu yeni yükümlülükler getiriyor.

### En ilgili dolandırıcılık türleri

| Tür | Nasıl işliyor | Bizim için risk |
| --- | --- | --- |
| Kapora / sahte araç | Piyasanın yaklaşık %20 altında hayali araç, "başka alıcı var" baskısıyla kapora | Çok yüksek: sahte satıcı talebe doğrudan yazar |
| İlan kopyalama (sazan sarmalı) | Gerçek aracın fotoğraflarıyla ucuz sahte teklif, gerçek sahip ile alıcı buluşturulur, para dolandırıcıya gider | Çok yüksek: galeri fotoğrafları kopyalanabilir |
| "Ödeme iste" tuzağı | "Kapora gönderiyorum" denip bankanın ödeme isteme özelliğiyle para çekilir; sahte noter araması | Yüksek: telefonunu açan alıcı hedef |
| Oltalama bağlantıları | WhatsApp/SMS ile sahte "güvenli ödeme" sayfası | Yüksek: konuşma platform dışına çıkınca başlar |
| Sahte galeri | Kurumsal görünen sahte hesaplar | Yüksek: "galeri" rozeti değerli hedef |
| Sahte ekspertiz, km düşürme, ikiz araç | Sahte rapor, oynanmış km, hasarlı ikiz aracın teslimi | Orta: satış aşamasında, galeri envanteriyle ilgili |

Noterde Güvenli Ödeme Sistemi (GÖS) 27 Eylül 2024'ten beri zorunlu olduğu için satış bedeli bloke hesaptan geçer; kalan risk noterden önce ödenen kapora ve ön ödemelerdir.

### Yasal yükümlülükler

Motorlu Kara Taşıtları Ticareti Hakkında Yönetmelik, araç satış ilanına elektronik ortam sağlayan herkesi "ilan platformu" sayar ([Lexpera](https://www.lexpera.com.tr/mevzuat/yonetmelikler/motorlu-kara-tasitlarinin-ticareti-hakkinda-yonetmelik-1)). Kapsamda olup olmadığımız avukatla netleştirilmeli.

| Madde | Yükümlülük | Bizdeki karşılığı |
| --- | --- | --- |
| m.22/a | İşletmeyi üye yapmadan önce yetki belgesini Bakanlık sisteminden kontrol etmek | Galeri onayına (Karar 03) eklenir |
| m.22/b | İlan veren gerçek kişinin ad, soyad, TCKN ve telefonunu doğrulamak; yılda bir yenilemek; 5 yıl saklamak | Şu an yalnızca telefon doğrulaması var (Karar 12) |
| m.22/ç | Yayından önce aracın sahipliğini veya yetkiyi EİDS üzerinden doğrulamak | Portföy araçları için EİDS entegrasyonu |
| m.22/d | İnternet ve telefon üzerinden müşteri hizmeti | Destek kanalı kapsama eklenmeli |
| m.21 | Galeri ilanında yetki belgesi numarası ve işletme adı; satılan araç hemen kaldırılmalı | Galeri profili ve portföy |
| m.16 | 8 model yaşı ve 160.000 km altındaki otomobillerde satıştan önceki 10 günde ekspertiz raporu | Portföye ekspertiz yükleme alanı |
| Geçici m.2 | Galeriler tescilden sonra 6 ay / 6.000 km dolmadan satamaz; ikinci el araç üretici fiyatının üzerinde ilana konamaz (1 Ocak 2027'ye uzatıldı, [TRT](https://www.trthaber.com/haber/gundem/6-ay-6-bin-km-kurali-2027ye-kadar-uzatildi-948930.html)) | Portföy girişinde kontrol |

Alıcının yayınladığı talep bir satış ilanı değildir; satıcı mesajlarında fotoğraf olmaması (8.3) da bu ayrımı korur. Yükümlülüklerin asıl kaynağı galeri portföyünün alıcılara gösterilmesidir.

### Önerilen önlemler

| Alan | Önlem | Efor |
| --- | --- | --- |
| Hesap ve kimlik | e-Devlet ile kimlik doğrulama rozeti; ilan veren için TCKN doğrulaması | Orta |
| Hesap ve kimlik | Yeni hesaplara ilk günlerde daha düşük mesaj limiti | Düşük |
| Hesap ve kimlik | Sanal ve yabancı numaraları işaretleme | Düşük |
| Galeri doğrulama | Yetki belgesi, MERSİS ve vergi kontrolü, hepsi geçerse ajan onayı, aksi hâlde insan incelemesi | Orta |
| Galeri doğrulama | Profilde yetki belgesi numarası ve işletme adı | Düşük |
| Galeri doğrulama | Adres için görüntülü veya fiziksel doğrulama | Orta |
| Mesaj güvenliği | IBAN, "kapora", "ödeme iste" ve harici bağlantı tespiti; mesajın üstünde uyarı bandı | Orta |
| Mesaj güvenliği | Bilinmeyen alan adlarını ve kısaltılmış bağlantıları engelleme | Orta |
| Mesaj güvenliği | Telefon ve WhatsApp varsayılan olarak gizli (zaten Karar 11) | Düşük |
| Portföy | EİDS ile sahiplik/yetki doğrulaması | Yüksek |
| Portföy | Fotoğrafların kopya tespiti (benzer görsel eşleştirme) | Orta |
| Portföy | Ekspertiz raporu yükleme; şasi/plaka eşleşmesi; satılan aracın kaldırılması | Orta |
| Kullanıcı eğitimi | İlk mesajda "Noterden önce kapora ödemeyin, ödeme GÖS ile yapılır" kartı | Düşük |
| Kullanıcı eğitimi | Resmi kanalları duyurma: tanımlı SMS gönderen adı, WhatsApp destek hattı olmadığı | Düşük |
| Moderasyon | Mesaj içinden tek dokunuşla şikayet; telefon ve e-posta desteği | Düşük |
| Moderasyon | Şüpheli hesabı askıya alma, geri açmak için e-Devlet girişi | Orta |
| Veri sinyalleri | Fiyat anomalisi, çoklu hesap tespiti (cihaz, IP), metin kalıpları ve şikayet geçmişiyle risk skoru | Orta–Yüksek |

### Bu bölümde karar bekleyenler

- Mesaj içi kapora / IBAN / bağlantı uyarısı ilk sürümde (Karar 25); diğer önlemlerden hangilerinin ilk sürümde olacağı karar bekliyor.

## Karar 17: Portföy görünürlüğü ve ilan platformu yükümlülükleri

Galeri portföyü fotoğraf ve fiyatıyla alıcılara gösterilmeye devam eder; bu nedenle platform ilan platformu yükümlülüklerini ilk sürümden itibaren karşılar. Kapsam avukata teyit ettirilir.

- Portföydeki her araç yayına girmeden EİDS ile sahiplik veya yetki doğrulamasından geçer.
- Galeri üyeliğinden önce yetki belgesi Bakanlık sisteminden kontrol edilir (Karar 03'e eklenir).
- Galeri profilinde ve portföy araçlarında yetki belgesi numarası ve işletme adı görünür.
- Satılan araç portföyden hemen kaldırılır.
- Portföy girişinde ekspertiz raporu alanı, 6 ay / 6.000 km kontrolü ve üretici fiyatı üst sınırı kontrolü bulunur.
- İnternet ve telefon üzerinden müşteri hizmeti sunulur.

## Karar 18: Bireysel kullanıcı doğrulaması

Bireysel kullanıcılar yalnızca telefon numarasıyla doğrulanır; e-Devlet veya TCKN doğrulaması istenmez.

- Bireysel kullanıcılar portföy veya satış ilanı yayınlamaz; talep açar ve mesaj atar. Bu yüzden yönetmeliğin ilan verene yönelik TCKN doğrulama yükümlülüğü (m.22/b) doğmaması beklenir; avukata teyit ettirilir.
- Bu ayrımı korumak için bireysel satıcı mesajlarında fotoğraf ve araç kartı gönderimi yasak kalır (8.3).

## Karar 19: Vasıta kategorileri

İlk sürümde 14 vasıta kategorisinin tamamı açılır: Otomobil; Arazi, SUV & Pickup; Elektrikli Araçlar; Motosiklet; Minivan & Panelvan; Ticari Araçlar; Kiralık Araçlar; Deniz Araçları; Hasarlı Araçlar; Karavan; Klasik Araçlar; Hava Araçları; ATV; UTV.

Kategori bazında alan şemaları, veri kaynakları ve yasal farklılıklar ayrı sekmede: Kategori şemaları

- Hava Araçları talepleri 30 yerine 90 gün yayında kalır; Kiralık Araçlar talepleri alış tarihinde veya 30 gün sonunda, hangisi önceyse kapanır (Karar 10'un istisnaları).
- Ticari Araçlar altındaki Ticari Hat & Plaka alt kategorisi avukat görüşü alınana kadar kapalı kalır.
- Sahibinden'deki Engelli Plakalı Araçlar kategorisi şimdilik eklenmez.

## Karar 20: Galeri çalışan hesapları

Bir galeri hesabı birden fazla çalışan kullanıcısıyla yönetilir; her çalışan kendi telefonuyla doğrulanır ve mesajlarda galeri adıyla birlikte kendi adı görünür.

| Rol | Yetkiler |
| --- | --- |
| Sahip | Tüm yetkiler; paket, ödeme, fatura; kullanıcı ekleme ve çıkarma |
| Yönetici | Portföy, toplu yükleme, API, eşleşmeler ve mesajlar; satış temsilcisi ekleme |
| Satış temsilcisi | Eşleşmeler ve mesajlar; kendine atanan portföy araçlarını düzenleme |

- Paketin mesaj ve talep hakları galeri hesabının ortak havuzudur; sahip, çalışan bazında günlük mesaj sınırı koyabilir.
- Kullanıcı sayısı pakete bağlıdır: Başlangıç 2, Profesyonel 5, Kurumsal 15 kullanıcı (12.2).

## Karar 21: Talep oluşturma arayüzü

Talep oluşturma web ve mobilde adım adım bir sihirbazdır: kategori, ana araç, kriterler, alternatifler, konum ve izin, önizleme. Üstte ilerleme çubuğu bulunur; yarım kalan talep taslak olarak kaydedilir. Açıklama alanının altında telefon numarası, IBAN veya bağlantı yazılmaması uyarısı bulunur; iletişim bilgileri yalnızca izin ayarlarıyla paylaşılır (13.2 ile uyumlu).

## Karar 22: Satıcının ana sayfası

Satıcı ana sayfada kategori listesini ve kendisine özel bölümleri ayrı ayrı görür: "Kayıtlı aramalarınız" (kayıtlı aramalara uyan yeni talepler) ve galeriler için "Portföyünüze uyan talepler" (otomatik eşleşmeler).

## Karar 23: Kategori menüsü ve genişleme

Kategoriler sahibinden.com'daki gibi sayfanın solunda dikey bir menüde yer alır; menü ana kategori > alt kategori ağacı olarak kurulur, böylece ileride Emlak ve diğer ikinci el kategorileri aynı tarzda eklenebilir.

- İlk sürümde menüde yalnızca Vasıta ve 14 alt kategorisi açıktır; tasarımda Emlak ve İkinci el alışveriş "Yakında" olarak gösterilir.
- Kategori şeması (taban şema + uzantılar, Kategori şemaları sekmesi) araç dışı kategorileri de taşıyacak şekilde genel tutulur.
- Mobilde menü, başlıktaki kategori butonuyla açılan bir panel olur.
- Emlak eklendiğinde kendi mevzuatı (taşınmaz ticareti kuralları ve emlak ilanlarındaki EİDS doğrulaması) ayrıca incelenmelidir.

## Karar 24: Talepte araç görseli

Talep sayfasında, ana araç ve alternatifin yıl aralığına göre katalogdan otomatik seçilen temsili bir araç görseli gösterilir (ör. BMW 3 Serisi, 2019–2022 → G20 kasa). Görsel her zaman "Temsili görsel" etiketi taşır ve satıcının aracı olmadığı belirtilir.

- **Eşleştirme:** Katalogda her model için kasa kuşağı, makyaj durumu (ör. G20 makyajsız 2019–2022, G20 makyajlı 2022 ve sonrası) ve yıl aralığı tutulur; alıcının seçtiği kasa hangisiyse onun görseli gelir. Her alternatif kendi görselini gösterir; talepte renk seçildiyse görsel o renkte olabilir.
- **Kaynak:** Wikimedia Commons'taki açık lisanslı gerçek fotoğraflar, nesil ve makyaj başına seçilir ve atfıyla gösterilir (Karar 34).
- **Yapılmayacak:** Başka sitelerdeki ilan fotoğrafları veya lisanssız üretici görselleri kullanılmaz.
- **Görsel yoksa:** 2017 öncesi araçlarda ve araba dışı kategorilerde kasa tipine uygun silüet gösterilir; yönetim panelinde işlem gerekmez.

## Karar 25: Mesaj güvenliği uyarısı

Mesajlar gönderilirken kapora, ön ödeme, IBAN, "ödeme iste" ifadeleri ve harici bağlantılar için otomatik taranır; eşleşen mesajın altında alıcıya kırmızı bir uyarı bandı gösterilir.

- Uyarı metni: aracı görmeden ve noterde Güvenli Ödeme Sistemi dışında ödeme yapılmaması, şüphelenilirse satıcının şikayet edilmesi.
- Uyarı alan sohbetler mesaj listesinde "Uyarılı" filtresinde ve "Güvenlik uyarısı" etiketiyle görünür.
- Tespitler yönetim panelindeki şikayet kuyruğuna sinyal olarak düşer; tekrar eden hesaplar incelenir (13.2).
- Mesaj kutusunun altında her zaman "Kapora istemeyin ve vermeyin" notu bulunur.

## Karar 26: Galeri mesajında araç kartı

Galeriler ilk mesajına veya sohbete portföyündeki bir aracı araç kartı olarak ekleyebilir; kart aracın fotoğrafı, yılı, km'si, fiyatı ve portföy sayfasına bağlantıyı gösterir.

- Yalnızca EİDS doğrulamasından geçmiş ve yayında olan portföy araçları eklenebilir (Karar 17).
- Araç satılıp portföyden kaldırılınca kart "Bu araç artık satışta değil" olarak görünür.
- Bireysel satıcılar mesajlarında fotoğraf veya araç kartı gönderemez (Karar 18).

## Karar 27: Alıcı, portföy aracı için galeriye yazabilir

Alıcı, portföy aracı detay sayfasındaki "Bu araç için mesaj gönder" düğmesiyle galeriye ilk mesajı kendisi atabilir. Böylece galeri portföyü yalnızca bir vitrin olmaz; alıcının doğrudan ulaşabildiği bir ilana dönüşür.

- Sohbet otomatik olarak o aracın araç kartıyla başlar (Karar 26). Galerinin bu sohbete verdiği yanıtlar galerinin günlük ilk mesaj kotasından düşmez.
- Alıcı için ücretsizdir. Kötüye kullanıma karşı günlük sınır yönetim panelinden ayarlanır; başlangıç değeri günde 10 farklı araçtır.
- Aynı araç için aynı galeriyle tek sohbet açılır. Telefon ve WhatsApp, galerinin portföyde açtığı iletişim bilgileriyle gösterilir.
- Bireysel satıcıların portföyü olmadığı için bu akış yalnızca galeriler için geçerlidir.

## Karar 28: Galeriyi takip et

- Alıcı galeri profilinden bir galeriyi takip edebilir. Takip edilen galerinin portföyüne eklenen ve kullanıcının yayındaki taleplerine uyan araçlar günlük özetle bildirilir.
- Galeri takipçilerini tek tek görmez, yalnızca takipçi sayısını görür.

## Karar 29: Görünen ad ve aranabilir saatler

- Kullanıcı talep sayfalarında adının tam ("Ayşe Yılmaz") ya da soyadının baş harfiyle ("Ayşe Y.") görünmesini seçer. Varsayılan tam addır (Karar 11.4).
- Aranabilir saatler dışında telefon numarası ve WhatsApp düğmesi gizlenir; uygulama içi mesaj her zaman açıktır. Varsayılan aralık 09.00–21.00'dir.
- Yeni talepler Ayarlar'daki iletişim tercihleriyle açılır; her talepte ayrıca değiştirilebilir.

## Karar 30: Kayıtlı arama ve bildirim tercihleri

- Kullanıcı en fazla 10 kayıtlı arama tutabilir ve her biri için anlık, günlük özet veya kapalı bildirim seçer.
- Bildirimler uygulama, e-posta ve SMS kanallarında ayrı ayrı açılıp kapatılır. Ödeme ve güvenlik bildirimleri kapatılamaz.
- Kampanya e-posta ve SMS'leri yalnızca ticari elektronik ileti onayıyla gönderilir ve İYS'ye kaydedilir; varsayılan olarak kapalıdır.

## Karar 31: Ödeme, aracı buldum ve hesap kapatma kuralları

- Ödeme adımında sözleşme onayı her zaman, cayma hakkı onayı yalnızca hemen başlayan hizmetlerde ayrıca alınır (Karar 39). Ödeme tek çekimdir; e-arşiv fatura kesilir, istenirse vergi numarasıyla kurumsal fatura düzenlenir.
- "Aracı buldum" talebi kapatırken aracın nereden bulunduğunu sorar: Rengarenk'te bir satıcıdan, başka bir siteden veya galeriden, tanıdık üzerinden, almaktan vazgeçtim. Cevap satıcıya gösterilmez ve başarı ölçümünde kullanılır.
- Hesap kapatma SMS koduyla onaylanır. Yayındaki talepler kapanır, sohbetler karşı tarafta "Kapatılmış hesap" olarak görünür, fatura kayıtları yasal saklama süresi boyunca tutulur. Kullanılmamış hakların iadesi Karar 39'a göre yapılır.
- Cayma ve iade kuralları Karar 39'daki varsayılanlara göre uygulanır; avukat görüşmesinde gözden geçirilir.

## Karar 32: Donanım paketi ve makyaj

Katalogda her model için donanım paketleri (ör. Renault Clio Joy, Touch, Icon; BMW Sport Line, M Sport) ve kasa kuşağının makyajsız ya da makyajlı sürümü ayrı tutulur.

- Alıcı her alternatif için kasa ve makyajı, ayrıca paketi çoklu seçer; "Fark etmez" de seçilebilir. Seçilen kasalar model yılı aralığını otomatik doldurur.
- Talep sayfası, talep listesi filtreleri ("Kasa ve makyaj", "Donanım paketi") ve otomatik eşleştirme paket ile makyajı kullanır.
- Galeri aracını eklerken model yılından kasa ve makyaj önerilir, paket o kasanın listesinden seçilir. Toplu yüklemede paket eksikse satır hatası olarak gösterilir.
- Geçiş yıllarında (aynı yıl iki kasa satıldığında) paket adı yalnızca bir kasada varsa o kasa seçilir; yoksa iki kasa da eşleşmeye girer.

## Karar 33: Kendi kendini güncelleyen katalog

Katalogda seçilemeyen araç bırakılmaz ve kimse elle veri girmez. Kaynaklar otomatik çekilir, kurallarla eşleştirilir ve onay beklemeden yayına girer.

- **Otomobil ve hafif ticari:** TSB kasko değer listesi ana kaynaktır ve her ay otomatik alınır (marka, model, tip ve paket). TSB'de olmayan bilgiler açık kaynaklardan tamamlanır: kasa kuşağı, nesil ve makyaj Wikidata ile vehicle-makes-models'tan; güç, motor hacmi, yakıt ve ağırlık AB Çevre Ajansı veri setinden; motosiklet, kamyon ve otobüs modelleri VehiclesDB'den. Yeni bir model TSB'den önce açık kaynaklarda görünürse oradan eklenir, TSB'ye girince iki kayıt birleştirilir.
- **Paket adı:** TSB tip metninden motor, güç ve vites ifadeleri ayıklanarak çıkarılır; aynı paketin farklı yazımları tek kayda bağlanır.
- **Eski araçlar:** 15 yıldan eski araçlar TSB arşivleri, Wikidata ve vehicle-makes-models'ın eski kuşak verisiyle korunur; listeden düşen hiçbir araç katalogdan silinmez.
- **Motosiklet ve hava araçları:** TSB motosiklet listesi ve motodb.org; hava araçlarında FAA tescil verisi ve ICAO tip kodları (ücretsiz, her gün güncellenir).
- **Otomatik kaynağı olmayan kategoriler** (deniz, karavan, ağır ticari, dorse, ATV, UTV): kullanıcı ve galeri girişleri yapılandırılmış alanlarla kaydedilir; aynı model birkaç farklı kullanıcı tarafından girilince kataloğa kendiliğinden eklenir.
- "Listede yok" bildirimi ve yönetici onayı kaldırıldı. Yönetim panelindeki katalog bölümü yalnızca izleme içindir; bir kaynak 48 saat güncellenmezse e-posta uyarısı gelir.
- **Gerekenler:** Sahip kararıyla (7 Kasım 2026) katalog TSB listesiyle kurulur, yazılı izin sonra resmî kanaldan istenir; auto-data.net'e gerek kalmadı. Hukuki risk bilerek alındı: liste FSEK Ek m.8 (veri tabanı hakkı) ve TTK m.55 (haksız rekabet) kapsamında korunabilir. Riski sınırlamak için kasko değerleri hiçbir yerde gösterilmez, yalnızca yayınlanan aylık dosyalar kullanılır, her kaydın kaynağı saklanır ve TSB verisi ayrılabilir tutulur. İzin reddedilirse TSB kayıtları açık kaynaklar ve kullanıcı girdileriyle değiştirilir.
- **Kalan risk:** TSB'nin teknik erişim yolu resmî bir API değil, değişebilir; geçiş yıllarında yanlış kasa ataması olabilir; Türkiye'ye özel modeller (Egea, Togg) açık kaynaklarda eksik olabilir, bu durumda TSB kaydı kasa bilgisi olmadan yayına girer ve ajan galeri girdilerinden tamamlar.

## Karar 34: Gerçek araç fotoğrafı (Wikimedia Commons)

- **Kaynak:** talep sayfasındaki temsilî görsel, Wikimedia Commons'taki açık lisanslı gerçek fotoğraflardan gelir. Ücretsizdir; ticari kullanıma izin veren lisanslar (kamu malı, CC0, CC BY, CC BY-SA) kullanılır. Ticari olmayan (NC) ve değiştirilemez (ND) lisanslar alınmaz. (7 Kasım 2026'da IMAGIN.studio yerine seçildi.)
- **Eşleştirme:** fotoğraf model değil nesil ve makyaj başına seçilir; Commons'taki araç kategorileri zaten "marka model (nesil kodu)" biçimindedir (ör. BMW 3 Series (G20)). Ajan her nesil için Commons'tan adayları bulur ve sıralar: dış çekim, ön çapraz açı, araç tam kadrajda, insan yok, en az 1200 piksel. Seçimi katalog sorumlusu onaylar; bir kez seçilen fotoğraf o nesil için kalır.
- **Atfı zorunlu:** fotoğrafın altında "Fotoğraf: \[yazar\] · \[lisans\] · Wikimedia Commons · temsilî görsel" yazar; lisans ve kaynak sayfasına bağlantı verilir. Plaka okunuyorsa bulanıklaştırılır; değiştirilen fotoğraf aynı lisansla yayınlanır ve atfında "düzenlendi" yazar.
- **Barındırma:** seçilen fotoğrafın bir kopyası atfıyla birlikte kendi depolamamıza (SeaweedFS, S3 uyumlu) alınır; böylece Commons'taki bir değişiklik sitemizi bozmaz.
- **Commons'ta fotoğraf yoksa:** galerinin izin verdiği portföy fotoğraflarından biri (plaka bulanık, galeri adı atfıyla) kullanılır; o da yoksa en yakın neslin fotoğrafı "önceki nesil" etiketiyle gösterilir. Silüet kullanılmaz.
- **İleride ücretli seçenek:** auto-data.net'in görsel veritabanı nesil ve makyaj başına gerçek fotoğraf sunar; Commons'ta ciddi boşluk çıkarsa düşünülür. IMAGIN.studio gerekmez.

## Karar 35: Büyüme ve reklam ölçümü

Lansman yapılmaz; büyüme online reklamlarla (ağırlıkla Meta, ayrıca Google) sağlanır. Ölçüm altyapısı ilk günden reklama hazır kurulur.

- **Web:** Meta Pixel ve Conversions API. Dönüşümler NestJS'ten doğrudan Meta'ya gönderilir ve tarayıcı olayıyla aynı olay kimliğiyle tekilleştirilir. Ek sunucu maliyeti yoktur; Conversions API Gateway ve sunucu taraflı GTM şimdilik kullanılmaz.
- **Mobil:** Meta SDK (react-native-fbsdk-next). Önce KVKK izin ekranı gösterilir; izin verilirse iOS takip izni (ATT) istenir, sonra SDK başlatılır. Ücretli ölçüm aracı (MMP) şimdilik kullanılmaz; uygulamaya yönlendirme için Universal Links, App Links ve Meta'nın kendi ertelenmiş bağlantısı yeterlidir.
- **Google:** Google Ads ve GA4, Consent Mode v2'nin temel modunda (izinden önce hiçbir şey gönderilmez). Galeri onayı ve abonelik ödemesi Data Manager API ile çevrimdışı dönüşüm olarak gönderilir.
- **Olaylar:** telefonla doğrulanmış üyelik → CompleteRegistration; talep yayınlandı → Lead (ana optimizasyon olayı); galeri başvurusu → SubmitApplication; galeri onaylandı → DealerApproved (yalnızca sunucudan); galeri aboneliği → Subscribe; hak veya öne çıkarma satın alımı → Purchase.
- **İzin:** Web'de çerez bandı gösterilir; "Kabul et" ve "Reddet" eşit görünür, önceden işaretli seçenek yoktur, tercih amaç bazında yapılır. Pixel ve Google etiketi yalnızca izinden sonra yüklenir. Sunucudan giden olaylar da yalnızca üyelikte ayrı "reklam ölçümü" onayı veren kullanıcılar için gönderilir.
- **Gönderilmeyecekler:** mesaj içerikleri, talep açıklaması, plaka ve şasi numarası.
- **Saklanan:** her kullanıcının ilk ve son teması (UTM, gclid, fbclid, fbp, fbc, açılış sayfası) izin durumuyla birlikte.
- **Sonra eklenecek:** galeri portföyünden Meta otomobil kataloğu reklamları; birden fazla reklam ağında uygulama kampanyası açılınca ölçüm aracı (MMP).

## Karar 36: Maliyet ilkesi; bütçe, ekip ve takvim

- Sabit bir bütçe, ekip veya takvim kuralı yoktur; ekibe biri katılırsa doküman güncellenir.
- Her teknik seçimde önce ücretsiz ya da kredilerle karşılanabilen seçenek tercih edilir; Google for Startups Cloud kredileri kullanılır.
- Aylık sabit gider tahmini yapılmaz; giderler en aza indirilir. Ücretli bir servise ancak ihtiyaç doğunca geçilir.

## Karar 37: Kişisel verilerin Türkiye'de tutulması

Google Cloud'un Türkiye bölgesi Turkcell ile Ankara'da kuruluyor ancak henüz açılmadı ve açılış tarihi duyurulmadı. Bu yüzden kişisel veriyi işleyen her şey Türkiye'de çalışır; kişisel veri içermeyen işler GCP kredileriyle karşılanır.

- KVKK bu tür bir platform için yerelleştirmeyi zorunlu tutmuyor. Ancak yurt dışındaki bir sunucuya uzaktan erişim de aktarım sayıldığı için yalnızca veritabanı değil, kişisel veriyi işleyen API de Türkiye'de çalışır.
- **Türkiye'de (Radore, İstanbul):** üç uygulama düğümlü küçük bir Kubernetes (k3s) kümesi; birincil ve yedek PostgreSQL (CloudNativePG); Redis, RabbitMQ ve OpenSearch tek düğümde. Tahmini toplam aylık 160–200 USD (KDV hariç).
- **Yedek:** şifreli yedekler başka bir şehirdeki ikinci bir Türk sağlayıcıda tutulur; geri yükleme her ay denenir.
- **Şifreleme:** disk şifrelemenin yanında telefon numarası ve mesajlar uygulama düzeyinde şifrelenir; anahtarlar Türkiye'de tutulur (OpenBao).
- **Kayıtlar:** 5651 trafik kayıtları 2 yıl boyunca, bütünlük özetiyle Türkiye'de saklanır.
- **GCP kredileriyle:** CI/CD, Artifact Registry, sentetik veriyle staging, statik web dosyaları ve anonim veriyle analiz.
- GCP Türkiye bölgesi genel kullanıma açılınca üretim aynı Kubernetes yapılandırmasıyla oraya taşınır.
- Kaçınılmaz yurt dışı aktarımlar (FCM ve APNs bildirimleri, hata raporlama, Meta ve Google reklam ölçümü) için standart sözleşme imzalanır ve 5 iş günü içinde KVKK'ya bildirilir.
- VERBİS kaydı, 50 çalışan ve 100 milyon TL yıllık bilanço altında zorunlu değildir.
- **Daha ucuz seçenek:** Türkiye şartından vazgeçilirse her şey GCP Avrupa bölgelerinde kredilerle neredeyse ücretsiz çalışır; standart sözleşmeyle bu da hukuken mümkündür.

## Karar 38: Mobil ödeme

- Bireysel kullanıcıya satılan ek talep, uzatma, ek mesaj ve öne çıkarmalar iOS'ta Apple uygulama içi satın alma, Android'de Google Play Billing ile satılır; web'de PayTR sürer. Apple öne çıkarmaları açıkça uygulama içi satın almaya bağlıyor ve Türkiye'de alternatif ödeme izni yok; uygulamada PayTR veya kartla ödeme kullanılamaz.
- Hangi kanaldan alınırsa alınsın haklar tek bir sunucu hesabında tutulur ve web ile uygulamada geçerlidir.
- Mobil fiyatlar mağaza komisyonu (%15) nedeniyle yaklaşık %20 yüksektir ve ,99 ile biter: ek talep ₺239,99; 3'lü talep ₺599,99; uzatma ₺119,99; 10 mesaj ₺119,99; 30 mesaj ₺299,99; üst sıra 7 gün ₺179,99, 30 gün ₺539,99; acil ₺94,99; vitrin ₺359,99. Uygulamada web fiyatından söz edilmez.
- Uygulama içinden alınan haklar süresizdir (Apple şartı); web'den alınanlar da aynı kuralla süresiz tutulur.
- Galeri abonelikleri yalnızca web'den PayTR ile satılır. Uygulamada galeri hesabıyla giriş yapılır; paket fiyatı veya satın alma yönlendirmesi gösterilmez. Apple bunu reddederse satın alma içermeyen ayrı bir galeri uygulaması yayınlanır.
- **Altyapı:** RevenueCat (aylık 2.500 USD gelire kadar ücretsiz) ve kendi hak defterimiz. İadeleri Apple ve Google yönetir; iade bildirimi gelince kullanılmamış hak silinir veya öne çıkarma bitirilir.
- Apple Small Business Program'a ve Google'ın %15 kademesine başvurulur.

## Karar 39: Tüketici hakları ve platform yükümlülükleri

Avukat görüşmesine kadar aşağıdaki varsayılanlar uygulanır.

- **Ödeme onayları:** Zorunlu onay: "Ön Bilgilendirme Formu'nu ve Mesafeli Hizmet Sözleşmesi'ni okudum, onaylıyorum." Sepette hemen başlayan bir hizmet (öne çıkarma, acil etiketi, vitrin, uzatma) varsa ayrı ve işaretsiz ikinci onay: "Öne çıkarma ve uzatma hizmetlerinin cayma süresi içinde hemen başlatılmasını talep ediyorum; hizmet başladığında bu kalemlerde cayma hakkımı kaybedeceğimi kabul ediyorum." Düğme: "Siparişi onayla ve öde".
- **Kayıt:** onaylar zaman damgasıyla kaydedilir; form ve sözleşme PDF olarak e-postayla gönderilir ve 3 yıl saklanır. Form en az 12 punto olur ve Mesafeli Sözleşmeler Yönetmeliği m.5'teki tüm bilgileri içerir.
- **Cayma:** Hemen başlayan hizmetlerde, hizmet başladıktan sonra cayma hakkı yoktur (m.15/1-h). Ek talep ve mesaj hakları kullanılmadıysa 14 gün içinde tam iade edilir; kısmen kullanıldıysa kalan kısım oranlı iade edilir.
- **Hesap kapatma:** Web'den alınıp kullanılmamış haklar ödenen tutar üzerinden karta iade edilir (her iade sahibin onayıyla gerçekleşir, Karar 40); başlamış öne çıkarmalar iade edilmez; mağazadan alınanların iadesi mağaza üzerinden yapılır.
- **Galeri (kurumsal):** Abonelik istendiğinde iptal edilir ve dönem sonuna kadar kullanılır, kısmi iade yapılmaz. Yıllık plan kullanılmadıysa 14 gün içinde tam iade edilir. Yenileme hatırlatması aylıkta 7, yıllıkta 30 gün önce gider. Fiyat artışı en az 30 gün önce bildirilir ve sonraki yenilemede uygulanır. Kartsız deneme kendiliğinden biter.
- **Telefon numarası gösterimi:** sözleşmenin ifası kapsamında (KVKK m.5/2-c), kullanıcının açıp kapattığı bir ayarla yapılır; ayrıca açık rıza istenmez.
- **Yayın öncesi kontrol listesi:** ETBİS kaydı; İYS kaydı ve onay kayıtlarının 3 yıl saklanması; 5651 trafik kayıtlarının 2 yıl saklanması; KVKK aydınlatma metni, çerez paneli ve standart sözleşme bildirimleri; internet ve telefon şikâyet kanalı; kimlik ve telefon doğrulama kayıtlarının 5 yıl saklanması (Motorlu Kara Taşıtları Ticareti Hakkında Yönetmelik m.22); VUK Genel Tebliği No. 538 kapsamında ilan bildirimi gerekip gerekmediğinin değerlendirilmesi.
- **Avukata sorulacaklar:** hakların cayma istisnasına girip girmediği; hesap kapatmada iade kuralı; platformun "ilan platformu" ve "aracı hizmet sağlayıcı" sayılıp sayılmadığı; VUK 538 bildirimi; telefon gösteriminin hukuki dayanağı; Anayasa Mahkemesi'nin 2026/42 sayılı kararıyla 6563 sayılı Kanun m.9/1'in iptalinin (yürürlük Mart 2027 civarı) etkisi.

## Karar 40: Çalışanlar, roller ve yetkiler

Yönetim konsoluna erişim rol ve yetkiyle sınırlıdır. Her işlem kayıt altındadır.

- **Hazır roller:**
  - Sahip: her şey, yetki verme dahil.
  - Yönetici: çalışan yönetimi ve fiyat değişikliği dışında her şey.
  - Moderatör: şikâyetler, uyarma, engelleme, talep gizleme.
  - Operasyon: galeri başvuruları ve galeri hesapları.
  - Destek: destek talepleri ve kullanıcı kartı; küçük limitli hak tanımlama.
  - Pazarlama: kampanyalar, kuponlar, şablonlar ve raporlar; kişisel veriyi görmez.
  - Finans: ödemeler, faturalar, iade önerileri ve gelir raporları.
  - İzleyici: yalnızca raporlar.
- **Özel rol:** Sahip, yetkileri tek tek işaretleyerek yeni rol oluşturabilir.
- **Dört göz onayı:** Hesap silme, 1.000 kişiden büyük toplu gönderim, fiyat ve paket değişikliği ve kupon oluşturma, sahibin veya bir yöneticinin onayından sonra gerçekleşir.
- **İade kuralı:** Sistemde hiçbir iade sahibin onayı olmadan yapılmaz. Çalışanlar ve ajan yalnızca iade önerisi hazırlar; öneri sahibin onay kuyruğuna düşer. App Store ve Google Play iadelerini mağazalar kendisi verir; bu iadeler yalnızca kayda geçer.
- **Giriş güvenliği:** Tüm çalışanlara doğrulama uygulamasıyla iki adımlı giriş zorunludur. Hesaplar yalnızca şirket e-postasıyla açılır. 30 dakika işlem yapılmazsa oturum kapanır. Yeni cihazdan girişte sahibe bildirim gider.
- **Kişisel veri maskeleme:** Telefon ve e-posta varsayılan olarak maskelidir. "Göster" denince gerekçe istenir ve kayda geçer. Pazarlama ve izleyici rolleri hiç göremez.
- **İşlem kaydı:** Her değişiklik kim, ne zaman, önceki ve sonraki değeriyle kaydedilir. Kayıt silinemez, 2 yıl saklanır, kişiye ve işleme göre aranır.
- **Çalışan yaşam döngüsü:** Çalışanlar e-postayla davet edilir; ayrılınca hesap ve açık oturumları tek tıkla kapatılır. Her çalışanın performans özeti vardır (çözdüğü şikâyet sayısı, ortalama yanıt süresi).

## Karar 41: Rengarenk Ajanı

Rengarenk Ajanı, yönetim konsolunda çalışan bir yapay zekâ operasyon ajanıdır. Kural içindeki işleri sormadan yapar, diğerlerini önerir. Ajanın kendi rolü ve yetkileri vardır (Karar 40); her işlemi işlem kaydına "Ajan" adıyla düşer ve tek tıkla geri alınabilir.

- **Sormadan yapar:**
  - Açık kapora, IBAN veya sahte link vakalarında mesajı gizler, hesabı 24 saat askıya alır ve vakayı insan incelemesine bırakır; spam hesapları kısıtlar.
  - Talep açıklamasında telefon, IBAN, link veya hakaret varsa kullanıcıdan düzeltme ister.
  - Destek taleplerini sınıflandırır, basit olanları (SSS, hesap durumu, hak bakiyesi) yanıtlar. İade gerektiren taleplerde yalnızca iade önerisi hazırlar.
  - Galeri başvurusunda belgeleri okur; yetki belgesi, vergi numarası ve MERSİS kontrollerinin hepsi geçerse başvuruyu onaylar ve sahibe bildirir. Bir kontrol bile geçmezse başvuruyu insan incelemesine bırakır.
  - Metriklerdeki ani düşüş ve artışları bildirir; SMS sağlayıcısı çökerse yedek sağlayıcıya geçer; ödeme hata oranı yükselirse uyarır.
  - Günlük ve haftalık özeti yazar, düşüşlerin nedenini analiz eder, doğal dille sorulan rapor sorularını yanıtlar.
  - Otomatik mesajlarda gönderim saatini ayarlar, A/B testinde kazananı uygular; belirlenen bütçe tavanını aşmaz.
- **Önerir, onay bekler:** fiyat ve paket değişiklikleri, toplu kampanya gönderimi, kalıcı engelleme, iadeler (yalnızca sahip onaylar), reklam bütçesi değişikliği, yeni segment ve kampanya fikirleri.
- **Hiç yapamaz:** iade yapmak, kişisel veriyi dışa aktarmak, çalışan yetkisi değiştirmek, kayıt silmek, kullanıcıya hukuki taahhütte bulunmak, ödeme bilgisine erişmek.
- **Güvenlik kuralları:** günlük işlem limitleri (ör. en fazla 50 askıya alma), emin olmadığında insana bırakma, tek tuşla tamamen durdurma ve haftalık karne (kaç işlem yaptı, insanlar kaçını geri aldı).
- **Veri:** Yapay zekâ sağlayıcısına gönderilen veri yurt dışı aktarımı sayılır. Telefon, isim ve benzeri bilgiler gönderilmeden önce maskelenir; standart sözleşme imzalanır ve aylık maliyet tavanı konur. Sağlayıcı: tüm görevlerde Google Vertex AI (Gemini) (teknik tasarım T11).

## Karar 42: Kullanıcı tarafında yapay zekâ

İlk sürümde beş yapay zekâ özelliği yer alır:

- **Talep asistanı:** Alıcı aradığı aracı kendi cümleleriyle yazar (ör. "2019 sonrası otomatik, dizel, aile arabası, 1,5 milyon bütçe"); asistan sihirbazı katalogla eşleştirip doldurur, alıcı kontrol edip yayınlar.
- **İlk mesaj taslağı:** Galeriye, talebe uyan portföy aracını önerir ve ilk mesajı taslak olarak yazar; gönderen her zaman kendisidir.
- **Mesaj güvenliği:** Karar 25'teki kelime taramasını yapay zekâ tabanlı dolandırıcılık tespitiyle güçlendirir.
- **Toplu yükleme yardımı:** Galerinin Excel'indeki karışık araç adlarını kataloğa bağlar, araç açıklaması taslaklar.
- **Destek sohbeti:** Yardım merkezi ve hesap bilgisiyle yanıt verir; çözemediğinde insana aktarır.

## Karar 43: Yönetim konsolunun kapsamı

Yönetim konsolu ilk sürümde aşağıdaki modülleri ve ek başlıkları içerir; masaüstünde ve telefonda kullanılabilir, kritik uyarılar push ile gelir.

- **Modüller:** kontrol paneli; çalışanlar ve yetkiler; kullanıcı ve galeri yönetimi; moderasyon ve güven; talepler ve portföy; gelir; kampanya ve pazarlama; bildirim merkezi; raporlar; içerik; destek; sistem ayarları; uyum ve KVKK.
- **Ek başlıklar:** kara liste (telefon, IBAN, cihaz, IP); galeri müşteri yönetimi (sorumlu çalışan, notlar, yenileme takibi, ayrılma riski); satıcı puanı; deneyler ve özellik anahtarları; SEO sayfaları; teknik izleme; uygulama sürüm yönetimi; finans mutabakatı; resmî talepler; mobil yönetim.
- **Tasarım turları:** (1) çalışanlar, yetkiler ve ajan; (2) kontrol paneli ve raporlar; (3) kampanya ve bildirimler; (4) kullanıcı, moderasyon ve destek; (5) içerik, ayarlar ve uyum.

## Karar 44: Kontrol paneli ve raporlar

- **Ana ölçü:** ilk mesaj alan talep oranı (talebine 48 saat içinde en az bir satıcı yazan alıcı oranı). Sonuç ölçüsü: "aracı buldum" sayısı.
- **Kontrol paneli:** yeni talep, ilk mesaj, açılan sohbet, aracı buldum, gelir ve yeni ücretli galeri; bugün ve bu ay, dün ve geçen haftayla karşılaştırmalı. Altında "bugün bakman gerekenler": onay kuyruğu, ajan uyarıları, süresi aşan şikâyetler, başarısız ödemeler, denemesi biten galeriler.
- **Hedefler:** aylık hedefler (talep, ücretli galeri, gelir ve ana ölçü) girilir, ilerleme çubuğuyla izlenir; ajan sapmayı bildirir.
- **Raporlar:** huni (ziyaret → üyelik → talep → ilk mesaj → sohbet → aracı buldum); il × kategori arz-talep haritası ve mesaj almayan talep oranı; gelir (kalem bazlı, aylık tekrarlayan gelir, galeri kayıp oranı, denemeden ücretliye geçiş, web ve mobil, iade oranı); reklam ve edinim (kanal ve kampanya bazında harcama, kayıt, talep, galeri, müşteri edinme maliyeti, reklam getirisi); galeri performansı ve ayrılma riski; kullanıcı tutma kohortları; moderasyon ve güven; destek ve ekip; bildirimler; katalog sağlığı.
- **Eklenen raporlar:** en çok talep edilen ve en çok aranan modeller (galeri satışı ve SEO için); birim ekonomisi (galeri başına ömür boyu gelir, edinme maliyetinin geri dönüş süresi); deney sonuçları (A/B ve fiyat deneyleri).
- **Neden analizi:** her sayıya tıklayınca il, kategori, kanal ve platform kırılımı açılır; ajan değişimin olası nedenini tek cümleyle yazar.
- **Grafik notları:** grafiklere tarihli not düşülebilir (ör. "Meta kampanyası başladı"); kampanya ve fiyat değişiklikleri otomatik not olarak eklenir.
- **Reklam harcaması:** Meta ve Google reklam hesaplarından her gece otomatik çekilir; elle veri girişi yoktur.
- **Araçlar:** tarih aralığı ve önceki dönemle karşılaştırma; il, kategori, kanal, platform filtreleri; "panoya kaydet" ile kişisel görünüm. Excel/CSV dışa aktarma yalnızca sahip, yönetici ve finansta; kişisel veri hiçbir zaman dışa aktarılmaz.
- **Zamanlanmış raporlar:** her sabah 09.00'da ajanın günlük özeti, her pazartesi haftalık rapor, her ayın 1'inde aylık rapor e-postası.
- Konsol ve raporlar telefonda da kullanılır; kritik uyarılar push ile gelir.

## Karar 45: Kategori ve alan yönetimi

Kategoriler ve kategoriye özgü alanlar kod değiştirmeden, sürümlü olarak yönetilir. Emlak ve ikinci el gibi yeni dikeyler (Karar 23) de bu yapıyla eklenir.

- **Kategori ağacı:** kategori ve alt kategori ekleme, sıralama, açma ve kapatma (ör. Ticari Hat & Plaka kapalı), simge ve renk.
- **Alan şeması düzenleyici:** her kategori taban şemayı devralır, kendi alanlarını ekler (Ek A). Her alan için tip (seçim, çoklu seçim, aralık, sayı, evet/hayır, metin), zorunluluk, filtrede görünürlük, eşleştirmede kullanım ve sert koşul olup olmadığı ayarlanır.
- **Sürüm ve yayın:** değişiklik taslakta hazırlanır, web ve mobil önizlemesiyle kontrol edilir, dört göz onayıyla yayınlanır. Yayındaki talepler eski sürümle kalır; yeni alan onlar için "belirtilmemiş" sayılır. Her sürüme geri dönülebilir.
- **Kategori kuralları:** yayın süresi, kategoriye özel öne çıkarma fiyatları, yasal uyarı metinleri, zorunlu doğrulamalar (ör. EİDS) ve katalog kaynağı kategori bazında ayarlanır.
- **Eşleştirme ayarı ve deneme alanı:** alanların eşleşmedeki ağırlığı değiştirilebilir; "bu talebe hangi portföy araçları eşleşir" simülasyonu yayından önce sonucu gösterir.
- **Yetki:** kategori ve alan yönetimi sahip ve yöneticidedir; tüm değişiklikler işlem kaydına girer.

## Karar 46: Görünüm ve içerik yönetimi

Sitenin ve uygulamanın görünümü ile pazarlama içerikleri geliştiriciye gerek kalmadan panelden yönetilir.

- **Ana sayfa düzenleyici:** bölümler (vitrin, kategori kutuları, son talepler, duyuru, kampanya alanı) sürükle-bırakla sıralanır ve açılıp kapatılır; ziyaretçi, bireysel ve galeri için ayrı düzen kurulabilir.
- **Vitrin:** ücretli vitrin sırası otomatik döner; boş yerlere editör seçimi talepler konabilir.
- **Bannerlar ve duyurular:** yer (ana sayfa, liste üstü, talep detayı, uygulama içi), hedef kitle, platform ve tarih aralığıyla; A/B testi yapılabilir.
- **Açılış sayfası oluşturucu:** reklamlar için hazır bloklardan (başlık, avantajlar, form, SSS, güven rozetleri) sayfa kurulur; UTM ve ölçüm olayları (Karar 35) otomatik eklenir.
- **Tasarım değerleri:** renk paleti (Gökkuşağı), logo, yazı tipi ve köşe yuvarlaklıkları tek yerden yönetilir; web, mobil ve e-posta şablonları aynı değerleri kullanır. Mevsimsel tema (ör. yılbaşı) tarihli olarak zamanlanabilir.
- **Yardım ve yasal metinler:** yardım makaleleri ve SSS düzenlenir; yasal metinler sürümlüdür ve kullanıcının hangi sürümü onayladığı saklanır.
- **Ortak kurallar:** her değişiklik web ve mobil önizlemeyle yapılır, ileri tarihe zamanlanabilir, önceki sürüme tek tıkla dönülür. Görünüm ve içerik pazarlama rolüne açıktır; tasarım değerleri ve yasal metinler sahip veya yönetici onayı ister.

## Karar 47: Genişletilebilirlik ilkesi

- Kurallar, limitler, fiyatlar, kategori şemaları, şablonlar ve içerik kodda değil ayar olarak tutulur ve panelden değiştirilir.
- Her yeni modül ortak altyapıya takılır: rol ve yetki (Karar 40), işlem kaydı, onay kuyruğu, bildirim katmanı, rapor olayları ve ajanın yapabilecekleri listesi.
- Yeni özellikler önce özellik anahtarının arkasında, belirli bir kullanıcı grubuna açılır; sorun olursa kod değişmeden kapatılır.
- Sistem API öncelikli kurulur; web, mobil, yönetim konsolu ve ajan aynı API'yi kullanır. Galeri API'si (Karar 07) de bu API'nin bir parçasıdır.

## Karar 48: Bildirim katmanı ve kanallar

- Sistemin her parçası bildirimi tek bir katmana bırakır ("bu kişiye bu olayı bildir"); kanal seçimi, sıklık sınırı, sessiz saat, rıza kontrolü ve kayıt bu katmanda yapılır.
- **Kanallar:** uygulama içi bildirim, mobil push ve web push (Firebase Cloud Messaging), e-posta (kendi SMTP sunucumuz, Karar 50), SMS (İYS entegrasyonlu yerli sağlayıcı, ana ve yedek).
- **Kanal sırası maliyete göre:** önce uygulama içi ve push, sonra e-posta, en son SMS. Push okunmazsa belirlenen süre sonra e-posta denenir.
- **Şablonlar:** tek şablondan e-posta, push ve SMS metni üretilir; değişkenler (ad, talep, galeri, tutar), önizleme ve sürüm vardır. E-posta şablonları tasarım değerlerini (Karar 46) kullanır.
- **Kullanıcı tercihleri:** Ayarlar ekranında kanal ve konu bazında açılıp kapatılır; ticari ileti tercihleri İYS ile eşitlenir.

## Karar 49: İleti türleri, İYS ve sıklık

- **İşlemsel iletiler** (doğrulama kodu, ödeme ve fatura, ilk mesaj geldi, talep süresi doluyor, hesap güvenliği) izin istemez; sessiz saatte de gider.
- **Ticari iletiler** (kampanya, indirim, duyuru) yalnızca İYS'de onayı olan kişilere gider. Kişi başına haftada en fazla 2 ticari ileti; 21.00–09.00 arasında gönderilmez, sabaha ertelenir. Her ticari iletide tek tıkla ayrılma bağlantısı vardır.
- **SMS:** ilk sürümde yalnızca doğrulama kodu ve kritik durumlarda (hesap güvenliği, ödeme sorunu) kullanılır. Kampanya SMS'i panelde hazırdır ama sahip açana kadar kapalıdır.
- 1.000 kişiyi aşan her gönderim sahip veya yönetici onayı ister (Karar 40).

## Karar 50: Kendi e-posta sunucumuz

E-postalar bir e-posta sağlayıcısı kullanılmadan, Radore'de çalışan kendi SMTP sunucumuzdan gönderilir. Alıcı adresleri Türkiye dışına çıkmaz (Karar 37).

- **Sunucu:** k3s kümesinden ayrı, sabit IP'li küçük bir sanal sunucuda açık kaynaklı posta gönderim yazılımı (Postal ya da Postfix tabanlı). Radore'den 25. portun açık olması ve IP'lerin ters DNS kaydı istenir.
- **İki ayrı akış:** işlemsel e-postalar bildirim.rengarenk.com.tr alt alan adından ve kendi IP'sinden, ticari e-postalar bulten.rengarenk.com.tr alt alan adından ve ayrı bir IP'den çıkar. Böylece bir kampanya şikâyet alırsa doğrulama kodları ve ödeme e-postaları etkilenmez.
- **Kimlik doğrulama:** SPF, DKIM (2048 bit, yılda bir anahtar yenileme), DMARC (önce izleme, sonra karıntına), ters DNS, TLS ve MTA-STS. Ticari iletilerde tek tıkla ayrılma başlığı bulunur; Gmail ve Outlook'un toplu gönderici kurallarına uyulur.
- **Isınma planı:** yeni IP'ler 4–6 haftada aşama aşama ısıtılır; ilk hafta yalnızca işlemsel e-posta, ticari gönderim günlük limitle başlar ve en etkileşimli kullanıcılardan genişler. Limit bildirim katmanında kendiliğinden uygulanır.
- **Geri dönen ve şikâyet:** kalıcı hata veren adres hemen, geçici hata veren 3 denemeden sonra listeden çıkarılır; spam şikâyeti gelen kişiye bir daha ticari e-posta gitmez.
- **İzleme:** Google Postmaster Tools ve Microsoft SNDS ile itibar, kara liste kontrolü, teslim, geri dönme ve şikâyet oranları bildirim merkezinde görünür. Spam şikâyeti %0,1'i, geri dönme %2'yi geçerse ajan ticari gönderimi kendiliğinden durdurur ve sana bildirir; işlemsel e-posta durmaz.
- **Bilinen risk:** kendi sunucumuzda teslim oranını korumak sürekli bakım ister; ilk haftalarda bazı e-postalar spam klasörüne düşebilir. Bu yüzden doğrulama kodu her zaman SMS ile de alınabilir.

## Karar 51: Kampanya ve otomatik akışlar

- **Segment oluşturucu:** il, kategori, rol (bireysel, galeri, kiralama firması), paket, son etkinlik, talep durumu ve rıza durumuna göre kural kurulur; kişi sayısı ve kanal bazında ulaşılabilir kişi canlı görünür. Segmentler kaydedilir ve her gönderimde yeniden hesaplanır.
- **Kampanya oluşturucu:** hedef, segment, kanal, şablon, zamanlama, A/B testi ve kupon bağlama; gönderimden önce tahmini maliyet ve "kaç kişi sıklık sınırına takıldı" bilgisi görünür. Kampanya sonucu raporlara (Karar 44) ve grafik notlarına otomatik düşer.
- **Otomatik akışlar:** tetikleyici → bekle → koşul → ileti adımlarıyla kurulur. İlk sürümdeki akışlar: hoş geldin, ilk talebini oluştur, talebin 3 gün sonra doluyor, ilk mesajı okumadın, galeri 7 gündür mesaj göndermedi, deneme bitiyor, ödeme başarısız.
- **Teslim raporu:** gönderildi, teslim edildi, açıldı, tıklandı, ayrıldı, şikâyet; kanal ve kampanya bazında, maliyetiyle.
- **Ajan:** segment ve kampanya önerir, metin taslaklarını yazar, A/B kazananını bildirir; toplu gönderimi hiçbir zaman kendisi başlatmaz. SMS sağlayıcısını yedeğe geçirmek ve itibar düşünce ticari e-postayı durdurmak kendi yapabildikleri arasındadır.

## Karar 52: Kullanıcı ve galeri kartı

- **Kart:** bir kişinin ya da galerinin tüm geçmişi tek ekranda: talepler, gönderilen ve alınan ilk mesajlar, ödemeler ve haklar, şikâyetler, destek talepleri, verdiği ve aldığı yıldızlar, ajanın bu kişiyle ilgili yaptıkları. Kişisel veri maskeli gelir; açmak gerekçe ister ve işlem kaydına girer (Karar 40).
- **İşlemler:** uyarı, 24 saat askı, kalıcı engelleme önerisi (onaylı), hak tanımlama (küçük limit), giriş bağlantısı gönderme, oturumları kapatma, not ekleme. İade bu ekrandan yalnızca önerilir; onayı sahiptedir.
- **Galeri başvuruları:** ajanın kendi onayladıkları (tüm kontroller geçti, sana bildirildi) ve insana bıraktıkları ayrı listelenir; her başvuruda yetki belgesi, vergi levhası, MERSİS ve adres kontrolünün sonucu görünür. Ajanın onayladığı galeri 7 gün içinde tek tıkla geri alınabilir.

## Karar 53: Moderasyon kuyruğu

- **Öncelik ve süre sınırı:** kritik (dolandırıcılık, kapora, tehdit) 1 saat; yüksek (sahte talep veya ilan, hakaret) 4 saat; normal (yanlış kategori, spam) 24 saat. Süresi aşan şikâyet kontrol paneline düşer.
- **Kanıt:** şikâyet edilen mesaj, öncesi ve sonrasıyla birlikte maskeli gösterilir; telefon, IBAN ve bağlantılar işaretlenir. Ajanın önerisi ve güven oranı yanında yazılır.
- **Karar:** hazır gerekçelerle (uyarı, mesajı gizle, 24 saat askı, kalıcı engelleme önerisi, şikâyeti reddet). Karar her iki tarafa şablonla bildirilir.
- **İtiraz:** kullanıcı karardan sonra 7 gün içinde itiraz eder; itirazı ilk kararı veren dışında bir moderatör inceler. Ajanın verdiği kararlara itiraz her zaman insana gider.

## Karar 54: Destek yalnızca yazılı

- İlk sürümde telefon desteği yoktur. Destek uygulama içi sohbet ve e-postayla verilir; ikisi tek kuyrukta toplanır.
- **Süre hedefi:** ilk yanıt mesai içinde 2 saat, mesai dışında ertesi iş günü 11.00. Ödeme ve hesap güvenliği konuları öne alınır.
- **Ajan:** sık sorulanları güven oranı %90'ın üstündeyse kendisi yanıtlar; diğerlerinde taslak yazar, destek çalışanı düzenleyip gönderir. İade, hesap silme ve hukuki konular her zaman insana kalır.
- Hazır yanıtlar, kullanıcı kartına tek tıkla geçiş, çözümden sonra 1–5 memnuniyet sorusu. Destek ekranında telefon numarası maskelidir.

## Karar 55: Satıcı puanı ve rozetler

- **Alıcı yalnızca yıldız verir** (1–5); yorum yazılmaz. Yıldızı yalnızca satıcıyla sohbeti açılmış ve satıcının en az bir yanıt verdiği alıcı verebilir; her sohbet için bir kez, sohbetten sonraki 30 gün içinde.
- **Puan içeride hesaplanır** ve alıcıya sayı olarak gösterilmez. Bileşenler: yıldız ortalaması, ilk yanıt süresi, şikâyet oranı, doğrulama durumu. Puan eşleşmede sıralamayı değil yalnızca rozetleri etkiler.
- **Alıcının gördüğü rozetler:**
  - **Onaylı galeri:** yetki belgesi, vergi levhası ve MERSİS doğrulandı.
  - **Hızlı yanıt:** son 30 günde en az 10 sohbette ortanca ilk yanıt 1 saatin altında.
  - **Güvenilir satıcı:** en az 10 yıldızda ortalama 4,5 ve üstü, son 90 günde şikâyet oranı %1'in altında, onaylı galeri.
- **Galeri kendi ayrıntısını görür:** galeri panelinde yıldız ortalaması, dağılımı ve rozete ne kadar kaldığı görünür; yıldızı kimin verdiği gösterilmez.
- **Manipülasyona karşı:** aynı cihazdan, yeni açılmış ya da satıcıyla bağlantılı hesaplardan gelen yıldızları ajan işaretler ve hesaba katmaz; galeri 1 yıldıza itiraz edebilir, itirazı moderasyon inceler.
- Rozet kuralları ve eşikler panelden değiştirilir (Karar 47).

## Karar 56: Sistem ayarları

- **Kurallar ve fiyatlar:** ücretsiz ilk mesaj sayıları, talep yayın süresi, paketler, web fiyatları ve kupon sınırları panelden değişir. Fiyat ve paket değişikliği dört göz onayı ister, ileri tarihe zamanlanır ve grafiklere not olarak düşer. Mobil fiyatlar mağaza panelinden yönetilir; konsol yalnızca gösterir.
- **Entegrasyonlar:** PayTR, App Store ve Google Play ödemeleri, SMS sağlayıcıları, Firebase, e-posta sunucusu, Meta ve Google, katalog kaynakları (TSB, VehiclesDB, AB Çevre Ajansı, Wikidata, vehicle-makes-models, motodb), Wikimedia Commons ve yapay zekâ sağlayıcısı. Her birinin durumu, son başarılı çağrısı ve anahtar yenileme tarihi görünür. Gizli anahtarlar hiçbir zaman ekranda gösterilmez, yalnızca yenilenir.
- **Özellik anahtarları:** yeni özellik yüzde, platform, il veya kullanıcı grubuyla açılır; tek tıkla kapanır (Karar 47).
- **Bakım modu:** sitenin tamamı ya da tek bir bölümü (ör. ödeme) kapatılabilir; kullanıcıya duyuru şeridi otomatik çıkar. Yalnız sahip ve yönetici.
- **Sistem sağlığı ve yedek:** çalışma süresi, hata oranı, kuyruklar, son yedek ve son geri yükleme testi. Veritabanı her gece tam ve sürekli artımla yedeklenir; yedekler Türkiye'de ikinci bir konumda tutulur; geri yükleme ayda bir test edilir.

## Karar 57: Yapay zekâ bütçesi ve ayarları

- Başlangıç sınırı aylık 150 USD'dir. Sahip bu sınırı panelden istediği zaman artırıp azaltabilir; değişiklik anında geçerlidir ve işlem kaydına girer.
- Harcama %80'e ulaşınca sahibe bildirim gider. Sınıra ulaşınca ajan yalnızca kritik görevlere (dolandırıcılık ve güvenlik, ödeme hataları, kanal yedeğe geçişi) devam eder; öneri, taslak ve kullanıcı tarafı yapay zekâ özellikleri ay sonuna kadar durur ya da sınır artırılır.
- Harcama görev bazında görünür (moderasyon, destek taslakları, talep asistanı, raporlar). Her görev ayrı açılıp kapatılabilir.
- Maskeleme kuralları (telefon, e-posta, IBAN, T.C. kimlik no, plaka) panelde görünür; kişisel veri yapay zekâ sağlayıcısına maskelenmeden gitmez (Karar 41).

## Karar 58: KVKK başvuruları ve kendi verini indirme

- **Başvurular:** KVKK m.11 kapsamındaki başvurular (bilgi alma, düzeltme, silme, itiraz) tek kuyrukta toplanır ve en geç 30 gün içinde yanıtlanır (m.13). Kalan süre her başvuruda görünür; 7 gün kala ajan uyarır.
- **Ajan taslak yazar, insan gönderir:** ajan başvurunun türünü belirler, kişinin verilerini toplar ve yanıt taslağını hazırlar. Yanıtı her zaman bir çalışan (sahip, yönetici ya da yetki verilen kişi) okuyup gönderir.
- **Kimlik doğrulama:** başvuru hesaptan geliyorsa doğrulama koduyla, dışarıdan geliyorsa kimlik bilgisiyle doğrulanır.
- **Kendi verini indir:** kullanıcı Ayarlar'dan "Verilerimi indir" der; doğrulama kodundan sonra veri kopyası (profil, talepler, mesajlar, ödemeler, rızalar) 24 saat içinde hazırlanır ve 7 gün geçerli bir bağlantıyla gönderilir. İstek işlem kaydına girer.

## Karar 59: Saklama, imha, ihlal ve VERBİS

- **Hesap kapatılınca** kişisel veri anonimleştirilir. Fatura ve ödeme kayıtları vergi ve ticaret mevzuatının istediği süre (10 yıl) saklanır. Mesajlar, şikâyet ya da resmi talep yoksa 1 yıl sonra silinir.
- **Erişim ve trafik kayıtları** 5651 sayılı Kanun kapsamında 2 yıl; kimlik ve telefon doğrulama kayıtları Motorlu Kara Taşıtları Ticareti Hakkında Yönetmelik m.22 kapsamında 5 yıl saklanır.
- **Periyodik imha** 6 ayda bir yapılır. Saklama süresi dolan kayıtlar ajan tarafından listelenir, sahip onayıyla imha edilir ve imha tutanağı saklanır.
- **Veri ihlali:** öğrenildiği andan itibaren 72 saat içinde Kurul'a bildirim. Panelde hazır bildirim şablonu, sorumlu kişi, kontrol listesi ve süre sayacı vardır; etkilenen kullanıcılara bildirim şablonu hazırdır.
- **Rıza kayıtları:** açık rıza, çerez tercihleri ve İYS onayları tarih, sürüm ve kanalıyla saklanır; İYS ile her gece eşitlenir.
- **Resmi makam talepleri** (mahkeme, savcılık, kolluk) ayrı kuyrukta, yalnız sahip ve yönetici görür; verilen her veri kaydedilir.
- **VERBİS:** yıllık çalışan sayısı 50'den az ve yıllık mali bilanço toplamı 100 milyon TL'den az olan, ana faaliyeti özel nitelikli kişisel veri işlemek olmayan veri sorumluları kayıttan muaftır; Rengarenk başlangıçta bu kapsamdadır. Kişisel veri envanteri yine de tutulur; eşiklerden biri aşılınca ajan kayıt için hatırlatır. Avukat teyidi gerekir.

## Açık konular

- [x] Talep yayın süresi: 30 gün, 7 / 3 / 1 gün önce hatırlatma
- [x] WhatsApp yönlendirmesi: var
- [x] Portföy fotoğraf ve fiyatı alıcıya da gösterilir

* [x] Günlük ilk mesaj limiti: bireysel 5, galeri pakete göre (Karar 12)
* [x] Galeri paketleri ve fiyatları (12.2)
* [x] Bireysel hizmet ve öne çıkarma fiyatları (12.8)
* [x] Aylık sabit gider tahmini: yapılmayacak, giderler en aza indirilecek (Karar 36)

- [x] Galeri deneme süresi: 30 gün, sınırlı haklarla
- [x] Ödeme sağlayıcısı: PayTR

* [x] Mobil teknoloji: React Native + Expo (Karar 16)

- [x] Kişisel verilerin Türkiye'de tutulması: Türkiye'de sağlayıcı + GCP kredileri, GCP Türkiye bölgesi açılınca taşıma (Karar 37)

* [x] Başlangıç stratejisi: lansman yok, büyüme online reklamlarla; ölçüm Meta uyumlu (Karar 35)
* [x] Uygulama mağazası ödeme kuralları: bireysel haklar mobilde App Store ve Google Play ile, galeri aboneliği yalnızca web'den (Karar 38)
* [x] Hukuki çerçeve: avukat görüşmesine kadar varsayılanlar Karar 39'da; avukata sorulacaklar listelendi
* [x] Bütçe, ekip ve takvim: sabit kural yok, tasarruf öncelikli, GCP kredileri kullanılacak (Karar 36)

- [x] Hava Araçları yayın süresi: 90 gün (Karar 19)
- [x] Ticari Hat & Plaka: avukat görüşüne kadar kapalı (Karar 19)
- [x] Engelli Plakalı Araçlar: şimdilik eklenmeyecek (Karar 19)
- [ ] TSB listesinin motosiklet, ağır ticari ve ATV kapsamının Excel indirilerek doğrulanması
- [ ] Kiralık Araçlar için kiralama yönetmeliği uyumu (firma yetki belgesi 1 Temmuz 2027, platform yükümlülükleri 1 Ocak 2028)

* [x] Araç görseli kaynağı: Wikimedia Commons, ücretsiz ve açık lisanslı gerçek fotoğraf (Karar 34)
* [x] Galeri kullanıcı sayıları: Başlangıç 2, Profesyonel 5, Kurumsal 15 (Karar 20, 12.2)
* [x] Ödeme ekranındaki onay metinleri, cayma hakkı ve hesap kapatmada iade kuralı için varsayılanlar belirlendi (Karar 39); avukat görüşmesinde gözden geçirilecek
* [ ] TSB'den yazılı ticari kullanım izni : katalog TSB ile kuruluyor, izin sonra resmî kanaldan istenecek (Karar 33)
* [ ] Google veya Turkcell'den KVKK standart sözleşmesi; GCP Türkiye bölgesinin açılış tarihinin takibi (Karar 37); taslak hazır, gönderim ertelendi
* [ ] Avukat görüşmesi: Karar 39'daki varsayılanlar ve sorulacaklar
* [ ] Veri ve hizmetlere e-posta atmadan erişmenin yollarını araştır (kullanım koşulları, self-servis paketler, deneme anahtarları, konsoldaki sözleşmeler); gerekirse taslakları güncelleyip gönder: Yazışma taslakları
* [x] Yapay zekâ sağlayıcısı: Google Vertex AI; maskeleme kuralları Karar 57'de; standart sözleşme GCP ile birlikte (teknik tasarım T11)
* [ ] Satıcı puanının kuralları (kim puanlar, ne zaman görünür) Tur 4'te netleşecek (Karar 43)

## Değişiklik kaydı

| Bölüm | Önceki | Düzeltme |
| --- | --- | --- |
| 6.1 | Manuel teklif sistemi | Talep keşfi + doğrudan mesaj |
| 6.2 | Eşleşme üzerinden teklif gönderme | Eşleşme üzerinden mesaj atma |
| 6.5 | "Talebe yeni teklif geldi", "Yeni teklif yanıtı geldi" | "Yeni mesaj geldi" |
| 8 | Teklif ve fiyatlandırma sistemi | Teklifsiz iletişim modeli; fiyatı yalnızca alıcı belirler |
| 8.3 | Mesajlaşma, telefon ve WhatsApp | Metin mesajlaşma + alıcı izinli telefon + WhatsApp |
| Numaralandırma | İletişim altyapısı ve talep yönetimi ikisi de "Karar 09" | 08 iletişim, 09 talep yönetimi |

## Kaynaklar

- [TÜİK Ekim 2026 enflasyon verisi (Timeturk)](https://www.timeturk.com/2026-ekim-enflasyonu-aciklandi-tufe-aylik-258-yillik-2977)
- [Sanal POS komisyon oranları 2026 (karekod.org)](https://www.karekod.org/blog/sanal-pos-komisyon-oranlari/)
- [Sahibinden paket fiyatı şikayetleri (Şikayetvar)](https://www.sikayetvar.com/sahibinden/fiyat/paket)
- [Sahibinden 30 günlük ilan ücreti şikayeti (Şikayetvar)](https://www.sikayetvar.com/sahibinden/sahibindencom-bireysel-oto-ilan-ucretleri-3599-tlye-cikti)

* [TSB Kasko Değer Listesi](https://www.tsb.org.tr/en/casco-value-list)
* [Türkiye Sigorta – Araç kasko değer listesi](https://www.turkiyesigorta.com.tr/hesaplama-araclari/arac-kasko-deger-listesi)
* [auto-data.net API](https://api.auto-data.net)
* [Cardata (Motor1)](https://tr.motor1.com/news/706328/cardata-chatgpt-fiyat-sorgulama/)
* [EİDS'ye entegre firmalar duyurusu (Alomaliye, Ocak 2026)](https://www.alomaliye.com/2026/01/27/tasit-ilanlarinda-eidsye-entegre-olan-firmalara-iliskin-duyuru/amp/)
* [JATO Specifications](https://www.jato.com/solutions/jato-specifications/)

- [Motorlu Kara Taşıtları Ticareti Hakkında Yönetmelik (Lexpera)](https://www.lexpera.com.tr/mevzuat/yonetmelikler/motorlu-kara-tasitlarinin-ticareti-hakkinda-yonetmelik-1)
- [EİDS yetki doğrulaması tüm taşıt ilanlarında (Alomaliye, Haziran 2025)](https://www.alomaliye.com/2025/06/18/tum-tasit-ilanlarinda-eids-yetki-dogrulama-uygulamasi-basladi/amp/)
- [6 ay / 6.000 km kuralının uzatılması (TRT Haber, Haziran 2026)](https://www.trthaber.com/haber/gundem/6-ay-6-bin-km-kurali-2027ye-kadar-uzatildi-948930.html)
- [Noter Güvenli Ödeme Sistemi (CNBC-e)](https://www.cnbce.com/otomotiv/ikinci-el-arac-satisinda-yeni-donem-basliyor-10-soruda-guvenli-odeme-sistemi-h4378)
- [Kapora ve sahte noter operasyonu (Bursa Hakimiyet, Temmuz 2026)](https://www.bursahakimiyet.com.tr/amp/bursa/bursa-merkezli-7-ilde-dev-operasyon-kaparo-ve-sahte-noter-yontemiyle-4-2-milyon-liralik-vurgun-1676195)
- [Sazan sarmalı (Posta)](https://www.posta.com.tr/ekonomi/oto-alim-satiminda-sazan-sarmalina-aman-dikkat-2752087)
- [sahibinden Güvenlik İpuçları](https://yardim.sahibinden.com/hc/tr/articles/360010285593-G%C3%BCvenlik-%C4%B0pu%C3%A7lar%C4%B1)

* [TSB Kasko Değer Listesi](https://tsb.org.tr/en/casco-value-list)
* [auto-data.net API](https://api.auto-data.net)
* [IMAGIN.studio dokümantasyonu](https://docs.imagin.studio/overview/what-we-do)
* [FAA uçak tescil verisi](https://www.faa.gov/licenses_certificates/aircraft_certification/aircraft_registry/releasable_aircraft_download/index.cfm)
* [Turkcell ve Google Cloud Türkiye bölgesi duyurusu (Business Wire, Kasım 2025)](https://www.businesswire.com/news/home/20251111239976/en)
* [KVKK standart sözleşme bildirim modülü duyurusu](https://www.kvkk.gov.tr/Icerik/8043/Standart-Sozlesme-Bildirim-Modulu-Hakkinda-Kamuoyu-Duyurusu)
* [KVKK Çerez Uygulamaları Hakkında Rehber](https://kvkk.gov.tr/Icerik/7353/Cerez-Uygulamalari-Hakkinda-Rehber)
* [Mesafeli Sözleşmeler Yönetmeliği (Alomaliye)](https://www.alomaliye.com/2014/11/27/mesafeli-sozlesmeler-yonetmeligi/amp/)
* [Google Play ödeme politikası](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en)
* [Rekabet Kurulu'nun App Store soruşturması (CNN Türk)](https://www.cnnturk.com/ekonomi/rekabet-kurulu-app-storea-sorusturma-baslatti-2121090)
* [Meta Conversions API en iyi uygulamalar](https://developers.facebook.com/documentation/ads-commerce/conversions-api/best-practices)
* [Google Consent Mode](https://developers.google.com/tag-platform/security/concepts/consent-mode)
