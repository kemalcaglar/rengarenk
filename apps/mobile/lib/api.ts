import * as SecureStore from 'expo-secure-store';

export const API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

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

/** 32 onaltılık hane: varsa güvenli rastgele kaynak, yoksa Math.random (kimlik gizli değildir, yalnızca tekildir) */
function rastgeleKimlik() {
  const b = new Uint8Array(16);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) c.getRandomValues(b);
  else for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256);
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

let kurulum: string | null = null;
/**
 * Uygulama kurulum kimliği (cihaz kara listesi, Karar 43): ilk açılışta üretilir, güvenli depoda kalır ve girişte
 * gönderilir. Uygulama silinip yeniden kurulursa yenisi üretilir.
 */
export async function kurulumKimligi(): Promise<string> {
  if (kurulum) return kurulum;
  let k = await SecureStore.getItemAsync('kurulum');
  if (!k) {
    k = rastgeleKimlik();
    await SecureStore.setItemAsync('kurulum', k);
  }
  kurulum = k;
  return k;
}

let ziyaretci: string | null = null;
/**
 * A/B testinde kolu sabit tutan rastgele kimlik (giriş yapmamış kullanıcı); kurulum kimliğinden ayrıdır, sunucuda
 * saklanmaz.
 */
export async function ziyaretciKimligi(): Promise<string> {
  if (ziyaretci) return ziyaretci;
  let z = await SecureStore.getItemAsync('ab');
  if (!z) {
    z = rastgeleKimlik();
    await SecureStore.setItemAsync('ab', z);
  }
  ziyaretci = z;
  return z;
}

/** Yenileme jetonu cihazın güvenli deposunda (Keychain / Keystore) tutulur. */
export const tokens = {
  save: (refreshToken: string) => SecureStore.setItemAsync('refreshToken', refreshToken),
  get: () => SecureStore.getItemAsync('refreshToken'),
  clear: () => SecureStore.deleteItemAsync('refreshToken'),
};
