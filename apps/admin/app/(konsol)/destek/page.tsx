'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { cx } from '../../../lib/cx';
import { yonetim } from '../../../lib/istemci';
import stil from './page.module.css';

interface Satir {
  id: string;
  no: string;
  kanal: string;
  konu: string;
  kim: string;
  etiket: string;
  durum: 'acik' | 'yanitlandi' | 'cozuldu';
  oncelikli: boolean;
  sonTarih: string | null;
}
interface Kuyruk {
  sayilar: { ad: string; deger: string; not: string }[];
  acik: Satir[];
  cozulen: Satir[];
}
interface Detay {
  id: string;
  numara: string;
  konu: string;
  konuTur: string;
  kanal: string;
  referans: string | null;
  durum: 'acik' | 'yanitlandi' | 'cozuldu';
  durumAd: string;
  puan: number | null;
  mesajlar: { id: string; taraf: 'kullanici' | 'destek'; kim: string; metin: string }[];
  kisi: { ad: string; userId: string | null };
  oneri: { soru: string; cevap: string; skor: number } | null;
  /** Rengarenk Ajanı: taslak ve güven ya da insana bırakma notu */
  ajan: { taslak: string | null; guven: number | null; not: string | null; yanitladi: boolean } | null;
  makrolar: { ad: string; metin: string }[];
}

function sure(s: Satir, simdi: number): [string, string] {
  if (s.durum === 'cozuldu') return ['Çözüldü', '#11683F'];
  if (s.durum === 'yanitlandi') return ['Yanıtlandı', '#2450C8'];
  if (!s.sonTarih) return ['', '#5A6073'];
  const fark = new Date(s.sonTarih).getTime() - simdi;
  const sa = Math.floor(Math.abs(fark) / 3_600_000);
  const dk = Math.floor((Math.abs(fark) % 3_600_000) / 60_000);
  const y = `${sa ? `${sa} sa ` : ''}${dk} dk`;
  return fark < 0 ? [`Süre aştı · ${y}`, '#A3271F'] : [`Kalan ${y}`, '#5A6073'];
}

/**
 * Destek (YonetimPazar.dc.html › destek; Karar 54): uygulama içi sohbet ve e-posta tek kuyrukta, ilk yanıt süresi,
 * hazır yanıtlar, sık sorulanlardan önerilen yanıt (yapay zekâ taslağı Rengarenk Ajanı ile gelir), kullanıcı kartına geçiş.
 * Telefon numarası maskelidir. İade bu ekrandan yapılmaz; Ödemeler ekranında önerilir.
 */
export default function Destek() {
  const [q, setQ] = useState<Kuyruk | null>(null);
  const [sec, setSec] = useState<string | null>(null);
  const [d, setD] = useState<Detay | null>(null);
  const [metin, setMetin] = useState('');
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [simdi, setSimdi] = useState(() => Date.now());

  const yukle = useCallback(async () => {
    try {
      const k = await yonetim<Kuyruk>('support/tickets');
      setQ(k);
      setSec((s) => s ?? k.acik[0]?.id ?? k.cozulen[0]?.id ?? null);
    } catch (e) {
      setHata((e as Error).message);
    }
  }, []);
  useEffect(() => {
    yukle();
    const t = setInterval(() => setSimdi(Date.now()), 60_000);
    return () => clearInterval(t);
  }, [yukle]);
  useEffect(() => {
    if (!sec) return;
    setD(null);
    yonetim<Detay>(`support/tickets/${sec}`)
      .then((x) => {
        setD(x);
        setMetin(x.durum !== 'cozuldu' ? (x.ajan?.taslak ?? x.oneri?.cevap ?? '') : '');
      })
      .catch((e: Error) => setHata(e.message));
  }, [sec]);

  async function gonder(coz: boolean) {
    if (!d || !metin.trim()) return;
    setHata(null);
    try {
      setD(
        await yonetim<Detay>(`support/tickets/${d.id}/reply`, {
          method: 'POST',
          body: { metin: metin.trim(), coz },
        }),
      );
      setMetin('');
      setBilgi(
        coz
          ? 'Yanıt gönderildi · çözüldü · memnuniyet sorusu 24 saat sonra gidecek'
          : 'Yanıt gönderildi; kullanıcıya bildirim ve e-posta gidiyor.',
      );
      yukle();
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function coz() {
    if (!d) return;
    try {
      setD(await yonetim<Detay>(`support/tickets/${d.id}/resolve`, { method: 'POST' }));
      setBilgi('Talep çözüldü olarak kapatıldı.');
      yukle();
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  const satirlar = q ? [...q.acik, ...q.cozulen] : [];
  const taslakVar = Boolean(d?.ajan?.taslak || d?.oneri);
  return (
    <>
      <div className={stil.kutu1}>
        <h1 className={stil.baslik1}>Destek</h1>
        <p className={stil.metin1}>
          Uygulama içi sohbet ve e-posta tek kuyrukta. Telefon desteği ilk sürümde yok.
        </p>
      </div>
      {hata ? <p className={stil.metin2}>{hata}</p> : null}
      {q ? (
        <div className={stil.kutu2}>
          {q.sayilar.map((s) => (
            <div key={s.ad} className={stil.kutu3}>
              <div className={stil.kutu4}>{s.ad}</div>
              <div className={stil.kutu5}>{s.deger}</div>
              <div className={stil.kutu6}>{s.not}</div>
            </div>
          ))}
        </div>
      ) : null}
      <div className={stil.kutu7}>
        <section aria-label="Destek talepleri" className={stil.kutu8}>
          {q && !satirlar.length ? <p className={stil.metin3}>Destek talebi yok.</p> : null}
          {satirlar.map((s) => {
            const on = s.id === sec;
            const [st, sr] = sure(s, simdi);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSec(s.id);
                  setBilgi(null);
                }}
                aria-current={on}
                className={cx(stil.dugme1, on ? stil.dugme2 : stil.dugme3)}
              >
                <span className={stil.metin4}>
                  <span className={stil.metin5}>
                    {s.no} · {s.kanal}
                    {s.oncelikli && s.durum !== 'cozuldu' ? ' · öncelikli' : ''}
                  </span>
                  <span style={{ color: sr }}>{st}</span>
                </span>
                <span className={stil.metin6}>{s.konu}</span>
                <span className={stil.metin7}>
                  {s.kim} · {s.etiket}
                </span>
              </button>
            );
          })}
        </section>

        <section aria-labelledby="dt" className={stil.kutu9}>
          {d ? (
            <>
              <div className={stil.kutu10}>
                <span className={stil.metin8}>
                  <h2 id="dt" className={stil.baslik2}>
                    {d.konu}
                  </h2>
                  <span className={stil.metin9}>
                    {d.numara} · {d.kisi.ad} · {d.kanal} · {d.konuTur}
                    {d.referans ? ` · No ${d.referans}` : ''}
                  </span>
                </span>
                {d.kisi.userId ? (
                  <Link href={`/kullanicilar?kisi=${d.kisi.userId}`} className={stil.bag1}>
                    Kullanıcı kartını aç
                  </Link>
                ) : null}
              </div>
              <div className={stil.kutu11}>
                {d.mesajlar.map((m) => (
                  <div
                    key={m.id}
                    className={cx(stil.kutu12, m.taraf === 'destek' ? stil.kutu13 : stil.kutu14)}
                  >
                    <div className={cx(stil.kutu15, m.taraf === 'destek' ? stil.kutu16 : stil.kutu17)}>
                      <span className={stil.metin10}>{m.kim}</span>
                      {m.metin}
                    </div>
                  </div>
                ))}
              </div>
              {d.durum !== 'cozuldu' && d.ajan?.not && !d.ajan.taslak ? (
                <p className={stil.metin11}>Ajan: {d.ajan.not}</p>
              ) : null}
              {d.durum !== 'cozuldu' ? (
                <div className={stil.kutu18}>
                  <div className={stil.kutu19}>
                    <span className={stil.metin12}>{taslakVar ? 'Ajanın taslağı' : 'Yanıt'}</span>
                    <span className={stil.metin5}>
                      {d.ajan?.taslak
                        ? `Güven %${d.ajan.guven ?? 0} · eşik %90 altında, onayın gerekiyor`
                        : d.oneri
                          ? `Sık sorulanlardan: “${d.oneri.soru}” · onayın gerekiyor`
                          : ''}
                    </span>
                  </div>
                  <label htmlFor="yanit" className={stil.etiket1}>
                    Yanıt metni
                  </label>
                  <textarea
                    id="yanit"
                    value={metin}
                    onChange={(e) => setMetin(e.target.value)}
                    rows={5}
                    maxLength={4000}
                    className={cx(stil.girdi1, taslakVar ? stil.girdi2 : stil.kutu17)}
                    style={{ border: `1.5px solid ${taslakVar ? '#C9B8FF' : '#D5DAE5'}` }}
                  />
                  <div className={stil.kutu20}>
                    {d.makrolar.map((h) => (
                      <button
                        key={h.ad}
                        type="button"
                        onClick={() => setMetin((m) => (m.trim() ? `${m.trim()}\n\n${h.metin}` : h.metin))}
                        className={stil.dugme4}
                      >
                        {h.ad}
                      </button>
                    ))}
                  </div>
                  <div className={stil.kutu21}>
                    <button type="button" onClick={() => gonder(false)} className={stil.dugme5}>
                      Gönder
                    </button>
                    <button type="button" onClick={() => gonder(true)} className={stil.dugme6}>
                      Gönder ve çözüldü say
                    </button>
                    <button type="button" onClick={coz} className={stil.dugme7}>
                      Yanıtsız kapat
                    </button>
                  </div>
                  <p className={stil.metin13}>
                    İade, hesap silme ve hukuki konular her zaman insana kalır. İade gerekiyorsa{' '}
                    <Link href="/odemeler">Ödemeler ekranında öner</Link>; iadeyi yalnızca sahip onaylar.
                  </p>
                </div>
              ) : (
                <div className={stil.kutu22}>
                  {bilgi ?? (d.ajan?.yanitladi ? `Ajan çözdü · ${d.ajan.not ?? ''}` : 'Çözüldü')}
                  {d.puan ? ` · memnuniyet ${d.puan}/5` : ''}
                </div>
              )}
              {bilgi && d.durum !== 'cozuldu' ? (
                <p role="status" className={stil.metin14}>
                  {bilgi}
                </p>
              ) : null}
            </>
          ) : (
            <p className={stil.metin15}>{q ? 'Bir destek talebi seç.' : 'Yükleniyor…'}</p>
          )}
        </section>
      </div>
    </>
  );
}
