'use client';

import {
  GALLERY_PLANS,
  PACKAGE_ROWS,
  PAID_PLAN_KEYS,
  type PackageTerms,
  PRODUCTS,
  type PriceBook,
  packageValueText,
} from '@rengarenk/shared';
import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';
import { FiyatDeneyleri } from './fiyat-deneyleri';

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

const kart: CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E3E6EF',
  borderRadius: 18,
  overflow: 'hidden',
};
const baslik: CSSProperties = {
  margin: 0,
  padding: '16px 18px',
  fontSize: 17,
  fontWeight: 800,
  borderBottom: '1px solid #EEF0F5',
};
const ustSatir: CSSProperties = {
  display: 'grid',
  gap: 8,
  padding: '10px 18px',
  background: '#F3F5FA',
  fontSize: 11.5,
  fontWeight: 800,
  color: '#5A6073',
  textTransform: 'uppercase',
  letterSpacing: 0.3,
};
const satir: CSSProperties = {
  display: 'grid',
  gap: 8,
  alignItems: 'center',
  padding: '9px 18px',
  borderTop: '1px solid #EEF0F5',
  fontSize: 13.5,
};
const kutu: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #D5DAE5',
  borderRadius: 8,
  padding: '6px 8px',
  fontSize: 13.5,
  fontFamily: 'inherit',
};
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
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Kurallar ve fiyatlar</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#5A6073' }}>
            Fiyat ve paket değişikliği dört göz onayı ister ve ileri tarihe zamanlanır. Mevcut aboneler
            yenileme tarihine kadar eski fiyattan devam eder.
          </p>
        </div>
        {yazabilir && o ? (
          duzen ? (
            <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 12.5, fontWeight: 700 }}>
                Yürürlük
                <input
                  type="date"
                  value={gun}
                  onChange={(e) => setGun(e.target.value)}
                  style={{ ...kutu, display: 'block', marginTop: 3, width: 150, padding: 8 }}
                />
              </label>
              <label style={{ fontSize: 12.5, fontWeight: 700 }}>
                Not
                <input
                  value={not}
                  onChange={(e) => setNot(e.target.value)}
                  placeholder="İsteğe bağlı"
                  style={{ ...kutu, display: 'block', marginTop: 3, width: 180, padding: 8 }}
                />
              </label>
              <button
                type="button"
                onClick={() => setTaslak(null)}
                style={{
                  border: 0,
                  background: 'transparent',
                  padding: '11px 8px',
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#5A6073',
                  cursor: 'pointer',
                  alignSelf: 'flex-end',
                  fontFamily: 'inherit',
                }}
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={gonder}
                style={{
                  border: 0,
                  background: '#3DD68C',
                  borderRadius: 12,
                  padding: '11px 16px',
                  fontSize: 14,
                  fontWeight: 800,
                  color: '#1E2333',
                  cursor: 'pointer',
                  alignSelf: 'flex-end',
                  fontFamily: 'inherit',
                }}
              >
                Onaya gönder
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setTaslak(structuredClone(o.yururlukte.kitap))}
              style={{
                border: '1px solid #5B8CFF',
                background: '#FFFFFF',
                borderRadius: 12,
                padding: '11px 16px',
                fontSize: 14,
                fontWeight: 800,
                color: '#2450C8',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Düzenle
            </button>
          )
        ) : null}
      </div>
      {bilgi ? (
        <p
          role="status"
          style={{
            background: '#E7FAF0',
            color: '#11683F',
            borderRadius: 12,
            padding: '10px 14px',
            fontWeight: 700,
          }}
        >
          {bilgi}
        </p>
      ) : null}
      {hata ? (
        <p
          role="alert"
          style={{
            background: '#FDECEC',
            color: '#A3271F',
            borderRadius: 12,
            padding: '10px 14px',
            fontWeight: 700,
          }}
        >
          {hata}
        </p>
      ) : null}

      {kitap ? (
        <>
          <section style={kart} aria-labelledby="paket">
            <h2 id="paket" style={baslik}>
              Galeri paketleri
            </h2>
            <div style={{ ...ustSatir, gridTemplateColumns: 'minmax(0, 2fr) repeat(3, minmax(0, 1fr))' }}>
              <span>Özellik</span>
              {PAID_PLAN_KEYS.map((k) => (
                <span key={k}>{GALLERY_PLANS[k].ad}</span>
              ))}
            </div>
            {PACKAGE_ROWS.map((r) => (
              <div
                key={r.alan}
                style={{ ...satir, gridTemplateColumns: 'minmax(0, 2fr) repeat(3, minmax(0, 1fr))' }}
              >
                <span style={{ fontWeight: 700 }}>{r.ad}</span>
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
                      style={kutu}
                    />
                  ) : (
                    <span key={k}>{packageValueText(r.alan, kitap.paketler[k][r.alan])}</span>
                  ),
                )}
              </div>
            ))}
            <p
              style={{
                margin: 0,
                padding: '10px 18px',
                fontSize: 12,
                color: '#5A6073',
                borderTop: '1px solid #EEF0F5',
              }}
            >
              Fiyatlar KDV hariç; yıllık ödemede 2 ay ücretsiz. Galeri abonelikleri yalnızca web’den alınır.
              Deneme: 30 gün, Profesyonel özellikleri, 15 araç, günde 10 ilk mesaj.
              {o?.yururlukte.since ? ` Bu liste ${tarih(o.yururlukte.since)} tarihinden beri geçerli.` : ''}
            </p>
          </section>

          <div
            style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 16, alignItems: 'flex-start' }}
          >
            <section style={{ ...kart, flex: '3 1 460px', minWidth: 0 }} aria-labelledby="urun">
              <h2 id="urun" style={baslik}>
                Bireysel ürünler · KDV dahil
              </h2>
              <div
                style={{ ...ustSatir, gridTemplateColumns: 'minmax(0, 2.4fr) minmax(0, 1fr) minmax(0, 1fr)' }}
              >
                <span>Ürün</span>
                <span style={{ textAlign: 'right' }}>Web</span>
                <span style={{ textAlign: 'right' }}>Mobil (mağaza)</span>
              </div>
              {PRODUCTS.map((p) => (
                <div
                  key={p.key}
                  style={{ ...satir, gridTemplateColumns: 'minmax(0, 2.4fr) minmax(0, 1fr) minmax(0, 1fr)' }}
                >
                  <span style={{ fontWeight: 700 }}>{p.ad}</span>
                  {duzen ? (
                    <input
                      aria-label={`${p.ad} · web fiyatı`}
                      value={String(kitap.urunler[p.key] ?? '').replace('.', ',')}
                      onChange={(e) => urunYaz(p.key, e.target.value)}
                      style={{ ...kutu, textAlign: 'right' }}
                    />
                  ) : (
                    <span style={{ textAlign: 'right', fontWeight: 800 }}>
                      {tl(kitap.urunler[p.key] ?? p.tl)}
                    </span>
                  )}
                  <span style={{ textAlign: 'right', color: '#5A6073' }}>{tl(p.mobil)}</span>
                </div>
              ))}
              <p
                style={{
                  margin: 0,
                  padding: '10px 18px',
                  fontSize: 12,
                  color: '#5A6073',
                  borderTop: '1px solid #EEF0F5',
                }}
              >
                Mobil fiyatlar App Store Connect ve Google Play Console’dan değişir; burada yalnızca
                gösterilir.
              </p>
            </section>
            <section style={{ ...kart, flex: '2 1 340px', minWidth: 0 }} aria-labelledby="kural">
              <h2 id="kural" style={baslik}>
                Kullanım kuralları
              </h2>
              {o?.kurallar.map((k) => (
                <div
                  key={k.ad}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '10px 18px',
                    borderBottom: '1px solid #EEF0F5',
                  }}
                >
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700 }}>{k.ad}</span>
                    <span style={{ display: 'block', fontSize: 12, color: '#5A6073' }}>{k.not}</span>
                  </span>
                  <span style={{ flex: 'none', fontSize: 14, fontWeight: 800 }}>{k.deger}</span>
                </div>
              ))}
            </section>
          </div>
        </>
      ) : null}

      {o?.degisiklikler.length ? (
        <section style={{ ...kart, marginTop: 16 }} aria-labelledby="gecmis">
          <h2 id="gecmis" style={baslik}>
            Fiyat değişiklikleri
          </h2>
          {o.degisiklikler.map((d) => {
            const [ad, bg, fg] = DURUM[d.durum];
            return (
              <div
                key={d.id}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '6px 14px',
                  padding: '12px 18px',
                  borderBottom: '1px solid #EEF0F5',
                  fontSize: 13.5,
                }}
              >
                <span
                  style={{
                    flex: 'none',
                    fontSize: 12,
                    fontWeight: 800,
                    padding: '3px 9px',
                    borderRadius: 999,
                    background: bg,
                    color: fg,
                  }}
                >
                  {ad}
                </span>
                <span style={{ flex: '1 1 300px', minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 800 }}>Yürürlük {tarih(d.yururluk)}</span>
                  <span style={{ display: 'block', fontSize: 12.5, color: '#3A4052', marginTop: 2 }}>
                    {d.degisiklikler.join(' · ')}
                  </span>
                  <span style={{ display: 'block', fontSize: 12, color: '#5A6073', marginTop: 2 }}>
                    {d.kim} · {tarih(d.zaman)}
                    {d.not ? ` · “${d.not}”` : ''}
                  </span>
                </span>
                {d.durum === 'zamanlandi' && yazabilir ? (
                  <button
                    type="button"
                    onClick={() => iptal(d.id)}
                    style={{
                      flex: 'none',
                      border: '1px solid #D5DAE5',
                      background: '#FFFFFF',
                      borderRadius: 10,
                      padding: '7px 12px',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
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
