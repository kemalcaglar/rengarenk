import type { CategoryDefinition, CategoryField, DefinitionDiff } from '@rengarenk/shared';

/** Konsol › Kategoriler ve Eşleştirme ayarı ekranlarının ortak tipleri ve yardımcıları. */

export interface TreeRow {
  id: string;
  slug: string;
  name: string;
  vertical: string;
  parentId: string | null;
  enabled: boolean;
  color: string | null;
  dot: string;
  published: { version: number; publishedAt: string | null } | null;
  draft: { version: number; status: 'DRAFT' | 'PENDING'; changes: number } | null;
  hasChildren: boolean;
  activeDemands: number;
}

export interface Person {
  id: string;
  name: string;
}

export interface VersionRow {
  version: number;
  status: 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'RETIRED';
  changes: string[];
  restoredFrom: number | null;
  createdBy: Person | null;
  publishedBy: Person | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Detail {
  category: {
    id: string;
    slug: string;
    name: string;
    vertical: string;
    parentId: string | null;
    enabled: boolean;
    color: string | null;
    hasChildren: boolean;
    activeDemands: number;
  };
  published: { version: number; publishedAt: string | null; definition: CategoryDefinition } | null;
  draft: {
    version: number;
    status: 'DRAFT' | 'PENDING';
    definition: CategoryDefinition;
    diff: DefinitionDiff;
    restoredFrom: number | null;
    updatedAt: string;
    approval: { id: string; status: string; requestedBy: string; createdAt: string } | null;
  } | null;
  versions: VersionRow[];
}

/** Taslak varsa taslak, yoksa yayındaki tanım. */
export const currentDefinition = (d: Detail): CategoryDefinition | null =>
  d.draft?.definition ?? d.published?.definition ?? null;

export const sayi = (n: number) => new Intl.NumberFormat('tr-TR').format(n);

/** "12 Eki" (İstanbul saati) */
export const kisaTarih = (iso: string | null | undefined) =>
  iso
    ? new Intl.DateTimeFormat('tr-TR', {
        timeZone: 'Europe/Istanbul',
        day: 'numeric',
        month: 'short',
      }).format(new Date(iso))
    : '';

/** Seçenek adından kod: "LPG & Benzin" → "lpg_benzin" */
export function optionKey(label: string, taken: Set<string>): string {
  const base =
    label
      .toLocaleLowerCase('tr-TR')
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 36) || 'secenek';
  let out = base;
  for (let n = 2; taken.has(out); n++) out = `${base}_${n}`;
  taken.add(out);
  return out;
}

/** Tanımdaki bir alanı değiştirip yeni tanım döndürür. */
export function withField(def: CategoryDefinition, key: string, patch: Partial<CategoryField> | null) {
  return {
    ...def,
    fields:
      patch === null
        ? def.fields.filter((f) => f.key !== key)
        : def.fields.map((f) => (f.key === key ? { ...f, ...patch } : f)),
  };
}

export const SURUM_DURUM: Record<VersionRow['status'], { ad: string; bg: string; fg: string }> = {
  DRAFT: { ad: 'Taslak', bg: '#FFF6DF', fg: '#7A5300' },
  PENDING: { ad: 'Onayda', bg: '#FFF6DF', fg: '#7A5300' },
  PUBLISHED: { ad: 'Yayında', bg: '#E7FAF0', fg: '#11683F' },
  RETIRED: { ad: 'Eski', bg: '#F3F5FA', fg: '#5A6073' },
};
