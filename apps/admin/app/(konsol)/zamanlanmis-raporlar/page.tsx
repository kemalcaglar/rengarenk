'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';
import { Switch } from '../switch';

interface Kural {
  key: string;
  ad: string;
  kosul: string;
  kritik: boolean;
  acik: boolean;
  kanal: string;
  alicilar: string[];
}

/**
 * Büyüme › Zamanlanmış raporlar ve uyarılar (YonetimRapor.dc.html › zaman). Uyarılar olaydan ya da saatlik denetimden
 * açılır, Sahibe ve kuralın yetkisine sahip çalışanlara konsolda ve e-postayla gider. Kritik uyarı kapatılamaz; diğerlerini
 * yalnızca Sahip kapatır. Haftalık ve aylık raporlar, kayıtlı panolar ve "Yeni zamanlanmış rapor" Raporlar modülüyle
 * (Aşama 9) gelir.
 */
export default function ZamanlanmisRaporlar() {
  const { me } = useKonsol();
  const sahip = me.role === 'OWNER';
  const [kurallar, setKurallar] = useState<Kural[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    yonetim<Kural[]>('alerts/rules')
      .then(setKurallar)
      .catch((e: Error) => setHata(e.message));
  }, []);

  async function degistir(k: Kural) {
    try {
      const r = await yonetim<{ key: string; acik: boolean }>(`alerts/rules/${k.key}`, {
        method: 'POST',
        body: { enabled: !k.acik },
      });
      setKurallar((l) => (l ?? []).map((x) => (x.key === r.key ? { ...x, acik: r.acik } : x)));
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  const ozet = kurallar?.find((k) => k.key === 'ajan_ozet');
  const kritik = (kurallar ?? []).filter((k) => k.kritik);
  const diger = (kurallar ?? []).filter((k) => !k.kritik && k.key !== 'ajan_ozet');

  const satir = (k: Kural) => (
    <div
      key={k.key}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '6px 14px',
        padding: '12px 18px',
        borderBottom: '1px solid #EEF0F5',
        fontSize: 13.5,
      }}
    >
      <span style={{ flex: '999 1 280px', minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 700 }}>{k.kosul}</span>
        <span style={{ display: 'block', fontSize: 12, color: '#5A6073', marginTop: 2 }}>{k.ad}</span>
      </span>
      <span style={{ flex: 'none', color: '#3A4052' }}>
        {k.kanal} · {k.alicilar.join(', ')}
      </span>
      {k.kritik ? null : (
        <span
          style={{
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          <Switch
            on={k.acik}
            label={`${k.ad}: aç veya kapat`}
            disabled={!sahip}
            onChange={() => degistir(k)}
          />
          {k.acik ? 'Açık' : 'Kapalı'}
        </span>
      )}
    </div>
  );

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Zamanlanmış raporlar ve uyarılar</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#5A6073' }}>
          Raporlar ve uyarılar şirket e-postana gelir; konsolda <Link href="/uyarilar">Uyarılar</Link>{' '}
          listesinde de görünür.
        </p>
      </div>
      {hata ? (
        <p className="k-error" role="alert">
          {hata}
        </p>
      ) : null}

      <section
        aria-labelledby="planli"
        style={{ background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 18, overflow: 'hidden' }}
      >
        <h2
          id="planli"
          style={{
            margin: 0,
            padding: '16px 18px',
            fontSize: 17,
            fontWeight: 800,
            borderBottom: '1px solid #EEF0F5',
          }}
        >
          Raporlar
        </h2>
        {ozet ? (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '8px 16px',
              padding: '13px 18px',
              borderBottom: '1px solid #EEF0F5',
            }}
          >
            <span style={{ flex: '999 1 300px', minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800 }}>{ozet.ad}</span>
              <span style={{ display: 'block', fontSize: 12.5, color: '#3A4052', marginTop: 2 }}>
                Her gün 09.00 · {ozet.alicilar.join(', ')}
              </span>
              <span style={{ display: 'block', fontSize: 12, color: '#5A6073', marginTop: 2 }}>
                E-posta ve konsol · dünün özeti, dikkat isteyenler, ajanın yaptıkları
              </span>
            </span>
            <span
              style={{
                flex: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              <Switch
                on={ozet.acik}
                label="Ajanın günlük özeti: aç veya kapat"
                disabled={!sahip}
                onChange={() => degistir(ozet)}
              />
              {ozet.acik ? 'Açık' : 'Kapalı'}
            </span>
          </div>
        ) : null}
        <p style={{ margin: 0, padding: '12px 18px', fontSize: 12.5, color: '#5A6073' }}>
          Haftalık ve aylık raporlar, galerilere “aranan modeller” raporu ve kayıtlı panolar Raporlar
          ekranıyla gelecek.
        </p>
      </section>

      <section
        aria-labelledby="uyari"
        style={{
          marginTop: 14,
          background: '#FFFFFF',
          border: '1px solid #E3E6EF',
          borderRadius: 18,
          overflow: 'hidden',
        }}
      >
        <h2
          id="uyari"
          style={{
            margin: 0,
            padding: '16px 18px',
            fontSize: 17,
            fontWeight: 800,
            borderBottom: '1px solid #EEF0F5',
          }}
        >
          Kritik uyarılar
        </h2>
        {kurallar === null ? <p className="k-empty">Yükleniyor…</p> : kritik.map(satir)}
        <p style={{ margin: 0, padding: '12px 18px', fontSize: 12.5, color: '#5A6073' }}>
          Kritik uyarılar kapatılamaz ve e-postanın konusunda “Kritik” olarak gelir.
        </p>
      </section>

      <section
        aria-labelledby="diger"
        style={{
          marginTop: 14,
          background: '#FFFFFF',
          border: '1px solid #E3E6EF',
          borderRadius: 18,
          overflow: 'hidden',
        }}
      >
        <h2
          id="diger"
          style={{
            margin: 0,
            padding: '16px 18px',
            fontSize: 17,
            fontWeight: 800,
            borderBottom: '1px solid #EEF0F5',
          }}
        >
          Diğer uyarılar
        </h2>
        {kurallar === null ? <p className="k-empty">Yükleniyor…</p> : diger.map(satir)}
        <p style={{ margin: 0, padding: '12px 18px', fontSize: 12.5, color: '#5A6073' }}>
          {sahip
            ? 'Kapattığın uyarı kimseye gitmez; değişiklik işlem kaydına girer.'
            : 'Uyarıları yalnızca sahip açıp kapatır.'}
        </p>
      </section>
    </>
  );
}
