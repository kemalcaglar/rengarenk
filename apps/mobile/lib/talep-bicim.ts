import type { CategoryField } from '@rengarenk/shared';

/** Talep değerlerinin okunur hali (Liste.dc.html, Main.dc.html): "2019 ve sonrası", "En fazla 80.000 km" … */

export const binlik = (n: number | null | undefined) =>
  n === null || n === undefined ? '' : new Intl.NumberFormat('tr-TR').format(n);

export function yilAraligi(min?: number | null, max?: number | null) {
  if (min && max) return min === max ? `${min}` : `${min} – ${max}`;
  if (min) return `${min} ve sonrası`;
  if (max) return `${max} ve öncesi`;
  return '';
}

export function butceAraligi(min?: number | null, max?: number | null) {
  if (min && max && min !== max) return `${binlik(min)} – ${binlik(max)} TL`;
  if (max) return `En çok ${binlik(max)} TL`;
  if (min) return `En az ${binlik(min)} TL`;
  return '';
}

/** "Bugün", "Dün", "3 gün önce", sonra tarih */
export function zaman(iso: string | null | undefined) {
  if (!iso) return '';
  const gun = (d: Date) =>
    new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short' }).format(d);
  const d = new Date(iso);
  const now = new Date();
  if (gun(d) === gun(now)) return 'Bugün';
  if (gun(d) === gun(new Date(now.getTime() - 86_400_000))) return 'Dün';
  const n = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (n < 14) return `${n} gün önce`;
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: 'numeric',
    month: 'long',
  }).format(d);
}

export const uzunTarih = (iso: string | null | undefined) =>
  iso
    ? new Intl.DateTimeFormat('tr-TR', {
        timeZone: 'Europe/Istanbul',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(iso))
    : '';

const ad = (f: CategoryField, v: unknown) => f.options?.find((o) => o.value === v)?.label ?? String(v);

/** Bir alanın değeri; boşsa null. Katalog, boya ve konum alanları kendi bölümlerinde gösterilir. */
export function deger(f: CategoryField, v: unknown): string | null {
  if (v === undefined || v === null || v === '') return null;
  switch (f.type) {
    case 'multiselect':
      return Array.isArray(v) && v.length ? v.map((x) => ad(f, x)).join(', ') : null;
    case 'select':
      return ad(f, v);
    case 'boolean':
      return v ? 'Evet' : 'Hayır';
    case 'range': {
      const r = v as { min?: number; max?: number };
      if (f.key === 'yil') return yilAraligi(r.min, r.max);
      const u = f.unit ? ` ${f.unit}` : '';
      if (r.min !== undefined && r.max !== undefined) return `${binlik(r.min)} – ${binlik(r.max)}${u}`;
      return r.max !== undefined ? `En fazla ${binlik(r.max)}${u}` : `En az ${binlik(r.min)}${u}`;
    }
    case 'number': {
      const u = f.unit ? ` ${f.unit}` : '';
      const n = `${binlik(v as number)}${u}`;
      if (/\(en çok\)/.test(f.label)) return `En fazla ${n}`;
      if (/\(en az\)/.test(f.label)) return `En az ${n}`;
      return n;
    }
    case 'text':
      return String(v);
    case 'location': {
      const l = v as { il?: string; ilce?: string };
      return [l.il, l.ilce].filter(Boolean).join(', ') || null;
    }
    case 'daterange': {
      const r = v as { from?: string; to?: string };
      const t = (x?: string) =>
        x
          ? new Intl.DateTimeFormat('tr-TR', {
              timeZone: 'Europe/Istanbul',
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
            }).format(new Date(x))
          : '';
      return [t(r.from), t(r.to)].filter(Boolean).join(' – ');
    }
    default:
      return null;
  }
}

/** Alan adı kriter tablosunda: "Kilometre (en çok)" → "Kilometre" */
export const etiket = (f: CategoryField) => f.matchName ?? f.label.replace(/\s*\((en çok|en az)\)$/, '');
