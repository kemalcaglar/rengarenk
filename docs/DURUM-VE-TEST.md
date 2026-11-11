# Rengarenk · Durum, kalan işler ve test rehberi

Son güncelleme: 10 Kasım 2026. Bu dosya projenin nerede olduğunu, biten ve kalan işleri, alınan kararları, kalan işlerin
nasıl yapılacağını, yerelde ve telefonda nasıl test edileceğini ve demo giriş bilgilerini tek yerde toplar. Ayrıntılı
kararlar `docs/kapsam/01-urun-kapsami.md` (Karar 01–59), teknik tasarım `02-teknik-tasarim.md`, sprint sprint iş listesi
`03-gelistirme-plani.md` içindedir.

> **Giriş bilgileri yalnızca yerel geliştirme ortamı içindir.** Telefon kodları yerelde ekranda görünür; konsoldaki sahte
> Google girişi canlıda kapalıdır. Bu hesaplar canlı sisteme taşınmaz.

---

## İçindekiler

1. [Kısa durum](#1-kısa-durum)
2. [Biten işler](#2-biten-işler)
3. [Alınan notlar ve sahip kararları](#3-alınan-notlar-ve-sahip-kararları)
4. [Kalan işler](#4-kalan-işler)
5. [Kalan işleri nasıl yapmalıyız (önerilen sıra)](#5-kalan-işleri-nasıl-yapmalıyız-önerilen-sıra)
6. [Claude'un yardımcı olabileceği işler](#6-claudeun-yardımcı-olabileceği-işler)
7. [Yerel ortamı çalıştırma](#7-yerel-ortamı-çalıştırma)
8. [Mobil uygulamayı telefonda canlı test etme](#8-mobil-uygulamayı-telefonda-canlı-test-etme)
9. [Demo veri ve giriş bilgileri](#9-demo-veri-ve-giriş-bilgileri)
10. [Rol rol deneme senaryoları](#10-rol-rol-deneme-senaryoları)
11. [Sorun giderme](#11-sorun-giderme)

---

## 1. Kısa durum

| | |
| --- | --- |
| Aşama | Aşama 0–9'un kodu bitti (planda lansman 14 Ocak 2028; kod tarafı plandan çok önde) |
| Sıradaki büyük adım | Sunucular (Radore) gelince ilk canlı dağıtım, yedek, izleme ve sırların şifrelenmesi (SOPS) |
| Bekleyen | Dış hesaplar ve sözleşmeler (SMS, Google Workspace, Apple/Google Play, PayTR, e-Arşiv, EİDS, avukat, TSB izni, EEA) |
| Testler | API 212, ortak paket 128, katalog 36 test; hepsi geçiyor. Lint ve tür denetimi temiz |
| Depo | `main` dalı GitHub'da (kemalcaglar/rengarenk). Canlıya dağıtım yalnızca `v*` etiketiyle ve sahip onayıyla |
| Plan dosyası | `docs/kapsam/03-gelistirme-plani.md`: 250'den fazla madde işaretli |

Kısaca: ürünün bütün ekranları ve iş kuralları web, mobil, API ve yönetim konsolunda yazıldı ve testli. Gerçek dünyaya
bağlanan her şey (SMS, ödeme, fatura, bakanlık, mağaza, e-posta sunucusu) şu an **sahte sağlayıcıyla** çalışıyor; hesaplar
açıldıkça gerçeğiyle değiştirilecek. Canlıya çıkmak için asıl eksik sunucu ve dış hesaplar.

---

## 2. Biten işler

Aşama ve sprint sırasıyla. Her madde API, web, mobil ve gerekiyorsa konsol tarafıyla birlikte bitti.

### Aşama 0–1 · Temel (Sprint 1–4)
- Monorepo (pnpm + Turborepo), yerel ortam (Docker: PostgreSQL, Redis, OpenSearch, SeaweedFS, Mailpit), CI.
- Telefon + SMS koduyla giriş: 15 dk erişim, 90 gün yenileme jetonu, döndürme, çalınan jeton kullanılırsa bütün
  oturumların kapanması; kaybolan yenileme yanıtı için 2 dk hoşgörü.
- Ana ve yedek SMS yönlendirici, İleti Merkezi bağdaştırıcısı (anahtar bekliyor), IP hız sınırı.
- İşlem kaydı (yalnızca ekleme), outbox ve pg-boss kuyruğu, hak defteri (yalnızca ekleme), iade kilidi.
- Günlük maskeleri (telefon, kod, jeton, çerez yazılmaz), `/metrics`, GlitchTip bildirimi.
- Yönetim girişi: Google Workspace + zorunlu iki adımlı doğrulama, 30 dk hareketsizlik, kurtarma kodları, yeni cihaz uyarısı.
- İzin matrisi (tasarımdaki "Roller ve yetkiler" ile birebir), her `/staff` ucunda yetki denetimi (işaretsiz uç kapalı).
- Dört göz onay motoru: iade, fiyat, toplu gönderim, kupon, kalıcı engel, hesap silme, kategori şeması, yasal metin,
  tasarım değerleri.
- Özellik anahtarları ve bakım modu (tüm site ya da alan bazında), canlı provası (`deploy/prova/`), el kitabı
  `deploy/README.md`.

### Aşama 2 · Katalog ve kategoriler (Sprint 5–7)
- Katalog veri modeli ve içe aktarma hattı: TSB (konsoldan yükleme ve otomatik çekme), TSB arşivi (2020'den), eski yıllar
  için vehicle-makes-models (1985–2005) ve kaynaklı yerli klasikler listesi (Şahin, Doğan, Kartal, Murat, Anadol…).
- Kasa kuşakları, Wikidata nesil kodları, makyaj sırası, ad eşleme, VehiclesDB, Veri kaynakları sayfası.
- Nesil fotoğrafları (Commons), galerinin izinli portföy fotoğrafı temsilî görsel olarak (plaka bulanıklaştırma ile).
- 14 kategori ağacı ve sürümlü kategori şeması; şema yayını dört göz onayıyla.

### Aşama 3 · Talep (Sprint 8)
- Talep sihirbazı (web ve mobil), yaşam döngüsü ve süreler, ilk talep ücretsiz (numara ve hesap başına bir kez).
- Liste ve arama (OpenSearch), il/ilçe ve komşu il, talep detayı, favoriler, kayıtlı aramalar.
- Ana sayfa vitrini ve son talepler; giriş yapmamış ziyaretçide de görünür, API'ye ulaşılamazsa yeniden dener.
- Taleplerim istatistikleri (görüntülenme), çerezsiz web analitiği ve arama günlüğü.

### Aşama 4 · Galeri (Sprint 9–10)
- Kurumsal başvuru, beş kontrol (yetki belgesi, vergi, MERSİS, adres, telefon), ajan onayı, 30 gün deneme.
- Galeri ekibi ve davetler (yönetici, satış temsilcisi), galeri paneli ve herkese açık galeri profili.
- Portföy: elle ekleme, fotoğraf (en az 6), ekspertiz, 6 ay / 6.000 km kuralı, EİDS doğrulama (sağlayıcı arayüzü),
  Excel/CSV toplu yükleme, Kurumsal API anahtarı, araç sayfası, araç favorisi, kopya fotoğraf tespiti.

### Aşama 5 · Eşleştirme ve mesajlaşma (Sprint 11–13)
- Eşleştirme motoru ve skor (OpenSearch percolator), "Portföyünüze uyan talepler", konsolda deneme alanı.
- Talebe tek ilk mesaj, ilk mesaj hakları (günlük + ek), sohbet ve anlık iletim (WebSocket), araç kartı, numara paylaşımı,
  engelleme, mesaj gövdesi şifreli, mesaj güvenliği (kapora, IBAN, dış bağlantı).
- Yıldız ve rozetler, hile kuralları, galeri takibi, çalışan başına günlük ilk mesaj sınırı, 1 yıldıza itiraz.

### Aşama 6 · Ödemeler (Sprint 14–16)
- Web ödemeleri (PayTR bağdaştırıcısı + sahte sağlayıcı), haklar ve öne çıkarma (üst sıra, acil, vitrin).
- Galeri abonelikleri: kart saklama, otomatik yenileme, üst pakete geçiş, iptal, askı, pasif paket.
- Mağaza ödemeleri (mobil; sahte sağlayıcı, gerçeği RevenueCat ile), e-Arşiv sağlayıcı arayüzü, konsolda Ödemeler.
- İade akışı (sahip onayıyla): yalnızca öneri; yalnızca Sahip onaylar; yürütme ayrı süreçte (`refund-executor`).
- Ön bilgilendirme formu ve sözleşme PDF'i fatura e-postasında; kuponlar; fiyat listesi ve fiyat deneyleri.

### Aşama 7 · Bildirimler (Sprint 17)
- Olay → tercih ve rıza → kanal sırası → teslim kaydı. Uygulama içi, push (FCM), e-posta (SMTP), SMS (yalnızca kritik).
- Ticari iletide onay, haftada 2 sınırı, sessiz saat, tek tıkla ayrılma, İYS olayı, ısınma ve itibar denetimi.
- Konsolda şablonlar (sürümlü), bildirim merkezi, teslim raporu, otomatik akışlar.

### Aşama 8 · Yönetim ve güven (Sprint 18–27)
- Şikâyet ve moderasyon (kuyruk, maskeli kanıt, karar, itiraz, içerik filtreleri, yasaklı kelimeler, askı, kalıcı engel).
- Kullanıcı ve galeri kartı (maskeli iletişim, gerekçeyle açma, uyarı/askı/engel, hak tanımlama, not), kara liste.
- Destek ve yardım merkezi, ilk yanıt süresi, memnuniyet sorusu.
- KVKK: verilerimi indir, KVKK başvuruları, rıza kayıtları, hesap kapatma (anonimleştirme; iade yalnızca öneri),
  saklama ve imha (yarıyıllık, Sahip onayıyla), VERBİS, ihlal kaydı, resmi talepler.
- Yapay zekâ ağ geçidi ve bütçe (istekler her zaman maskeli), Rengarenk Ajanı (durdurma düğmeli), çalışan uyarıları,
  kullanıcı tarafı yapay zekâ (talep asistanı, ilk mesaj taslağı, mesaj güvenliği, toplu yükleme yardımı, destek sohbeti).
- İletişim ve profil ayarları, numara değiştirme, cihaz kara listesi, giriş bağlantısı, galeri müşteri yönetimi.

### Aşama 9 · Büyüme (Sprint 28–29)
- Kontrol paneli (ana ölçü, neden analizi, hedefler), raporlar (huni, harita, gelir, modeller, birim, kohort).
- Kampanyalar ve segmentler, açılış sayfaları, zamanlanmış raporlar (PDF), akış düzenleyicisi, banner ve vitrin,
  ana sayfa düzeni, A/B ve arayüz deneyleri, reklam ölçümü (Meta, Google; onay yoksa yazılmaz).
- Konsolun son dört ekranı: yardım ve yasal metinler (yeniden onay), talepler ve portföy (toplu işlem), sistem sağlığı ve
  yedek, tasarım değerleri.
- Tasarım değerleri: 14 renk (palet, renkli zemin üstündeki yazı, metin ve yüzeyler), 70 Türkçe destekli yazı tipi,
  oranlı köşeler (0 seçilince hepsi kalkar), mevsimsel temalar; web, mobil ve e-postaya uygulanır.
- Web düzeltmeleri: Hesabım açılır menüsü ve çıkış, oturumun bazen düşmesi, ana sayfa kategori bağlantısı.

---

## 3. Alınan notlar ve sahip kararları

### Değişmez kurallar (CLAUDE.md)
1. **Sahibine sorulmadan hiçbir zaman iade yapılmaz.** Veritabanı kilidi (`rr_refund_guard`, `rr_approval_immutable`;
   RR001, RR010–RR015, RR020) hiçbir gerekçeyle gevşetilmez. İade akışına dokunan her değişiklik önce sahibe sorulur.
2. **GitHub yalnızca bu bilgisayardan.** Commit serbest; `git push`, etiket (`v*`) ve uzak depoyu değiştiren her şey için
   önce sahip onayı.
3. **Kişisel veri Türkiye'de kalır** (Karar 37). GCP'ye yalnızca katalog, sentetik test verisi ve maskeli yapay zekâ
   istekleri gider. Kişisel veri alanları `/// @pii` ile işaretlenir.
4. `audit_log`, `entitlement_ledger` (ve portföy araçları, katalog görselleri, rıza kayıtları) yalnızca ekleme kabul eder.
5. İşlem kaydı ve outbox olayı değişiklikle aynı veritabanı işleminde yazılır.
6. Gerçek sırlar depoya yazılmaz; canlı sırlar SOPS ile şifreli.
7. Kapsam daraltılmaz (59 kararın hepsi ilk sürümde); yarım özellik anahtar arkasında.
8. Günlüklere telefon, SMS kodu, jeton, çerez, yetki başlığı yazılmaz.

### Sahip kararları (tarih sırasıyla)
- **7 Kasım 2026:** Sahip kendi isteğini onaylayabilir; diğer herkeste isteyen ≠ onaylayan. İade isteklerini yalnızca
  Sahip onaylar; onay motoru iade yürütmez. CATALOG rolü atanamaz (özel rol kullanılır). Yönetim e-posta alanı
  `rengarenk.com.tr`.
- **7–8 Kasım 2026:** TSB iki yoldan (konsoldan yükleme + otomatik çekme). Eski yıllar en az 1990'lara kadar; yerli
  klasikler kaynaklı listeyle (Karar 33'e sınırlı istisna). Kasko bedeli asla saklanmaz ve gösterilmez.
- **8 Kasım 2026:** Tasarım dosyalarıyla "eksik ya da farklı bir şey olmasın"; yeni ekranda `.dc.html` ve PDF birlikte
  kontrol edilir. EEA'dan resmi erişim istenecek; ağ geçidi engeli dolanılmayacak.
- **8 Kasım 2026:** Mağaza iadesinde kullanılmamış hak düşülür. İade önerisi akışı sahip onayıyla yapıldı.
- **9 Kasım 2026:** Hesap kapatma onaylandı (anonimleştirme; kullanılmamış web haklarının iadesi yalnızca öneri, Sahip
  onaylar; galeri sahibi bu yoldan kapatamaz). Kritik çalışan uyarısı SMS ile gitmez.
- **10 Kasım 2026:** "Kalan geliştirmeleri sırayla hepsini yap" (bitti). Yazı tipi seçeneği çok olsun (70). Tasarım
  panelinden her alan düzenlenebilsin; köşeler tamamen kaldırılabilsin; mavi butonlarda yazı rengi seçilebilsin.

### Bilinen teknik notlar
- Docker'daki PostgreSQL **5433** portunda (5432'de bilgisayarda başka PostgreSQL var).
- İlk göç elle yazıldı ve tetikleyiciler içerir; Prisma "düzeltme" göçü önerirse tetikleyici silmediğini kontrol et.
- `compose.prod.yml` yerel compose ile aynı proje adını taşır; canlı yapılandırmayı yerelde yalnızca
  `deploy/prova/compose.prova.yml` ile çalıştır.
- Yerel Docker servisleri artık `restart: unless-stopped`: bilgisayar uykudan çıkınca ya da Docker Desktop yeniden
  başlayınca kendiliğinden açılır. (Bugün ana sayfanın boş görünmesinin sebebi servislerin toplu kapanmasıydı.)
- Web'de renk için `lib/renk.ts`, köşe için `var(--rr-kart-kose)` / `--rr-buton-kose` / `--rr-etiket-kose` (oranlı
  `calc(...)`); mobilde `kartOran(N)` / `butonOran(N)`. Yeni gömülü renk ya da sabit köşe yazılmaz.
- Google Fonts'tan yazı tipi yüklenirken ziyaretçinin IP adresi Google'a gider; avukat görüşmesinde konuşulabilir ya da
  yazı tipleri kendi sunucumuzda barındırılabilir.

---

## 4. Kalan işler

### 4.1 Dış hesap ve sözleşme bekleyen entegrasyonlar
Kod hazır, sahte sağlayıcıyla çalışıyor; hesap açılınca gerçek bağdaştırıcı yazılıp denenir.

| İş | Senden gereken | Kod tarafında yapılacak | Tahmini süre |
| --- | --- | --- | --- |
| SMS ana sağlayıcı (İleti Merkezi) | **Hesap açıldı, anahtar `.env`'de (11 Kasım 2026).** Eksik: SMS paketi (bakiye 0) ve `RENGARENK` gönderici başlığı onayı | Bağdaştırıcı gerçek API'yle denendi (kimlik doğrulama geçti; başlık onaysız olduğu için kod 450). Paket ve başlık gelince `sms:dene` ile deneme SMS'i, sonra canlıda `SMS_PROVIDER=iletimerkezi` | 0,5 gün |
| SMS yedek (aday Netgsm) | Hesap ve API belgesi | `apps/api/src/sms/` altına bağdaştırıcı, yedeğe geçiş testi | 1 gün |
| Google Workspace (konsol girişi) | `rengarenk.com.tr` Workspace, OAuth istemcisi | `STAFF_AUTH_PROVIDER=google`, gerçek giriş denemesi | 0,5 gün |
| Radore sunucuları | Sunucu erişimi (SSH), alan adı DNS | İlk dağıtım, Caddy/TLS, yedek, izleme, SOPS (bkz. 4.2) | 3–5 gün |
| Apple Developer + Google Play | Hesaplar (Apple için D-U-N-S) | EAS derleme, TestFlight / iç test, mağaza ürünleri, RevenueCat | 3–4 gün |
| RevenueCat (mağaza ödemeleri) | Hesap, ürünler `rr_<ürün>` | `react-native-purchases`, sunucu bildirimi | 2 gün |
| Firebase (push) | Firebase projesi, iOS için APNs anahtarı | FCM gerçek gönderim, iOS Firebase SDK | 1 gün |
| PayTR | Üye işyeri sözleşmesi, mağaza anahtarları | Gerçek ödeme ve kart saklama denemesi, iade (`REFUND_PROVIDER=paytr`) | 2 gün |
| e-Arşiv entegratörü | Sözleşme ve API belgesi | Bağdaştırıcı, fatura ve iade faturası | 2–3 gün |
| EİDS (Ticaret Bakanlığı) | Entegrasyon erişimi | `eids.ts` gerçek sağlayıcı | 2 gün |
| Yetki belgesi, GİB, MERSİS | Kurum erişimleri | `verification.ts` gerçek sağlayıcı (şimdi her başvuru insana) | 2–3 gün |
| Kendi e-posta sunucusu | Radore'de sunucu, DNS (SPF/DKIM/DMARC) | Kurulum, ısınma planı, gelen destek e-postası | 2 gün |
| İYS | İYS kaydı | İzin olaylarının İYS'ye iletimi | 1 gün |
| Meta (mobil SDK) | Meta uygulama kimliği | `react-native-fbsdk-next`, KVKK izin ekranı, iOS ATT | 1–2 gün |
| Google Ads | Ads hesabı, Data Manager erişimi | Çevrimdışı dönüşüm ve harcama çekimi | 1–2 gün |
| Vertex AI (yapay zekâ) | GCP projesi ve bütçe | Ağ geçidinde gerçek sağlayıcı; ajanın sınıflandırma ve yorumları | 2 gün |
| EEA teknik değerleri | EEA'dan erişim biçimi | İçe aktarma hattı | 1–2 gün |
| TSB yazılı izni | İzin yazısı | (kod gerekmez; Veri kaynakları metni) | — |
| Avukat görüşü | Yasal metinlerin son hali | Metinler konsoldan yayınlanır (Sahip onayı); çerezsiz ölçüm ve Google Fonts notu | 1 gün |

### 4.2 Altyapı ve canlıya çıkış
- Radore'ye ilk dağıtım (`deploy/` Docker Compose + Caddy), alan adları ve TLS.
- Sırlar: `.env.prod` ve `.env.iade` SOPS ile şifreli; iade sürecinin anahtarı ayrı.
- Yedek: pgBackRest, ikinci veri merkezine kopya, `backup_runs` kaydı (betik örneği `deploy/README.md`), aylık geri
  yükleme provası (Karar 56).
- İzleme: Prometheus, Grafana, Loki, GlitchTip; konsoldaki Sistem sağlığı canlı veriyle.
- GCP test ortamı (yalnızca sentetik veri).

### 4.3 Lansman hazırlığı (Aşama 10)
- Sızma testi (dış firma önerilir) ve yük testi.
- Kapalı beta: 10 galeri, 100 alıcı; geri bildirim toplama.
- Mağaza incelemeleri (App Store, Google Play), mağaza metinleri ve ekran görüntüleri.
- Yasal metinlerin son hali (avukat), KVKK aydınlatma ve çerez metinleri.
- Yedekten geri yükleme provası ve işletme el kitabı (runbook) son hali.

### 4.4 Küçük açık maddeler
- Kullanıcının kendisinin "İade talep et" demesi (şimdilik destek üzerinden). **İade akışına dokunduğu için önce sahip kararı.**
- Ana sayfadaki "Sık sorulanlar" bölümü (varsayılanda kapalı) hâlâ koddaki listeden okuyor; yardım makalelerine bağlanabilir.
- Ajanın reklam yorumu ve sınıflandırması şimdilik kural tabanlı (Vertex AI gelince yapay zekâyla).
- E-postada açılma ve tıklama ölçülmüyor (bilinçli karar; izleme pikseli yok).
- Mobil uygulamada tasarım değerleri cihazda görsel olarak denenmedi (tür denetimi ve lint temiz).
- Yerel veritabanında önceki testlerden kalan kayıtlar var ("Deneme Kullanıcı", "Marmara Oto" gibi; 0555 000 00 xx
  numaraları). Temizlemek geri alınamaz; istersen sorarak sıfırlarız (bkz. 11).

---

## 5. Kalan işleri nasıl yapmalıyız (önerilen sıra)

Sıra, "canlıya çıkışı en çok hızlandıran ve en az bekleten" mantığıyla:

1. **Radore sunucusu + ilk dağıtım (en kritik).** Diğer bütün gerçek entegrasyonlar (SMS, e-posta, ödeme bildirimi)
   herkese açık bir adres ister. Sunucu gelince: `deploy/README.md` adımları → prova (`deploy/prova/`) zaten yapıldı →
   SOPS ile sırlar → `v0.1.0` etiketi (senin onayınla) → yedek ve izleme.
2. **SMS (İleti Merkezi) ve Google Workspace.** Bunlar olmadan canlıda kimse giriş yapamaz. İkisi de yarım günlük iş.
3. **Kendi e-posta sunucusu ve ısınma.** Isınma haftalar sürdüğü için erken başlamak gerekir.
4. **Apple ve Google Play hesapları → EAS derleme → TestFlight ve iç test.** Mağaza hesapları (özellikle Apple D-U-N-S)
   gecikmeye açık; kapalı beta buna bağlı.
5. **PayTR ve e-Arşiv** (aynı anda; fatura olmadan satış açılmaz). O zamana kadar canlıda satın alma kapalı
   (`PAYMENT_PROVIDER=none`).
6. **EİDS ve kurum doğrulamaları.** Gelene kadar galeri başvuruları insana düşer, araçlar EİDS olmadan yayınlanmaz
   (canlıda `none`).
7. **Firebase, İYS, Meta, Google Ads, Vertex AI:** beta sırasında sırayla.
8. **Aşama 10:** yük ve sızma testi → kapalı beta → mağaza incelemesi → lansman.

Her adımın sonunda: testler, `pnpm lint; pnpm typecheck; pnpm test`, plan dosyasında kutu işaretleme ve bu dosyanın
güncellenmesi.

---

## 6. Claude'un yardımcı olabileceği işler

**Yapabileceklerim (bu bilgisayardan, senin onayınla):**
- Her yeni hesap için bağdaştırıcıyı yazmak, sahte sağlayıcıyla ve testlerle denemek, belge ve `.env` örneğini güncellemek
  (SMS, Netgsm, Google, PayTR, e-Arşiv, EİDS, GİB/MERSİS, FCM, RevenueCat, Meta, Google Ads, Vertex AI, EEA).
- Radore dağıtımında adım adım yönlendirme, Compose/Caddy ayarı, SOPS kurulumu, yedek ve geri yükleme betikleri,
  izleme panoları, işletme el kitabı. (Sunucuya komut çalıştırmak ve `git push` / etiket için her seferinde önce sorarım.)
- EAS derleme ayarları (`eas.json`), TestFlight ve Google Play iç test dağıtım adımları, mağaza açıklama metinleri.
- Yük testi betikleri (ör. k6), sızma testi öncesi güvenlik gözden geçirmesi ve kontrol listesi.
- Yasal metin **taslakları** (avukatın onayı şart), aydınlatma metinlerine çerezsiz ölçüm ve yazı tipi notları.
- Kapalı beta: davet e-postaları, geri bildirim formu, beta için özellik anahtarları ve kampanyalar.
- Demo veriyi genişletmek, ekran görüntüsüyle tasarım uyum denetimi, hata ayıklama.

**Yapamadıklarım:** hesap açmak, sözleşme imzalamak, ödeme yapmak, kurumlardan erişim istemek, telefonda uygulamayı
bizzat görmek (sen denersin, ben düzeltirim), senin onayın olmadan canlıya dağıtmak ya da iade akışına dokunmak.

---

## 7. Yerel ortamı çalıştırma

PowerShell, depo kökü (`C:\Users\kemal\Desktop\Rengarenk`):

```powershell
pnpm infra:up                               # Docker Desktop açık olmalı
pnpm db:migrate                             # göçler (değişiklik yoksa hızlı geçer)
pnpm dev                                    # API :4000, web :3000, konsol :3001 ve mobil Metro birlikte
pnpm --filter @rengarenk/api dev:worker     # ayrı pencerede: işçi (bildirim, eşleşme, arama, EİDS)
```

| Adres | Ne |
| --- | --- |
| http://localhost:3000 | Web sitesi (alıcı ve galeri) |
| http://localhost:3001 | Yönetim konsolu |
| http://localhost:4000/docs | API belgeleri |
| http://localhost:8025 | Mailpit: yerelde giden bütün e-postalar burada |

Demo veriyi (bir kez) kurmak: `pnpm --filter @rengarenk/api demo`. Kuruluysa dokunmaz; yarıda kaldıysa kaldığı yerden devam eder.

---

## 8. Mobil uygulamayı telefonda canlı test etme

### 8.1 Şimdi: Expo Go ile (aynı Wi-Fi)
Uygulamanın bütün paketleri Expo Go ile uyumlu. Telefon ve bilgisayar **aynı ağda** olmalı. Bilgisayarın yerel adresi şu
an `192.168.1.27` (değişirse `ipconfig` ile bak).

1. Telefona **Expo Go** uygulamasını kur (App Store / Google Play).
2. `apps/mobile/.env.local` dosyası oluştur (git'e girmez):
   ```
   EXPO_PUBLIC_API_URL=http://192.168.1.27:4000
   ```
3. Kök `.env` dosyasına ekle ki ödeme ve bağlantı adresleri telefondan açılabilsin, sonra API'yi yeniden başlat:
   ```
   API_PUBLIC_URL=http://192.168.1.27:4000
   ```
4. Windows güvenlik duvarında API ve Metro portlarını aç (PowerShell'i **yönetici olarak** çalıştır, bir kez):
   ```powershell
   New-NetFirewallRule -DisplayName "Rengarenk gelistirme" -Direction Inbound -Protocol TCP -LocalPort 4000,8081 -Action Allow -Profile Private
   ```
   Ağ profilinin "Özel" olduğundan emin ol (Ayarlar › Ağ › Wi-Fi/Ethernet › Ağ profili türü: Özel).
5. Altyapı, API ve işçi açıkken mobil geliştirme sunucusunu **ayrı bir pencerede** başlat (karekod bu pencerede net
   görünür). `pnpm dev` mobili de başlattığı için o zaman diğerlerini mobilsiz başlat:
   ```powershell
   pnpm turbo run dev --filter=!@rengarenk/mobile   # 1. pencere: API, web, konsol
   pnpm --filter @rengarenk/api dev:worker          # 2. pencere: işçi
   pnpm --filter @rengarenk/mobile dev              # 3. pencere: mobil (karekod)
   ```
6. Ekrandaki karekodu telefonda okut: iPhone'da Kamera, Android'de Expo Go içinden "Scan QR code".
7. Uygulama açılınca giriş ekranında demo numarayı yaz (bkz. 9); yerelde kod kutuya kendiliğinden yazılır.

Kodda değişiklik yaptıkça uygulama telefonda anında yenilenir. Telefondan API'nin açık olduğunu denemek için telefon
tarayıcısında `http://192.168.1.27:4000/health` açılmalı.

**Expo Go'da sınırlamalar:** uzaktan push bildirimi gelmez (uygulama içi bildirimler görünür); mağaza ödemeleri sahte
sağlayıcıyla çalışır; yazı tipi ve tasarım değerleri açılışta API'den okunur.

**Farklı ağdaysan (ör. telefon mobil veride):** `pnpm --filter @rengarenk/mobile exec expo start --tunnel` Metro'yu
tünelden açar, ama API de dışarıdan erişilebilir olmalı; bu durumda sunucu (Radore) ya da geçici bir tünel gerekir.
İstersen bunu birlikte kurarız.

### 8.2 Android emülatörü (isteğe bağlı)
Android Studio ile bir emülatör kur, `pnpm --filter @rengarenk/mobile android`. Emülatörde API adresi olarak yine
`192.168.1.27` kullanılabilir.

### 8.3 Sonra: gerçek uygulama (TestFlight ve Google Play iç test)
Apple ve Google hesapları açılınca EAS ile derlenmiş gerçek uygulama dağıtılır. Push bildirimi, mağaza ödemesi ve
uygulama simgesi ancak burada tam denenir. Adımlar: `eas.json` → `eas build --profile preview` → TestFlight / iç test
bağlantısı → beta kullanıcılarına davet. Bunu hesaplar gelince birlikte kuracağız.

---

## 9. Demo veri ve giriş bilgileri

Demo veri `pnpm --filter @rengarenk/api demo` ile kuruldu (10 Kasım 2026). Hepsi API'nin kendi uçlarından geçtiği için
hak defteri, işlem kaydı, bildirimler, arama ve eşleşmeler tutarlıdır.

### 9.1 Web ve mobil girişi nasıl yapılır
1. http://localhost:3000/giris (mobilde Giriş ekranı).
2. Telefon numarasını yaz (ör. `0555 100 00 01`).
3. Yerelde SMS gönderilmez; ekranda "Geliştirme ortamı: SMS gönderilmedi, kod … kutuya yazıldı" görünür. Devam et.
4. Aynı numarayla 60 saniye içinde yeniden kod istenemez; aynı bilgisayardan saatte en çok 20 kod istenebilir
   (aşılırsa bkz. 11).

### 9.2 Bireysel kullanıcılar (alıcı ve bireysel satıcı)

| Kişi | Telefon | Şehir | Hesapta neler var | Ne denenir |
| --- | --- | --- | --- | --- |
| Ayşe Yılmaz | 0555 100 00 01 | İstanbul, Kadıköy | 2 talep: BMW 3 Serisi 320i (#1000020) ve Toyota Corolla 1.5 (#1000021); Kadıköy Premium ile açık sohbet (araç kartlı, karşılıklı mesaj); Corolla talebine galeriden Elif ve bireysel satıcı Can'dan ilk mesaj; araç favorisi (Mercedes C 200) | Taleplerim, Mesajlarım, sohbet, numara paylaşma, engelleme, yıldız verme, favoriler |
| Mehmet Kaya | 0555 100 00 02 | Ankara, Çankaya | Renault Clio talebi (#1000022); Ankara Güven Oto ile sohbet; Ayşe'nin BMW talebi favoride; 1 destek talebi | Destek, favoriler, sohbet |
| Zeynep Demir | 0555 100 00 03 | İzmir, Karşıyaka | VW Passat talebi (#1000023); Can'dan "kapora" içeren mesaj (Zeynep şikâyet etti); "İstanbul BMW" kayıtlı araması | Kayıtlı arama, şikâyet, uyarı bandı |
| Can Öztürk | 0555 100 00 04 | İstanbul | Bireysel satıcı: Ayşe'nin Corolla ve Zeynep'in Passat taleplerine ilk mesaj attı (biri şikâyetli) | Bireysel satıcı gözünden talep listesi, ilk mesaj hakları, moderasyon sonucu |
| Burak Çelik | 0555 100 00 05 | Bursa, Nilüfer | Dacia Duster talebi (Arazi, SUV ve Pickup) | Kategori farkları |
| Selin Aksoy | 0555 100 00 06 | Antalya, Muratpaşa | Hyundai i20 talebi | Sade alıcı |
| (yeni üye) | 0555 100 00 07 / 08 / 09 | — | Kayıtlı değil | Üyelik, onaylar, ilk ücretsiz talep, sihirbaz |

### 9.3 Galeriler

| Galeri | Sahip / ekip | Telefon | Paket | Portföy | Ne denenir |
| --- | --- | --- | --- | --- | --- |
| Kadıköy Premium Otomotiv (`/galeri/kadikoy-premium-otomotiv`) | Ahmet Şahin (sahip) | 0555 200 00 01 | **Profesyonel** (sahte ödemeyle alındı, kart saklı, otomatik yenileme) | 7 araç yayında: BMW 320i 2021 (#77100003), Toyota Corolla 1.5 2022 (#77100004), Mercedes C 200 2020 (#77100005), VW Passat 1.5 TSI 2020, Honda Civic 1.5 2021, Peugeot 3008 1.5 BlueHDi 2021, Hyundai i20 1.4 2021 | Galeri paneli, portföy, eşleşmeler ("Portföyünüze uyan talepler"), araç kartıyla ilk mesaj, paket ve faturalar, ekip yönetimi, Kurumsal API anahtarı (Profesyonel'de yok, Kurumsal'da) |
| | Elif Arslan (satış temsilcisi) | 0555 200 00 02 | — | — | Çalışan gözünden panel, çalışan başına günlük ilk mesaj sınırı |
| Ankara Güven Oto (`/galeri/ankara-guven-oto`) | Hüseyin Koç (sahip) | 0555 200 00 03 | **30 gün deneme** (10 Aralık 2026'ya kadar) | 3 araç: Renault Clio 2022 (#77100009), Fiat Egea 2021, Ford Focus 2019 | Deneme süresi, paket alma (sahte ödeme), Mehmet ile sohbet |
| İzmir Körfez Otomotiv | Serkan Aydın | 0555 200 00 04 | Başvuru **incelemede** (yetki belgesi uyarılı) | — | Başvuranın gözünden bekleme ekranı; konsolda Galeri başvuruları'ndan onay/ret/belge isteme |

Galeriye giriş: aynı telefonla giriş yapılır; üst menüde "Galeri paneli" görünür (web `/galeri-paneli`, mobilde Hesabım ›
Galeri paneli).

**Sahte ödeme:** paket ya da hak satın alırken açılan sayfada "Ödemeyi onayla (başarılı)" / "Ödemeyi reddet (başarısız)"
ve abonelikte "Kartı kaydet ve öde" / "yenilemede reddedilecek kart" düğmeleri var. Gerçek para çekilmez.

### 9.4 Yönetim konsolu çalışanları

Giriş: http://localhost:3001 → **Google Workspace ile giriş yap** → (yerelde sahte Google sayfası) e-postayı yaz →
doğrulama uygulamasındaki 6 haneli kod.

Doğrulama kodu iki yoldan alınır:
- **Telefondaki uygulamayla (önerilen):** Google Authenticator / Microsoft Authenticator → "Kurulum anahtarı gir" →
  hesap adı olarak e-postayı, anahtar olarak aşağıdaki sırrı yaz (zamana dayalı).
- **Komutla:** `pnpm --filter @rengarenk/api demo kod moderator@rengarenk.com.tr` o anki kodu yazar.

| E-posta | Ad | Rol | Doğrulama sırrı (yalnızca yerel) | Neler yapabilir |
| --- | --- | --- | --- | --- |
| devops@kgteknoloji.com.tr | Kemal Çağlar | **Sahip** | (senin uygulamanda kurulu) | Her şey; iade ve tasarım/yasal onayı, çalışan yönetimi |
| yonetici@rengarenk.com.tr | Deniz Yönetici | Yönetici | `BDH4G5C7VBB5RKZAMYBOELBT2DNMU5YA` | Çoğu modül; iade, fiyat, tasarım için yalnızca öneri; toplu gönderim onayı |
| moderator@rengarenk.com.tr | Mert Moderatör | Moderatör | `BGWOBAQGL3NJVEXP2LQAG2VCYGNLDDW7` | Şikâyetler, askı, kalıcı engel (onaylı); kişisel veri maskeli |
| destek@rengarenk.com.tr | Duygu Destek | Destek | `H5LN6OQTZXHRXKL5CCVDI3AVULP4TUP5` | Destek talepleri, küçük hak tanımlama; iade ve KVKK yanıtı için öneri; raporlar (maskeli) |
| operasyon@rengarenk.com.tr | Oya Operasyon | Operasyon | `Z7WKYLRYKAVMVRQ6JDHZ3PJKCS22O73W` | Galeri başvurusu onayı, destek talepleri, raporlar (maskeli) |
| pazarlama@rengarenk.com.tr | Pelin Pazarlama | Pazarlama | `VFHNWHK2LMH2QOQF7GJ7CYL4EJ5YLJMY` | Kampanya, kupon, banner, açılış sayfası; toplu gönderim ve tasarım önerisi |
| finans@rengarenk.com.tr | Fatih Finans | Finans | `UHHHR3VWPPM5PNXOA2KVB26CXZLPAIIG` | Raporlar ve dışa aktarma; iade ve fiyat önerisi |
| izleyici@rengarenk.com.tr | İlker İzleyici | İzleyici | `HU3JE2USYU4M5GBESFNKGDJOEINY3EGC` | Yalnızca raporlar ve işlem kaydı |

Tam izin matrisi konsolda **Ekip › Roller ve yetkiler** sayfasında. Dört göz kuralı: bir çalışanın isteğini başka biri
onaylar (Sahip hariç); iadeyi yalnızca Sahip onaylar.

> `sahip@rengarenk.com.tr` eski bir yerel sahip hesabıdır; doğrulama uygulaması daha önce kurulduğu için sırrı bilinmiyor.
> Kendi hesabınla (devops@…) girmen yeterli.

---

## 10. Rol rol deneme senaryoları

### Ziyaretçi (giriş yok)
- Ana sayfada vitrin ve son talepler görünüyor mu; kategoriye tıklayınca talep listesi açılıyor mu.
- Talep listesinde süzgeçler (marka, yıl, bütçe, il), talep detayı, galeri profili ve araç sayfası.

### Bireysel alıcı (Ayşe, 0555 100 00 01)
- Taleplerim: iki talep, görüntülenme sayıları; "Kapat", "Uzat", "Öne çıkar" (hak ve sahte ödeme).
- Mesajlarım: Kadıköy Premium ile sohbet (araç kartı), Elif ve Can'ın ilk mesajları; yanıtla, numara paylaş, engelle.
- Sohbet sonrası galeriye yıldız ver; Bildirimler zili; Ayarlar › Bildirimler, İletişim, Gizlilik (verilerimi indir).
- Yeni talep: ikinci talep hakkı kullanıldığı için üçüncü talepte hak satın alma ekranı çıkmalı.

### Bireysel satıcı (Can, 0555 100 00 04)
- Talep listesinden bir talebe ilk mesaj; günlük ilk mesaj hakkı sayacı; aynı talebe ikinci ilk mesaj engeli.
- Zeynep'in şikâyeti konsolda karara bağlanınca Can'a uyarı/askı bildirimi.

### Galeri sahibi (Ahmet, 0555 200 00 01)
- Galeri paneli: portföy (7 araç), araç ekle (en az 6 fotoğraf), toplu yükleme (Excel), eşleşmeler, bölgede aranan modeller.
- Ayşe'nin BMW talebine yazılan sohbet; Zeynep'in Passat talebi İzmir'de (il farklı) eşleşme listesinde nasıl görünüyor.
- Paket: Profesyonel; üst pakete geçiş (Kurumsal), iptal; faturalar ve e-posta (Mailpit).
- Ekip: Elif'in rolü ve günlük sınırı; yeni davet (ör. 0555 200 00 05).

### Galeri çalışanı (Elif, 0555 200 00 02)
- Satış temsilcisi yetkileri: ekip ve paket ekranları kısıtlı; ilk mesaj sınırı.

### Deneme galerisi (Hüseyin, 0555 200 00 03)
- Deneme süresi uyarıları, paket alma (sahte ödeme), Mehmet ile sohbet.

### Başvurusu bekleyen galeri (Serkan, 0555 200 00 04)
- Başvuru durumu ekranı. Konsolda onaylanınca 30 gün deneme başlar ve bildirim gider.

### Konsol
- **Sahip (sen):** Onay kuyruğu, Tasarım değerleri (ör. mavi üstündeki yazıyı beyaz yap → onaya gönder → onayla),
  Yasal metinler, İade öner/onayla (yalnızca sahte sağlayıcı), Sistem sağlığı.
- **Moderatör:** Moderasyon kuyruğunda Zeynep'in kapora şikâyeti ve otomatik "yasaklı kelime" kaydı → karar (uyar/askı).
- **Destek:** Mehmet'in destek talebi → yanıtla → memnuniyet sorusu.
- **Operasyon (ya da Yönetici):** Galeri başvuruları › İzmir Körfez Otomotiv → belgeler → onay / ret / belge iste.
- **Pazarlama:** segment (ör. İstanbul alıcıları) → kampanya; banner ve vitrin; açılış sayfası.
- **Finans:** Ödemeler › Kadıköy'ün abonelik siparişi ve faturası.
- **İzleyici:** raporlar açılır, düzenleme düğmeleri görünmez.
- **Yönetici:** Kullanıcılar ve galeriler kartı (maskeli iletişim, gerekçeyle açma), hak tanımlama, özellik anahtarları.

---

### SMS (İleti Merkezi) denemesi
- Hesap durumu, SMS göndermeden: `pnpm --filter @rengarenk/api sms:dene` (bakiye, onaylı başlıklar, `SMS_SENDER_ID` onaylı mı).
- Deneme SMS'i (bakiyeden düşer): `pnpm --filter @rengarenk/api sms:dene 05XXXXXXXXX`.
- Gerçek girişle deneme: `.env`'de `SMS_PROVIDER=iletimerkezi`, API'yi yeniden başlat, kendi numaranla giriş yap. Bu
  sırada kod ekranda görünmez ve demo numaralarına (0555 100 00 0x) SMS gönderilmeye çalışılır; denemeden sonra
  `SMS_PROVIDER=console`'a geri dön.

## 11. Sorun giderme

| Belirti | Sebep ve çözüm |
| --- | --- |
| Ana sayfa boş, her şey hata veriyor | Docker servisleri kapanmış olabilir: `pnpm infra:up`. (Artık kendiliğinden açılmaları gerekir.) |
| "rengarenk rolü mevcut değil" | Yanlış porta bağlanılmış; PostgreSQL 5433'te. |
| "Yeni kod için biraz bekle" | Aynı numaraya 60 sn içinde ikinci kod. Bekle ya da başka demo numarası kullan. |
| "Çok fazla istek" (giriş kodu) | Saatte 20 kod sınırı. Yalnızca yerelde: `docker exec rengarenk-redis-1 sh -c "redis-cli --scan --pattern 'rl:otp:ip:*' \| xargs -r redis-cli del"` |
| Konsolda "kod geçersiz" | Telefonun saati otomatik olmalı; aynı kod ikinci kez kullanılamaz, 30 sn bekleyip yeni kodu dene. |
| Telefonda uygulama API'ye bağlanmıyor | `apps/mobile/.env.local` adresi, güvenlik duvarı kuralı, aynı Wi-Fi, ağ profili "Özel". Telefonda `http://192.168.1.27:4000/health` açılmalı. |
| E-posta gelmedi | Yerelde e-postalar gerçekten gitmez; http://localhost:8025 (Mailpit). |
| Bildirim ya da eşleşme gelmiyor | İşçi çalışıyor mu: `pnpm --filter @rengarenk/api dev:worker`. |
| Demo veriyi baştan kurmak | Yerel veritabanını sıfırlamak geri alınamaz; önce bana söyle, birlikte yapalım (göçler + seed + demo). |
