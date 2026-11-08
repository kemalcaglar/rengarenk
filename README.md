# Rengarenk

Tersine ilan pazaryeri: alıcı aradığı aracı yazar, uygun aracı olan galeriler ve satıcılar ona yazar.
Ürün kararları, teknik tasarım ve geliştirme planı ürün kapsam dokümanındadır (Claude dokümanı:
_Tersine İlan Uygulaması – Ürün Kapsam Dokümanı_; sekmeler: Teknik tasarım, Geliştirme planı).

## Yapı

```
apps/
  api/      NestJS (Fastify) · API ve arka plan işçisi aynı kod tabanı
  web/      Next.js · rengarenk.com.tr
  admin/    Next.js · yönetim konsolu (yonetim.rengarenk.com.tr)
  mobile/   Expo (iOS + Android) · expo-router
packages/
  db/       Prisma şeması, göçler (migration), başlangıç verisi
  shared/   Ortak tipler, doğrulama şemaları (zod), kategoriler, renkler
deploy/     Canlı ortam: Docker Compose, Caddy, ortam değişkeni örneği
docs/       Ürün kapsam dokümanının kopyası (kararlar, teknik tasarım, plan) ve ekran tasarımları
```

IDE'de Claude ile çalışırken proje kuralları ve kaldığımız yer `CLAUDE.md` dosyasındadır.

## Gerekenler

- Node.js 22 (`.nvmrc`), pnpm 10 (`corepack enable`)
- Docker (yerel PostgreSQL, Redis, OpenSearch, SeaweedFS (S3) ve e-posta yakalayıcı için)
- Mobil için: Expo Go uygulaması veya iOS Simulator / Android Emulator

## İlk kurulum

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm infra:up            # PostgreSQL, Redis, OpenSearch, SeaweedFS, Mailpit
pnpm db:migrate          # göçleri uygular (ilk çalıştırmada aşağıdaki nota bak)
pnpm build               # paylaşılan paketleri derler, Prisma istemcisini üretir
pnpm db:seed             # yerel başlangıç verisi
pnpm dev                 # API :4000, web :3000, yönetim :3001, Expo
```

- API belgeleri: http://localhost:4000/docs
- Giriş kodu (SMS) yerelde API günlüğüne yazılır: `Rengarenk giriş kodun: 123456`
- E-postalar: http://localhost:8025 (Mailpit)

**İlk göç hakkında:** `packages/db/prisma/migrations/20261109000000_init` elle yazıldı, çünkü
iskelet Prisma motorunun indirilemediği bir ortamda kuruldu. Tabloların yanında Prisma'nın
ifade edemediği veritabanı kurallarını da içerir (yalnızca ekleme yapılan tablolar ve iade
kilidi). İlk `pnpm db:migrate` sonrasında Prisma şemayla göç arasında fark bulursa küçük bir
düzeltme göçü önerir; adını `init_duzeltme` koyup kabul etmen yeterli.

## Komutlar

| Komut                                     | Ne yapar                                                     |
| ----------------------------------------- | ------------------------------------------------------------ |
| `pnpm dev`                                | Tüm uygulamaları izleme kipinde çalıştırır                   |
| `pnpm --filter @rengarenk/api dev:worker` | Arka plan işçisini çalıştırır (outbox aktarıcısı)            |
| `pnpm test`                               | Testler; API testleri `rengarenk_test` veritabanını kullanır |
| `pnpm lint` / `pnpm format`               | Biome ile denetim ve biçimlendirme                           |
| `pnpm typecheck`                          | Tüm paketlerde tip denetimi                                  |
| `pnpm db:migrate`                         | Şema değişikliğinden yeni göç üretir ve uygular              |

Docker'daki PostgreSQL bilgisayarın **5433** portundan açılır (5432'yi bilgisayarda kurulu bir
PostgreSQL kullanıyor olabilir). Test veritabanı `rengarenk_test` kapsayıcı ilk kez kurulurken
kendiliğinden oluşur. Farklı bir adres için `.env` içindeki `DATABASE_URL` ve `TEST_DATABASE_URL`
değerlerini değiştir.

**Windows:** Docker Desktop açık olmalı. `corepack enable` nvm klasörüne yazamazsa hata verir;
pnpm zaten kuruluysa bu adımı atlayabilirsin.

## Şu an neler var (Sprint 1)

- Telefon ve SMS koduyla giriş: kod isteme, doğrulama, 15 dakikalık erişim jetonu, 90 günlük
  yenileme jetonu, jeton döndürme ve çalınan jetonun tekrar kullanımında tüm oturumları kapatma (T09)
- İşlem kaydı (yalnızca ekleme), outbox ve PostgreSQL kuyruğu (pg-boss) ile olay aktarımı
- Hak defteri: tek kaynak bir kez işlenir, eş zamanlı kullanım aynı hakkı iki kez harcayamaz
- İade kilidi 1: Sahip onayı olmadan, 72 saatten eski onayla veya farklı tutarla iade kaydı
  veritabanı tarafından reddedilir
- Web: ana sayfa iskeleti ve giriş; yönetim: giriş ekranı yer tutucusu; mobil: alt sekmeler ve giriş
- CI (GitHub Actions) ve etiketli sürümle canlıya dağıtım iş akışı

## SMS, günlük ve izleme (Sprint 2)

- **SMS:** `SMS_PROVIDER` ana sağlayıcı, `SMS_FALLBACK_PROVIDER` yedek. Ana sağlayıcı geçici hata verirse
  aynı mesaj yedekle gider; art arda 3 hatada ana sağlayıcı 5 dakika devre dışı kalır. Geçersiz numara
  gibi kalıcı hatalarda yedeğe geçilmez. Şu an `iletimerkezi` bağdaştırıcısı var; ikinci sağlayıcı
  seçildiğinde `apps/api/src/sms/` altına eklenir. Canlıda `console` kullanılamaz.
- **Hız sınırı:** aynı IP'den saatte en fazla 20 kod isteği ve 60 doğrulama (Redis).
- **Günlük:** JSON (pino); telefon, kod, jeton, çerez ve yetki başlığı maskelenir. Geliştirmede okunur biçimde.
- **Ölçümler:** `GET /metrics` (Prometheus). Canlıda `METRICS_TOKEN` zorunlu.
- **Hata izleme:** `SENTRY_DSN` verilirse 5xx hataları GlitchTip'e gider.
- **Web oturumu:** yenileme jetonu `rr_yenileme` adlı httpOnly çerezde; erişim jetonu yalnızca bellekte.

## Yönetim konsolu: giriş, roller, onay kuyruğu (Sprint 3)

- **Giriş (T10, Karar 40):** şirket Google hesabı (`STAFF_EMAIL_DOMAINS`, şimdilik `rengarenk.com.tr`),
  ardından doğrulama uygulaması kodu zorunlu. İlk girişte karekodla kurulur ve 10 tek kullanımlık
  kurtarma kodu verilir. 30 dakika işlem yapılmazsa, en geç 12 saatte oturum kapanır. Yeni cihazdan
  giriş `calisan.yeni_cihaz` olayını yazar (bildirim katmanı gelince sahibe iletilecek).
- **Google hesabı açılana kadar:** `STAFF_AUTH_PROVIDER=fake`. "Google ile giriş" düğmesi konsoldaki
  `/gelistirme/google` sayfasına gider; e-postayı yazıp devam edersin. Canlıda `google` zorunludur.
- **Yerelde ilk giriş:** `pnpm db:migrate`, `pnpm db:seed`, sonra http://localhost:3001 ve
  `sahip@rengarenk.com.tr`. Canlıda ilk sahip bir kez komutla açılır:
  `node dist/cli/sahip.js <e-posta> "<ad soyad>"` (yerelde `pnpm --filter @rengarenk/api sahip ...`).
- **Roller ve yetkiler:** 8 hazır rol + Ajan; matris `packages/shared/src/staff.ts` içinde ve onaylı
  tasarımla aynı. Sahip özel rol oluşturur; çalışan yönetimi ve iadede tam yetki özel role verilemez.
  Her `/staff` uç noktası bir izin ister; işaretsiz uç nokta kapalıdır ve bir test hepsini tarar.
- **Dört göz onay motoru:** iade, fiyat/paket, toplu gönderim, kupon, kalıcı engelleme, hesap silme.
  İsteyen kendi isteğini onaylayamaz (Sahip hariç). İadeyi yalnızca Sahip onaylar; motor iade kaydı
  açmaz ve iade yürütmez, veritabanı iade kilidi aynen geçerlidir. Bekleyen istek 7 günde düşer.
  Onaylanan işlem işçide `onay.onaylandi` kuyruğundan, ilgili modülün kaydettiği işlevle yürütülür.
- **Konsol ekranları:** Onay kuyruğu, Çalışanlar (davet, rol, 2FA sıfırlama, hesap kapatma), Roller ve
  yetkiler, İşlem kaydı (IP adresi kişisel veri yetkisi olmayana maskeli).

- Ana dal her zaman dağıtılabilir; yarım özellikler özellik anahtarının arkasında kalır.
- Kişisel veri içeren her alan şemada `/// @pii` ile etiketlenir.
- İşlem kaydı ve olay (outbox), değişiklikle aynı veritabanı işleminde yazılır.
- Değişiklik notlarında ilgili karar numarası anılır (ör. "Karar 12").

## Özellik anahtarları ve bakım (Sprint 4)

- Anahtarlar `packages/shared/src/flags.ts` içinde tanımlı; konsolda Sistem › Özellik anahtarları ve bakım'dan
  açılır. Kapsam: kitle (herkes, kurumsal galeriler, yalnızca çalışanlar), yüzde, platform. Yeni özellik yazarken API'de
  `FeatureFlagService.isOn('anahtar', { userId, platform })`, istemcide `GET /flags` kullanılır.
- Bakım: tüm site (API kullanıcı uçları 503), ödemeler, mesajlaşma, talep. Bir modül yazma işleminden önce
  `assertAvailable('odeme')` çağırır. Web ve mobilde duyuru üst şeritte çıkar.

## Araç kataloğu (Sprint 5)

- `packages/catalog`: veritabanına dokunmayan hat (Excel okuyucu, TSB ayrıştırıcı, kalite kontrolü, imzalı paket).
  GCP gelince Cloud Run'a taşınacak; şimdilik API ve işçide çalışır.
- TSB dosyası: konsol › Sistem › Entegrasyonlar › TSB kartı › Katalog ayrıntıları'ndan yükleme ya da otomatik çekme (6 saatte bir, konsoldan açılır).
  Komut satırından: `pnpm --filter @rengarenk/api katalog:yukle <dosya.xlsx>` (dosya verilmezse TSB'den en son dosya).
- Yıllar: 2006 ve sonrası TSB (güncel liste + arşiv: `katalog:yukle --arsiv`), 1985–2005 vehicle-makes-models
  (`katalog:yukle --vmm`; ODbL, avukat teyidine kadar yalnızca eski yıllar, konsoldan kapatılabilir).
  Türkiye'ye özgü eski modeller (Şahin, Toros, Anadol …) kaynaklı listeden: `katalog:yukle --yerli`.
- Kasko bedelleri okunduğu anda atılır; hiçbir tabloda ve yanıtta yoktur. Kaynaktan düşen tipler silinmez.
- Okuma uçları: `GET /catalog/makes?kategori=`, `/catalog/makes/:id/series`, `/catalog/series/:id?yil=`.

## Kasa kuşağı ve ad eşleme (Sprint 6)

- **Kasa kuşağı:** vehicle-makes-models kuşakları (kasa ve makyaj dönemine göre) bütün yıllar için saklanır. Wikidata
  nesil kodlarını (E46, Mk7, W205) ve Commons kategorisini verir; yıl yoksa İngilizce Vikipedi bilgi kutusundan
  okunur. Kuşak koda bağlanınca makyaj sırası çıkar: 0 makyajsız, 1 ilk makyaj. Seri ayrıntısı (`?yil=`) o yılın
  kuşaklarını, kodlarını ve makyaj seçeneklerini döndürür; kodsuz yıllarda TSB'nin "LCI/FL" işareti kullanılır.
  Wikidata haftada bir çekilir: `katalog:yukle --wikidata`.
- **Ad eşleme:** aynı serinin farklı yazımları (TSB "Touraeg", vehicle-makes-models "Focus CC") kurala göre önerilir;
  konsol › Sistem › Entegrasyonlar › Açık veri setleri › Ad eşleme'den onaylanınca tipler hedef seriye taşınır. Önerileri yeniden üretmek için
  `katalog:yukle --oneri`. Kayıtlar silinmez.
- TSB ayrıştırıcısının sürümü var (`TSB_PARSER`); kurallar değişince sürümü artır, aynı dosya yeniden işlenir.
- **VehiclesDB** (CC BY 4.0): motosiklet, moped, kamyon, otobüs, van (`katalog:yukle --vehiclesdb`). Atıf zorunlu:
  sitede `/veri-kaynaklari` ve alt bilgideki bağlantı, mobilde Hesabım › Veri kaynakları. Atıf metni
  `GET /catalog/attributions`.
- **Nesil fotoğrafları** (Karar 34): `katalog:yukle --commons` Commons'tan aday toplar; seçim konsol › Sistem › Entegrasyonlar ›
  Nesil fotoğrafları. Seçilen dosya SeaweedFS'e (`S3_*` ayarları) kopyalanır, `GET /catalog/images/:id` ile sunulur;
  atfı seri ayrıntısında `photo.caption`.

## Kategoriler ve alanlar (Sprint 7)

- **Ağaç (Karar 19, 23):** 14 vasıta kategorisi ve Ticari Araçlar'ın alt kategorileri ilk açılışta 1. sürümle yayına
  girer (`packages/shared/src/category-defaults.ts`). Ticari Hat & Plaka avukat görüşüne kadar kapalı. Kategori
  silinmez, kapatılır. Emlak ve İkinci el aynı yapıyla taslak olarak eklenir, yayına girene kadar kapalı kalır.
- **Şema (Karar 45):** taban şema (konum, bütçe, açıklama) kodda ve kilitli; her kategori kendi alanlarını, kurallarını
  (yayın süresi, tarife, yasal uyarı, galeri doğrulamaları, katalog kaynağı, ücretsiz ilk mesaj) ve eşleştirme
  ağırlıklarını sürümünde taşır. Talep doğrulayıcı ortak pakette (`demandSchema`); web, mobil ve API aynısını kullanır.
- **Yayın:** konsol › Katalog › Kategoriler ve alanlar'da değişiklik taslağa yazılır, web ve mobil önizlemesiyle
  kontrol edilir, "Yayına gönder" dört göz onayı ister (CATEGORY_SCHEMA; sahip veya yönetici onaylar). Onaylanan
  sürümü işçi yayına alır. Eski sürüme "Bu sürüme dön" ile yeni bir taslak açılır. Veritabanı kilidi: yayındaki sürüm
  değişmez ve silinmez, onaysız yayına girmez (RR030–RR033).
- **Uçlar:** `GET /categories` (menü), `GET /categories/:slug/schema?surum=` (alanlar, kurallar, JSON Schema). Web ana
  sayfası ve mobil menü kategorileri buradan okur; API'ye ulaşılamazsa ilk kurulumdaki listeyi gösterir.
- **Eşleştirme ayarı:** ağırlıklar ikişer artar, taslağa yazılır ve şemayla aynı onaydan geçer. Skor işlevi
  `packages/shared/src/matching.ts` (Teknik tasarım §6). Deneme alanı talep ve portföy gelince çalışır.

## Galeri abonelikleri ve mağaza ödemeleri (Sprint 15)

- **Abonelik uçları:** `GET /gallery/:id/subscription`, `POST …/checkout` (`{ plan, donem, eposta, onay }`),
  `POST …/pay` (bekleyen yenileme), `PATCH …/next` (sonraki dönem), `POST …/cancel` (`{ iptal }`); kart sayfası
  `GET /odeme/kart/:no` (PayTR'de kart formu doğrudan PayTR'ye gider; sahte sağlayıcıda sahte sayfaya yönlenir).
- **İşçi:** dönem sonu yenileme ve 3 gün yeniden deneme, hatırlatma, aylık hak döngüsü, kart adı (`abonelik.kart_kaydedildi`).
- **Mağaza:** `POST /store/intents`, RevenueCat bildirimi `POST /odeme/magaza` (Authorization = `REVENUECAT_WEBHOOK_AUTH`),
  geliştirmede `POST /store/fake-purchase`. `STORE_PROVIDER`: `none` | `revenuecat` | `fake`. Ürün kimlikleri `rr_<ürün>`
  (ör. `rr_ek_talep`), App Store Connect ve Google Play Console'da tüketilebilir ürün olarak.
- **Konsol:** `GET /staff/payments` (izin `rapor.gor`), sayfa `/odemeler`.

## Web ödemeleri (Sprint 14)

- **Uçlar:** `GET /orders/overview`, `POST /orders` (`{ kalemler, fatura, onay }`), `GET /orders/:no`,
  `GET /orders/:id/invoice`, `GET /orders/:id/contract`; PayTR bildirimi `POST /odeme/bildirim` (yanıt düz "OK").
- **Sağlayıcı:** `PAYMENT_PROVIDER` — `none` (canlıda sözleşmeye kadar), `paytr` (`PAYTR_MERCHANT_ID/KEY/SALT`,
  `PAYTR_TEST_MODE`), `fake` (geliştirme: `/odeme/sahte/:no` sayfası PayTR'yle aynı biçimde bildirim gönderir).
  PayTR panelinde bildirim adresi `https://<api>/odeme/bildirim` olarak tanımlanır.
- **e-Arşiv:** `EARSIV_PROVIDER` — `none` ya da `fake` (sahte PDF). İşçi `odeme.alindi` olayında keser.

## Yıldız, rozetler, takip (Sprint 13)

- **Uçlar:** `GET/POST /conversations/:id/rating` (`{ yildiz }`), `GET /ratings/pending`, `GET /gallery/:hesap/trust`,
  `GET/PUT/DELETE /galeriler/:slug/takip`, `PATCH /gallery/:hesap/members/:kişi/limit` (`{ gunlukSinir }`), konsol
  `GET /staff/trust/overview`. Kurallar `packages/shared/src/ratings.ts`, hesaplama `apps/api/src/trust/`.
- İşçi her gece satıcı göstergelerini ve rozetleri yeniler, takip özetini yazar.

## Mesajlaşma (Sprint 12)

- **İlk mesaj:** `GET/POST /talepler/:no/mesaj` (durum, kalan hak; gönderim `{ metin, hesap?, aracId? }`),
  `POST /araclar/:no/mesaj` (alıcıdan galeriye). Sohbet: `GET /conversations`, `GET /conversations/unread`,
  `GET /conversations/:id`, `POST …/messages`, `…/decline`, `…/share-phone`, `POST/DELETE …/block`, `…/read`.
- **Anlık iletim:** `ws://…/ws`; bağlanınca `{"tip":"giris","jeton":"<erişim jetonu>"}` gönderilir, sunucu sohbet
  değişince `{"tip":"sohbet","id":"…"}` yollar. Birden çok API sürecinde Redis yayınıyla dağıtılır.
- **Şifreleme:** mesaj gövdesi `MESSAGE_SECRET_KEY` ile (AES-256-GCM); canlıda zorunlu, değiştirilirse eski mesajlar
  açılamaz. Geliştirmede boşsa `JWT_SECRET`'ten türetilir.

## Eşleştirme (Sprint 11)

- **Skor:** `evaluateMatch` (`packages/shared/src/matching.ts`); motor `apps/api/src/matching/`. Talep ve araç olaylarında
  işçi yeniden skorlar; OpenSearch'te `<önek>_portfoy` (araçlar) ve `<önek>_talep_sorgu` (talep sorguları, percolator).
- **Uçlar:** `GET /gallery/:hesap/matches` (`?arac=`), `POST …/matches/seen`, `GET /me/matches` (ana sayfa),
  `GET /araclar/:no/uyum` (girişli alıcı), konsol `POST /staff/categories/:id/matching/simulate`.
- Yerelde eşleşme işçide hesaplanır: `pnpm --filter @rengarenk/api dev:worker` açılışta indeksleri kurar ve bütün
  yayındaki talepleri skorlar.

## Galeri portföyü (Sprint 10)

- **Panel:** `/gallery/:hesap/portfolio` (liste, ekle, `PUT :id`, `photos`, `report?tarih=`, `submit`, `passivate`,
  `activate`, `sold`, `template`, `bulk?onizle=1`, `bulk`, `api-keys`). Herkese açık: `GET /araclar/:no`,
  `/araclar/:no/iletisim` (girişli), `/portfoy/fotolar/:id`, `/galeriler/:slug/araclar`.
- **EİDS:** `EIDS_PROVIDER` — `none` (varsayılan, canlı) araç doğrulama bekler ve görünmez; `fake` yerel ve test içindir:
  "0" ile biten plaka reddedilir, "9" ile biten bekler. İşçi `portfoy.eids_istendi` olayında ve 5 dakikada bir sorar.
- **Entegrasyon (Kurumsal):** `Authorization: Bearer rgk_…` ile `GET/PUT /entegrasyon/v1/araclar/:stokNo`,
  `POST …/satildi`, `POST …/pasif`.

## Galeri hesapları (Sprint 9)

- **Başvuru:** web `/kurumsal-basvuru`, mobilde Hesabım › Kurumsal hesap başvurusu. Uçlar `/gallery-applications/me`
  (taslak, `documents/:tür` ham gövdeyle belge, `verify-authority`, `submit`). Kontroller işçide `galeri.basvuru_alindi`
  olayıyla çalışır.
- **Doğrulama sağlayıcısı:** `GALLERY_VERIFY_PROVIDER` — `none` (varsayılan, canlı) her başvuruyu insana bırakır;
  `fake` yerel ve test içindir: "0" ile başlayan yetki belgesi bulunamaz, "9" ile biten uyarı verir.
- **Konsol:** Galeri başvuruları (`galeri_basvuru.onayla` izni). **Galeri:** web `/galeri-paneli`, mobil Galeri paneli,
  herkese açık profil `/galeri/:slug` (API `GET /galeriler/:slug`).

## Talepler, liste ve arama (Sprint 8)

- **Sihirbaz:** web `/talep-olustur`, mobilde "Talep oluştur". Alanlar kategorinin yayındaki şemasından gelir; taslak
  her değişiklikte kaydedilir. İlk talep telefon numarası başına ücretsiz; sonrası ödeme modülüyle satın alınacak.
- **Yaşam döngüsü:** Taslak → Yayında ⇄ Pasif → Tamamlandı / Kapatıldı. Uçlar `/demands` (sahip) ve
  `GET /talepler/:no` (herkese açık; telefon izinliyse ve girişli kullanıcıya). İşçi süresi dolanı pasife alır, 7/3/1
  gün kala `talep.suresi_doluyor` olayı yazar.
- **Arama:** `GET /talepler?kategori=&marka=&seri=&makyaj=&paket=&yilMin=&yilMax=&butceMin=&butceMax=&il=&telefon=1&q=&sira=`.
  OpenSearch (`OPENSEARCH_URL`, indeks öneki `OPENSEARCH_PREFIX`, varsayılan `rr`); indeks işçide güncellenir, açılışta
  ve her gece veritabanıyla eşitlenir. Testler `rrtest_` önekini kullanır; yerelde `pnpm infra:up` OpenSearch'ü açar.
- **İl ve ilçe:** `packages/shared/src/iller.ts` (81 il, 973 ilçe; kaynağı dosyada).
- **Favoriler ve kayıtlı aramalar:** `PUT/DELETE /favorites/:no`, `GET /favorites`; `GET/POST /saved-searches`,
  `PATCH/DELETE /saved-searches/:id` (en fazla 10; bildirim `anlik`/`gunluk`/`kapali`; `gordum: true` "yeni" sayacını
  sıfırlar). Web `/favoriler`, mobilde Hesabım › Favoriler ve aramalar. Bildirimlerin iletimi Aşama 7'de.
- **Ana sayfa:** `GET /talepler/vitrin?boyut=17` (karışık sıra, fotoğraflı talepler önce) ve son talepler
  (`/talepler?sira=yeni`). Talep kartlarındaki temsilî fotoğraf arama belgesindeki `foto` alanından gelir; yeni alan
  işçinin ilk turunda ya da gece eşitlemesinde indekse yazılır.

## Canlıya alma

Ayrıntılı el kitabı ve bu bilgisayarda canlı provası: [deploy/README.md](deploy/README.md).

`deploy/` klasörü sunucuda `/srv/rengarenk` altına kopyalanır, `.env.prod` oluşturulur
(gerçek değerler depoda SOPS ile şifreli tutulur). `v0.1.0` gibi bir etiket gönderildiğinde
`.github/workflows/deploy.yml` imajları GitHub Container Registry'ye derler, sunucuda göçleri
çalıştırır ve servisleri yeniler. Gerekli GitHub gizli değerleri: `DEPLOY_HOST`, `DEPLOY_USER`,
`DEPLOY_SSH_KEY`.
