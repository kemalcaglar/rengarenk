import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * app.json'u genişletir: Firebase ayar dosyaları (push, Karar 48) depoda değil. EAS derlemesinde dosya değişkeni
 * (GOOGLE_SERVICES_JSON, GOOGLE_SERVICE_INFO_PLIST) dosyanın yolunu verir; bu bilgisayarda apps/mobile altındaki
 * yerel kopyalar kullanılır (Firebase projesi rengarenksite-firebase).
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Rengarenk',
  slug: config.slug ?? 'rengarenksite',
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
  },
  ios: {
    ...config.ios,
    googleServicesFile: process.env.GOOGLE_SERVICE_INFO_PLIST ?? './GoogleService-Info.plist',
  },
});
