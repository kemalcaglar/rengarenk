# Galeriyi test etme rehberi

23 Kasım 2026. Claude belgesi "Galeriyi test etme rehberi"nin depodaki kopyası. 23 Kasım'dan beri test sunucusunda
sahte kurum doğrulaması, sahte EİDS ve sahte ödeme açık; galeri davet bildirimi de eklendi. Bu kopya bu hâli anlatır.

## 1. Önce yapman gerekenler

### Test sunucusunda galeri nasıl çalışıyor

Test sunucusu (`beta.rengarenksite.com`) canlı ayarlarla çalışır. Galeri için üç kurum bağlantısı gerekiyor, üçü de
henüz gerçek değil. Kapalı testte (`KAPALI_TEST=1`) bunların yerine **sahte sağlayıcılar** açık (sahip kararı, 23 Kasım
2026):

| Bağlantı | Ne işe yarar | Test sunucusunda |
| --- | --- | --- |
| Bakanlık / GİB / MERSİS doğrulaması (`GALLERY_VERIFY_PROVIDER=fake`) | Başvurudaki yetki belgesi, vergi ve MERSİS numarasını kurumdan kontrol eder | Sonucu yazdığın numara belirler (bölüm 6) |
| EİDS (`EIDS_PROVIDER=fake`) | Araç ilanını ruhsat sahibinin e-Devlet yetkisiyle doğrular | Sonucu plakanın son rakamı belirler |
| Ödeme (`PAYMENT_PROVIDER=fake`) | Paket satın alma | Kart istemeyen sahte ödeme sayfası; para hareketi ve fatura yok |

Herkese açılırken `KAPALI_TEST` kaldırılır. O zaman sahte değerlerle API hiç başlamaz, bu yüzden üçü de `none` yapılır
(Canlıya geçiş listesi). Kurum erişimleri gelince gerçek sağlayıcılar yazılır.

### Hazırlık listesi

- [ ] **Bağlantı:** sunucuya yalnızca izinli dört IP adresinden girilir. Başka bir ağdan (iş yeri, mobil veri)
  deneyeceksen o ağın IP adresini Claude'a söyle, güvenlik duvarına eklesin.
- [ ] **Üç kullanıcı hesabı:** her birinin telefon numarası ve e-postası ayrı olmalı.
  - E-postalar gerçekten gönderilir (Amazon SES), bu yüzden sana ait adresler kullan. Örneğin Gmail'de adının sonuna
    +a, +b, +c ekleyebilirsin (`adin+a@gmail.com`).
  - Var olmayan adrese giden e-posta geri döner ve gönderici itibarımızı düşürür.
  - **A: Galeri sahibi.** Başvuruyu yapar.
  - **B: Galeri çalışanı** (satış temsilcisi). Davetle ekibe girer.
  - **C: Alıcı.** Talep açar, galeriden mesaj alır.
  - Kod gönderilmez; ekranda görünür ve kutuya kendiliğinden yazılır. Bu yüzden gerçek olmayan ama biçimi doğru
    numaralar kullanabilirsin (ör. 0555 300 00 01, 02, 03).
  - Kod sınırları: aynı numaraya dakikada bir ve saatte en çok beş; aynı IP adresinden saatte en çok yirmi.
- [ ] **Konsol hesabın:** `kemal.caglar@rengarenksite.com` ile Google girişi ve iki adımlı doğrulama kodu. Sahip rolü
  galeri başvurusunu onaylayabilir.
- [ ] **Deneme belgeleri:** gerçek olmasına gerek yok.
  - Her biri en çok 10 MB olan üç PDF ya da fotoğraf hazırla: "vergi levhası", "sicil gazetesi", "oda kaydı".
  - Başkasına ait gerçek bir belge yükleme (KVKK).
- [ ] **Deneme numaraları:**

  | Alan | Kural | Örnek |
  | --- | --- | --- |
  | Vergi numarası | Sağlama hanesi tutmalı | `1234567890` |
  | MERSİS numarası | 16 hane | `0123456789000015` |
  | Yetki belgesi no | 3–40 karakter: harf, rakam, `. / -` | `34-2026-001` (her şey geçer) ya da `34-2026-009` (uyarı, insana düşer) |

- [ ] **Araç fotoğrafları:** her araç için en az 6, en çok 30 fotoğraf.
  - JPG, PNG ya da WEBP; her biri en çok 8 MB.
  - İnternetten alınmış başka galerinin fotoğrafını kullanma; kopya fotoğraf kuralı şikâyet açar.
- [ ] **İsteğe bağlı ekspertiz raporu:** yalnızca PDF, en çok 10 MB.
- [ ] **Araç bilgileri:** kara taşıtında plaka, şasinin son 6 hanesi ve ilk tescil tarihi.
  - Tescilin üzerinden 6 ay geçmiş ve 6.000 km dolmuş bir araç seç; yoksa kural ilanı durdurur.
  - Plakanın son rakamı sahte EİDS'in sonucunu belirler: 0 reddedilir, 9 bekler, diğerleri onaylanır.
- [ ] **Bilgisayar:** masaüstü tarayıcı.
  - Mobil uygulama mağazada olmadığı için galeri testini web'de yap.
  - Mobil panel ayrıca Expo ile denenebilir.

## 2. Galeri nedir, nereden ne yapar

Galeri, kurumsal hesapla çalışan satıcıdır. Dört türü var: **Vasıta galerisi**, **Kiralama firması**, **Tekne ve yat
galerisi**, **Hava aracı satıcısı**. Bireysel satıcıdan farkı:

- Portföy tutar; araçları alıcılara görünür.
- Sistem portföydeki araca uyan talepleri bulur (eşleşme).
- İlk mesaja araç kartı ekleyebilir.
- Ekip kurar.
- Aylık paketle çalışır; ilk 30 gün ücretsizdir.

Bireysel satıcı ilan yayınlamaz, araç kartı ve fotoğraf gönderemez; yalnızca taleplere yazar (Karar 18, 26).

### Galerinin bir günü

1. Sabah **Galeri paneli › Özet**'e bakar: yeni eşleşmeler, doğrulama bekleyen araçlar, okunmamış mesajlar.
2. **Eşleşmeler**'de portföyüne uyan talepleri görür ve "Mesaj at" ile ilk mesajı yazar; mesaja uyan aracın kartını
   ekler.
3. Alıcı cevap verince **Mesajlarım**'da konuşur, isterse numarasını paylaşır.
4. Yeni aracı **Araç ekle**'den girer; çok aracı **Toplu yükleme** ile Excel'den yükler.
5. Sattığı aracı "Satıldı" işaretler; araç hemen yayından kalkar.

### Nerede ne var

| Yer | Adres / giriş | Ne yapılır |
| --- | --- | --- |
| Web · başvuru | `/kurumsal-basvuru`; menüde "Galeriler için · 30 gün ücretsiz" | Beş adımlı kurumsal başvuru, belgeler, başvuru durumu |
| Web · galeri paneli | `/galeri-paneli`; Hesabım › "Kurumsal hesap" | Sekmeler: Özet, Portföy, Araç ekle, Toplu yükleme ("API entegrasyonu" bunun içinde), Eşleşmeler, Ekip, Paket ve faturalar |
| Web · herkese açık | `/galeri/<ad>` galeri profili, `/arac/<no>` araç sayfası | Alıcının gördüğü profil, rozetler, "Takip et", araçtan galeriye mesaj |
| Web · mesajlar | `/mesajlarim` | Alıcılarla sohbet, araç kartı ekleme |
| Mobil | Hesabım › "Kurumsal hesap başvurusu"; onaydan sonra "Galeri paneli" | Alt çubuk: Panel, Eşleşmeler, Araç ekle, Portföy, Mesajlar. Ekip, paket ve toplu yükleme yalnızca web'de; mobilde fiyat görünmez (Karar 38) |
| Konsol · Pazar › Galeri başvuruları | `yonetim.` › `/galeri-basvurulari` | Başvuruyu incele, belgeleri aç; Onayla, Belge iste, Reddet |
| Konsol · Galeri müşterileri | `/galeri-musterileri` | Bütün galeriler, ayrılma riski, yenileme tarihi, sorumlu çalışan |
| Konsol · Kullanıcılar ve galeriler | `/kullanicilar?galeri=<kimlik>` | Galeri kartı: Uyar, 24 saat askıya al, Hak tanımla, Giriş bağlantısı gönder, Oturumları kapat, Not ekle, İade öner, Kalıcı engelleme öner |
| Konsol · Talepler ve portföy | `/talepler-ve-portfoy` | Aracı gizleme, düzeltme notu |
| Konsol · Moderasyon | `/moderasyon` | Şikâyetler, kopya fotoğraf, galerinin 1 yıldıza itirazı |

### Ekip ve roller

| Rol | Ne yapabilir |
| --- | --- |
| Sahip | Her şey: paket, ödeme, faturalar, çalışan ekleme ve çıkarma, çalışan başına günlük ilk mesaj sınırı. Ekipten çıkarılamaz. |
| Yönetici | Portföy, toplu yükleme, API, eşleşmeler, mesajlar; satış temsilcisi davet edebilir. |
| Satış temsilcisi | Eşleşmeler ve mesajlar. Portföyde yalnızca kendisine atanan aracı düzenler. İşletme, fatura ve paket bilgisini görmez. |

- Kullanıcı sayısı pakete bağlıdır: deneme 5, Başlangıç 2, Profesyonel 5, Kurumsal 15. Açık davetler de sayılır.
- Haklar (ilk mesaj, talep, öne çıkarma) ekipte ortak havuzdan kullanılır (Karar 20).

## 3. Kurumsal başvuru ve belgelerin doğrulanması

```
Başvuru gönderildi → 5 otomatik kontrol → Hepsi geçti mi?
                                            ├─ evet → Ajan onaylar (ajan çalışıyorsa)
                                            └─ hayır → Konsolda sana düşer → Onayla / Belge iste / Reddet
Belge iste → başvuran belgeyi yükler, yeniden gönderir → kontroller yeniden çalışır
Onayla → hesap açılır, 30 gün deneme · Reddet → gerekçe başvurana görünür
```

Sistem beş kontrol yapar. Hepsi geçerse ajan başvuruyu kendisi onaylar (Karar 03, 41). Kontrollerden biri geçmezse
ya da ajan durdurulmuşsa başvuru insana kalır.

### Başvuruda neler isteniyor

Sihirbazın beş adımı: **İşletme türü → İşletme bilgileri → Yetki ve belgeler → Hesap sahibi → Gönder.**

- Başvurmak için önce normal üye olup giriş yapmış olmak gerekir.
- Zaten bir kurumsal hesabın üyesi olan kişi yeniden başvuramaz.

**İşletme bilgileri:**

- Ticari unvan.
- Platformda görünecek ad.
- Vergi numarası: 10 haneli VKN ya da şahıs işletmesi için 11 haneli TCKN. Sağlama hanesi kontrol edilir.
- Vergi dairesi.
- MERSİS numarası (16 hane).
- İl, ilçe ve işletme adresi.

**Yetki ve belgeler:** işletme türüne göre değişir.

| İşletme türü | Yetki belgesi numarası | Yüklenecek belgeler |
| --- | --- | --- |
| Vasıta galerisi | İkinci el motorlu kara taşıtı ticareti yetki belgesi no (zorunlu) | Vergi levhası, Ticaret sicil gazetesi (kuruluş ya da son değişiklik), Oda kayıt belgesi (son 6 ay) |
| Kiralama firması | Araç kiralama yetki belgesi no (zorunlu) | Vergi levhası, Oda kayıt belgesi, Şube adresleri |
| Tekne ve yat galerisi | İstenmez | Vergi levhası, Sicil gazetesi, Turizm işletmesi belgesi (yalnızca kiralık tekne için, isteğe bağlı) |
| Hava aracı satıcısı | İstenmez | Vergi levhası, Sicil gazetesi, Oda kayıt belgesi |

- Yetki belgesinin kendisi yüklenmez, yalnızca numarası yazılır. Numara Bakanlık sisteminden kontrol edilecek
  ("Bakanlık sisteminden doğrula" düğmesi). İmza sirküleri istenmez.
- Dosyalar PDF, JPEG, PNG ya da WEBP olabilir, en çok 10 MB. Türü dosya adından değil içeriğinden anlaşılır.
- Aynı belge yeniden yüklenirse yenisi geçerli olur; eskisi kayıtta kalır.
- Belgeleri yalnızca konsoldaki inceleme ekibi görür. Her belge açılışı işlem kaydına yazılır.

**Hesap sahibi:**

- Ad soyad, görevi (isteğe bağlı), cep telefonu (üyelikte doğrulanmış, değişmez), fatura e-postası.
- Zorunlu kutu: "Galeri hizmet sözleşmesini ve aydınlatma metnini okudum".
- İsteğe bağlı: kanal kanal ticari ileti onayı (e-posta, bildirim).

### Beş otomatik kontrol

| Kontrol | Nasıl yapılır | Canlıda bugün | Test sunucusunda (sahte) |
| --- | --- | --- | --- |
| Yetki belgesi | Ticaret Bakanlığı kaydından numara, unvan ve süre | "Yapılamadı" (kurum bağlantısı yok) | 0 ile başlarsa kalır, 9 ile biterse uyarı, diğerleri geçer |
| Vergi levhası | GİB kaydından vergi numarası ve unvan; unvan farklıysa kalır | "Yapılamadı" | 0 ile başlarsa kalır |
| MERSİS | MERSİS kaydı | "Yapılamadı" | 0 ile biterse kalır |
| Adres | İl ve ilçe listede mi | Geçer | Geçer |
| Telefon | Sahibin telefonu doğrulanmış mı | Geçer | Geçer |

- Zorunlu belgelerden biri eksikse kontroller hiç çalışmaz. Başvuru "Ek belge istendi"ye düşer ve "Eksik belge: …"
  notu yazılır.
- Bakanlık, GİB ve MERSİS'e erişim gelmezse bu üç kontrol canlıda "yapılamadı" kalır. O zaman konsoldaki kişi belgeye
  bakarak elle kontrol eder.
- Yetki belgeleri Bakanlığın İkinci El Motorlu Kara Taşıtı Ticareti Bilgi Sistemi'nde (İETTS) tutulur. Numarayla
  sorgulanan, herkese açık resmî bir ekran bulunamadı. Belge numarasının nasıl kontrol edileceğini Ticaret İl
  Müdürlüğüne ya da avukata sor.
- Erişim gelince yalnızca sağlayıcı yazılır; ekranlar değişmez.

### Konsolda inceleme

Yer: **Konsol › Pazar › Galeri başvuruları.**

- Yetki: Sahip, Yönetici ve Operasyon (ayrıca Ajan) inceleyebilir. Moderatör, Destek, Pazarlama, Finans ve İzleyici
  inceleyemez. Dört göz onayı gerekmez.
- "Sana bırakılanlar" listesinde her başvurunun kontrol işaretleri ve ajan notu görünür. "Ayrıntılar ve belgeler"
  bilgileri ve belge bağlantılarını açar.

| Düğme | Ne olur |
| --- | --- |
| Onayla | Tek işlemde: kurumsal hesap açılır, başvuran "Sahip" olur, herkese açık profil (`/galeri/<ad>`) oluşur, 30 günlük deneme ve 1 deneme talep hakkı tanımlanır. Başvurana e-posta ve bildirim gider. |
| Belge iste | Durum "Ek belge istendi" olur. Başvuran sihirbazı 3. adımda, yazdığın notla açar; belgeyi yükleyip "Yeniden gönder"e basar. Kontroller yeniden çalışır. |
| Reddet | Durum "Reddedildi" olur. Gerekçe başvurana görünür; başvuran "Yeniden başvur" diyebilir. |
| Onayı geri al | Yalnızca ajanın son 7 günde onayladıklarında ("Ajanın onayladıkları · son 7 gün"). Hesap askıya alınır. |

- Gerekçe ve notlar 10–500 karakter olmalı.
- Hazır gerekçeler var (ör. "Yetki belgesi Bakanlık kaydında bulunamadı").

### Başvuranın gördüğü durumlar

| Durum | Anlamı |
| --- | --- |
| Taslak | Gönderilmedi, düzenlenebilir |
| Kontrol ediliyor | Otomatik kontroller sürüyor |
| Yönetici incelemesinde | Konsolda insanda |
| Ek belge istendi | Düzenlenebilir, yeniden gönderilir |
| Onaylandı | "Galeri paneline git" |
| Reddedildi | "Yeniden başvur" |
| Onay geri alındı | Hesap askıda |

Başvuran kontrol ayrıntılarını görmez; yalnızca yetki belgesi satırını ve karar notunu görür.

## 4. Araç ekleme ve sahiplik kuralları

### e-Devlet kuralı (EİDS) gerçekte ne diyor

Ticaret Bakanlığının 18 Haziran 2025 duyurusuna göre internetteki tüm taşıt ilanlarını yalnızca şunlar verebilir:

- **Taşıtın sahibi.**
- **Sahibin eşi ya da 1. ve 2. derece kan hısımları.** Bunlar yalnızca sahibin adına kayıtlı araç için ilan verebilir.
  - 1. derece: anne, baba, çocuk.
  - 2. derece: kardeş, torun, büyükanne, büyükbaba.
- **Taşıt sahibinin yetkilendirdiği, yetki belgeli galeri.**

Tarihler:

- Kural 7 Nisan 2025'te 2023–2025 model araçlarla başladı.
- 16 Haziran 2025'ten beri bütün taşıt ilanlarında zorunlu.
- Platform, yayından önce ilan vereni EİDS (Elektronik İlan Doğrulama Sistemi) üzerinden doğrulamak zorunda
  (yönetmelik m.22/ç).

**Rengarenk'te bunun anlamı:**

- Bireysel kullanıcı ilan yayınlamaz, yalnızca taleplere yazar. Bu yüzden "sahibi ya da yakını" doğrulaması bizde hiç
  ortaya çıkmıyor (Karar 18). Kodda böyle bir kontrol yok, gerekmiyor da.
- Bizde ilan yalnızca galerinin portföy aracıdır. Galeri için kural şu: aracın ruhsat sahibi e-Devlet'te galeriye
  yetki vermiş olmalı.
- Araç galerinin kendi adına kayıtlıysa galeri, sahibi olarak yetkilidir.

### Ruhsat sahibi galeriye nasıl yetki verir (e-Devlet)

1. e-Devlet'e girer, arama çubuğuna "EİDS" yazar ve **"EİDS Taşıt / Araç İlanı Yetkilendirme İşlemleri"**ni açar.
2. Sağ üstte **"Galeri İşletmesi Yetkilendir"**e basar.
3. Aracını seçer, galerinin **yetki belgesi numarasını** yazar ve yetkinin bitiş tarihini seçer.

- Aynı araç için birden çok galeriye yetki verilebilir.
- Yetki aynı ekrandan uzatılır ya da iptal edilir.
- Yetki belgesi olmayan galeriye yetki verilemez.
- Bu yetki yalnızca ilan içindir; noterde satış yetkisi vermez.

Kaynaklar:

- [Ticaret Bakanlığı, 18 Haziran 2025](https://ticaret.gov.tr/haberler/ticaret-bakanligindan-yeni-ve-zorunlu-uygulama-tum-tasit-ilanlarinda-eids-yetki-dogrulama-uygulamasi-basladi)
- [Ticaret Bakanlığı, 4 Şubat 2025](https://ticaret.gov.tr/haberler/yetkisiz-isletme-ihbar-modulu-ve-eids-yetki-dogrulamasina-iliskin-basin-aciklamasi)
- [arabam.com yardım sayfası](https://www.arabam.com/yardim/eids-bireysel)

### Rengarenk'te bir aracın yolu

| Durum | Ne zaman |
| --- | --- |
| Taslak | "Taslak kaydet" ya da toplu yüklemeden gelen satır |
| Doğrulama bekliyor | "Kaydet ve EİDS'e gönder"e basıldı; işçi hemen, sonra düzenli aralıkla EİDS'e sorar |
| Yayında | EİDS onayladı (ya da araç EİDS'ten muaf kategoride). Alıcılar görür, eşleşme başlar, araç kartı olarak eklenebilir. |
| EİDS reddetti | Ruhsat sahibinin yetkisi yok |
| Pasif / Satıldı | Galeri kaldırdı. Satıldı olan araç hemen yayından kalkar (m.21). |

- Yayındaki aracın plakası değişince araç yeniden EİDS'e gider.
- Konsolda aracı EİDS'siz yayına alan bir düğme yok, olmamalı da.
- EİDS'ten muaf kategoriler: Deniz Araçları, Hava Araçları ve Kiralık Araçlar.

**Canlı için anlamı:**

- Bakanlıktan EİDS entegrasyon erişimimiz yok.
- Erişim gelmeden canlıda galerilerin kara taşıtı ilanları yayına giremez. Galeri yine onaylanır, talep açar ve
  taleplere ilk mesajı yazabilir; ama portföydeki otomobili alıcıya görünmez, eşleşmez ve araç kartı olamaz.
- Bu yüzden galeri açılışı EİDS erişimine bağlı.
- Erişim gelince Claude, Bakanlığın entegrasyon belgesine göre sağlayıcıyı yazar (yaklaşık 2 gün).
- Kod şu an "plaka ve şasinin son 6 hanesiyle sor, yetki varsa yayınla" diye kurulu. Bakanlık sorguyu galerinin yetki
  belgesi numarasıyla istiyorsa o numara da elimizde (başvurudan).

### Portföy kuralları (araç gönderilirken)

| Kural | Ne zaman | Sonuç |
| --- | --- | --- |
| 6 ay / 6.000 km (yönetmelik geçici m.2) | EİDS'li kategorilerde, 1 Ocak 2027'ye kadar (sonra kendiliğinden kapanır) | İlk tescil tarihi yoksa durdurur. Tescilden beri 6 ay geçmemişse ya da km 6.000'in altındaysa durdurur: "Tescilden sonra 6 ay ve 6.000 km dolmadan galeri satışı yapılamaz" |
| Üretici fiyatı (geçici m.2) | Bütün kategoriler | "Üretici tavsiye fiyatı" yazılı ve satış fiyatı bunu aşıyorsa durdurur. Yazılmamışsa "Satış fiyatı, aracın sıfır üretici tavsiye fiyatını aşmıyor" kutusu zorunlu. |
| Ekspertiz (m.16) | 8 model yaşı ve 160.000 km altı | Son 10 günde alınmış rapor beklenir. Uyarıdır, durdurmaz. |
| Fotoğraf | Hepsi | En az 6, en çok 30. Yayındaki araç 6'nın altına düşemez. İlk fotoğraf kapaktır. |
| Plaka ve şasi | EİDS'li kategoriler | Plaka (ör. "34 ABC 123") ve şasinin son 6 hanesi zorunlu. Aynı plaka başka açık ilanda olamaz. |
| Fiyat | Hepsi | En az 1.000 TL |
| Portföy sınırı | Pakete göre | Taslak, bekleyen, yayında ve pasif araçlar sayılır. Deneme 15, Başlangıç 25, Profesyonel 100, Kurumsal sınırsız. |

**Diğer kurallar:**

- **Kopya fotoğraf:** her fotoğrafın parmak izi başka galerilerin fotoğraflarıyla karşılaştırılır. Benzerse yükleme
  durmaz; moderasyonda "kopya fotoğraf" şikâyeti açılır.
- **Plaka:** alıcıya açık araç sayfasında plakanın yalnızca il kodu görünür ("TR plakalı · 34").
  - Fotoğraftaki plaka kendiliğinden bulanıklaşmaz.
  - Bulanıklaştırma yalnızca konsolda, galeri fotoğrafı kataloğa temsilî görsel seçilirken yapılır.
- **Galeri bilgisi (m.21):** profilde ve araçta yetki belgesi numarası ve işletme adı görünür.

### Toplu yükleme ve API

**Toplu yükleme:** Profesyonel, Kurumsal ve deneme paketlerinde var; satış temsilcisi kullanamaz.

1. "Şablonu indir" (`rengarenk_portfoy_sablonu.xlsx`; içinde örnek bir BMW satırı var).
2. "Dosyayı yükle": Excel ya da CSV, en çok 500 satır.
3. "Önizle ve onayla".

Sütunlar:

- Stok no, Kategori, Marka, Seri, Model, Paket, Model yılı, Kilometre.
- Yakıt, Vites, Renk, Fiyat (TL).
- Plaka, Şasi son 6, İlk tescil (GG.AA.YYYY), Tramer (TL).
- Takas (E/H), Üretici fiyatını aşmıyor (E/H), Açıklama.

Nasıl işler:

- Satırlar taslak olarak gelir; fotoğraflar sonra panelden eklenir.
- Aynı stok numarası var olan aracı günceller.
- Hatalı satırlar için `portfoy_hata_raporu.xlsx` iner.

**API anahtarı:** yalnızca Kurumsal pakette. Galerinin kendi stok programı portföyü otomatik günceller.

- Anahtar `rgk_…` biçiminde ve yalnızca bir kez gösterilir; bizde yalnızca özeti saklanır.
- Uçlar `/entegrasyon/v1/araclar` altında: listele, ekle/güncelle, satıldı, pasif.

## 5. Adım adım test senaryosu

Senaryoda üç kişi var: **A** galeri sahibi, **B** satış temsilcisi, **C** alıcı.

- Üç hesabı aynı anda açmak için üç ayrı tarayıcı profili ya da gizli pencere kullan.
- Konsol için dördüncü bir pencere aç.
- Kategori olarak **Otomobil** kullan; sahte EİDS açık olduğu için araç yayına girer.

### 5.1 Üyelik (A, B, C)

1. `beta.rengarenksite.com/uye-ol`: ad, soyad, e-posta, şifre ve telefonu yaz.
2. Kod ekranda görünür ve kendiliğinden yazılır; "Doğrula"ya bas.
3. **Bak:** üç hesap da açıldı ve Hesabım menüsü görünüyor.

### 5.2 Kurumsal başvuru (A)

1. Menüden "Galeriler için · 30 gün ücretsiz"i ya da doğrudan `/kurumsal-basvuru`'yu aç.
2. İşletme türü: Vasıta galerisi.
3. İşletme bilgileri: hazırlık listesindeki deneme numaralarını yaz.
4. Yetki ve belgeler:
   - Yetki belgesi no olarak `34-2026-009` yaz ve "Bakanlık sisteminden doğrula"ya bas. Uyarı göreceksin; bu sayede
     başvuru insana düşer.
   - Önce yalnızca iki belge yükle; oda kayıt belgesini bırak.
5. Hesap sahibi: bilgileri doldur, sözleşme kutusunu işaretle, "Başvuruyu gönder"e bas.
6. **Bak:** birkaç saniye içinde durum "Ek belge istendi" olur ve "Eksik belge: Oda kayıt belgesi" yazar.
7. Eksik belgeyi yükle ve "Yeniden gönder"e bas. **Bak:** durum "Yönetici incelemesinde".

### 5.3 Konsolda inceleme (sen)

1. `yonetim.rengarenksite.com` › Pazar › **Galeri başvuruları** › "Sana bırakılanlar".
2. **Bak:**
   - Kontrol işaretleri: yetki ◆ uyarı; vergi, MERSİS, adres ve telefon ✓.
   - Ajan notu var.
   - "Ayrıntılar ve belgeler"de belgeler açılıyor.
3. Önce **Belge iste**'ye bas ve en az 10 karakterlik bir not yaz.
   - A'nın ekranında sihirbaz 3. adımda notla açılır.
   - A başvuruyu yeniden gönderir.
4. Sonra **Onayla**'ya bas.
5. **Bak:**
   - A'ya "Galeri hesabın açıldı" e-postası ve bildirimi geldi.
   - Başvuru ekranında "Galeri paneline git" düğmesi çıktı.
   - Konsol › İşlem kaydı'nda onay ve belge açılışları yazılı.
6. **Ajan onayını dene:** ikinci bir hesapla, yetki no `34-2026-001` ve üç belgeyle başvur.
   - **Bak:** başvuru birkaç saniyede kendiliğinden onaylanır. Konsolda "Ajanın onayladıkları · son 7 gün" altında
     "Onayı geri al" düğmesi çıkar.
   - Ajan konsolda durdurulmuşsa başvuru yine insana düşer.
7. **Reddi dene:** yetki no `04-2026-001` (0 ile başlıyor) ile başvur, ardından konsoldan **Reddet**.
   - **Bak:** gerekçe başvurana görünür ve "Yeniden başvur" çıkar.

### 5.4 Galeri paneli ve profil (A)

1. `/galeri-paneli` › **Özet**. **Bak:**
   - Deneme süresi 30 gün.
   - Portföy 0/15.
   - Bugünkü ilk mesaj 0/10.
   - Deneme talep hakkı 1.
2. "Galeri profilin" bölümünde tanıtım ve çalışma saatlerini yaz, "Kaydet"e, sonra "Profili gör"e bas.
3. **Bak:** `/galeri/<ad>` sayfasında işletme adı, "Yetki belgesi no …" yazısı ve "✓ Onaylı galeri" rozeti var.

### 5.5 Ekip (A ve B)

1. A: **Ekip** › "+ Çalışan davet et" › B'nin telefonu, rol "Satış temsilcisi" › "Davet gönder".
2. **Bak:** B'ye "… seni ekibine davet etti" bildirimi geldi.
   - E-posta da gelir; ancak B'nin e-postası doğrulanmışsa.
   - Bildirim yalnızca o numarayla hesabı olana gider. Hesabı olmayan kişi üye olunca daveti panelde görür.
3. B bildirime ya da `/galeri-paneli`'ne tıklar › "Galeri davetlerin" › **Kabul et**.
4. **Bak:**
   - B panelde "Paket ve faturalar"ı ve işletme bilgilerini görmez.
   - A'nın Ekip listesinde B var.
5. A: B'nin satırında "Düzenle" › günlük ilk mesaj sınırını 1 yap. Bu sınır 5.8'de denenecek.

### 5.6 Araç ekleme ve kurallar (A)

1. **Araç ekle**'ye gir; kategori Otomobil, katalogdan marka, seri ve model seç.
2. Kuralları bilerek bozarak dene:
   - 5 fotoğraf yükle → gönderemezsin (en az 6).
   - İlk tescil tarihini 2 ay öncesi yaz → "Tescilden sonra 6 ay ve 6.000 km dolmadan…".
   - Üretici tavsiye fiyatını satış fiyatından düşük yaz → durdurur.
   - Üretici fiyatını boş bırak ve kutuyu işaretleme → kutu zorunlu.
   - 3 yıllık araçta ekspertiz yükleme → yalnızca uyarı, gönderilebilir.
3. Kurallara uyan üç araç gönder; plakaların son rakamı farklı olsun (ör. 34 ABC 120, 34 ABC 129, 34 ABC 123).
4. **Bak:**
   - Plakası **0** ile biten araç: "EİDS reddetti" ("Ruhsat sahibi ilanı onaylamadı").
   - Plakası **9** ile biten: "Doğrulama bekliyor"da kalır. Özet'te "EİDS doğrulaması bekleyen" 1 görünür.
   - Diğeri: "Yayında". Araç sayfası `/arac/<no>` açılıyor ve plakanın yalnızca il kodu görünüyor.

### 5.7 Toplu yükleme (A)

1. **Toplu yükleme** › "Şablonu indir". Örnek satırı değiştirip iki satır yap.
2. Satırlardan birini bilerek bozuk yaz (ör. geçersiz plaka).
3. Dosyayı yükle, ardından önizle.
4. **Bak:**
   - Bozuk satır için hata raporu iniyor.
   - Sağlam satır portföye taslak olarak geldi.
5. Aynı stok numarasıyla yeniden yükle. **Bak:** yeni araç açılmadı, var olan güncellendi.

### 5.8 Talep, eşleşme ve ilk mesaj (C, A, B)

1. C: yayındaki araca uyan bir talep açar: aynı marka ve seri, aynı il, araca uyan bütçe ve yıl.
2. A: **Eşleşmeler**'de talebi görür.
3. A: "Mesaj at" › "Kimin adına": galeri › araç kartını ekle › "Gönder · 1 hak kullanılır".
4. **Bak:**
   - Özet'te ilk mesaj 1/10 oldu.
   - Aynı talebe galeriden ikinci bir ilk mesaj gönderilemiyor.
5. B (sınırı 1): başka bir talebe bir ilk mesaj gönderir, sonra bir tane daha dener.
   - **Bak:** "Bugünkü kişisel ilk mesaj sınırın (1) doldu…".
6. C talebinde "yalnızca sahibinden"i seçerse galeri yazamaz.
   - **Bak:** "Alıcı yalnızca sahibinden araç arıyor".

### 5.9 Sohbet ve puan (C ve A)

1. C, Mesajlarım'da araç kartlı mesajı görür ve cevap yazar. A cevap verir. Numara paylaşımını da dene.
2. C, galeriye yıldız verir.
3. **Bak:** 3 günden genç hesapların yıldızı puana sayılmaz. Rozet ve puan değişmezse bu bir hata değildir.
4. 1 yıldız verilirse A, Özet'teki güven kartından "İtiraz et" diyebilir. Kararı Konsol › Moderasyon › İtirazlar'dan
   verirsin.

### 5.10 Alıcıdan araca mesaj ve takip (C)

1. C, `/arac/<no>` sayfasından galeriye yazar. Bu ücretsizdir; günde en çok 10 farklı araca yazılabilir.
2. C, galeri profilinde "Takip et"e basar.
3. **Bak:** sohbet araç kartıyla başlıyor.

### 5.11 Galeri adına talep ve satış (A)

1. Özet › "Galerin adına talep aç"; sihirbazda "Kimin adına?" sorusuna galeri seç.
   - Deneme talep hakkı 1'den 0'a iner.
2. Portföyde yayındaki aracı **Satıldı** yap.
   - **Bak:** araç sayfası ve eşleşme hemen kalktı.

### 5.12 Paket ve ödeme (A)

1. **Paket ve faturalar** › bir paket seç. Ödeme kart istemeyen sahte sayfada açılır.
2. Üç düğmeyi ayrı ayrı dene:
   - "Kartı kaydet ve öde (başarılı)" → paket hemen açılır.
   - "Kaydet ve öde · yenilemede reddedilecek kart" → ilk ödeme geçer, ilk yenilemede reddedilir. Yenileme 3 gün
     denenir, sonra paket biter.
   - "Ödemeyi reddet (başarısız)" → paket açılmaz.
3. Üst pakete geçişi (fark hemen alınır) ve iptali dene. İptal dönem sonunda geçerli olur; kısmi iade yoktur.
4. Kurumsal pakette **Toplu yükleme › API entegrasyonu › Anahtar oluştur**. **Bak:** anahtar bir kez gösterilir.
5. **Faturalar:** e-Arşiv bağlı olmadığı için faturalar kuyrukta bekler. Para hareketi yoktur.

### 5.13 Konsoldan galeri yönetimi (sen)

1. **Galeri müşterileri:** galeri listede; risk ve deneme bitiş tarihi görünüyor. "Sorumlu çalışan" seç.
2. **Galeri kartı** (Kullanıcılar ve galeriler):
   - "Hak tanımla" › Ek ilk mesaj, gerekçesiyle. **Bak:** A'nın hakkı arttı.
   - "Not ekle".
   - Kişisel veriyi gerekçeyle aç. 5 dakika sonra yeniden maskelenir.
3. En sona bırak: "Uyar" ve "24 saat askıya al". **Bak:**
   - A'nın panelinde "Galeri hesabın askıya alındı…" şeridi var.
   - A mesaj gönderemiyor.
   - Askı 24 saat sürer.

### 5.14 Deneme bitişi

- 30 gün beklemeden denemek için Claude deneme bitiş tarihini test veritabanında geçmişe çekebilir; söylemen yeter.
- Hatırlatmalar bitişten 7, 3 ve 1 gün önce gider.
- **Bak:** "Deneme süren bitti" şeridi çıktı; araç eklenemiyor ve mesaj gönderilemiyor; portföy yalnızca
  görüntülenebiliyor.

### Mobil (isteğe bağlı)

Aynı A hesabıyla mobilde Hesabım › Galeri paneli'ni aç: Panel, Eşleşmeler, Araç ekle (3 adım), Portföy, Mesajlar.
Ekip, paket ve toplu yükleme mobilde yok; web'e yönlendirir.

## 6. Sahte sağlayıcılar ve canlıdan önce gerekenler

### Sahte sağlayıcılar nasıl davranır

Sonucu yazdığın numaranın ilk ya da son rakamı belirler; böylece her durumu bilerek üretebilirsin.

| Sağlayıcı | Ne yazılırsa | Sonuç |
| --- | --- | --- |
| Kurum doğrulaması | Yetki belgesi no **0** ile başlıyor | Yetki kontrolü kalır ✕ |
| | Yetki belgesi no **9** ile bitiyor | Uyarı ◆ ("süresi 12 gün sonra doluyor") |
| | Vergi numarası **0** ile başlıyor | Vergi kontrolü kalır |
| | MERSİS **0** ile bitiyor | MERSİS kontrolü kalır |
| | Hepsi temiz | Beş kontrol geçer ve ajan kendisi onaylar. Ajan konsol › Ajan'dan durdurulursa karar yine insana kalır. |
| EİDS | Plaka **0** ile bitiyor | "EİDS reddetti" ("Ruhsat sahibi ilanı onaylamadı") |
| | Plaka **9** ile bitiyor | "Doğrulama bekliyor"da kalır |
| | Diğer plakalar | Onaylanır, "Yayında" |
| Ödeme | Sahte ödeme sayfasında seçilen düğme | "Ödemeyi onayla (başarılı)", "Kartı kaydet ve öde (başarılı)", "Kaydet ve öde · yenilemede reddedilecek kart", "Ödemeyi reddet (başarısız)". Para hareketi yoktur, fatura kesilmez. |

### Bilinen eksikler

- **Ücretli paketi konsoldan verme yok.** Paket yalnızca ödemeyle değişir; test sunucusunda sahte ödemeyle.
- **Profildeki "Yetki belgesi doğrulandı" yazısı.** Canlıda kurum erişimi gelene kadar doğrulamayı insan, belgeye
  bakarak yapacak. Bu yazının doğru kalması için konsoldaki kişi yetki belgesini gerçekten kontrol etmeli.

### Galerileri canlıya açmadan önce

| İş | Neden | Kimde |
| --- | --- | --- |
| EİDS entegrasyon erişimi (Ticaret Bakanlığı) | Bu erişim olmadan galerilerin kara taşıtı ilanları yayına giremez (m.22/ç) | Sen başvurursun; erişim gelince sağlayıcıyı Claude yazar |
| Yetki belgesi, GİB, MERSİS | Otomatik başvuru kontrolü için (m.22/a). Erişim yoksa başvurular elle incelenir | Sen sorarsın; "elle kontrol yeterli mi" sorusunu avukata da sor |
| İlan verenin kimlik doğrulaması (m.22/b: ad, soyad, TCKN ve telefon; yılda bir yenileme, 5 yıl saklama) | Bizde bugün yalnızca telefon doğrulaması var. Galeride "ilan veren"in galerinin kendisi mi yoksa çalışanı mı olduğu avukatla netleşmeli | Avukat; karar gelince Claude yazar |
| PayTR ve e-Arşiv | Paket satışı ve fatura için | Şirket kurulunca sen başvurursun |
| Galeri hizmet sözleşmesi | Başvuruda onaylanan metin | Avukat görsün; sonra konsol › Yasal metinler'den yayınlanır |
| İnceleme ekibi | Başvurular insanda kaldıkça her gün bakılmalı | Sen ya da Operasyon rolünde bir çalışan |
| Sahte sağlayıcıları kapatma | Herkese açılışta `GALLERY_VERIFY_PROVIDER`, `EIDS_PROVIDER` ve `PAYMENT_PROVIDER` `none` olmalı (ya da gerçek sağlayıcıya geçilmeli) | Claude; açılış adımlarında |

## 7. Sorun çıkarsa

| Ne görüyorsun | Neden | Ne yap |
| --- | --- | --- |
| Site açılmıyor, zaman aşımı | Bağlandığın ağın IP adresi izinli değil | IP adresini Claude'a söyle |
| Kod isterken "çok fazla deneme" (429) | Aynı numaraya 60 saniyede bir ve saatte 5; aynı IP'den saatte 20 kod istenebilir | Biraz bekle ya da başka numara kullan |
| "Zaten bir kurumsal hesabın var" | Bu kişi zaten bir galerinin üyesi (örneğin B daveti kabul etti) | Başvuruyu başka bir hesapla yap |
| Başvuru hemen "Ek belge istendi" oldu | Zorunlu belgelerden biri eksik | Notta yazan belgeyi yükle, yeniden gönder |
| Başvuru kendiliğinden onaylandı | Sahte doğrulamada her şey geçti, ajan onayladı | İnsan incelemesi için yetki no'yu 9 ile bitir |
| Vergi numarası kabul edilmiyor | Sağlama hanesi tutmuyor | `1234567890` gibi geçerli bir numara yaz |
| Davet edilen kişi daveti görmüyor | Davet kişinin doğrulanmış telefonuna bağlı; kişi zaten başka bir galeride olabilir | Numaranın aynı olduğunu kontrol et. Davet 7 günde düşer |
| Araç "Doğrulama bekliyor"da kaldı | Sahte EİDS'te plaka 9 ile bitiyor | Plakayı değiştir |
| "Kaydet ve EİDS'e gönder" hata veriyor | 6 fotoğraf, plaka, şasi son 6, ilk tescil, 6 ay / 6.000 km ya da üretici fiyatı kuralı | Hata metni hangi kural olduğunu yazar |
| Eşleşmeler boş | Araç ya da talep yayında değil; marka, il ya da bütçe uymuyor; deneme bitti | İkisinin de "Yayında" olduğunu ve kriterlerin uyduğunu kontrol et |
| "Mesaj at" kapalı ya da hata veriyor | Günlük ilk mesaj hakkı bitti (gece 00:00'da yenilenir), kişisel sınır doldu, deneme bitti, hesap askıda ya da alıcı "yalnızca sahibinden"i seçmiş | Hata metnine bak. Konsoldan "Hak tanımla" ile ek ilk mesaj verebilirsin |
| Toplu yükleme düğmesi yok | Başlangıç paketi ya da satış temsilcisi | Deneme, Profesyonel ya da Kurumsal pakette sahip veya yönetici olarak dene |
| Yıldız verildi ama puan değişmedi | 3 günden genç hesap, aynı cihaz ya da bağlı hesap | Bu beklenen durum (hile kuralı) |
| E-posta gelmedi | Adres yanlış ya da doğrulanmamış, istenmeyen klasöründe ya da bildirim tercihi kapalı | Önce istenmeyen klasörüne bak; yoksa Claude teslim kaydına baksın |

Takılırsan adımın numarasını (ör. "5.6, 4"), hangi hesapla olduğunu ve ekrandaki metni yaz; Claude sunucu günlüğünden
bakar.
