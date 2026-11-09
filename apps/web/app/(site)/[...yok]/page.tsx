import type { LandingBlock } from '@rengarenk/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AcilisSayfasi } from '../../../components/acilis';

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Sayfa {
  slug: string;
  seoBaslik: string;
  bloklar: LandingBlock[];
  onizleme: boolean;
}
type Props = {
  params: Promise<{ yok: string[] }>;
  searchParams: Promise<{ onizleme?: string }>;
};

/** Kök adresteki açılış sayfası (Karar 46): yalnızca tek parçalı adres; önizleme bağlantısıyla taslak */
async function sayfa({ params, searchParams }: Props): Promise<Sayfa | null> {
  const yol = (await params).yok;
  if (yol.length !== 1 || !/^[a-z0-9-]{3,60}$/.test(yol[0] as string)) return null;
  const { onizleme } = await searchParams;
  const q = onizleme ? `?onizleme=${encodeURIComponent(onizleme)}` : '';
  try {
    const r = await fetch(`${API}/acilis/${yol[0]}${q}`, { next: { revalidate: onizleme ? 0 : 60 } });
    return r.ok ? ((await r.json()) as Sayfa) : null;
  } catch {
    return null;
  }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const s = await sayfa(props);
  return s
    ? { title: s.seoBaslik, ...(s.onizleme ? { robots: { index: false, follow: false } } : {}) }
    : { title: 'Sayfa bulunamadı · Rengarenk' };
}

/** Tanımsız adresler "bulunamadı" sayfasına düşer; kök adreste yayında bir açılış sayfası varsa o gösterilir. */
export default async function Yok(props: Props) {
  const s = await sayfa(props);
  if (!s) notFound();
  return <AcilisSayfasi slug={s.slug} bloklar={s.bloklar} onizleme={s.onizleme} />;
}
