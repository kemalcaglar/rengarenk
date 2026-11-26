'use client';

import { guvenYaz, PRICE_EXP_GUN, PRODUCTS } from '@rengarenk/shared';
import { useCallback, useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';
import stil from './fiyat-deneyleri.module.css';

interface Deney {
  id: string;
  ad: string;
  urunAd: string;
  fiyatA: string;
  fiyatB: string;
  gun: number;
  durum: 'onay_bekliyor' | 'reddedildi' | 'suruyor' | 'bitti' | 'durduruldu';
  durumAd: string;
  baslangic: string | null;
  bitis: string | null;
  oneriVar: boolean;
  sonuc: {
    a: { n: number; ort: number | null };
    b: { n: number; ort: number | null };
    guven: number | null;
    kazanan: 'A' | 'B' | null;
  } | null;
}

const RENK: Record<Deney['durum'], [string, string]> = {
  onay_bekliyor: ['#FFF6DF', '#7A5300'],
  reddedildi: ['#FDECEC', '#A3271F'],
  suruyor: ['#EEF3FF', '#2450C8'],
  bitti: ['#E7FAF0', '#11683F'],
  durduruldu: ['#F3F5FA', '#5A6073'],
};
const kurus = (k: number | null) =>
  k === null ? '—' : `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(k / 100)} TL`;
const tarih = (s: string) =>
  new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' }).format(
    new Date(s),
  );

/**
 * Fiyat deneyleri (Karar 44, 56; sonuç kartı YonetimRapor.dc.html › deney). Tasarımda öneri ekranı olmadığı için
 * Kurallar ve fiyatlar'ın altında: ürün, B fiyatı ve süre; yalnızca Sahip onaylar. Yalnızca web ve bireysel
 * kullanıcılar; kullanıcıların yarısı B fiyatını görür, ölçü kullanıcı başına gelir. Kazanan fiyat yine onaylı bir
 * fiyat değişikliği olarak önerilir.
 */
export function FiyatDeneyleri({
  yazabilir,
  bildir,
}: {
  yazabilir: boolean;
  bildir: (bilgi: string | null, hata?: string | null) => void;
}) {
  const [liste, setListe] = useState<Deney[] | null>(null);
  const [form, setForm] = useState(false);
  const [ad, setAd] = useState('');
  const [urun, setUrun] = useState('mesaj_10');
  const [fiyat, setFiyat] = useState('');
  const [gun, setGun] = useState('14');

  const yukle = useCallback(() => {
    yonetim<Deney[]>('pricing/experiments')
      .then(setListe)
      .catch(() => setListe([]));
  }, []);
  useEffect(yukle, [yukle]);

  async function gonder() {
    try {
      setListe(
        await yonetim<Deney[]>('pricing/experiments', {
          method: 'POST',
          body: { ad, urun, fiyatB: Number(fiyat.replace(',', '.')), gun: Number(gun) },
        }),
      );
      setForm(false);
      setAd('');
      setFiyat('');
      bildir('Fiyat deneyi sahibin onayına gönderildi. Onaylanınca başlar.');
    } catch (e) {
      bildir(null, (e as Error).message);
    }
  }
  async function eylem(id: string, ne: 'stop' | 'propose') {
    try {
      setListe(await yonetim<Deney[]>(`pricing/experiments/${id}/${ne}`, { method: 'POST', body: {} }));
      bildir(
        ne === 'stop'
          ? 'Deney durduruldu; herkes liste fiyatını görüyor.'
          : 'Kazanan fiyat, fiyat değişikliği olarak sahibin onayına gönderildi.',
      );
    } catch (e) {
      bildir(null, (e as Error).message);
    }
  }

  const liste_ = PRODUCTS.find((p) => p.key === urun);
  return (
    <section className={stil.kutu1} aria-labelledby="fiyat-deneyi">
      <div className={stil.kutu2}>
        <span>
          <h2 id="fiyat-deneyi" className={stil.baslik1}>
            Fiyat deneyleri
          </h2>
          <span className={stil.metin1}>
            Yalnızca web ve bireysel kullanıcılar · yarısı B fiyatını görür · ölçü kullanıcı başına gelir ·
            sahip onaylar. Sonuç Raporlar › Deneyler’de.
          </span>
        </span>
        {yazabilir && !form ? (
          <button type="button" onClick={() => setForm(true)} className={stil.dugme1}>
            Yeni fiyat deneyi
          </button>
        ) : null}
      </div>
      {form ? (
        <div className={stil.kutu3}>
          <label className={stil.etiket1}>
            Deney adı
            <input
              value={ad}
              maxLength={120}
              placeholder="Ek ilk mesaj (10 adet) fiyatı: 99 TL mi, 119 TL mi?"
              onChange={(e) => setAd(e.target.value)}
              className={stil.girdi1}
            />
          </label>
          <label className={stil.etiket2}>
            Ürün
            <select value={urun} onChange={(e) => setUrun(e.target.value)} className={stil.girdi1}>
              {PRODUCTS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.ad}
                </option>
              ))}
            </select>
          </label>
          <label className={stil.etiket3}>
            B fiyatı (TL)
            <input
              inputMode="decimal"
              value={fiyat}
              placeholder={liste_ ? String(liste_.tl) : ''}
              onChange={(e) => setFiyat(e.target.value)}
              className={stil.girdi2}
            />
          </label>
          <label className={stil.etiket4}>
            Süre (gün)
            <input
              inputMode="numeric"
              value={gun}
              onChange={(e) => setGun(e.target.value)}
              className={stil.girdi2}
            />
          </label>
          <span className={stil.metin2}>
            <button type="button" onClick={() => setForm(false)} className={stil.dugme1}>
              Vazgeç
            </button>
            <button
              type="button"
              onClick={gonder}
              disabled={ad.trim().length < 5 || !fiyat}
              className={stil.dugme2}
            >
              Sahibin onayına gönder
            </button>
          </span>
          <p className={stil.metin3}>
            A kolu liste fiyatını görür. B fiyatı liste fiyatından en çok %50 farklı olabilir; süre{' '}
            {PRICE_EXP_GUN.min}–{PRICE_EXP_GUN.max} gün. Aynı ürün için aynı anda tek deney açılır. Galeri
            hesabıyla ve uygulama içinde liste fiyatı geçerlidir.
          </p>
        </div>
      ) : null}
      {liste && !liste.length ? <p className={stil.metin4}>Henüz fiyat deneyi yok.</p> : null}
      {liste?.map((d) => {
        const [bg, fg] = RENK[d.durum];
        const s = d.sonuc;
        return (
          <div key={d.id} className={stil.kutu4}>
            <span className={stil.metin5} style={{ background: bg, color: fg }}>
              {d.durumAd}
            </span>
            <span className={stil.metin6}>
              <span className={stil.metin7}>{d.ad}</span>
              <span className={stil.metin8}>
                {d.urunAd} · A {d.fiyatA} / B {d.fiyatB} · {d.gun} gün
                {d.baslangic ? ` · ${tarih(d.baslangic)}` : ''}
                {d.bitis ? ` – ${tarih(d.bitis)}` : ''}
              </span>
              {s ? (
                <span className={stil.metin9}>
                  Kişi başı gelir: A {kurus(s.a.ort)} ({s.a.n} kişi) · B {kurus(s.b.ort)} ({s.b.n} kişi)
                  {s.guven !== null ? ` · güven ${guvenYaz(s.guven)}` : ''}
                  {s.kazanan ? ` · ${s.kazanan} önde` : ''}
                  {d.oneriVar ? ' · kazanan fiyat önerildi' : ''}
                </span>
              ) : null}
            </span>
            {yazabilir && d.durum === 'suruyor' ? (
              <button type="button" onClick={() => eylem(d.id, 'stop')} className={stil.dugme1}>
                Durdur
              </button>
            ) : null}
            {yazabilir &&
            (d.durum === 'bitti' || d.durum === 'durduruldu') &&
            s?.kazanan === 'B' &&
            !d.oneriVar ? (
              <button type="button" onClick={() => eylem(d.id, 'propose')} className={stil.dugme3}>
                B fiyatını öner
              </button>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
