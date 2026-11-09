'use client';

import type { LandingBlock } from '@rengarenk/shared';
import { type CSSProperties, useEffect } from 'react';
import { API } from '../lib/istemci';

const kart: CSSProperties = { background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 20 };
const RENK = ['#5B8CFF', '#FF6FB5', '#FFC84A', '#3DD68C'];
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
      style={{
        display: 'inline-block',
        background: '#5B8CFF',
        color: '#1E2333',
        borderRadius: 14,
        padding: '14px 22px',
        fontSize: 16,
        fontWeight: 800,
        textDecoration: 'none',
      }}
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
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 16px 64px' }}>
      {onizleme ? (
        <p
          role="status"
          style={{
            background: '#FFF6DF',
            color: '#7A5300',
            borderRadius: 12,
            padding: '10px 14px',
            fontWeight: 700,
          }}
        >
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
        <section
          style={{
            ...kart,
            padding: '40px 28px',
            marginBottom: 18,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', gap: 6, marginBottom: 18 }} aria-hidden="true">
            {RENK.map((r) => (
              <span key={r} style={{ width: 28, height: 8, borderRadius: 999, background: r }} />
            ))}
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 'clamp(28px, 5vw, 44px)',
              fontWeight: 800,
              letterSpacing: -0.8,
              lineHeight: 1.1,
            }}
          >
            {b.baslik}
          </h1>
          {b.alt ? (
            <p style={{ margin: '12px 0 22px', fontSize: 18, color: '#3A4052', maxWidth: 680 }}>{b.alt}</p>
          ) : (
            <div style={{ height: 22 }} />
          )}
          <Dugme slug={slug} yazi={b.dugme} hedef={b.hedef} onizleme={onizleme} />
        </section>
      );
    case 'rakamlar':
      return (
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
            marginBottom: 18,
          }}
        >
          {b.maddeler.map((m, i) => (
            <div key={m.etiket} style={{ ...kart, padding: 20, background: NOKTA[i % 4] }}>
              <div style={{ fontSize: 30, fontWeight: 800 }}>{m.deger}</div>
              <div style={{ fontSize: 14, color: '#3A4052', marginTop: 4 }}>{m.etiket}</div>
            </div>
          ))}
        </section>
      );
    case 'avantajlar':
      return (
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 12,
            marginBottom: 18,
          }}
        >
          {b.maddeler.map((m, i) => (
            <div key={m.baslik} style={{ ...kart, padding: 20 }}>
              <span
                aria-hidden="true"
                style={{
                  display: 'block',
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: RENK[i % 4],
                  marginBottom: 10,
                }}
              />
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{m.baslik}</h2>
              {m.metin ? (
                <p style={{ margin: '6px 0 0', fontSize: 14.5, color: '#3A4052', lineHeight: 1.5 }}>
                  {m.metin}
                </p>
              ) : null}
            </div>
          ))}
        </section>
      );
    case 'nasil':
      return (
        <section style={{ ...kart, padding: 24, marginBottom: 18 }}>
          <h2 style={{ margin: '0 0 14px', fontSize: 22, fontWeight: 800 }}>Nasıl çalışır?</h2>
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 12 }}>
            {b.adimlar.map((a, i) => (
              <li key={a.baslik} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span
                  style={{
                    flex: 'none',
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    background: RENK[i % 4],
                    color: '#1E2333',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {i + 1}
                </span>
                <span>
                  <span style={{ display: 'block', fontSize: 16, fontWeight: 800 }}>{a.baslik}</span>
                  {a.metin ? (
                    <span style={{ display: 'block', fontSize: 14.5, color: '#3A4052', marginTop: 2 }}>
                      {a.metin}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        </section>
      );
    case 'form':
      return (
        <section
          style={{
            ...kart,
            padding: 24,
            marginBottom: 18,
            border: '1.5px solid #5B8CFF',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <span style={{ flex: '1 1 320px' }}>
            <span style={{ display: 'block', fontSize: 22, fontWeight: 800 }}>{b.baslik}</span>
            {b.metin ? (
              <span style={{ display: 'block', fontSize: 15, color: '#3A4052', marginTop: 4 }}>
                {b.metin}
              </span>
            ) : null}
          </span>
          <Dugme slug={slug} yazi={b.dugme} hedef={b.hedef} onizleme={onizleme} />
        </section>
      );
    case 'sss':
      return (
        <section style={{ ...kart, padding: 24, marginBottom: 18 }}>
          <h2 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 800 }}>Sık sorulanlar</h2>
          {b.sorular.map((s) => (
            <details key={s.soru} style={{ borderTop: '1px solid #EEF0F5', padding: '12px 0' }}>
              <summary style={{ cursor: 'pointer', fontSize: 15.5, fontWeight: 800 }}>{s.soru}</summary>
              <p style={{ margin: '8px 0 0', fontSize: 14.5, color: '#3A4052', lineHeight: 1.55 }}>
                {s.cevap}
              </p>
            </details>
          ))}
        </section>
      );
    default:
      return (
        <section style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
          {b.maddeler.map((m) => (
            <span
              key={m}
              style={{
                background: '#E7FAF0',
                color: '#11683F',
                borderRadius: 999,
                padding: '8px 14px',
                fontSize: 14,
                fontWeight: 800,
              }}
            >
              ✓ {m}
            </span>
          ))}
        </section>
      );
  }
}
