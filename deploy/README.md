# Canlı ortam el kitabı

Rengarenk canlıda Radore'de çalışır (Karar 37, T06): tek uygulama sunucusunda Docker Compose, PostgreSQL ayrı
sunucuda. Bu belge ilk kurulumu, günlük işleri ve geri almayı anlatır. Sunucular gelmeden her şey bu
bilgisayarda **canlı provasıyla** denenebilir (aşağıda).

## Uygulama sunucusunda neler çalışır

| Servis | İmaj | Görev |
| --- | --- | --- |
| caddy | caddy:2.10 | 80/443, TLS sertifikasını kendisi alır ve yeniler; alan adlarını servislere yönlendirir |
| api | rengarenk-api | NestJS API (:4000, dışarıya yalnızca Caddy üzerinden) |
| worker | rengarenk-api | Outbox aktarıcısı, onay yürütme, süre dolumları (`node dist/worker.js`) |
| web | rengarenk-web | Kullanıcı sitesi (rengarenk.com.tr) |
| admin | rengarenk-admin | Yönetim konsolu (yonetim.rengarenk.com.tr) |
| migrate | rengarenk-migrate | Tek seferlik: veritabanı göçleri (`prisma migrate deploy`) |
| redis, opensearch, seaweedfs | resmî imajlar | Önbellek ve hız sınırı, arama, dosya deposu (S3) |

## İlk kurulum (sunucular gelince)

1. **Sunucu:** Docker Engine ve compose eklentisi. `deploy` adında bir kullanıcı, `/srv/rengarenk` klasörü.
2. **DNS:** `rengarenk.com.tr`, `www`, `api`, `yonetim` kayıtları uygulama sunucusunun IP adresine.
3. **Dosyalar:** bu klasördeki `compose.prod.yml` ve `Caddyfile` → `/srv/rengarenk/`.
4. **Ortam değişkenleri:** `.env.prod.example`'dan `/srv/rengarenk/.env.prod`. Değerler depoda SOPS ile
   şifreli tutulur (`deploy/secrets.prod.enc.env`, kurulumu Sprint 4'te sunucuyla birlikte). Canlı kipte API
   eksik değerle açılmaz; neyin eksik olduğunu günlüğe yazar.
5. **Dosya deposu anahtarları:** `seaweedfs.s3.example.json`'dan `/srv/rengarenk/seaweedfs.s3.json`.
6. **Google ile yönetim girişi (T10):** Google Cloud Console › API'ler ve Hizmetler › Kimlik bilgileri ›
   OAuth istemci kimliği (Web uygulaması). Yetkili yönlendirme adresi:
   `https://yonetim.rengarenk.com.tr/api/oturum/google/donus`. İzin ekranı türü: Dahili (yalnızca Workspace
   hesapları). Kimlik ve gizli anahtar `.env.prod` içine (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
7. **GitHub:** `production` ortamı ve gizli değerler `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`. API adresi
   farklıysa depo değişkeni `PUBLIC_API_URL` (varsayılan `https://api.rengarenk.com.tr`).
8. **İlk sürüm:** `v0.1.0` etiketi (sahibin onayıyla). İş akışı imajları derler, göçleri çalıştırır, servisleri açar.
9. **İlk Sahip hesabı** (bir kez):
   `docker compose -f compose.prod.yml run --rm api node dist/cli/sahip.js <şirket e-postası> "<ad soyad>"`.
   Sonra yönetim konsoluna Google hesabıyla girilir; ilk girişte doğrulama uygulaması kurulur.
10. **Yönetim konsolunu kısıtla:** `Caddyfile` içinde `yonetim` bloğuna şirket ağı ve VPN IP listesi.

## Günlük işler

| İş | Komut (sunucuda, `/srv/rengarenk`) |
| --- | --- |
| Yeni sürüm | Depoda `v*` etiketi; iş akışı kendisi günceller |
| Geri alma | `export TAG=<önceki etiket> && docker compose -f compose.prod.yml up -d` (göçler geriye uyumlu yazılır) |
| Günlükler | `docker compose -f compose.prod.yml logs -f api worker` |
| Durum | `docker compose -f compose.prod.yml ps` |
| Bakım modu | Yönetim konsolu › Sistem › Özellik anahtarları ve bakım (kod ve dağıtım gerekmez) |

## Canlı provası (bu bilgisayarda)

Canlı yapılandırmayı olduğu gibi kullanır; yalnızca PostgreSQL eklenir, Caddy alan adı yerine yerel portlardan
yayın yapar ve değerler `prova/prova.env` içindeki uydurma değerlerdir. Proje adı `rengarenk-prova` olduğu için
geliştirme kapsayıcılarına dokunmaz. Komutlar depo kökünden (PowerShell'de `$env:TAG='prova'`):

```bash
R=ghcr.io/kemalcaglar/rengarenk
docker build -f apps/api/Dockerfile --target runtime -t $R-api:prova .
docker build -f apps/api/Dockerfile --target migrate -t $R-migrate:prova .
docker build -f apps/web/Dockerfile --build-arg APP=web --build-arg NEXT_PUBLIC_API_URL=http://localhost:14000 -t $R-web:prova .
docker build -f apps/web/Dockerfile --build-arg APP=admin -t $R-admin:prova .

export TAG=prova
P="-f deploy/compose.prod.yml -f deploy/prova/compose.prova.yml"
docker compose $P up -d postgres redis
docker compose $P run --rm migrate          # göçler
docker compose $P up -d                     # her şey
docker compose $P down -v                   # bitince sil (veriler dahil)
```

Adresler: web http://localhost:18080, API http://localhost:14000, konsol http://localhost:13001.

## Henüz kurulmayanlar (sunucuyla birlikte, Sprint 4)

- Yedek: pgBackRest ile günlük tam, sürekli artımlı yedek; ikinci veri merkezine; ayda bir geri yükleme provası (Karar 56).
- İzleme: Prometheus, Grafana, Loki, Alertmanager, GlitchTip (Teknik tasarım §13). API `/metrics` hazır.
- SOPS ile şifreli `.env.prod`.
