'use client';

import {
  ILLER,
  SEGMENT_FIELDS,
  SEGMENT_PLANS,
  SEGMENT_PLATFORMS,
  SEGMENT_ROLES,
  type SegmentField,
  type SegmentRule,
} from '@rengarenk/shared';
import { type CSSProperties, useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';

interface Onizleme {
  adimlar: { alan: string; op: string; deger: string; sayi: number }[];
  ulasim: { toplam: number; onayli: number; uygulama: number; push: number; eposta: number; sinirda: number };
}
interface Kayitli {
  id: string;
  ad: string;
  kurallar: SegmentRule[];
  ozet: string;
  sayi: number | null;
  sayildi: string | null;
  kim: string;
}

const kart: CSSProperties = { background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 18 };
const kucuk: CSSProperties = {
  border: '1px solid #D5DAE5',
  borderRadius: 8,
  padding: '5px 8px',
  fontSize: 13,
  background: '#FFFFFF',
  fontFamily: 'inherit',
};
const cip = (on: boolean): CSSProperties => ({
  border: `1px solid ${on ? '#5B8CFF' : '#D5DAE5'}`,
  background: on ? '#EEF3FF' : '#FFFFFF',
  borderRadius: 999,
  padding: '4px 10px',
  fontSize: 12.5,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
});
const sayi = (n: number) => new Intl.NumberFormat('tr-TR').format(n);

/** Yeni kuralın başlangıç değeri */
const BASLANGIC: Record<SegmentField, SegmentRule> = {
  rol: { alan: 'rol', deger: 'bireysel' },
  aktif_talep: { alan: 'aktif_talep', deger: 'evet' },
  son_giris: { alan: 'son_giris', yon: 'icinde', gun: 14 },
  il: { alan: 'il', deger: ['İstanbul'] },
  kategori: { alan: 'kategori', deger: ['otomobil'] },
  odeme: { alan: 'odeme', deger: 'hic' },
  platform: { alan: 'platform', deger: ['IOS', 'ANDROID'] },
  acik_sohbet: { alan: 'acik_sohbet', deger: 'hayir' },
  paket: { alan: 'paket', deger: ['deneme'] },
};

/**
 * Segmentler (YonetimKampanya.dc.html › segment; Karar 51). Kurallar "ve" ile birleşir; her kuraldan sonra kişi sayısı,
 * sağda kanal ulaşımı (ticari onay, kampanya bildirimi izni, push cihazı, doğrulanmış e-posta) anında hesaplanır. Ticari
 * ileti onayı kuralı her zaman uygulanır. Kayıtlı segmentler her gönderimde yeniden hesaplanır.
 */
export default function Segmentler() {
  const [ad, setAd] = useState('');
  const [kurallar, setKurallar] = useState<SegmentRule[]>([BASLANGIC.rol]);
  const [o, setO] = useState<Onizleme | null>(null);
  const [kayitli, setKayitli] = useState<Kayitli[]>([]);
  const [duzenlenen, setDuzenlenen] = useState<string | null>(null);
  const [kategoriler, setKategoriler] = useState<{ slug: string; ad: string }[]>([]);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    yonetim<Kayitli[]>('segments')
      .then(setKayitli)
      .catch((e: Error) => setHata(e.message));
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/categories`)
      .then((r) => r.json() as Promise<{ slug: string; name: string }[]>)
      .then((c) => setKategoriler(c.map((x) => ({ slug: x.slug, ad: x.name }))))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      yonetim<Onizleme>('segments/preview', { method: 'POST', body: { kurallar } })
        .then((x) => {
          setO(x);
          setHata(null);
        })
        .catch((e: Error) => setHata(e.message));
    }, 350);
    return () => clearTimeout(t);
  }, [kurallar]);

  const degistir = (i: number, r: SegmentRule) => setKurallar(kurallar.map((x, j) => (j === i ? r : x)));
  const listeDegistir = <T extends string>(liste: T[], v: T) =>
    liste.includes(v) ? (liste.length > 1 ? liste.filter((x) => x !== v) : liste) : [...liste, v];

  async function kaydet() {
    try {
      const l = await yonetim<Kayitli[]>(duzenlenen ? `segments/${duzenlenen}` : 'segments', {
        method: duzenlenen ? 'PUT' : 'POST',
        body: { ad, kurallar },
      });
      setKayitli(l);
      setBilgi('Segment kaydedildi. Kampanyalarda seçilebilir; her gönderimde yeniden hesaplanır.');
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  function editor(r: SegmentRule, i: number) {
    switch (r.alan) {
      case 'rol':
        return (
          <select
            value={r.deger}
            onChange={(e) => degistir(i, { ...r, deger: e.target.value as typeof r.deger })}
            style={kucuk}
          >
            {SEGMENT_ROLES.map((x) => (
              <option key={x.key} value={x.key}>
                {x.ad}
              </option>
            ))}
          </select>
        );
      case 'aktif_talep':
      case 'acik_sohbet':
        return (
          <select
            value={r.deger}
            onChange={(e) => degistir(i, { ...r, deger: e.target.value as 'evet' | 'hayir' })}
            style={kucuk}
          >
            <option value="evet">Evet</option>
            <option value="hayir">Hayır</option>
          </select>
        );
      case 'odeme':
        return (
          <select
            value={r.deger}
            onChange={(e) => degistir(i, { ...r, deger: e.target.value as 'hic' | 'var' })}
            style={kucuk}
          >
            <option value="hic">Hiç ödemedi</option>
            <option value="var">En az bir kez ödedi</option>
          </select>
        );
      case 'son_giris':
        return (
          <span style={{ display: 'flex', gap: 6 }}>
            <select
              value={r.yon}
              onChange={(e) => degistir(i, { ...r, yon: e.target.value as 'icinde' | 'once' })}
              style={kucuk}
            >
              <option value="icinde">son … gün içinde</option>
              <option value="once">en az … gündür yok</option>
            </select>
            <select
              value={r.gun}
              onChange={(e) => degistir(i, { ...r, gun: Number(e.target.value) })}
              style={kucuk}
            >
              {[7, 14, 30, 60, 90, 180].map((g) => (
                <option key={g} value={g}>
                  {g} gün
                </option>
              ))}
            </select>
          </span>
        );
      case 'il':
        return (
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {r.deger.map((il) => (
              <button
                key={il}
                type="button"
                onClick={() => degistir(i, { ...r, deger: listeDegistir(r.deger, il) })}
                style={cip(true)}
                title="Çıkar"
              >
                {il} ×
              </button>
            ))}
            <select
              value=""
              onChange={(e) =>
                e.target.value && degistir(i, { ...r, deger: [...new Set([...r.deger, e.target.value])] })
              }
              style={kucuk}
            >
              <option value="">+ il ekle</option>
              {ILLER.filter((x) => !r.deger.includes(x.ad)).map((x) => (
                <option key={x.plaka} value={x.ad}>
                  {x.ad}
                </option>
              ))}
            </select>
          </span>
        );
      case 'kategori':
        return (
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {kategoriler.map((k) => (
              <button
                key={k.slug}
                type="button"
                onClick={() => degistir(i, { ...r, deger: listeDegistir(r.deger, k.slug) })}
                style={cip(r.deger.includes(k.slug))}
              >
                {k.ad}
              </button>
            ))}
          </span>
        );
      case 'platform':
        return (
          <span style={{ display: 'flex', gap: 6 }}>
            {SEGMENT_PLATFORMS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => degistir(i, { ...r, deger: listeDegistir(r.deger, p.key) })}
                style={cip(r.deger.includes(p.key))}
              >
                {p.ad}
              </button>
            ))}
          </span>
        );
      default:
        return (
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {SEGMENT_PLANS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => degistir(i, { ...r, deger: listeDegistir(r.deger, p.key) })}
                style={cip(r.deger.includes(p.key))}
              >
                {p.ad}
              </button>
            ))}
          </span>
        );
    }
  }

  const eklenebilir = (Object.keys(SEGMENT_FIELDS) as SegmentField[]).filter(
    (f) => !kurallar.some((r) => r.alan === f),
  );
  const u = o?.ulasim;
  const kanal = u
    ? [
        { ad: 'Push', sayi: u.push, not: 'Bildirim izni açık cihazı ve ticari onayı olan' },
        {
          ad: 'E-posta',
          sayi: u.eposta,
          not: 'Ticari onaylı, e-postası doğrulanmış ve kampanya e-postasına izinli',
        },
        { ad: 'SMS', sayi: 0, not: 'Kampanya SMS’i kapalı (Karar 49)' },
        { ad: 'Uygulama içi', sayi: u.uygulama, not: 'Ticari onaylı ve kampanya bildirimine izin veren' },
      ]
    : [];

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Segmentler</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#5A6073' }}>
          Kurallar “ve” ile birleşir. Kişi sayısı anında hesaplanır; kayıtlı segmentler her gönderimde yeniden
          hesaplanır.
        </p>
      </div>
      {bilgi ? (
        <div
          role="status"
          style={{
            background: '#F3EFFF',
            color: '#4B2FA6',
            borderRadius: 12,
            padding: '10px 14px',
            fontWeight: 700,
            marginBottom: 12,
          }}
        >
          {bilgi}
        </div>
      ) : null}
      {hata ? <p style={{ color: '#A3271F', fontWeight: 700 }}>{hata}</p> : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <section aria-labelledby="kural" style={{ ...kart, flex: '999 1 480px', minWidth: 0, padding: 18 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>
            Segment adı
            <input
              value={ad}
              onChange={(e) => setAd(e.target.value)}
              placeholder="Örn. Aktif talebi olan bireyseller · son 14 gün"
              style={{
                display: 'block',
                width: '100%',
                boxSizing: 'border-box',
                marginTop: 5,
                border: '1px solid #D5DAE5',
                borderRadius: 10,
                padding: 10,
                fontSize: 14,
                fontFamily: 'inherit',
              }}
            />
          </label>
          <h2 id="kural" style={{ margin: '16px 0 10px', fontSize: 15, fontWeight: 800 }}>
            Kurallar
          </h2>
          {kurallar.map((r, i) => (
            <div
              key={r.alan}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 8,
                border: '1px solid #E3E6EF',
                borderRadius: 12,
                padding: '9px 12px',
                marginBottom: 8,
              }}
            >
              <span style={{ flex: '0 0 150px', fontSize: 13.5, fontWeight: 800 }}>
                {SEGMENT_FIELDS[r.alan]}
              </span>
              <span style={{ flex: '1 1 220px', minWidth: 0 }}>{editor(r, i)}</span>
              <span style={{ flex: 'none', fontSize: 12.5, color: '#5A6073' }}>
                {o?.adimlar[i] ? `→ ${sayi(o.adimlar[i].sayi)} kişi` : ''}
              </span>
              {kurallar.length > 1 ? (
                <button
                  type="button"
                  aria-label="Kuralı kaldır"
                  onClick={() => setKurallar(kurallar.filter((_, j) => j !== i))}
                  style={{
                    flex: 'none',
                    border: 0,
                    background: 'transparent',
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: '#A3271F',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Kaldır
                </button>
              ) : null}
            </div>
          ))}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 8,
              border: '1px solid #E3E6EF',
              borderRadius: 12,
              padding: '9px 12px',
              marginBottom: 8,
              background: '#F6F8FD',
              fontSize: 13.5,
            }}
          >
            <span style={{ flex: '0 0 150px', fontWeight: 800 }}>Ticari ileti onayı</span>
            <span style={{ flex: '1 1 220px', color: '#3A4052' }}>kanala göre · İYS’de onaylı</span>
            <span style={{ flex: 'none', fontSize: 12.5, color: '#5A6073' }}>gönderimde uygulanır</span>
            <span
              style={{
                flex: 'none',
                fontSize: 11.5,
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 999,
                background: '#F3F5FA',
                color: '#5A6073',
              }}
            >
              Otomatik
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {eklenebilir.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setKurallar([...kurallar, BASLANGIC[f]])}
                style={{
                  border: '1px dashed #AEB5C4',
                  background: '#FFFFFF',
                  borderRadius: 999,
                  padding: '6px 11px',
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: '#1E2333',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                + {SEGMENT_FIELDS[f]}
              </button>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="sayi"
          style={{ ...kart, flex: '1 1 280px', maxWidth: 360, minWidth: 0, overflow: 'hidden' }}
        >
          <div style={{ padding: '16px 18px', borderBottom: '1px solid #EEF0F5' }}>
            <h2 id="sayi" style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#5A6073' }}>
              Segmentteki kişi
            </h2>
            <div style={{ fontSize: 30, fontWeight: 800 }}>{u ? sayi(u.toplam) : '—'}</div>
            {u ? (
              <div style={{ fontSize: 12, color: '#5A6073' }}>
                {sayi(u.onayli)} kişinin ticari ileti onayı var
                {u.sinirda ? ` · ${sayi(u.sinirda)} kişi bu hafta sınırda` : ''}
              </div>
            ) : null}
          </div>
          {kanal.map((k) => (
            <div key={k.ad} style={{ padding: '10px 18px', borderBottom: '1px solid #EEF0F5' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ fontWeight: 700 }}>{k.ad}</span>
                <span style={{ fontWeight: 800 }}>{sayi(k.sayi)}</span>
              </div>
              <div style={{ height: 6, background: '#EEF0F5', borderRadius: '0 4px 4px 0', marginTop: 5 }}>
                <div
                  style={{
                    height: 6,
                    width: `${u?.toplam ? (k.sayi / u.toplam) * 100 : 0}%`,
                    background: '#5B8CFF',
                    borderRadius: '0 4px 4px 0',
                  }}
                />
              </div>
              <div style={{ fontSize: 11.5, color: '#5A6073', marginTop: 3 }}>{k.not}</div>
            </div>
          ))}
          <div style={{ padding: '14px 18px' }}>
            <button
              type="button"
              disabled={ad.trim().length < 3}
              onClick={kaydet}
              style={{
                width: '100%',
                border: 0,
                background: '#5B8CFF',
                borderRadius: 12,
                padding: 12,
                fontSize: 14.5,
                fontWeight: 800,
                color: '#1E2333',
                cursor: 'pointer',
                opacity: ad.trim().length < 3 ? 0.5 : 1,
                fontFamily: 'inherit',
              }}
            >
              {ad.trim().length < 3
                ? 'Segmente ad ver'
                : duzenlenen
                  ? 'Değişikliği kaydet'
                  : 'Segmenti kaydet'}
            </button>
          </div>
        </section>
      </div>

      <section aria-labelledby="kayitli" style={{ ...kart, marginTop: 16, overflow: 'hidden' }}>
        <h2
          id="kayitli"
          style={{
            margin: 0,
            padding: '16px 18px',
            fontSize: 17,
            fontWeight: 800,
            borderBottom: '1px solid #EEF0F5',
          }}
        >
          Kayıtlı segmentler
        </h2>
        {kayitli.length ? null : (
          <p style={{ margin: 0, padding: '12px 18px', fontSize: 13.5, color: '#5A6073' }}>
            Henüz kayıtlı segment yok.
          </p>
        )}
        {kayitli.map((s) => (
          <div
            key={s.id}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '6px 16px',
              padding: '12px 18px',
              borderBottom: '1px solid #EEF0F5',
              fontSize: 13.5,
            }}
          >
            <span style={{ flex: '999 1 280px', minWidth: 0 }}>
              <button
                type="button"
                onClick={() => {
                  setDuzenlenen(s.id);
                  setAd(s.ad);
                  setKurallar(s.kurallar);
                  setBilgi(null);
                }}
                style={{
                  display: 'block',
                  border: 0,
                  background: 'transparent',
                  padding: 0,
                  fontSize: 14,
                  fontWeight: 800,
                  color: '#1E2333',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                }}
              >
                {s.ad}
              </button>
              <span style={{ display: 'block', fontSize: 12.5, color: '#5A6073', marginTop: 2 }}>
                {s.ozet}
              </span>
            </span>
            <span style={{ flex: '0 0 110px', fontWeight: 800, textAlign: 'right' }}>
              {s.sayi === null ? '—' : `${sayi(s.sayi)} kişi`}
            </span>
            <span style={{ flex: '0 0 170px', color: '#5A6073' }}>{s.kim}</span>
          </div>
        ))}
      </section>
    </>
  );
}
