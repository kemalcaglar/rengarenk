# Ödenecek ücretler ve resmî giderler

Bu belge, Claude belgesi "Ödenecek ücretler ve resmî giderler"in depodaki kopyasıdır.

- **Tarih ve yıl:** Tutarlar 2026 yılı içindir. 23 Kasım 2026'da resmî sayfalardan ya da güvenilir ikincil
  kaynaklardan alındı.
- **Kaynaklar:** her bölümün altında yazılı.
- **"Bilinmiyor" yazan yerler:** resmî bir tutar bulunamadı; tahmin yazılmadı.
- **Ocak 2027:** birçok harç ve tarife yeniden değerleme oranıyla artar. Başvurmadan önce güncel tutara bak.

## 1. Özet

> **Sahibin durumu (23 Kasım 2026):** zaten kuaför faaliyet kodlu bir şahıs işletmesi var (esnaf, işletme hesabı)
> ve sahip emekli. Bu yüzden yeni şirket kurulmaz; platform için ikinci bir faaliyet kodu eklenir. Emekli kendi işini
> yaptığı için Bağ-Kur ya da SGDP ödemez (5510 md. 6/1-n, 2016'dan beri). Sicil harcı, oda kaydı ve noter çoğu durumda
> gerekmez. Aşağıdaki genel tablolarda bu kalemler yine duruyor; sana uymayanlar "Sahip için" notuyla işaretli.
> Ayrıntı: `docs/YAPILACAKLAR.md` › 5. adım.
>
> **Mali müşavirle netleşenler (23 Kasım 2026):**
> - Faaliyet kodu **63.92.00 Diğer bilgi hizmeti faaliyetleri**.
> - Elektronikçiler (bilgisayarcılar) esnaf odasına kayıt gerekiyor. Kayıt ücreti ve aidat odaya göre değişir.
> - Yurt dışından alınan hizmetlerin KDV'si 2 No.lu KDV beyannamesiyle beyan edilip ödenir (bölüm 3, Vergiler).

### Bir kerelik

| Kalem | Kime | Tutar | Zorunlu mu |
| --- | --- | --- | --- |
| Ticaret sicili tescil harcı (gerçek kişi işletmesi) | Ticaret Sicil Müdürlüğü | 5.466,10 TL | Tacir sayılırsan evet. Sahip için: esnaf kaldıkça yok |
| Oda kayıt ücreti | Ticaret ya da esnaf odası | 3.303 – 16.515 TL (odaya ve dereceye göre) | Evet. Sahip için: elektronikçiler esnaf odasına kayıt (mali müşavir, 23 Kasım 2026); tutarı odaya sor |
| Noter imza beyannamesi | Noter | Resmî tutar bulunamadı (piyasada 700 – 2.000 TL) | Sicil için evet |
| Marka tescili, 1 sınıf (başvuru + tescil) | TÜRKPATENT | 9.830 TL + KDV | İleti Merkezi SMS başlığı için istendi; adı korumak için önerilir |
| Google Play Console | Google | 25 USD | Android için evet |
| Nitelikli e-imza (PTT) | PTT | 1 yıl 2.000 TL, 2 yıl 2.750 TL, 3 yıl 3.500 TL | e-Arşiv ve kurum işleri için fiilen gerekli |

### Her ay ya da her yıl

| Kalem | Kime | Tutar | Sıklık | Zorunlu mu |
| --- | --- | --- | --- | --- |
| Bağ-Kur primi | SGK | 11.808,23 TL; prim borcu yoksa 10.156,73 TL | Aylık | Evet. **Sahip için: 0** (emekli, kendi işini yapıyor; bölüm 2) |
| Mali müşavir | SMMM | İşletme hesabında 3.593 TL'den başlar (KDV dahil). İstanbul'da %35 fazla, ilk iki yıl %50 indirim | Aylık | Fiilen evet |
| AWS sunucu (Lightsail 8 GB) | AWS | 44 USD | Aylık | Evet. Şu an 1.000 USD krediden düşüyor |
| Oda yıllık aidatı | Oda | Kayıt yılında yok; sonra odaya göre | Yıllık | Evet |
| Apple Developer Program | Apple | 99 USD (Türkiye'de yaklaşık 1.029 TL bildiriliyor) | Yıllık | iPhone için evet |
| e-Arşiv özel entegratör | Özel firma | 1.000 faturalık kontör yaklaşık 2.750 – 5.250 TL + KDV | Paket | Otomatik fatura için evet |
| WhatsApp doğrulama kodu ve kritik bildirim | Meta | Mesaj başı 0,0009 USD (10.000 mesaj yaklaşık 9 USD) | Kullanım kadar | Evet (giriş kodu bununla gider) |
| Amazon SES e-posta | AWS | 1.000 e-posta 0,10 USD | Kullanım kadar | Evet |
| Yapay zekâ (Bedrock) | AWS | Kullanım kadar; Kasım'da 0 USD'ye yakın | Kullanım kadar | Evet |
| Google Workspace (`rengarenksite.com` e-postaları, konsol girişi) | Google | Kullanıcı başına aylık; tutarı kendi faturana bak | Aylık | Konsol girişi bununla yapılıyor |
| `.com` alan adı yenileme | Kayıt firması | Toptan fiyat 10,97 USD + firma payı | Yıllık | Evet |
| KEP adresi | PTT | Yıllık 215 TL, ileti başı 8,70 TL | Yıllık | **Evet:** e-ticaret yönetmeliği (RG 29.12.2022) md. 5/1 sitede KEP adresinin yazılmasını istiyor |
| Beyanname damga vergileri | GİB | KDV ve muhtasar beyannamesi 791 TL, yıllık gelir vergisi beyannamesi 1.189,50 TL | Beyanname başına | Evet |

### Satıştan kesilenler

| Kalem | Oran |
| --- | --- |
| PayTR (web ödemesi, galeri paketi) | Teklifle belirlenir; tek çekim %2,19'dan başlıyor (ikincil kaynak) |
| App Store ve Google Play (mobil hak satışı) | Small Business Program'la %15, yoksa %30 |

### Ücretsiz ama yapılması gerekenler

- Vergi dairesine işe başlama bildirimi.
- e-Tebligat: işe başladıktan sonraki 15 gün içinde.
- ETBİS kaydı: satışa başlamadan önce.
- İYS hizmet sağlayıcı kaydı: elle kullanımda ücretsiz.
- KVKK: AWS standart sözleşmesinin Kurul'a bildirimi, imzadan sonraki 5 iş günü içinde.
- GİB e-Arşiv portalı (elle fatura).
- D-U-N-S numarası.
- VERBİS: kayıt gerekmiyor.

### İlk yıl için kaba toplam

**Sabit aylık giderler** Bağ-Kur, mali müşavir ve AWS'dir:

- Bağ-Kur ödeniyorsa ayda yaklaşık 15.400 TL + 44 USD.
- Bağ-Kur ödenmiyorsa ayda yaklaşık 3.600 TL + 44 USD. **Sahip için geçerli olan bu** (emekli); mali müşavir zaten
  çalışıyorsa ücreti değişebilir.
- AWS kısmı kredi bitene kadar cepten çıkmaz.

**Bir kerelik giderler** (sicil, oda, noter, marka, mağazalar, e-imza) toplamı yaklaşık 25.000 – 40.000 TL. Sahip için
sicil, oda ve noter düşer: marka, mağazalar, e-imza ve KEP toplamı yaklaşık 15.000 – 17.000 TL.

**Bu toplamlara dahil olmayanlar:** avukat ve marka vekili ücretleri.

## 2. Şirket kuruluşu, vergi ve mali müşavir

### Kuruluş

1. **Vergi dairesine işe başlama.** Genelde mali müşavir e-Devlet ya da Dijital Vergi Dairesi üzerinden yapar. Resmî
   bir harç bulunamadı.
2. **Ticaret sicili ve oda kaydı.**
   - Yazılım ve internet platformu genelde tacir sayılır ve ticaret odasına kaydolur. Küçük ölçekli işler esnaf
     odasına da kaydolabilir. Hangisi olduğunu mali müşavirle netleştir.
   - Tescil harcı 5.466,10 TL.
   - Oda kayıt ücreti 3.303 – 16.515 TL. Kayıt yılında aidat alınmaz.
   - Ticaret Sicili Gazetesi ilan ücreti: bilinmiyor.
3. **Noter imza beyannamesi.** Resmî kalem tutarı tarifede yok; piyasada 700 – 2.000 TL söyleniyor.
4. **e-Tebligat.** İşe başladıktan sonraki 15 gün içinde zorunlu ve ücretsiz (VUK 596).

Bunlar bitince şirket gerektiren diğer işlere başlanabilir: PayTR, e-Arşiv, Apple, ETBİS, İYS, Meta işletme
doğrulaması ve marka başvurusu.

### Her ay ödenenler

| Kalem | Tutar | Not |
| --- | --- | --- |
| Bağ-Kur (4/b) | 11.808,23 TL; prim borcu yoksa 10.156,73 TL (5 puan indirim) | Taban kazanç 33.030 TL × %35,75. Başka bir işte SGK'lı (4/a) çalışıyorsan iki sigorta birlikte işlemez. **Emekli kendi işini yaparsa sigortalı sayılmaz ve SGDP de ödemez** (5510 md. 6/1-n; SGDP kesintisi 29.02.2016'da kalktı): tutar 0. Faaliyet kodu eklemek bunu değiştirmez. |
| Mali müşavir, işletme hesabı | Ankara grubunda çalışansız 3.593 TL, çalışanlı 4.791 TL (KDV dahil) | Asgari ücret tarifesi (RG 17.12.2025). İstanbul'da %35 fazla. 2026'da ilk kez defter tutanlara ilk iki yıl %50 indirim. |
| Mali müşavir, bilanço esası (büyürsen) | Mikro işletme 7.985 TL/ay; çalışansız %25 indirimli | — |

### Vergiler

| Vergi | Ne zaman | Not |
| --- | --- | --- |
| KDV | Aylık beyan | Satılan hak ve paketlerin fiyatına %20 eklenir ve devlete ödenir. Galeri paket fiyatları KDV hariç yazılı (Karar 12); bu senin cebinden çıkmaz, alıcıdan alınır. |
| KDV2 (sorumlu sıfatıyla, KDV Kanunu md. 9) | Aylık, 2 No.lu KDV beyannamesi | Yurt dışı firmalardan alınan hizmetin (AWS, Apple, Google, Meta, Expo, RevenueCat) %20'sini sen beyan eder ve ödersin. Aynı tutar 1 No.lu beyannamede indirilir: satış varken satış KDV'sinden düşer, satış yokken devreder. Gerçek gider değildir ama önce cebinden çıkar. Faturada Türk KDV'si zaten varsa ayrıca beyan edilmez; mali müşavir netleştirir. |
| Gelir vergisi | Yıllık beyan; geçici vergi üç ayda bir | Kâr üzerinden, dilimli |
| Genç girişimci istisnası | — | 18–29 yaş, ilk kez mükellef ve işi bizzat yürütüyorsan kârın 400.000 TL'si gelir vergisinden muaf. Süresi kaynaklarda çelişkili (3 ya da 5 yıl). Genç girişimciye verilen 1 yıllık Bağ-Kur desteği 1 Ocak 2026'da kaldırıldı (7566 sayılı Kanun). |
| Damga vergisi | Beyanname başına | KDV 791 TL, muhtasar 791 TL, muhtasar ve prim hizmet 949,70 TL, yıllık gelir vergisi 1.189,50 TL. Sözleşmelerde binde 9,48. |
| Dijital hizmet vergisi | — | İlgili değil. Türkiye'de 20 milyon TL ve dünya genelinde 750 milyon EUR ciro birlikte aşılmadan doğmaz. |

Kaynaklar:

- [2026 ticaret sicili harçları](https://www.alomaliye.com/2026/01/01/2026-yili-ticaret-sicili-harclari/)
- [Ticaret Bakanlığı, oda kayıt ücreti ve aidat](https://ticaret.gov.tr/ic-ticaret/odalar-ve-borsalar/odalar/odalarda-kayit-ucreti-yillik-aidat-ve-munzam-aidat)
- [2026 noterlik ücret tarifesi](https://higm.adalet.gov.tr/Resimler/SayfaDokuman/202512301701273242026%20YILI%20NOTERL%C4%B0K%20%C3%9CCRET%20TAR%C4%B0FES%C4%B0.pdf)
- [2026 SMMM asgari ücret tarifesi (ASMMMO)](https://asmmmo.org.tr/userfiles/others/files/Mvzt/Prtk/uc/AUT-2026.pdf)
- [2026 SGK primleri](https://www.alomaliye.com/2026/07/29/sgk-primleri-rehberi-2026/)
- [2026 damga vergisi tutarları (KPMG)](https://kpmgvergi.com/yayinlar/mali-bultenler/vergi/2026-yilinda-uygulanacak-damga-vergisi-tutarlari/3349)
- [7566 sayılı Kanun, sosyal güvenlik (PwC)](https://www.pwc.com.tr/tr/hizmetlerimiz/insan-yonetimi-ve-organizasyon-danismanligi/sosyal-guvenlik-hizmetleri/bultenler/2025/7566-sayili-torba-kanundaki-sosyal-guvenlik-duzenlemeleri.html)
- [VUK 596, e-Tebligat](https://www.alomaliye.com/2026/10/11/vergi-usul-kanunu-genel-tebligi-sira-no-596-vuk-596/)
- [Dijital hizmet vergisi](https://www.alomaliye.com/2025/12/25/dijital-hizmet-vergisi-orani-dusuruldu-2026-yilinda-yuzde-5-2027-yilinda-yuzde-2-5/)

## 3. Devlet kurumları ve resmî kayıtlar

| Kurum / kayıt | Tutar | Zorunlu mu, ne zaman | Bizdeki durum |
| --- | --- | --- | --- |
| KVKK · VERBİS | Ücretsiz | Gerekmiyor: 50'den az çalışan ve 100 milyon TL'nin altında bilançoda muaf. Ana işi özel nitelikli veri işlemek olanlarda eşik 10 çalışan / 10 milyon TL; biz özel nitelikli veri işlemiyoruz. | Karar 37 |
| KVKK · yurt dışına aktarım bildirimi (AWS standart sözleşmesi) | Ücret bulunamadı (yok gibi) | Evet. İmzadan sonraki 5 iş günü içinde, Kurul'un bildirim modülünden. Bildirmemenin cezası 2026'da 90.308 – 1.806.377 TL. | Canlıya gerçek kullanıcı verisi girmeden önce |
| İYS (İleti Yönetim Sistemi) | Temel Hizmetler (sitede elle) her zaman ücretsiz. 25.000 adrese kadar paketler de ücretsiz. 25.001 – 75.000 adres yıllık 24.948 TL + KDV. | Evet, ticari ileti göndermeden önce | Elle CSV yüklüyoruz (Karar 49), yani ücretsiz. Entegratör gerekmez. |
| ETBİS (Elektronik Ticaret Bilgi Sistemi) | Resmî kaynakta ücret yok | Evet. Satışa başlamadan önce, e-Devlet ile `eticaret.gov.tr` üzerinden. Bilgi değişirse 30 gün içinde bildirilir. | Şirket kurulunca |
| e-Tebligat (GİB) | Ücretsiz | Evet, işe başladıktan sonraki 15 gün içinde | Şirket kurulunca |
| KEP adresi (PTT) | Yıllık 215 TL, ileti başı 8,70 TL (Aralık 2025 tarifesi; başka bir rehber 295 TL diyor) | Şahıs işletmesi için zorunlu olduğunu gösteren kaynak bulunamadı. KVKK bildirimi için de şart değil. | İsteğe bağlı; resmî yazışma için işe yarar |
| Nitelikli e-imza (PTT) | 1 yıl 2.000 TL, 2 yıl 2.750 TL, 3 yıl 3.500 TL (KDV dahil, PTT sayfası) | Dolaylı olarak: e-Arşiv, KEP ve bazı kurum başvuruları için | Şirket kurulunca |
| Mali mühür (TÜBİTAK Kamu SM) | Resmî fiyat bulunamadı; bayi fiyatı 3 yıl + okuyucu yaklaşık 3.000 TL | Gerçek kişi mükellef çoğu zaman e-imzayla idare eder; e-Arşiv entegratörüne sor | — |
| TÜRKPATENT marka | 1 sınıf: başvuru 2.820 TL + tescil 7.010 TL = 9.830 TL + KDV. 2. sınıf +2.820 TL, sonraki her sınıf +3.150 TL. Yenileme (10 yılda bir, 2 sınıfa kadar) 8.730 TL. | Yasal zorunluluk yok. İleti Merkezi SMS başlığı için istedi; adı korumak için önerilir. | Olası sınıflar: 35 (çevrim içi pazar yeri), 42 (yazılım), gerekirse 38 (iletişim). Marka vekiline ya da avukata danış. |
| BTK · 5651 | Tanıtıcı bilgi (künye) ücretsiz. Yer sağlayıcı faaliyet belgesinde ücret yok. | Sitede künye zorunlu. Yer sağlayıcı belgesinin bize uygulanıp uygulanmadığı doğrulanamadı. | Avukata sor |
| Ticaret Bakanlığı · EİDS | Entegrasyon ücretine dair kaynak bulunamadı | Galerilerin kara taşıtı ilanlarını yayınlamak için evet (yönetmelik m.22/ç) | Erişim iste |
| 6563 · aracı hizmet sağlayıcı lisansı | — | İlgili değil. Lisans, yıllık net işlem hacmi yaklaşık 79 milyar TL'yi aşınca gerekiyor. | — |

**Bize değil, galerilere düşen ücret:** galerinin ikinci el taşıt ticareti yetki belgesi harcı 2026'da yıllık 20.000
TL. Bunu galeri öder; biz yalnızca belgenin varlığını kontrol ederiz.

**KVKK 2026 idari para cezaları (fikir versin diye):**

| İhlal | Ceza aralığı |
| --- | --- |
| Aydınlatma | 85.437 – 1.709.200 TL |
| Veri güvenliği | 256.357 – 17.092.242 TL |
| VERBİS | 341.809 – 17.092.242 TL |
| Standart sözleşmeyi bildirmeme | 90.308 – 1.806.377 TL |

Kaynaklar:

- [VERBİS istisnası](https://www.muhasebenews.com/?p=67862)
- [Özel nitelikli veri eşiği](https://www.alomaliye.com/2025/10/01/ozel-nitelikli-kisisel-veri-isleme-veri-sorumlularinin-verbise-kayit-yukumlulugune-iliskin-istisna-kriteri/)
- [KVKK standart sözleşme bildirim modülü](https://www.kvkk.gov.tr/Icerik/8043/Standart-Sozlesme-Bildirim-Modulu-Hakkinda-Kamuoyu-Duyurusu)
- [2026 KVKK cezaları](https://cottgroup.com/tr/mevzuat/item/yeniden-degerleme-oranina-gore-2026-yili-kvkk-idari-para-cezalari)
- İYS paketleri: iys.org.tr › Paketler ve Modüller (sayfada tarih yok)
- [ETBİS kayıt esasları](https://ticaret.gov.tr/duyurular/elektronik-ticaret-bilgi-sistemine-etbis-kayit-ve-bildirim-esaslari)
- [PTT KEP ve e-imza](https://www.ptt.gov.tr/kep-hizmetleri-e-imza)
- [KEP ücretleri haberi](https://www.hukukihaber.net/pttden-kep-ucretlerine-zam)
- [TÜRKPATENT marka ücretleri](https://www.turkpatent.gov.tr/en/trademark-fees)
- [BTK yer sağlayıcı yönetmeliği](https://www.lexpera.com.tr/mevzuat/yonetmelikler/telekomunikasyon-kurumu-tarafindan-erisim-saglayicilara-ve-yer-saglayicilara-faaliyet-belgesi)
- [Yetki belgesi harcı 2026](https://www.alomaliye.com/2025/12/22/2026-ticaret-yetki-belgesi-harci-kimler-oder-ne-kadar-oder/)
- [6563 parasal eşikler](https://ticaret.gov.tr/duyurular/6563-sayili-elektronik-ticaretin-duzenlemesi-hakkinda-kanundaki-parasal-esiklerin-guncellenmesine-iliskin-aciklama)

## 4. Uygulama mağazaları ve iletişim hesapları

| Hesap | Tutar | Sıklık | Not |
| --- | --- | --- | --- |
| Apple Developer Program | 99 USD | Yıllık | Kayıtta yerel para biriminde gösterilir; 2026'da Türkiye'de 1.029 TL ödendiği bildiriliyor (resmî değil). Şahıs şirketi bireysel hesapla kaydolur; mağazada satıcı adı olarak senin adın görünür. |
| Google Play Console | 25 USD | Bir kez | Kişisel hesapta yayından önce belirli sayıda test kullanıcısıyla kapalı test istenir. Kurumsal hesap D-U-N-S ister: numara ücretsizdir, alınması 30 güne kadar sürebilir. |
| Mağaza komisyonu | Satışın %15'i (Small Business Program) ya da %30'u | Her satışta | Mobilde satılan haklardan kesilir. Apple'da programa ayrıca başvurulur; Google'da yıllık ilk 1 milyon USD'de %15. Galeri paketi mobilde satılmaz (Karar 38). |
| Meta WhatsApp Cloud API | Doğrulama kodu ve utility (kritik bildirim) mesajı 0,0009 USD; pazarlama mesajı 0,0109 USD (kullanmıyoruz) | Kullanım kadar | Ayrıntılar aşağıda |
| Firebase (push bildirimi) | Ücretsiz | — | FCM ücretsizdir |
| Expo (mobil derleme) | Ücretsiz başlanır | — | Ücretsiz planda aylık derleme sayısı sınırlı; gerekirse ücretli plana geçilir |
| RevenueCat (mobil satın alma, henüz bağlanmadı) | Belli bir aylık gelire kadar ücretsiz | — | Güncel sınır için sitesine bak |
| SMS (İleti Merkezi, kapalı yedek) | Hesap açık, bakiye yüklenmedi | — | WhatsApp yeterli olduğu sürece ödeme gerekmez. Açılırsa fiyat teklifle belirlenir; SMS başlığı marka tescili ister. |

Meta WhatsApp Cloud API ayrıntıları:

- Fiyatlar Meta'nın 1 Ekim 2026 tarihli listesinden alındı.
- Ödeme USD ile yapılır; TL seçeneği yok.
- 10.000 doğrulama kodu yaklaşık 9 USD eder.
- Müşteri penceresi içindeki utility mesajları da 1 Ekim 2026'dan beri ücretli.
- Meta işletme hesabı ücretsizdir. İşletme doğrulaması için şirket belgesi gerekir.

Kaynaklar:

- [Apple Developer kayıt](https://developer.apple.com/programs/enroll/)
- [Apple forumunda Türkiye fiyatı](https://developer.apple.com/forums/thread/842153)
- [Google Play hesap türleri ve D-U-N-S](https://support.google.com/googleplay/android-developer/answer/13634885)
- [Meta WhatsApp fiyatlandırması](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)

## 5. Ödeme ve fatura altyapısı

### PayTR (web ödemesi ve galeri paketi)

- **Komisyon:** resmî oran listesi yayımlanmıyor; üye işyeri başvurusundan sonra teklifle veriliyor. İkincil
  kaynaklarda tek çekim oranı %2,19'dan başlıyor (7 gün valör).
- **Kurulum ve yıllık ücret:** resmî bilgi bulunamadı; başvururken sor.
- **Karşılaştırma için iyzico:** %2,49 – %4,29 arası, işlem başı 0,25 TL (ikincil kaynak).
- **TCMB tavanı:** Kasım 2026 tablosunda taksitsiz işlem için azami oran %3,56. Bu tavan bankalar için; ödeme
  kuruluşlarına uygulanıp uygulanmadığı doğrulanmadı.
- **Ne zaman:** şirket kurulunca, sitede yasal metinler yayındayken başvurulur. Kart saklama (galeri aboneliğinin
  otomatik yenilenmesi) için ayrıca onay istenir.

### e-Arşiv fatura

**Zorunluluk (VUK 589):**

- İşletme hesabında 31 Aralık 2026'ya kadar 3.000 TL'ye kadar olan faturalar kâğıda kesilebilir.
- 1 Ocak 2027'den itibaren her fatura e-Arşiv olmalı. Bilanço esasında bu kural 2026'dan beri geçerli.
- İnternetten satışta e-Fatura eşiğinin 500.000 TL olduğu yazılıyor. Bu ikincil bir kaynak; mali müşavire teyit
  ettir.

**GİB e-Belge portalı:**

- Ücretsiz, ama faturayı elle kesersin.
- Her satışta elle fatura kesmek pratik değil.

**Özel entegratör:** sistem her ödemeden sonra faturayı otomatik keser; bunun için entegratör gerekir.

- Fiyat: 1.000 faturalık kontör yaklaşık 2.750 – 5.250 TL + KDV, yani fatura başına yaklaşık 0,75 – 1,92 TL. Firmaya
  ve kampanyaya göre değişir.
- Bağlantı için e-imza ya da mali mühür ister.
- Bu bağdaştırıcı henüz yazılmadı; firma seçilince Claude, firmanın API belgesine göre yazar.

Kaynaklar:

- [Sanal POS komisyonları](https://www.karekod.org/blog/sanal-pos-komisyon-oranlari/)
- [iyzico komisyonları](https://www.ticimax.com/blog/iyzico-komisyon-oranlari)
- [VUK 589 (TÜRMOB)](https://www.turmob.org.tr/ekutuphane/Read/9208c1d3-f311-468d-9dd7-0d50a202bd6c)
- [e-Arşiv zorunluluğu (Sovos)](https://sovos.com/tr/blog/kdv/e-arsiv-fatura-zorunlulugu/)
- [Entegratör fiyat örneği (Ziraat Z-Dönüşüm)](https://www.ziraatbank.com.tr/z-donusum/fiyatlar)
- [Entegratör fiyat örneği (ideasoft / EDM)](https://www.ideasoft.com.tr/eticaret-cozum-merkezi/earsiv-efatura-cozumleri/edm-bilisim/)
- [Mali mühür bayi fiyatı](https://birfatura.com/mali-muhur-fiyatlari-mali-muhur-ucreti/)

## 6. Sunucu, alan adı ve hizmetler

**AWS faturası** (`rengarenk` profili, 1–23 Kasım 2026, kredi düşülmeden):

- Lightsail 14,25 USD. Sunucu 12 Kasım'da açıldığı için bu tutar ayın bir kısmına ait.
- SES, Bedrock, S3 ve diğer hizmetlerin her biri 0,01 USD'nin altında.
- Hepsi Activate kredisinden düşüyor; cebinden çıkan tutar 0.

| Kalem | Tutar | Not |
| --- | --- | --- |
| Lightsail sunucu (`large_3_0`: 8 GB bellek, 2 işlemci, 160 GB disk, 5 TB trafik) | 44 USD / ay | Ana sabit gider. Kredi bitince karttan çekilir. |
| AWS Activate kredisi | +1.000 USD (21 Kasım 2026) | Bugünkü kullanımla yaklaşık 20 ay yeter. Kredinin son kullanma tarihine AWS konsolunda Billing › Credits'ten bak. |
| Lightsail günlük anlık görüntü (yedek, henüz açılmadı) | Disk boyutuna göre küçük bir aylık ücret | Canlıya geçiş listesinde |
| Amazon SES (e-posta) | 1.000 e-posta 0,10 USD | Günde 50.000 e-posta sınırı var |
| Bedrock (yapay zekâ, Nova Lite/Pro) | Kullanım kadar | Bütçe konsolda sınırlı (Karar 57). AWS bütçe uyarısı şu an aylık 10 USD; gerçek tutara göre güncellenmeli. |
| Google Workspace (`@rengarenksite.com` e-postaları, konsol girişi) | Kullanıcı başına aylık | Tutarı Google Workspace faturandan oku. Her yeni çalışan hesabı ek ücret demek. |
| Alan adı `rengarenksite.com` | Yıllık yenileme. `.com` toptan fiyatı 1 Kasım 2026'dan beri 10,97 USD + ICANN ücreti 0,20 USD; kayıt firmasının fiyatı bunun üstünde. | Otomatik yenilemenin açık olduğunu kontrol et. Alan adı düşerse site, e-posta ve giriş durur. |
| Tanıtım sayfası barındırma (Güzel Hosting, cPanel) | Tutarı kendi faturana bak | Tanıtım sayfası ana sunucuya taşınırsa bu ücret kalkar |

**Vergi notu:**

- Kasım faturasında vergi satırı 0 görünüyor.
- Mali müşavir (23 Kasım 2026): AWS gibi yurt dışı hizmetlerin KDV'si 2 No.lu KDV beyannamesiyle senin tarafından
  beyan edilip ödenir. Her ay AWS faturasını (Billing › Invoices) mali müşavire gönder.
- Mali müşavire şunları da sor:
  - Krediyle 0 USD çıkan faturada ne beyan edilir?
  - Vergi numarasını AWS hesabına (Tax settings) girmek gerekiyor mu?

Kaynaklar:

- [.com toptan fiyat artışı](https://domainnamewire.com/2026/04/23/breaking-verisign-raising-wholesale-com-prices/)
- AWS tutarları hesabından (Cost Explorer ve Lightsail paket listesi)

## 7. Hukuk, danışmanlık ve teyit edilecekler

### Hukuk ve danışmanlık

Avukat ve marka vekili ücretleri serbesttir; resmî bir tarife bulunamadı. Teklif alırken şu konuların hepsinin
kapsamda olduğunu yaz:

- [ ] Yasal metinler: kullanım koşulları, KVKK aydınlatma metni, galeri hizmet sözleşmesi, mesafeli sözleşme, ön
  bilgilendirme formu.
- [ ] AWS ile KVKK standart sözleşmesi ve Kurul'a bildirim; Meta (WhatsApp) için de yurt dışına aktarım ve açık rıza.
- [ ] Yönetmelik: "ilan platformu" sayılıp sayılmadığımız, m.22/b kimlik doğrulaması, m.22/d telefon kanalı (Karar 17
  ile 54 arasındaki açık soru).
- [ ] BTK yer sağlayıcı belgesinin bize uygulanıp uygulanmadığı.
- [ ] Marka başvurusu: sınıf seçimi ve benzer marka araştırması.

### Teyit edilmesi gereken tutarlar

| Kalem | Kime sorulur |
| --- | --- |
| Ticaret Sicili Gazetesi ilan ücreti | Ticaret Sicil Müdürlüğü ya da mali müşavir |
| Noter imza beyannamesi | Noter |
| Elektronikçiler esnaf odası kayıt ücreti ve aidatı | Oda |
| Bağ-Kur'un sana düşüp düşmediği (başka işte SGK'lıysan) | Mali müşavir |
| Genç girişimci istisnasının süresi ve sana uyup uymadığı | Mali müşavir |
| Mali mühür gerekip gerekmediği ve resmî fiyatı | e-Arşiv entegratörü, Kamu SM |
| PayTR komisyonu, kurulum ve yıllık ücret | PayTR (teklif) |
| KEP ücreti (215 TL mi, 295 TL mi) | PTT |
| Apple'ın Türkiye'deki TL fiyatı | Kayıt ekranı |
| İYS fiyat tablosunun güncel olup olmadığı | iys.org.tr |
| EİDS entegrasyonunun ücreti ve başvuru yolu | Ticaret Bakanlığı |
| KDV2: krediyle 0 USD çıkan AWS faturası, 2 No.lu beyannamenin damga vergisi | Mali müşavir |
| TSB yazılı izninin bir ücreti olup olmadığı | TSB |

### Ne zaman ne ödenir

1. **Şimdi:** AWS (krediden), alan adı, Google Workspace, tanıtım barındırma. Bunlar zaten ödeniyor.
2. **Şirket kurulurken:**
   - Sicil harcı, oda kaydı ve noter.
   - Bu aydan itibaren mali müşavir ve Bağ-Kur.
   - e-imza.
3. **Şirketten hemen sonra:**
   - Marka başvurusu.
   - Apple ve Google Play hesapları.
   - Meta işletme doğrulaması, ETBİS, İYS ve e-Tebligat (hepsi ücretsiz).
   - PayTR başvurusu.
   - e-Arşiv entegratör paketi.
4. **Kapalı beta ve açılış:** WhatsApp mesaj ücretleri ve SES, kullanım kadar. Satışlar başlayınca PayTR ve mağaza
   komisyonları.
5. **Yılda bir:** Apple, alan adı ve oda aidatı. Marka 10 yılda bir yenilenir.
