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
```

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

- Ana dal her zaman dağıtılabilir; yarım özellikler özellik anahtarının arkasında kalır.
- Kişisel veri içeren her alan şemada `/// @pii` ile etiketlenir.
- İşlem kaydı ve olay (outbox), değişiklikle aynı veritabanı işleminde yazılır.
- Değişiklik notlarında ilgili karar numarası anılır (ör. "Karar 12").

## Canlıya alma

`deploy/` klasörü sunucuda `/srv/rengarenk` altına kopyalanır, `.env.prod` oluşturulur
(gerçek değerler depoda SOPS ile şifreli tutulur). `v0.1.0` gibi bir etiket gönderildiğinde
`.github/workflows/deploy.yml` imajları GitHub Container Registry'ye derler, sunucuda göçleri
çalıştırır ve servisleri yeniler. Gerekli GitHub gizli değerleri: `DEPLOY_HOST`, `DEPLOY_USER`,
`DEPLOY_SSH_KEY`.
