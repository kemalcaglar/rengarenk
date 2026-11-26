'use client';

import { useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';
import stil from './page.module.css';

interface Kanal {
  ad: string;
  not: string;
  gonderilen: number;
  teslim: number | null;
  okunma?: number | null;
  ayrilma?: number;
  sikayet?: number;
  maliyetKurus: number;
}
interface Rapor {
  kanallar: Kanal[];
  sablonlar: { key: string; ad: string; tur: string; adet: number; okunma: number }[];
}

const sayi = (n: number) => n.toLocaleString('tr-TR');
const yuzde = (x: number | null | undefined) =>
  x === null || x === undefined ? '—' : `%${(x * 100).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`;
const tl = (k: number) => `₺${(k / 100).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`;

/**
 * Teslim raporu (YonetimKampanya.dc.html › teslim; Karar 48): son 30 gün kanal bazında gönderim, teslim, ayrılma,
 * şikâyet ve maliyet. E-postada izleme pikseli ve bağlantı yönlendirmesi kullanılmadığı için açılma ve tıklama
 * ölçülmez; uygulama içi bildirimde okunma oranı gösterilir.
 */
export default function TeslimRaporu() {
  const [r, setR] = useState<Rapor | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  useEffect(() => {
    yonetim<Rapor>('notifications/report')
      .then(setR)
      .catch((e: Error) => setHata(e.message));
  }, []);
  const enCok = Math.max(0.0001, ...(r?.sablonlar.map((s) => s.okunma) ?? []));

  return (
    <>
      <div className={stil.kutu1}>
        <h1 className={stil.baslik1}>Teslim raporu · son 30 gün</h1>
        <p className={stil.metin1}>Kanal ve şablon bazında gönderim, teslim, etkileşim ve maliyet.</p>
      </div>
      {hata ? <p className={stil.metin2}>{hata}</p> : null}
      {r ? (
        <>
          <section aria-labelledby="kanal" className={stil.kutu2}>
            <h2 id="kanal" className={stil.baslik2}>
              Kanallar
            </h2>
            <div className={stil.kutu3}>
              <div className={stil.kutu4}>
                <div className={stil.kutu5}>
                  <span>Kanal</span>
                  <span className={stil.metin3}>Gönderilen</span>
                  <span className={stil.metin3}>Teslim</span>
                  <span className={stil.metin3}>Okunma</span>
                  <span className={stil.metin3}>Ayrılma</span>
                  <span className={stil.metin3}>Şikâyet</span>
                  <span className={stil.metin3}>Maliyet</span>
                </div>
                {r.kanallar.map((k) => (
                  <div key={k.ad} className={stil.kutu6}>
                    <span className={stil.metin4}>
                      <span className={stil.metin5}>{k.ad}</span>
                      <span className={stil.metin6}>{k.not}</span>
                    </span>
                    <span className={stil.metin7}>{sayi(k.gonderilen)}</span>
                    <span className={stil.metin3}>{yuzde(k.teslim)}</span>
                    <span className={stil.metin3}>{yuzde(k.okunma)}</span>
                    <span className={stil.metin3}>{k.ayrilma === undefined ? '—' : sayi(k.ayrilma)}</span>
                    <span className={stil.metin3}>{k.sikayet === undefined ? '—' : sayi(k.sikayet)}</span>
                    <span className={stil.metin7}>{tl(k.maliyetKurus)}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className={stil.metin8}>
              E-postada açılma ve tıklama ölçülmez: izleme pikseli ve bağlantı yönlendirmesi kullanılmıyor.
              WhatsApp ücreti Meta faturasındadır (ileti türü ve ülkeye göre); burada gösterilmez.
            </p>
          </section>

          <section aria-labelledby="sbl" className={stil.kutu7}>
            <h2 id="sbl" className={stil.baslik3}>
              Şablon ve akışlara göre okunma oranı
            </h2>
            <p className={stil.metin9}>Uygulama içi bildirimlerden okunan pay</p>
            {r.sablonlar.length === 0 ? (
              <p className={stil.metin10}>Son 30 günde bildirim yok.</p>
            ) : (
              r.sablonlar.map((s) => (
                <div key={s.key} title={`${sayi(s.adet)} bildirim`} className={stil.kutu8}>
                  <span className={stil.metin11}>
                    <span className={stil.metin12}>{s.ad}</span>
                    <span className={stil.metin13}>
                      {s.tur ? `${s.tur} · ` : ''}
                      {sayi(s.adet)} bildirim
                    </span>
                  </span>
                  <span className={stil.metin14}>
                    <span
                      className={stil.metin15}
                      style={{ width: `${Math.max(1, (s.okunma / enCok) * 100)}%` }}
                    />
                  </span>
                  <span className={stil.metin16}>{yuzde(s.okunma)}</span>
                </div>
              ))
            )}
          </section>
        </>
      ) : null}
    </>
  );
}
