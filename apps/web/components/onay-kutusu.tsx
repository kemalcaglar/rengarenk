import type { CSSProperties, ReactNode } from 'react';
import { cx } from '../lib/cx';
import { colors } from '../lib/renk';
import stil from './onay-kutusu.module.css';

/**
 * Tasarımdaki onay kutusu (Giris.dc.html, Anasayfa.dc.html çerez paneli): gerçek bir checkbox, üstünde tasarımın
 * kutu görünümü. Klavye ve ekran okuyucu yerel davranışı kullanır.
 */
export function OnayKutusu({
  checked,
  onChange,
  children,
  size = 20,
  radius = 6,
  border = 1.5,
  mark = colors.onBlue,
  style,
  required,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  size?: number;
  radius?: number;
  border?: number;
  mark?: string;
  style?: CSSProperties;
  required?: boolean;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        cursor: 'pointer',
        position: 'relative',
        ...style,
      }}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        required={required}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden="true"
        className={cx('onay-kutu', stil.metin1, checked ? stil.metin2 : stil.metin3)}
        style={{
          width: size,
          height: size,
          borderRadius: `calc(var(--rr-buton-kose) * ${radius} / 14)`,
          border: `${border}px solid ${checked ? colors.blue : '#AEB5C4'}`,
          fontSize: size - 7,
          color: mark,
        }}
      >
        {checked ? '✓' : ''}
      </span>
      <span>{children}</span>
    </label>
  );
}
