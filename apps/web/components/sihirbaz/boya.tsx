'use client';

import { PAINT_PARTS, PAINT_STATES } from '@rengarenk/shared';

export type BoyaDegeri = { limit: number; parts: Partial<Record<string, string>> };
type Durum = (typeof PAINT_STATES)[number]['key'];

const renk = (k: string | undefined) =>
  PAINT_STATES.find((s) => s.key === (k ?? 'orijinal'))?.renk ?? '#EEF0F5';

/**
 * Boya ve değişen tercihi (Sihirbaz.dc.html 4. adım): şema seçimlere göre renklenir. Portföy aracında (`beyan`) her
 * parçanın gerçek durumu girilir; "en fazla kaç parça" sorusu yoktur.
 */
export function BoyaSemasi({
  value,
  onChange,
  beyan,
}: {
  value?: BoyaDegeri;
  onChange: (v: BoyaDegeri) => void;
  beyan?: boolean;
}) {
  const v: BoyaDegeri = value ?? { limit: 0, parts: {} };
  const bd = (k: string) => renk(v.parts[k]);
  const hepsi = (k: Durum) =>
    onChange({ ...v, parts: Object.fromEntries(PAINT_PARTS.map((p) => [p.key, k])) });
  const ikincil = {
    border: '1px solid #D5DAE5',
    background: '#FFFFFF',
    borderRadius: 'var(--rr-etiket-kose)',
    padding: '8px 14px',
    fontSize: 13.5,
    fontWeight: 700,
    color: 'var(--rr-murekkep, #1E2333)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  } as const;
  const sayac = {
    width: 36,
    height: 36,
    border: '1px solid #D5DAE5',
    background: '#FFFFFF',
    borderRadius: 10,
    fontSize: 18,
    fontWeight: 700,
    cursor: 'pointer',
  } as const;
  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
        <button type="button" onClick={() => hepsi('orijinal')} style={ikincil}>
          {beyan ? 'Tümü orijinal' : 'Tümü orijinal olsun'}
        </button>
        {beyan ? null : (
          <>
            <button type="button" onClick={() => hepsi('lokal')} style={ikincil}>
              Tümünde lokal boya kabul
            </button>
            <button type="button" onClick={() => hepsi('boya')} style={ikincil}>
              Tümünde boya kabul
            </button>
          </>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 28 }}>
        <div
          style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}
        >
          <svg
            width="220"
            height="440"
            viewBox="0 0 260 520"
            role="img"
            aria-label="Seçimlerine göre renklenen üstten araç şeması"
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
            <path
              d="M58 46C70 26 100 18 130 18C160 18 190 26 202 46L196 58C176 50 154 46 130 46C106 46 84 50 64 58Z"
              style={{ fill: bd('onTampon') }}
              stroke="#AEB5C4"
              strokeWidth="1.5"
            />
            <path
              d="M64 62C86 54 108 50 130 50C152 50 174 54 196 62L190 160C172 154 152 152 130 152C108 152 88 154 70 160Z"
              style={{ fill: bd('motorKaputu') }}
              stroke="#AEB5C4"
              strokeWidth="1.5"
            />
            <path
              d="M72 166C92 160 110 158 130 158C150 158 168 160 188 166L176 208C162 204 146 202 130 202C114 202 98 204 84 208Z"
              fill="#DCE6F5"
              stroke="#AEB5C4"
              strokeWidth="1"
            />
            <path
              d="M86 214C100 210 114 208 130 208C146 208 160 210 174 214V318C160 322 146 324 130 324C114 324 100 322 86 318Z"
              style={{ fill: bd('tavan') }}
              stroke="#AEB5C4"
              strokeWidth="1.5"
            />
            <path
              d="M86 324C100 328 114 330 130 330C146 330 160 328 174 324L186 362C168 368 150 370 130 370C110 370 92 368 74 362Z"
              fill="#DCE6F5"
              stroke="#AEB5C4"
              strokeWidth="1"
            />
            <path
              d="M72 368C92 374 110 376 130 376C150 376 168 374 188 368L194 440C176 446 154 448 130 448C106 448 84 446 66 440Z"
              style={{ fill: bd('arkaKaput') }}
              stroke="#AEB5C4"
              strokeWidth="1.5"
            />
            <path
              d="M64 454C84 460 106 462 130 462C154 462 176 460 196 454L202 468C190 490 162 500 130 500C98 500 70 490 58 468Z"
              style={{ fill: bd('arkaTampon') }}
              stroke="#AEB5C4"
              strokeWidth="1.5"
            />
            <path
              d="M58 50L64 64L70 164H36V100C36 80 44 62 58 50Z"
              style={{ fill: bd('solOnCamurluk') }}
              stroke="#AEB5C4"
              strokeWidth="1.5"
            />
            <path
              d="M36 170H76L86 212V268H36Z"
              style={{ fill: bd('solOnKapi') }}
              stroke="#AEB5C4"
              strokeWidth="1.5"
            />
            <path
              d="M36 274H86V318L76 360H36Z"
              style={{ fill: bd('solArkaKapi') }}
              stroke="#AEB5C4"
              strokeWidth="1.5"
            />
            <path
              d="M36 366H74L68 446L60 462C46 452 36 432 36 412Z"
              style={{ fill: bd('solArkaCamurluk') }}
              stroke="#AEB5C4"
              strokeWidth="1.5"
            />
            <path
              d="M202 50L196 64L190 164H224V100C224 80 216 62 202 50Z"
              style={{ fill: bd('sagOnCamurluk') }}
              stroke="#AEB5C4"
              strokeWidth="1.5"
            />
            <path
              d="M224 170H184L174 212V268H224Z"
              style={{ fill: bd('sagOnKapi') }}
              stroke="#AEB5C4"
              strokeWidth="1.5"
            />
            <path
              d="M224 274H174V318L184 360H224Z"
              style={{ fill: bd('sagArkaKapi') }}
              stroke="#AEB5C4"
              strokeWidth="1.5"
            />
            <path
              d="M224 366H186L192 446L200 462C214 452 224 432 224 412Z"
              style={{ fill: bd('sagArkaCamurluk') }}
              stroke="#AEB5C4"
              strokeWidth="1.5"
            />
            <text x="130" y="516" textAnchor="middle" fontSize="11" fontWeight="700" fill="#5A6073">
              ARKA
            </text>
          </svg>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '6px 14px',
              fontSize: 12.5,
              color: '#3A4052',
            }}
          >
            {PAINT_STATES.map((s) => (
              <span key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    background: s.renk,
                    border: '1px solid #AEB5C4',
                  }}
                />
                {s.ad}
              </span>
            ))}
          </div>
        </div>
        <div style={{ flex: '1 1 380px', minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid #EEF0F5',
              borderRadius: 'var(--rr-buton-kose)',
              overflow: 'hidden',
            }}
          >
            {PAINT_PARTS.map((p) => (
              <div
                key={p.key}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '9px 12px',
                  borderBottom: '1px solid #EEF0F5',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600 }}>{p.ad}</span>
                <fieldset
                  style={{ display: 'flex', gap: 4, border: 0, margin: 0, padding: 0 }}
                  aria-label={p.ad}
                >
                  {PAINT_STATES.map((s) => {
                    const on = (v.parts[p.key] ?? 'orijinal') === s.key;
                    return (
                      <button
                        key={s.key}
                        type="button"
                        aria-pressed={on}
                        onClick={() => onChange({ ...v, parts: { ...v.parts, [p.key]: s.key } })}
                        style={{
                          border: on ? '1.5px solid #4A5064' : '1px solid #D5DAE5',
                          background: on ? s.renk : '#FFFFFF',
                          borderRadius: 8,
                          padding: on ? '6px 9px' : '6.5px 9.5px',
                          fontSize: 12.5,
                          fontWeight: on ? 800 : 600,
                          color: on ? 'var(--rr-murekkep, #1E2333)' : '#5A6073',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        {s.ad}
                      </button>
                    );
                  })}
                </fieldset>
              </div>
            ))}
          </div>
          {beyan ? null : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                marginTop: 14,
                background: '#F3F5FA',
                borderRadius: 'calc(var(--rr-buton-kose) - 2px)',
                padding: '12px 14px',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                Toplamda en fazla kaç parça işlem görmüş olabilir?
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  aria-label="Azalt"
                  onClick={() => onChange({ ...v, limit: Math.max(0, v.limit - 1) })}
                  style={sayac}
                >
                  −
                </button>
                <span style={{ minWidth: 24, textAlign: 'center', fontSize: 17, fontWeight: 800 }}>
                  {v.limit}
                </span>
                <button
                  type="button"
                  aria-label="Artır"
                  onClick={() => onChange({ ...v, limit: Math.min(PAINT_PARTS.length, v.limit + 1) })}
                  style={sayac}
                >
                  +
                </button>
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/** "En fazla 2 parçada işlem; değişen kabul edilmiyor" */
export function boyaOzeti(v?: BoyaDegeri) {
  if (!v) return 'Belirtilmedi';
  const degisen = Object.values(v.parts).some((x) => x === 'degisen');
  return `En fazla ${v.limit} parçada işlem; ${degisen ? 'bazı parçalarda değişen kabul' : 'değişen kabul edilmiyor'}`;
}
