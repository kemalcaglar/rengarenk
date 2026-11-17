# Rengarenk · Claude için proje notları

Tersine ilan pazaryeri (vasıta): alıcı aradığı aracı talep olarak yayınlar, uygun aracı olan
galeriler ve bireysel satıcılar ona yazar. Platform araç satışına aracılık etmez, yalnızca kendi
hizmetleri (ek talep hakkı, ilk mesaj hakkı, vitrin, galeri aboneliği) için ücret alır.

- Sahibi ve tek geliştiricisi Kemal (GitHub: kemalcaglar). Kullanıcıyla **Türkçe** konuş; sade
  anlat, gereksiz jargon kullanma. Arayüz metinleri, commit mesajları ve README Türkçedir.
- Ürün kararları, teknik tasarım, plan ve tasarımlar `docs/` altında (önce `docs/README.md`).
  Bir konuda karar ararken `docs/kapsam/01-urun-kapsami.md` (Karar 01–59) ve
  `docs/kapsam/02-teknik-tasarim.md` dosyalarına bak; tahmin etme.

## Değişmez kurallar

1. **Sahibine sorulmadan hiçbir zaman iade yapılmaz.** Sahibin sözü: "bana sorulmadan sistemde
   hiç bir zaman iade yapılmasın". Veritabanındaki iade kilidi (`rr_refund_guard`,
   `rr_approval_immutable` tetikleyicileri; hata kodları RR001, RR010–RR015, RR020) hiçbir
   gerekçeyle gevşetilmez, atlatılmaz ya da test için kapatılmaz. İade akışına dokunan her
   değişiklik için önce sahibe sor. Ayrıntı: Teknik tasarım bölüm 7.
2. **GitHub yalnızca bu bilgisayardan.** claude.ai GitHub bağlantısı veya başka bir hesap
   erişimi kurulmaz. Commit atabilirsin; `git push`, etiket (`v*`, canlıya dağıtımı başlatır) ve
   uzak depoyu değiştiren her şey için önce sahibe sor. Commit kimliği
   `kemalcaglar <caglarkemalofficial@gmail.com>` (depo ayarında tanımlı).
3. **Barındırma AWS Frankfurt'ta, kişisel veri korunarak** (Karar 37; 11 Kasım 2026'da Radore'den GCP'ye, 12 Kasım'da
   AWS'ye değişti). Sistemin tamamı AWS `eu-central-1` (Lightsail, yapay zekâ Bedrock); yurt dışına aktarım KVKK standart sözleşmesiyle ve Kurum'a bildirimle, bu
   olmadan canlıya gerçek kullanıcı verisi girmez. Yapay zekâ isteklerinde maskeleme sürer, test ortamına canlı veri
   kopyalanmaz. Kişisel veri içeren her şema alanı `/// @pii` ile etiketlenir.
4. `audit_log` ve `entitlement_ledger` yalnızca ekleme yapılan tablolardır (tetikleyiciyle
   korunur). Güncelleme veya silme ekleme.
5. İşlem kaydı ve outbox olayı, değişiklikle **aynı veritabanı işleminde** yazılır.
6. Gerçek sırlar (API anahtarları, `.env`, `.env.prod`) depoya yazılmaz. Canlı sırlar SOPS ile
   şifreli tutulur.
7. Kapsam: 59 kararın tamamı ilk sürümde (Karar 15). Kapsamı kendiliğinden daraltma; yarım
   özellikler özellik anahtarının arkasında ana dala girer.
8. Günlüklere telefon, SMS kodu, jeton, çerez ve yetki başlığı yazılmaz (pino maskeleri
   `apps/api/src/observability/logging.ts`). Yeni hassas alan eklersen maskeye de ekle.

## Yapı ve yığın

```
apps/api      NestJS 12 (saf ESM) + Fastify · API (:4000, /docs) ve arka plan işçisi (worker.ts)
apps/web      Next.js 16, React 19 · :3000
apps/admin    Next.js · yönetim konsolu :3001 (şimdilik giriş yer tutucusu)
apps/mobile   Expo 58, React Native 0.88, expo-router
packages/db   Prisma 7 (prisma-client üretici, adapter-pg, prisma.config.ts), göçler, seed
packages/shared  zod şemaları, telefon yardımcıları, 14 kategori, renkler (tokens.ts)
deploy/       Canlı: Docker Compose + Caddy, SeaweedFS ayarı, .env.prod örneği
```

pnpm 10 + Turborepo, TypeScript 6, zod 4, vitest 5 (unplugin-swc), Biome 2 (lint ve biçim).
Kuyruk: pg-boss (PostgreSQL'de, RabbitMQ yok). Dosyalar: SeaweedFS S3 (:8333, MinIO değil).
Önbellek ve hız sınırı: Redis. Arama: OpenSearch. Yerel e-posta: Mailpit (:8025).

## Komutlar (Windows, PowerShell, depo kökü)

```powershell
pnpm infra:up      # Docker Desktop açık olmalı: PostgreSQL (:5433), Redis, OpenSearch, SeaweedFS, Mailpit
pnpm db:migrate    # göç üret ve uygula
pnpm db:seed
pnpm dev           # tüm uygulamalar
pnpm --filter @rengarenk/api dev:worker   # outbox aktarıcısı
pnpm lint; pnpm typecheck; pnpm test      # commit öncesi üçü de temiz olmalı
pnpm format        # Biome ile biçimlendir
```

- API testleri gerçek veritabanı ister: `rengarenk_test` (Docker ilk kurulumda oluşturur) ve
  Redis 15 numaralı veritabanı. `apps/api/test/setup.ts` şemayı her çalıştırmada sıfırlar.
- CI (`.github/workflows/ci.yml`): kurulum, lint, build, typecheck, test. `deploy.yml` yalnızca
  `v*` etiketiyle ya da elle çalışır.

## Bu bilgisayardaki tuzaklar

- Docker'daki PostgreSQL **5433** portunda; 5432'de bilgisayarda kurulu başka bir PostgreSQL var.
  "rengarenk rolü mevcut değil" hatası yanlış porta bağlanıldığını gösterir.
- `corepack enable` EPERM verebilir; pnpm kurulu olduğu için zararsız.
- Git ayarları: `core.autocrlf=false`, `core.filemode=false`. Satır sonları LF kalmalı.
- İlk göç (`packages/db/prisma/migrations/20261109000000_init`) elle yazıldı ve Prisma'nın
  ifade edemediği tetikleyicileri içerir. Prisma bir "düzeltme" göçü önerirse içinde
  tetikleyicileri silen bir şey olmadığını kontrol et.
- `compose.prod.yml` ile yerel `docker-compose.yml` aynı proje adını (`rengarenk`) taşır. Canlı yapılandırmayı
  bu bilgisayarda yalnızca `deploy/prova/compose.prova.yml` ile çalıştır (proje adı `rengarenk-prova`); yoksa
  geliştirme kapsayıcıları değişir.
- Docker'ın içinden ad çözümleme zaman zaman düşüyor (`ENOTFOUND`, `no such host`); imaj derlemesini yeniden dene.
- Depo kökündeki `rengarenk.bundle`, `rengarenk-depo.tar.gz`, PDF ve `*.patch` dosyaları
  `.git/info/exclude` ile dışarıda tutulur; bundle ve tar.gz artık gerekmiyor.

## Nerede kaldık (7 Kasım 2026, Sprint 3 sonu)

- **Sprint 1 bitti:** monorepo, yerel ortam, telefon + SMS koduyla giriş (15 dk erişim, 90 gün
  yenileme jetonu, döndürme, çalınan jeton kullanılırsa tüm oturumları kapatma), işlem kaydı,
  outbox ve pg-boss, hak defteri, iade kilidi 1, web/yönetim/mobil iskeletleri, CI yeşil.
- **Sprint 2 bitti** (son commit "Sprint 2: ana ve yedek SMS, hız sınırı, günlük, ölçüm, oturum
  yönetimi"): ana/yedek SMS yönlendirici ve İleti Merkezi bağdaştırıcısı, Redis IP hız sınırı,
  pino günlük maskeleri, `/metrics`, GlitchTip bildirimi, `/me` profil ve oturum uçları, web'de
  httpOnly yenileme çerezi (`rr_yenileme`). API'de 25 test geçiyor.
- **Sprint 3 bitti:** yönetim girişi (Google Workspace + zorunlu TOTP 2FA, 30 dk hareketsizlik,
  kurtarma kodları, yeni cihaz olayı), izin matrisi (`packages/shared/src/staff.ts`, tasarımla aynı),
  her `/staff` ucunda `RequirePermission`/`StaffOnly`/`StaffPublic` (işaretsiz uç kapalı, test tarar),
  dört göz onay motoru (`apps/api/src/approvals/`), konsolda Onay kuyruğu, Çalışanlar, Roller, İşlem
  kaydı. API'de 49 test. Google hesabı açılana kadar `STAFF_AUTH_PROVIDER=fake`.
- **Sahip kararları (7 Kasım 2026):** Sahip kendi isteğini onaylayabilir, diğerlerinde isteyen ≠
  onaylayan; iade isteklerini yalnızca Sahip onaylar ve onay motoru iade yürütmez; CATALOG rolü
  atanamaz (özel rol kullanılır); yönetim e-posta alanı `rengarenksite.com`.
- **Sprint 4 (sunucusuz kısmı) bitti:** özellik anahtarları ve bakım modu (`apps/api/src/flags/`,
  `packages/shared/src/flags.ts`), canlı provası (`deploy/prova/`, el kitabı `deploy/README.md`). API'de 59 test.
- **Sprint 5 (Aşama 2) bitti:** katalog veri modeli, hat (`packages/catalog`, API `apps/api/src/catalog/`), TSB
  iki yoldan (konsoldan yükleme + otomatik çekme, sahip kararı), konsolda "Katalog kaynakları". Yerel veritabanında
  Ekim 2026 TSB listesi, TSB arşivi (2006'ya kadar), vehicle-makes-models (1985–2005) ve yerli klasikler yüklü: 1967–2026. API'de 75 test.
- **Eski yıllar (sahip isteği, en az 1990'lar):** TSB arşivi Nisan 2020'den başlar (`GetInsuranceDataArchiveFile`,
  ay kimliği = ay + 1). 2005 ve öncesi vehicle-makes-models'tan; ODbL ve autoevolution kökenli olduğu için kaynak
  ayrı tutulur ve konsoldan kapatılabilir (Teknik tasarım §5). Türkiye'ye özgü eski modeller (Şahin, Doğan, Kartal,
  Serçe, Murat, Toros, Renault 12, Anadol) `packages/catalog/src/yerli/klasikler.ts` içinde kaynaklı listedir (sahip
  kararı; Karar 33'e sınırlı istisna). Yeni değer eklerken maddeden oku, kaynak ve sürüm numarasını yaz, `YERLI_SURUM`'u artır.
- Catalog listeleri Türkçe alfabeyle sıralanır (veritabanı Ş'yi S'nin önüne koyar).
- **TSB dosyası:** `https://www.tsb.org.tr/InsuranceData/GetLatestExcelFile` → dosya yolu. Kasko bedeli asla
  saklanmaz ve gösterilmez (Karar 33). TSB dosyası depoya girmez.
- **Sprint 6 (8 Kasım 2026) ilk bölüm bitti:** TSB seri yazımları (`packages/catalog/src/tsb/series.ts`), ayrıştırıcı
  sürümü (`TSB_PARSER`, `VMM_PARSER`, `WIKIDATA_PARSER`: kural değişince artır, aynı dosya yeniden işlenir), kasa
  kuşakları bütün yıllar, Wikidata nesil kodu + Vikipedi üretim yılı, kod ↔ kuşak eşleşmesi ve makyaj sırası
  (`packages/catalog/src/generations.ts`, `apps/api/src/catalog/catalog-generations.ts`), ad eşleme
  (`catalog_aliases`, `catalog-alias.service.ts`, konsolda Katalog › Ad eşleme). API'de 77, katalogda 33 test.
  Kapsam: TSB otomobil serilerinin %83'ünde kasa kuşağı, %22'sinde nesil kodu (tip ağırlıklı).
- **Sprint 6 ikinci bölüm (8 Kasım 2026):** VehiclesDB kaynağı ve Veri kaynakları sayfası (web, mobil), nesil
  fotoğrafları (`catalog_images`, `catalog-image.service.ts`, depolama `apps/api/src/storage/`, konsolda Katalog ›
  Nesil fotoğrafları). İçe aktarma tek işlem ve kaynak başına kilitli. API'de 79, katalogda 36 test.
- **Tasarım uyum geçişi (8 Kasım 2026):** web, mobil ve konsoldaki her ekran tasarım dosyaları, PDF görselleri ve
  tasarım tuvaliyle eşitlendi (liste: `docs/kapsam/03-gelistirme-plani.md` sonu). Sahip "eksik ya da farklı bir şey
  olmasın" dedi: yeni ekranda `.dc.html` ile birlikte PDF'deki görüntüye de bak, renk noktaları gibi ayrıntıları atlama.
  Katalog sayfaları konsolda Sistem › Entegrasyonlar altında (`/entegrasyonlar/katalog`, `/ad-esleme`, `/fotograflar`).
  Konsol ekran görüntüsü için oturum: yerelde sahibe geçici `staff_sessions` satırı + `rr_yonetim` çerezi, işten sonra iptal.
- **EEA bekliyor (sahip kararı, 8 Kasım 2026: EEA'dan erişim istenecek):** Discodata ağ geçidi sütun seçen,
  toplulaştıran ve birden çok koşullu sorguları 403 ile reddediyor; ayrı toplu dosya yok. Engeli dolanmaya
  çalışma. Erişim biçimi (toplu dosya ya da sorgu izni) gelince hat yazılacak.
- **Sprint 7 (8 Kasım 2026) bitti:** kategori ağacı ve sürümlü şema (`packages/shared/src/category-schema.ts`,
  başlangıç tanımları `category-defaults.ts`, API `apps/api/src/categories/`), konsolda Katalog › Kategoriler ve alanlar,
  Eşleştirme ayarı. Kurallar ve ağırlıklar sürümün içinde; yayın dört göz onayıyla (CATEGORY_SCHEMA), işçi yayına alır.
  Kilit: RR030–RR033. `category-defaults.ts` yalnızca ilk kurulumu etkiler; var olan kategori konsoldan değişir.
  Web ana sayfası ve mobil menü `GET /categories` okur. API'de 88, ortak pakette 33 test.
- **Sprint 8 (8 Kasım 2026, Aşama 3 ilk bölüm):** talepler (`apps/api/src/demands/`, `packages/shared/src/demand.ts`),
  yaşam döngüsü ve süreler (işçi), ilk talep ücretsiz (hak defteri, telefon özeti), arama OpenSearch
  (`apps/api/src/search/`, testler `rrtest_` öneki), il/ilçe listesi (`iller.ts`). Web: `/talep-olustur`, `/taleplerim`,
  `/talepler`, `/talep/[no]`; mobil aynı ekranlar. API'de 93 test. Web ekran görüntüsü için yerelde API kodu yanıtta
  verdiğinden deneme numarasıyla oturum açılabilir (OTP hız sınırı yüzünden her denemede başka numara).
- **Favoriler ve kayıtlı aramalar (8 Kasım 2026):** `favorites` ve `saved_searches` tabloları,
  `apps/api/src/demands/favorites.*`, web `/favoriler`, listede "Aramayı kaydet", talep sayfasında kalp, mobil
  `app/favoriler.tsx`. Aynı aramanın kayıtlı olup olmadığı `searchQueryKey` (ortak paket) ile bulunur. API'de 94 test.
  Web'de `<body suppressHydrationWarning>`: bu bilgisayardaki ColorZilla eklentisi body'ye nitelik ekliyor.
- **Ana sayfa vitrini ve son talepler (8 Kasım 2026):** `GET /talepler/vitrin`, arama belgesinde `foto`, web ve mobil
  ana sayfa, ana sayfada "Kayıtlı aramalarınız". Vitrin boş yerlerini yayındaki talepler doldurur (ücretli vitrin
  Aşama 6). Mobil fiyatlar `mobil` alanında (Karar 38), `fiyatYaz` ile "359,99". Aşama 3 tamam.
- **Sprint 9 (8 Kasım 2026, Aşama 4 ilk bölüm):** kurumsal başvuru, kontroller ve ajan onayı, konsolda Galeri
  başvuruları, galeri hesabı ve 30 gün deneme, ekip ve davetler, galeri paneli ve profili (web, mobil).
  `apps/api/src/galleries/`, `packages/shared/src/gallery.ts`. Bakanlık/GİB/MERSİS erişimi yok: sağlayıcı arayüzü
  `verification.ts`, canlıda `none` (her başvuru insana). İşçiye yeni hizmet eklerken işçi modülüne de sağlayıcı ekle
  (`GalleriesWorkerModule` testi bunu yakalar). API'de 99 test, ortak pakette 46.
- **Sprint 10 (8 Kasım 2026, Aşama 4 bitti):** portföy (`apps/api/src/portfolio/`, `packages/shared/src/portfolio.ts`):
  elle ekleme, fotoğraf, ekspertiz, kurallar (6 ay / 6.000 km `RULE_6M_6000KM_UNTIL`, üretici fiyatı, m.16), EİDS
  sağlayıcısı (`eids.ts`, canlıda `none`), toplu yükleme (Excel/CSV), Kurumsal API anahtarı, araç sayfası (web, mobil).
  API testleri bellek içi depo kullanır (`test/helpers.ts`), CI'da SeaweedFS yok. API'de 104 test, ortak pakette 52.
  Yerelde OTP IP hız sınırı dolarsa Redis'te `rl:otp:ip:*` anahtarı silinebilir (yalnızca yerel).
- **Sprint 11 (8 Kasım 2026, Aşama 5 ilk bölüm):** eşleştirme motoru (`apps/api/src/matching/`, skor
  `packages/shared/src/matching.ts` `evaluateMatch`), OpenSearch'te araç indeksi ve talep kayıtlı sorguları (percolator),
  `matches` tablosu, `eslesme.bulundu` olayı (günde 20 anlık), galeri Eşleşmeler (web, mobil), ana sayfa "Portföyünüze
  uyan talepler", araç sayfası "talebine uyuyor", konsol deneme alanı. Skor talebin şema sürümüyle; marka sert koşul.
  API'de 106, ortak pakette 58 test.
- **Sprint 12 (8 Kasım 2026, Aşama 5 ikinci bölüm):** mesajlaşma (`apps/api/src/messages/`, `packages/shared/src/messages.ts`):
  talebe tek ilk mesaj, haklar (günlük → ek, hak defteri), sohbet, araç kartı, alıcıdan araca mesaj (Karar 27), numara
  paylaşımı, engelle, mesaj güvenliği kuralları, `/ws` anlık iletim (Redis yayını). Mesaj gövdesi `MESSAGE_SECRET_KEY` ile
  şifreli (canlıda zorunlu). Web `/mesajlarim`, mobil Mesajlar sekmesi ve `app/sohbet/[id].tsx`. API'de 109, ortak pakette 61 test.
  Telefon başına yeni SMS kodu için kısa bekleme var; ekran görüntüsünde aynı numarayla art arda giriş 429 verir.
- **Sprint 13 (8 Kasım 2026, Aşama 5 bitti):** yıldız ve rozetler (`apps/api/src/trust/`, `packages/shared/src/ratings.ts`),
  hile kuralları (yeni hesap, aynı cihaz ve ağ özeti, bağlı hesap), seller_stats, galeri takibi, çalışan başına günlük ilk
  mesaj sınırı, konsol `/puan`. API'de 111, ortak pakette 63 test. Şikâyet oranı moderasyona kadar 0.
- **Ekran görüntüsü betikleri** (scratchpad `betik/`): Edge başsız açılır; Windows'ta `p.kill()` yetmez, betik sonunda
  profil klasörünü kullanan bütün `msedge.exe` süreçleri kapatılır. Çekimden sonra Edge sayısını kontrol et.
- **Sprint 14 (8 Kasım 2026, Aşama 6 ilk bölüm):** web ödemeleri (`apps/api/src/payments/`, `packages/shared/src/payments.ts`):
  sipariş, Karar 39 onayları, PayTR bağdaştırıcısı ve sahte sağlayıcı (`PAYMENT_PROVIDER`), bildirim bir kez işlenir,
  haklar ve öne çıkarma (`demand_promotions`), e-Arşiv sağlayıcısı (`EARSIV_PROVIDER`), web `/haklarim`. API'de 113,
  ortak pakette 66 test. İade tablosu ve kilidine dokunulmadı. Ekran görüntüsünde sahte ödeme çerçevedeki sayfaya
  `fetch(src, {method:'POST', body:'durum=success'})` ile onaylanır.
- **Sprint 15 (8 Kasım 2026, Aşama 6 ikinci bölüm):** galeri abonelikleri (`subscriptions.service.ts`,
  `subscription-billing.ts`, `packages/shared/src/subscriptions.ts`; PayTR Kart Saklama, otomatik yenileme, üst pakete
  geçiş, iptal, askı ve "pasif" paket; erişim kuralı `galleryAccess`), web galeri paneli `paket.tsx`, mağaza ödemeleri
  (`store.service.ts`, `STORE_PROVIDER`, `store_events`), mobil `app/haklarim.tsx`, konsol `/odemeler`. API'de 118,
  ortak pakette 71 test. Mağaza iadesinde kullanılmamış hak düşülür (sahip kararı). Test ve ekranda abonelik dönem sonu, aboneliğin
  `current_period_end` alanı geçmişe çekilerek denenir (başlangıç da geriye alınmalı: dönem kısıtı).
- **Galeri adına talep (8 Kasım 2026):** `POST /demands { kategori, hesap }`, `GET /demands/rights?hesap=`, hakla öne
  çıkarma `POST /demands/:id/promote { tur }`; web ve mobil sihirbazda "Kimin adına?". API'de 120 test.
- **İade akışı (8 Kasım 2026, sahip onayıyla):** öneri `apps/api/src/refunds/` (konsol › Ödemeler › "İade öner"),
  Sahip Onay kuyruğundan onaylar (tutarı düşürebilir), yürütme yalnızca `src/refund-executor.ts` sürecinde
  (`refunds/executor/`; API ve işçi içe aktarmaz, test denetler). Kilit tetikleyicileri değişmedi. API'de 124 test.
  İade akışında yeni bir değişiklik yine önce sahibe sorulur.
- **Sprint 17 (8 Kasım 2026, Aşama 7 bitti):** bildirim katmanı (`apps/api/src/notifications/`,
  `packages/shared/src/notifications.ts`): olay → tercih ve rıza → kanal sırası → teslim kaydı (`deliveries` silinmez).
  Uygulama içi, push (FCM), e-posta (SMTP, yerelde Mailpit :8025), SMS yalnızca kritik. Ticari iletide onay, haftada 2,
  sessiz saat, tek tıkla ayrılma, İYS olayı, ısınma, itibar denetimi (sınır aşılırsa ajan ticari e-postayı durdurur).
  Web zil, `/bildirimler`, `/ayarlar`; mobil bildirimler, ayarlar, push kaydı (`lib/push.tsx`). Konsol › Büyüme:
  Şablonlar (sürümlü, `notification_templates`), Bildirim merkezi, Teslim raporu, Otomatik akışlar (`notification_switches`,
  `automations.ts`). Yeni olay eklerken `notification-events.ts` eşlemesine ve `NOTIFY_TEMPLATES`'e ekle. E-postada açılma
  ve tıklama izlenmez. Çalışan olaylarının sahibe iletilmesi Aşama 8'de. API'de 134 test.
- **Sprint 18 (8 Kasım 2026, Aşama 8 ilk bölüm):** şikâyet ve moderasyon (`apps/api/src/moderation/`,
  `packages/shared/src/moderation.ts`): şikâyet (mesaj, talep, araç), konsol Moderasyon (kuyruk, maskeli kanıt, karar,
  itiraz, içerik filtreleri, yasaklı kelimeler), askı (`SanctionService.assertCanMessage`), gizleme (talepte
  `passive_reason = moderasyon`, araçta `moderated_at`, mesajda `hidden_at`), kalıcı engelleme PERMANENT_BAN onayıyla,
  ajanın kural tabanlı kapora kontrolü, web `/itiraz/[id]` ve mobil itiraz ekranı. API'de 137, ortak pakette 74 test.
- **Sprint 19 (8 Kasım 2026):** kullanıcı ve galeri kartı (`apps/api/src/people/`, konsol `/kullanicilar`): maskeli
  iletişim ve gerekçeyle açma, geçmiş, karttan uyarı/askı/engelleme (moderasyon kaydı `source = calisan`,
  `target_type = kullanici`), hak tanımlama sınırı, oturum kapatma, not; kara liste (telefon, IBAN, IP; HMAC özeti).
  API'de 141 test.
- **Sprint 20 (8 Kasım 2026):** destek ve yardım merkezi (`apps/api/src/support/`, `packages/shared/src/support.ts`):
  web `/yardim` ve `/destek`, Mesajlarım'da sabit destek satırı, konsol `/destek`, mobil yardım ve destek ekranları,
  ilk yanıt süresi, memnuniyet sorusu, imzalı destek e-postası ucu. API'de 144 test.
- **Sprint 21 (9 Kasım 2026):** KVKK araçları (`apps/api/src/privacy/`, `packages/shared/src/kvkk.ts`): verilerimi indir
  (SMS kodu `AuthService.confirmCode`, işçi hazırlar), KVKK başvuruları (konsol `/kvkk`), rıza kayıtları (konsol
  `/riza`), Ayarlar › Gizlilik'te engellediklerin ve kişisel verilerim, mobil `app/kisisel-verilerim.tsx`. Hesap kapatma
  iadeye dokunduğu için sahibe soruldu ve onaylandı (aşağıda).
- **Hesap kapatma (9 Kasım 2026, sahip onayıyla):** `apps/api/src/privacy/account-closure.service.ts`, `POST /me/close`.
  Kişisel veri hemen anonimleşir (telefon alanı `kapali:<id>`, numara serbest kalır), kimlik kaydı `account_closures`'ta
  5 yıl şifreli. Kullanılmamış web haklarının iadesi yalnızca öneri: ajan servis hesabı (`approvals/agent-actor.ts`,
  rol AGENT, giriş yapamaz) Onay kuyruğunda REFUND açar, yalnızca Sahip onaylar. Galeri sahibi buradan kapatamaz.
  API'de 149 test.
- **Sprint 22 (9 Kasım 2026):** saklama, imha, VERBİS, ihlal ve resmi talepler (`apps/api/src/privacy/retention.service.ts`,
  `compliance.service.ts`, `packages/shared/src/retention.ts`; konsol `/imha`, `/ihlal`). İmha listesini yalnızca Sahip
  onaylar, işçi 1 Ocak / 1 Temmuz'da yapar; yalnızca ekleme yapılan tablolar (işlem kaydı, hak defteri, rıza) imha
  dışında: satırları hiç değişmez. İşlem kaydındaki IP yarıyıl dönem anahtarıyla şifreli (`audit/ip-vault.ts`,
  `pii_keys`); 2 yıl sonra imhada anahtar silinir (RR040: süresi dolmadan silinemez). IP okumak için `AuditService.ips.open`.
  Depoya `Storage.delete` eklendi. API'de 152, ortak pakette 76 test.
- **Sprint 23 (9 Kasım 2026):** yapay zekâ ağ geçidi ve bütçe (`apps/api/src/ai/`, Karar 57), Rengarenk Ajanı
  (`apps/api/src/agent/`, `packages/shared/src/agent.ts`, Karar 41), konsol `/ajan` ve `/yapay-zeka`. Sağlayıcı
  `AI_PROVIDER` (yerelde ve testte `fake`, canlıda `fake` yasak); istekler her zaman `maskPii` ile maskelenir. Durdurma
  düğmesi `ajan` özellik anahtarı: ajanın her otomatik işi önce `agent.calisiyor()` sorar ve işlemini aynı veritabanı
  işleminde `agent.kaydet` ile yazar. Ajan iade yapamaz (yalnızca öneri). Türkçe ekler `packages/shared/src/tr-ek.ts`
  (`ekle('İzmir', 'bulunma')`). Yerel betik için Nest bağlamı `node --env-file-if-exists=../../.env --import
  @swc-node/register/esm-register` ile çalışır (tsx dekoratör meta verisi üretmez). API'de 156, ortak pakette 80 test.
- **Sprint 24 (9 Kasım 2026):** çalışan uyarıları (`apps/api/src/staff-alerts/`, `packages/shared/src/staff-alerts.ts`):
  olaydan ve saatlik denetimden uyarı, Sahip her uyarıyı alır, diğer alıcılar kuralın yetkisi ya da rolüyle; kritik uyarı
  kapatılamaz. Konsolda üst çubukta "Uyarı N", `/uyarilar`, Büyüme › Zamanlanmış raporlar; şirket e-postasına teslim (işçi).
  Uyarı metnine kişisel veri yazılmaz (e-posta Google Workspace'e gider). Kritik uyarı SMS ile gitmez (sahip kararı).
  Yerelde e-postalar Mailpit'e düşer. API'de 162 test.
- **Sprint 25 (9 Kasım 2026):** ajanın kalan işleri: talep metninde telefon/IBAN/e-posta/bağlantı herkese açık çıktıda
  her zaman gizli (`hideDemandText`; yeni bir yerde talep başlığı gösterirken bunu kullan) ve ajan düzeltme ister;
  destek yanıtı (`support-agent.ts`, güven %90 eşiği, iade/hesap kapatma/dolandırıcılık insana, ajan iade önerisi
  açmaz); spam kısıtlama; SMS yedeğe geçiş akışa yazılır; ana ölçü uyarısı. API'de 167, ortak pakette 82 test.
- **Sprint 26 (9 Kasım 2026):** kullanıcı tarafı yapay zekâ (Karar 42): talep asistanı (`talep_asistani`), ilk mesaj
  taslağı, mesaj güvenliği (`mesaj_guvenligi`, işçide), toplu yükleme yardımı (`toplu_portfoy`), destek sohbeti
  (`/support/tickets/oneri`). Yapay zekâ çıktısı her zaman şema, katalog ve `scanMessage` ile doğrulanır. `kelimeVar`
  harf ve rakam sınırıyla arar ("2" "2019"da bulunmaz); sayıdan ibaret seri adı ("3") tek başına aranmaz. API'de 172,
  ortak pakette 86 test.
- **Sprint 27 (9 Kasım 2026):** galerinin 1 yıldıza itirazı (`apps/api/src/trust/rating-appeal.service.ts`, konsol
  Moderasyon › İtirazlar), Ayarlar › İletişim ve Profil (`packages/shared/src/contact.ts`; telefon/WhatsApp izni, aranabilir
  saatler dışında numara gizli, il/ilçe, görünen ad; yeni talep bunlarla açılır), numarayı değiştir (`/me/phone/*`),
  ücretsiz ilk talep numara ve hesap başına bir kez, cihaz kara listesi (mobil `kurulumKimligi()`, `devices.install_hash`),
  giriş bağlantısı (`login_links`, kod teslim kaydında şifreli ve gönderimden sonra silinir, web `/giris/baglanti`).
  Oturum düzeltmesi: elle kapatılan oturumun jetonu yalnızca reddedilir; bütün oturumları kapatma yalnızca döndürülmüş
  jeton tekrar gelince (`sessions.rotated`). API'de 178, ortak pakette 88 test. Testte aynı numaraya art arda kod için
  `otpChallenge.createdAt` geri alınır (60 sn bekleme). Galeri müşteri yönetimi: konsol `/galeri-musterileri`
  (`gallery-care.service.ts`, risk `churnRisk` ortak pakette), galeri kartında sorumlu çalışan. Kurallar ve fiyatlar:
  fiyat listesi `price_books` (`apps/api/src/pricing/`); paket fiyatı veya sınırı okurken `GALLERY_PLANS` yerine
  `await this.pricing.plans()` (ürün web fiyatı `productTl`) kullan; mobil (mağaza) fiyatları değişmez. API'de 179 test.
- **Sprint 28 (9 Kasım 2026, Aşama 9 ilk bölüm):** kontrol paneli (`apps/api/src/dashboard/`, konsol `/panel`): ana
  ölçü, ölçüler ve neden analizi, grafik notları (`grafikNotu` değişiklikle aynı işlemde), bakılacaklar, aylık hedefler
  ve `hedef_sapma` uyarısı. Talep platformu `demands.platform`. Raporlar (`report.service.ts`, konsol `/raporlar`): huni,
  harita, gelir, modeller, birim ve kohort; reklam ve deneyler bağlantı bekliyor. API testlerinde `hookTimeout` 60 sn
  (her dosya şemayı sıfırlayıp bütün göçleri uygular). Kampanyalar ve segmentler (`apps/api/src/campaigns/`, konsol
  `/segmentler`, `/kampanyalar`): gönderim bildirim katmanından (`notify({ kanallar, campaignId })`), 1.000 kişi üstü
  BULK_SEND onayı. Açılış sayfaları (`apps/api/src/landing/`, konsol `/acilis-sayfalari`; web kök adreste yakalama
  rotasından; yeni bir site rotası eklersen `LANDING_RESERVED`'a da ekle). Zamanlanmış raporlar
  (`scheduled-report.service.ts`, konsol `/zamanlanmis-raporlar`): haftalık ve aylık rapor e-postası PDF ekiyle
  (`report-pdf.ts`, pdfkit + `apps/api/assets/fonts/`), yeni rapor, galerilere aranan modeller (açmak BULK_SEND onayı).
  Aynı onay türünü iki modül kullanırsa `executor.register(tür, işlev, konu)`. Akış düzenleyicisi (`notifications/flows.ts`):
  tetikleyici ilk iletiyi gönderince `flows.baslat(akış, kişiler, bağlam, ref)`; yeni akış tetikleyicisi eklersen hedefini
  `FlowService.hedefte`'ye, adım şablonunu `akis.adim.<akış>` olarak ekle. Banner ve vitrin (`apps/api/src/content/`,
  konsol `/banner-ve-vitrin`): web ve mobil `components/banner.tsx` (yer: ana sayfa, galeri paneli, talep listesi ve
  detayı, duyuru, üst şerit). Ana sayfa düzeni (`content/home.service.ts`, konsol `/ana-sayfa-duzeni`): yeni bir ana sayfa
  bölümü eklersen `HOME_SECTIONS`'a, web `ana-duzen.tsx` ve mobil `index.tsx` bölüm haritasına ekle; tasarımda yoksa
  varsayılanı kapalı. Kuponlar (`payments/coupon.service.ts`, konsol Kampanyalar › Kuponlar): onay isteğinin
  `payload.yalnizSahip` işareti yalnızca sahibe karar verdirir. A/B (`experiments.ts`, `dashboard/experiments.service.ts`):
  kol saklanmaz, kimlikten hesaplanır (`armOf`). Reklam ölçümü (`apps/api/src/ads/`, `packages/shared/src/ads.ts`, web
  `lib/olcum.ts`; Karar 35): yeni dönüşüm olayı eklersen `AD_EVENTS`'e ekle ve işlemin içinde `ads.olay(tx, …)` çağır
  (onay yoksa yazmaz); tarayıcıda aynı `ref` ile `olcumOlayi`. Meta'ya mobil olay gitmez (SDK bekliyor). Yerelde işçi
  açılışta gece harcama çekimini çalıştırır; sahte sağlayıcı boş döndüğü için dünün `ad_spend` satırları silinir.
  Fiyat deneyleri (`pricing/price-experiments.service.ts`): bireysel web fiyatını okurken `pricing.current()` yerine
  `pricing.bookFor(userId, true)` kullan (galeri ve mağaza liste fiyatı); deney Sahip onayıyla başlar.
  Arayüz deneyi (`flags/ui-experiments.ts`): yeni deney için `UI_EXPERIMENTS`'e tanım ekle, istemcide kolu `GET /flags`
  ile oku, adımı görme ve geçmeyi `POST /flags/deney/:anahtar` ile bildir; deney anahtarın yüzdesi 1–99 iken sürer.
  API'de 196, ortak pakette 117 test.
- **Kalan geliştirmeler (10 Kasım 2026, sahip "sırayla hepsini yap" dedi):** 1) Taleplerim istatistikleri
  (`demands.view_count`, `POST /talepler/:no/goruntu`, `GET /demands/mine` → `istatistik`) bitti; 2) web analitiği ve
  arama günlüğü (`apps/api/src/analytics/`, çerezsiz, günlük tuz; `POST /analitik/ziyaret`, `POST /talepler/arama`;
  tablolar `web_traffic_daily`, `search_log_daily`) bitti. Sunucu tarafında çekilen listeyi sayma: arama istemciden
  bildirilir. 3) Ön bilgilendirme formu ve sözleşme PDF'i fatura e-postasına (`payments/contract-mail.service.ts`,
  `common/document-pdf.ts`, işçide `odeme-sozlesme`) bitti. 4) Mobil toplu yükleme: tasarım gereği mobil düğme web
  panelin Toplu yükleme bölümünü açar. 5) Rozet eşikleri fiyat listesinde (`rozetler`, `badgeRulesOf`; rozet okurken
  `TrustService.kurallar()`), makyaj başına fotoğraf (`catalog_images.facelift`, gösterimde `makyajFoto`), plaka
  bulanıklaştırma (sharp; özgün kopya saklanır). 6) Araç favorisi (`vehicle_favorites`), fotoğraf kopya tespiti (dHash
  `portfolio_photos.phash`, kural şikâyeti `kopya_foto`). 7) Komşu il: `il-komsulari.ts` (OpenStreetMap kökenli, atıf
  Veri kaynakları'nda), kategori şemasında `konumKapsami`; başlangıç "il", davranış değişmedi. Hepsi bitti. Galeri fotoğrafı
  temsilî görsel (Karar 34): Commons'ta adayı olmayan nesle izinli portföy fotoğrafı aday (`catalog_images.origin`),
  plaka seçimle birlikte bulanıklaşır; izin, fotoğraf, moderasyon ya da hesap kapanışında aynı işlemde
  `galeriFotoGeriCek` (yeni bir izin kaldırma yolu eklersen bunu çağır). `catalog_images` yalnızca ekleme kabul eder
  (silme yok, durum değişir). Nesilde fotoğraf yoksa talep sayfasında "önceki nesil" (`nesilFoto`). API'de 203,
  ortak pakette 120 test.
- **Sprint 29 (10 Kasım 2026) web düzeltmeleri:** kaybolan yenileme yanıtı için 2 dk hoşgörü (`REUSE_GRACE_MS`,
  `sessions.replaced_by`; yerine açılan oturum kullanıldıysa yine çalınma sayılır), yenileme `keepalive`, Hesabım açılır
  menüsü ve "Çıkış yap" (`cikisYap`), çıkış ucu gövdesiz istekte JSON türü göndermez. Konsolun "sonra" duran dört ekranı
  (yasal metinler ve yardım, talepler ve portföy, sistem sağlığı, tasarım değerleri) planda Sprint 29'da.
  Yasal metinler ve yardım bitti: `consents/legal.service.ts` (LEGAL_TEXT onayı yalnızca sahip, RR042 onaylanmış taslak
  değişmez, esaslı değişiklikte `yasal.guncellendi` ve girişte `/me/legal/pending`; web `components/yasal-onay.tsx`,
  mobil aynı adla), `support/help.service.ts` (`help_articles`; destek önerisi `HelpService.oner`). Yeni yasal metin
  anahtarı eklersen `LEGAL_TEXTS` ve `LEGAL_PATHS`'e (ortak paket `legal.ts`) ekle. Talepler ve portföy bitti:
  `moderation/listings.service.ts` (gizleme çalışan kaynaklı moderasyon kaydı + `decide`; düzeltme `correction_note`,
  kategori önerisi `suggested_category_id`). Sistem sağlığı bitti: `health/system-health.service.ts` (işçide dakikalık
  yoklama, `health_samples`), istek özeti `observability/request-stats.ts` (Redis tembel bağlanır: önce `redisHazir`),
  yedek `backup_runs` (yazan sunucudaki betik). Tasarım değerleri bitti: `content/design.service.ts`, ortak `design.ts`
  (`FONTS` 70 yazı tipi, `designProblems`, `applyDesignColors`, `radii`). Web'de renk için `lib/renk.ts`'teki `colors`'ı
  kullan (paletin sekiz rengi `var(--rr-*)`) ve köşede `var(--rr-kart-kose)` / `--rr-buton-kose` / `--rr-etiket-kose`;
  yeni gömülü palet hex kodu yazma. SVG niteliğinde (`fill=`, `stroke=`) CSS değişkeni çalışmaz, `style={{ fill }}`
  kullan. Mobilde köşe `radii.kart` / `radii.buton` / `radii.etiket`. Sprint 29 bitti. API'de 210, ortak pakette 125 test.
- **Tasarım değerleri 2 (10 Kasım 2026):** köşe sayıyla yazılmaz: web `calc(var(--rr-kart-kose) * N / 18)` (kart, 16 px ve
  üstü) ya da `calc(var(--rr-buton-kose) * N / 14)`, mobil `kartOran(N)` / `butonOran(N)`, hap `Math.min(radii.etiket, N)`;
  tam daire (`'50%'`, mobilde genişliğin yarısı) sayı kalır. Renkli zeminde yazı `colors.onBlue` / `onPink` / `onYellow` /
  `onGreen` (web `var(--rr-maviYazi)` …), kart zemini `colors.surface` (`--rr-kart`), ikincil metin `colors.muted`
  (`--rr-soluk`). Mobilde modül düzeyindeki sabite `colors.`/`radii.` yazma (yükleme anında bir kez okunur); gerekirse
  getter (`get borderColor() { return colors.line; }`). Yeni tasarım rengi eklerken `DESIGN_COLORS` ve `colors`'a ekle;
  eski sürümler `hex.default` ile tamamlanır. Yerel Docker servisleri `restart: unless-stopped`; ana sayfa API'ye
  ulaşamazsa açık kaldıkça yeniden dener. API'de 212, ortak pakette 128 test.
- **Durum belgesi ve demo veri (10 Kasım 2026):** `docs/DURUM-VE-TEST.md` (biten/kalan işler, kararlar, mobil test,
  giriş bilgileri); iş bitince bunu da güncelle. Demo veri `pnpm --filter @rengarenk/api demo` (`src/cli/demo-veri.ts`,
  uçlardan kurar, yarıda kalırsa devam eder; numaralar 0555 100 00 0x bireysel, 0555 200 00 0x galeri; çalışanlar
  `*@rengarenksite.com`, o anki doğrulama kodu `demo kod <e-posta>`).
- **AWS, alan adı ve Bedrock (12 Kasım 2026, sahip kararları):** barındırma AWS Frankfurt (Lightsail; Karar 37), alan adı
  rengarenksite.com (kodda, ayarlarda ve belgelerde; yönetim girişi `STAFF_EMAIL_DOMAINS=rengarenksite.com`). Kapalı test
  sunucusu `rengarenk-1` açıldı (63.184.9.173, SSH `~/.ssh/rengarenk_lightsail`, ayrıntı `deploy/README.md` › Kapalı test
  ortamı); imajlar sunucuda derlenir, `.env.prod` yalnızca sunucuda, 443/22 yalnızca sahibin IP adresine. İade yürütücü
  modülüne `PricingCoreModule` eklendi (sahip onayıyla; `test/refund-executor-module.test.ts` modülü canlıdaki gibi kurar).
  Yapay zekâ
  AWS Bedrock (`AI_PROVIDER=bedrock`, `BedrockAiProvider` Converse API, model tablosu `AI_MODELS.bedrock` Nova Lite/Pro
  `eu.` profili; Vertex de duruyor, `aiCostMicroUsd(sağlayıcı, boy, …)`). AWS Activate Founders başvurusu yapıldı (sonuç
  5–10 iş günü); o zamana kadar 100 USD yeni hesap kredisi. Tanıtım sayfası `deploy/tanitim` (Güzel Hosting, cPanel).
  API'de 216 test.
- **Üyelik ve giriş (12 Kasım 2026, Sprint 30, Karar 18 ve 50):** SMS sağlayıcısı şirket ve marka tescili istediği için
  giriş telefona bağlı olmaktan çıktı. Üye ol (`/auth/register` → `/auth/register/verify`; bilgiler `pending_signups`'ta,
  şifre scrypt özeti `auth/password.ts`) ve Giriş yap (`/auth/login`, `/auth/google/*`, `/auth/apple`) ayrı;
  `apps/api/src/auth/signup.service.ts`. Telefon kodu yalnızca üyelikte, numara değiştirirken ve hassas işlem onayında
  (`/auth/code`, oturumla kendi numarasına); kanallar `VERIFY_CHANNELS` (WhatsApp Cloud API `sms/code-sender.ts`, yedek SMS).
  Google üye girişi yönetim girişinin bağdaştırıcısıyla, ayrı istemci (`USER_AUTH_PROVIDER`, yerelde sahte: web
  `/gelistirme/google`); dönüş web'de `/api/oturum/google/donus`, mobil girişte `state` "m." ile başlar ve kod
  `rengarenk://google` ile uygulamaya gider. Apple `APPLE_AUTH_PROVIDER`. Üyelik jetonu ayrı anahtarla imzalı (oturum
  yerine geçmez). E-posta tekil; `PATCH /me` e-postayı değiştirmez (`POST /me/email`). Şifre sıfırlama işçiden
  (`hesap.sifre_istendi`, şifreli teslim kaydı). Testlerde kullanıcı `uyeOl(app, telefon)` ile açılır (`test/helpers.ts`;
  kayıtlıysa e-posta ve şifreyle girer). Demo girişi `demo<son 7 hane>@ornek.com` / `Demo1234`. Canlıda sahte Google ve
  Apple yasak: `.env.prod`'a `USER_AUTH_PROVIDER=none`, `APPLE_AUTH_PROVIDER=none` (istemci gelene kadar). API'de 227 test.
- **Test sunucusu eşitlendi (13 Kasım 2026):** veritabanı sıfırlandı, yereldeki katalog ve ayarlar `deploy/veri-aktar.py` ile
  taşındı (kullanıcı verisi taşınmaz). Google girişi açık: konsol `rengarenk-yonetim` (Dahili), üye `rengarenk-uye`
  (Harici, Test modunda yalnızca eklenen test kullanıcıları). Sahip `kemal.caglar@rengarenksite.com`. SES: alan adı ve
  `bildirim.`/`bulten.` alt alan adları doğrulandı; e-posta `akis` alanıyla işlemsel/ticari yapılandırma kümesine gider
  (`sesBasliklari`, `SES_YAPILANDIRMA_ISLEMSEL/TICARI`); üretim erişimi AWS incelemesinde. Sırlar sohbete yazılmaz:
  sahip dosyayı `Desktop\gizli\`'ye kaydeder, değerler ekrana basılmadan sunucuya aktarılır. API'de 229 test.
  Google ya da Apple'dan gelen ad, soyad ve e-posta üyelikte kilitli (jetondaki değer yazılır, formdaki yok sayılır).
  WhatsApp gelene kadar test sunucusunda `VERIFY_CHANNELS=ekran` + `KAPALI_TEST=1`: kod gönderilmez, yanıtta
  `devCode` ile döner; herkese açmadan kaldırılır. Konsol yönlendirmeleri `konsolAdresi` (admin `lib/oturum.ts`) ile:
  kapsayıcıda `req.url` iç adres taşır, `new URL(yol, req.url)` kullanma.
- **Katalog doğruluğu (13 Kasım 2026, sahip isteği: adım adım, önce otomobil):** 1. adım Türkiye'de satılan otomobiller
  (yıl, yakıt, marka, model, paket) TSB'den; ayrıştırıcı `TSB_PARSER = '2026-11-13'`. Doğruluk testi
  `packages/catalog/src/tsb/parse-dogruluk.test.ts` (her satır gerçek bir TSB yazımı); yeni kalıp eklerken oraya da ekle.
  `OV` otomatik vitestir; vitesi yazılmamış tip, otomatik ikizi varsa manueldir (`inferManualGearbox`), yoksa bilinmez kalır
  (tahmin edilmez). Hafif ticari seriler `VAN_SERIES`, pickup `PICKUP_SERIES` (`brands.ts`). Adlarda kısaltma `acronymCase`
  (içe aktarma yalnızca büyük/küçük harf farkında adı günceller). Denetim betiği scratchpad `denetim/denetim.mjs`. 2. adım
  teknik özellikler (vites, güç, kasa, ölçüler) sırada; 2006 öncesi (VMM) Türkiye'ye özgü değildir.
- **Ana liste (16 Kasım 2026, sahip kararı):** otomobil ve SUV'de marka, seri ve yılları sahibin elle derlediği liste
  belirler (`packages/catalog/src/ana-liste/liste.ts`, kaynak `ana`, tablo `catalog_lineup`). Her kaynağın marka ve serisi
  içe aktarmada ana listeye yerleşir (`anaYerlestir`: önce `kurallar.ts`'teki kural, sonra ad anahtarı `adAnahtari`);
  ad benzerliği yetmeyen her durum (alt seri: Kona → Kona Elektrik, farklı ad: Lantra → Elantra, TSB yazım hatası)
  marka marka kuralla bağlanır; kural yazarken TSB tip adına bak, tahmin etme. Liste ya da kural değişince
  `ANA_LISTE_SURUM`'u artır: bütün kaynaklar (`anaKural(...)` ayrıştırıcı sürümü) yeniden işlenir; arşiv için sunucuda
  `katalog:yukle --arsiv`. Yıllar = liste ∪ TSB ∪ yerli (sahip: "birleştir"); vehicle-makes-models tipleri yalnızca
  listedeki serilerde ve bu yıllarda görünür; TSB'de olup listede olmayan seri katalogda kalır (sahip kararı). Kaynak
  konsoldan kapatılırsa eski davranış döner (adlar kalır). Seri anahtarında "+" `arti` olur (206 ≠ 206+). Kural
  çıkarma raporu scratchpad `mm/rapor.py`, tip adı arama `mm/ara.py`. Listedeki bütün markalar bağlandı; kural
  seçenekleri: `tip` (tip adında desen), `yakit`, `ilkYil`, `sonYil`, `marka` (TSB'de başka marka altında: Citroen DS3 → DS,
  FIAT Doğan → Tofaş), `kaynak: '*'` (seri adı ne olursa olsun desen: BMW "320I/4"). Kural ve ad tutmazsa tip adının
  baştaki 1–3 kelimesi bir liste serisinin adıysa ona bağlanır (`basKelimeler`: "LE SABRE (1600)"). Eski TSB yazımları
  `ESKI_KURALLAR` (kurallar.ts sonu); rapor scratchpad `mm/eski-rapor.sql`, deneme `mm/dene.mjs`.
  TSB ayrıştırıcısı `2026-11-17-1`: kısaltılmış vites yazımları (GEARTRO, 9TRON, 8A/T), elektrikli otomobil otomatik;
  eski listelerdeki "İ" küçük harfte birleşik nokta bırakmaz ("Binek", "Şahin").
  Otomobil ve SUV marka seçimini ana liste belirler (sahibin Aixam itirazı, 16 Kasım 2026): `GET /catalog/makes`
  bu kategorilerde yalnızca ana listede serisi olan markaları ve yerli klasik markalarını (Anadol) döndürür; listede
  olmayan markaların kayıtları silinmez, ticari ve motosiklette görünür. Eski TSB'de üretici/ithalatçı birlikte
  yazılmış markalar `MARKA_ADI`'nda ("Fiat/Tofaş" → Fiat, "Chrysler/Jeep" → Jeep, "Ford/Otosan", "Peugeot (Karsan)",
  "Mercury/Ford"); "Willys/Jeep", Dodge/Fargo ve "Rolls-Royce/Bentley" seri adları dağınık olduğu için bağlanmadı.
  Arşivde aynı kodlu tip, markası `markaKanon` ile aynıysa (eski yazım ya da kuralla taşınan marka) yeni markaya geçer.
  Ayrı satılan iki kelimelik seriler TSB'de ilk iki kelimeden (`TWO_WORD_SERIES`: "PASSAT CC" → VW CC, "TIGUAN ALLSPACE",
  "MEGANE SCENIC", "CLIO SYMBOL", "LEGACY OUTBACK"); ikinci kelime paket sayılmaz. Eski Mercedes "280 SL", "450 SLC" SL/SLC'ye.
  Ayrıştırıcı ve ana liste sürümü `2026-11-17-1`. API'de 236, katalogda 65 test.
- **Türkiye'ye özgü tipler, bütün yıllar (16 Kasım 2026, sahip isteği: "10 paketin 3'ü Türkiye'de"):** TSB listesi yalnızca
  Türkiye'de satılan motor ve paketleri taşır. 2006–2019 listeleri (eski siteler adl.tsrsb.org.tr, tsrsb.org.tr,
  tsb.org.tr) İnternet Arşivi'nden `TSB_ESKI` (`packages/catalog/src/tsb/eski.ts`) ile `katalog:yukle --arsiv` sırasında
  indirilir; 2006 listesi 1993'e iner, "15 model yılından eski araçlar" listeleri (2010–2016, kodsuz; kimlik
  `kodsuzMarka`/`kodsuzTip`, cm³ yazımı `eskiHacim`) 1950'ye. Eski Excel (.xls, BIFF) okuyucu `xls.ts` (testte `xlsYaz`).
  Tip kodları bugünkü listeyle aynı (bazı yıllarda "003" gibi sıfırlı yazılır, okuyucu sıfırsız yapar); arşivde en yeni dosyanın yazımı geçerli, başka markadaki aynı kod birleşmez
  (motosiklet kodları yeniden kullanılmış). Seri sayfasında bir yılın TSB ya da yerli tipi varsa o yıl dünya geneli
  listenin (vehicle-makes-models) tipleri gösterilmez. Yerelde önceden indirilmiş dosyalarla `katalog:yukle --arsiv <klasör>`.
  API'de 233, katalogda 58 test.
- **Teknik özellikler (16 Kasım 2026, sahip isteği: "paketlere göre teknik özellikler, Türkiye'ye göre"):** kaynak `ademe`
  (ADEME araç onay verisi, Fransa; Licence Ouverte, atıf zorunlu): yıllık dosyalar 2001–2015 (`ADEME_DOSYALAR`, 2002 ve 2004
  yok) ve ayda bir güncel liste (data.ademe.fr). `packages/catalog/src/ademe.ts` okur (seri `ademeYerlestir`: BMW "320d" →
  3 Serisi, "CLASSE C" → C Serisi), aynı sürümün CNIT satırlarını birleştirir; `catalog_specs` (silinmez, güncellenir).
  `CatalogSpecService` (`catalog-spec.service.ts`) TSB/yerli tipini aynı marka, seri, yakıt, yıl (yayın yılı ya da bir önceki),
  güç ±2 hp (yoksa hacim) ve vites türüyle eşleştirir (`teknikEslestir`; yakıt ya da güç/hacim yoksa eşleşmez) ve
  `catalog_variant_specs`'e özet yazar (türetilmiş, her eşleştirmede baştan). Katalog değişince işçi yeniden eşleştirir
  (imza: ayrıştırıcı + son içe aktarma). Seri ayrıntısında `models[].teknik`; gösterim ortak `teknikSatirlari`
  (web ve mobil sihirbazda model seçilince). Yerelde `katalog:yukle --ademe`, sunucuda `run --rm api node dist/cli/katalog-yukle.js
  --ademe`. 2016–2024 yılları EEA erişimiyle dolacak. API'de 235, katalogda 63, ortak pakette 130 test.
- **Sihirbaz 3. ve 5. adım (17 Kasım 2026, sahip isteği):** kurallar ortak `packages/shared/src/sihirbaz.ts`: kasa ve makyaj
  tek seçilir (değer yine `[kod]`; başka kasa için alternatif), kasa seçilince yıl kasadan gelir, "Yılı kendim gireceğim"
  seçilirse kasa seçilmez; yakıt, vites ve kasa tipi kasanın tiplerine göre daralır (`uygunSecenekler`; seri ayrıntısında
  `tipler`, bilinen değer %80'den azsa daraltılmaz); hasar kaydı, motor hacmi ve gücü sorulmaz (`SIHIRBAZDA_SORULMAZ`,
  şemada durur); sorular adım adım açılır (`kriterSirasi`, `acikSoruSayisi`, "Fark etmez" oturumluk). Bütçe tek rakam:
  taban alan yine `range`, sihirbaz `{ max }` yazar (eşleşme ve arama değişmedi; deney kollarında da tek değer). Adım
  tanıtımı `SIHIRBAZ_TANITIM`, görülenler `users.tanitim` (`POST /me/tanitim`). Açıklama biçimi `aciklama.ts`
  (`[k]`, `[i]`, `[renk=mavi]`, `[boyut=buyuk]`; HTML saklanmaz, sınır düz metne); herkese açık gösterimde
  `hideDemandDescription`, tarama ve yasaklı kelimede `aciklamaDuz`. Talep sayfasında açıklama sabit yükseklikte kaydırılır
  (web `components/aciklama.tsx`, mobil `components/aciklama.tsx`). Yeni bir yerde açıklama gösterirken bunları kullan.
- **Ayrıntılı teknik özellikler ve kesin kasa tipi/çekiş (17 Kasım 2026, sahip isteği):** vehicle-makes-models
  `vehicle-data-json.zip` motor kayıtları (`packages/catalog/src/vmm-teknik.ts`, `VMM_TEKNIK_PARSER`): 0-100, azami hız,
  tork, silindir, çekiş, kasa (nesil adından), ölçüler, depo, bagaj, tüketim, lastik, fren; `catalog_specs` kaynak `vmm`
  (`year_end`, `drive`, `body`, `details`). Makul olmayan değer alınmaz (`MAKUL`); Türkiye'deki adı farklı seri
  `SERI_ESLERI` (Tipo → Egea, Passat CC → VW CC, Accent → Accent Blue). TSB tipine güç ±2 hp, yakıt, yıl ve vitesle eşleşir
  (`vmmEslestir`); `catalog_variant_specs` artık kaynak başına satır (ademe, vmm, tsb) ve gösterimde `teknikOku` açık
  kaynakları birleştirir (kapatılan kaynağınki düşer; ADEME tüketim ve ağırlıkta önce). Çekiş ve kasa tipi tip başına
  yalnızca kesinse (TSB adı ya da tek değer; seride TSB'de 4x4 tip varsa adında yazmayan 4x4 değildir). Sihirbazda kasa tipi
  ve çekiş `kesinSecenekler`: seçilen kasa ve paketteki bütün tipler kesin ve en az iki değer varsa sorulur. Talep
  sayfasında "Açıklama | Teknik özellikler" sekmesi (`teknikBolumleri`, web `components/teknik-tablo.tsx`, mobil aynı
  adla; API `gorunum.alternatifler[].motorlar`). Yerelde `katalog:yukle --ademe` iki kaynağı da yükler. API'de 238,
  katalogda 69, ortak pakette 141 test.
- **Her talep görselli (17 Kasım 2026, sahip isteği; Karar 24, 34):** fotoğraf nesle, kasa kuşağına ya da seriye
  (`catalog_images.series_id`, isteğe bağlı `year_from/year_to`) bağlanır; seçim kuralı tek yerde
  (`apps/api/src/catalog/photo-pick.ts` `talepFotosu`: kodlu kasa → kuşak → yıl → model geneli → en yakın nesil),
  veritabanı tarafı `catalog/talep-foto.ts` (`fotoVerisi`, `talepFotolari`); talep sayfası, arama dizini ve konsol kuyruğu
  bunu kullanır, yeni bir yerde talep görseli gösterirken de bunu kullan. Fotoğraf yoksa web ve mobil
  `components/arac-kapak.tsx` (`AracKapak`, ton `kapakTonu` ortak pakette) gösterilir. Konsol Entegrasyonlar › Araç
  görselleri (`/entegrasyonlar/fotograflar`): görsel bekleyen talepler, elle yükleme (`origin = yukleme`, lisans
  `GORSEL_LISANSLARI`), değiştir (`degistir`), kaldır (`status = kaldirildi`). Fotoğraf değişince aynı işlemde
  `katalog.fotograf_degisti` (işçi serinin taleplerini dizinde yeniler); görselsiz yayına giren talepte `talep_gorseli`
  uyarısı. Kartlarda bütçe tam rakam (`compactBudget` artık kısaltmaz). API'de 241 test.
- **Sıradaki:** Aşama 9 bitti (açık kalanlar plan dosyasında: mobil Meta SDK, Google gerçek bağdaştırıcı, ajanın
  yapay zekâ yorumu); AWS Lightsail'e ilk kurulum (kapalı test ortamı, `deploy/README.md`;
  AWS CLI profili `rengarenk`, bu bilgisayardaki `default` profiline dokunma; e-posta Amazon SES ile, Karar 50; SES hazır olana kadar
  canlıda `EMAIL_PROVIDER=none`), yedek, izleme, SOPS (`.env.prod` ve `.env.iade`). Bir sprint bitince plan kutularını işaretle ve README'yi güncelle.
- **Sahibin yürüttüğü dış işler:** avukat görüşmesi, TSB yazılı izni, EEA veri erişimi, hesaplar (Apple, Google
  Play, AWS Activate kredisi ve KVKK standart sözleşmesi, SMS, PayTR, e-Arşiv, Google Workspace). Bunlar gelmeden ilgili entegrasyonu
  gerçek anahtarla deneme; test/sahte sağlayıcı kullan.
- **SMS önerisi:** ana sağlayıcı İleti Merkezi (bağdaştırıcı hazır; 11 Kasım 2026'da hesap açıldı, `ILETIMERKEZI_KEY/HASH`
  yerel `.env`'de, API adı `rengarenksite`; bakiye ve `RENGARENK` başlığı bekleniyor; deneme `pnpm --filter @rengarenk/api sms:dene [numara]`). Yedek için aday Netgsm; bağdaştırıcısı hesap açılınca güncel API
  belgesine göre `apps/api/src/sms/` altına yazılacak. Fiyatlar teklifle netleşecek.

## Çalışma biçimi

- Her özellik API, web, mobil ve gerekiyorsa yönetim tarafıyla birlikte biter (dikey dilim).
- Değişiklikten sonra `pnpm lint`, `pnpm typecheck`, `pnpm test` çalıştır; hata varsa düzelt.
- Commit mesajında ilgili karar numarasını an (ör. "Karar 40").
- Ekran kodlarken `docs/tasarim/` altındaki ilgili `.dc.html` dosyasını aç; renk ve ölçüleri
  oradan al.
- Geri alınamayan işlemlerden (veri silme, göçü geri alma, `git push --force`, canlıya dağıtım)
  önce sahibe sor.
