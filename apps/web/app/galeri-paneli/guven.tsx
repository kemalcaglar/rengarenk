'use client';

import type { CSSProperties } from 'react';

export interface GuvenVerisi {
  yildizSayisi: number;
  yildizOrtalama: number | null;
  /** 1'den 5'e yıldız sayıları */
  dagilim: number[];
  yanitSohbet: number;
  ortalamaYanitDakika: number | null;
  ortancaYanitDakika: number | null;
  puan: number;
  rozetler: {
    rozet: string;
    var: boolean;
    eksik: string[];
    ad: string;
    bg: string;
    renk: string;
    aciklama: string;
  }[];
  takipci: number;
}

const kart: CSSProperties = { background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 18 };
const sure = (dk: number | null) =>
  dk === null ? '—' : dk < 60 ? `${Math.max(1, Math.round(dk))} dk` : `${Math.round(dk / 60)} sa`;

/**
 * Galeri paneli › Özet: yıldız ortalaması, dağılımı ve rozete ne kadar kaldığı (Karar 55). Galeri yıldızı kimin
 * verdiğini görmez; alıcılar puanı sayı olarak değil, yalnızca rozetleri görür. Tasarımda ayrı bir ekran yok;
 * GaleriMobil.dc.html'deki "Rozetlerin" kartı ve konsoldaki not esas alındı.
 */
export function Guven({ v }: { v: GuvenVerisi }) {
  const enCok = Math.max(1, ...v.dagilim);
  return (
    <section style={{ ...kart, padding: 20, marginTop: 16 }} aria-labelledby="guven">
      <h2 id="guven" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
        Yıldızların ve rozetlerin
      </h2>
      <p style={{ margin: '4px 0 14px', fontSize: 13.5, color: '#5A6073' }}>
        Rozetler alıcı yıldızları, yanıt süren ve şikâyet oranınla her gece güncellenir. Alıcılar tek tek puan
        görmez; yıldızı kimin verdiği sana da gösterilmez.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 34, fontWeight: 800 }}>
              {v.yildizOrtalama === null ? '—' : String(v.yildizOrtalama).replace('.', ',')}
            </span>
            <span style={{ fontSize: 14, color: '#5A6073' }}>
              ★ · {v.yildizSayisi} yıldız · ortalama yanıt {sure(v.ortalamaYanitDakika)}
            </span>
          </div>
          <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
            {[5, 4, 3, 2, 1].map((n) => {
              const adet = v.dagilim[n - 1] ?? 0;
              return (
                <div
                  key={n}
                  title={`${n} yıldız: ${adet}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}
                >
                  <span style={{ flex: '0 0 54px', color: '#3A4052' }}>{n} yıldız</span>
                  <span
                    style={{ flex: 1, height: 8, borderRadius: 4, background: '#EEF0F5', overflow: 'hidden' }}
                  >
                    <span
                      style={{
                        display: 'block',
                        height: 8,
                        borderRadius: 4,
                        background: '#FFC84A',
                        width: `${(adet / enCok) * 100}%`,
                      }}
                    />
                  </span>
                  <span style={{ flex: '0 0 28px', textAlign: 'right', fontWeight: 700 }}>{adet}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ flex: '1 1 300px', minWidth: 0, display: 'grid', gap: 10 }}>
          {v.rozetler.map((r) => (
            <div key={r.rozet} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span
                title={r.aciklama}
                style={{
                  flex: 'none',
                  fontSize: 12.5,
                  fontWeight: 800,
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: r.var ? r.bg : '#F3F5FA',
                  color: r.var ? r.renk : '#8A91A3',
                }}
              >
                {r.ad}
              </span>
              <span style={{ fontSize: 13, color: r.var ? '#11683F' : '#3A4052', lineHeight: 1.5 }}>
                {r.var ? 'Rozetin var' : `Kalan: ${r.eksik.join(', ')}`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
