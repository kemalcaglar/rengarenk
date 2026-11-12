# Canlı ortam el kitabı

Rengarenk canlıda AWS'de, `eu-central-1` (Frankfurt) bölgesinde çalışır (Karar 37, T06; 12 Kasım 2026'da AWS'ye
değişti): Amazon Lightsail'de tek sunucuda Docker Compose, PostgreSQL aynı sunucuda. Alan adı rengarenksite.com. Bu belge ilk kurulumu, günlük işleri ve geri almayı anlatır. Sunucular gelmeden her şey bu
bilgisayarda **canlı provasıyla** denenebilir (aşağıda).

## Uygulama sunucusunda neler çalışır

| Servis                       | İmaj              | Görev                                                                                   |
| ---------------------------- | ----------------- | --------------------------------------------------------------------------------------- |
| caddy                        | caddy:2.10        | 80/443, TLS sertifikasını kendisi alır ve yeniler; alan adlarını servislere yönlendirir |
| api                          | rengarenk-api     | NestJS API (:4000, dışarıya yalnızca Caddy üzerinden)                                   |
| worker                       | rengarenk-api     | Outbox aktarıcısı, onay yürütme, süre dolumları (`node dist/worker.js`)                 |
| web                          | rengarenk-web     | Kullanıcı sitesi (rengarenksite.com)                                                    |
| admin                        | rengarenk-admin   | Yönetim konsolu (yonetim.rengarenksite.com)                                             |
| migrate                      | rengarenk-migrate | Tek seferlik: veritabanı göçleri (`prisma migrate deploy`)                              |
| redis, opensearch, seaweedfs | resmî imajlar     | Önbellek ve hız sınırı, arama, dosya deposu (S3)                                        |

## İlk kurulum (sunucular gelince)

0. **KVKK:** AWS ile standart sözleşme imzalanmış ve 5 iş günü içinde Kurum'a bildirilmiş olmalı (Karar 37).
   Gerçek kullanıcı verisi bundan önce canlıya girmez.
1. **Sunucu:** Lightsail, `eu-central-1`, Ubuntu; statik IP; güvenlik duvarında yalnızca 80/443 ve SSH. Kurulum
   `rengarenk` AWS CLI profiliyle (IAM kullanıcısı `rengarenk-kurulum`). Docker Engine ve compose eklentisi. `deploy` adında bir kullanıcı, `/srv/rengarenk` klasörü.
2. **DNS:** `rengarenksite.com`, `www`, `api`, `yonetim` kayıtları uygulama sunucusunun IP adresine.
3. **Dosyalar:** bu klasördeki `compose.prod.yml` ve `Caddyfile` → `/srv/rengarenk/`.
4. **Ortam değişkenleri:** `.env.prod.example`'dan `/srv/rengarenk/.env.prod`. İade yürütücü için ayrıca `.env.iade.example`'dan `/srv/rengarenk/.env.iade` (yalnızca `iade-yurutucu` kapsayıcısı okur; PayTR iade bilgileri yalnızca burada). Değerler depoda SOPS ile
   şifreli tutulur (`deploy/secrets.prod.enc.env`, kurulumu Sprint 4'te sunucuyla birlikte). Canlı kipte API
   eksik değerle açılmaz; neyin eksik olduğunu günlüğe yazar.
5. **Dosya deposu anahtarları:** `seaweedfs.s3.example.json`'dan `/srv/rengarenk/seaweedfs.s3.json`.
6. **Google ile yönetim girişi (T10):** Google Cloud Console › API'ler ve Hizmetler › Kimlik bilgileri ›
   OAuth istemci kimliği (Web uygulaması). Yetkili yönlendirme adresi:
   `https://yonetim.rengarenksite.com/api/oturum/google/donus`. İzin ekranı türü: Dahili (yalnızca Workspace
   hesapları). Kimlik ve gizli anahtar `.env.prod` içine (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
7. **GitHub:** `production` ortamı ve gizli değerler `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`. API adresi
   farklıysa depo değişkeni `PUBLIC_API_URL` (varsayılan `https://api.rengarenksite.com`).
8. **İlk sürüm:** `v0.1.0` etiketi (sahibin onayıyla). İş akışı imajları derler, göçleri çalıştırır, servisleri açar.
9. **İlk Sahip hesabı** (bir kez):
   `docker compose -f compose.prod.yml run --rm api node dist/cli/sahip.js <şirket e-postası> "<ad soyad>"`.
   Sonra yönetim konsoluna Google hesabıyla girilir; ilk girişte doğrulama uygulaması kurulur.
10. **Yönetim konsolunu kısıtla:** `Caddyfile` içinde `yonetim` bloğuna şirket ağı ve VPN IP listesi.

## Kapalı test ortamı (12 Kasım 2026'dan beri)

KVKK standart sözleşmesi bildirilene kadar sunucu dışarıya kapalı bir test ortamıdır; gerçek kullanıcı verisi girmez.

| Konu            | Değer                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| Sunucu          | Lightsail `rengarenk-1`, `eu-central-1a`, Ubuntu 24.04, `large_3_0` (8 GB, 2 vCPU, 160 GB), 4 GB takas |
| Sabit IP        | `rengarenk-ip` → 63.184.9.173 (IPv6 da açık)                                                           |
| SSH             | `ssh -i ~/.ssh/rengarenk_lightsail deploy@63.184.9.173` (anahtar yalnızca sahibin bilgisayarında)      |
| Güvenlik duvarı | 80 herkese (yalnızca TLS sertifikası ve HTTPS'e yönlendirme); 443 ve 22 yalnızca sahibin IP adresine   |
| Adresler        | `beta.rengarenksite.com` (site), `api.`, `yonetim.`; kök alan adı tanıtım sayfasında kalır             |
| Klasör          | `/srv/rengarenk`: `compose.prod.yml`, `Caddyfile`, `.env.prod`, `.env.iade`, `seaweedfs.s3.json`       |

- Sırlar sunucuda `openssl rand` ile üretildi; `.env.prod` yalnızca sunucuda (SOPS kurulunca şifreli kopyası depoya).
  `TAG`, `POSTGRES_PASSWORD` ve `WEB_HOSTS` de bu dosyada (`--env-file .env.prod`).
- İmajlar GitHub'a gitmeden sunucuda derlenir: `git archive HEAD` → `~/kaynak`, `~/derle.sh` (etiket
  `test-<commit>`). Canlıya geçişte `v*` etiketi ve `deploy.yml` kullanılır.
- Sahibin IP adresi değişirse: `aws lightsail put-instance-public-ports --profile rengarenk --region eu-central-1
  --instance-name rengarenk-1 ...` ile 443 ve 22 kuralındaki adres güncellenir.
- Bekleyenler: Google OAuth istemcisi (`GOOGLE_CLIENT_*` şimdilik `bekliyor`, yönetim girişi açılmaz), İleti Merkezi
  bakiyesi ve `RENGARENK` başlığı (SMS ile giriş), yedek, izleme, SOPS. `AI_PROVIDER=none` (KVKK).

## Günlük işler

| İş         | Komut (sunucuda, `/srv/rengarenk`)                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| Yeni sürüm | Depoda `v*` etiketi; iş akışı kendisi günceller                                                         |
| Geri alma  | `export TAG=<önceki etiket> && docker compose -f compose.prod.yml up -d` (göçler geriye uyumlu yazılır) |
| Günlükler  | `docker compose -f compose.prod.yml logs -f api worker`                                                 |
| Durum      | `docker compose -f compose.prod.yml ps`                                                                 |
| Bakım modu | Yönetim konsolu › Sistem › Özellik anahtarları ve bakım (kod ve dağıtım gerekmez)                       |

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

- Yedek: pgBackRest ile günlük tam, sürekli artımlı yedek; başka bir AB bölgesindeki Lightsail depolama alanına (`eu-west-1`); ayda bir geri yükleme provası (Karar 56).
  Konsol › Sistem sağlığı ve yedek yedek bilgisini `backup_runs` tablosundan okur. Yedekleme betiği her çalışmada bir
  satır yazar (kişisel veri içermez):

  ```sql
  INSERT INTO backup_runs (id, kind, status, size_bytes, location, started_at, finished_at)
  VALUES (gen_random_uuid(), 'tam', 'basarili', 30064771072, 'Lightsail depolama · eu-west-1', now() - interval '41 min', now());
  -- kind: tam | artimli | geri_yukleme_testi · status: istendi | calisiyor | basarili | hata
  ```

  Konsoldaki "Geri yükleme testini şimdi başlat" `status = 'istendi'` bir `geri_yukleme_testi` satırı açar. Sunucudaki
  zamanlanmış görev bu satırı alır (`calisiyor`), yedeği ayrı bir ortama geri yükler (canlıya dokunmaz), bitince
  `basarili` ya da `hata` ve `started_at`/`finished_at` yazar. Görev ayda bir kendiliğinden de çalışır.
- İzleme: Prometheus, Grafana, Loki, Alertmanager, GlitchTip (Teknik tasarım §13). API `/metrics` hazır.
- SOPS ile şifreli `.env.prod`.
- E-posta: AWS 25. portu varsayılan olarak kapalı tutar; Lightsail konsolundaki formla açılması istenir, açılınca posta
  sunucusu ayrı küçük Lightsail sunucusunda kurulur (Karar 50). O zamana kadar canlıda e-posta kapalı.
