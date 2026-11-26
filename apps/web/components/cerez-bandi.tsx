'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { type CerezTercihi, cerezTercihi, tercihDegisti } from '../lib/olcum';
import { colors } from '../lib/renk';
import stil from './cerez-bandi.module.css';
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
    <section aria-label="Çerez tercihleri" className={`rr-cerez ${stil.kutu1}`}>
      <div className={stil.kutu2}>
        <div className={stil.kutu3}>Çerez tercihlerin</div>
        <p className={stil.metin1}>
          Zorunlu çerezler sitenin çalışması için her zaman açıktır. Reklamlarımızın ölçülmesi için Meta ve
          Google çerezlerini yalnızca izin verirsen kullanırız.{' '}
          <Link href="/cerez-aydinlatma">Çerez aydınlatma metni</Link>
        </p>
        {detay ? (
          <div className={stil.kutu4}>
            <span className={stil.metin2}>
              <span className={stil.metin3} aria-hidden="true">
                ✓
              </span>
              Zorunlu (kapatılamaz)
            </span>
            <Kutu on={analiz} label="Analiz" onClick={() => setAnaliz(!analiz)} />
            <Kutu on={reklam} label="Reklam ölçümü (Meta, Google)" onClick={() => setReklam(!reklam)} />
          </div>
        ) : null}
      </div>
      <div className={`rr-cerez-dugmeler ${stil.kutu5}`}>
        <button type="button" onClick={() => setDetay(!detay)} className={stil.dugme1}>
          {detay ? 'Tercihleri gizle' : 'Tercihleri yönet'}
        </button>
        <button type="button" onClick={() => bitir({ analiz: false, reklam: false })} className={stil.dugme2}>
          Reddet
        </button>
        <button
          type="button"
          onClick={() => bitir(detay ? { analiz, reklam } : { analiz: true, reklam: true })}
          className={stil.dugme2}
        >
          {detay ? 'Seçimleri kaydet' : 'Tümünü kabul et'}
        </button>
      </div>
    </section>
  );
}
