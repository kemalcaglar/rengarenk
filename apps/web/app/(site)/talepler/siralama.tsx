'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const SECENEK = [
  ['onerilen', 'Önerilen sıralama'],
  ['yeni', 'En yeni'],
  ['butce_azalan', 'Bütçe: yüksekten düşüğe'],
  ['butce_artan', 'Bütçe: düşükten yükseğe'],
] as const;

/** Sıralama (Liste.dc.html): seçilince liste yenilenir, diğer filtreler korunur. */
export function SiralamaSecimi({ deger }: { deger: string }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  return (
    <>
      <label htmlFor="sirala" className="sr-only">
        Sıralama
      </label>
      <select
        id="sirala"
        value={deger}
        onChange={(e) => {
          const p = new URLSearchParams(params.toString());
          p.set('sira', e.target.value);
          p.delete('sayfa');
          router.push(`${path}?${p.toString()}`);
        }}
        style={{
          border: '1px solid #D5DAE5',
          borderRadius: 'calc(var(--rr-buton-kose) * 12 / 14)',
          padding: '11px 12px',
          fontSize: 14,
          background: 'var(--rr-kart, #FFFFFF)',
          color: 'var(--rr-murekkep, #1E2333)',
          fontFamily: 'inherit',
        }}
      >
        {SECENEK.map(([k, ad]) => (
          <option key={k} value={k}>
            {ad}
          </option>
        ))}
      </select>
    </>
  );
}
