import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
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

  return <Ctx.Provider value={{ durum, me, access, basla, cikis, yenileProfil }}>{children}</Ctx.Provider>;
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
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toLocaleUpperCase('tr-TR'))
    .join('') || '?';
