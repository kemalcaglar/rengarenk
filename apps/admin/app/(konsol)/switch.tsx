'use client';

/** Aç-kapa düğmesi (tasarım: YonetimSistem). `danger`: açıkken kırmızı (bakım modu). */
export function Switch({
  on,
  label,
  danger,
  disabled,
  onChange,
}: {
  on: boolean;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`k-switch${danger ? ' k-danger' : ''}`}
      disabled={disabled}
      onClick={onChange}
    >
      <span className="k-track">
        <span className="k-knob" />
      </span>
    </button>
  );
}
