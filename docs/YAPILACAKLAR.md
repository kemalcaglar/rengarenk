# Yapılacaklar: bugünden açılışa

23 Kasım 2026. Bu liste, bugünden siteyi ve uygulamayı herkese açmaya kadar yapılacak her işi sırayla toplar. Her
adımda şunlar yazılı: ne yapılacağı, nasıl yapılacağı ve maliyeti. Biten adımın kutusunu işaretle (`[ ]` → `[x]`).

- **Avukat işleri:** listede kendi sıralarında duruyor ve sahibin isteğiyle **yapılmış sayıldı** (`[x]`). Yapılmadıysa
  o adımda yapılır.
- **Tutarlar:** ayrıntı ve kaynaklar `docs/UCRETLER-VE-GIDERLER.md`'de.
- **Ayrıntılı nasıl:** her işin uzun anlatımı `docs/CANLIYA-GECIS.md`'de.
- **Gizli değerler** (anahtar, şifre, jeton): sohbete yazma. `Desktop\gizli\` klasörüne bir dosya olarak koy,
  Claude'a yalnızca dosyanın adını söyle.

---

## A. Şimdi, şirket beklemeden

### 1. adım: Galeriyi baştan sona test et

- [ ] **Ne:** galeri başvurusundan araç eklemeye, eşleşmeden mesaja, paket ödemesine kadar her şeyi kendin dene.
- **Nasıl:** `docs/GALERI-TEST-REHBERI.md`'yi sırayla izle.
  - Gereken üç hesap (galeri sahibi, çalışan, alıcı) ve deneme numaraları rehberde yazılı.
  - Test sunucusunda sahte kurum doğrulaması, sahte EİDS ve sahte ödeme açık; para hareketi yok.
  - Başka bir ağdan gireceksen o ağın IP adresini Claude'a söyle.
- **Maliyet:** yok.

### 2. adım: Mobil uygulamayı telefonda dene

- [ ] **Ne:** son değişiklikler (tasarım değerleri, teknik tablo, galeri paneli) gerçek telefonda görülmedi.
- **Nasıl:** `docs/DURUM-VE-TEST.md` › 8'deki adımları izle. Gördüğün sorunları ekran görüntüsüyle Claude'a ver.
- **Maliyet:** yok.

### 3. adım: Expo ve Firebase hesaplarını aç

- [x] **Ne:**
  - Expo: mobil derleme için.
  - Firebase: push bildirimi için.
  - İkisi de şirket istemez.
- **Yapıldı (24 Kasım 2026):**
  - Expo projesi bağlandı, `eas.json` yazıldı.
  - Firebase'e Android ve iOS uygulamaları eklendi; ayar dosyaları Expo'ya yüklendi.
  - Sunucu için yalnızca bildirim yetkili hizmet hesabı açıldı.
- [x] Sunucunun bildirim anahtarı oluşturuldu: kural yalnızca Firebase projesinde kapatıldı, anahtar
  `Desktop\gizli\`'de.
- [ ] Senin onayınla anahtar test sunucusuna girer ve bildirim açılır.
- iPhone bildirimi Apple Developer hesabıyla (20. adım) gelir: APNs anahtarı ve Firebase SDK'sı.
- **Maliyet:** ikisi de ücretsiz başlar. Expo'nun ücretsiz planında aylık derleme sayısı sınırlı.

### 4. adım: Avukat görüşmesi

- [x] **Ne:** 46 soruluk liste ve bilgi notu (masaüstünde `Rengarenk-avukat-gorusme-notu.pdf`). Konular:
  - yasal metinler;
  - AWS ve Meta için yurt dışına aktarım;
  - yönetmelik m.22 (ilan platformu, kimlik doğrulaması, telefon kanalı);
  - BTK yer sağlayıcı belgesi;
  - 5651 kayıtları.
- **Nasıl:** dönen notları ve düzeltilmiş metinleri Claude'a ver. Claude, kararları ilgili belgelere ve koda işler.
- **Maliyet:** avukatın teklifi (serbest ücret).
- **Yapıldı sayıldı.**

---

## B. Şirket (var olan şahıs işletmen)

### 5. adım: Var olan şahıs işletmene platform faaliyetini ekle

Durumun: kuaför faaliyet kodlu bir şahıs işletmen var (esnaf odasına kayıtlı, işletme defteri, MERSİS yok) ve emeklisin.
Yeni şirket kurman gerekmiyor.

- [ ] **Ne:** vergi dairesine ikinci bir faaliyet kodu ekleme (değişiklik bildirimi).
- **Kod (23 Kasım 2026, sahip ve mali müşavir kararı): 63.92.00 Diğer bilgi hizmeti faaliyetleri.**
  - 63.91.02 "Web arama portalı" internet arama motorları içindir; bize uymaz.
  - "Aracılık" geçen kodlar (47.92.00, 47.91.15) seçilmedi, çünkü platform araç satışına aracılık etmiyor.
- **Nasıl:**
  1. Değişiklik bildirimini İnteraktif Vergi Dairesi'nden ya da mali müşavirle ver. Süre olaydan sonra **bir ay**;
     geç kalırsan usulsüzlük cezası kesilir (VUK md. 168).
  2. [ ] **Elektronikçiler (bilgisayarcılar) esnaf odasına kaydol** (mali müşavirin söylediği). Kuaför odası bu
     faaliyeti kapsamıyor. Kayıt ücretini ve yıllık aidatı odaya sor. Site künyesinde "bağlı olduğun meslek odası"
     olarak iki oda da yazılır.
  3. Vergi levhanı, oda adını ve sicil numaranı Claude'a ver. Bunlar site künyesine, ön bilgilendirme formuna ve
     sözleşmelere yazılır.
- [ ] **Yurt dışından alınan hizmetlerin KDV'si (2 No.lu KDV beyannamesi; KDV Kanunu md. 9, sorumlu sıfatıyla).**
  - Mali müşavirin söylediği iş. Yurt dışı firmalardan aldığın hizmetin KDV'sini (%20) her ay sen beyan eder ve
    ödersin: AWS, Apple Developer, Google Play, Google Workspace, Meta (WhatsApp), Expo, RevenueCat.
  - Ödediğin bu KDV, aynı ay 1 No.lu KDV beyannamesinde indirilir. Satış başlayınca satışların KDV'sinden düşülür.
    Satış yokken "devreden KDV" olarak birikir ve sonra düşülür, yani gerçek gider olmaz, yalnızca önce cebinden çıkar.
  - Her ay yurt dışı faturalarını (AWS faturası Billing › Invoices'tan indirilir) mali müşavire gönder.
  - Faturada zaten Türk KDV'si yazıyorsa aynı tutar için ayrıca beyan edilmez. Bunu faturayı mali müşavire
    göstererek netleştir. Firmaya vergi numaranı girmek KDV'nin faturaya eklenmesini durdurabilir.
  - AWS faturası Activate kredisiyle 0 USD olduğunda ne beyan edileceğini mali müşavire sor.
  - 2 No.lu beyannamenin de damga vergisi olabilir (1 No.lu için 791 TL). Mali müşavire sor.
- **Bilanço defterine geçmen gerekmiyor.**
  - MERSİS numarası bilançoya geçmekle değil, ticaret siciline kayıtla verilir. Ticaret siciline kayıtlı kişi de
    işletme defteri tutabilir.
  - Senin işlerinin hiçbiri MERSİS istemiyor:
    - PayTR: vergi levhası, kimlik, imza beyannamesi ve banka belgesi.
    - İYS: "MERSİS numarası yoksa" diye ayrı bir başvuru yolu var.
    - ETBİS: esnaftan TC kimlik ve vergi numarası.
    - e-Arşiv: vergi numarası.
    - Apple: bireysel hesap.
    - Google Play: kişisel hesap.
  - Sitede yazılacaklar (e-ticaret yönetmeliği md. 5/1; mesafeli sözleşmeler yönetmeliği md. 5/1-b): ad soyad, vergi
    numarası, adres, **KEP adresi**, e-posta, telefon, bağlı olduğun meslek odası. MERSİS yerine vergi numarası
    yeterli.
- **Ne zaman değişir:**
  - **Esnaflık sınırı:** hizmet hasılatı yılda 1.200.000 TL (2026). Bu aşılınca ticaret siciline geçmek isteğe
    bağlı; 7.200.000 TL'yi (altı katı) aşınca kaydın ticaret siciline aktarılır.
  - **Bilanço defteri:** bir yılda yaklaşık 1.440.000 TL'yi ya da iki yıl üst üste 1.200.000 TL'yi aşarsan ertesi
    yıldan zorunlu. Kuaför ve platform hasılatının birlikte sayılıp sayılmadığını mali müşavire sor.
- **Maliyet:**

  | Kalem | Tutar |
  | --- | --- |
  | Faaliyet kodu ekleme | Vergi dairesinde harç görülmedi |
  | Elektronikçiler esnaf odası | Kayıt ücreti ve yıllık aidat odaya göre (odaya sor) |
  | KDV2 (yurt dışı hizmetler) | Yurt dışı faturaların %20'si. Sonradan indirilir, gerçek gider değil |
  | Bağ-Kur / SGDP | 0. Emekli kendi işini yaparken sigortalı sayılmaz, SGDP de ödemez (5510 md. 6/1-n; 2016'dan beri) |
  | Mali müşavir | Zaten çalışıyorsa ek ücretini sor; e-ticaret faaliyeti için artırabilir |
  | Beyanname damga vergisi | KDV ve muhtasar 791 TL, yıllık gelir vergisi 1.189,50 TL (beyanname başına) |

- **Mali müşavire sorulacaklar:**
  - Kuaför ve platform hasılatı esnaflık sınırında birlikte mi sayılır?
  - Platform "ticari işletme" sayılıp ticaret siciline kayıt gerektirir mi?
  - KDV: platform hizmetlerinde %20.
  - KDV2: kredisiyle 0 USD çıkan AWS faturası, 2 No.lu beyannamenin damga vergisi.

### 6. adım: e-Tebligat'a katıl

- [ ] **Ne:** vergi dairesinin elektronik tebligat adresi. İşe başladıktan sonra **15 gün içinde** zorunlu (VUK 596).
- **Nasıl:** mali müşavir ya da Dijital Vergi Dairesi üzerinden.
- **Maliyet:** ücretsiz.

### 7. adım: Nitelikli e-imza ve KEP adresi al

- [ ] **Ne:** e-imza; e-Arşiv bağlantısı, KEP ve bazı kurum başvuruları için gerekir. KEP adresi zorunlu:
  e-ticaret yönetmeliği sitede yazılmasını istiyor. Yıllık 215 TL, ileti başı 8,70 TL (PTT).
- **Nasıl:** PTT şubesinden ya da PTT'nin e-imza sayfasından başvur. Mali mühür gerekip gerekmediğini e-Arşiv
  entegratörüne sor (gerçek kişi mükellef çoğu zaman e-imzayla idare eder).
- **Maliyet:** e-imza 1 yıl 2.000 TL, 2 yıl 2.750 TL, 3 yıl 3.500 TL (KDV dahil); KEP yıllık 215 TL.

### 8. adım: Marka başvurusu

- [ ] **Ne:** "Rengarenk" markasını TÜRKPATENT'te tescil ettir.
- **Nasıl:**
  - turkpatent.gov.tr'de e-Devlet ile kendin başvurabilir ya da bir marka vekili tutabilirsin.
  - Sınıflar marka vekiliyle ya da avukatla seçilir. Olasılar: 35 (çevrim içi pazar yeri), 42 (yazılım), gerekirse 38
    (iletişim).
  - SMS yedeği açılacaksa başvuru belgesini İleti Merkezi'ne gönder.
- **Maliyet:**
  - 1 sınıf: 9.830 TL + KDV (başvuru 2.820 TL + tescil 7.010 TL).
  - 2. sınıf +2.820 TL, sonraki her sınıf +3.150 TL.
  - Varsa marka vekili ücreti.
  - 10 yılda bir yenilenir (8.730 TL).

---

## C. Yasal metinler ve KVKK

### 9. adım: Yasal metinleri avukatla son hâline getir

- [x] **Ne:** kullanım koşulları, KVKK aydınlatma metni, çerez metni, galeri hizmet sözleşmesi, ön bilgilendirme
  formu, mesafeli sözleşme.
  - Bilinen düzeltme: barındırma yeri "Amazon Web Services, Frankfurt (Almanya)" olacak.
  - Şirket bilgileri 5. adımdan gelecek.
- **Nasıl:** avukatın son hâli Claude'a verilir; Claude metinleri konsola taslak olarak koyar.
- **Maliyet:** avukat teklifine dahil.
- **Yapıldı sayıldı.**

### 10. adım: Yasal metinleri konsoldan yayınla

- [ ] **Ne:** sunucuda 8 metnin hepsi hâlâ taslak.
  - Bu metinleri yalnızca sen onaylayabilirsin.
  - Üyelikte kullanım koşulları onaylatıldığı için açılıştan önce hepsi yayında olmalı.
- **Nasıl:** Konsol › Görünüm › Yardım ve yasal metinler › ilgili metin › taslak › onayla.
- **Maliyet:** yok.

### 11. adım: AWS ile KVKK standart sözleşmesi ve Kurul'a bildirim

- [x] **Avukat kısmı:** sözleşme metni ve imza yolu (AWS'nin hazır metni var mı) avukatla netleşti. **Yapıldı sayıldı.**
- [ ] **Senin kısmın:**
  1. AWS ile standart sözleşmeyi imzala.
  2. İmzadan sonraki **5 iş günü içinde** Kişisel Verileri Koruma Kurumu'nun standart sözleşme bildirim modülünden
     bildir.
  3. Aynısını WhatsApp (Meta) için de yap. Firebase ve reklam ölçümü açıldıkça onlar için de yapılır.
- **Neden:** bu olmadan canlıya gerçek kullanıcı verisi girmez (Karar 37).
- **Maliyet:** bildirim ücretsiz. Bildirmemenin cezası 2026'da 90.308 – 1.806.377 TL.

### 12. adım: VERBİS

- [x] **Ne:** 50 çalışan ve 100 milyon TL bilanço altında kayıt gerekmiyor. Avukat aksini söylemediyse bir şey
  yapılmaz.
- **Maliyet:** yok.

---

## D. Kayıtlar ve iletişim hesapları

### 13. adım: ETBİS kaydı

- [ ] **Ne:** e-ticaret bilgi sistemi kaydı. Satışa başlamadan önce zorunlu.
- **Nasıl:**
  1. Şirket yetkilisi olarak `eticaret.gov.tr`'ye e-Devlet ile gir ve `rengarenksite.com`'u kaydet.
  2. Verilen karekodu Claude'a gönder; sitenin altına konur.
  3. Bilgi değişirse 30 gün içinde bildirilir.
- **Maliyet:** resmî kaynakta ücret yok.

### 14. adım: İYS kaydı

- [ ] **Ne:** ileti yönetim sistemi. Ticari e-posta göndermeden önce zorunlu.
- **Nasıl:**
  1. iys.org.tr'de hizmet sağlayıcı olarak kaydol (marka: Rengarenk). Entegratöre gerek yok.
  2. Her gün Konsol › Uyum ve KVKK › Rıza ve çerez kayıtları › İYS'ye aktarım'dan CSV'yi indir.
  3. Dosyayı İYS Web'e Bireysel olarak yükle, sonra konsolda "Yüklendi"ye bas.
  4. Ayrıntılar `docs/CANLIYA-GECIS.md` › İYS'de.
- **Maliyet:** Temel Hizmetler (elle yükleme) ücretsiz.

### 15. adım: WhatsApp (Meta) hesabı ve şablonlar

- [ ] **Ne:** üyelikte telefon kodu ve kritik bildirimler WhatsApp'tan gider. Bu olmadan yeni kullanıcı üye olamaz.
- **Nasıl:**
  1. business.facebook.com'da işletme hesabı aç ve şirket belgeleriyle işletme doğrulamasını yap.
  2. WhatsApp Business Platform'a, normal WhatsApp'ta kullanılmayan **ayrı bir telefon numarası** ekle.
  3. Şu üç şablonu Türkçe olarak oluştur ve onaya gönder. Metinler `docs/CANLIYA-GECIS.md` › 2'de:
     - `rengarenk_kod` (Kimlik doğrulama türü);
     - `rengarenk_talep_doluyor` (Yardımcı türü);
     - `rengarenk_odeme_alinamadi` (Yardımcı türü).
  4. Sistem kullanıcısıyla süresiz bir jeton üret. Jetonu ve telefon numarası kimliğini `Desktop\gizli\`'ye koy.
  5. Claude sunucuya girer ve kendi numarana deneme kodu gönderir.
- **Maliyet:**
  - Meta hesabı ücretsiz.
  - Mesaj başına 0,0009 USD; 10.000 kod yaklaşık 9 USD.
  - Ayrı numara için bir hat (operatörün ücreti).

### 16. adım: TSB yazılı izni

- [ ] **Ne:** katalog TSB listesini kullanıyor; yazılı izin isteniyor.
- **Nasıl:** yazışma taslağı Claude dokümanında hazır. TSB'ye gönder; izin yazısı gelince Claude, Veri kaynakları
  sayfasına işler.
- **Maliyet:** bilinmiyor; TSB'ye sor.

### 17. adım: EİDS ve kurum doğrulamaları için Ticaret Bakanlığı'na başvur

- [ ] **Ne:**
  - EİDS erişimi olmadan galerilerin kara taşıtı ilanları canlıda yayına giremez (yönetmelik m.22/ç).
  - Yetki belgesi, GİB ve MERSİS erişimi gelirse galeri başvuruları otomatik kontrol edilir. Gelmezse elle incelenir.
- **Nasıl:**
  1. Ticaret Bakanlığı'ndan ilan platformu olarak EİDS entegrasyon erişimi iste: başvuru yolu, entegrasyon belgesi ve
     test ortamı.
  2. Gelen belgeyi Claude'a ver; Claude sağlayıcıyı yazar (yaklaşık 2 gün).
  3. Yetki belgesi doğrulaması için de aynı başvuruda sor.
- **Maliyet:** entegrasyon ücretine dair kaynak bulunamadı; Bakanlığa sor.

---

## E. Satış

### 18. adım: PayTR

- [ ] **Ne:** web ödemesi ve galeri aboneliği.
- **Nasıl:**
  1. Şirketle üye işyeri başvurusu yap. PayTR sitede yasal metinlerin yayında olmasını ister (10. adım).
  2. Bildirim adresi olarak `https://api.rengarenksite.com/odeme/bildirim` gir; kart saklamayı açtır.
  3. Mağaza numarası, anahtar ve tuzu `Desktop\gizli\`'ye koy. Claude önce test kipinde dener, sonra gerçeğe geçer.
  4. İade yürütücüsünün açılması ayrıca senin onayınla yapılır.
- **Maliyet:** komisyon teklifle belirlenir (tek çekim %2,19'dan başlıyor). Kurulum ve yıllık ücreti başvururken sor.

### 19. adım: e-Arşiv entegratörü

- [ ] **Ne:** fatura kesilmeden satış açılmaz. İşletme hesabında 1 Ocak 2027'den itibaren her fatura e-Arşiv olmalı.
- **Nasıl:** bir özel entegratörle sözleşme imzala. API belgesini ve test hesabını Claude'a ver; Claude bağdaştırıcıyı
  yazar (2–3 gün).
- **Maliyet:** 1.000 faturalık kontör yaklaşık 2.750 – 5.250 TL + KDV.

### 20. adım: Apple Developer Program

- [ ] **Ne:** iPhone uygulaması için.
- **Nasıl:**
  1. developer.apple.com'da kaydol. Şahıs şirketi bireysel hesapla kaydolur; mağazada senin adın görünür.
  2. Ardından App Store Small Business Program'a başvur (komisyon %15).
  3. Apple ile push anahtarını (APNs) al ve Firebase'e yükle.
- **Maliyet:** yılda 99 USD (Türkiye'de yaklaşık 1.029 TL). Satışlardan %15 komisyon.

### 21. adım: Google Play Console

- [ ] **Ne:** Android uygulaması için.
- **Nasıl:**
  - Hesap aç.
  - Kişisel hesapta yayından önce belirli sayıda test kullanıcısıyla kapalı test şartı var.
  - Kurumsal hesap D-U-N-S numarası ister (ücretsiz, 30 güne kadar sürebilir).
- **Maliyet:** bir kez 25 USD. Satışlardan %15 komisyon (yıllık ilk 1 milyon USD'de).

### 22. adım: RevenueCat

- [ ] **Ne:** mobilde mağaza içi satın alma (Karar 38).
- **Nasıl:**
  1. Hesap aç. Apple ve Google'da ürünleri `rr_<ürün>` adıyla tanımla.
  2. Webhook adresi `https://api.rengarenksite.com/odeme/magaza`.
  3. Claude uygulama tarafını yazar.
- **Maliyet:** belli bir aylık gelire kadar ücretsiz.

---

## F. Sunucu ve mobil hazırlık (Claude yapar, sen onay verirsin)

### 23. adım: Yedek, sırların şifrelenmesi, izleme

- [ ] **Ne:**
  - Lightsail günlük anlık görüntüsü ve veritabanı yedeği (Karar 56).
  - `.env.prod` ve `.env.iade`'nin SOPS ile şifrelenmesi.
  - Hata bildirimi ve sunucu uyarıları.
  - AWS bütçe uyarısının gerçek tutara çekilmesi.
- **Nasıl:** Claude'a "yedeği kur", "SOPS'u kur", "izlemeyi kur" de. SOPS anahtarını nasıl saklayacağını Claude adım
  adım gösterir.
- **Maliyet:**
  - Anlık görüntü için disk boyutuna göre küçük bir aylık ücret.
  - Sunucu zaten ayda 44 USD (şimdilik krediden).

### 24. adım: Mağaza sayfaları, TestFlight ve iç test

- [ ] **Ne:** uygulama açıklaması, ekran görüntüleri, gizlilik bilgileri ve deneme dağıtımı.
- **Nasıl:**
  1. Claude metinleri ve ekran görüntülerini hazırlar; sen gözden geçirirsin.
  2. Claude derler ve TestFlight ile Google Play iç teste yükler.
  3. Apple incelemesi genelde 1–3 gün sürer.
- **Maliyet:** yok (hesap ücretleri 20. ve 21. adımlarda).

---

## G. Açılış

### 25. adım: Canlıya al

- [ ] **Ne:** test verisinin silinmesi, sunucu ayarları, DNS, güvenlik duvarı, kurulum ve duman testi.
- **Nasıl:** Claude'a "canlıya al" de. Claude `docs/CANLIYA-GECIS.md` › 7'yi adım adım, her adımda sorarak yürütür.
  - Sahte sağlayıcılar kapatılır ve `KAPALI_TEST` kaldırılır.
  - DNS'te yalnızca `rengarenksite.com` ve `www` A kayıtları değişir. MX ve doğrulama kayıtlarına dokunulmaz.
  - Güzel Hosting'deki tanıtım sayfası kapanır.
- **Önce şunlar bitmiş olmalı:** 10, 11, 13 ve 15. adımlar (yasal metinler, KVKK bildirimi, ETBİS, WhatsApp).
  - Ödeme yoksa site satın alma kapalı açılabilir.
  - EİDS yoksa galeriler taleplere yazabilir ama portföy araçları görünmez.
- **Maliyet:** yok. Tanıtım barındırması (Güzel Hosting) artık gerekmeyebilir.

### 26. adım: Kapalı beta

- [ ] **Ne:** 10 galeri ve 100 alıcı davet edilir, geri bildirim toplanır, sonra herkese duyurulur.
- **Nasıl:** davet listesini sen hazırlarsın. Konsol › Büyüme'den kampanya ve bildirim, Teslim raporu'ndan kod ve
  e-posta takibi yapılır.
- **Maliyet:** WhatsApp ve e-posta kullanım kadar, birkaç dolar.

---

## H. Açılıştan sonra

### 27. adım: Bekleyen bağlantılar

- [ ] **Yapay zekâ (Bedrock):** KVKK sözleşmesinden sonra açılır (`AI_PROVIDER=bedrock`). Kullanım kadar ücretli;
  bütçe konsolda sınırlı.
- [ ] **Reklam ölçümü (Meta, Google Ads):** hesaplar ve KVKK bildirimi gelince açılır.
- [ ] **EEA teknik değerleri:** EEA'dan erişim gelince.
- [ ] **SMS yedeği (isteğe bağlı):** gerek görülürse İleti Merkezi'nden paket alınır; fiyat teklifle belirlenir.
- [ ] **Eşleştirme ayarı:** ilk gerçek taleplerle ağırlıklar gözden geçirilir.

### Her yıl

- [ ] Apple Developer yenilemesi (99 USD).
- [ ] Alan adı yenilemesi.
- [ ] Oda aidatı.
- [ ] Yasal ücret ve harçların Ocak'taki yeniden değerlemesine bak; Claude bu listeyi ve ücretler belgesini günceller.
