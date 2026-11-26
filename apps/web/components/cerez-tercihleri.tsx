'use client';

import type { ReactNode } from 'react';
import { cerezTercihleriniAc } from '../lib/olcum';
import stil from './cerez-tercihleri.module.css';

/** Çerez bandını yeniden açan bağlantı (izin her zaman geri alınabilir; Karar 35, 59) */
export function CerezTercihleri({ children }: { children?: ReactNode }) {
  return (
    <button type="button" onClick={cerezTercihleriniAc} className={stil.dugme}>
      {children ?? 'Çerez tercihleri'}
    </button>
  );
}
