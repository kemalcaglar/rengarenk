'use client';

import { TEKNIK_KAYNAK, type TeknikOzet, teknikBolumleri } from '@rengarenk/shared';
import { useState } from 'react';
import { colors } from '../lib/renk';

/**
 * Talep sayfasında aracın ayrıntılı teknik özellikleri (sahip isteği, 17 Kasım 2026): motor sürümü başına bölüm bölüm
 * (motor, performans, şanzıman ve çekiş, tüketim ve emisyon, ölçüler ve ağırlık, lastik ve fren). Değerler Türkiye'de
 * satılan sürümlerle eşleşen kayıtlardan; sürümler arasında farklıysa aralık.
 */
export function TeknikTablo({
  motorlar,
  not,
}: {
  motorlar: { ad: string; ozet: TeknikOzet }[];
  /** Başlık altı açıklama (ör. "G20 makyajsız kasa, 2019–2022") */
  not?: string | null;
}) {
  const [secili, setSecili] = useState(0);
  if (!motorlar.length) {
    return (
      <p style={{ margin: 0, fontSize: 14.5, color: colors.muted }}>
        Bu araç için katalogda teknik bilgi bulunamadı. Motor ya da kasa seçilince ayrıntı genişler.
      </p>
    );
  }
  const m = motorlar[Math.min(secili, motorlar.length - 1)] as (typeof motorlar)[number];
  const bolumler = teknikBolumleri(m.ozet);
  return (
    <div>
      {motorlar.length > 1 ? (
        <div
          role="tablist"
          aria-label="Motor seçenekleri"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}
        >
          {motorlar.map((x, i) => (
            <button
              key={x.ad}
              type="button"
              role="tab"
              aria-selected={i === secili}
              onClick={() => setSecili(i)}
              style={{
                border: i === secili ? `1.5px solid ${colors.blue}` : '1px solid #D5DAE5',
                background: i === secili ? '#EEF3FF' : colors.surface,
                borderRadius: 'var(--rr-etiket-kose)',
                padding: i === secili ? '7px 13px' : '7.5px 13.5px',
                fontSize: 13.5,
                fontWeight: i === secili ? 800 : 600,
                color: colors.ink,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {x.ad}
            </button>
          ))}
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{m.ad}</p>
      )}
      {not ? <p style={{ margin: '8px 0 0', fontSize: 13, color: colors.muted }}>{not}</p> : null}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '18px 28px',
          marginTop: 16,
        }}
      >
        {bolumler.map((b) => (
          <section key={b.baslik} aria-label={b.baslik}>
            <h3
              style={{
                margin: '0 0 6px',
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: 0.3,
                textTransform: 'uppercase',
                color: colors.muted,
              }}
            >
              {b.baslik}
            </h3>
            <dl style={{ margin: 0 }}>
              {b.satirlar.map(([etiket, deger]) => (
                <div
                  key={etiket}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '8px 0',
                    borderBottom: `1px solid ${colors.line}`,
                    fontSize: 14,
                  }}
                >
                  <dt style={{ color: colors.muted }}>{etiket}</dt>
                  <dd style={{ margin: 0, fontWeight: 700, textAlign: 'right' }}>{deger}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <p style={{ margin: '14px 0 0', fontSize: 12, color: colors.muted }}>
        {TEKNIK_KAYNAK}. Değerler pakete ve model yılına göre değişebilir.
      </p>
    </div>
  );
}
