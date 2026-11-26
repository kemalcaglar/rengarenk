'use client';

import { useCallback, useEffect, useState } from 'react';
import { cx } from '../../../lib/cx';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';
import stil from './page.module.css';

interface Ozet {
  saklama: { key: string; ad: string; dayanak: string; sure: string; sonra: string }[];
  donem: {
    id: string;
    no: string;
    tarih: string;
    durum: 'liste' | 'onaylandi' | 'calisti';
    sayim: string | null;
    onaylayan: string | null;
    onayTarihi: string | null;
    liste: { kalem: string; ad: string; sayi: number }[];
  };
  onceki: { id: string; no: string; tarih: string } | null;
  verbis: { zorunlu: boolean; olcutler: { ad: string; deger: string; w: number }[]; envanter: string | null };
  disinda: string[];
}
const gun = (iso: string, yil = true) =>
  new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    ...(yil ? { year: 'numeric' } : {}),
    timeZone: 'Europe/Istanbul',
  }).format(new Date(iso));
const kisaGun = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', timeZone: 'Europe/Istanbul' }).format(
    new Date(iso),
  );
const sayi = (n: number) => new Intl.NumberFormat('tr-TR').format(n);
/** "1 Ocak’ta", "1 Temmuz’da" */
const gunde = (iso: string) => `${gun(iso, false)}’${new Date(iso).getUTCMonth() < 6 ? 'ta' : 'da'}`;

/**
 * Saklama, imha ve VERBİS (YonetimSistem.dc.html › imha; Karar 59). Periyodik imha 6 ayda bir; ajan süresi dolan
 * kayıtları listeler, liste Sahip onayıyla imha edilir ve tutanağı saklanır.
 */
export default function Imha() {
  const { me } = useKonsol();
  const [o, setO] = useState<Ozet | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);

  const yukle = useCallback(() => {
    yonetim<Ozet>('retention')
      .then(setO)
      .catch((e: Error) => setHata(e.message));
  }, []);
  useEffect(yukle, [yukle]);

  async function onayla() {
    if (!o) return;
    setHata(null);
    try {
      await yonetim(`retention/${o.donem.id}/approve`, { method: 'POST', body: {} });
      setBilgi('İmha listesi onaylandı.');
      yukle();
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function tutanak(id: string, no: string) {
    try {
      const r = await yonetim<unknown>(`retention/${id}/report`);
      const url = URL.createObjectURL(new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `imha-tutanagi-${no}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  const d = o?.donem;
  const onaylandi = d?.durum === 'onaylandi';
  return (
    <>
      <div className={stil.kutu1}>
        <h1 className={stil.baslik1}>Saklama, imha ve VERBİS</h1>
        <p className={stil.metin1}>
          Periyodik imha 6 ayda bir. Ajan süresi dolan kayıtları listeler; imha sahip onayıyla yapılır ve
          tutanağı saklanır.
        </p>
      </div>
      {hata ? (
        <p role="alert" className={stil.metin2}>
          {hata}
        </p>
      ) : null}
      {bilgi ? (
        <p role="status" className={stil.metin3}>
          {bilgi}
        </p>
      ) : null}
      {o && d ? (
        <div className={stil.kutu2}>
          <section aria-labelledby="sure" className={stil.kutu3}>
            <h2 id="sure" className={stil.baslik2}>
              Saklama süreleri
            </h2>
            <div className={stil.kutu4}>
              <span>Veri</span>
              <span>Süre</span>
              <span>Süre dolunca</span>
            </div>
            {o.saklama.map((s) => (
              <div key={s.key} className={stil.kutu5}>
                <span className={stil.metin4}>
                  {s.ad}
                  <span className={stil.metin5}>{s.dayanak}</span>
                </span>
                <span>{s.sure}</span>
                <span className={stil.metin6}>{s.sonra}</span>
              </div>
            ))}
            <p className={stil.metin7}>
              {o.disinda.join(', ')} yalnızca ekleme yapılan kayıtlardır; satırları hiç değiştirilmez ve
              silinmez. İşlem kaydındaki IP adresleri dönem anahtarıyla şifrelidir; 2 yıl dolunca anahtar imha
              edilir ve IP okunamaz olur. Hesap kapanınca bu kayıtların kişiyle bağı kopar.
            </p>
          </section>

          <div className={stil.kutu6}>
            <section
              aria-labelledby="donem"
              className={stil.kutu7}
              style={{ border: `1.5px solid ${onaylandi ? '#B9EBD1' : '#5B8CFF'}` }}
            >
              <h2 id="donem" className={stil.baslik3}>
                Sıradaki periyodik imha · {gun(d.tarih)}
              </h2>
              <p className={stil.metin8}>
                {o.onceki ? (
                  <>
                    Önceki: {gun(o.onceki.tarih)} · tutanak{' '}
                    <button
                      type="button"
                      onClick={() => o.onceki && tutanak(o.onceki.id, o.onceki.no)}
                      className={stil.dugme1}
                    >
                      {o.onceki.no}
                    </button>
                  </>
                ) : (
                  'Önceki: henüz periyodik imha yapılmadı'
                )}
                {d.sayim ? ` · ajanın son sayımı ${kisaGun(d.sayim)}` : ''}
              </p>
              {d.liste.map((k) => (
                <div key={k.kalem} className={stil.kutu8}>
                  <span>{k.ad}</span>
                  <strong>{sayi(k.sayi)}</strong>
                </div>
              ))}
              {d.durum === 'liste' && me.role === 'OWNER' ? (
                <button type="button" onClick={onayla} className={stil.dugme2}>
                  Listeyi onayla · {gunde(d.tarih)} imha et
                </button>
              ) : d.durum === 'liste' ? (
                <p className={stil.metin9}>
                  Listeyi yalnızca sahip onaylar; onaylanmayan liste imha edilmez.
                </p>
              ) : (
                <p className={stil.metin10}>
                  Onaylandı · {gun(d.tarih, false)} 03.00’te çalışacak · tutanak {d.no} hazırlanacak
                  {d.onaylayan ? (
                    <span className={stil.metin11}>
                      Onaylayan: {d.onaylayan}
                      {d.onayTarihi ? ` · ${kisaGun(d.onayTarihi)}` : ''}
                    </span>
                  ) : null}
                </p>
              )}
            </section>

            <section aria-labelledby="verbis" className={stil.kutu9}>
              <div className={stil.kutu10}>
                <h2 id="verbis" className={stil.baslik3}>
                  VERBİS
                </h2>
                <span className={cx(stil.metin12, o.verbis.zorunlu ? stil.metin13 : stil.metin14)}>
                  {o.verbis.zorunlu ? 'Kayıt gerekiyor' : 'Kayıt şimdilik zorunlu değil'}
                </span>
              </div>
              {o.verbis.olcutler.map((v) => (
                <div key={v.ad} className={stil.kutu11}>
                  <div className={stil.kutu12}>
                    <span>{v.ad}</span>
                    <strong>{v.deger}</strong>
                  </div>
                  <div className={stil.kutu13}>
                    <div className={stil.kutu14} style={{ width: `${v.w}%` }} />
                  </div>
                </div>
              ))}
              <p className={stil.metin15}>
                Muafiyet: 50’den az çalışan ve 100 milyon TL’den az yıllık bilanço, ana faaliyet özel
                nitelikli veri işleme değil. Eşiklerden biri aşılırsa ajan hatırlatır. Kişisel veri envanteri
                yine tutulur
                {o.verbis.envanter ? ` · son güncelleme ${kisaGun(o.verbis.envanter)}` : ''}. Avukat teyidi
                gerekir.
              </p>
            </section>
          </div>
        </div>
      ) : null}
    </>
  );
}
