'use client';

import { type CategoryField, ILLER } from '@rengarenk/shared';
import type { CSSProperties, ReactNode } from 'react';
import { binlik, sayiOku } from '../../lib/istemci';
import { ButceKaydirici, useButceKolu } from './deney';

/** Sihirbazdaki ortak ölçüler (Sihirbaz.dc.html) */
export const etiket: CSSProperties = { display: 'block', fontSize: 13.5, fontWeight: 700, marginBottom: 8 };
export const kutu: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #D5DAE5',
  borderRadius: 'calc(var(--rr-buton-kose) * 12 / 14)',
  padding: 12,
  fontSize: 15,
  background: 'var(--rr-kart, #FFFFFF)',
  color: 'var(--rr-murekkep, #1E2333)',
  fontFamily: 'inherit',
};
export const secimKutusu: CSSProperties = { ...kutu, padding: '13px 12px' };
const gizli: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
};

/** Yuvarlak seçim çipi (Yakıt, Vites …); `hex` verilirse renk noktası, `alt` verilirse ikinci satır */
export function Cip({
  on,
  children,
  hex,
  alt,
  onClick,
}: {
  on: boolean;
  children: ReactNode;
  hex?: string;
  alt?: string;
  onClick: () => void;
}) {
  const kare = Boolean(alt);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      style={{
        display: hex ? 'flex' : 'inline-block',
        alignItems: 'center',
        gap: 7,
        textAlign: 'left',
        border: on ? '1.5px solid var(--rr-mavi, #5B8CFF)' : '1px solid #D5DAE5',
        background: on ? '#EEF3FF' : 'var(--rr-kart, #FFFFFF)',
        borderRadius: kare ? 'var(--rr-buton-kose)' : 'var(--rr-etiket-kose)',
        padding: kare
          ? on
            ? '9px 14px'
            : '9.5px 14.5px'
          : hex
            ? on
              ? '7px 13px 7px 8px'
              : '7.5px 13.5px 7.5px 8.5px'
            : on
              ? '8px 14px'
              : '8.5px 14.5px',
        fontSize: 14,
        fontWeight: on ? 700 : 600,
        color: on ? 'var(--rr-murekkep, #1E2333)' : '#3A4052',
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {hex ? (
        <span
          aria-hidden="true"
          style={{ width: 18, height: 18, borderRadius: '50%', background: hex, border: '1px solid #AEB5C4' }}
        />
      ) : null}
      {children}
      {alt ? (
        <span
          style={{
            display: 'block',
            fontSize: 12,
            fontWeight: on ? 600 : 500,
            color: on ? 'var(--rr-baglanti, #2450C8)' : 'var(--rr-soluk, #5A6073)',
            marginTop: 1,
          }}
        >
          {alt}
        </span>
      ) : null}
    </button>
  );
}

/** Aç-kapa (Sihirbaz 5. adım: telefon, WhatsApp) */
export function Anahtar({
  on,
  label,
  renk = 'var(--rr-mavi, #5B8CFF)',
  disabled,
  onClick,
}: {
  on: boolean;
  label: string;
  renk?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        flex: 'none',
        width: 52,
        height: 30,
        border: 0,
        borderRadius: 'var(--rr-etiket-kose)',
        background: on ? renk : '#C9CFDB',
        position: 'relative',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: on ? 25 : 3,
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: 'var(--rr-kart, #FFFFFF)',
        }}
      />
    </button>
  );
}

type Aralik = { min?: number; max?: number };

/** Şemadaki bir alanı çizer. Katalog, boya ve konum alanları kendi bileşenleriyle gelir. */
export function Alan({
  f,
  value,
  onChange,
  hata,
}: {
  f: CategoryField;
  value: unknown;
  onChange: (v: unknown) => void;
  hata?: string;
}) {
  const id = `alan-${f.key}`;
  const ad = `${f.label}${f.unit && f.type !== 'number' ? ` (${f.unit})` : ''}`;
  const butceKolu = useButceKolu();
  const alt = hata ? (
    <span
      role="alert"
      style={{ display: 'block', fontSize: 12.5, color: '#A3271F', fontWeight: 700, marginTop: 6 }}
    >
      {hata}
    </span>
  ) : f.help ? (
    <span style={{ display: 'block', fontSize: 12.5, color: 'var(--rr-soluk, #5A6073)', marginTop: 6 }}>
      {f.help}
    </span>
  ) : null;

  if (f.type === 'multiselect' || (f.type === 'select' && (f.options?.length ?? 0) <= 10)) {
    const coklu = f.type === 'multiselect';
    const secili = coklu ? ((value as string[] | undefined) ?? []) : value ? [value as string] : [];
    const renkli = f.options?.some((o) => o.hex);
    const sec = (v: string) => {
      if (coklu) {
        const next = secili.includes(v) ? secili.filter((x) => x !== v) : [...secili, v];
        onChange(next.length ? next : undefined);
      } else onChange(secili[0] === v ? undefined : v);
    };
    return (
      <div>
        <span style={etiket}>{ad}</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(f.options ?? []).map((o) => (
            <Cip key={o.value} on={secili.includes(o.value)} hex={o.hex} onClick={() => sec(o.value)}>
              {o.label}
            </Cip>
          ))}
          {coklu && renkli ? (
            <Cip on={secili.length === 0} hex="#F3F5FA" onClick={() => onChange(undefined)}>
              Fark etmez
            </Cip>
          ) : null}
        </div>
        {alt}
      </div>
    );
  }
  if (f.type === 'select') {
    return (
      <div>
        <label htmlFor={id} style={{ ...etiket, marginBottom: 6 }}>
          {ad}
        </label>
        <select
          id={id}
          value={(value as string | undefined) ?? ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          style={secimKutusu}
        >
          <option value="">Seç</option>
          {(f.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {alt}
      </div>
    );
  }
  if (f.type === 'boolean') {
    const v = value as boolean | undefined;
    return (
      <div>
        <span style={etiket}>{f.label}</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Cip on={v === true} onClick={() => onChange(v === true ? undefined : true)}>
            Evet
          </Cip>
          <Cip on={v === false} onClick={() => onChange(v === false ? undefined : false)}>
            Hayır
          </Cip>
          <Cip on={v === undefined} onClick={() => onChange(undefined)}>
            Fark etmez
          </Cip>
        </div>
        {alt}
      </div>
    );
  }
  // Bütçe adımı deneyinin A kolu: kaydırıcı (B kolu ve varsayılan: tasarımdaki iki kutu)
  if (f.type === 'range' && f.key === 'butce' && butceKolu === 'A') {
    return (
      <ButceKaydirici
        id={id}
        ad={ad}
        deger={(value as Aralik | undefined) ?? {}}
        onChange={onChange}
        alt={alt}
      />
    );
  }
  if (f.type === 'range') {
    const v = (value as Aralik | undefined) ?? {};
    const para = f.unit === 'TL' || (f.max ?? 0) > 10_000;
    const set = (k: 'min' | 'max', s: string) => {
      const n = sayiOku(s);
      const next = { ...v, [k]: n };
      if (next.min === undefined) delete next.min;
      if (next.max === undefined) delete next.max;
      onChange(next.min === undefined && next.max === undefined ? undefined : next);
    };
    return (
      <div>
        <span style={{ ...etiket, marginBottom: 6 }}>{ad}</span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            maxWidth: f.key === 'butce' ? 520 : undefined,
          }}
        >
          <label htmlFor={`${id}-1`} style={gizli}>
            En az {f.label.toLocaleLowerCase('tr-TR')}
          </label>
          <input
            id={`${id}-1`}
            inputMode="numeric"
            placeholder="En az"
            value={para ? binlik(v.min) : (v.min ?? '')}
            onChange={(e) => set('min', e.target.value)}
            style={{ ...kutu, flex: 1, minWidth: 0, width: 'auto' }}
          />
          <span style={{ color: 'var(--rr-soluk, #5A6073)' }}>–</span>
          <label htmlFor={`${id}-2`} style={gizli}>
            En çok {f.label.toLocaleLowerCase('tr-TR')}
          </label>
          <input
            id={`${id}-2`}
            inputMode="numeric"
            placeholder="En çok"
            value={para ? binlik(v.max) : (v.max ?? '')}
            onChange={(e) => set('max', e.target.value)}
            style={{ ...kutu, flex: 1, minWidth: 0, width: 'auto' }}
          />
        </div>
        {alt}
      </div>
    );
  }
  if (f.type === 'number') {
    const v = value as number | undefined;
    return (
      <div>
        <label htmlFor={id} style={{ ...etiket, marginBottom: 6 }}>
          {f.key === 'km' ? 'En fazla kilometre' : f.label}
          {f.unit && f.key !== 'km' ? ` (${f.unit})` : ''}
        </label>
        <input
          id={id}
          inputMode="numeric"
          value={(f.max ?? 0) >= 10_000 ? binlik(v) : (v ?? '')}
          onChange={(e) => onChange(sayiOku(e.target.value))}
          style={kutu}
        />
        {alt}
      </div>
    );
  }
  if (f.type === 'text') {
    return (
      <div>
        <label htmlFor={id} style={{ ...etiket, marginBottom: 6 }}>
          {f.label}
        </label>
        <textarea
          id={id}
          rows={f.key === 'aciklama' ? 4 : 2}
          maxLength={2000}
          value={(value as string | undefined) ?? ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          style={{ ...kutu, lineHeight: 1.55, resize: 'vertical' }}
        />
        {f.key === 'aciklama' ? (
          <span style={{ display: 'block', fontSize: 12.5, color: 'var(--rr-soluk, #5A6073)', marginTop: 4 }}>
            Telefon numarası, IBAN veya bağlantı yazmayın; iletişim bilgileri aşağıdaki ayarlarla paylaşılır.
          </span>
        ) : (
          alt
        )}
      </div>
    );
  }
  if (f.type === 'location') return <Konum f={f} value={value} onChange={onChange} hata={hata} />;
  if (f.type === 'daterange') {
    const v = (value as { from?: string; to?: string } | undefined) ?? {};
    const yerel = (iso?: string) =>
      iso
        ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60_000)
            .toISOString()
            .slice(0, 16)
        : '';
    const set = (k: 'from' | 'to', s: string) => {
      const next = { ...v, [k]: s ? new Date(s).toISOString() : undefined };
      onChange(next.from || next.to ? next : undefined);
    };
    return (
      <div>
        <span style={{ ...etiket, marginBottom: 6 }}>{f.label}</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <label htmlFor={`${id}-1`} style={gizli}>
            Alış
          </label>
          <input
            id={`${id}-1`}
            type="datetime-local"
            value={yerel(v.from)}
            onChange={(e) => set('from', e.target.value)}
            style={{ ...kutu, flex: 1, minWidth: 200, width: 'auto' }}
          />
          <span style={{ color: 'var(--rr-soluk, #5A6073)' }}>–</span>
          <label htmlFor={`${id}-2`} style={gizli}>
            İade
          </label>
          <input
            id={`${id}-2`}
            type="datetime-local"
            value={yerel(v.to)}
            onChange={(e) => set('to', e.target.value)}
            style={{ ...kutu, flex: 1, minWidth: 200, width: 'auto' }}
          />
        </div>
        {alt}
      </div>
    );
  }
  return null;
}

/** İl ve ilçe seçimi (81 il, 973 ilçe) */
export function Konum({
  f,
  value,
  onChange,
  hata,
}: {
  f: CategoryField;
  value: unknown;
  onChange: (v: unknown) => void;
  hata?: string;
}) {
  const v = (value as { il?: string; ilce?: string } | undefined) ?? {};
  const il = ILLER.find((i) => i.ad === v.il);
  const ikinci = f.key !== 'konum';
  return (
    <div style={{ gridColumn: ikinci ? undefined : '1 / -1' }}>
      {ikinci ? <span style={{ ...etiket, marginBottom: 6 }}>{f.label}</span> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
        <div>
          <label htmlFor={`${f.key}-il`} style={{ ...etiket, marginBottom: 6 }}>
            İl
          </label>
          <select
            id={`${f.key}-il`}
            value={v.il ?? ''}
            onChange={(e) => onChange(e.target.value ? { il: e.target.value } : undefined)}
            style={secimKutusu}
          >
            <option value="">Seç</option>
            {ILLER.map((i) => (
              <option key={i.plaka} value={i.ad}>
                {i.ad}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${f.key}-ilce`} style={{ ...etiket, marginBottom: 6 }}>
            İlçe
          </label>
          <select
            id={`${f.key}-ilce`}
            value={v.ilce ?? ''}
            disabled={!il}
            onChange={(e) => onChange({ il: v.il, ...(e.target.value ? { ilce: e.target.value } : {}) })}
            style={secimKutusu}
          >
            <option value="">{il ? 'Tüm ilçeler' : 'Önce il seç'}</option>
            {(il?.ilceler ?? []).map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>
      </div>
      {hata ? (
        <span
          role="alert"
          style={{ display: 'block', fontSize: 12.5, color: '#A3271F', fontWeight: 700, marginTop: 6 }}
        >
          {hata}
        </span>
      ) : null}
    </div>
  );
}
