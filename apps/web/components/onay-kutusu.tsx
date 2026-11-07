import { colors } from '@rengarenk/shared';
import type { CSSProperties, ReactNode } from 'react';

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
  mark = colors.ink,
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
        className="onay-kutu"
        style={{
          width: size,
          height: size,
          marginTop: 1,
          borderRadius: radius,
          border: `${border}px solid ${checked ? colors.blue : '#AEB5C4'}`,
          background: checked ? colors.blue : '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size - 7,
          fontWeight: 800,
          color: mark,
          flex: 'none',
          boxSizing: 'border-box',
        }}
      >
        {checked ? '✓' : ''}
      </span>
      <span>{children}</span>
    </label>
  );
}
