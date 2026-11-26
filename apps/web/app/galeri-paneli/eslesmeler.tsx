'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { IlkMesaj } from '../../components/ilk-mesaj';
import { istek } from '../../lib/istemci';
import { zaman } from '../../lib/talep-bicim';
import stil from './eslesmeler.module.css';

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
      <h1 className={stil.baslik1}>Eşleşmeler</h1>
      <p className={stil.metin1}>
        Portföyündeki araçlara uyan alıcı talepleri. Bugün kalan ilk mesaj hakkın:{' '}
        <strong className={stil.metin2}>
          {veri?.kalanMesaj ?? 0} / {veri?.gunlukMesaj ?? 0}
        </strong>
      </p>
      {!veri ? <p className={stil.metin3}>Yükleniyor…</p> : null}
      {veri && !veri.eslesme ? (
        <div className={stil.kutu1}>
          <p className={stil.metin4}>Otomatik eşleşme paketinde yok</p>
          <p className={stil.metin5}>
            Portföyüne uyan talepler Profesyonel ve Kurumsal paketlerde listelenir. Talepleri arayarak bulup
            yazmaya devam edebilirsin.
          </p>
          <Link href="/talepler" className={stil.bag1}>
            Talepleri ara
          </Link>
        </div>
      ) : null}
      {veri?.eslesme && !veri.eslesmeler.length ? (
        <div className={stil.kutu2}>
          Henüz eşleşme yok. Yayındaki araçlarına uyan yeni talepler burada görünür.
        </div>
      ) : null}
      <div className={stil.kutu3}>
        {veri?.eslesme
          ? veri.eslesmeler.map((e) => (
              <div key={e.id} className={stil.kutu4}>
                <div className={stil.kutu5}>
                  <span className={stil.metin6}>Portföyündeki araç</span>
                  <Link href={`/arac/${e.arac.no}`} className={stil.bag2}>
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
                <div className={stil.kutu6}>
                  <Link href={`/talep/${e.talep.no}`} className={stil.bag3}>
                    {e.talep.baslik}
                  </Link>
                  <span className={stil.metin7}>
                    {[e.talep.sahip, [e.talep.il, e.talep.ilce].filter(Boolean).join(', '), zaman(e.zaman)]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <span className={stil.metin8}>{e.uyum}</span>
                </div>
                {e.sohbet || gonderilen[e.id] ? (
                  <Link href={`/mesajlarim?sohbet=${e.sohbet ?? gonderilen[e.id]}`} className={stil.bag4}>
                    İlk mesaj gönderildi
                  </Link>
                ) : (
                  <button type="button" onClick={() => setPencere(e)} className={stil.dugme1}>
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
