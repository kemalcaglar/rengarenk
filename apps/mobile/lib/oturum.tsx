import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { API, tokens } from './api';

export interface Me {
  id: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string;
  email: string | null;
  memberships: { role: string; account: { kind: 'INDIVIDUAL' | 'BUSINESS'; name: string } }[];
}

interface Oturum {
  durum: 'yukleniyor' | 'misafir' | 'uye';
  me: Me | null;
  access: string | null;
  /** Doğrulamadan dönen jetonlarla oturumu başlatır */
  basla: (pair: { accessToken: string; refreshToken: string }) => Promise<void>;
  cikis: () => Promise<void>;
  yenileProfil: () => Promise<void>;
  /** Oturumlu API isteği; erişim jetonunun süresi dolduysa bir kez yeniler ve tekrar dener */
  istek: <T>(
    path: string,
    init?: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown },
  ) => Promise<T>;
}

/** API hatası: ileti, durum kodu ve alan hataları */
export class IstekHatasi extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: { code?: string; issues?: { path: string; message: string }[] } & Record<string, unknown>,
  ) {
    super(message);
  }
}

const Ctx = createContext<Oturum | null>(null);

async function json<T>(path: string, init: RequestInit = {}, access?: string | null): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(access ? { authorization: `Bearer ${access}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!r.ok) throw new Error(String(r.status));
  return (r.status === 204 ? null : await r.json()) as T;
}

/**
 * Mobil oturum (T09): yenileme jetonu cihazın güvenli deposunda, erişim jetonu yalnızca bellekte. Uygulama
 * açılınca jeton yenilenir (eski jeton geçersiz olur) ve profil okunur.
 */
export function OturumProvider({ children }: { children: ReactNode }) {
  const [durum, setDurum] = useState<Oturum['durum']>('yukleniyor');
  const [me, setMe] = useState<Me | null>(null);
  const [access, setAccess] = useState<string | null>(null);

  const profil = useCallback(async (token: string) => {
    setMe(await json<Me>('/me', {}, token));
  }, []);

  useEffect(() => {
    (async () => {
      const refresh = await tokens.get();
      if (!refresh) return setDurum('misafir');
      try {
        const pair = await json<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: refresh }),
        });
        await tokens.save(pair.refreshToken);
        setAccess(pair.accessToken);
        await profil(pair.accessToken);
        setDurum('uye');
      } catch {
        await tokens.clear();
        setDurum('misafir');
      }
    })();
  }, [profil]);

  const basla = useCallback(
    async (pair: { accessToken: string; refreshToken: string }) => {
      await tokens.save(pair.refreshToken);
      setAccess(pair.accessToken);
      await profil(pair.accessToken).catch(() => undefined);
      setDurum('uye');
    },
    [profil],
  );

  const cikis = useCallback(async () => {
    if (access) await json('/auth/logout', { method: 'POST' }, access).catch(() => undefined);
    await tokens.clear();
    setAccess(null);
    setMe(null);
    setDurum('misafir');
  }, [access]);

  const yenileProfil = useCallback(async () => {
    if (access) await profil(access);
  }, [access, profil]);

  // Jeton yenileme tek seferde yapılır: eş zamanlı iki istek aynı yenileme jetonunu iki kez kullanırsa
  // sunucu çalıntı sayıp bütün oturumları kapatır (T09).
  const accessRef = useRef<string | null>(null);
  accessRef.current = access;
  const bekleyen = useRef<Promise<string | null> | null>(null);
  const yenile = useCallback(() => {
    if (bekleyen.current) return bekleyen.current;
    bekleyen.current = (async () => {
      const refresh = await tokens.get();
      if (!refresh) return null;
      try {
        const pair = await json<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: refresh }),
        });
        await tokens.save(pair.refreshToken);
        setAccess(pair.accessToken);
        accessRef.current = pair.accessToken;
        return pair.accessToken;
      } catch {
        await tokens.clear();
        setAccess(null);
        setMe(null);
        setDurum('misafir');
        return null;
      }
    })().finally(() => {
      bekleyen.current = null;
    });
    return bekleyen.current;
  }, []);

  const istek = useCallback(
    async <T,>(
      path: string,
      init: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown } = {},
    ): Promise<T> => {
      const send = (token: string | null) =>
        fetch(`${API}${path}`, {
          method: init.method ?? 'GET',
          headers: {
            ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body: init.body === undefined ? undefined : JSON.stringify(init.body),
        });
      let r = await send(accessRef.current);
      if (r.status === 401) r = await send(await yenile());
      const data = r.status === 204 ? null : await r.json().catch(() => null);
      if (!r.ok) {
        const b = (data ?? {}) as IstekHatasi['body'] & { message?: string | string[] };
        const msg = b.issues?.[0]?.message ?? (Array.isArray(b.message) ? b.message[0] : b.message);
        throw new IstekHatasi(msg ?? 'İşlem yapılamadı', r.status, b);
      }
      return data as T;
    },
    [yenile],
  );

  return (
    <Ctx.Provider value={{ durum, me, access, basla, cikis, yenileProfil, istek }}>{children}</Ctx.Provider>
  );
}

export function useOturum(): Oturum {
  const v = useContext(Ctx);
  if (!v) throw new Error('OturumProvider eksik');
  return v;
}

/** Baş harfler: "Ayşe Yılmaz" → "AY" */
export const basHarf = (ad?: string | null) =>
  (ad ?? '')
    .split(/\s+/)
    // yalnızca harfle başlayan sözcükler: "Sahip (geliştirme)" → "S"
    .filter((p) => /^\p{L}/u.test(p))
    .slice(0, 2)
    .map((p) => p.charAt(0).toLocaleUpperCase('tr-TR'))
    .join('') || '?';
