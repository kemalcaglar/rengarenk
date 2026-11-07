# Kategori şemaları

İlk sürümdeki 14 vasıta kategorisinin (Karar 19) alan yapısı, katalog kaynağı, yasal çerçevesi ve eşleşme kuralları. Sahibinden.com otomatik erişimi engellediği için sahibinden'e ait alt kategori ve alan adları canlı siteden doğrulanamadı; tasarım aşamasında kontrol edilmelidir.

## Genel bakış

Kara taşıtlarının çoğu motorlu kara taşıtları ticareti yönetmeliğine ve EİDS'e tabidir; deniz, hava ve kiralık kendi mevzuatıyla ayrı işler. TSB kataloğu yalnızca binek ve hafif ticari taşıtlarda güvenilir omurgadır, diğerlerinde katalog otomatik kaynaklar ve kullanıcı girişleriyle kendiliğinden büyür; yönetici onayı gerekmez (Karar 33).

| Kategori | Hiyerarşi | Katalog kaynağı | Yasal çerçeve | Yayın süresi |
| --- | --- | --- | --- | --- |
| Otomobil | Marka > Seri > Model | TSB + açık kaynaklar | Ticaret yönetmeliği, EİDS, ekspertiz, 6 ay / 6.000 km | 30 gün |
| Arazi, SUV & Pickup | Marka > Seri > Model | TSB + açık kaynaklar | Otomobille aynı | 30 gün |
| Elektrikli Araçlar | Marka > Seri > Model | Açık kaynaklar + TSB | Otomobille aynı | 30 gün |
| Motosiklet | Marka > Model | TSB motosiklet listesi + motodb.org, otomatik | Yönetmelik, EİDS, 6 ay / 6.000 km; ekspertiz zorunlu değil | 30 gün |
| Minivan & Panelvan | Marka > Seri > Model | TSB + açık kaynaklar | Yönetmelik, EİDS, ekspertiz; 6 ay / 6.000 km ruhsat otomobilse | 30 gün |
| Ticari Araçlar | Alt kategori > Marka > Model | TSB (hafif ticari) + kullanıcı girişleri, otomatik | Otobüs, kamyon, kamyonet kapsamda; dorse ve römork dışında; hat ve plaka ayrı kurallar | 30 gün |
| Kiralık Araçlar | Segment veya Marka > Model | TSB | Kiralama yönetmeliği (1 Ocak 2027) | Alış tarihine kadar, en fazla 30 gün |
| Deniz Araçları | Alt kategori > Marka > Model | Kullanıcı ve galeri girişlerinden otomatik | Bağlama kütüğü, Liman Başkanlığı, CE | 30 gün |
| Hasarlı Araçlar | Araç türü > Marka > Seri > Model | Ana kategorinin kataloğu | Pert ve ağır hasar kuralları (SEDDK); tescil durumu | 30 gün |
| Karavan | Motokaravan / Çekme > Marka > Model | Kullanıcı girişleri; motokaravanın baz aracı TSB | Çekme karavan tescili 1 Temmuz 2025'ten beri zorunlu | 30 gün |
| Klasik Araçlar | Marka > Model | Kasa ve teknik veri kaynağı + kullanıcı girişleri | Yönetmelik (tescilliyse); ekspertiz uygulanmaz | 30 gün |
| Hava Araçları | Alt kategori > Marka > Model | FAA tescil verisi + ICAO tip kodları, otomatik | SHGM sicili, İHA talimatı | 90 gün |
| ATV | Marka > Model | motodb.org + kullanıcı girişleri, otomatik | Tescil durumuna göre (motosiklet / traktör T3 / tescilsiz) | 30 gün |
| UTV | Marka > Model | Kullanıcı girişlerinden otomatik | ATV ile aynı | 30 gün |

Sahibinden'de bunlara ek olarak "Engelli Plakalı Araçlar" kategorisi de vardır; şimdilik eklenmeyecek (Karar 19).

## Ortak taban şema

Tüm kategoriler tek bir taban şemayı paylaşır; kategoriye özgü alanlar uzantı olarak eklenir ve her uzantı otomatik eşleşmede kullanılacak alanları kendisi tanımlar.

| Katman | Alanlar | Nerede |
| --- | --- | --- |
| Taban | Kategori / alt kategori, marka, model (seri isteğe bağlı), donanım paketi, kasa kuşağı ve makyaj durumu (makyajsız / makyajlı), yıl, durum (sıfır / ikinci el / hasarlı), il / ilçe, kimden, takas, renk | Tüm kategoriler |
| Kara taşıtı | Ruhsat sınıfı, tescil durumu, plaka / uyruk, hasar kaydı (niteliğiyle) | Kara kategorileri |
| Motorlu | Kilometre, yakıt, vites | Motorlu kara taşıtları (dorse ve çekme karavan hariç) |
| Binek uzantısı | Kasa tipi, motor gücü ve hacmi, çekiş, 13 parçalı boya / değişen, şasi ve podye işlemi, airbag durumu, tramer tutarı, donanım, motor kodu (isteğe bağlı) | Otomobil; Arazi, SUV & Pickup; Elektrikli; Minivan & Panelvan |
| Kategori uzantıları | Motosiklet, ağır ticari, dorse / römork, karavan, klasik, hasarlı, ATV / UTV, deniz, hava, kiralık | Kendi kategorisi |

**Portföyde zorunlu yasal alanlar (taşıt tanıtım kartı, yönetmelik m.20):** şasi numarasının son 6 hanesi, plaka, yakıt, km, boyalı / değişen parçalar, niteliğiyle hasar kaydı, rehin / haciz şerhi, kalan garanti süresi ve km'si, EİDS doğrulama durumu. Bu alanlar alıcı talebinde yer almaz.

**Tarihli kurallar ayar olarak tutulur:** 6 ay / 6.000 km kuralı ve üretici fiyatı üstü ilan yasağı 1 Ocak 2027'ye kadar uzatıldı; tarih yönetim panelinden değiştirilebilir olmalı.

**Donanım paketi ve makyaj:** Katalogda paket (ör. Renault Clio Joy, Touch, Icon; BMW Sport Line, M Sport) ve kasa kuşağının makyajlı mı makyajsız mı olduğu tutulur. Alıcı her alternatif için kasa ve paketi seçer, "Fark etmez" de seçilebilir. Satıcı aracını eklerken model yılından kasa önerilir, paket o kasanın listesinden seçilir (Karar 32).

## Otomobil; Arazi, SUV & Pickup; Elektrikli Araçlar

Bu üç kategori binek uzantısını ve aynı kataloğu paylaşır (ana doküman, Araç kataloğu bölümü); fark yalnızca ek alanlardadır.

| Kategori | Ek alanlar | Uygulanmayan | Eşleşmede belirleyici |
| --- | --- | --- | --- |
| Otomobil | Ruhsat sınıfı (M1); EİDS doğrulama durumu | — | Ana araç, kasa ve makyaj, paket, yıl, yakıt, vites, km, hasar |
| Arazi, SUV & Pickup | Kasa: arazi / SUV / crossover / pickup; pickup kabini (tek / buçuk / çift); yük kasası uzunluğu; 4x4 tipi (sürekli / sonradan devreye giren / AWD); çeki demiri | — | Kasa tipi, çekiş |
| Elektrikli Araçlar | Batarya kapasitesi (kWh); WLTP menzili (km); AC ve DC şarj gücü (kW); %10–80 DC şarj süresi (dk); batarya garantisi (yıl / km); batarya sağlığı (%); şarj soketi; ısı pompası | Motor hacmi, motor kodu | Menzil, batarya kapasitesi, DC şarj gücü ("en az" koşulları) |

Elektrikli Araçlar ayrı bir kategori olarak görünür ama aynı kataloğu kullanır; elektrikli bir SUV hem Elektrikli Araçlar'da hem Arazi, SUV & Pickup'ta aranabilir.

**Yasal:** Üçü de ticaret yönetmeliği, EİDS, ekspertiz (8 model yaşı ve 160.000 km üstünde zorunlu değil) ve 6 ay / 6.000 km kuralına tabidir.

## Motosiklet, ATV, UTV

Bu kategorilerde seri katmanı yoktur ve 13 parçalı boya / değişen şeması, kasa tipi, tramer ve motor kodu kullanılmaz; yerine basit bir hasar notu yeterlidir. TSB'nin motosiklet ve ATV kapsamı doğrulanamadı; katalog TSB motosiklet listesi, motodb.org ve kasa ve teknik veri kaynağından otomatik kurulur; eksikler kullanıcı girişlerinden tamamlanır.

| Kategori | Ek alanlar | Eşleşmede belirleyici |
| --- | --- | --- |
| Motosiklet | Tip (scooter, naked, sport, touring, enduro, cross, chopper / cruiser, adventure, moped, sepetli); motor hacmi (cc); 2 / 4 zamanlı; soğutma (hava / sıvı / yağ); silindir sayısı; vites; ABS; ehliyet sınıfı (A1 / A2 / A) | Tip, cc aralığı, ehliyet sınıfı |
| ATV | Motor hacmi (cc); çekiş (4x2 / 4x4); tescil durumu (motosiklet / traktör T3 / tescilsiz); vinç | Tescil durumu, cc, çekiş |
| UTV | ATV alanlarına ek olarak kişi kapasitesi (2 / 4 / 6) ve yük kasası kapasitesi | Tescil durumu, cc, kişi sayısı |

- **Motosiklet:** Yönetmelik, EİDS ve 6 ay / 6.000 km kuralı (Aralık 2023'ten beri) uygulanır; ekspertiz zorunlu değildir.
- **ATV / UTV:** Tescilsiz araç trafikte kullanılamaz; motosiklet olarak tescilliyse A, traktör olarak tescilliyse en az F ehliyet gerekir. Tescil durumu zorunlu alan olur ve alıcıya "yolda kullanım" uyarısı gösterilir.

## Minivan & Panelvan, Ticari Araçlar

Ticari kategoride araç kimliğini alt kategori belirler ve alanlar alt kategoriye göre tamamen değişir; dorse, römork ve ticari hat / plaka motorlu araç alanlarının hiçbirini kullanmaz. Ticari Araçlar'ın sahibinden alt kategori listesi doğrulanamadı.

| Alt kategori | Ek alanlar | Eşleşmede belirleyici |
| --- | --- | --- |
| Minivan & Panelvan | Kasa (minivan / panelvan / kombi / camlı van); koltuk sayısı (2 / 3 / 5 / 7 / 8+1); ruhsat cinsi (otomobil / kamyonet); tavan (normal / yüksek); şasi (kısa / orta / uzun); sürgülü kapı | Koltuk sayısı, ruhsat cinsi |
| Minibüs, Midibüs, Otobüs | Koltuk sayısı (16+1, 27+1, 46+1…); ayakta yolcu; şehir içi / şehirlerarası; klima; engelli rampası | Koltuk aralığı, kullanım tipi |
| Kamyon, Kamyonet, Çekici | Azami yüklü ağırlık; taşıma kapasitesi; aks düzeni (4x2 / 6x2 / 6x4 / 8x4); kabin (yataklı / günlük); Euro normu; retarder; PTO | Tonaj, aks düzeni |
| Dorse, Römork | Tip (tenteli / damperli / frigorifik / lowbed / silobas / tanker / konteyner); aks sayısı; uzunluk; dingil markası. Motor, yakıt ve km yok | Tip, aks sayısı, uzunluk |
| Karoser & Üst Yapı, Oto Kurtarıcı & Taşıyıcı | Üst yapı tipi; kasa ölçüleri; platform kapasitesi; vinç tonajı | Tip, kapasite |
| Ticari Hat & Plaka | Plaka türü (taksi / dolmuş / servis / minibüs hattı); il; güzergâh | Plaka türü, il |

- **Yasal:** Otobüs, kamyon ve kamyonet yönetmelik kapsamındadır; dorse ve römork tanımda yoktur. Ekspertiz yalnızca N1 sınıfında zorunludur; 6 ay / 6.000 km kuralı ticari araçlara uygulanmaz. Minivan'da kural ruhsat otomobilse uygulanır.
- **Ticari hat ve plaka:** Taşıt ticareti değildir; belediye ve UKOME kurallarına tabidir (doğrulanamadı). Avukat görüşü alınana kadar bu alt kategori kapalı kalır (Karar 19).
- **Katalog:** Minivan için TSB + açık kaynaklar. Ağır ticari, dorse, karoser ve hat için hazır otomatik kaynak yok; katalog kullanıcı ve galeri girişlerinden kendiliğinden büyür (Karar 33).

## Hasarlı Araçlar, Klasik Araçlar, Karavan

| Kategori | Hiyerarşi | Ek alanlar | Uygulanmayan | Eşleşmede belirleyici |
| --- | --- | --- | --- | --- |
| Hasarlı Araçlar | Araç türü > Marka > Seri > Model | Hasar türü (pert / ağır / orta / hafif); çalışır mı; yürür mü; hasar kaynağı (kaza / sel / yangın / dolu / deprem); belge durumu (hurda tescil / trafikten çekme / ruhsatlı); airbag durumu | Ağır hasar kaydı bu ayrıntılı alanla birleşir | Hasar türü, çalışır mı, belge durumu |
| Klasik Araçlar | Marka > Model | Restorasyon (orijinal / kısmi / tam); numara eşleşmesi; parça orijinalliği oranı; belge ve geçmiş dosyası; ithal / yerli; çalışır mı | Garanti, tramer tutarı | Marka / model, yıl aralığı, restorasyon |
| Karavan | Motokaravan / Çekme > Marka > Model | Motokaravan tipi (alkov / yarı entegre / entegre / campervan); çekme karavan azami ağırlığı (750 kg altı O1 / üstü O2); yatak sayısı; uzunluk; temiz ve atık su tankı (L); güneş paneli; banyo / WC; ısıtıcı; gereken ehliyet (B / BE / C) | Çekme karavanda motor, yakıt, km, boya şeması | Tip, yatak sayısı, ağırlık ve ehliyet uyumu |

- **Hasarlı:** Onarım bedeli piyasa değerinin %60'sını aşan araç ağır hasarlı sayılır; pert araç hurda tescilli olup trafikte değildir. Belge durumu EİDS doğrulamasını etkileyebilir (doğrulanmalı). Katalog ana kategorininkidir.
- **Klasik:** TSB listesi 15 yılı kapsadığı için klasik araçlarda marka, model ve kasa bilgisi eski kuşakları da kapsayan açık kaynaklardan (Wikidata, vehicle-makes-models) gelir; paket bilgisi yoksa alan boş kalır. Türkiye'de ayrı bir klasik araç plakası bulunamadı (doğrulanamadı). Ekspertiz 8 yaş istisnası nedeniyle uygulanmaz.
- **Karavan:** Çekme karavan için tescil 1 Temmuz 2025'ten beri zorunludur; tescil noterde yapılır ve muayeneye tabidir. Motokaravan "özel amaçlı taşıt – motorlu karavan" olarak tescil edilir. Motokaravanın baz aracı TSB'den, karavan donanımı yapılandırılmış alanlarla girilir; katalog kullanıcı girişlerinden kendiliğinden büyür.

## Deniz Araçları

Deniz araçları motorlu kara taşıtları yönetmeliğinin ve EİDS'in kapsamı dışındadır; kayıt ve devir Liman Başkanlığı (bağlama kütüğü) ve gemi sicili üzerinden yürür. TSB benzeri resmi bir marka/model kataloğu yoktur.

| Alt kategori | Ayırt edici alanlar |
| --- | --- |
| Motorlu Yat | Kabin, yatak ve WC sayısı; motor sayısı, markası ve gücü; motor saati; flybridge; jeneratör |
| Yelkenli | Tek gövde / katamaran; salma derinliği; arma tipi; yelken sayısı; yardımcı motor |
| Gulet | Ahşap türü; kabin sayısı; mürettebat kapasitesi; ticari / özel kullanım |
| Sürat Teknesi | Motor tipi (kıçtan takma / içten takma); güç; azami hız; römork var / yok |
| Balıkçı Teknesi | Ticari ruhsat; tonilato; ağ ve donanım |
| Şişme Bot / RIB | Kumaş tipi (PVC / Hypalon); sert taban; motor gücü |
| Jet Ski | Marka / model; motor saati; kişi sayısı; güç |
| Deniz Motoru | Marka; güç; saat; şaft boyu; 2 zamanlı / 4 zamanlı |
| Kano, Kayak, SUP | Boy; kişi sayısı; malzeme |

**Ortak alanlar:** tam boy (m), en (m), su çekimi, yapım yılı, tersane / marka, model, malzeme (GRP, ahşap, alüminyum, çelik), yakıt, kişi kapasitesi, bayrak, bağlama limanı, CE tasarım kategorisi (A–D), tekne kimlik numarası (HIN/CIN). Bu alanlar bağlama kütüğü ruhsatnamesindekilerle örtüşür; portföy formu ruhsatnameye birebir eşlenir.

- **Katalog:** Yat, yelkenli, jet ski ve deniz motoru için hazır otomatik kaynak yok; marka/model listesi kullanıcı ve galeri girişlerinden kendiliğinden büyür, aynı model birkaç kez girilince kataloğa otomatik eklenir (Karar 33). Gulet ve balıkçı teknesinde ana araç = alt kategori + boy aralığı; tersane serbest metin.
- **Yasal:** 2,5 m ve üzeri özel tekneler bağlama kütüğüne kayıtlı olmalı. Devir Liman Başkanlığı'nda veya noterde yapılmazsa hükümsüzdür. Bağlama kütüğü mülkiyet karinesi oluşturmaz; haciz ve ipotek ayrıca kontrol edilmeli.
- **CE:** Gezi Tekneleri Yönetmeliği 2,5–24 m tekneleri ve jet skileri kapsar; ilan, CE plakasındaki kategori ve kapasiteyi aşmamalıdır.
- **Kurumsal hesap:** Tekne galerisi / yat brokeri. Yasal bir yetki belgesi yoktur; vergi levhası, ticaret sicil gazetesi ve oda kaydı kontrol edilir. Portföy kartında ruhsatname veya sicil kayıt örneği, CE plakası ve HIN fotoğrafı istenir.
- **Eşleşme:** Alt kategori → boy aralığı (en güçlü sinyal) → yapım yılı → malzeme → motor gücü ve sayısı → kabin sayısı → bölge / bağlama limanı. Marka çoklu seçimdir.
- **Boya/değişen yerine:** gövde hasarı, osmoz, motor saati ve son bakım.
- **Kiralık tekne:** Kiralık Araçlar altında; Deniz Turizmi Yönetmeliği gereği turizm işletmesi belgesi kontrol edilir.

## Hava Araçları

Hava araçlarının sicilini SHGM tutar; motorlu kara taşıtları yönetmeliği, EİDS ve yetki belgesi uygulanmaz. Hacim düşük olacağından kategori basit tutulur.

| Alt kategori | Ayırt edici alanlar |
| --- | --- |
| Uçak | Marka / model; üretim yılı; toplam gövde saati; motor saati ve TBO'ya kalan süre; koltuk sayısı; avionik |
| Helikopter | Uçak alanlarına ek olarak rotor ve şanzıman saatleri |
| Planör, balon, ultra hafif | Marka / model; yıl; toplam saat; koltuk sayısı |
| İHA (drone) | Marka / model; ağırlık sınıfı; kayıt durumu |

**Ortak alanlar:** tescil işareti (TC-xxx), son bakım tarihi, uçuşa elverişlilik sertifikası, hasar geçmişi, hangar yeri.

- **Katalog:** FAA tescil verisinin marka/model dosyaları (günlük, ücretsiz) ve ICAO tip kodları otomatik alınır; eksikler kullanıcı girişlerinden tamamlanır.
- **Yasal:** Devir yazılı sözleşmeyle yapılır ama sicile tescil edilmeden üçüncü kişilere karşı ileri sürülemez; uygulamada SHGM noterli sözleşme ister. Sivil hava aracının maliki Türk vatandaşı veya kamu tüzel kişisi olabilir.
- **İHA:** 30 Temmuz 2026'da yeni SHGM İHA talimatı yürürlüğe girdi; işlemler İHATTYS üzerinden yürür. Alıcıya kayıt yükümlülüğü uyarısı gösterilir. Yeni ağırlık eşikleri doğrulanamadı.
- **Kurumsal hesap:** Uçak satıcısı / brokeri; vergi levhası ve ticaret sicili kontrol edilir. Portföy kartında SHGM tescil ve uçuşa elverişlilik sertifikası istenir.
- **Eşleşme:** Alt kategori → marka/model → yıl → toplam saat → motor saati → koltuk sayısı.
- **Yayın süresi:** Az sayıda alıcı ve satıcı olduğu için 30 gün yerine 90 gündür (Karar 19).

## Kiralık Araçlar

Kiralıkta model tersine döner: kullanıcı kiralama talebi açar, kiralama firmaları yazar. 15 Ağustos 2026'da yayımlanan ve 1 Ocak 2027'de yürürlüğe giren Motorlu Kara Taşıtlarının Kiralanması Hakkında Yönetmelik ilan ve aracı platformlara açıkça yükümlülük getirir ([Lexpera](https://www.lexpera.com.tr/resmi-gazete/metin/motorlu-kara-tasitlarinin-kiralanmasi-hakkinda-yonetmelik-33341)).

### Kiralama talebi alanları

| Alan | Tip |
| --- | --- |
| Alış ve iade tarihi / saati | Tarih-saat aralığı |
| Alış ve iade yeri | İl / ilçe, havalimanı veya adrese teslim; tek yön iade |
| Segment | Çoklu seçim (ekonomik, orta, üst, SUV, minivan vb.) |
| Vites, yakıt / enerji | Çoklu seçim |
| Kişi ve bagaj sayısı | Sayı |
| Sürücü yaşı, ehliyet yılı ve sınıfı; ek sürücü | Sayı / seçim |
| Kiralama tipi | Günlük, haftalık, aylık (30 gün ve üzeri "uzun dönem") |
| Ek talepler | Çocuk koltuğu, kış lastiği, şoförlü / şoförsüz |

### Yönetmeliğin getirdikleri

| Konu | Hüküm |
| --- | --- |
| Kapsam | M1 ve N1 sınıfı taşıtların tüketiciye kısa dönem kiralanması; 30 gün ve üzeri uzun dönem ve karavan kapsam dışı |
| Firma şartı | Yetki belgesi; en az 10 araçlık filo; araçlar en fazla 6 model yaşında ve 180.000 km (elektrikli 300.000 km) altında; ağır hasar kayıtlı araç kiralanamaz |
| Platform yükümlülüğü | Firmayı yetki belgesini doğrulamadan üye yapmamak; ilanda yetki belgesi no ve işletme adı; marka, model, yıl, enerji, donanım, segment, km ve fotoğraf; şube dışı teslimat belirtilmeli |
| Depozito | 6 güne kadar en fazla 3 günlük, 7–29 gün en fazla 7 günlük kira; yalnızca kart provizyonu |
| Km sınırı | 1–6 günde günde en az 150 km, 7–29 günde günde en az 100 km |
| Geçiş | Firmalar 1 Temmuz 2027'ye kadar yetki belgesi alır; platform ilan yükümlülükleri 1 Ocak 2028'de başlar |

Formlarda yasal sınırların altında depozito veya km seçeneği sunulmaz.

### Eşleşme ve yayın

- **Portföy:** Tek tek araç yerine filo aracı + müsaitlik takvimi (veya segment bazlı filo).
- **Eşleşme sırası:** tarih aralığında müsaitlik → teslim noktası → segment, vites, yakıt → firmanın yaş ve ehliyet politikası.
- **Yayın süresi:** Talep alış tarihinde veya 30 gün sonunda, hangisi önceyse otomatik kapanır.
- **Kurumsal hesap:** Kiralama firması; yetki belgesi (Bilgi Sistemi), vergi levhası, oda kaydı ve şube adresleri kontrol edilir. Araç bazında sınıf, model yaşı, km ve ağır hasar kaydı kontrol edilir.
- **Uygulanmayanlar:** EİDS (yerine Bilgi Sistemi doğrulaması), boya/değişen.
- **Diğer kiralık türleri:** Kiralık tekne turizm işletmesi belgesi gerektirir; kiralık karavan yönetmelik dışındadır; şoförlü kiralama ve minibüs muhtemelen yolcu taşımacılığı sayılır ve D2 vb. yetki belgesi gerektirir (doğrulanamadı).

## Kaynaklar

- [Motorlu Kara Taşıtları Ticareti Hakkında Yönetmelik (Lexpera)](https://www.lexpera.com.tr/mevzuat/yonetmelikler/motorlu-kara-tasitlarinin-ticareti-hakkinda-yonetmelik-1)
- [6 ay / 6.000 km kısıtlaması 2027'ye uzatıldı (Alomaliye, Haziran 2026)](https://www.alomaliye.com/2026/06/22/ikinci-el-otomotive-6-ay-6-bin-kilometre-kisitlamasi-2027ye-uzatildi/)
- [6 ay / 6.000 km kuralına motosiklet eklendi (Bloomberg HT)](https://www.bloomberght.com/ikinci-el-tasitta-6-ay-ve-6-bin-kilometre-kuralina-motosiklet-de-eklendi-2343785)
- [Sahibinden vasıta kategorileri (Apify scraper sayfası)](https://apify.com/clearpath/sahibinden-car-scraper)
- [motodb.org](https://motodb.org/en)
- [ATV'lerde kask ve gözlük zorunluluğu (CNN Türk)](https://www.cnnturk.com/turkiye/atv-suruculeri-dikkat-artik-zorunlu-olacak-2355991)
- [Çekme karavan yönetmelik değişikliği (Hukuki Haber)](https://www.hukukihaber.net/cekme-karavanlar-ve-mobil-evlerle-ilgili-yonetmelik-degisikligi-hakkinda-degerlendirme)
- [Pert araç düzenlemesi (Webtekno)](https://www.webtekno.com/agir-hasarli-pert-araba-satisi-yasaklandi-mi-h218769.html)
- [Klasik otomobiller (Sözcü)](https://www.sozcu.com.tr/8-soruda-klasik-otomobiller-wp2367834)
- [Motorlu Kara Taşıtlarının Kiralanması Hakkında Yönetmelik (Lexpera, RG 15.08.2026)](https://www.lexpera.com.tr/resmi-gazete/metin/motorlu-kara-tasitlarinin-kiralanmasi-hakkinda-yonetmelik-33341)
- [Kiralama yönetmeliği özeti (Alomaliye, Ağustos 2026)](https://www.alomaliye.com/2026/08/15/motorlu-kara-tasitlarinin-kiralanmasi-hakkinda-yonetmelikle-ilgili-kapsamli-ozet-ve-sss/)
- [Bağlama Kütüğü Uygulama Yönetmeliği (Alomaliye)](https://www.alomaliye.com/2014/09/25/baglama-kutugu-uygulama-yonetmeligi/)
- [Gezi teknesi CE kategorisi (Hukukçular Evi, Ekim 2026)](https://hukukcularevi.com/gezi-teknesi-yat-jet-ski-ce-tasarim-kategorisi-uretim-sonrasi-degerlendirme-tekne-kimlik-numarasi-ithalatci-toplatma-idari-para-cezasi-2013-53-7223-20-2026/)
- [Deniz Turizmi Yönetmeliği (Alomaliye)](https://alomaliye.com/2009/07/24/deniz-turizmi-yonetmeligi/)
- [SHY-7 Hava Aracı Milliyeti ve Tescil İşaretleri Yönetmeliği (SHGM)](https://web.shgm.gov.tr/documents/sivilhavacilik/files/mevzuat/sektorel/yonetmelikler/2022/SHY-7.pdf)
- [SHGM İHA talimatı (TRT Haber, Temmuz 2026)](https://www.trthaber.com/haber/ekonomi/shgmnin-insansiz-hava-araci-sistemleri-talimati-yayimlandi-952622.html)
