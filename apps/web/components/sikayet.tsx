'use client';

import { REPORT_REASONS, type ReportTarget, reasonsFor } from '@rengarenk/shared';
import { useEffect, useState } from 'react';
import { cx } from '../lib/cx';
import { istek } from '../lib/istemci';
import stil from './sikayet.module.css';

const BASLIK: Record<ReportTarget, string> = {
  mesaj: 'Bu mesajı şikayet et',
  talep: 'Bu talebi şikayet et',
  arac: 'Bu ilanı şikayet et',
};

/**
 * Şikayet penceresi (Karar 13.2, 53): neden seçilir, isteğe bağlı açıklama yazılır. Öncelik nedene göre belirlenir
 * (kapora, dolandırıcılık ve tehdit 1 saat içinde incelenir). Şikayet edilen kişi şikayet edeni görmez.
 */
export function Sikayet({ hedef, id, kapat }: { hedef: ReportTarget; id: string; kapat: () => void }) {
  const nedenler = reasonsFor(hedef);
  const [neden, setNeden] = useState<string | null>(null);
  const [aciklama, setAciklama] = useState('');
  const [no, setNo] = useState<number | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && kapat();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [kapat]);

  async function gonder() {
    if (!neden) return;
    setMesgul(true);
    setHata(null);
    try {
      const r = await istek<{ no: number }>('/reports', {
        method: 'POST',
        body: { hedef, id, neden, ...(aciklama.trim() ? { aciklama: aciklama.trim() } : {}) },
      });
      setNo(r.no);
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setMesgul(false);
    }
  }

  return (
    <div className={stil.kutu1}>
      <section role="dialog" aria-modal="true" aria-labelledby="sikayet-baslik" className={stil.kutu2}>
        {no === null ? (
          <>
            <h2 id="sikayet-baslik" className={stil.baslik1}>
              {BASLIK[hedef]}
            </h2>
            <p className={stil.metin1}>
              Şikayetini moderatörlerimiz inceler. Şikayet ettiğin kişi kimin şikayet ettiğini görmez.
            </p>
            <div role="radiogroup" aria-label="Neden" className={stil.kutu3}>
              {nedenler.map((k) => {
                const on = neden === k;
                return (
                  // biome-ignore lint/a11y/useSemanticElements: tasarımdaki seçim kartları radyo grubu olarak işaretli
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setNeden(k)}
                    className={cx(stil.dugme1, on ? stil.dugme2 : stil.dugme3)}
                    style={{
                      border: `1.5px solid ${on ? 'var(--rr-mavi, #5B8CFF)' : 'var(--rr-cizgi, #E3E6EF)'}`,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className={cx(stil.metin2, on ? stil.metin3 : stil.metin4)}
                      style={{ border: `2px solid ${on ? 'var(--rr-mavi, #5B8CFF)' : '#AEB5C4'}` }}
                    />
                    {REPORT_REASONS[k].ad}
                  </button>
                );
              })}
            </div>
            <label className={stil.etiket1}>
              Açıklama (isteğe bağlı)
              <textarea
                value={aciklama}
                onChange={(e) => setAciklama(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Ne oldu? Kısaca yaz."
                className={stil.girdi1}
              />
            </label>
            {hata ? (
              <p role="alert" className={stil.metin5}>
                {hata}
              </p>
            ) : null}
            <div className={stil.kutu4}>
              <button type="button" onClick={kapat} className={stil.dugme4}>
                Vazgeç
              </button>
              <button
                type="button"
                onClick={gonder}
                disabled={!neden || mesgul}
                className={cx(stil.dugme5, neden ? stil.dugme6 : stil.dugme7)}
              >
                Şikayet et
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="sikayet-baslik" className={stil.baslik1}>
              Şikayetin alındı
            </h2>
            <p className={stil.metin6}>
              S-{no} numarasıyla inceleniyor. Sonuçlanınca sana bildirim göndereceğiz.
            </p>
            <button type="button" onClick={kapat} className={stil.dugme8}>
              Tamam
            </button>
          </>
        )}
      </section>
    </div>
  );
}
