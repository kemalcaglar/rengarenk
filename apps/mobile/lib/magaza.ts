import { Alert } from 'react-native';

export interface Niyet {
  no: string;
  /** App Store Connect ve Google Play Console'daki ürün kimliği (rr_ek_talep …) */
  urunKimligi: string;
  saglayici: 'fake' | 'revenuecat' | 'none';
}

type Istek = <T>(path: string, init?: { method?: 'POST'; body?: unknown }) => Promise<T>;

/**
 * Uygulama içi satın alma (Karar 38). Sunucu önce niyet kaydını açar; satış mağazadan RevenueCat bildirimiyle sunucuya
 * gelir ve haklar hesaba yazılır. Geliştirmede (STORE_PROVIDER=fake) mağaza ekranı yerine onay penceresi açılır ve sahte
 * satış olayı gönderilir. Gerçek mağaza: react-native-purchases (RevenueCat SDK) Apple ve Google hesapları açılınca
 * eklenir; `Purchases.logIn(kullanıcı kimliği)` ve ürün kimliğiyle `purchaseStoreProduct`.
 */
export async function satinAl(niyet: Niyet, istek: Istek, ozet: string): Promise<'tamam' | 'iptal'> {
  if (niyet.saglayici === 'fake') {
    const onay = await new Promise<boolean>((res) =>
      Alert.alert('Sahte mağaza (geliştirme)', `${ozet}\n\nGerçek ödeme alınmaz.`, [
        { text: 'Vazgeç', style: 'cancel', onPress: () => res(false) },
        { text: 'Satın al', onPress: () => res(true) },
      ]),
    );
    if (!onay) return 'iptal';
    await istek('/store/fake-purchase', { method: 'POST', body: { no: niyet.no } });
    return 'tamam';
  }
  throw new Error('Uygulama içi satın alma bu sürümde henüz açık değil');
}
