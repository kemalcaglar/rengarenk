'use client';

import {
  CAMPAIGN_CHANNELS,
  CAMPAIGN_GOALS,
  type CampaignChannel,
  COUPON_AUDIENCES,
  COUPON_MAX_PERCENT,
  COUPON_TARGET_KEYS,
  COUPON_TARGETS,
  type CouponAudience,
  type CouponTarget,
} from '@rengarenk/shared';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { cx } from '../../../lib/cx';
import { yonetim } from '../../../lib/istemci';
import stil from './page.module.css';

interface Satir {
  id: string;
  ad: string;
  hedef: string;
  kanal: string;
  kitle: string;
  sonuc: string;
  durum: string;
  durumAd: string;
  bg: string;
  fg: string;
  iptalEdilebilir: boolean;
}
interface Kupon {
  id: string;
  kod: string;
  ad: string;
  yuzde: number;
  ozet: string;
  tarih: string;
  kullanim: string;
  durumKey: string;
  durum: string;
  bg: string;
  fg: string;
  secilebilir: boolean;
}
interface Segment {
  id: string;
  ad: string;
  sayi: number | null;
}
interface Tahmin {
  segment: string;
  toplam: number;
  satirlar: { ad: string; not: string; deger: number }[];
  maliyet: number;
  ulasilan: number;
  onayGerek: boolean;
}

const sayi = (n: number) => new Intl.NumberFormat('tr-TR').format(n);
/** Yarın 10.00 (Türkiye) — datetime-local değeri */
const varsayilanZaman = () => {
  const d = new Date(Date.now() + 86_400_000);
  const g = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(d);
  return `${g}T10:00`;
};

/**
 * Kampanyalar (YonetimKampanya.dc.html › kampanya; Karar 49, 51). Ticari ileti: yalnızca ticari ileti onayı ve kampanya
 * bildirimi izni olanlara; kişi başı haftada 2; 21.00–09.00 sabaha ertelenir. Gönderim özeti segmenti, kanal ulaşımını,
 * sıklık sınırına takılanları ve ısınmayı gösterir. 1.000 kişiyi aşan gönderim onay kuyruğuna gider. İçerik kampanyaya
 * özeldir (tasarımdaki tek şablon seçimi yerine başlık, metin ve düğme). Kupon bağlanabilir: kupon onaylanmadan kampanya
 * gönderilmez. Kuponlar bu sayfada hazırlanır; sahip ya da yönetici onaylar (%50 üstünü yalnızca sahip).
 */
export default function Kampanyalar() {
  const [liste, setListe] = useState<Satir[]>([]);
  const [segmentler, setSegmentler] = useState<Segment[]>([]);
  const [ad, setAd] = useState('');
  const [hedef, setHedef] = useState<string>('ust_sira');
  const [segmentId, setSegmentId] = useState('');
  const [kanallar, setKanallar] = useState<CampaignChannel[]>(['uygulama']);
  const [baslik, setBaslik] = useState('');
  const [metin, setMetin] = useState('');
  const [dugme, setDugme] = useState('');
  const [url, setUrl] = useState('/');
  const [zaman, setZaman] = useState(varsayilanZaman);
  const [tahmin, setTahmin] = useState<Tahmin | null>(null);
  const [kuponlar, setKuponlar] = useState<Kupon[]>([]);
  const [kuponId, setKuponId] = useState('');
  const [ab, setAb] = useState<{ baslik: string; metin: string; dugme: string } | null>(null);
  const [kuponForm, setKuponForm] = useState(false);
  const [yk, setYk] = useState({
    kod: '',
    ad: '',
    yuzde: 20,
    hedefler: ['ust_sira'] as CouponTarget[],
    kitle: 'herkes' as CouponAudience,
    bas: new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date()),
    bit: new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(
      new Date(Date.now() + 7 * 86_400_000),
    ),
    sinir: '',
  });
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    try {
      const [l, s, k] = await Promise.all([
        yonetim<Satir[]>('campaigns'),
        yonetim<Segment[]>('segments'),
        yonetim<Kupon[]>('coupons'),
      ]);
      setListe(l);
      setSegmentler(s);
      setKuponlar(k);
      setSegmentId((x) => x || s[0]?.id || '');
    } catch (e) {
      setHata((e as Error).message);
    }
  }, []);
  useEffect(() => {
    yukle();
  }, [yukle]);
  useEffect(() => {
    if (!segmentId || !kanallar.length) return setTahmin(null);
    yonetim<Tahmin>('campaigns/estimate', { method: 'POST', body: { segmentId, kanallar } })
      .then(setTahmin)
      .catch((e: Error) => setHata(e.message));
  }, [segmentId, kanallar]);

  async function gonder() {
    setHata(null);
    try {
      const l = await yonetim<Satir[]>('campaigns', {
        method: 'POST',
        body: {
          ad,
          hedef,
          segmentId,
          kanallar,
          baslik,
          metin,
          dugme,
          url,
          zaman: new Date(`${zaman}:00+03:00`).toISOString(),
          kuponId: kuponId || null,
          b: ab,
        },
      });
      setListe(l);
      const ilk = l[0];
      setBilgi(
        ilk?.durum === 'onay_bekliyor'
          ? 'Kampanya onay kuyruğuna gönderildi. Onaylanınca zamanında gider; sonucu listeye ve kontrol paneli grafiğine kendiliğinden düşer.'
          : 'Kampanya zamanlandı. Zamanında gider; sonucu listeye ve kontrol paneli grafiğine kendiliğinden düşer.',
      );
      setAb(null);
      setAd('');
      setBaslik('');
      setMetin('');
      setDugme('');
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function iptal(id: string) {
    try {
      setListe(await yonetim<Satir[]>(`campaigns/${id}/cancel`, { method: 'POST', body: {} }));
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  async function kuponHazirla() {
    setHata(null);
    try {
      setKuponlar(
        await yonetim<Kupon[]>('coupons', {
          method: 'POST',
          body: {
            kod: yk.kod,
            ad: yk.ad,
            yuzde: yk.yuzde,
            hedefler: yk.hedefler,
            kitle: yk.kitle,
            baslangic: new Date(`${yk.bas}T00:00:00+03:00`).toISOString(),
            // Bitiş günü dahil
            bitis: new Date(new Date(`${yk.bit}T00:00:00+03:00`).getTime() + 86_400_000).toISOString(),
            toplamSinir: yk.sinir ? Number(yk.sinir) : null,
          },
        }),
      );
      setKuponForm(false);
      setBilgi(
        yk.yuzde > COUPON_MAX_PERCENT
          ? `Kupon onay kuyruğuna gitti. %${COUPON_MAX_PERCENT} üstü indirimi yalnızca sahip onaylar.`
          : 'Kupon onay kuyruğuna gitti. Sahip ya da yönetici onaylayınca geçerli olur.',
      );
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function kuponIptal(id: string) {
    try {
      setKuponlar(await yonetim<Kupon[]>(`coupons/${id}/cancel`, { method: 'POST', body: {} }));
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  const hazir =
    ad.trim().length >= 3 &&
    baslik.trim().length >= 3 &&
    metin.trim().length >= 10 &&
    dugme.trim().length >= 2;

  return (
    <>
      <div className={stil.kutu1}>
        <h1 className={stil.baslik1}>Kampanyalar</h1>
        <p className={stil.metin1}>
          Ticari iletiler yalnızca İYS onayı olanlara gider · kişi başı haftada en fazla 2 · 21.00–09.00 arası
          gönderilmez
        </p>
      </div>
      {bilgi ? (
        <div role="status" className={stil.kutu2}>
          {bilgi}
        </div>
      ) : null}
      {hata ? <p className={stil.metin2}>{hata}</p> : null}

      <section aria-labelledby="liste" className={stil.kutu3}>
        <h2 id="liste" className={stil.baslik2}>
          Son kampanyalar
        </h2>
        {liste.length ? null : <p className={stil.metin3}>Henüz kampanya yok.</p>}
        {liste.map((k) => (
          <div key={k.id} className={stil.kutu4}>
            <span className={stil.metin4}>
              <span className={stil.metin5}>{k.ad}</span>
              <span className={stil.metin6}>
                {k.kanal} · {k.kitle}
              </span>
            </span>
            <span className={stil.metin7}>{k.sonuc}</span>
            {k.iptalEdilebilir ? (
              <button type="button" onClick={() => iptal(k.id)} className={stil.dugme1}>
                İptal et
              </button>
            ) : null}
            <span className={stil.metin8} style={{ background: k.bg, color: k.fg }}>
              {k.durumAd}
            </span>
          </div>
        ))}
      </section>

      <div className={stil.kutu5}>
        <section aria-labelledby="yeni" className={stil.kutu6}>
          <h2 id="yeni" className={stil.baslik3}>
            Yeni kampanya
          </h2>
          {segmentler.length ? null : (
            <p className={stil.metin9}>
              Önce bir segment kaydet: <Link href="/segmentler">Segmentler</Link>
            </p>
          )}
          <div className={stil.kutu7}>
            <label className={stil.etiket1}>
              Kampanya adı
              <input
                value={ad}
                onChange={(e) => setAd(e.target.value)}
                maxLength={100}
                className={stil.girdi1}
              />
            </label>
            <label className={stil.etiket2}>
              Hedef
              <select value={hedef} onChange={(e) => setHedef(e.target.value)} className={stil.girdi1}>
                {CAMPAIGN_GOALS.map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.ad}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className={stil.kutu8}>
            <label className={stil.etiket1}>
              Segment
              <select
                value={segmentId}
                onChange={(e) => setSegmentId(e.target.value)}
                className={stil.girdi1}
              >
                {segmentler.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.ad}
                    {s.sayi !== null ? ` · ${sayi(s.sayi)} kişi` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className={stil.etiket3}>
              Bağlantı
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="/haklarim"
                className={stil.girdi1}
              />
            </label>
          </div>
          <div className={stil.kutu8}>
            <label className={stil.etiket1}>
              Başlık
              <input
                value={baslik}
                onChange={(e) => setBaslik(e.target.value)}
                maxLength={80}
                className={stil.girdi1}
              />
            </label>
            <label className={stil.etiket4}>
              Düğme
              <input
                value={dugme}
                onChange={(e) => setDugme(e.target.value)}
                maxLength={30}
                className={stil.girdi1}
              />
            </label>
          </div>
          <label className={stil.etiket5}>
            Metin
            <textarea
              value={metin}
              onChange={(e) => setMetin(e.target.value)}
              rows={3}
              maxLength={400}
              className={stil.girdi2}
            />
          </label>
          <div className={stil.kutu9}>Kanallar</div>
          <div className={stil.kutu10}>
            {CAMPAIGN_CHANNELS.map((k) => {
              if (!k.acik)
                return (
                  <span key={k.key} className={stil.metin10}>
                    {k.ad} · kapalı (Karar 49)
                  </span>
                );
              const on = kanallar.includes(k.key as CampaignChannel);
              return (
                // biome-ignore lint/a11y/useSemanticElements: tasarımdaki kutucuklu kanal düğmesi (YonetimKampanya.dc.html)
                <button
                  key={k.key}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() =>
                    setKanallar(
                      on ? kanallar.filter((x) => x !== k.key) : [...kanallar, k.key as CampaignChannel],
                    )
                  }
                  className={cx(stil.dugme2, on ? stil.dugme3 : stil.dugme4)}
                  style={{ border: `1.5px solid ${on ? '#5B8CFF' : '#D5DAE5'}` }}
                >
                  <span
                    className={cx(stil.metin11, on ? stil.metin12 : stil.dugme4)}
                    style={{ border: `2px solid ${on ? '#5B8CFF' : '#D5DAE5'}` }}
                  >
                    {on ? '✓' : ''}
                  </span>
                  {k.ad}
                </button>
              );
            })}
          </div>
          <div className={stil.kutu11}>
            <label className={stil.etiket6}>
              Gönderim zamanı
              <input
                type="datetime-local"
                value={zaman}
                onChange={(e) => setZaman(e.target.value)}
                className={stil.girdi1}
              />
            </label>
            <label className={stil.etiket6}>
              Kupon
              <select value={kuponId} onChange={(e) => setKuponId(e.target.value)} className={stil.girdi1}>
                <option value="">Kupon yok</option>
                {kuponlar
                  .filter((k) => k.secilebilir)
                  .map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.kod} · {k.ad} %{k.yuzde} ({k.durum.toLocaleLowerCase('tr-TR')})
                    </option>
                  ))}
              </select>
            </label>
            <label className={stil.etiket7}>
              <input
                type="checkbox"
                checked={Boolean(ab)}
                onChange={(e) => setAb(e.target.checked ? { baslik, metin, dugme } : null)}
                className={stil.girdi3}
              />
              A/B testi
            </label>
          </div>
          {ab ? (
            <div className={stil.kutu12}>
              <label className={stil.etiket8}>
                B · Başlık
                <input
                  value={ab.baslik}
                  maxLength={80}
                  onChange={(e) => setAb({ ...ab, baslik: e.target.value })}
                  className={stil.girdi1}
                />
              </label>
              <label className={stil.etiket4}>
                B · Düğme
                <input
                  value={ab.dugme}
                  maxLength={30}
                  onChange={(e) => setAb({ ...ab, dugme: e.target.value })}
                  className={stil.girdi1}
                />
              </label>
              <label className={stil.etiket9}>
                B · Metin
                <textarea
                  value={ab.metin}
                  maxLength={400}
                  rows={2}
                  onChange={(e) => setAb({ ...ab, metin: e.target.value })}
                  className={stil.girdi2}
                />
              </label>
              <p className={stil.metin13}>
                Segment yarı yarıya ayrılır (kişi hep aynı sürümü alır); ölçü bildirimi uygulamada açma oranı.
                Sonuç Raporlar › Deneyler’de.
              </p>
            </div>
          ) : null}
        </section>

        <section aria-labelledby="ozet" className={stil.kutu13}>
          <h2 id="ozet" className={stil.baslik2}>
            Gönderim özeti
          </h2>
          <div className={stil.kutu14}>
            <div className={stil.kutu15}>Segmentteki kişi</div>
            <div className={stil.kutu16}>{tahmin ? sayi(tahmin.toplam) : '—'}</div>
          </div>
          {tahmin?.satirlar.map((s) => (
            <div key={s.ad} className={stil.kutu17}>
              <span className={stil.metin14}>
                <span className={stil.metin15}>{s.ad}</span>
                <span className={stil.metin16}>{s.not}</span>
              </span>
              <span
                className={stil.metin17}
                style={{ color: s.deger < 0 || s.ad.startsWith('Isınma') ? '#7A5300' : '#1E2333' }}
              >
                {s.deger < 0 ? `−${sayi(-s.deger)}` : sayi(s.deger)}
              </span>
            </div>
          ))}
          {tahmin ? (
            <div className={stil.kutu17}>
              <span>
                <span className={stil.metin15}>Tahmini maliyet</span>
                <span className={stil.metin16}>Push ve e-posta kendi altyapımızdan</span>
              </span>
              <span className={stil.metin18}>₺0</span>
            </div>
          ) : null}
          <div className={stil.kutu18}>
            {tahmin?.onayGerek ? (
              <p className={stil.metin19}>1.000 kişiyi aştığı için sahip veya yönetici onayı gerekir.</p>
            ) : null}
            <button
              type="button"
              disabled={!kanallar.length || !hazir || !segmentId}
              onClick={gonder}
              className={cx(
                stil.dugme5,
                !kanallar.length || !hazir || !segmentId ? stil.dugme6 : stil.dugme7,
              )}
            >
              {!kanallar.length
                ? 'En az bir kanal seç'
                : !hazir
                  ? 'Ad, başlık, metin ve düğmeyi yaz'
                  : tahmin?.onayGerek
                    ? 'Onaya gönder'
                    : 'Zamanla'}
            </button>
            {tahmin ? (
              <p className={stil.metin20}>
                <strong>Ajan:</strong> bu kampanya {sayi(tahmin.ulasilan)} kişiye ulaşır.{' '}
                {tahmin.toplam - tahmin.ulasilan > 0
                  ? `${sayi(tahmin.toplam - tahmin.ulasilan)} kişi ticari ileti onayı, kampanya bildirimi izni ya da haftalık sınır nedeniyle almayacak.`
                  : ''}
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <section aria-labelledby="kuponlar" className={stil.kutu19}>
        <div className={stil.kutu20}>
          <div>
            <h2 id="kuponlar" className={stil.baslik4}>
              Kuponlar
            </h2>
            <p className={stil.metin21}>
              Web ödemesinde kodla, hesap başına bir kez · onay sahip ya da yönetici · %{COUPON_MAX_PERCENT}{' '}
              üstü yalnızca sahip · uygulama içi satın almada geçmez
            </p>
          </div>
          <button
            type="button"
            onClick={() => setKuponForm((x) => !x)}
            aria-expanded={kuponForm}
            className={stil.dugme8}
          >
            Yeni kupon
          </button>
        </div>
        {kuponForm ? (
          <div className={stil.kutu21}>
            <div className={stil.kutu22}>
              <label className={stil.etiket10}>
                Kod
                <input
                  value={yk.kod}
                  maxLength={16}
                  placeholder="UST20"
                  onChange={(e) => setYk({ ...yk, kod: e.target.value.toLocaleUpperCase('tr-TR') })}
                  className={stil.girdi1}
                />
              </label>
              <label className={stil.etiket3}>
                Ad
                <input
                  value={yk.ad}
                  maxLength={60}
                  placeholder="Hafta sonu üst sıra"
                  onChange={(e) => setYk({ ...yk, ad: e.target.value })}
                  className={stil.girdi1}
                />
              </label>
              <label className={stil.etiket11}>
                İndirim %
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={yk.yuzde}
                  onChange={(e) => setYk({ ...yk, yuzde: Number(e.target.value) })}
                  className={stil.girdi1}
                />
              </label>
              <label className={stil.etiket12}>
                Kitle
                <select
                  value={yk.kitle}
                  onChange={(e) => setYk({ ...yk, kitle: e.target.value as CouponAudience })}
                  className={stil.girdi1}
                >
                  {(Object.keys(COUPON_AUDIENCES) as CouponAudience[]).map((k) => (
                    <option key={k} value={k}>
                      {COUPON_AUDIENCES[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className={stil.etiket12}>
                Başlangıç
                <input
                  type="date"
                  value={yk.bas}
                  onChange={(e) => setYk({ ...yk, bas: e.target.value })}
                  className={stil.girdi1}
                />
              </label>
              <label className={stil.etiket12}>
                Bitiş (dahil)
                <input
                  type="date"
                  value={yk.bit}
                  onChange={(e) => setYk({ ...yk, bit: e.target.value })}
                  className={stil.girdi1}
                />
              </label>
              <label className={stil.etiket13}>
                Toplam sınır
                <input
                  type="number"
                  min={1}
                  value={yk.sinir}
                  placeholder="Sınırsız"
                  onChange={(e) => setYk({ ...yk, sinir: e.target.value })}
                  className={stil.girdi1}
                />
              </label>
            </div>
            <fieldset className={stil.kutu23}>
              <legend className={stil.baslik5}>Ürünler</legend>
              <div className={stil.kutu24}>
                {COUPON_TARGET_KEYS.map((t) => (
                  <label key={t} className={stil.etiket14}>
                    <input
                      type="checkbox"
                      checked={yk.hedefler.includes(t)}
                      onChange={() =>
                        setYk({
                          ...yk,
                          hedefler: yk.hedefler.includes(t)
                            ? yk.hedefler.filter((x) => x !== t)
                            : [...yk.hedefler, t],
                        })
                      }
                    />
                    {COUPON_TARGETS[t].ad}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className={stil.kutu25}>
              <button
                type="button"
                onClick={kuponHazirla}
                disabled={yk.kod.length < 4 || yk.ad.trim().length < 3 || !yk.hedefler.length}
                className={stil.dugme9}
                style={{
                  opacity: yk.kod.length < 4 || yk.ad.trim().length < 3 || !yk.hedefler.length ? 0.5 : 1,
                }}
              >
                Onaya gönder
              </button>
              {yk.yuzde > COUPON_MAX_PERCENT ? (
                <span className={stil.metin22}>
                  %{COUPON_MAX_PERCENT} üstü indirimi yalnızca sahip onaylar.
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
        {kuponlar.length === 0 ? (
          <p className={stil.metin23}>Henüz kupon yok.</p>
        ) : (
          kuponlar.map((k) => (
            <div key={k.id} className={stil.kutu26}>
              <span className={stil.metin24}>{k.kod}</span>
              <span className={stil.metin25}>
                <span className={stil.metin26}>{k.ad}</span>
                <span className={stil.metin27}>
                  {k.ozet} · {k.tarih}
                </span>
              </span>
              <span className={stil.metin28}>{k.kullanim}</span>
              {k.secilebilir ? (
                <button type="button" onClick={() => kuponIptal(k.id)} className={stil.dugme10}>
                  İptal et
                </button>
              ) : null}
              <span className={stil.metin8} style={{ background: k.bg, color: k.fg }}>
                {k.durum}
              </span>
            </div>
          ))
        )}
      </section>
    </>
  );
}
