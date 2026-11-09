'use client';

import type { CSSProperties, ReactNode } from 'react';
import { cerezTercihleriniAc } from '../lib/olcum';

/** Çerez bandını yeniden açan bağlantı (izin her zaman geri alınabilir; Karar 35, 59) */
export function CerezTercihleri({ style, children }: { style?: CSSProperties; children?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={cerezTercihleriniAc}
      style={{
        border: 0,
        background: 'transparent',
        padding: 0,
        font: 'inherit',
        // Sitedeki bağlantılarla aynı görünüm
        color: 'var(--link)',
        cursor: 'pointer',
        ...style,
      }}
    >
      {children ?? 'Çerez tercihleri'}
    </button>
  );
}
