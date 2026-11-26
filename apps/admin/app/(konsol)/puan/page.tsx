'use client';

import { iyelik } from '@rengarenk/shared';
import { useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';
import stil from './page.module.css';

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
      <div className={stil.kutu1}>
        <h1 className={stil.baslik1}>Satıcı puanı ve rozetler</h1>
        <p className={stil.metin1}>
          Puan içeride hesaplanır; alıcılar yalnızca rozetleri görür. Alıcı yalnızca yıldız verir, yorum
          yazılmaz.
        </p>
      </div>
      {hata ? <p className={stil.metin2}>{hata}</p> : null}
      <div className={stil.kutu2}>
        {(o?.rozetler ?? []).map((r) => (
          <section key={r.key} className={stil.kutu3}>
            <span className={stil.metin3} style={{ background: r.bg, color: r.renk }}>
              {r.ad}
            </span>
            <div className={stil.kutu4}>
              {binlik(r.sayi)} / {binlik(o?.ucretliGaleri ?? 0)}
            </div>
            <div className={stil.kutu5}>ücretli galeride bu rozet var</div>
            {r.kosul.map(([ad, deger]) => (
              <div key={ad} className={stil.kutu6}>
                <span className={stil.metin4}>{ad}</span>
                <strong>{deger}</strong>
              </div>
            ))}
          </section>
        ))}
      </div>
      <div className={stil.kutu7}>
        <section aria-labelledby="dagilim" className={stil.kutu8}>
          <h2 id="dagilim" className={stil.baslik2}>
            Yıldız dağılımı · son 90 gün
          </h2>
          <p className={stil.metin5}>
            {o
              ? `${binlik(o.yildiz.toplam)} yıldız · ortalama ${
                  o.yildiz.ortalama === null ? '—' : String(o.yildiz.ortalama).replace('.', ',')
                } · ${o.yildiz.katilmayan ? `${iyelik(o.yildiz.katilmayan)} hesaba katılmadı` : 'hepsi hesaba katıldı'}`
              : 'Yükleniyor…'}
          </p>
          {(o?.yildiz.dagilim ?? []).map((d) => (
            <div key={d.yildiz} title={`${d.yildiz} yıldız: %${d.oran} (${d.adet})`} className={stil.kutu9}>
              <span className={stil.metin6}>{d.yildiz} yıldız</span>
              <span className={stil.metin7}>
                <span className={stil.metin8} style={{ width: `${(d.oran / enCok) * 100}%` }} />
              </span>
              <span className={stil.metin9}>%{d.oran}</span>
            </div>
          ))}
          <h3 className={stil.baslik3}>İç puanın bileşenleri</h3>
          {(o?.bilesen ?? []).map((b) => (
            <div key={b.ad} className={stil.kutu10}>
              <span>{b.ad}</span>
              <strong>%{b.agirlik}</strong>
            </div>
          ))}
        </section>
        <section className={stil.kutu11}>
          <div className={stil.kutu12}>
            <h2 className={stil.baslik4}>Ajanın işaretledikleri</h2>
            {o && !o.isaretli.length ? (
              <p className={stil.metin10}>Son 90 günde hesaba katılmayan yıldız yok.</p>
            ) : null}
            {(o?.isaretli ?? []).map((x) => (
              <div key={`${x.satici}-${x.neden}-${x.yildiz}`} className={stil.kutu13}>
                <span className={stil.metin11}>
                  {x.satici} · {x.adet} adet {x.yildiz} yıldız
                </span>
                <span className={stil.metin12}>{x.neden} · hesaba katılmadı</span>
              </div>
            ))}
          </div>
          <div className={stil.kutu14}>
            <h2 className={stil.baslik5}>Alıcının gördüğü · ilk mesaj kartı</h2>
            <div className={stil.kutu15}>
              <div className={stil.kutu16}>
                <span className={stil.metin13}>YO</span>
                <span>
                  <span className={stil.metin14}>Örnek galeri</span>
                  <span className={stil.metin15}>İl, ilçe · portföy aracı</span>
                </span>
              </div>
              <div className={stil.kutu17}>
                {(o?.rozetler ?? []).map((r) => (
                  <span key={r.key} className={stil.metin16} style={{ background: r.bg, color: r.renk }}>
                    {r.ad}
                  </span>
                ))}
              </div>
            </div>
            <p className={stil.metin17}>
              Galeri kendi panelinde yıldız ortalamasını, dağılımını ve rozete ne kadar kaldığını görür;
              yıldızı kimin verdiğini göremez.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
