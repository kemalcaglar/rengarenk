'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { IlkMesaj } from '../../components/ilk-mesaj';
import { istek } from '../../lib/istemci';
import { zaman } from '../../lib/talep-bicim';

export interface EslesmeVerisi {
  /** Pakette otomatik eşleşme var mı (Profesyonel, Kurumsal, deneme; Karar 12.2) */
  eslesme: boolean;
  gunlukMesaj: number;
  /** Bugün kalan ilk mesaj (paketin günlük hakkı) */
  kalanMesaj: number;
  yeni: number;
  toplam: number;
  araclar: { id: string; ad: string; sayi: number }[];
  eslesmeler: {
    id: string;
    skor: number;
    uyum: string;
    yeni: boolean;
    zaman: string;
    /** Bu galerinin bu talebe attığı ilk mesajın sohbeti */
    sohbet: string | null;
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
 * eşleşmeler görüldü sayılır. "Araç kartıyla mesaj at" ilk mesaj penceresini galeri adına ve araç kartıyla açar.
 */
export function Eslesmeler({
  accountId,
  veri,
  gorundu,
  yenile,
}: {
  accountId: string;
  veri: EslesmeVerisi | null;
  gorundu: () => void;
  yenile: () => void;
}) {
  const yeni = veri?.yeni ?? 0;
  const [pencere, setPencere] = useState<EslesmeVerisi['eslesmeler'][number] | null>(null);
  const [gonderilen, setGonderilen] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!yeni) return;
    istek(`/gallery/${accountId}/matches/seen`, { method: 'POST' })
      .then(gorundu)
      .catch(() => undefined);
  }, [accountId, yeni, gorundu]);

  return (
    <>
      <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800 }}>Eşleşmeler</h1>
      <p style={{ margin: '0 0 18px', fontSize: 14.5, color: 'var(--rr-soluk, #5A6073)' }}>
        Portföyündeki araçlara uyan alıcı talepleri. Bugün kalan ilk mesaj hakkın:{' '}
        <strong style={{ color: 'var(--rr-murekkep, #1E2333)' }}>
          {veri?.kalanMesaj ?? 0} / {veri?.gunlukMesaj ?? 0}
        </strong>
      </p>
      {!veri ? <p style={{ color: 'var(--rr-soluk, #5A6073)' }}>Yükleniyor…</p> : null}
      {veri && !veri.eslesme ? (
        <div
          style={{
            background: 'var(--rr-kart, #FFFFFF)',
            border: '1px solid var(--rr-cizgi, #E3E6EF)',
            borderRadius: 'var(--rr-kart-kose)',
            padding: 18,
          }}
        >
          <p style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Otomatik eşleşme paketinde yok</p>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--rr-soluk, #5A6073)', lineHeight: 1.5 }}>
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
            background: 'var(--rr-kart, #FFFFFF)',
            border: '1px dashed #C9CFDB',
            borderRadius: 'var(--rr-kart-kose)',
            padding: 20,
            fontSize: 14,
            color: 'var(--rr-soluk, #5A6073)',
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
                  background: 'var(--rr-kart, #FFFFFF)',
                  border: '1px solid var(--rr-cizgi, #E3E6EF)',
                  borderRadius: 'var(--rr-kart-kose)',
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
                    borderRadius: 'var(--rr-buton-kose)',
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
                      color: 'var(--rr-murekkep, #1E2333)',
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
                    style={{
                      display: 'block',
                      fontSize: 15,
                      fontWeight: 800,
                      color: 'var(--rr-murekkep, #1E2333)',
                    }}
                  >
                    {e.talep.baslik}
                  </Link>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 13,
                      color: 'var(--rr-soluk, #5A6073)',
                      marginTop: 3,
                    }}
                  >
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
                      borderRadius: 'var(--rr-etiket-kose)',
                    }}
                  >
                    {e.uyum}
                  </span>
                </div>
                {e.sohbet || gonderilen[e.id] ? (
                  <Link
                    href={`/mesajlarim?sohbet=${e.sohbet ?? gonderilen[e.id]}`}
                    style={{ flex: 'none', fontSize: 14, fontWeight: 700, color: '#11683F' }}
                  >
                    İlk mesaj gönderildi
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPencere(e)}
                    style={{
                      flex: 'none',
                      border: 0,
                      background: 'var(--rr-mavi, #5B8CFF)',
                      borderRadius: 'calc(var(--rr-buton-kose) * 12 / 14)',
                      padding: '12px 16px',
                      fontSize: 14,
                      fontWeight: 800,
                      color: 'var(--rr-maviYazi, #1E2333)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Araç kartıyla mesaj at
                  </button>
                )}
              </div>
            ))
          : null}
      </div>
      {pencere ? (
        <IlkMesaj
          talepNo={pencere.talep.no}
          talepBaslik={pencere.talep.baslik}
          sahip={pencere.talep.sahip}
          hesap={accountId}
          arac={{ id: pencere.arac.id, ad: pencere.arac.ad }}
          kapat={() => setPencere(null)}
          gonderildi={(id) => {
            setGonderilen((g) => ({ ...g, [pencere.id]: id }));
            setPencere(null);
            yenile();
          }}
        />
      ) : null}
    </>
  );
}
