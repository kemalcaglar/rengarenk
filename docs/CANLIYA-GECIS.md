# Canlıya geçiş listesi

Son güncelleme: 19 Kasım 2026. Siteyi ve uygulamayı herkese açmadan önce yapılacak her işi ve nasıl yapılacağını
toplar. Biten maddenin kutusunu işaretle (`[ ]` → `[x]`); Claude da iş bitince işaretler.

**Kim yapar:**
- **Sen:** hesap açmak, sözleşme imzalamak, kurumlara başvurmak. Bunları Claude yapamaz.
- **Claude:** kod, sunucu ayarı ve kurulum. Her sunucu değişikliği, `git push` ve sürüm için önce senin onayını alır.
- **Avukat / mali müşavir:** hukuki görüş.

**Gizli değerler (anahtar, şifre, jeton):** sohbete yazma. Bir metin dosyasına kaydet, `Desktop\gizli\` klasörüne
koy ve Claude'a yalnızca dosyanın adını söyle. Claude değerleri ekrana basmadan sunucuya aktarır.

---

## Şu an ne durumda (19 Kasım 2026)

| Konu | Durum |
| --- | --- |
| Sunucu | AWS Frankfurt'ta `rengarenk-1` çalışıyor, kapalı test olarak. Yalnızca senin IP adresin girebiliyor. Adres `beta.rengarenksite.com` |
| Yazılım | 59 kararın kodu bitti. Testler, lint ve tip denetimi temiz. Test sunucusunda son sürüm `test-f0c0f12` |
| Konsol girişi | Google Workspace ile açık, sahip hesabın tanımlı |
| E-posta (SES) | Hazır: alan adı doğrulandı, **üretim erişimi verildi** (günde 50.000 e-posta) |
| Telefon kodu | Gönderilmiyor; kapalı testte ekranda gösteriliyor (`VERIFY_CHANNELS=ekran`, `KAPALI_TEST=1`) |
| SMS | Şirket kurulana kadar **yok** (sahip kararı, 19 Kasım 2026). Kod yalnızca WhatsApp'tan gider; canlıda `SMS_PROVIDER=none` |
| Ödeme, fatura, mağaza, push, yapay zekâ | Kapalı (`none`). Kod hazır, hesaplar bekleniyor (e-Arşiv bağdaştırıcısı henüz yazılmadı) |
| Yedek, izleme, sırların şifrelenmesi | **Henüz kurulmadı** |
| AWS kredisi | Activate kabul edildi: 1.000 USD (21 Kasım 2026). Kasım'ın ilk 20 gününde kullanım 11,95 USD, tamamı krediden |

---

## 0. Kararlar (19 Kasım 2026, sahip)

- [x] **Canlı sunucu:** şu anki `rengarenk-1` canlı sunucu olur. Açılıştan hemen önce veritabanındaki test
  kullanıcıları silinir; katalog ve ayarlar yeniden aktarılır. Denemeler bundan sonra bu bilgisayardaki canlı
  provasında yapılır.
- [x] **Ödemesiz açılış:** ödeme ve fatura hesapları gelmeden açılabilir; talepler ve mesajlaşma çalışır, satın
  alma kapalı kalır. Önce kapalı beta (10 galeri, 100 alıcı).
- [x] **Mobil uygulama paket adı:** `com.rengarenksite.app` (alan adının tersi; iOS ve Android'de aynı).
  Mağazaya yüklendikten sonra değişmez.
- [x] **Sürüm kurma:** imajlar sunucuda derlenir (`~/derle.sh`); sunucu anahtarı GitHub'a girmez. `deploy.yml`
  kullanılmaz.
- [x] **Şirket:** şahıs şirketi kurulacak. Kurulana kadar SMS yok, telefon kodu yalnızca WhatsApp'tan gider
  (`VERIFY_CHANNELS=whatsapp`, `SMS_PROVIDER=none`; SMS bildirimleri "atlandı" yazılır).
- [ ] **Barındırma yeri (Frankfurt ya da İstanbul):** avukatın görüşüne göre. AWS İstanbul Local Zone 20 Mayıs
  2026'da açıldı; sunucu, disk, yedek ve S3 orada var, Lightsail ve Bedrock yok (Frankfurt'a bağlı). Veritabanı
  İstanbul'da olsa da AWS yabancı şirket ve e-posta, WhatsApp, Google, Apple yurt dışında kalır; aktarımın tamamen
  kalkıp kalkmadığını avukat söyleyecek (avukat notu S8–S11). İstanbul seçilirse Lightsail yerine EC2'ye taşınma
  1–2 günlük iş, aylık maliyet artar.

---

## 1. Şirket ve hukuk (çoğu hesap bunları ister)

- [ ] **Şirket kuruluşu ve vergi levhası** (henüz kurulmadıysa).
  - Neden: SMS başlığı, PayTR, e-Arşiv, Apple kurumsal hesabı, ETBİS, İYS ve Meta işletme doğrulaması şirket ister.
  - Nasıl: mali müşavirle. Şirket unvanı, adresi, vergi numarası ve MERSİS numarası, ön bilgilendirme formu ile
    sözleşmelere yazılacak; bunları Claude'a ilet.
- [ ] **Marka tescili başvurusu (Türk Patent).** İleti Merkezi, `RENGARENK` başlığı için marka tescili istedi.
  - Nasıl: turkpatent.gov.tr üzerinden e-Devlet ile ya da bir marka vekili aracılığıyla başvur. Başvuru belgesini
    İleti Merkezi'ne gönder.
- [ ] **Avukat görüşmesi.** Bilgi notu ve 46 soruluk liste PDF olarak hazır: masaüstünde
  `Rengarenk-avukat-gorusme-notu.pdf` (19 Kasım 2026). Kaynaklar:
  - `docs/kapsam/01-urun-kapsami.md` › Karar 37 ve 39'daki "Avukata sorulacaklar".
  - Yasal metin taslakları: `docs/kapsam/06-yasal-metin-taslaklari.md`.
  - Ayrıca: AWS ile KVKK standart sözleşmesi; 5651 trafik kayıtları ile fatura kayıtlarının yurt dışında tutulması;
    VUK 538 ilan bildirimi; telefon gösteriminin dayanağı; hakların cayma istisnası; çerezsiz ziyaretçi sayımının
    aydınlatma metnine yazılması.
  - Nasıl: taslak dosyasını avukata gönder, dönen notları Claude'a ver. Claude metinleri düzeltir, sen konsoldan onaylarsın.
- [ ] **KVKK standart sözleşmesi (AWS) ve Kurum'a bildirim.** Bu olmadan canlıya gerçek kullanıcı verisi girmez (Karar 37).
  - Nasıl: AWS ile KVKK'nın standart sözleşmesi imzalanır. AWS'nin hazır bir metni olup olmadığını ve imza yolunu
    avukatla birlikte AWS'ye sor. İmzadan sonra **5 iş günü içinde** Kişisel Verileri Koruma Kurumu'na bildirilir;
    bildirimin biçimini avukat söyler.
  - Aynı işlem, açıldıkça öteki yurt dışı aktarımlar için de yapılır: Firebase/Apple push, Meta ve Google reklam
    ölçümü, hata raporlama.
- [ ] **Yasal metinleri güncelle ve yayınla.**
  - Nasıl: Konsol › Yardım ve yasal metinler › ilgili metin › taslak › düzenle › onayla. Bu metinleri yalnızca sen
    onaylayabilirsin.
  - Bilinen düzeltme: KVKK aydınlatma metni barındırma yeri olarak hâlâ "Radore" yazıyor; "Amazon Web Services,
    Frankfurt (Almanya)" olmalı. Avukatın son hâli gelince bütün metinler (kullanım koşulları, KVKK aydınlatma, çerez,
    ön bilgilendirme, mesafeli sözleşme) yayına alınır. Esaslı değişiklikte kullanıcılardan yeniden onay istenir.
- [ ] **ETBİS kaydı** (e-ticaret bilgi sistemi; Karar 39 yayın öncesi listesi).
  - Nasıl: şirket yetkilisi etbis.ticaret.gov.tr'ye e-Devlet ile girer ve `rengarenksite.com`'u kaydeder.
  - Kayıttan sonra verilen karekodu Claude'a gönder; sitenin altına konur.
- [ ] **İYS kaydı** (ileti yönetim sistemi).
  - Nasıl: iys.org.tr'de hizmet sağlayıcı olarak kaydol, API erişim bilgilerini al ve `Desktop\gizli\`'ye koy.
    Claude İYS bağdaştırıcısını yazar; şu an kodda yalnızca sahte sağlayıcı var.
  - İYS bağlanana kadar ticari e-posta ve kampanya gönderimi kapalı kalır. İşlemsel iletiler (kod, bildirim) bundan etkilenmez.
- [ ] **TSB yazılı izni.** Katalog TSB listesini kullanıyor; yazışma taslağı Claude dokümanında. İzin yazısı gelince
  Veri kaynakları sayfasına işlenir.
- [ ] **VERBİS:** 50 çalışan ve 100 milyon TL bilanço altında zorunlu değil (Karar 37); bir şey yapmana gerek yok.
  Avukat aksini söylerse kayıt yapılır.

---

## 2. Açılış için zorunlu hesaplar

Bunlar olmadan yeni kullanıcı üye olamaz ya da e-posta alamaz.

- [ ] **WhatsApp doğrulama kodu (Karar 18).** Üyelikte telefon kodu önce WhatsApp'tan gider.
  1. business.facebook.com'da işletme hesabı aç. Şahıs şirketi kurulunca işletme doğrulamasını yap (vergi levhası
     ve adres belgesiyle). Doğrulanmamış işletmenin günlük gönderim sınırı düşüktür; kapalı beta için yeter, herkese
     açmadan önce doğrulama gerekir (Meta'nın güncel sınırına bak).
  2. WhatsApp Business Platform'a bir telefon numarası ekle. Bu numara normal WhatsApp'ta kullanılmıyor olmalı.
  3. "Kimlik doğrulama" (Authentication) türünde, Türkçe, adı `rengarenk_kod` olan bir mesaj şablonu oluştur ve
     onaya gönder.
  4. Sistem kullanıcısıyla süresiz bir erişim jetonu üret. Jetonu ve telefon numarası kimliğini
     (`Phone number ID`) `Desktop\gizli\`'ye koy.
  5. Claude sunucuda `WHATSAPP_TOKEN` ve `WHATSAPP_PHONE_NUMBER_ID` değerlerini girer, kendi numarana deneme kodu gönderir.
- [ ] **SMS (şirket kurulunca, açılış için zorunlu değil).** Şirket ve marka tescili başvurusundan sonra İleti
  Merkezi'nden SMS paketi al ve `RENGARENK` başlığını onaylat. Onay gelince Claude sunucuda `SMS_PROVIDER=iletimerkezi`,
  `SMS_SENDER_ID=RENGARENK`, `VERIFY_CHANNELS=whatsapp,sms` yapar ve `sms:dene` ile dener. O zamana kadar WhatsApp'ı
  olmayan kişi üye olamaz.
- [x] **Amazon SES üretim erişimi:** verildi (inceleme sonucu "GRANTED", günde 50.000 e-posta, saniyede 14;
  19 Kasım 2026'da kontrol edildi). Açılışta yalnızca kendi adresin dışındaki bir adrese deneme e-postası atılır.
- [ ] **Google ile üye girişini yayına al.** Şu an Test modunda; yalnızca eklediğin test kullanıcıları girebiliyor.
  Yalnızca ad, e-posta ve profil (`openid email profile`) istendiği için Google incelemesi gerekmez; şimdi yapılabilir.
  Site kapalı testte olduğundan yayına almak bir şeyi açmaz.
  1. console.cloud.google.com, üstten `rengarenk-uye` projesini seç.
  2. Google Auth Platform › İstemciler › üye istemcisi › Yetkili yönlendirme URI'leri:
     `https://rengarenksite.com/api/oturum/google/donus` ekle (beta adresi kalsın) › Kaydet.
  3. Google Auth Platform › Kitle › "Uygulamayı yayınla" › Onayla. Durum "Üretimde" olur.
  4. **Logo yükleme** (yükleme yaparsan marka doğrulaması istenir; birkaç gün sürer). Sonraya bırakılabilir: kök alan
     adı yayına girip gizlilik politikası herkese açık olunca Marka bölümüne logo, ana sayfa, gizlilik politikası
     bağlantısı ve yetkili alan adı `rengarenksite.com` girilir; alan adı Google Search Console'da DNS TXT kaydıyla
     doğrulanır. O zamana kadar giriş ekranında logo görünmez, giriş yine çalışır.

---

## 3. Satış için gerekenler

Bunlar gelmeden site satın alma kapalı açılabilir.

- [ ] **PayTR (web ödemesi ve galeri aboneliği).**
  1. PayTR'ye şirketle üye işyeri başvurusu yap. Sitede yasal metinlerin yayında olması istenir.
  2. Mağaza panelinde bildirim adresi: `https://api.rengarenksite.com/odeme/bildirim`.
  3. Kart saklama (abonelik için) özelliğini açtır.
  4. Mağaza numarası, anahtar ve tuz değerlerini `Desktop\gizli\`'ye koy. Claude önce test kipinde
     (`PAYTR_TEST_MODE=1`) deneme ödemesi yapar, sonra gerçeğe geçer.
  - **İade:** iade yürütücüsü ayrı anahtarla çalışır (`.env.iade`). Açılması iade akışına dokunduğu için ayrıca senin
    onayınla yapılır.
- [ ] **e-Arşiv fatura entegratörü.** Fatura kesilmeden satış açılmaz.
  - Nasıl: bir entegratör seç (ör. özel entegratör firmalarından biri) ve sözleşme imzala. API belgesini ve test
    hesabını Claude'a ver.
  - Kod tarafında bağdaştırıcı henüz yazılmadı; tahminen 2–3 gün sürer. O zamana kadar faturalar kuyrukta bekler.
- [ ] **Apple Developer Program (kurumsal).** Önce D-U-N-S numarası gerekir: Apple'ın D-U-N-S sorgu sayfasından
  şirketin için iste; birkaç gün ile birkaç hafta sürebilir. Sonra kurumsal geliştirici hesabını aç (yıllık ücretli).
  App Store Small Business Program'a başvur (komisyon %15).
- [ ] **Google Play Console** (kurumsal hesap, tek seferlik ücret). Yeni hesaplarda yayından önce kapalı test şartı
  olabilir; Google'ın güncel kuralına bak.
- [ ] **RevenueCat (mağaza içi satın alma, Karar 38).**
  - Nasıl: hesap aç. Apple ve Google'da ürünleri `rr_<ürün>` adıyla tanımla (fiyatlar Karar 38'de).
  - Webhook adresi `https://api.rengarenksite.com/odeme/magaza`. Yetki başlığı en az 24 karakterlik rastgele bir değer
    olur; Claude üretip sunucuya girer.
  - Uygulama tarafı (`react-native-purchases`) hesap açılınca Claude tarafından yazılır.
- [ ] **Firebase (push bildirimi).**
  - Nasıl: Firebase projesi aç, iOS ve Android uygulamalarını ekle. Apple'dan APNs anahtarı alıp Firebase'e yükle.
  - Hizmet hesabı JSON dosyasını `Desktop\gizli\`'ye koy; Claude `FCM_SERVICE_ACCOUNT` olarak girer.

---

## 4. Galeri tarafı için kurum erişimleri

Gelene kadar galeri başvuruları insana düşer; konsoldan sen ya da çalışan onaylar.

- [ ] **EİDS (Ticaret Bakanlığı).** Bakanlıktan entegrasyon erişimi iste. Gelene kadar canlıda `EIDS_PROVIDER=none`
  kalır ve galerinin portföy araçları alıcılara gösterilmez. Galeriler taleplere yine mesaj atabilir.
- [ ] **Yetki belgesi, GİB vergi, MERSİS doğrulaması.** Kurum erişimi gelince Claude bağdaştırıcıyı yazar
  (`verification.ts`).

---

## 5. Sunucu ve güvenlik

Bu bölümü Claude yapar; senden yalnızca onay ve birkaç bilgi ister.

- [ ] **Yedek (Karar 56).**
  - Hemen: Lightsail'de günlük otomatik anlık görüntü açılır (birkaç dakikalık iş, küçük aylık ücret).
  - Sonra: pgBackRest ile günlük tam ve sürekli artımlı veritabanı yedeği, başka bir AB bölgesine kopya.
  - Ayda bir geri yükleme provası yapılır; Konsol › Sistem sağlığı yedekleri gösterir.
  - Söylemen yeterli: "yedeği kur".
- [ ] **Sırların şifrelenmesi (SOPS).** `.env.prod` ve `.env.iade` şifrelenip depoya konur. Şifre anahtarı (age)
  yalnızca sende ve bir yedekte durur; Claude nasıl saklayacağını adım adım gösterir.
- [ ] **İzleme.**
  - Hata bildirimi için GlitchTip (`SENTRY_DSN`).
  - Sunucu ölçümleri ve günlükler (Prometheus, Grafana, Loki).
  - Site çökerse sana e-posta giden uyarılar.
- [ ] **5651 erişim kayıtları.** Uygulama kayıtları zaten 2 yıl saklanıyor. Web sunucusunun erişim günlüklerinin de
  bütünlük özetiyle 2 yıl saklanması gerekiyorsa (avukata sor) Claude Caddy günlüğünü açar ve saklama düzenini kurar.
- [ ] **AWS bütçe uyarısı.** Şu an aylık 10 USD; kullanım ayda yaklaşık 18 USD (krediden düşüyor), uyarı boşuna çalar. Gerçek aylık tutara göre güncelle
  (AWS konsolu › Billing › Budgets), ya da Claude'dan iste.
- [ ] **Yük testi ve sızma testi.**
  - Yük testini Claude yazar ve canlı provasında çalıştırır.
  - Sızma testi için dış bir firma önerilir (yılda bir; teknik tasarım §13). Firmaya test edilecek adresleri ve
    kapsamı Claude hazırlar.
- [ ] **Yönetim konsolunu kısıtla.** `yonetim.rengarenksite.com` yalnızca belirlediğin IP adreslerinden açılsın.
  Ev ya da ofis IP'n sabit değilse bir VPN kullanmak gerekir; karar senin.

---

## 6. Mobil uygulama

- [x] Paket adı `com.rengarenksite.app` (`apps/mobile/app.json`, Apple girişinin hedef kitlesi `APPLE_CLIENT_IDS`).
- [ ] **Telefonda deneme.** Uygulamanın son değişiklikleri (tasarım değerleri, teknik tablo) gerçek telefonda
  denenmedi. Yöntem: `docs/DURUM-VE-TEST.md` › 8. Gördüğün sorunları ekran görüntüsüyle Claude'a ver.
- [ ] **EAS derleme ayarı.** Claude `eas.json` dosyasını ve canlı API adresini
  (`EXPO_PUBLIC_API_URL=https://api.rengarenksite.com`) ekler. Expo hesabı gerekir (ücretsiz başlanabilir).
- [ ] **TestFlight ve Google Play iç test.** Apple ve Google hesapları açılınca Claude derleme ve yükleme adımlarını
  yürütür.
- [ ] **Mağaza sayfaları.** Uygulama açıklaması, ekran görüntüleri, gizlilik bilgileri (Apple "App Privacy", Google
  "Veri güvenliği") ve destek adresi. Metinleri ve ekran görüntülerini Claude hazırlar, sen gözden geçirirsin.
- [ ] **İnceleme.** Apple incelemesi genelde 1–3 gün sürer, ret gelirse düzeltilip yeniden gönderilir. Galeri
  aboneliği uygulamada satılmadığı için Apple soru sorabilir; yanıt Karar 38'de hazır.

---

## 7. Açılış günü sırası

Yukarıdaki zorunlu maddeler (bölüm 1'deki KVKK ve yasal metinler, bölüm 2'nin tamamı) bitince. Her adımı Claude
yapar, ama her biri için önce senin onayını ister.

1. [ ] **Son sürüm ve testler:** lint, tip denetimi ve testler temiz; commit GitHub'a gönderilir.
2. [ ] **Test verisinin silinmesi** (geri alınamaz): sunucudaki veritabanının yedeği alınır. Veritabanı sıfırlanır,
   katalog ve ayarlar yeniden aktarılır (`deploy/veri-aktar.py`). Sahip hesabı yeniden açılır.
3. [ ] **Sunucu ayarları (`.env.prod`):**
   - `WEB_HOSTS=rengarenksite.com`
   - `WEB_ORIGIN=https://rengarenksite.com`
   - `VERIFY_CHANNELS=whatsapp` (SMS gelince `whatsapp,sms`)
   - `SMS_PROVIDER=none` (SMS gelince `iletimerkezi` ve `SMS_SENDER_ID=RENGARENK`)
   - `KAPALI_TEST` satırı silinir
   - Ayrıca hazır olan sağlayıcılar açılır.

   `www.rengarenksite.com` kök adrese yönlendirilir; bu Caddy'de küçük bir ek, Claude yapar.
4. [ ] **DNS:** alan adı firmasının panelinde `rengarenksite.com` ve `www` kayıtları `63.184.9.173`'e çevrilir.
   Güzel Hosting'deki tanıtım sayfası bununla kapanır. `beta.` kaydı bir süre yönlendirme olarak kalabilir.
5. [ ] **Güvenlik duvarı:** 443 portu herkese açılır; SSH (22) yalnızca senin IP adresinde kalır. Claude, Lightsail
   komutuyla yapar.
6. [ ] **Kurulum:** yeni sürüm kurulur, göçler çalışır.
7. [ ] **Duman testi**, kendi telefonun ve gerçek e-postanla:
   - üye ol (WhatsApp kodu gelmeli)
   - Google ile giriş
   - talep aç
   - galeri başvurusu
   - mesaj gönder
   - e-posta bildirimi
   - ödeme açıksa küçük tutarlı gerçek ödeme
   - konsoldan onay kuyruğu
8. [ ] **İzleme** ilk gün açık tutulur: hata bildirimi, sunucu yükü, e-posta ve kod teslim raporları (Konsol › Büyüme ›
   Teslim raporu).
9. [ ] **Kapalı beta** (önerilen): 10 galeri, 100 alıcı davet edilir. Geri bildirim toplanır, sonra herkese duyurulur.

Bir sorun çıkarsa geri alma: önceki sürüm etiketine dönülür (`deploy/README.md` › Günlük işler). Bakım modu Konsol › Sistem ›
Özellik anahtarları ve bakım'dan tek düğmeyle açılır.

---

## 8. Açılıştan sonra (beklemeden yapılabilir)

- [ ] **AWS Bedrock (yapay zekâ):** KVKK sözleşmesinden sonra `AI_PROVIDER=bedrock`. Ajanın yorumları ve sınıflandırması
  yapay zekâyla çalışır.
- [ ] **Meta ve Google Ads reklam ölçümü:** hesaplar ve KVKK bildirimi gelince.
- [ ] **Yedek SMS sağlayıcısı (Netgsm):** hesap açılınca bağdaştırıcı yazılır.
- [ ] **EEA teknik değerleri:** EEA'dan erişim gelince.
- [ ] **Eşleştirme ayarı:** ilk gerçek taleplerle uyum kurallarının ağırlıkları gözden geçirilir.

---

## Claude'a nasıl söylersin

| Hazır olan | Yazman yeterli |
| --- | --- |
| Bir hesabın anahtarları | "PayTR anahtarları `Desktop\gizli\paytr.txt` içinde, kur" |
| Yedek, izleme, SOPS | "yedeği kur" / "izlemeyi kur" / "SOPS'u kur" |
| Yasal metin | "avukattan dönen metin şu, konsola taslak olarak koy" (onayı sen verirsin) |
| Açılış | "canlıya al" (Claude bölüm 7'yi adım adım, her adımda sorarak yürütür) |
