'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { istek } from '../../lib/istemci';
import { zaman } from '../../lib/talep-bicim';

export interface EslesmeVerisi {
  /** Pakette otomatik eşleşme var mı (Profesyonel, Kurumsal, deneme; Karar 12.2) */
  eslesme: boolean;
  gunlukMesaj: number;
  yeni: number;
  toplam: number;
  araclar: { id: string; ad: string; sayi: number }[];
  eslesmeler: {
    id: string;
    skor: number;
    uyum: string;
    yeni: boolean;
    zaman: string;
    arac: { id: string; no: number; ad: string; foto: string | null };
    talep: {
      no: number;
      baslik: string;
      sahip: string;
      il: string | null;
      ilce: string | null;
      butceMin: number | null;
      butceMax: number | null;
    };
  }[];
}

/**
 * Galeri paneli › Eşleşmeler (GaleriPanel.dc.html): portföydeki araçlara uyan alıcı talepleri. Ekran açılınca
 * eşleşmeler görüldü sayılır. "Araç kartıyla mesaj at" ilk mesaj ve haklar (Aşama 5 ikinci bölüm) gelince açılır.
 */
export function Eslesmeler({
  accountId,
  veri,
  gorundu,
}: {
  accountId: string;
  veri: EslesmeVerisi | null;
  gorundu: () => void;
}) {
  const yeni = veri?.yeni ?? 0;
  useEffect(() => {
    if (!yeni) return;
    istek(`/gallery/${accountId}/matches/seen`, { method: 'POST' })
      .then(gorundu)
      .catch(() => undefined);
  }, [accountId, yeni, gorundu]);

  return (
    <>
      <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800 }}>Eşleşmeler</h1>
      <p style={{ margin: '0 0 18px', fontSize: 14.5, color: '#5A6073' }}>
        Portföyündeki araçlara uyan alıcı talepleri. Bugün kalan ilk mesaj hakkın:{' '}
        <strong style={{ color: '#1E2333' }}>
          {veri?.gunlukMesaj ?? 0} / {veri?.gunlukMesaj ?? 0}
        </strong>
      </p>
      {!veri ? <p style={{ color: '#5A6073' }}>Yükleniyor…</p> : null}
      {veri && !veri.eslesme ? (
        <div style={{ background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 18, padding: 18 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Otomatik eşleşme paketinde yok</p>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: '#5A6073', lineHeight: 1.5 }}>
            Portföyüne uyan talepler Profesyonel ve Kurumsal paketlerde listelenir. Talepleri arayarak bulup
            yazmaya devam edebilirsin.
          </p>
          <Link
            href="/talepler"
            style={{ display: 'inline-block', marginTop: 10, fontSize: 14, fontWeight: 700 }}
          >
            Talepleri ara
          </Link>
        </div>
      ) : null}
      {veri?.eslesme && !veri.eslesmeler.length ? (
        <div
          style={{
            background: '#FFFFFF',
            border: '1px dashed #C9CFDB',
            borderRadius: 18,
            padding: 20,
            fontSize: 14,
            color: '#5A6073',
          }}
        >
          Henüz eşleşme yok. Yayındaki araçlarına uyan yeni talepler burada görünür.
        </div>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {veri?.eslesme
          ? veri.eslesmeler.map((e) => (
              <div
                key={e.id}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E3E6EF',
                  borderRadius: 18,
                  padding: '16px 18px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '14px 20px',
                }}
              >
                <div
                  style={{
                    flex: '1 1 220px',
                    minWidth: 0,
                    background: '#FFF6DF',
                    borderRadius: 14,
                    padding: '12px 14px',
                  }}
                >
                  <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#7A5300' }}>
                    Portföyündeki araç
                  </span>
                  <Link
                    href={`/arac/${e.arac.no}`}
                    style={{
                      display: 'block',
                      fontSize: 14.5,
                      fontWeight: 800,
                      marginTop: 2,
                      color: '#1E2333',
                      textDecoration: 'none',
                    }}
                  >
                    {e.arac.ad}
                  </Link>
                </div>
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#5A6073"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
                <div style={{ flex: '2 1 300px', minWidth: 0 }}>
                  <Link
                    href={`/talep/${e.talep.no}`}
                    style={{ display: 'block', fontSize: 15, fontWeight: 800, color: '#1E2333' }}
                  >
                    {e.talep.baslik}
                  </Link>
                  <span style={{ display: 'block', fontSize: 13, color: '#5A6073', marginTop: 3 }}>
                    {[e.talep.sahip, [e.talep.il, e.talep.ilce].filter(Boolean).join(', '), zaman(e.zaman)]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: 6,
                      background: '#E7FAF0',
                      color: '#11683F',
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '3px 9px',
                      borderRadius: 999,
                    }}
                  >
                    {e.uyum}
                  </span>
                </div>
                <button
                  type="button"
                  disabled
                  title="İlk mesaj ve haklar bir sonraki bölümde açılacak"
                  style={{
                    flex: 'none',
                    border: 0,
                    background: '#5B8CFF',
                    borderRadius: 12,
                    padding: '12px 16px',
                    fontSize: 14,
                    fontWeight: 800,
                    color: '#1E2333',
                    cursor: 'default',
                    opacity: 0.55,
                    fontFamily: 'inherit',
                  }}
                >
                  Araç kartıyla mesaj at
                </button>
              </div>
            ))
          : null}
      </div>
    </>
  );
}
