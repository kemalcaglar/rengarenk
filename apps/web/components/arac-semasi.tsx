'use client';

import { PAINT_STATES } from '@rengarenk/shared';

/** Üstten araç şeması: parçalar durum rengine boyanır (talep sayfası, portföy aracı sayfası) */
export function AracSemasiGorunum({
  parts,
  etiket,
}: {
  parts: Record<string, string | undefined>;
  etiket: string;
}) {
  const renk = (k: string) => PAINT_STATES.find((s) => s.key === (parts[k] ?? 'orijinal'))?.renk ?? '#EEF0F5';
  const P = (d: string, k: string, ad: string) => (
    <path d={d} style={{ fill: renk(k) }} stroke="#AEB5C4" strokeWidth="1.5">
      <title>{ad}</title>
    </path>
  );
  return (
    <svg
      width="240"
      height="480"
      viewBox="0 0 260 520"
      role="img"
      aria-label={etiket}
      style={{ flex: 'none' }}
    >
      <text x="130" y="11" textAnchor="middle" fontSize="11" fontWeight="700" fill="#5A6073">
        ÖN
      </text>
      <rect x="24" y="90" width="14" height="54" rx="6" fill="#4A5064" />
      <rect x="222" y="90" width="14" height="54" rx="6" fill="#4A5064" />
      <rect x="24" y="378" width="14" height="54" rx="6" fill="#4A5064" />
      <rect x="222" y="378" width="14" height="54" rx="6" fill="#4A5064" />
      <path d="M36 178L22 184V196L36 198Z" fill="#DDE2EC" stroke="#AEB5C4" strokeWidth="1.2" />
      <path d="M224 178L238 184V196L224 198Z" fill="#DDE2EC" stroke="#AEB5C4" strokeWidth="1.2" />
      {P(
        'M58 46C70 26 100 18 130 18C160 18 190 26 202 46L196 58C176 50 154 46 130 46C106 46 84 50 64 58Z',
        'onTampon',
        'Ön tampon',
      )}
      {P(
        'M64 62C86 54 108 50 130 50C152 50 174 54 196 62L190 160C172 154 152 152 130 152C108 152 88 154 70 160Z',
        'motorKaputu',
        'Motor kaputu',
      )}
      <path
        d="M72 166C92 160 110 158 130 158C150 158 168 160 188 166L176 208C162 204 146 202 130 202C114 202 98 204 84 208Z"
        fill="#DCE6F5"
        stroke="#AEB5C4"
        strokeWidth="1"
      />
      {P(
        'M86 214C100 210 114 208 130 208C146 208 160 210 174 214V318C160 322 146 324 130 324C114 324 100 322 86 318Z',
        'tavan',
        'Tavan',
      )}
      <path
        d="M86 324C100 328 114 330 130 330C146 330 160 328 174 324L186 362C168 368 150 370 130 370C110 370 92 368 74 362Z"
        fill="#DCE6F5"
        stroke="#AEB5C4"
        strokeWidth="1"
      />
      {P(
        'M72 368C92 374 110 376 130 376C150 376 168 374 188 368L194 440C176 446 154 448 130 448C106 448 84 446 66 440Z',
        'arkaKaput',
        'Arka kaput',
      )}
      {P(
        'M64 454C84 460 106 462 130 462C154 462 176 460 196 454L202 468C190 490 162 500 130 500C98 500 70 490 58 468Z',
        'arkaTampon',
        'Arka tampon',
      )}
      {P('M58 50L64 64L70 164H36V100C36 80 44 62 58 50Z', 'solOnCamurluk', 'Sol ön çamurluk')}
      {P('M36 170H76L86 212V268H36Z', 'solOnKapi', 'Sol ön kapı')}
      {P('M36 274H86V318L76 360H36Z', 'solArkaKapi', 'Sol arka kapı')}
      {P('M36 366H74L68 446L60 462C46 452 36 432 36 412Z', 'solArkaCamurluk', 'Sol arka çamurluk')}
      {P('M202 50L196 64L190 164H224V100C224 80 216 62 202 50Z', 'sagOnCamurluk', 'Sağ ön çamurluk')}
      {P('M224 170H184L174 212V268H224Z', 'sagOnKapi', 'Sağ ön kapı')}
      {P('M224 274H174V318L184 360H224Z', 'sagArkaKapi', 'Sağ arka kapı')}
      {P('M224 366H186L192 446L200 462C214 452 224 432 224 412Z', 'sagArkaCamurluk', 'Sağ arka çamurluk')}
      <text x="130" y="516" textAnchor="middle" fontSize="11" fontWeight="700" fill="#5A6073">
        ARKA
      </text>
    </svg>
  );
}
