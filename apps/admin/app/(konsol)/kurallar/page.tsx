'use client';

import {
  BADGE_THRESHOLD_ROWS,
  type BadgeThresholds,
  badgeThresholdsOf,
  GALLERY_PLANS,
  PACKAGE_ROWS,
  PAID_PLAN_KEYS,
  type PackageTerms,
  PRODUCTS,
  type PriceBook,
  packageValueText,
} from '@rengarenk/shared';
import { useCallback, useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';
import { FiyatDeneyleri } from './fiyat-deneyleri';
import stil from './page.module.css';

interface Degisiklik {
  id: string;
  durum: 'onay_bekliyor' | 'zamanlandi' | 'yururlukte' | 'eski' | 'reddedildi' | 'iptal';
  yururluk: string;
  degisiklikler: string[];
  not: string | null;
  kim: string;
  zaman: string;
}
interface Ozet {
  yururlukte: { kitap: PriceBook; since: string | null; baslangic: boolean };
  kurallar: { ad: string; not: string; deger: string }[];
  degisiklikler: Degisiklik[];
}

const tl = (n: number) => `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(n)} TL`;
const tarih = (s: string) =>
  new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(s));
const DURUM: Record<Degisiklik['durum'], [string, string, string]> = {
  onay_bekliyor: ['Onay bekliyor', '#FFF6DF', '#7A5300'],
  zamanlandi: ['Zamanlandı', '#EEF3FF', '#2450C8'],
  yururlukte: ['Yürürlükte', '#E7FAF0', '#11683F'],
  eski: ['Eski', '#F3F5FA', '#5A6073'],
  reddedildi: ['Onaylanmadı', '#FDECEC', '#A3271F'],
  iptal: ['İptal edildi', '#F3F5FA', '#5A6073'],
};
/** Yarından itibaren ilk uygun gün (varsayılan: gelecek ayın 1'i) */
const ilkGun = () => {
  const d = new Date();
  const y = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-01`;
};

/**
 * Kurallar ve fiyatlar (YonetimSistem.dc.html › kural; Karar 47, 56). Galeri paketleri ve bireysel ürünlerin web fiyatı
 * "Düzenle" ile değiştirilir; değişiklik yürürlük tarihiyle dört göz onayına gider (Sahip onaylar) ve o gün geçerli
 * olur. Mevcut aboneler yenileme tarihine kadar eski fiyattan devam eder. Mobil fiyatlar mağaza panelinden değişir.
 * Altta bekleyen, zamanlanmış ve geçmiş değişiklikler ve fiyat deneyleri (tasarıma ek).
 */
export default function Kurallar() {
  const { me } = useKonsol();
  const yazabilir =
    me.permissions['fiyat.degistir'] === 'tam' || me.permissions['fiyat.degistir'] === 'oneri';
  const [o, setO] = useState<Ozet | null>(null);
  const [taslak, setTaslak] = useState<PriceBook | null>(null);
  const [gun, setGun] = useState(ilkGun);
  const [not, setNot] = useState('');
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  const yukle = useCallback(() => {
    yonetim<Ozet>('pricing')
      .then(setO)
      .catch((e: Error) => setHata(e.message));
  }, []);
  useEffect(yukle, [yukle]);

  const kitap = taslak ?? o?.yururlukte.kitap;
  const duzen = taslak !== null;
  // Rozet eşiği girişinin ham metni ("4," yazılırken virgül kaybolmasın)
  const [rozetHam, setRozetHam] = useState<Partial<Record<keyof BadgeThresholds, string>>>({});
  useEffect(() => {
    if (!duzen) setRozetHam({});
  }, [duzen]);

  function paketYaz(plan: (typeof PAID_PLAN_KEYS)[number], alan: keyof PackageTerms, v: string) {
    if (!taslak) return;
    const sayi = v.replace(/\D/g, '');
    const deger = alan === 'portfoy' && (v.trim() === '' || /sınırsız/i.test(v)) ? null : Number(sayi || 0);
    setTaslak({
      ...taslak,
      paketler: { ...taslak.paketler, [plan]: { ...taslak.paketler[plan], [alan]: deger } },
    });
  }
  function urunYaz(key: string, v: string) {
    if (!taslak) return;
    const n = Number(
      v
        .replace(/\./g, '')
        .replace(',', '.')
        .replace(/[^\d.]/g, ''),
    );
    setTaslak({ ...taslak, urunler: { ...taslak.urunler, [key]: Number.isFinite(n) ? n : 0 } });
  }
  function rozetYaz(alan: keyof BadgeThresholds, v: string) {
    if (!taslak) return;
    setRozetHam((h) => ({ ...h, [alan]: v }));
    const n = Number(v.replace(',', '.').replace(/[^\d.]/g, ''));
    setTaslak({
      ...taslak,
      rozetler: { ...badgeThresholdsOf(taslak), [alan]: Number.isFinite(n) ? n : 0 },
    });
  }
  async function gonder() {
    if (!taslak) return;
    setHata(null);
    try {
      const r = await yonetim<Ozet>('pricing', {
        method: 'POST',
        body: { kitap: taslak, yururluk: gun, ...(not.trim() ? { not: not.trim() } : {}) },
      });
      setO(r);
      setTaslak(null);
      setNot('');
      setBilgi(
        `Fiyat değişikliği onaya gönderildi. Onaylanınca ${tarih(`${gun}T00:00:00+03:00`)} tarihinde yürürlüğe girer; abonelere e-posta gider.`,
      );
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function iptal(id: string) {
    setHata(null);
    try {
      setO(await yonetim<Ozet>(`pricing/${id}/cancel`, { method: 'POST', body: {} }));
      setBilgi('Zamanlanmış değişiklik iptal edildi.');
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  return (
    <>
      <div className={stil.kutu1}>
        <div>
          <h1 className={stil.baslik1}>Kurallar ve fiyatlar</h1>
          <p className={stil.metin1}>
            Fiyat ve paket değişikliği dört göz onayı ister ve ileri tarihe zamanlanır. Mevcut aboneler
            yenileme tarihine kadar eski fiyattan devam eder.
          </p>
        </div>
        {yazabilir && o ? (
          duzen ? (
            <span className={stil.metin2}>
              <label className={stil.etiket1}>
                Yürürlük
                <input
                  type="date"
                  value={gun}
                  onChange={(e) => setGun(e.target.value)}
                  className={stil.girdi1}
                />
              </label>
              <label className={stil.etiket1}>
                Not
                <input
                  value={not}
                  onChange={(e) => setNot(e.target.value)}
                  placeholder="İsteğe bağlı"
                  className={stil.girdi2}
                />
              </label>
              <button type="button" onClick={() => setTaslak(null)} className={stil.dugme1}>
                Vazgeç
              </button>
              <button type="button" onClick={gonder} className={stil.dugme2}>
                Onaya gönder
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setTaslak(structuredClone(o.yururlukte.kitap))}
              className={stil.dugme3}
            >
              Düzenle
            </button>
          )
        ) : null}
      </div>
      {bilgi ? (
        <p role="status" className={stil.metin3}>
          {bilgi}
        </p>
      ) : null}
      {hata ? (
        <p role="alert" className={stil.metin4}>
          {hata}
        </p>
      ) : null}

      {kitap ? (
        <>
          <section className={stil.kutu2} aria-labelledby="paket">
            <h2 id="paket" className={stil.baslik2}>
              Galeri paketleri
            </h2>
            <div className={stil.kutu3}>
              <span>Özellik</span>
              {PAID_PLAN_KEYS.map((k) => (
                <span key={k}>{GALLERY_PLANS[k].ad}</span>
              ))}
            </div>
            {PACKAGE_ROWS.map((r) => (
              <div key={r.alan} className={stil.kutu4}>
                <span className={stil.metin5}>{r.ad}</span>
                {PAID_PLAN_KEYS.map((k) =>
                  duzen ? (
                    <input
                      key={k}
                      aria-label={`${GALLERY_PLANS[k].ad} · ${r.ad}`}
                      value={
                        r.alan === 'portfoy' && kitap.paketler[k].portfoy === null
                          ? 'Sınırsız'
                          : String(kitap.paketler[k][r.alan] ?? '')
                      }
                      onChange={(e) => paketYaz(k, r.alan, e.target.value)}
                      className={stil.girdi3}
                    />
                  ) : (
                    <span key={k}>{packageValueText(r.alan, kitap.paketler[k][r.alan])}</span>
                  ),
                )}
              </div>
            ))}
            <p className={stil.metin6}>
              Fiyatlar KDV hariç; yıllık ödemede 2 ay ücretsiz. Galeri abonelikleri yalnızca web’den alınır.
              Deneme: 30 gün, Profesyonel özellikleri, 15 araç, günde 10 ilk mesaj.
              {o?.yururlukte.since ? ` Bu liste ${tarih(o.yururlukte.since)} tarihinden beri geçerli.` : ''}
            </p>
          </section>

          <div className={stil.kutu5}>
            <section className={stil.kutu6} aria-labelledby="urun">
              <h2 id="urun" className={stil.baslik2}>
                Bireysel ürünler · KDV dahil
              </h2>
              <div className={stil.kutu7}>
                <span>Ürün</span>
                <span className={stil.metin7}>Web</span>
                <span className={stil.metin7}>Mobil (mağaza)</span>
              </div>
              {PRODUCTS.map((p) => (
                <div key={p.key} className={stil.kutu8}>
                  <span className={stil.metin5}>{p.ad}</span>
                  {duzen ? (
                    <input
                      aria-label={`${p.ad} · web fiyatı`}
                      value={String(kitap.urunler[p.key] ?? '').replace('.', ',')}
                      onChange={(e) => urunYaz(p.key, e.target.value)}
                      className={stil.girdi4}
                    />
                  ) : (
                    <span className={stil.metin8}>{tl(kitap.urunler[p.key] ?? p.tl)}</span>
                  )}
                  <span className={stil.metin9}>{tl(p.mobil)}</span>
                </div>
              ))}
              <p className={stil.metin6}>
                Mobil fiyatlar App Store Connect ve Google Play Console’dan değişir; burada yalnızca
                gösterilir.
              </p>
            </section>
            <section className={stil.kutu9} aria-labelledby="kural">
              <h2 id="kural" className={stil.baslik2}>
                Kullanım kuralları
              </h2>
              {o?.kurallar.map((k) => (
                <div key={k.ad} className={stil.kutu10}>
                  <span className={stil.metin10}>
                    <span className={stil.metin11}>{k.ad}</span>
                    <span className={stil.metin12}>{k.not}</span>
                  </span>
                  <span className={stil.metin13}>{k.deger}</span>
                </div>
              ))}
            </section>
          </div>

          {/* Rozet eşikleri (Karar 55, 56; tasarıma ek): aynı listeyle ve aynı onayla değişir */}
          <section className={stil.kutu11} aria-labelledby="rozet">
            <h2 id="rozet" className={stil.baslik2}>
              Rozet eşikleri
            </h2>
            {BADGE_THRESHOLD_ROWS.map((r) => {
              const deger = badgeThresholdsOf(kitap)[r.alan];
              return (
                <div key={r.alan} className={stil.kutu12}>
                  <span className={stil.metin5}>{r.ad}</span>
                  {duzen ? (
                    <input
                      aria-label={r.ad}
                      inputMode="decimal"
                      value={rozetHam[r.alan] ?? String(deger).replace('.', ',')}
                      onChange={(e) => rozetYaz(r.alan, e.target.value)}
                      className={stil.girdi4}
                    />
                  ) : (
                    <span className={stil.metin8}>
                      {new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(deger)}
                    </span>
                  )}
                  <span className={stil.metin14}>{r.birim}</span>
                </div>
              );
            })}
            <p className={stil.metin6}>
              Rozetler her gece yeniden hesaplanır; değişiklik yürürlüğe girdiği gecenin hesabıyla görünür.
            </p>
          </section>
        </>
      ) : null}

      {o?.degisiklikler.length ? (
        <section className={stil.kutu11} aria-labelledby="gecmis">
          <h2 id="gecmis" className={stil.baslik2}>
            Fiyat değişiklikleri
          </h2>
          {o.degisiklikler.map((d) => {
            const [ad, bg, fg] = DURUM[d.durum];
            return (
              <div key={d.id} className={stil.kutu13}>
                <span className={stil.metin15} style={{ background: bg, color: fg }}>
                  {ad}
                </span>
                <span className={stil.metin16}>
                  <span className={stil.metin17}>Yürürlük {tarih(d.yururluk)}</span>
                  <span className={stil.metin18}>{d.degisiklikler.join(' · ')}</span>
                  <span className={stil.metin19}>
                    {d.kim} · {tarih(d.zaman)}
                    {d.not ? ` · “${d.not}”` : ''}
                  </span>
                </span>
                {d.durum === 'zamanlandi' && yazabilir ? (
                  <button type="button" onClick={() => iptal(d.id)} className={stil.dugme4}>
                    İptal et
                  </button>
                ) : null}
              </div>
            );
          })}
        </section>
      ) : null}

      <FiyatDeneyleri
        yazabilir={yazabilir}
        bildir={(b, h) => {
          setBilgi(b);
          setHata(h ?? null);
          if (b || h) window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </>
  );
}
