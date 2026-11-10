'use client';

import { type PointerEvent, useRef, useState } from 'react';

export interface Alan {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Plaka işaretleme (Karar 34): fotoğrafın üzerinde sürükleyerek plakanın çevresine kutu çizilir (en çok 6). Kaydedince
 * API özgün kopyadan bütün kutuları pikselleştirip bulanıklaştırır; önceki kutular burada yeniden gösterilir.
 */
export function PlakaDuzenle({
  src,
  baslik,
  galeri = false,
  ilk,
  kaydet,
  kapat,
}: {
  src: string;
  baslik: string;
  /** Galeri fotoğrafı: plakasız gösterilmez, geri alma yok (Karar 34) */
  galeri?: boolean;
  ilk: Alan[];
  kaydet: (alanlar: Alan[]) => Promise<void>;
  kapat: () => void;
}) {
  const [alanlar, setAlanlar] = useState<Alan[]>(ilk);
  const [cizim, setCizim] = useState<Alan | null>(null);
  const [busy, setBusy] = useState(false);
  const bas = useRef<{ x: number; y: number } | null>(null);
  const kutu = useRef<HTMLDivElement>(null);

  const oran = (e: PointerEvent) => {
    const r = kutu.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };
  const yuzde = (n: number) => `${(n * 100).toFixed(2)}%`;
  const ciz = (a: Alan, i: number | null) => (
    <span
      key={i ?? 'yeni'}
      style={{
        position: 'absolute',
        left: yuzde(a.x),
        top: yuzde(a.y),
        width: yuzde(a.w),
        height: yuzde(a.h),
        border: '2px solid #FF6FB5',
        background: 'rgba(255, 111, 181, 0.18)',
        boxSizing: 'border-box',
      }}
    >
      {i !== null ? (
        <button
          type="button"
          aria-label={`${i + 1}. alanı kaldır`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setAlanlar((l) => l.filter((_, j) => j !== i))}
          style={{
            position: 'absolute',
            top: -12,
            right: -12,
            width: 24,
            height: 24,
            borderRadius: 12,
            border: 0,
            background: '#1E2333',
            color: '#fff',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          ×
        </button>
      ) : null}
    </span>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Plakayı bulanıklaştır · ${baslik}`}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(30, 35, 51, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 50,
      }}
    >
      <div
        className="k-panel"
        style={{ width: 'min(960px, 100%)', padding: 18, maxHeight: '100%', overflow: 'auto' }}
      >
        <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800 }}>Plakayı bulanıklaştır</h2>
        <p className="k-sub" style={{ margin: '0 0 12px' }}>
          {baslik}. Plakanın çevresine sürükleyerek kutu çiz; okunan her plaka ve kişi için ayrı kutu.
          {galeri
            ? 'Kaydedince alanlar pikselleştirilmiş olarak yayına çıkar; atıfta galeri adı ve “düzenlendi” yazar. Galeri fotoğrafının plakalı kopyası gösterilmez.'
            : 'Kaydedince alanlar pikselleştirilir, atıfta “düzenlendi” yazar ve özgün kopya saklanır (geri alınabilir).'}
        </p>
        <div
          ref={kutu}
          onPointerDown={(e) => {
            if (alanlar.length >= 6) return;
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            bas.current = oran(e);
            setCizim({ ...bas.current, w: 0, h: 0 });
          }}
          onPointerMove={(e) => {
            if (!bas.current) return;
            const p = oran(e);
            setCizim({
              x: Math.min(p.x, bas.current.x),
              y: Math.min(p.y, bas.current.y),
              w: Math.abs(p.x - bas.current.x),
              h: Math.abs(p.y - bas.current.y),
            });
          }}
          onPointerUp={() => {
            if (cizim && cizim.w > 0.01 && cizim.h > 0.01) setAlanlar((l) => [...l, cizim]);
            bas.current = null;
            setCizim(null);
          }}
          style={{ position: 'relative', cursor: 'crosshair', userSelect: 'none', touchAction: 'none' }}
        >
          {/* biome-ignore lint/performance/noImgElement: depodaki kopya, işaretleme için özgün oran gerekir */}
          <img src={src} alt={baslik} draggable={false} style={{ width: '100%', display: 'block' }} />
          {alanlar.map((a, i) => ciz(a, i))}
          {cizim ? ciz(cizim, null) : null}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#5A6073', marginRight: 'auto' }}>
            {alanlar.length} alan işaretli{alanlar.length >= 6 ? ' (en çok 6)' : ''}
          </span>
          <button type="button" className="k-btn-line" onClick={kapat} disabled={busy}>
            Vazgeç
          </button>
          <button
            type="button"
            className="k-btn-ok"
            disabled={busy || !alanlar.length}
            onClick={async () => {
              setBusy(true);
              try {
                await kaydet(alanlar);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'İşleniyor…' : 'Bulanıklaştır ve kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}
