'use client';

import { RATING_LABELS } from '@rengarenk/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cx } from '../lib/cx';
import { istek } from '../lib/istemci';
import stil from './puan-ver.module.css';

/**
 * Yıldız ver (Karar 55; tasarım: MesajlarMobil.dc.html › puan penceresi). Yalnızca yıldız verilir, yorum yazılmaz;
 * puan satıcıya isimsiz gider. Gönderince "Teşekkürler" ve "Aracı buldum" bağlantısı.
 */
export function PuanVer({
  sohbet,
  ad,
  bas,
  alt,
  kapat,
  verildi,
}: {
  sohbet: string;
  ad: string;
  bas: string;
  alt: string;
  kapat: () => void;
  verildi: (yildiz: number) => void;
}) {
  const [yildiz, setYildiz] = useState(0);
  const [tamam, setTamam] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && kapat();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [kapat]);

  async function gonder() {
    if (!yildiz) return;
    setMesgul(true);
    setHata(null);
    try {
      await istek(`/conversations/${sohbet}/rating`, { method: 'POST', body: { yildiz } });
      setTamam(true);
      verildi(yildiz);
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setMesgul(false);
    }
  }

  return (
    <div className={stil.kutu1}>
      <section role="dialog" aria-modal="true" aria-labelledby="puan-baslik" className={stil.kutu2}>
        {!tamam ? (
          <>
            <div className={stil.kutu3}>
              <span aria-hidden="true" className={stil.metin1}>
                {bas}
              </span>
              <span>
                <h2 id="puan-baslik" className={stil.baslik1}>
                  {ad} nasıldı?
                </h2>
                <span className={stil.metin2}>{alt}</span>
              </span>
            </div>
            <div role="radiogroup" aria-label="Puan, 5 üzerinden" className={stil.kutu4}>
              {[1, 2, 3, 4, 5].map((n) => {
                const on = n <= yildiz;
                return (
                  // biome-ignore lint/a11y/useSemanticElements: tasarımdaki yıldız düğmeleri radyo grubu olarak işaretli
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={n === yildiz}
                    aria-label={`${n} yıldız, ${RATING_LABELS[n]}`}
                    onClick={() => setYildiz(n)}
                    className={cx(stil.dugme1, on ? stil.dugme2 : stil.dugme3)}
                  >
                    <svg width="32" height="32" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"
                        className={cx(on ? stil.gorsel1 : stil.gorsel2)}
                        stroke={on ? '#B07A00' : '#AEB5C4'}
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                );
              })}
            </div>
            <p className={stil.metin3}>{RATING_LABELS[yildiz]}</p>
            <div className={stil.kutu5}>
              Yalnızca yıldız verilir, yorum yazılmaz. Puanın satıcıya isimsiz gider; profilinde tek tek puan
              değil, <strong>Güvenilir satıcı</strong> ve <strong>Hızlı yanıt</strong> gibi rozetler görünür.
            </div>
            {hata ? (
              <p role="alert" className={stil.metin4}>
                {hata}
              </p>
            ) : null}
            <div className={stil.kutu6}>
              <button type="button" onClick={kapat} className={stil.dugme4}>
                Sonra
              </button>
              <button
                type="button"
                aria-disabled={!yildiz || mesgul}
                onClick={gonder}
                className={cx(stil.dugme5, yildiz ? stil.dugme6 : stil.dugme7)}
              >
                Puanı gönder
              </button>
            </div>
            <span title="Şikâyet moderasyonla birlikte açılacak" className={stil.metin5}>
              Bir sorun mu yaşadın? Şikayet et
            </span>
          </>
        ) : (
          <div className={stil.kutu7}>
            <span aria-hidden="true" className={stil.metin6}>
              <svg
                aria-hidden="true"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#11683F"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12l5 5 9-10" />
              </svg>
            </span>
            <h2 className={stil.baslik2}>Teşekkürler</h2>
            <p className={stil.metin7}>
              Puanın kaydedildi. Aracı bulduysan talebini kapatabilirsin; satıcılar sana yazmayı bırakır.
            </p>
            <div className={stil.kutu8}>
              <button type="button" onClick={kapat} className={stil.dugme8}>
                Kapat
              </button>
              <Link href="/taleplerim" className={stil.bag1}>
                Aracı buldum
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
