import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { bildirimAc } from './bildirim';
import { useOturum } from './oturum';

// Uygulama açıkken gelen bildirim de gösterilir
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

/**
 * Push (Karar 48; FCM): oturum açılınca izin istenir ve cihaz anahtarı sunucuya kaydedilir. Push içeriğinde yalnızca
 * başlık ve kısa metin vardır. Bildirime dokunulunca ilgili ekran açılır. İzin verilmezse uygulama içi bildirim ve
 * e-posta sürer. Gerçek gönderim Firebase projesi açılınca (PUSH_PROVIDER=fcm).
 */
export function PushKaydi() {
  const { durum, istek } = useOturum();
  useEffect(() => {
    if (durum !== 'uye' || Platform.OS === 'web') return;
    (async () => {
      let izin = await Notifications.getPermissionsAsync();
      if (!izin.granted && izin.canAskAgain) izin = await Notifications.requestPermissionsAsync();
      if (!izin.granted) return;
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('varsayilan', {
          name: 'Bildirimler',
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }
      const t = await Notifications.getDevicePushTokenAsync();
      await istek('/me/push-tokens', {
        method: 'POST',
        body: { token: String(t.data), platform: Platform.OS === 'ios' ? 'ios' : 'android' },
      });
    })().catch(() => undefined);
  }, [durum, istek]);

  useEffect(() => {
    const abone = Notifications.addNotificationResponseReceivedListener((r) => {
      const url = r.notification.request.content.data?.url;
      bildirimAc(typeof url === 'string' ? url : null);
    });
    return () => abone.remove();
  }, []);
  return null;
}
