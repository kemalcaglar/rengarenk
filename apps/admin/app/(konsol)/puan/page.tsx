'use client';

import { iyelik } from '@rengarenk/shared';
import { useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';

interface Ozet {
  ucretliGaleri: number;
  rozetler: { key: string; ad: string; bg: string; renk: string; sayi: number; kosul: [string, string][] }[];
  yildiz: {
    toplam: number;
    ortalama: number | null;
    katilmayan: number;
    dagilim: { yildiz: number; adet: number; oran: number }[];
  };
  bilesen: { ad: string; agirlik: number }[];
  isaretli: { satici: string; adet: number; yildiz: number; neden: string }[];
}

const kart = { background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 18 } as const;
const binlik = (n: number) => new Intl.NumberFormat('tr-TR').format(n);

/**
 * Satıcı puanı ve rozetler (tasarım: YonetimPazar.dc.html › puan; Karar 55). Rozet sayıları ücretli galerilerde;
 * yıldız dağılımı son 90 gün. Hesaba katılmayan yıldızları ajan gelene kadar kurallar işaretler (yeni hesap, aynı cihaz
 * ve ağ, satıcıyla bağlantılı hesap). Eşiklerin konsoldan değiştirilmesi Kurallar ve fiyatlar ekranıyla gelecek.
 */
export default function SaticiPuani() {
  const [o, setO] = useState<Ozet | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  useEffect(() => {
    yonetim<Ozet>('trust/overview')
      .then(setO)
      .catch((e: Error) => setHata(e.message));
  }, []);
  const enCok = Math.max(1, ...(o?.yildiz.dagilim.map((d) => d.oran) ?? [1]));
  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Satıcı puanı ve rozetler</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#5A6073' }}>
          Puan içeride hesaplanır; alıcılar yalnızca rozetleri görür. Alıcı yalnızca yıldız verir, yorum
          yazılmaz.
        </p>
      </div>
      {hata ? <p style={{ color: '#A3271F' }}>{hata}</p> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        {(o?.rozetler ?? []).map((r) => (
          <section key={r.key} style={{ ...kart, padding: 16 }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 800,
                padding: '4px 10px',
                borderRadius: 999,
                background: r.bg,
                color: r.renk,
              }}
            >
              {r.ad}
            </span>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 12 }}>
              {binlik(r.sayi)} / {binlik(o?.ucretliGaleri ?? 0)}
            </div>
            <div style={{ fontSize: 12.5, color: '#5A6073' }}>ücretli galeride bu rozet var</div>
            {r.kosul.map(([ad, deger]) => (
              <div
                key={ad}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '8px 0',
                  borderTop: '1px solid #EEF0F5',
                  marginTop: 8,
                  fontSize: 13,
                }}
              >
                <span style={{ color: '#3A4052' }}>{ad}</span>
                <strong>{deger}</strong>
              </div>
            ))}
          </section>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start', marginTop: 16 }}>
        <section
          aria-labelledby="dagilim"
          style={{ ...kart, flex: '1 1 360px', minWidth: 0, padding: '16px 18px' }}
        >
          <h2 id="dagilim" style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800 }}>
            Yıldız dağılımı · son 90 gün
          </h2>
          <p style={{ margin: '0 0 12px', fontSize: 12.5, color: '#5A6073' }}>
            {o
              ? `${binlik(o.yildiz.toplam)} yıldız · ortalama ${
                  o.yildiz.ortalama === null ? '—' : String(o.yildiz.ortalama).replace('.', ',')
                } · ${o.yildiz.katilmayan ? `${iyelik(o.yildiz.katilmayan)} hesaba katılmadı` : 'hepsi hesaba katıldı'}`
              : 'Yükleniyor…'}
          </p>
          {(o?.yildiz.dagilim ?? []).map((d) => (
            <div
              key={d.yildiz}
              title={`${d.yildiz} yıldız: %${d.oran} (${d.adet})`}
              style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}
            >
              <span style={{ flex: '0 0 52px', fontSize: 13, fontWeight: 700 }}>{d.yildiz} yıldız</span>
              <span style={{ flex: 1, minWidth: 0, height: 14 }}>
                <span
                  style={{
                    display: 'block',
                    height: 14,
                    width: `${(d.oran / enCok) * 100}%`,
                    background: '#FFC84A',
                    borderRadius: '0 4px 4px 0',
                  }}
                />
              </span>
              <span style={{ flex: '0 0 60px', fontSize: 13, fontWeight: 800, textAlign: 'right' }}>
                %{d.oran}
              </span>
            </div>
          ))}
          <h3 style={{ margin: '16px 0 6px', fontSize: 13.5, fontWeight: 800 }}>İç puanın bileşenleri</h3>
          {(o?.bilesen ?? []).map((b) => (
            <div
              key={b.ad}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '7px 0',
                borderTop: '1px solid #EEF0F5',
                fontSize: 13,
              }}
            >
              <span>{b.ad}</span>
              <strong>%{b.agirlik}</strong>
            </div>
          ))}
        </section>
        <section
          style={{ flex: '1 1 360px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          <div style={{ ...kart, overflow: 'hidden' }}>
            <h2
              style={{
                margin: 0,
                padding: '16px 18px',
                fontSize: 17,
                fontWeight: 800,
                borderBottom: '1px solid #EEF0F5',
              }}
            >
              Ajanın işaretledikleri
            </h2>
            {o && !o.isaretli.length ? (
              <p style={{ margin: 0, padding: '11px 18px', fontSize: 13, color: '#5A6073' }}>
                Son 90 günde hesaba katılmayan yıldız yok.
              </p>
            ) : null}
            {(o?.isaretli ?? []).map((x) => (
              <div
                key={`${x.satici}-${x.neden}-${x.yildiz}`}
                style={{ padding: '11px 18px', borderBottom: '1px solid #EEF0F5' }}
              >
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 800 }}>
                  {x.satici} · {x.adet} adet {x.yildiz} yıldız
                </span>
                <span style={{ display: 'block', fontSize: 12.5, color: '#3A4052', marginTop: 2 }}>
                  {x.neden} · hesaba katılmadı
                </span>
              </div>
            ))}
          </div>
          <div style={{ ...kart, padding: '16px 18px' }}>
            <h2 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800 }}>
              Alıcının gördüğü · ilk mesaj kartı
            </h2>
            <div style={{ border: '1px solid #E3E6EF', borderRadius: 14, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    background: '#FFF6DF',
                    color: '#7A5300',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 13,
                  }}
                >
                  YO
                </span>
                <span>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 800 }}>Örnek galeri</span>
                  <span style={{ display: 'block', fontSize: 12, color: '#5A6073' }}>
                    İl, ilçe · portföy aracı
                  </span>
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {(o?.rozetler ?? []).map((r) => (
                  <span
                    key={r.key}
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      padding: '3px 9px',
                      borderRadius: 999,
                      background: r.bg,
                      color: r.renk,
                    }}
                  >
                    {r.ad}
                  </span>
                ))}
              </div>
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 12, color: '#5A6073' }}>
              Galeri kendi panelinde yıldız ortalamasını, dağılımını ve rozete ne kadar kaldığını görür;
              yıldızı kimin verdiğini göremez.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
