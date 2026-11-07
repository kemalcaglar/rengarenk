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
3. **Kişisel veri Türkiye'de kalır** (Karar 37). GCP'ye yalnızca katalog verisi, sentetik test
   verisi ve maskelenmiş yapay zekâ istekleri gider. Kişisel veri içeren her şema alanı
   `/// @pii` ile etiketlenir.
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
  atanamaz (özel rol kullanılır); yönetim e-posta alanı `rengarenk.com.tr`.
- **Sprint 4 (sunucusuz kısmı) bitti:** özellik anahtarları ve bakım modu (`apps/api/src/flags/`,
  `packages/shared/src/flags.ts`), canlı provası (`deploy/prova/`, el kitabı `deploy/README.md`). API'de 59 test.
- **Sprint 5 (Aşama 2) bitti:** katalog veri modeli, hat (`packages/catalog`, API `apps/api/src/catalog/`), TSB
  iki yoldan (konsoldan yükleme + otomatik çekme, sahip kararı), konsolda "Katalog kaynakları". Yerel veritabanında
  Ekim 2026 TSB listesi, TSB arşivi (2006'ya kadar) ve vehicle-makes-models (1985–2005) yüklü: 1985–2026. API'de 74 test.
- **Eski yıllar (sahip isteği, en az 1990'lar):** TSB arşivi Nisan 2020'den başlar (`GetInsuranceDataArchiveFile`,
  ay kimliği = ay + 1). 2005 ve öncesi vehicle-makes-models'tan; ODbL ve autoevolution kökenli olduğu için kaynak
  ayrı tutulur ve konsoldan kapatılabilir (Teknik tasarım §5). Türkiye'ye özgü eski modeller için Wikidata gerekir.
- **TSB dosyası:** `https://www.tsb.org.tr/InsuranceData/GetLatestExcelFile` → dosya yolu. Kasko bedeli asla
  saklanmaz ve gösterilmez (Karar 33). TSB dosyası depoya girmez.
- **Sıradaki:** Sprint 6: Wikidata ile kasa kuşağı ve makyaj, ad eşleme, EEA, VehiclesDB, Commons fotoğrafları.
  Sprint 7: 14 kategori şeması (Karar 45). Sunucular gelince Radore'ye ilk dağıtım, yedek, izleme, SOPS. Liste:
  `docs/kapsam/03-gelistirme-plani.md` sonundaki sprint bölümleri. Bir sprint bitince oradaki kutuları
  işaretle ve README'deki "Şu an neler var" bölümünü güncelle.
- **Sahibin yürüttüğü dış işler:** avukat görüşmesi, TSB yazılı izni, hesaplar (Apple, Google
  Play, Radore, SMS, PayTR, e-Arşiv, Google Workspace). Bunlar gelmeden ilgili entegrasyonu
  gerçek anahtarla deneme; test/sahte sağlayıcı kullan.
- **SMS önerisi:** ana sağlayıcı İleti Merkezi (bağdaştırıcı hazır, `ILETIMERKEZI_KEY/HASH`
  `.env`'e girilecek). Yedek için aday Netgsm; bağdaştırıcısı hesap açılınca güncel API
  belgesine göre `apps/api/src/sms/` altına yazılacak. Fiyatlar teklifle netleşecek.

## Çalışma biçimi

- Her özellik API, web, mobil ve gerekiyorsa yönetim tarafıyla birlikte biter (dikey dilim).
- Değişiklikten sonra `pnpm lint`, `pnpm typecheck`, `pnpm test` çalıştır; hata varsa düzelt.
- Commit mesajında ilgili karar numarasını an (ör. "Karar 40").
- Ekran kodlarken `docs/tasarim/` altındaki ilgili `.dc.html` dosyasını aç; renk ve ölçüleri
  oradan al.
- Geri alınamayan işlemlerden (veri silme, göçü geri alma, `git push --force`, canlıya dağıtım)
  önce sahibe sor.
