'use client';

import { guvenYaz, PRICE_EXP_GUN, PRODUCTS } from '@rengarenk/shared';
import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';

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
const kart: CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E3E6EF',
  borderRadius: 18,
  overflow: 'hidden',
};
const girdi: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #D5DAE5',
  borderRadius: 10,
  padding: '9px 10px',
  fontSize: 14,
  fontFamily: 'inherit',
  marginTop: 4,
};
const etiket: CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 700, color: '#3A4052' };
const ikincil: CSSProperties = {
  flex: 'none',
  border: '1px solid #D5DAE5',
  background: '#FFFFFF',
  borderRadius: 10,
  padding: '7px 12px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
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
    <section style={{ ...kart, marginTop: 16 }} aria-labelledby="fiyat-deneyi">
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          padding: '14px 18px',
          borderBottom: '1px solid #EEF0F5',
        }}
      >
        <span>
          <h2 id="fiyat-deneyi" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
            Fiyat deneyleri
          </h2>
          <span style={{ display: 'block', fontSize: 12.5, color: '#5A6073', marginTop: 2 }}>
            Yalnızca web ve bireysel kullanıcılar · yarısı B fiyatını görür · ölçü kullanıcı başına gelir ·
            sahip onaylar. Sonuç Raporlar › Deneyler’de.
          </span>
        </span>
        {yazabilir && !form ? (
          <button type="button" onClick={() => setForm(true)} style={ikincil}>
            Yeni fiyat deneyi
          </button>
        ) : null}
      </div>
      {form ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'flex-end',
            padding: '14px 18px',
            background: '#F6F8FD',
            borderBottom: '1px solid #EEF0F5',
          }}
        >
          <label style={{ ...etiket, flex: '3 1 280px' }}>
            Deney adı
            <input
              value={ad}
              maxLength={120}
              placeholder="Ek ilk mesaj (10 adet) fiyatı: 99 TL mi, 119 TL mi?"
              onChange={(e) => setAd(e.target.value)}
              style={girdi}
            />
          </label>
          <label style={{ ...etiket, flex: '2 1 220px' }}>
            Ürün
            <select value={urun} onChange={(e) => setUrun(e.target.value)} style={girdi}>
              {PRODUCTS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.ad}
                </option>
              ))}
            </select>
          </label>
          <label style={{ ...etiket, flex: '1 1 140px' }}>
            B fiyatı (TL)
            <input
              inputMode="decimal"
              value={fiyat}
              placeholder={liste_ ? String(liste_.tl) : ''}
              onChange={(e) => setFiyat(e.target.value)}
              style={{ ...girdi, textAlign: 'right' }}
            />
          </label>
          <label style={{ ...etiket, flex: '1 1 110px' }}>
            Süre (gün)
            <input
              inputMode="numeric"
              value={gun}
              onChange={(e) => setGun(e.target.value)}
              style={{ ...girdi, textAlign: 'right' }}
            />
          </label>
          <span style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => setForm(false)} style={ikincil}>
              Vazgeç
            </button>
            <button
              type="button"
              onClick={gonder}
              disabled={ad.trim().length < 5 || !fiyat}
              style={{ ...ikincil, background: '#5B8CFF', border: 0, fontWeight: 800 }}
            >
              Sahibin onayına gönder
            </button>
          </span>
          <p style={{ flex: '1 1 100%', margin: 0, fontSize: 12.5, color: '#5A6073' }}>
            A kolu liste fiyatını görür. B fiyatı liste fiyatından en çok %50 farklı olabilir; süre{' '}
            {PRICE_EXP_GUN.min}–{PRICE_EXP_GUN.max} gün. Aynı ürün için aynı anda tek deney açılır. Galeri
            hesabıyla ve uygulama içinde liste fiyatı geçerlidir.
          </p>
        </div>
      ) : null}
      {liste && !liste.length ? (
        <p style={{ margin: 0, padding: '12px 18px', fontSize: 13.5, color: '#5A6073' }}>
          Henüz fiyat deneyi yok.
        </p>
      ) : null}
      {liste?.map((d) => {
        const [bg, fg] = RENK[d.durum];
        const s = d.sonuc;
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
              {d.durumAd}
            </span>
            <span style={{ flex: '1 1 320px', minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 800 }}>{d.ad}</span>
              <span style={{ display: 'block', fontSize: 12.5, color: '#3A4052', marginTop: 2 }}>
                {d.urunAd} · A {d.fiyatA} / B {d.fiyatB} · {d.gun} gün
                {d.baslangic ? ` · ${tarih(d.baslangic)}` : ''}
                {d.bitis ? ` – ${tarih(d.bitis)}` : ''}
              </span>
              {s ? (
                <span style={{ display: 'block', fontSize: 12, color: '#5A6073', marginTop: 2 }}>
                  Kişi başı gelir: A {kurus(s.a.ort)} ({s.a.n} kişi) · B {kurus(s.b.ort)} ({s.b.n} kişi)
                  {s.guven !== null ? ` · güven ${guvenYaz(s.guven)}` : ''}
                  {s.kazanan ? ` · ${s.kazanan} önde` : ''}
                  {d.oneriVar ? ' · kazanan fiyat önerildi' : ''}
                </span>
              ) : null}
            </span>
            {yazabilir && d.durum === 'suruyor' ? (
              <button type="button" onClick={() => eylem(d.id, 'stop')} style={ikincil}>
                Durdur
              </button>
            ) : null}
            {yazabilir &&
            (d.durum === 'bitti' || d.durum === 'durduruldu') &&
            s?.kazanan === 'B' &&
            !d.oneriVar ? (
              <button
                type="button"
                onClick={() => eylem(d.id, 'propose')}
                style={{ ...ikincil, background: '#3DD68C', border: 0, fontWeight: 800 }}
              >
                B fiyatını öner
              </button>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
