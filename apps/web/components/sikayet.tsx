'use client';

import { REPORT_REASONS, type ReportTarget, reasonsFor } from '@rengarenk/shared';
import { useEffect, useState } from 'react';
import { istek } from '../lib/istemci';

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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(30,35,51,0.45)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="sikayet-baslik"
        style={{
          width: '100%',
          maxWidth: 440,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: '#FFFFFF',
          borderRadius: 24,
          padding: '20px 20px 24px',
        }}
      >
        {no === null ? (
          <>
            <h2 id="sikayet-baslik" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
              {BASLIK[hedef]}
            </h2>
            <p style={{ margin: '4px 0 14px', fontSize: 13, color: '#5A6073', lineHeight: 1.5 }}>
              Şikayetini moderatörlerimiz inceler. Şikayet ettiğin kişi kimin şikayet ettiğini görmez.
            </p>
            <div
              role="radiogroup"
              aria-label="Neden"
              style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
            >
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
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      textAlign: 'left',
                      border: `1.5px solid ${on ? 'var(--rr-mavi, #5B8CFF)' : 'var(--rr-cizgi, #E3E6EF)'}`,
                      background: on ? '#EEF3FF' : '#FFFFFF',
                      borderRadius: 'calc(var(--rr-buton-kose) - 2px)',
                      padding: '11px 12px',
                      fontSize: 14,
                      fontWeight: 700,
                      color: 'var(--rr-murekkep, #1E2333)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        flex: 'none',
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        border: `2px solid ${on ? 'var(--rr-mavi, #5B8CFF)' : '#AEB5C4'}`,
                        boxShadow: on ? 'inset 0 0 0 3px #FFFFFF' : 'none',
                        background: on ? 'var(--rr-mavi, #5B8CFF)' : '#FFFFFF',
                      }}
                    />
                    {REPORT_REASONS[k].ad}
                  </button>
                );
              })}
            </div>
            <label style={{ display: 'block', marginTop: 12, fontSize: 13, fontWeight: 700 }}>
              Açıklama (isteğe bağlı)
              <textarea
                value={aciklama}
                onChange={(e) => setAciklama(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Ne oldu? Kısaca yaz."
                style={{
                  display: 'block',
                  width: '100%',
                  boxSizing: 'border-box',
                  marginTop: 6,
                  border: '1px solid #D5DAE5',
                  borderRadius: 'calc(var(--rr-buton-kose) - 2px)',
                  padding: '10px 12px',
                  fontSize: 14,
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </label>
            {hata ? (
              <p
                role="alert"
                style={{ margin: '10px 0 0', color: '#A3271F', fontSize: 13.5, fontWeight: 700 }}
              >
                {hata}
              </p>
            ) : null}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                type="button"
                onClick={kapat}
                style={{
                  flex: 1,
                  border: '1px solid #D5DAE5',
                  background: '#FFFFFF',
                  borderRadius: 'var(--rr-buton-kose)',
                  padding: '12px 14px',
                  fontSize: 14.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={gonder}
                disabled={!neden || mesgul}
                style={{
                  flex: 1,
                  border: 0,
                  background: neden ? '#E5484D' : '#F3C9C7',
                  borderRadius: 'var(--rr-buton-kose)',
                  padding: '12px 14px',
                  fontSize: 14.5,
                  fontWeight: 800,
                  color: '#FFFFFF',
                  cursor: neden ? 'pointer' : 'default',
                  fontFamily: 'inherit',
                }}
              >
                Şikayet et
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="sikayet-baslik" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
              Şikayetin alındı
            </h2>
            <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.55, color: '#3A4052' }}>
              S-{no} numarasıyla inceleniyor. Sonuçlanınca sana bildirim göndereceğiz.
            </p>
            <button
              type="button"
              onClick={kapat}
              style={{
                marginTop: 16,
                width: '100%',
                border: 0,
                background: 'var(--rr-mavi, #5B8CFF)',
                borderRadius: 'var(--rr-buton-kose)',
                padding: '12px 14px',
                fontSize: 14.5,
                fontWeight: 800,
                color: 'var(--rr-murekkep, #1E2333)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Tamam
            </button>
          </>
        )}
      </section>
    </div>
  );
}
