'use client';

import { type CSSProperties, type ReactNode, useState } from 'react';

/**
 * Masaüstünde her zaman açık yan panel; telefonda (720 px ve altı) başlığına dokununca açılan kutu (ListeMobil.dc.html
 * "Filtrele"). Görünüm kuralları globals.css › Telefon görünümü.
 */
export function DarAcilir({
  etiket,
  ariaLabel,
  className,
  style,
  children,
}: {
  etiket: string;
  ariaLabel: string;
  className: string;
  style: CSSProperties;
  children: ReactNode;
}) {
  const [acik, setAcik] = useState(false);
  return (
    <aside aria-label={ariaLabel} className={className} data-acik={acik} style={style}>
      <button
        type="button"
        className="rr-acilir-dugme rr-yalniz-dar"
        aria-expanded={acik}
        onClick={() => setAcik((a) => !a)}
      >
        {etiket}
        <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>
          {acik ? '−' : '+'}
        </span>
      </button>
      <div className="rr-dar-gizli">{children}</div>
    </aside>
  );
}
