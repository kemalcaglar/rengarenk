import { router } from 'expo-router';

/**
 * Bildirimdeki web yolunu uygulama ekranına çevirir (bildirim ve push aynı adresi taşır). Eşleşmeyen yol açılmaz.
 */
export function bildirimAc(url: string | null) {
  if (!url) return;
  const [yol = '', sorgu = ''] = url.split('?');
  const q = new URLSearchParams(sorgu);
  if (yol === '/mesajlarim') {
    const s = q.get('sohbet');
    return s ? router.push(`/sohbet/${s}`) : router.push('/(sekmeler)/mesajlar');
  }
  if (yol === '/taleplerim') return router.push('/(sekmeler)/taleplerim');
  if (yol === '/favoriler') return router.push('/favoriler');
  if (yol === '/haklarim') return router.push('/haklarim');
  if (yol.startsWith('/galeri-paneli')) return router.push('/galeri-paneli');
  const itiraz = yol.match(/^\/itiraz\/([\w-]+)$/);
  if (itiraz) return router.push(`/itiraz/${itiraz[1]}`);
  const talep = yol.match(/^\/talep\/(\d+)$/);
  if (talep) return router.push(`/talep/${talep[1]}`);
  const galeri = yol.match(/^\/galeri\/([\w-]+)$/);
  if (galeri) return router.push(`/galeri/${galeri[1]}`);
}
