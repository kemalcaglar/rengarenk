import type { SocialLoginResult } from '@rengarenk/shared';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { kurulumKimligi, post } from './api';

const platform = () => (Platform.OS === 'android' ? 'ANDROID' : 'IOS');

/**
 * Google ile giriş (Karar 18): API yönlendirme adresini verir, uygulama içi tarayıcıda Google açılır. Google sitedeki
 * dönüş sayfasına döner; o sayfa mobil girişi (`state` "m." ile başlar) `rengarenk://google` adresiyle uygulamaya
 * iletir. Uygulama kendi `state`'ini karşılaştırır. İptal edilirse `null`.
 */
export async function googleIle(): Promise<SocialLoginResult | null> {
  const { url, state } = await post<{ url: string; state: string }>('/auth/google/start', {
    platform: platform(),
  });
  const r = await WebBrowser.openAuthSessionAsync(url, 'rengarenk://google');
  if (r.type !== 'success') return null;
  const q = new URL(r.url).searchParams;
  if (q.get('state') !== state || !q.get('code')) {
    throw new Error(
      q.get('error') ? 'Google girişi iptal edildi' : 'Google girişi doğrulanamadı, yeniden dene',
    );
  }
  return post<SocialLoginResult>('/auth/google/callback', {
    state,
    code: q.get('code'),
    kurulum: await kurulumKimligi(),
  });
}

/** iPhone'da Apple ile giriş: Apple ad ve soyadı yalnızca ilk seferde verir. İptal edilirse `null`. */
export async function appleIle(): Promise<SocialLoginResult | null> {
  try {
    const c = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!c.identityToken) throw new Error('Apple kimliği alınamadı');
    return post<SocialLoginResult>('/auth/apple', {
      kimlikJetonu: c.identityToken,
      ...(c.fullName?.givenName ? { ad: c.fullName.givenName } : {}),
      ...(c.fullName?.familyName ? { soyad: c.fullName.familyName } : {}),
      platform: 'IOS',
      kurulum: await kurulumKimligi(),
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return null;
    throw e;
  }
}

/** Apple ile giriş yalnızca iPhone'da ve cihaz destekliyorsa */
export async function appleVar(): Promise<boolean> {
  return Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync().catch(() => false));
}
