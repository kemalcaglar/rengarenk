'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { type CerezTercihi, cerezTercihi, tercihDegisti } from '../lib/olcum';
import { colors } from '../lib/renk';
import { OnayKutusu } from './onay-kutusu';

const COOKIE = 'rr_cerez';
const MAX_AGE = 180 * 24 * 60 * 60;

function kaydet(t: CerezTercihi) {
  // biome-ignore lint/suspicious/noDocumentCookie: tercih sunucu tarafında da okunur; Cookie Store API her tarayıcıda yok
  document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(t))}; path=/; max-age=${MAX_AGE}; samesite=lax`;
  // Rıza kaydı (Karar 59): tarih, sürüm ve kanalıyla sunucuda saklanır; ulaşılamazsa tercih yine geçerlidir.
  fetch('/api/riza/cerez', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(t),
  }).catch(() => undefined);
  // Reklam ölçümü (Karar 35): izinle etiketler yüklenir, izin kalkınca ölçüm çerezleri silinir
  tercihDegisti(t);
}

function Kutu({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <OnayKutusu
      checked={on}
      onChange={onClick}
      size={18}
      radius={5}
      border={2}
      mark="#FFFFFF"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, color: colors.ink }}
    >
      {label}
    </OnayKutusu>
  );
}

const outline = {
  border: `1.5px solid ${colors.ink}`,
  background: 'var(--rr-kart, #FFFFFF)',
  borderRadius: 'calc(var(--rr-buton-kose) * 12 / 14)',
  padding: '10px 18px',
  fontSize: 14,
  fontWeight: 800,
  color: colors.ink,
  cursor: 'pointer',
  fontFamily: 'inherit',
} as const;

/** Çerez tercihleri bandı (tasarım: Anasayfa.dc.html, ziyaretçi görünümü) */
export function CerezBandi() {
  const [goster, setGoster] = useState(false);
  const [detay, setDetay] = useState(false);
  const [analiz, setAnaliz] = useState(false);
  const [reklam, setReklam] = useState(false);

  useEffect(() => {
    setGoster(cerezTercihi() === null);
    // "Çerez tercihleri" bağlantısı: bant mevcut seçimlerle yeniden açılır
    const ac = () => {
      const t = cerezTercihi();
      setAnaliz(Boolean(t?.analiz));
      setReklam(Boolean(t?.reklam));
      setDetay(true);
      setGoster(true);
    };
    window.addEventListener('rr-cerez-ac', ac);
    return () => window.removeEventListener('rr-cerez-ac', ac);
  }, []);

  if (!goster) return null;
  const bitir = (t: CerezTercihi) => {
    kaydet(t);
    setGoster(false);
  };

  return (
    <section
      aria-label="Çerez tercihleri"
      className="rr-cerez"
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 16,
        maxWidth: 980,
        margin: '0 auto',
        background: 'var(--rr-kart, #FFFFFF)',
        border: `1px solid ${colors.line}`,
        borderRadius: 'var(--rr-kart-kose)',
        padding: '18px 20px',
        boxShadow: '0 12px 32px rgba(30,35,51,0.14)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '14px 20px',
        zIndex: 20,
      }}
    >
      <div style={{ flex: '999 1 420px', minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>Çerez tercihlerin</div>
        <p style={{ margin: '4px 0 0', fontSize: 13.5, lineHeight: 1.5, color: colors.inkSoft }}>
          Zorunlu çerezler sitenin çalışması için her zaman açıktır. Reklamlarımızın ölçülmesi için Meta ve
          Google çerezlerini yalnızca izin verirsen kullanırız.{' '}
          <Link href="/cerez-aydinlatma">Çerez aydınlatma metni</Link>
        </p>
        {detay ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginTop: 10, fontSize: 13.5 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: colors.muted }}>
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 'calc(var(--rr-buton-kose) * 5 / 14)',
                  background: '#AEB5C4',
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-hidden="true"
              >
                ✓
              </span>
              Zorunlu (kapatılamaz)
            </span>
            <Kutu on={analiz} label="Analiz" onClick={() => setAnaliz(!analiz)} />
            <Kutu on={reklam} label="Reklam ölçümü (Meta, Google)" onClick={() => setReklam(!reklam)} />
          </div>
        ) : null}
      </div>
      <div
        className="rr-cerez-dugmeler"
        style={{
          flex: '1 1 420px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}
      >
        <button
          type="button"
          onClick={() => setDetay(!detay)}
          style={{
            border: 0,
            background: 'transparent',
            padding: '10px 6px',
            fontSize: 14,
            fontWeight: 700,
            color: colors.link,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {detay ? 'Tercihleri gizle' : 'Tercihleri yönet'}
        </button>
        <button type="button" onClick={() => bitir({ analiz: false, reklam: false })} style={outline}>
          Reddet
        </button>
        <button
          type="button"
          onClick={() => bitir(detay ? { analiz, reklam } : { analiz: true, reklam: true })}
          style={outline}
        >
          {detay ? 'Seçimleri kaydet' : 'Tümünü kabul et'}
        </button>
      </div>
    </section>
  );
}
