# Teknik tasarım

Sürüm 0.2 · 7 Kasım 2026. Bu sekme, ürün kapsamındaki 59 kararın teknik karşılığıdır. Teknik kararların hepsi onaylandı.

## 1. Teknik kararlar

| No | Konu | Karar | Durum |
| --- | --- | --- | --- |
| T01 | Mimari | Modüler monolit (NestJS) ve ayrı arka plan işçileri; mikroservis yok | Kesin |
| T02 | Depo | TypeScript monorepo (pnpm + Turborepo): web, mobil, yönetim, API, işçiler, ortak paketler | Kesin |
| T03 | Veritabanı | PostgreSQL 16; şema ve göçler Prisma ile; esnek kategori alanları JSONB | Kesin |
| T04 | Arama | OpenSearch; araçtan talebe ters eşleştirme için kayıtlı sorgular (percolator) | Kesin |
| T05 | Olaylar | PostgreSQL tabanlı kuyruk (pg-boss) ve outbox tablosu; olay kaybolmaz. Yük artınca RabbitMQ'ya geçilir | Kesin |
| T06 | Barındırma | Kişisel veri Radore'de (Türkiye), başlangıçta tek sunucuda Docker Compose ile, büyüyünce k3s'e geçilir; kişisel olmayan işler GCP kredileriyle (Karar 37) | Kesin |
| T07 | Gerçek zaman | NestJS WebSocket ağ geçidi, Redis yayın kanalıyla | Kesin |
| T08 | Dosyalar | SeaweedFS (S3 uyumlu, Apache-2.0) Radore'de; görseller imgproxy ile boyutlanır. MinIO topluluk sürümü Ekim 2025'te Docker imajı yayınlamayı bıraktı ve Nisan 2026'da arşivlendi; 7 Kasım 2026'da değiştirildi | Kesin |
| T09 | Kullanıcı girişi | Telefon ve SMS kodu, şifresiz; uzun oturum ve güvenilir cihaz | Kesin |
| T10 | Yönetim girişi | Şirket e-postasıyla Google Workspace tek oturum ve zorunlu 2FA | Kesin |
| T11 | Yapay zekâ | Tüm görevlerde Google Vertex AI (Gemini); ağ geçidi yine sağlayıcıdan bağımsız kurulur | Kesin |
| T12 | Hata izleme | GlitchTip (Sentry uyumlu) kendi sunucumuzda; kayıtlar yurtdışına çıkmaz | Kesin |
| T13 | Özellik anahtarları | Kendi tablomuz ve Redis önbelleği; ayrı ürün yok | Kesin |
| T14 | Mobil yayın | Expo EAS Build; küçük düzeltmeler mağaza beklemeden EAS Update ile | Kesin |

Tüm maddeler kesinleşti: T10 ve T11 7 Kasım 2026'da sahip tarafından onaylandı.

### Tek geliştirici için sadeleştirme (karar, 7 Kasım 2026)

Geliştirmeyi sahip tek başına yapacak; ürün kapsamı değişmedi (Karar 15: 59 kararın tamamı ilk sürümde). İşletme yükünü azaltmak için altyapı sadeleştirildi. Kodun modüler yapısı, OpenSearch ve Radore/GCP ayrımı aynen korunur.

| Önce | Şimdi | Ne zaman geri dönülür |
| --- | --- | --- |
| 3 düğümlü k3s kümesi | Tek uygulama sunucusunda Docker Compose; PostgreSQL ayrı sunucuda | Uygulama sunucusunda işlemci veya bellek sürekli %70'in üstündeyse ya da kesintisiz güncelleme gerekirse |
| RabbitMQ | PostgreSQL tabanlı kuyruk (pg-boss), outbox korunur | Kuyrukta saniyede 200'den fazla iş birikirse |
| Argo CD | GitHub Actions ile imaj çekip Compose yeniden başlatma | k3s'e geçilince |
| Kubernetes sırları | SOPS ile şifreli dosya, yalnızca sunucuda açılır | k3s'e geçilince |

Kuyruk, depolama ve arama birer arayüzün arkasındadır; geri dönüşte yalnızca o arayüzün uygulaması değişir.

## 2. Mimari

&#91;embedded content: sistem mimarisi · Radore'de kişisel veri, GCP'de kişisel olmayan iş\]

- **İstemciler:** web sitesi (Next.js, arama motorları için sunucuda üretilen sayfalar), mobil uygulama (Expo) ve yönetim konsolu (Next.js, yonetim.rengarenk.com.tr, ayrı dağıtım). Üçü de aynı API'yi kullanır (Karar 47).
- **API:** NestJS modüler monolit. Modüller: kimlik, hesap, katalog, kategori, talep, portföy, eşleştirme, sohbet, haklar, ödeme, bildirim, moderasyon, destek, kampanya, rapor, ayar, uyum, ajan. Modüller birbirini yalnızca servis arayüzüyle çağırır ve veritabanında her modülün kendi şeması vardır; ileride bir modül gerekirse ayrı servise ayrılabilir.
- **Arka plan işçileri:** aynı kod tabanından ayrı süreçler; kuyruktan iş alır, yük artınca çoğaltılır.
- **Neden modüler monolit:** küçük ekip, düşük altyapı maliyeti ve tek veritabanı işlemi. Örneğin ilk mesajın gönderilmesi ile hakkın düşmesi aynı işlemde olur; biri olup diğeri olmaz durumu yaşanmaz.

## 3. Altyapı, ortamlar ve dağıtım

- **Radore:** başlangıçta uygulama için tek sanal sunucu (Docker Compose, Caddy ile otomatik TLS) ve PostgreSQL için ayrı bir sanal sunucu (bir ana, bir eş). Aşağıdaki büyüme eşiklerinden biri aşılınca 3 düğümlü k3s kümesine geçilir; uygulama baştan konteyner olarak paketlendiği için geçiş kod değişikliği gerektirmez. E-posta sunucusu ayrı küçük bir sanal sunucuda, iki IP ile (Karar 50). Sunucu boyutları Radore teklifiyle netleşecek.
- **Ortamlar:** geliştirme (yerelde Docker Compose), test (GCP, yalnızca sentetik veri; her değişiklik için önizleme ortamı), canlı (Radore). Canlı veri test ortamına hiçbir zaman kopyalanmaz.
- **Dağıtım:** GitHub Actions ile test, tip kontrolü ve güvenlik taraması; canlıya yine GitHub Actions ile, etiketli sürümün imajı sunucuya çekilip Compose yeniden başlatılarak. Geri alma, önceki imaj etiketine dönmekle tek adımdır.
- **Veritabanı göçleri** geriye uyumludur: önce yeni yapı eklenir, veri taşınır, eski yapı sonra kaldırılır. Böylece dağıtım sırasında kesinti olmaz.
- **Yedek:** pgBackRest ile günlük tam yedek ve sürekli artımlı yedek; şifreli olarak Türkiye'de ikinci bir veri merkezinde. Günlük yedekler 30 gün, aylık yedekler 12 ay saklanır. Ayda bir yedek ayrı bir ortama otomatik geri yüklenerek test edilir (Karar 56).

## 4. Veri modeli

Her modülün PostgreSQL'de kendi şeması vardır. Ana tablolar:

| Alan | Ana tablolar | Not |
| --- | --- | --- |
| Kimlik ve hesap | users, accounts, account\_members, devices, sessions | Bir telefon numarasına bir bireysel hesap; galeri hesabına paket sınırı kadar çalışan eklenir |
| Yetki | roles, permissions, staff\_members, approvals, audit\_log | İşlem kaydı yalnızca ekleme, aylık bölümlenir, 2 yıl saklanır |
| Katalog | makes, series, models, generations, facelifts, trims, trim\_specs, catalog\_aliases | Her kaydın kaynak kimliği saklanır; güncelleme farkla işlenir |
| Kategori | categories, category\_schema\_versions | Sürümlü; yayındaki sürüm işaretli (Karar 45). Kategori kuralları ve eşleştirme ağırlıkları sürümün tanımındadır (ayrı category\_rules ve matching\_configs tablosu yok): tasarımdaki Sürümler ağırlık değişikliğini de sürüm sayar, talep ve eşleşme tek sürüm numarası taşır |
| Talep | demands, demand\_photos, demand\_events | Talep, oluşturulduğu şema sürümünü taşır; sık filtrelenen alanlar ayrı kolon, geri kalanı JSONB |
| Portföy | portfolio\_vehicles, vehicle\_photos, eids\_checks |  |
| Eşleşme | matches | Skor ve hesaplandığı ayar sürümü birlikte saklanır |
| Sohbet | conversations, messages, message\_flags | Mesaj gövdesi şifreli kolon |
| Haklar | entitlement\_ledger, entitlement\_balances | Defter yalnızca ekleme; bakiye defterden hesaplanır |
| Ödeme | orders, payments, subscriptions, invoices, refunds, coupons | İade satırı sahip onayı olmadan oluşamaz (bölüm 7) |
| Güven | ratings, reports, moderation\_cases, appeals, badges |  |
| Destek | tickets, ticket\_messages, canned\_replies |  |
| Bildirim | notifications, templates, template\_versions, segments, campaigns, flows, flow\_runs, deliveries, suppression\_list |  |
| Uyum | consents, consent\_texts, iys\_sync, kvkk\_requests, retention\_policies, destruction\_logs, legal\_requests, breach\_cases |  |
| Ajan | agent\_tasks, agent\_actions, ai\_usage | Her eylem geri alma bilgisiyle saklanır |
| Ayar | settings, feature\_flags, packages, prices | Sürümlü |

**Kişisel veri etiketi:** şemadaki her kişisel veri kolonu (telefon, e-posta, ad soyad, adres, T.C. kimlik no, IBAN) etiketlenir. Ekranlardaki maskeleme, kullanıcının veri kopyası (Karar 58), anonimleştirme ve periyodik imha (Karar 59) bu etiketlerden otomatik çalışır; yeni bir kolon eklendiğinde ayrıca kod yazmak gerekmez.

Hak defteri örneği:

```sql
create table entitlement_ledger (
  id          bigint generated always as identity primary key,
  account_id  uuid not null references accounts(id),
  kind        text not null,  -- talep, ilk_mesaj, uzatma, ust_sira, acil, vitrin
  delta       int  not null,  -- artı: satın alma veya tanımlama, eksi: kullanım veya iade
  reason      text not null,  -- satin_alma, paket, tanimlama, kullanim, iade, sure_dolumu
  source_type text not null,  -- order, staff_grant, package_cycle, message, refund
  source_id   text not null,
  created_by  text not null,  -- kullanıcı, çalışan veya ajan
  created_at  timestamptz not null default now(),
  unique (source_type, source_id, kind)  -- aynı olay iki kez işlenmez
);
```

## 5. Kategori şeması ve katalog hattı

- **Şema:** her kategori sürümü alan tanımları (tip, zorunluluk, filtre, eşleşme, sihirbaz adımı, talep ya da alternatif kapsamı, koşul), kurallar ve ağırlıklardan oluşur; taban şema (konum, bütçe, açıklama) koddadır ve her kategoriye eklenir. Doğrulayıcı ve JSON Schema bu tanımdan üretilir (`packages/shared/src/category-schema.ts`); web, mobil ve API aynısıyla doğrular. Veritabanı kilidi yayındaki sürümü değiştirmeye, silmeye ve onaysız yayına almaya izin vermez (RR030–RR033).
- **Yayın:** taslak → önizleme → dört göz onayı → yayında. Talep o anki sürümle kaydedilir; eski talepler eski sürümle okunur (Karar 45).
- **Arama:** şemada "filtrede" işaretli alanlar OpenSearch eşlemesine kendiliğinden eklenir; yeni alan için yeniden indeksleme arka planda yapılır.
- **Katalog hattı (GCP, kişisel veri yok):** Cloud Run işleri ana kaynak olan TSB listesini ayda bir, VehiclesDB'yi ayda bir, Wikidata ve vehicle-makes-models'ı haftada bir, AB Çevre Ajansı veri setini yayınlandıkça, motodb'yi haftada bir çeker. Adımlar: indir → normalize et → önceki sürümle karşılaştır → kalite kontrolü (kaybolan model, olağandışı değişim) → imzalı paket olarak Radore'ye yayınla. Kontrol geçmezse yayın durur ve ajan bildirir.
- **Ad eşleme:** aynı modelin farklı kaynaklardaki adları catalog\_aliases tablosunda birleşir; eşleşmeyenler ajan önerisiyle onaya düşer (Karar 33). Ajan gelene kadar öneriyi kural üretir (ek, bitişik yazım, noktalama farkı, tek harf farkı, elektrikli sürüm); onaylanan eşleme tipleri hedef seriye taşır ve sonraki içe aktarmalarda uygulanır. TSB'nin yapısal yazım farkları (Jeep'in Chrysler altında olması, Range Rover'da seri adının yazılmaması, Transit kısaltmaları) ayrıştırıcıda düzeltilir; ayrıştırıcının sürümü vardır, kurallar değişince aynı dosya yeniden işlenir.
- **Kasa kuşağı ve makyaj:** vehicle-makes-models kuşağı kasa başına ve makyaj dönemine göre ayrı verir (ör. 3 Serisi Sedan 2018, 2022, 2024); bütün yıllar için kuşak olarak saklanır, tip kaydı yalnızca eski yıllar için alınır. Wikidata nesil kodunu (G20) verir; yıl Wikidata'da yoksa İngilizce Vikipedi bilgi kutusundaki üretim yılından alınır, madde ve sürüm numarası saklanır. Kuşak, başlangıç yılını kapsayan en geç kodla eşleşir; aynı kod ve kasada sırası makyaj numarasıdır. Kodu eksik nesli önceki kodun makyajı saymamak için çakışan kuşak ve kodun bitişini aşan kuşak kodsuz bırakılır. Kodsuz yıllarda makyaj TSB'deki işaretten okunur. vehicle-makes-models kapatılırsa kuşakları da görünmez.
- **Görseller:** her nesil ve makyaj için Wikimedia Commons'tan seçilen açık lisanslı fotoğraf, yazar ve lisans bilgisiyle catalog\_images tablosunda saklanır; dosyanın kopyası kendi S3 depomuza (SeaweedFS) alınır. Adayları Commons API'sinden ajan bulur, katalog sorumlusu onaylar (Karar 34).

### TSB ve açık kaynaklarla katalog (karar, 7 Kasım 2026)

Sahip kararı: katalog TSB listesiyle kurulur; TSB'nin eksik kaldığı her yer açık kaynaklardan tamamlanır; auto-data.net kullanılmaz. Katalogun ihtiyacı ve kaynağı:

| İhtiyaç | Açık kaynak | Lisans | Kapsam ve not |
| --- | --- | --- | --- |
| Marka ve model listesi: otomobil, motosiklet, moped, hafif ticari, kamyon, otobüs | VehiclesDB | CC BY 4.0, atıfla | 18 ülkenin resmi tescil kayıtlarından uzlaştırılmış yaklaşık 19 bin model, kasa tipleriyle; aylık sürüm. Türkiye listede yok, ama modellerin çoğu ortak. |
| Nesil ve motor seçenekleri: güç, hacim, yakıt, şanzıman, çekiş, ölçüler, ağırlık | vehicle-makes-models (GitHub) | ODbL 1.0, paylaşım koşullu | 164 marka, 7.169 nesil, 30.390 motor seçeneği; haftalık güncelleme. Veriler autoevolution.com'dan derlenmiş; köken riski var (aşağıda). |
| Resmî teknik değerler: motor hacmi, güç, yakıt, ağırlık, aks mesafesi, CO2, elektrik tüketimi | AB Çevre Ajansı (EEA) yeni otomobil CO2 veri seti | CC BY 4.0, atıfla | AB'de 2010–2025 arasında tescil edilen tüm yeni otomobiller; tip, varyant ve versiyon düzeyinde. Türkiye'de satılan modellerin büyük kısmı AB'de de satıldığı için kapsar. |
| Nesil yılları ve makyaj | Wikidata ve Wikimedia Commons kategorileri | CC0 | Yaygın modellerde iyi; nadir modellerde eksik olabilir. Kapsamı ilk denemede ölçülür. |
| Fotoğraf | Wikimedia Commons | Açık lisanslar, atıfla | Karar 34 |
| Uçak | FAA kayıtları | Kamu malı | Var |
| Türkiye'ye özgü donanım paketleri (ör. Clio Joy, Touch) | Açık kaynakta yok | — | TSB listesi (yazılı izinle) ya da galeri ve kullanıcı girdileri |
| Tekne, karavan, ATV ve UTV | Açık kaynakta yok | — | Kullanıcı girdileriyle büyür (Karar 33'te de böyleydi) |

**Birleştirme:** TSB ana kaynaktır: otomobil, arazi ve hafif ticari araçlarda marka, model, tip ve paket TSB'den gelir. TSB'de olmayanlar şu kaynaklardan tamamlanır: nesil, yıllar ve makyaj Wikidata ile vehicle-makes-models'tan; resmî motor değerleri EEA'dan; TSB'nin kapsamadığı marka, model ve araç türleri (motosiklet, kamyon, otobüs) VehiclesDB'den; 15 yaşından eski araçlar Wikidata ve vehicle-makes-models'tan. Kaynaklar çelişirse resmî kaynak (EEA, TSB) kazanır; eşleşmeyen kayıtları ajan önerir, katalog sorumlusu onaylar. Her kaydın kaynağı ve lisansı saklanır; atıflar sitenin "Veri kaynakları" sayfasında gösterilir.

**Riskler:**

- **Türkiye paketleri:** açık kaynakların tek gerçek boşluğu. TSB listesinin izinsiz kullanımı hukuki risk taşır: FSEK Ek m.8 veri tabanı yapımcısını korur (liste her ay yenilendiği için koruma sürekli tazelenir) ve TTK m.55/1-c-3 haksız rekabet hükmü de uygulanabilir. Sahip bu riski bilerek aldı; katalog TSB ile kurulur ve izin sonra istenir (Karar 33). İzin reddedilirse paket adları (gerçek bilgi oldukları için tek tek serbestçe kullanılabilir) galeri ve kullanıcı girdilerinden ve markaların Türkiye sitelerindeki model sayfalarından ajanın önerisiyle eklenir, katalog sorumlusu onaylar. İlk aylarda yaygın modellerin paketleri elle tamamlanır.
- **vehicle-makes-models'in kökeni:** veriler autoevolution.com'dan derlenmiş. Bu sitenin kullanım koşulları toplu veri alımına izin vermiyorsa veri seti hukuken sorunlu olabilir. Bu yüzden avukat teyidine kadar yalnızca kataloğu başlatmak ve çapraz kontrol için kullanılır; kalıcı değerler resmî kaynaklardan (EEA, TSB) gelir.
- **ODbL paylaşım koşulu:** ODbL'li bir veri tabanından türetilen veri tabanı herkese açık kullanılırsa aynı lisansla paylaşılmalıdır. Bu yüzden ODbL'li veriler katalogda ayrı işaretlenir ve TSB verisiyle karıştırılmaz.
- **Eski araçlar:** EEA 2010 öncesini kapsamaz; daha eski araçlarda teknik değerler Wikidata ve vehicle-makes-models'tan gelir.

**Sonuç:** TSB ile açık kaynakların birleşimi katalogun tüm ihtiyacını ücretsiz karşılar; yalnızca tekne, karavan ve ATV/UTV kullanıcı girdileriyle büyür. TSB izni katalog kurulduktan sonra resmî kanaldan istenir. Riski sınırlamak için kasko değerleri hiçbir yerde gösterilmez ve saklanmaz, yalnızca yayınlanan aylık dosyalar kullanılır ve TSB kayıtları ayrılabilir tutulur; izin reddedilirse bu kayıtlar açık kaynaklar ve kullanıcı girdileriyle değiştirilir.

**TSB dosyasının alınması (sahip kararı, 7 Kasım 2026):** dosya iki yoldan girer ve ikisi de aynı hattan geçer. (1) Konsoldan yükleme: bir çalışan dosyayı TSB sitesinden indirip yönetim konsoluna yükler. (2) Otomatik çekme: sitenin "Dosyayı İndir" düğmesinin kullandığı adres (`/InsuranceData/GetLatestExcelFile`) 6 saatte bir sorulur, yeni dosya varsa indirilir; konsoldan açılıp kapatılır, başlangıçta kapalıdır. Bu adres belgelenmiş bir API değildir ve değişebilir; değişirse kalite kontrolü yayını durdurur, 48 saat güncellenemezse uyarı gider ve dosya konsoldan yüklenir. Dosya biçimi (Ekim 2026): dönem satırı, başlık (Marka Kodu, Tip Kodu, Marka Adı, Tip Adı, 15 model yılı), her tip bir satır; TSB'de seri ve paket ayrı alan değildir, tip adından ayrıştırılır.

Kaynaklar: [VehiclesDB](https://github.com/vehiclesdb/vehiclesdb) · [vehicle-makes-models](https://github.com/gor3a/vehicle-makes-models) · [EEA yeni otomobil CO2 veri seti](https://sdi.eea.europa.eu/catalogue/srv/api/records/b4044b06-2e6b-4f8e-a6e6-66e0e98bb0dd) · [EEA veri klasörü, 2010–2025](https://www.eea.europa.eu/data-and-maps/data/co2-cars-emission-22/folder_contents) · [NHTSA vPIC (ABD, kamu malı)](https://vpic.nhtsa.dot.gov/About)

## 6. Eşleştirme motoru

- **Talepten araçlara:** talep yayınlanınca ya da değişince işçi, OpenSearch'te sert koşullarla aday araçları bulur: kategori, il veya alıcının seçtiği mesafe, bütçe üst sınırı +%5, alıcı "kesin" dediyse vites ve yakıt. Sonra her aday için skor hesaplanır.
- **Araçtan taleplere:** galeri portföyüne araç eklediğinde yayındaki talepler kayıtlı sorgularla bulunur; her talep OpenSearch'te bir kayıtlı sorgu olarak durur. Böylece eklenen araç, uyan bütün taleplerle tek sorguda eşleşir.
- **Skor:** ağırlıklı uyumun yüzdesi, yani her ölçütün ağırlığı ile uyum değerinin çarpımlarının toplamı, ağırlıkların toplamına bölünür. Ağırlıklar kategori bazında ayardan gelir ve yönetim konsolundan değişir (Karar 45).

| Ölçüt | Başlangıç uyum kuralı |
| --- | --- |
| Marka, seri, model | aynı model 1 · aynı seri farklı model 0,7 · aynı marka 0,3 · diğer 0 |
| Model yılı | aralıkta 1 · aralık dışında her yıl için −0,2 |
| Bütçe | aralıkta 1 · üst sınırın %0–5 üstü 1'den 0,5'e iner · alt sınırın altı 0,9 |
| Kilometre | sınırın altında 1 · her %10 aşım için −0,2 |
| Kasa, makyaj, yakıt, renk | seçimdeyse ya da seçim yapılmamışsa 1 · değilse 0 |
| Donanım paketi | aynı paket 1 · üst paket 0,6 · alt paket 0,2 |
| Hasar kaydı | alıcının isteğine uygunsa 1 · değilse 0,3 |
| Konum | aynı ilçe 1 · aynı il 0,8 · komşu il 0,5 |

Bu değerler başlangıç içindir ve ayardadır; gerçek taleplerle ayarlanacak.

- **Bildirim:** skoru 80 ve üstü olan galeri "sana uygun talep" bildirimi alır. Galeri başına günde en fazla 20 anlık eşleşme bildirimi gider; fazlası günlük özete eklenir.
- **Deneme alanı:** yönetim konsolundaki simülasyon aynı fonksiyonu taslak ağırlıklarla çağırır; ekranda görülen sonuç canlıda çıkacak sonuçla aynıdır.

## 7. Haklar, ödemeler ve iade güvencesi

- **Hak defteri:** her satın alma, paket yenilemesi, çalışan tanımlaması, kullanım ve iade defterde bir satırdır. Aynı anda iki işlemin aynı hakkı kullanmasını hesap bazında kilit önler.
- **Kullanım sırası:** önce günlük ücretsiz hak (gece 00.00'da, İstanbul saatiyle yenilenir), sonra paket hakkı, en son satın alınan ek hak. İlk mesajın gönderilmesi ile hakkın düşmesi aynı veritabanı işlemindedir.
- **Web ödemesi:** PayTR iFrame. Ödeme sonucu bildirimi imzasıyla doğrulanır ve aynı bildirim iki kez gelse de bir kez işlenir. Galeri abonelikleri saklanan kartla tekrarlı tahsil edilir; başarısız ödeme 3 gün içinde yeniden denenir.
- **Mobil ödeme:** App Store ve Google Play; satın alma ve mağaza iadeleri RevenueCat bildirimleriyle deftere düşer (Karar 38).
- **Fatura:** ödeme onaylanınca e-Arşiv entegratörüne gönderilir; başarısızsa kuyrukta yeniden denenir.
- **İade güvencesi** ("bana sorulmadan sistemde hiçbir zaman iade yapılmasın"): teknik olarak dört kilitle sağlanır.
  1. İade satırı, yalnızca sahibin onayladığı bir onay kaydıyla oluşabilir. Veritabanı kuralı onaylayanın Sahip rolünde olduğunu ve onayın 72 saatten eski olmadığını kontrol eder; kural uygulama kodundan bağımsızdır.
  2. PayTR iade anahtarı yalnızca "iade yürütücü" işçisinde bulunur. API, yönetim konsolu ve ajan bu anahtara erişemez.
  3. Yürütücü iadeden hemen önce onayı yeniden doğrular, tutarın ödemeyi aşmadığını kontrol eder ve işlem kaydına yazar.
  4. Ajan servis hesabının iade oluşturma izni yoktur; yalnızca öneri kaydı açabilir.

  Apple ve Google'ın kendi iade kararları bizim kontrolümüzde değildir; yalnızca kayda geçer.

- **Hesap kapatmada iade (Karar 31, 39; sahip onayı 9 Kasım 2026):** kapatma iade yapmaz. Web'den alınıp kullanılmamış
  haklar (kalan hak en yeni satın almadan geriye dağıtılır, satın alınan adetle sınırlı) için ajan servis hesabı her
  sipariş adına Onay kuyruğunda bir iade isteği açar; istek yukarıdaki dört kilitten geçer, yalnızca Sahip onaylar.
  Kimlik ve telefon doğrulama kaydı `account_closures` tablosunda 5 yıl şifreli saklanır (Karar 59).

## 8. Mesajlaşma ve güvenlik

- Mesajlar WebSocket ile anında iletilir; alıcı çevrimdışıysa bildirim katmanına düşer.
- Telefon numarası, alıcı izin verene kadar gizlidir; numara paylaşımı bir olay olarak kaydedilir.
- **Mesaj güvenliği iki katmanlıdır:** önce anında kurallar (IBAN, telefon, kısaltılmış bağlantı, kapora kalıpları) uyarı etiketi ekler; ardından maskeli yapay zekâ sınıflandırması birkaç saniye içinde çalışır. Yüksek riskli mesaj gizlenir ve moderasyona düşer (Karar 41, 42).
- Yüklenen araç fotoğraflarında plaka, yükleme anında Radore'de çalışan açık kaynaklı bir modelle bulanıklaştırılır.
- Mesaj gövdesi şifreli saklanır; moderasyon ekranında yalnızca şikâyet edilen kesit, maskeli olarak açılır.

## 9. Bildirim katmanı

- **Akış:** olay → alıcıların bulunması → tercih ve rıza kontrolü (İYS) → sıklık sınırı (ticari iletide kişi başı haftada 2) → sessiz saat (ticari ileti 21.00–09.00 arasında sabaha ertelenir) → kanal sırası (uygulama içi → push → e-posta → SMS) → kanal bağdaştırıcısı → teslim kaydı (Karar 48, 49).
- **Bağdaştırıcılar:** uygulama içi (veritabanı ve WebSocket), push (FCM, web ve mobil), e-posta (kendi SMTP sunucumuz), SMS (ana ve yedek sağlayıcı; hata oranı eşiği aşılınca otomatik yedeğe geçiş).
- **E-posta sunucusu:** Postal (açık kaynak) önerilir; Postfix ve OpenDKIM ile kurulum da mümkündür. İki IP havuzu: işlemsel ve ticari. Isınma limiti bildirim servisinde uygulanır; geri dönen ve şikâyet bildirimleri adresleri otomatik olarak gönderim dışı listesine alır (Karar 50).
- **Şablonlar:** e-postalar MJML'den HTML'e derlenir; değişkenler Handlebars ile doldurulur; tasarım değerleri (Karar 46) derlemede eklenir. Her teslim kaydı kullanılan şablon sürümünü taşır.
- **Otomatik akışlar:** her akış bir JSON tanımıdır (tetikleyici, bekleme, koşul, ileti, hedef); beklemeler gecikmeli kuyrukla yapılır; her kişinin akıştaki durumu ayrı tutulur (Karar 51).

## 10. Yapay zekâ katmanı ve ajan

- **Ağ geçidi Radore'de çalışır.** Her istek önce maskelenir: telefon, e-posta, IBAN, T.C. kimlik no, plaka ve ad soyad yer tutucuyla değiştirilir; yanıt dönünce yer tutucular gerektiğinde geri konur. Kişisel veri sağlayıcıya maskelenmeden gitmez (Karar 41, 57).
- **Bütçe:** görev başına maliyet sayacı; %80'de uyarı, sınırda yalnızca kritik görevler (Karar 57).
- **İstemler sürümlüdür;** her çağrı görev, istem sürümü, token ve maliyetle kaydedilir. İçerik kaydı da maskelidir.
- **Sağlayıcı (T11):** tüm görevlerde Google Vertex AI (Gemini) kullanılır. GCP kredileri maliyeti karşılar ve GCP ile yapılacak standart sözleşme bu kullanımı da kapsar (Karar 37). Göreve göre model boyu seçilir: sınıflandırma gibi basit işlerde küçük ve ucuz model, destek taslakları ve neden analizinde daha güçlü model. Yayından önce her görev 200 gerçekçi, maskeli örnekle sınanır. Ağ geçidi yine sağlayıcıdan bağımsızdır; ileride gerekirse kod değişmeden başka sağlayıcıya geçilebilir. Turkcell–Google Türkiye bölgesi açıldığında istekler oraya taşınır.
- **Ajan bir görev çalıştırıcıdır.** Her görev bir tetikleyici, kurallar, izin verilen eylemler ve günlük limitten oluşur (Karar 41). Ajan, yönetim konsolunun kullandığı API'yi "Ajan" rolündeki bir servis hesabıyla çağırır; bu yüzden rolünün izin vermediği hiçbir şeyi teknik olarak yapamaz. Her eylem geri alma bilgisiyle işlem kaydına yazılır. Durdurma düğmesi bir özellik anahtarıdır; her görev ilk adımda onu kontrol eder.

## 11. Kimlik, yetki ve işlem kaydı

- **Kullanıcı girişi:** telefon numarası ve 6 haneli SMS kodu, şifre yok. Kısa ömürlü erişim jetonu ve cihaz başına 90 günlük yenileme jetonu kullanılır; güvenilir cihazda yeniden kod istenmez, bu da SMS maliyetini düşürür. Kod denemeleri sınırlıdır.
- **Yönetim girişi:** şirket e-postasıyla tek oturum ve zorunlu 2FA; 30 dakika hareketsizlikte oturum kapanır (Karar 40).
- **Yetki:** izin tabanlıdır, roller izin kümeleridir; her API uç noktası belirli bir izin ister. Kişisel veri alanları yanıtta varsayılan olarak maskelidir; açmak gerekçe ister ve kayda geçer.
- **Dört göz:** tek bir onay motoru vardır (istek, kimin onaylayacağı, süre, sonuç); onaylanan işlem kuyruktan yürütülür. Fiyat, toplu gönderim, kupon, kalıcı engelleme ve iade aynı motoru kullanır.
- **İşlem kaydı:** yalnızca ekleme yapılır; her satır bir öncekinin özetini taşıdığı için sonradan değiştirilmesi fark edilir. 2 yıl saklanır.

## 12. Olaylar, arama ve raporlama

- **Outbox:** her işlem kendi olayını aynı veritabanı işleminde outbox tablosuna yazar; bir aktarıcı olayları PostgreSQL tabanlı kuyruğa (pg-boss) iletir; işçiler kuyruktan iş alır. Böylece kayıt yapılıp olayın kaybolması mümkün olmaz.
- **Olay örnekleri:** talep.yayinlandi, talep.suresi\_doluyor, portfoy.arac\_eklendi, eslesme.bulundu, ilk\_mesaj.gonderildi, sohbet.acildi, arac.bulundu, odeme.alindi, odeme.basarisiz, iade.onaylandi, sikayet.acildi, galeri.basvurdu, riza.degisti.
- **Arama:** talepler, portföy ve katalog için OpenSearch indeksleri; Türkçe dil çözümleyici. İndeksler olaylarla güncel tutulur, her gece tam tutarlılık kontrolü yapılır.
- **Raporlama:** ürün olayları aylık bölümlenmiş bir tabloda tutulur ve her gece özet tablolara toplanır; kontrol paneli ve raporlar özet tablolardan okur (Karar 44). Kişisel veri içeren ham kayıtlar raporlara girmez.
- **Reklam ölçümü:** rızası olan kullanıcılar için dönüşümler sunucudan Meta ve Google'a gönderilir; reklam harcamaları her gece çekilir (Karar 35, 44).

## 13. Güvenlik, KVKK ve izleme

- **Kişisel veri Türkiye'de kalır:** veritabanı, dosyalar, yedekler, uygulama kayıtları ve hata izleme Radore'dedir. GCP'ye yalnızca katalog verisi, sentetik test verisi ve maskeli yapay zekâ istekleri gider.
- **Şifreleme:** aktarımda TLS, diskte şifreleme; telefon, e-posta, T.C. kimlik no ve mesaj gövdesi uygulama düzeyinde ayrıca şifrelenir. Şifreleme anahtarları veriden ayrı tutulur.
- **Sırlar:** depoda SOPS ile şifreli saklanır, yalnızca sunucuda açılır; hiçbir anahtar kodda ya da ekranda görünmez (Karar 56).
- **Uygulama güvenliği:** hız sınırları, bot koruması, OWASP kontrolleri, bağımlılık taraması; yılda bir dış sızma testi.
- **İzleme:** Prometheus, Grafana, Loki, Alertmanager ve GlitchTip. Kritik uyarılar push ve SMS ile gelir.

## 14. Aylık maliyet tahmini

| Kalem | Tahmin | Not |
| --- | --- | --- |
| Radore: uygulama ve veritabanı sunucuları | 160–200 USD | Karar 37; Radore teklifiyle netleşecek |
| E-posta sunucusu ve 2 IP | 15–30 USD | Tahmin |
| İkinci veri merkezinde yedek alanı | 10–20 USD | Tahmin |
| SMS | Kullanıma göre | Örnek: 30 günde yaklaşık 15.000 SMS ≈ 3.700 TL; güvenilir cihaz bu sayıyı düşürür |
| GCP: katalog, test ortamı, yapay zekâ | Krediler sürdükçe 0 | Yapay zekâ sınırı 150 USD (Karar 57) |
| Apple ve Google geliştirici hesabı | 99 USD/yıl ve 25 USD bir kez |  |
| RevenueCat | Başlangıçta ücretsiz | Gelir eşiği aşılınca ücretli |

Krediler sürerken toplam yaklaşık 200–250 USD ve SMS gideri.

## 15. Geliştirme sırası

1. **Temel:** monorepo, CI/CD, ortamlar, kullanıcı girişi, yetki ve işlem kaydı iskeleti, outbox, izleme. E-posta sunucusu bu aşamada kurulur ve yalnızca işlemsel e-postalarla ısınmaya başlar; ısınma 4–6 hafta sürdüğü için erken başlamak gerekir.
2. **Pazar çekirdeği:** katalog hattı, kategori şemaları, talep sihirbazı, liste ve arama, galeri başvurusu, portföy, eşleştirme, ilk mesaj, sohbet, haklar.
3. **Ödemeler:** PayTR, mağaza ödemeleri, abonelik, e-Arşiv, iade akışı.
4. **Bildirimler:** bildirim katmanı, push, e-posta, SMS, şablonlar, otomatik akışlar.
5. **Güven ve yönetim:** moderasyon, destek, rozetler, yönetim konsolu; ajan görevleri tek tek açılır.
6. **Büyüme:** kampanyalar, açılış sayfaları, reklam ölçümü, raporlar.

Her aşama özellik anahtarının arkasında canlıya çıkar; önce çalışanlarla denenir, sonra herkese açılır.

## 16. Açık teknik konular

- [x] Yapay zekâ sağlayıcısı: tüm görevlerde Google Vertex AI (onaylandı)
- [x] Yönetim girişi için Google Workspace (onaylandı)
- [ ] Radore teklifi: sunucu boyutları, 25. port, ters DNS, ikinci veri merkezinde yedek
- [ ] SMS ana ve yedek sağlayıcının seçimi (İYS entegrasyonlu)
- [ ] e-Arşiv entegratörünün seçimi
- [ ] Apple ve Google geliştirici hesaplarının şirket adına açılması (Apple kurumsal hesap için D-U-N-S numarası gerekir)
- [ ] Eşleştirme uyum kurallarının ilk değerlerinin gerçek taleplerle ayarlanması
