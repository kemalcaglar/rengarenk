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
import stil from './page.module.css';

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
            className={stil.girdi1}
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
            className={stil.girdi1}
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
            className={stil.girdi1}
          >
            <option value="hic">Hiç ödemedi</option>
            <option value="var">En az bir kez ödedi</option>
          </select>
        );
      case 'son_giris':
        return (
          <span className={stil.metin1}>
            <select
              value={r.yon}
              onChange={(e) => degistir(i, { ...r, yon: e.target.value as 'icinde' | 'once' })}
              className={stil.girdi1}
            >
              <option value="icinde">son … gün içinde</option>
              <option value="once">en az … gündür yok</option>
            </select>
            <select
              value={r.gun}
              onChange={(e) => degistir(i, { ...r, gun: Number(e.target.value) })}
              className={stil.girdi1}
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
          <span className={stil.metin2}>
            {r.deger.map((il) => (
              <button
                key={il}
                type="button"
                onClick={() => degistir(i, { ...r, deger: listeDegistir(r.deger, il) })}
                className={stil.dugme1}
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
              className={stil.girdi1}
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
          <span className={stil.metin3}>
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
          <span className={stil.metin1}>
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
          <span className={stil.metin3}>
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
        { ad: 'Uygulama içi', sayi: u.uygulama, not: 'Ticari onaylı ve kampanya bildirimine izin veren' },
      ]
    : [];

  return (
    <>
      <div className={stil.kutu1}>
        <h1 className={stil.baslik1}>Segmentler</h1>
        <p className={stil.metin4}>
          Kurallar “ve” ile birleşir. Kişi sayısı anında hesaplanır; kayıtlı segmentler her gönderimde yeniden
          hesaplanır.
        </p>
      </div>
      {bilgi ? (
        <div role="status" className={stil.kutu2}>
          {bilgi}
        </div>
      ) : null}
      {hata ? <p className={stil.metin5}>{hata}</p> : null}

      <div className={stil.kutu3}>
        <section aria-labelledby="kural" className={stil.kutu4}>
          <label className={stil.etiket1}>
            Segment adı
            <input
              value={ad}
              onChange={(e) => setAd(e.target.value)}
              placeholder="Örn. Aktif talebi olan bireyseller · son 14 gün"
              className={stil.girdi2}
            />
          </label>
          <h2 id="kural" className={stil.baslik2}>
            Kurallar
          </h2>
          {kurallar.map((r, i) => (
            <div key={r.alan} className={stil.kutu5}>
              <span className={stil.metin6}>{SEGMENT_FIELDS[r.alan]}</span>
              <span className={stil.metin7}>{editor(r, i)}</span>
              <span className={stil.metin8}>{o?.adimlar[i] ? `→ ${sayi(o.adimlar[i].sayi)} kişi` : ''}</span>
              {kurallar.length > 1 ? (
                <button
                  type="button"
                  aria-label="Kuralı kaldır"
                  onClick={() => setKurallar(kurallar.filter((_, j) => j !== i))}
                  className={stil.dugme2}
                >
                  Kaldır
                </button>
              ) : null}
            </div>
          ))}
          <div className={stil.kutu6}>
            <span className={stil.metin9}>Ticari ileti onayı</span>
            <span className={stil.metin10}>kanala göre · İYS’de onaylı</span>
            <span className={stil.metin8}>gönderimde uygulanır</span>
            <span className={stil.metin11}>Otomatik</span>
          </div>
          <div className={stil.kutu7}>
            {eklenebilir.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setKurallar([...kurallar, BASLANGIC[f]])}
                className={stil.dugme3}
              >
                + {SEGMENT_FIELDS[f]}
              </button>
            ))}
          </div>
        </section>

        <section aria-labelledby="sayi" className={stil.kutu8}>
          <div className={stil.kutu9}>
            <h2 id="sayi" className={stil.baslik3}>
              Segmentteki kişi
            </h2>
            <div className={stil.kutu10}>{u ? sayi(u.toplam) : '—'}</div>
            {u ? (
              <div className={stil.kutu11}>
                {sayi(u.onayli)} kişinin ticari ileti onayı var
                {u.sinirda ? ` · ${sayi(u.sinirda)} kişi bu hafta sınırda` : ''}
              </div>
            ) : null}
          </div>
          {kanal.map((k) => (
            <div key={k.ad} className={stil.kutu12}>
              <div className={stil.kutu13}>
                <span className={stil.metin12}>{k.ad}</span>
                <span className={stil.metin13}>{sayi(k.sayi)}</span>
              </div>
              <div className={stil.kutu14}>
                <div
                  className={stil.kutu15}
                  style={{ width: `${u?.toplam ? (k.sayi / u.toplam) * 100 : 0}%` }}
                />
              </div>
              <div className={stil.kutu16}>{k.not}</div>
            </div>
          ))}
          <div className={stil.kutu17}>
            <button
              type="button"
              disabled={ad.trim().length < 3}
              onClick={kaydet}
              className={stil.dugme4}
              style={{ opacity: ad.trim().length < 3 ? 0.5 : 1 }}
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

      <section aria-labelledby="kayitli" className={stil.kutu18}>
        <h2 id="kayitli" className={stil.baslik4}>
          Kayıtlı segmentler
        </h2>
        {kayitli.length ? null : <p className={stil.metin14}>Henüz kayıtlı segment yok.</p>}
        {kayitli.map((s) => (
          <div key={s.id} className={stil.kutu19}>
            <span className={stil.metin15}>
              <button
                type="button"
                onClick={() => {
                  setDuzenlenen(s.id);
                  setAd(s.ad);
                  setKurallar(s.kurallar);
                  setBilgi(null);
                }}
                className={stil.dugme5}
              >
                {s.ad}
              </button>
              <span className={stil.metin16}>{s.ozet}</span>
            </span>
            <span className={stil.metin17}>{s.sayi === null ? '—' : `${sayi(s.sayi)} kişi`}</span>
            <span className={stil.metin18}>{s.kim}</span>
          </div>
        ))}
      </section>
    </>
  );
}
