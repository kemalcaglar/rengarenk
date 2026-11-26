'use client';

import type { LandingBlock } from '@rengarenk/shared';
import { useEffect } from 'react';
import { API } from '../lib/istemci';
import stil from './acilis.module.css';

const RENK = [
  'var(--rr-mavi, #5B8CFF)',
  'var(--rr-pembe, #FF6FB5)',
  'var(--rr-sari, #FFC84A)',
  'var(--rr-yesil, #3DD68C)',
];
const NOKTA = ['#EEF3FF', '#FFEEF6', '#FFF6DF', '#E7FAF0'];

const olay = (slug: string, tur: 'ziyaret' | 'tiklama') =>
  fetch(`${API}/acilis/${slug}/olay`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tur }),
    keepalive: true,
  }).catch(() => undefined);

/** Düğmenin hedefi: UTM'ler korunur (sihirbaz ya da başvuru reklam kaynağını görebilsin) */
function hedefAdres(hedef: 'talep' | 'galeri') {
  const yol = hedef === 'talep' ? '/talep-olustur' : '/kurumsal-basvuru';
  if (typeof window === 'undefined') return yol;
  const q = new URLSearchParams(window.location.search);
  q.delete('onizleme');
  const s = q.toString();
  return s ? `${yol}?${s}` : yol;
}

function Dugme({
  slug,
  yazi,
  hedef,
  onizleme,
}: {
  slug: string;
  yazi: string;
  hedef: 'talep' | 'galeri';
  onizleme: boolean;
}) {
  return (
    <a
      href={hedef === 'talep' ? '/talep-olustur' : '/kurumsal-basvuru'}
      onClick={(e) => {
        e.preventDefault();
        if (!onizleme) olay(slug, 'tiklama');
        window.location.href = hedefAdres(hedef);
      }}
      className={stil.bag1}
    >
      {yazi}
    </a>
  );
}

/**
 * Açılış sayfası (Karar 46): konsoldaki bloklar sırayla, sitenin çerçevesi ve renkleriyle çizilir. Ziyaret ve düğme
 * tıklaması günlük toplam olarak sayılır (önizlemede sayılmaz). Reklam ölçüm olayları çerez iznine bağlı Pixel ve
 * Google etiketi kurulunca bu bileşenden gönderilecek (Karar 35).
 */
export function AcilisSayfasi({
  slug,
  bloklar,
  onizleme,
}: {
  slug: string;
  bloklar: LandingBlock[];
  onizleme: boolean;
}) {
  useEffect(() => {
    if (!onizleme) olay(slug, 'ziyaret');
  }, [slug, onizleme]);

  return (
    <main className={`rr-sayfa ${stil.kutu1}`}>
      {onizleme ? (
        <p role="status" className={stil.metin1}>
          Önizleme: bu taslak henüz yayında değil. Bağlantı 1 saat geçerli.
        </p>
      ) : null}
      {bloklar.map((b, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: blok sırası sayfada sabit
        <Blok key={i} b={b} slug={slug} onizleme={onizleme} />
      ))}
    </main>
  );
}

function Blok({ b, slug, onizleme }: { b: LandingBlock; slug: string; onizleme: boolean }) {
  switch (b.tur) {
    case 'baslik':
      return (
        <section className={stil.kutu2}>
          <div className={stil.kutu3} aria-hidden="true">
            {RENK.map((r) => (
              <span key={r} className={stil.metin2} style={{ background: r }} />
            ))}
          </div>
          <h1 className={stil.baslik1}>{b.baslik}</h1>
          {b.alt ? <p className={stil.metin3}>{b.alt}</p> : <div className={stil.kutu4} />}
          <Dugme slug={slug} yazi={b.dugme} hedef={b.hedef} onizleme={onizleme} />
        </section>
      );
    case 'rakamlar':
      return (
        <section className={stil.kutu5}>
          {b.maddeler.map((m, i) => (
            <div key={m.etiket} className={stil.kutu6} style={{ background: NOKTA[i % 4] }}>
              <div className={stil.kutu7}>{m.deger}</div>
              <div className={stil.kutu8}>{m.etiket}</div>
            </div>
          ))}
        </section>
      );
    case 'avantajlar':
      return (
        <section className={stil.kutu9}>
          {b.maddeler.map((m, i) => (
            <div key={m.baslik} className={stil.kutu10}>
              <span aria-hidden="true" className={stil.metin4} style={{ background: RENK[i % 4] }} />
              <h2 className={stil.baslik2}>{m.baslik}</h2>
              {m.metin ? <p className={stil.metin5}>{m.metin}</p> : null}
            </div>
          ))}
        </section>
      );
    case 'nasil':
      return (
        <section className={stil.kutu11}>
          <h2 className={stil.baslik3}>Nasıl çalışır?</h2>
          <ol className={stil.liste1}>
            {b.adimlar.map((a, i) => (
              <li key={a.baslik} className={stil.oge1}>
                <span className={stil.metin6} style={{ background: RENK[i % 4] }}>
                  {i + 1}
                </span>
                <span>
                  <span className={stil.metin7}>{a.baslik}</span>
                  {a.metin ? <span className={stil.metin8}>{a.metin}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </section>
      );
    case 'form':
      return (
        <section className={stil.kutu12}>
          <span className={stil.metin9}>
            <span className={stil.metin10}>{b.baslik}</span>
            {b.metin ? <span className={stil.metin11}>{b.metin}</span> : null}
          </span>
          <Dugme slug={slug} yazi={b.dugme} hedef={b.hedef} onizleme={onizleme} />
        </section>
      );
    case 'sss':
      return (
        <section className={stil.kutu11}>
          <h2 className={stil.baslik4}>Sık sorulanlar</h2>
          {b.sorular.map((s) => (
            <details key={s.soru} className={stil.kutu13}>
              <summary className={stil.metin12}>{s.soru}</summary>
              <p className={stil.metin13}>{s.cevap}</p>
            </details>
          ))}
        </section>
      );
    default:
      return (
        <section className={stil.kutu14}>
          {b.maddeler.map((m) => (
            <span key={m} className={stil.metin14}>
              ✓ {m}
            </span>
          ))}
        </section>
      );
  }
}
