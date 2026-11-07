import * as SecureStore from 'expo-secure-store';

const API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function post<T>(path: string, body: object): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { message?: string }).message ?? 'Bir şeyler ters gitti');
  return data as T;
}

/** Yenileme jetonu cihazın güvenli deposunda (Keychain / Keystore) tutulur. */
export const tokens = {
  save: (refreshToken: string) => SecureStore.setItemAsync('refreshToken', refreshToken),
  get: () => SecureStore.getItemAsync('refreshToken'),
  clear: () => SecureStore.deleteItemAsync('refreshToken'),
};
