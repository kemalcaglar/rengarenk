'use client';

import { useEffect, useState } from 'react';
import { API } from '../../lib/istemci';
import { SonTalepler } from './ana-bolumler';
import { type TalepYaniti, VitrinBolumu } from './vitrin';

/** Tarayıcıdan talepler: ulaşılamazsa yaklaşık bir dakika boyunca aralıklarla (1, 2, 4, 8, 15, 30 sn) yeniden dener */
export async function talepleriAl(yol: string): Promise<TalepYaniti | null> {
  for (const bekle of [0, 1000, 2000, 4000, 8000, 15000, 30000]) {
    if (bekle) await new Promise((r) => setTimeout(r, bekle));
    try {
      const r = await fetch(`${API}${yol}`);
      if (r.ok) return (await r.json()) as TalepYaniti;
    } catch {
      // yeniden dener
    }
  }
  return null;
}

function useTalepler(yol: string) {
  const [veri, setVeri] = useState<TalepYaniti | null>(null);
  useEffect(() => {
    let canli = true;
    talepleriAl(yol).then((v) => canli && setVeri(v));
    return () => {
      canli = false;
    };
  }, [yol]);
  return veri;
}

/** Sunucu vitrini alamadıysa tarayıcıda yeniden çekilir (bölüm kaybolmaz) */
export function IstemciVitrin() {
  const v = useTalepler('/talepler/vitrin?boyut=17');
  return v ? <VitrinBolumu vitrin={v} /> : null;
}

/** Sunucu son talepleri alamadıysa tarayıcıda yeniden çekilir */
export function IstemciSon() {
  const v = useTalepler('/talepler?sira=yeni&boyut=6');
  return v ? <SonTalepler liste={v.sonuclar} baslik="Son talepler" tumu="/talepler?sira=yeni" /> : null;
}
