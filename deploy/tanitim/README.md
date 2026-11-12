# Tanıtım sayfası

Canlı sistem açılana kadar rengarenksite.com'da duran tek sayfalık tanıtım (AWS Activate başvurusu "çalışan şirket web
sitesi" ister). Çerez, form, sayaç ve dış istek yok; yazı tipi sayfayla birlikte sunulur (Plus Jakarta Sans, OFL).
Renkler ve logo `docs/tasarim/Anasayfa.dc.html` ve `packages/shared/src/tokens.ts` ile aynı.

## Yükleme (Güzel Hosting, cPanel)

1. cPanel › Dosya Yöneticisi › `public_html`. Oradaki varsayılan `index.html` / `index.php` dosyasını sil ya da adını değiştir.
2. `index.html` ve `fonts/` klasörünü yükle (ya da `rengarenk-tanitim.zip`'i yükleyip "Extract" ile aç).
3. cPanel › SSL/TLS Status (AutoSSL): rengarenksite.com ve www için sertifika "aktif" olmalı.
4. Tarayıcıda https://rengarenksite.com açılır.

Canlı sistem gelince alan adı yeni sunucuya yönlendirilir ve bu sayfa kalkar.
