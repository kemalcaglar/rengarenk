import { useEffect, useRef } from 'react';
import { API } from './api';
import { useOturum } from './oturum';

export interface CanliOlay {
  tip: 'sohbet' | 'hazir';
  id?: string;
}

/**
 * Anlık iletim (Teknik tasarım §8): `/ws`'ye bağlanır, ilk iletide erişim jetonunu gönderir. Jetonun süresi dolunca
 * sunucu bağlantıyı 4002 ile kapatır; jeton yenilenip yeniden bağlanılır. Kopan bağlantı artan beklemeyle yeniden kurulur.
 */
export function useCanli(olay: (o: CanliOlay) => void) {
  const { durum, jeton } = useOturum();
  const ref = useRef(olay);
  ref.current = olay;
  useEffect(() => {
    if (durum !== 'uye') return;
    let ws: WebSocket | null = null;
    let kapandi = false;
    let bekle = 2000;
    let zaman: ReturnType<typeof setTimeout> | undefined;
    const baglan = async (yeni = false) => {
      const j = await jeton(yeni);
      if (!j || kapandi) return;
      ws = new WebSocket(`${API.replace(/^http/, 'ws')}/ws`);
      ws.onopen = () => {
        bekle = 2000;
        ws?.send(JSON.stringify({ tip: 'giris', jeton: j }));
      };
      ws.onmessage = (e) => {
        try {
          ref.current(JSON.parse(String(e.data)) as CanliOlay);
        } catch {
          // bozuk ileti yok sayılır
        }
      };
      ws.onclose = (e) => {
        if (kapandi) return;
        const yeniJeton = e.code === 4002 || e.code === 4001;
        zaman = setTimeout(
          () => baglan(yeniJeton).catch(() => undefined),
          yeniJeton ? Math.min(bekle, 1000) : bekle,
        );
        bekle = Math.min(bekle * 2, 30_000);
      };
    };
    baglan().catch(() => undefined);
    return () => {
      kapandi = true;
      clearTimeout(zaman);
      ws?.close();
    };
  }, [durum, jeton]);
}
