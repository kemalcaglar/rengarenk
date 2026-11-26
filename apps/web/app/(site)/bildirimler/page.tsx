'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { HesabimMenu } from '../../../components/hesabim-menu';
import { useCanli } from '../../../lib/canli';
import { cx } from '../../../lib/cx';
import { istek, useGiris } from '../../../lib/istemci';
import stil from './page.module.css';

export interface Bildirim {
  id: string;
  grup: string;
  ikon: string;
  tint: string;
  baslik: string;
  metin: string;
  url: string | null;
  ticari: boolean;
  okundu: boolean;
  zaman: string;
}

const FILTRELER = [
  ['hepsi', 'Tümü'],
  ['mesaj', 'Mesajlar'],
  ['talep', 'Taleplerim'],
] as const;

const DAY = 86_400_000;
const once = (iso: string) => {
  const dk = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (dk < 1) return 'şimdi';
  if (dk < 60) return `${dk} dk`;
  if (dk < 24 * 60) return `${Math.floor(dk / 60)} sa`;
  if (dk < 48 * 60) return 'Dün';
  return `${Math.floor(dk / (24 * 60))} gün`;
};
const gunBasi = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/**
 * Bildirimler (AnasayfaMobil.dc.html › bildirimler; Karar 48): süzgeç, Bugün / Bu hafta / Daha önce grupları, okunmamış
 * vurgusu, kampanyada "onay verdiğin için" etiketi, "Tümünü okundu say". Web tasarımında ayrı ekran yok; mobil tasarım
 * hesap düzeninde kullanıldı.
 */
export default function Bildirimler() {
  const giris = useGiris();
  const router = useRouter();
  const [filtre, setFiltre] = useState<'hepsi' | 'mesaj' | 'talep'>('hepsi');
  const [liste, setListe] = useState<Bildirim[] | null>(null);

  useEffect(() => {
    if (giris === false) router.replace('/giris?sonra=/bildirimler');
  }, [giris, router]);

  const yukle = useCallback(async () => {
    const r = await istek<{ bildirimler: Bildirim[] }>(
      `/notifications${filtre === 'hepsi' ? '' : `?grup=${filtre}`}`,
    );
    setListe(r.bildirimler);
  }, [filtre]);
  useEffect(() => {
    if (giris) yukle().catch(() => setListe([]));
  }, [giris, yukle]);
  useCanli((o) => {
    if (o.tip === 'bildirim') yukle().catch(() => undefined);
  }, !!giris);

  async function ac(b: Bildirim) {
    if (!b.okundu)
      await istek('/notifications/read', { method: 'POST', body: { ids: [b.id] } }).catch(() => undefined);
    window.dispatchEvent(new Event('rr-bildirim'));
    if (b.url) router.push(b.url);
    else yukle().catch(() => undefined);
  }

  const bugun = gunBasi();
  const gruplar = [
    ['Bugün', (t: number) => t >= bugun],
    ['Bu hafta', (t: number) => t < bugun && t >= bugun - 6 * DAY],
    ['Daha önce', (t: number) => t < bugun - 6 * DAY],
  ] as const;

  return (
    <div className={`rr-sayfa ${stil.kutu1}`}>
      <HesabimMenu aktif="/bildirimler" />
      <main className={stil.kutu2}>
        <div className={stil.kutu3}>
          <h1 className={stil.baslik1}>Bildirimler</h1>
          <button
            type="button"
            onClick={async () => {
              await istek('/notifications/read', { method: 'POST', body: { hepsi: true } }).catch(
                () => undefined,
              );
              window.dispatchEvent(new Event('rr-bildirim'));
              yukle().catch(() => undefined);
            }}
            className={stil.dugme1}
          >
            Tümünü okundu say
          </button>
        </div>
        <div className={stil.kutu4}>
          {FILTRELER.map(([k, ad]) => (
            <button
              key={k}
              type="button"
              aria-pressed={filtre === k}
              onClick={() => setFiltre(k)}
              className={cx(stil.dugme2, filtre === k ? stil.dugme3 : stil.dugme4)}
            >
              {ad}
            </button>
          ))}
        </div>
        {liste && !liste.length ? <p className={stil.metin1}>Henüz bildirimin yok.</p> : null}
        {gruplar.map(([ad, kosul]) => {
          const ogeler = (liste ?? []).filter((b) => kosul(new Date(b.zaman).getTime()));
          if (!ogeler.length) return null;
          return (
            <section key={ad}>
              <h2 className={stil.baslik2}>{ad}</h2>
              <div className={stil.kutu5}>
                {ogeler.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => ac(b)}
                    className={cx(stil.dugme5, b.okundu ? stil.dugme6 : stil.dugme7)}
                  >
                    <span aria-hidden="true" className={stil.metin2} style={{ background: b.tint }}>
                      {b.ikon}
                    </span>
                    <span className={stil.metin3}>
                      <span className={stil.metin4}>
                        <span className={cx(stil.metin5, b.okundu ? stil.metin6 : stil.metin7)}>
                          {b.baslik}
                        </span>
                        <span className={stil.metin8}>{once(b.zaman)}</span>
                      </span>
                      <span className={stil.metin9}>{b.metin}</span>
                      {b.ticari ? <span className={stil.metin10}>Kampanya · onay verdiğin için</span> : null}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
