'use client';

import { useEffect, useState } from 'react';

/** Tarayıcıdan API'ye istek (Bearer erişim jetonu). Jeton yalnızca bellekte durur (T09). */
export const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

let access: string | null = null;
let pending: Promise<string | null> | null = null;

/**
 * Erişim jetonunu yeniler. Yenileme jetonu her kullanımda döner ve eski jeton yeniden kullanılırsa bütün
 * oturumlar kapanır; bu yüzden aynı anda açık sekmeler yenilemeyi tarayıcı kilidiyle sırayla yapar
 * (sıradaki sekme çerezdeki yeni jetonu kullanır).
 */
export function yenile(): Promise<string | null> {
  if (pending) return pending;
  const run = async () => {
    const r = await fetch('/api/oturum/yenile', { method: 'POST' });
    access = r.ok ? ((await r.json()) as { accessToken: string }).accessToken : null;
    return access;
  };
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  pending = (locks ? locks.request('rr-oturum-yenile', run) : run()).finally(() => {
    pending = null;
  });
  return pending;
}

/** Geçerli erişim jetonu; yoksa yeniler (ham gövdeli istekler için) */
export const erisim = (): Promise<string | null> => (access ? Promise.resolve(access) : yenile());

export class ApiHatasi extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: { code?: string; issues?: { path: string; message: string }[] } & Record<string, unknown>,
  ) {
    super(message);
  }
}

/** Oturumlu istek; 401'de bir kez yenileyip tekrar dener. */
export async function istek<T>(
  path: string,
  init: { method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'; body?: unknown } = {},
): Promise<T> {
  const send = (token: string | null) =>
    fetch(`${API}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        // Özellik anahtarları platforma göre açılır (T13)
        'x-rr-platform': 'WEB',
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  let res = await send(access ?? (await yenile()));
  if (res.status === 401) res = await send(await yenile());
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const b = (data ?? {}) as ApiHatasi['body'] & { message?: string | string[] };
    const msg = b.issues?.[0]?.message ?? (Array.isArray(b.message) ? b.message[0] : b.message);
    throw new ApiHatasi(msg ?? 'İşlem yapılamadı', res.status, b);
  }
  return data as T;
}

/** Dosya yükler: gövde ham bayt, tür dosyanın kendi türü, ad `x-file-name` başlığında (galeri belgeleri). */
export async function dosyaYukle<T>(path: string, file: File): Promise<T> {
  const send = (token: string | null) =>
    fetch(`${API}${path}`, {
      method: 'POST',
      headers: {
        'content-type': file.type || 'application/octet-stream',
        'x-file-name': encodeURIComponent(file.name),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: file,
    });
  let res = await send(access ?? (await yenile()));
  if (res.status === 401) res = await send(await yenile());
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const b = (data ?? {}) as ApiHatasi['body'] & { message?: string | string[] };
    const msg = Array.isArray(b.message) ? b.message[0] : b.message;
    throw new ApiHatasi(
      res.status === 413
        ? 'Dosya en çok 10 MB olabilir'
        : res.status === 415
          ? 'Yalnızca PDF ya da fotoğraf yükleyebilirsin'
          : (msg ?? 'Dosya yüklenemedi'),
      res.status,
      b,
    );
  }
  return data as T;
}

/** Sayfa açılınca oturum var mı? `null`: bakılıyor, `false`: misafir. */
export function useGiris(): boolean | null {
  const [var_, setVar] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    (access ? Promise.resolve(access) : yenile()).then((t) => alive && setVar(Boolean(t)));
    return () => {
      alive = false;
    };
  }, []);
  return var_;
}

/** "2.100.000" */
export const binlik = (n: number | null | undefined) =>
  n === null || n === undefined || Number.isNaN(n) ? '' : new Intl.NumberFormat('tr-TR').format(n);

/** "2.100.000" → 2100000; boşsa undefined */
export const sayiOku = (s: string): number | undefined => {
  const d = s.replace(/\D/g, '');
  return d ? Number(d) : undefined;
};
