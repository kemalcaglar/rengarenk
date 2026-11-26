'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const SECENEK = [
  ['onerilen', 'Önerilen sıralama'],
  ['yeni', 'En yeni'],
  ['butce_azalan', 'Bütçe: yüksekten düşüğe'],
  ['butce_artan', 'Bütçe: düşükten yükseğe'],
] as const;

/** Sıralama (Liste.dc.html): seçilince liste yenilenir, diğer filtreler korunur. */
export function SiralamaSecimi({ deger, className }: { deger: string; className?: string }) {
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
        className={className}
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
