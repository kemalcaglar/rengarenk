'use client';

import { tints } from '@rengarenk/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { colors } from '../lib/renk';
import stil from './giris-ui.module.css';

/**
 * Giriş, üyelik ve şifre ekranlarının ortak parçaları (Karar 18; görünüm Giris.dc.html'deki giriş kartı ve sol
 * bilgi paneliyle aynı).
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Oturumsuz istek: `/api/...` site sunucusuna (yenileme çerezi), diğerleri doğrudan API'ye */
export async function post<T>(path: string, body: object): Promise<T> {
  const r = await fetch(path.startsWith('/api/') ? path : `${API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const m = data as { message?: string | string[]; issues?: { message: string }[] };
    throw new Error(
      m.issues?.[0]?.message ??
        (Array.isArray(m.message) ? m.message[0] : m.message) ??
        'Bir şeyler ters gitti',
    );
  }
  return data as T;
}

/** Giriş isteyen sayfadan gelindiyse (ör. talep sihirbazı) işlemden sonra oraya dönülür */
export function sonraAdresi(): string | null {
  if (typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search).get('sonra');
  return q?.startsWith('/') && !q.startsWith('//') ? q : null;
}

export const label = { display: 'block', fontSize: 13.5, fontWeight: 700, marginBottom: 6 } as const;
export const h1 = { margin: '0 0 6px', fontSize: 26, fontWeight: 800 } as const;
export const lead = { margin: '0 0 22px', fontSize: 14.5, color: colors.muted } as const;
export const note = { margin: '12px 0 0', fontSize: 12.5, color: colors.muted } as const;
export const field = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #D5DAE5',
  borderRadius: 'calc(var(--rr-buton-kose) * 12 / 14)',
  padding: 13,
  fontSize: 15,
  fontFamily: 'inherit',
} as const;
export const primary = (enabled = true) =>
  ({
    width: '100%',
    border: 0,
    background: enabled ? colors.blue : '#C9CFDB',
    borderRadius: 'var(--rr-buton-kose)',
    padding: 15,
    fontSize: 16,
    fontWeight: 800,
    color: enabled ? 'var(--rr-maviYazi, #1E2333)' : colors.ink,
    cursor: enabled ? 'pointer' : 'default',
    fontFamily: 'inherit',
  }) as const;
export const linkButton = {
  border: 0,
  background: 'transparent',
  color: colors.link,
  fontWeight: 700,
  fontSize: 14.5,
  padding: 0,
  cursor: 'pointer',
  fontFamily: 'inherit',
} as const;

export function Hata({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className={stil.metin1}>
      {children}
    </p>
  );
}

export function Bilgi({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="status" className={stil.metin2}>
      {children}
    </p>
  );
}

/** "ya da" ayracı */
export function Ayrac() {
  return (
    <div aria-hidden="true" className={stil.kutu1}>
      <span className={stil.metin3} />
      <span className={stil.metin4}>ya da</span>
      <span className={stil.metin3} />
    </div>
  );
}

/**
 * Google ile devam et: site sunucusu yönlendirme adresini alır, `state`'i httpOnly çereze yazar ve Google'a gönderir
 * (`/api/oturum/google/baslat`). Google'ın marka kuralına uygun beyaz düğme ve çok renkli "G".
 */
export function GoogleDugmesi({
  sonra,
  yazi = 'Google ile devam et',
}: {
  sonra?: string | null;
  yazi?: string;
}) {
  const href = `/api/oturum/google/baslat${sonra ? `?sonra=${encodeURIComponent(sonra)}` : ''}`;
  return (
    <a href={href} className={stil.bag1}>
      <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
        <path
          className={stil.gorsel1}
          d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.2C12.5 13.6 17.8 9.5 24 9.5z"
        />
        <path
          className={stil.gorsel2}
          d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-16.6z"
        />
        <path
          className={stil.gorsel3}
          d="M10.6 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.2C1 16.6 0 20.2 0 24s1 7.4 2.7 10.9l7.9-6.2z"
        />
        <path
          className={stil.gorsel4}
          d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.2C6.6 42.6 14.6 48 24 48z"
        />
      </svg>
      {yazi}
    </a>
  );
}

const AVANTAJLAR = [
  { text: 'İlk talebin ücretsiz', bg: tints.blue, dot: colors.blue },
  { text: 'Her gün 5 farklı talebe ücretsiz yaz', bg: tints.pink, dot: colors.pink },
  { text: 'Numaran yalnızca izin verirsen görünür', bg: tints.yellow, dot: colors.yellow },
  { text: 'Google ile tek dokunuşla giriş', bg: tints.green, dot: colors.green },
];

/** İki sütunlu giriş düzeni: solda avantajlar ve kurumsal başvuru, sağda form (Giris.dc.html) */
export function GirisDuzeni({ children, baslikId }: { children: ReactNode; baslikId: string }) {
  return (
    <main className={`rr-sayfa rr-giris ${stil.kutu2}`}>
      <section className={`rr-giris-yan ${stil.kutu3}`} aria-labelledby="neden">
        <h2 id="neden" className={stil.baslik1}>
          Tek hesapla hem al hem sat.
        </h2>
        <div className={stil.kutu4}>
          {AVANTAJLAR.map((a) => (
            <div key={a.text} className={stil.kutu5} style={{ background: a.bg }}>
              <span className={stil.metin5} style={{ background: a.dot }} aria-hidden="true" />
              <span className={stil.metin6}>{a.text}</span>
            </div>
          ))}
        </div>
        <div className={stil.kutu6}>
          <p className={stil.metin7}>Galeri, kiralama firması veya tekne galerisi misin?</p>
          <Link href="/kurumsal-basvuru" className={stil.bag2}>
            Kurumsal hesap başvurusu yap
          </Link>
        </div>
      </section>
      <section className={`rr-giris-form ${stil.kutu7}`} aria-labelledby={baslikId}>
        {children}
      </section>
    </main>
  );
}
