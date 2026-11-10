'use client';

import { useEffect, useState } from 'react';
import { API } from '../../lib/istemci';
import { colors } from '../../lib/renk';
import { SonTalepler } from './ana-bolumler';
import { type TalepYaniti, VitrinBolumu } from './vitrin';

/** Yeniden deneme aralıkları: 1, 2, 4, 8, 15 sn, sonra yarım dakikada bir */
const BEKLEME = [0, 1000, 2000, 4000, 8000, 15000];
const SONRA = 30000;

/**
 * Tarayıcıdan talepler: ulaşılamazsa (API ya da veritabanı yeniden başlıyor) sayfa açık kaldıkça yeniden dener;
 * `iptal` çağrılınca durur. Tek seferlik çağrıda (`deneme` verilirse) en çok o kadar dener.
 */
export async function talepleriAl(
  yol: string,
  secenek: { iptal?: () => boolean; deneme?: number } = {},
): Promise<TalepYaniti | null> {
  const sinir = secenek.deneme ?? Number.POSITIVE_INFINITY;
  for (let i = 0; i < sinir; i++) {
    const bekle = BEKLEME[i] ?? SONRA;
    if (bekle) await new Promise((r) => setTimeout(r, bekle));
    if (secenek.iptal?.()) return null;
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
    talepleriAl(yol, { iptal: () => !canli }).then((v) => {
      if (canli && v) setVeri(v);
    });
    return () => {
      canli = false;
    };
  }, [yol]);
  return veri;
}

/** Talepler gelene kadar bölümün yeri: başlık ve "yükleniyor" (bölüm sessizce kaybolmaz) */
function Bekliyor({ baslik }: { baslik: string }) {
  return (
    <section aria-label={baslik} aria-busy="true">
      <h2 style={{ margin: '0 0 10px', fontSize: 19, fontWeight: 800 }}>{baslik}</h2>
      <p
        style={{
          margin: 0,
          padding: '18px 16px',
          background: colors.surface,
          border: `1px solid ${colors.line}`,
          borderRadius: 'var(--rr-kart-kose)',
          fontSize: 14,
          color: colors.muted,
        }}
      >
        Talepler yükleniyor…
      </p>
    </section>
  );
}

/** Sunucu vitrini alamadıysa tarayıcıda yeniden çekilir (bölüm kaybolmaz) */
export function IstemciVitrin() {
  const v = useTalepler('/talepler/vitrin?boyut=17');
  return v ? <VitrinBolumu vitrin={v} /> : <Bekliyor baslik="Ana sayfa vitrini" />;
}

/** Sunucu son talepleri alamadıysa tarayıcıda yeniden çekilir */
export function IstemciSon() {
  const v = useTalepler('/talepler?sira=yeni&boyut=6');
  return v ? (
    <SonTalepler liste={v.sonuclar} baslik="Son talepler" tumu="/talepler?sira=yeni" />
  ) : (
    <Bekliyor baslik="Son talepler" />
  );
}
