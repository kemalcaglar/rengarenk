'use client';

import type { ClientFlags } from '@rengarenk/shared';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { binlik, istek } from '../../lib/istemci';
import { etiket } from './alan';

/**
 * Sihirbazın bütçe adımı deneyi (Karar 44; özellik anahtarı `butce_b`, YonetimRapor › deney "kaydırıcı mı, iki kutu
 * mu?"). B kolu tasarımdaki en az / en çok iki kutudur; A kolu kaydırıcı. Kol üyenin kimliğinden sunucuda hesaplanır
 * (`GET /flags`); okunamazsa iki kutu gösterilir. Adımı görme ve geçme `POST /flags/deney/butce_b` ile bildirilir;
 * deney sürmüyorsa sunucu yok sayar.
 */
export type Kol = 'A' | 'B';

const ButceKolu = createContext<Kol>('B');
export const useButceKolu = () => useContext(ButceKolu);
export function ButceKoluSaglayici({ kol, children }: { kol: Kol; children: ReactNode }) {
  return <ButceKolu.Provider value={kol}>{children}</ButceKolu.Provider>;
}

/** Üyenin bütçe adımı kolu */
export function useDeneyKolu(giris: boolean | null): Kol {
  const [kol, setKol] = useState<Kol>('B');
  useEffect(() => {
    if (!giris) return;
    istek<ClientFlags>('/flags')
      .then((f) => setKol(f.flags.butce_b ? 'B' : 'A'))
      .catch(() => setKol('B'));
  }, [giris]);
  return kol;
}

const gonderilen = new Set<string>();
/** Adımı gördü ya da geçti (sayfa başına her biri bir kez) */
export function butceOlayi(tur: 'gorus' | 'gecis') {
  if (gonderilen.has(tur)) return;
  gonderilen.add(tur);
  istek('/flags/deney/butce_b', { method: 'POST', body: { tur } }).catch(() => gonderilen.delete(tur));
}

const UST = 10_000_000;
const ADIM = 25_000;

/** A kolu: en az ve en çok bütçe için iki kaydırıcı (0–10 milyon TL, 25 bin adım) */
export function ButceKaydirici({
  id,
  ad,
  deger,
  onChange,
  alt,
}: {
  id: string;
  ad: string;
  deger: { min?: number; max?: number };
  onChange: (v: unknown) => void;
  alt: ReactNode;
}) {
  const min = Math.min(deger.min ?? 0, UST);
  const max = Math.min(deger.max ?? UST, UST);
  const yaz = (k: 'min' | 'max', n: number) => {
    const next = { min, max, [k]: n };
    if (next.min > next.max) {
      if (k === 'min') next.max = next.min;
      else next.min = next.max;
    }
    onChange({ min: next.min, max: next.max });
  };
  const satir = (k: 'min' | 'max', baslik: string, v: number) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <label htmlFor={`${id}-${k}`} style={{ flex: 'none', width: 64, fontSize: 13.5, color: '#3A4052' }}>
        {baslik}
      </label>
      <input
        id={`${id}-${k}`}
        type="range"
        min={0}
        max={UST}
        step={ADIM}
        value={v}
        onChange={(e) => yaz(k, Number(e.target.value))}
        style={{ flex: 1, minWidth: 0, accentColor: '#5B8CFF' }}
      />
      <span style={{ flex: 'none', width: 120, textAlign: 'right', fontSize: 14, fontWeight: 800 }}>
        {binlik(v)} TL{k === 'max' && v >= UST ? '+' : ''}
      </span>
    </div>
  );
  return (
    <div style={{ maxWidth: 520 }}>
      <span style={{ ...etiket, marginBottom: 6 }}>{ad}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {satir('min', 'En az', min)}
        {satir('max', 'En çok', max)}
      </div>
      {alt}
    </div>
  );
}
