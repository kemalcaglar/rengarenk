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

- [ ] **Ne:**
  - Expo: mobil derleme için.
  - Firebase: push bildirimi için.
  - İkisi de şirket istemez.
- **Nasıl:**
  - expo.dev'de hesap aç; Claude `eas.json`'u ve canlı API adresini ekler.
  - Firebase'de bir proje aç ve iOS ile Android uygulamalarını ekle (paket adı `com.rengarenksite.app`).
  - Hizmet hesabı JSON dosyasını `Desktop\gizli\`'ye koy. Claude sunucuya girer ve iPhone için Firebase SDK'sını
    uygulamaya ekler (yaklaşık 1 gün).
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

## B. Şirket

### 5. adım: Şahıs şirketini kur

- [ ] **Ne:** vergi levhası ve şirket kaydı. Çoğu hesap (PayTR, e-Arşiv, ETBİS, İYS, Meta işletme doğrulaması, marka,
  Apple) bunu ister.
- **Nasıl:**
  1. Bir mali müşavir bul. Mali müşavir vergi dairesine işe başlamayı Dijital Vergi Dairesi üzerinden yapar.
  2. Hangi odaya kaydolacağını (ticaret ya da esnaf odası) mali müşavirle netleştir. Ticaret sicili tescili ve oda
     kaydını yap.
  3. Noterde imza beyannamesi ver.
  4. Mali müşavire şunları sor:
     - Bağ-Kur'un sana düşüp düşmediği (başka bir işte SGK'lıysan değişir).
     - Genç girişimci istisnasından yararlanıp yararlanamayacağın.
     - AWS faturasındaki KDV.
  5. Şirket unvanını, adresini, vergi numarasını ve MERSİS numarasını Claude'a ver. Bu bilgiler sitenin künyesine,
     ön bilgilendirme formuna ve sözleşmelere yazılır.
- **Maliyet:**

  | Kalem | Tutar | Sıklık |
  | --- | --- | --- |
  | Ticaret sicili tescil harcı | 5.466,10 TL | Bir kez |
  | Oda kayıt ücreti | 3.303 – 16.515 TL | Bir kez; ilk yıl aidat yok |
  | Noter imza beyannamesi | Yaklaşık 700 – 2.000 TL (resmî tutar bulunamadı) | Bir kez |
  | Mali müşavir | Ayda 3.593 TL'den (KDV dahil; İstanbul %35 fazla; ilk iki yıl %50 indirim) | Aylık |
  | Bağ-Kur | Ayda 11.808,23 TL (borcu yoksa 10.156,73 TL) | Aylık; başka işte SGK'lıysan değişebilir |
  | Beyanname damga vergisi | KDV ve muhtasar 791 TL, yıllık gelir vergisi 1.189,50 TL | Beyanname başına |

### 6. adım: e-Tebligat'a katıl

- [ ] **Ne:** vergi dairesinin elektronik tebligat adresi. İşe başladıktan sonra **15 gün içinde** zorunlu (VUK 596).
- **Nasıl:** mali müşavir ya da Dijital Vergi Dairesi üzerinden.
- **Maliyet:** ücretsiz.

### 7. adım: Nitelikli e-imza al

- [ ] **Ne:** e-Arşiv bağlantısı, KEP ve bazı kurum başvuruları için gerekir.
- **Nasıl:** PTT şubesinden ya da PTT'nin e-imza sayfasından başvur. Mali mühür gerekip gerekmediğini e-Arşiv
  entegratörüne sor (gerçek kişi mükellef çoğu zaman e-imzayla idare eder).
- **Maliyet:** 1 yıl 2.000 TL, 2 yıl 2.750 TL, 3 yıl 3.500 TL (KDV dahil).

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
