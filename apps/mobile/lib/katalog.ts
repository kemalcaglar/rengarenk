import { useEffect, useState } from 'react';
import { API } from './api';

export interface KatalogDegeri {
  make: string;
  series?: string;
  model?: string;
}
interface Satir {
  id: string;
  key: string;
  name: string;
}
interface SeriDetay {
  id: string;
  key: string;
  name: string;
  make: Satir;
  models: (Satir & { years: number[] })[];
  generations: {
    key: string;
    name: string;
    code: string | null;
    body: string | null;
    facelift: number | null;
    startYear: number;
    endYear: number | null;
  }[];
  trims: (Satir & { years: number[]; modelIds: string[] })[];
}

/** Kasa kuşağı grubu: "G20 · makyajlı", 2022 ve sonrası */
export interface Kusak {
  value: string;
  /** Son 15 yılda satışta olan kasa (varsayılan olarak gösterilir) */
  yeni?: boolean;
  label: string;
  alt: string;
  min: number;
  max: number;
}

const al = async <T>(path: string): Promise<T> => {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) throw new Error('Katalog okunamadı');
  return (await r.json()) as T;
};

/**
 * Talep kategorisinin katalog kategorisi. Ticari alt kategoriler ticari kataloğu, hasarlı talep seçilen araç
 * türünün kataloğunu kullanır; katalogda kayıt yoksa bütün markalar gösterilir.
 */
export function katalogKategorisi(slug: string, ust: string | null, aracTuru?: unknown): string | undefined {
  if (ust === 'ticari') return 'ticari';
  if (slug === 'hasarli') {
    const m: Record<string, string> = {
      otomobil: 'otomobil',
      arazi: 'arazi-suv-pickup',
      elektrikli: 'elektrikli',
      motosiklet: 'motosiklet',
      minivan: 'minivan-panelvan',
      ticari: 'ticari',
    };
    return typeof aracTuru === 'string' ? m[aracTuru] : undefined;
  }
  if (slug === 'kiralik') return 'otomobil';
  return slug;
}

const yil = new Date().getFullYear();

/** Katalog seçimini adım adım yükler; seçilen anahtarların adlarını da verir. */
export function useKatalog(kategori: string | undefined, v: KatalogDegeri | undefined) {
  const [makes, setMakes] = useState<Satir[] | null>(null);
  const [series, setSeries] = useState<Satir[] | null>(null);
  const [models, setModels] = useState<(Satir & { years?: number[] })[] | null>(null);
  const [detail, setDetail] = useState<SeriDetay | null>(null);

  useEffect(() => {
    let alive = true;
    setMakes(null);
    (async () => {
      let m = kategori ? await al<Satir[]>(`/catalog/makes?kategori=${kategori}`).catch(() => []) : [];
      if (m.length === 0) m = await al<Satir[]>('/catalog/makes');
      if (alive) setMakes(m);
    })().catch(() => alive && setMakes([]));
    return () => {
      alive = false;
    };
  }, [kategori]);

  const make = makes?.find((m) => m.key === v?.make);
  useEffect(() => {
    let alive = true;
    setSeries(null);
    setModels(null);
    if (!make) return;
    const q = kategori ? `?kategori=${kategori}` : '';
    (async () => {
      const s = await al<Satir[]>(`/catalog/makes/${make.id}/series${q}`);
      if (!alive) return;
      setSeries(s);
      // Seri katmanı olmayan kategoriler (motosiklet, ATV): markanın modelleri
      if (s.length === 0) setModels(await al<Satir[]>(`/catalog/makes/${make.id}/models${q}`));
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [make, kategori]);

  const seri = series?.find((s) => s.key === v?.series);
  useEffect(() => {
    let alive = true;
    setDetail(null);
    if (!seri) return;
    al<SeriDetay>(`/catalog/series/${seri.id}`)
      .then((d) => {
        if (!alive) return;
        setDetail(d);
        setModels(d.models);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [seri]);

  const model = models?.find((m) => m.key === v?.model);
  const modelYillari = (model as { years?: number[] } | undefined)?.years;

  // Kasa kuşakları: nesil kodu ve makyaj sırasına göre gruplanır (gövde tipleri tek seçenekte)
  const gruplar = new Map<string, Kusak>();
  for (const g of detail?.generations ?? []) {
    const bitis = g.endYear ?? yil;
    if (modelYillari?.length && !modelYillari.some((y) => y >= g.startYear && y <= bitis)) continue;
    const value = g.code ? `${g.code}:${g.facelift ?? 0}` : g.key;
    // Kodu olmayan kuşakta kaynaktaki İngilizce ad yerine kasa tipi yazılır (yıllar ikinci satırda)
    const label = g.code
      ? `${g.code} · ${g.facelift ? (g.facelift > 1 ? `${g.facelift}. makyaj` : 'makyajlı') : 'makyajsız'}`
      : (g.body ?? 'Kasa');
    const eski = gruplar.get(value);
    const min = Math.min(eski?.min ?? g.startYear, g.startYear);
    const max = Math.max(eski?.max ?? bitis, bitis);
    gruplar.set(value, {
      value,
      label,
      yeni: max >= yil - 15,
      min,
      max,
      alt: max >= yil ? `${min} ve sonrası` : `${min}–${max}`,
    });
  }
  const kusaklar = [...gruplar.values()].sort(
    (a, b) => a.min - b.min || a.label.localeCompare(b.label, 'tr'),
  );

  return {
    makes,
    series,
    models,
    detail,
    kusaklar,
    /** Seçilen modelin (ya da serinin) paketleri */
    paketler: (detail?.trims ?? []).filter((t) => !model || t.modelIds.includes(model.id)),
    adlar: { make: make?.name, series: seri?.name, model: model?.name },
    hazir: makes !== null,
  };
}
