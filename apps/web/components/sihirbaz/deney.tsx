'use client';

import type { ClientFlags } from '@rengarenk/shared';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { binlik, istek } from '../../lib/istemci';
import stil from './deney.module.css';

/**
 * Sihirbazın bütçe adımı deneyi (Karar 44; özellik anahtarı `butce_b`, YonetimRapor › deney "kaydırıcı mı, iki kutu
 * mu?"). B kolu kutu, A kolu kaydırıcı; ikisinde de bütçe tek rakamdır (sahip isteği, 17 Kasım 2026). Kol üyenin kimliğinden sunucuda hesaplanır
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

/**
 * A kolu: bütçe için kaydırıcı (0–10 milyon TL, 25 bin adım). Bütçe tek rakamdır (sahip isteği, 17 Kasım 2026):
 * üst sınır olarak `max`a yazılır; eski aralıklı değerde en çok (yoksa en az) gösterilir.
 */
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
  const v = Math.min(deger.max ?? deger.min ?? 0, UST);
  return (
    <div className={stil.kutu1}>
      <label htmlFor={id} className={stil.etiket1}>
        {ad}
      </label>
      <div className={stil.kutu2}>
        <input
          id={id}
          type="range"
          min={0}
          max={UST}
          step={ADIM}
          value={v}
          onChange={(e) => {
            const n = Number(e.target.value);
            onChange(n > 0 ? { max: n } : undefined);
          }}
          className={stil.girdi1}
        />
        <span className={stil.metin1}>
          {binlik(v)} TL{v >= UST ? '+' : ''}
        </span>
      </div>
      {alt}
    </div>
  );
}
