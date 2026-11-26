'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { HesabimMenu } from '../../../components/hesabim-menu';
import { cx } from '../../../lib/cx';
import { istek, useGiris } from '../../../lib/istemci';
import stil from './page.module.css';

interface Satir {
  no: number;
  numara: string;
  konu: string;
  ozet: string;
  durum: 'acik' | 'yanitlandi' | 'cozuldu';
  durumAd: string;
  son: string;
  okunmamis: boolean;
}
interface Yazisma {
  no: number;
  numara: string;
  konu: string;
  konuTur: string;
  durum: 'acik' | 'yanitlandi' | 'cozuldu';
  durumAd: string;
  puan: number | null;
  puanVerebilir: boolean;
  mesajlar: { id: string; taraf: 'kullanici' | 'destek'; kim: string; metin: string; zaman: string }[];
}

const DURUM: Record<string, [string, string]> = {
  acik: ['#FFF6DF', '#7A5300'],
  yanitlandi: ['#EEF3FF', 'var(--rr-baglanti, #2450C8)'],
  cozuldu: ['#E7FAF0', '#11683F'],
};
const zaman = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(iso));

/**
 * Destek taleplerim (Karar 54): "Rengarenk Destek" yazışmaları. Mesajlarım'da en üstte sabit satır olarak da görünür;
 * yanıt geldiğinde bildirim ve e-posta gider. Çözülen talebe 1–5 puan verilir; yeniden yazınca talep açılır.
 */
export default function Destek() {
  const giris = useGiris();
  const [liste, setListe] = useState<Satir[] | null>(null);
  const [no, setNo] = useState<number | null>(null);
  const [y, setY] = useState<Yazisma | null>(null);
  const [metin, setMetin] = useState('');
  const [hata, setHata] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    const l = await istek<Satir[]>('/support/tickets');
    setListe(l);
    return l;
  }, []);
  useEffect(() => {
    if (giris === false) window.location.href = '/giris?sonra=/destek';
    if (!giris) return;
    const q = Number(new URLSearchParams(window.location.search).get('no'));
    yukle()
      .then((l) => setNo(q || l[0]?.no || null))
      .catch((e: Error) => setHata(e.message));
  }, [giris, yukle]);
  useEffect(() => {
    if (!no) return;
    setY(null);
    istek<Yazisma>(`/support/tickets/${no}`)
      .then((x) => {
        setY(x);
        setListe((l) => l?.map((s) => (s.no === no ? { ...s, okunmamis: false } : s)) ?? l);
      })
      .catch((e: Error) => setHata(e.message));
  }, [no]);

  async function gonder() {
    if (!no || !metin.trim()) return;
    try {
      setY(
        await istek<Yazisma>(`/support/tickets/${no}/messages`, {
          method: 'POST',
          body: { metin: metin.trim() },
        }),
      );
      setMetin('');
      yukle();
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function puanla(puan: number) {
    if (!no) return;
    try {
      setY(await istek<Yazisma>(`/support/tickets/${no}/rating`, { method: 'POST', body: { puan } }));
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  return (
    <div className={`rr-sayfa ${stil.kutu1}`}>
      <HesabimMenu aktif="/yardim" />
      <main className={stil.kutu2}>
        <div className={stil.kutu3}>
          <h1 className={stil.baslik1}>Destek taleplerim</h1>
          <Link href="/yardim" className={stil.bag1}>
            Yardım merkezi · yeni talep
          </Link>
        </div>
        {hata ? (
          <p role="alert" className={stil.metin1}>
            {hata}
          </p>
        ) : null}
        {liste && !liste.length ? (
          <p className={stil.metin2}>
            Henüz destek talebin yok. Sorunun yanıtını{' '}
            <Link href="/yardim" className={stil.bag2}>
              Yardım merkezinde
            </Link>{' '}
            bulamazsan oradan bize yazabilirsin.
          </p>
        ) : null}
        <div className={stil.kutu4}>
          {liste?.length ? (
            <section aria-label="Talepler" className={stil.kutu5}>
              {liste.map((s) => {
                const on = s.no === no;
                const [bg, fg] = DURUM[s.durum] ?? DURUM.acik;
                return (
                  <button
                    key={s.no}
                    type="button"
                    onClick={() => setNo(s.no)}
                    aria-current={on}
                    className={cx(stil.dugme1, on ? stil.dugme2 : stil.dugme3)}
                  >
                    <span className={stil.metin3}>
                      <span className={stil.metin4}>
                        {s.numara} · {s.konu}
                      </span>
                      <span className={stil.metin5} style={{ background: bg, color: fg }}>
                        {s.durumAd}
                      </span>
                    </span>
                    <span className={cx(stil.metin6, s.okunmamis ? stil.metin7 : stil.metin8)}>
                      {s.okunmamis ? '● ' : ''}
                      {s.ozet}
                    </span>
                  </button>
                );
              })}
            </section>
          ) : null}
          {y ? (
            <section aria-labelledby="yz" className={stil.kutu6}>
              <div className={stil.kutu7}>
                <h2 id="yz" className={stil.baslik2}>
                  Rengarenk Destek · {y.numara}
                </h2>
                <div className={stil.kutu8}>
                  {y.konuTur} · {y.durumAd}
                </div>
              </div>
              <div className={stil.kutu9}>
                {y.mesajlar.map((m) => (
                  <div
                    key={m.id}
                    className={cx(stil.kutu10, m.taraf === 'kullanici' ? stil.kutu11 : stil.kutu12)}
                  >
                    <div className={cx(stil.kutu13, m.taraf === 'kullanici' ? stil.kutu14 : stil.kutu15)}>
                      <span className={stil.metin9}>
                        {m.kim} · {zaman(m.zaman)}
                      </span>
                      {m.metin}
                    </div>
                  </div>
                ))}
              </div>
              {y.puanVerebilir ? (
                <div className={stil.kutu16}>
                  <div className={stil.kutu17}>Sorunun nasıl çözüldü?</div>
                  <fieldset aria-label="Puan, 5 üzerinden" className={stil.kutu18}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => puanla(n)}
                        aria-label={`${n} puan`}
                        className={stil.dugme4}
                      >
                        {n}
                      </button>
                    ))}
                  </fieldset>
                </div>
              ) : y.puan ? (
                <div className={stil.kutu19}>Puanın için teşekkürler: {y.puan} / 5</div>
              ) : null}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  gonder();
                }}
                className={stil.kutu20}
              >
                <label htmlFor="dm" className={stil.etiket1}>
                  Mesajın
                </label>
                <input
                  id="dm"
                  value={metin}
                  onChange={(e) => setMetin(e.target.value)}
                  maxLength={2000}
                  placeholder={y.durum === 'cozuldu' ? 'Yazarsan talebin yeniden açılır' : 'Mesaj yaz'}
                  className={stil.girdi1}
                />
                <button type="submit" className={stil.dugme5}>
                  Gönder
                </button>
              </form>
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}
