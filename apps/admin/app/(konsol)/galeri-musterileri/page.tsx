'use client';

import { CARE_FILTERS, type CareFilter } from '@rengarenk/shared';
import Link from 'next/link';
import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';

interface Satir {
  accountId: string;
  ad: string;
  yer: string;
  paket: string;
  sorumlu: { id: string; ad: string } | null;
  risk: { puan: number; duzey: string; ad: string; bg: string; fg: string; gerekceler: string[] };
  yenileme: { tarih: string; ne: string; kalanGun: number } | null;
  ilkMesaj30: number;
  sonGiris: string | null;
}
interface Liste {
  sayilar: { toplam: number; yuksek: number; yenileme30: number; sorumsuz: number };
  satirlar: Satir[];
  calisanlar: { id: string; name: string }[];
}

const kart: CSSProperties = { background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 18 };
const tarih = (s: string) => new Date(s).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
const once = (s: string | null) => {
  if (!s) return 'hiç girmedi';
  const g = Math.floor((Date.now() - new Date(s).getTime()) / 86_400_000);
  return g <= 0 ? 'bugün girdi' : `${g} gün önce girdi`;
};

/**
 * Galeri müşterileri (Karar 43 ek başlık: sorumlu çalışan, notlar, yenileme takibi, ayrılma riski). Tasarımda ayrı ekran
 * yok; YonetimPazar.dc.html liste ve kart dili kullanıldı. Risk kurallarla hesaplanır, gerekçeleri satırda görünür;
 * notlar ve sorumlu ataması galeri kartında (Kullanıcılar ve galeriler).
 */
export default function GaleriMusterileri() {
  const { me } = useKonsol();
  const [filtre, setFiltre] = useState<CareFilter>('hepsi');
  const [q, setQ] = useState('');
  const [aranan, setAranan] = useState('');
  const [l, setL] = useState<Liste | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const atayabilir = me.permissions['galeri_basvuru.onayla'] === 'tam';

  const yukle = useCallback(async (f: CareFilter, aranan: string) => {
    try {
      setL(await yonetim<Liste>(`galleries/care?filtre=${f}&q=${encodeURIComponent(aranan)}`));
    } catch (e) {
      setHata((e as Error).message);
    }
  }, []);
  useEffect(() => {
    yukle(filtre, aranan);
  }, [filtre, aranan, yukle]);

  async function ata(s: Satir, calisan: string) {
    setHata(null);
    try {
      await yonetim(`people/galeri/${s.accountId}/manager`, {
        method: 'POST',
        body: { calisan: calisan || null },
      });
      setBilgi(calisan ? `${s.ad} için sorumlu atandı.` : `${s.ad} için sorumlu kaldırıldı.`);
      yukle(filtre, aranan);
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  const kutu = (ad: string, deger: number, renk = '#1E2333') => (
    <div style={{ ...kart, padding: '14px 16px' }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: renk }}>{deger}</div>
      <div style={{ fontSize: 12.5, color: '#5A6073' }}>{ad}</div>
    </div>
  );

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Galeri müşterileri</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#5A6073' }}>
          Sorumlu çalışan, yenileme takibi ve ayrılma riski. Risk kurallarla hesaplanır; notlar galeri
          kartında.
        </p>
      </div>
      {hata ? <p style={{ color: '#A3271F', fontWeight: 700 }}>{hata}</p> : null}
      {bilgi ? (
        <p
          role="status"
          style={{
            background: '#E7FAF0',
            color: '#11683F',
            borderRadius: 12,
            padding: '10px 14px',
            fontWeight: 700,
          }}
        >
          {bilgi}
        </p>
      ) : null}
      {l ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            marginBottom: 16,
          }}
        >
          {kutu('galeri', l.sayilar.toplam)}
          {kutu('riski yüksek', l.sayilar.yuksek, '#A3271F')}
          {kutu('30 gün içinde yenileme', l.sayilar.yenileme30, '#7A5300')}
          {kutu('sorumlusu yok', l.sayilar.sorumsuz)}
        </div>
      ) : null}

      <section style={{ ...kart, overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center',
            padding: '14px 18px',
            borderBottom: '1px solid #EEF0F5',
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setAranan(q.trim());
            }}
            style={{ flex: '1 1 220px', display: 'flex', gap: 8 }}
          >
            <label className="sr-only" htmlFor="galeri-ara">
              Galeri ara
            </label>
            <input
              id="galeri-ara"
              placeholder="Galeri adı"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{
                flex: 1,
                minWidth: 0,
                border: '1px solid #D5DAE5',
                borderRadius: 10,
                padding: '9px 12px',
                fontSize: 14,
                fontFamily: 'inherit',
              }}
            />
          </form>
          <div role="tablist" aria-label="Süzgeç" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {CARE_FILTERS.map(([k, ad]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={filtre === k}
                onClick={() => setFiltre(k)}
                style={{
                  border: filtre === k ? 0 : '1px solid #D5DAE5',
                  background: filtre === k ? '#1E2333' : '#FFFFFF',
                  color: filtre === k ? '#FFFFFF' : '#1E2333',
                  borderRadius: 999,
                  padding: '8px 14px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {ad}
              </button>
            ))}
          </div>
        </div>
        {l && !l.satirlar.length ? (
          <p style={{ margin: 0, padding: 18, fontSize: 13.5, color: '#5A6073' }}>Bu süzgeçte galeri yok.</p>
        ) : null}
        {l?.satirlar.map((s) => (
          <div
            key={s.accountId}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '8px 16px',
              padding: '12px 18px',
              borderBottom: '1px solid #EEF0F5',
              fontSize: 13.5,
            }}
          >
            <span style={{ flex: '2 1 240px', minWidth: 0 }}>
              <Link
                href={`/kullanicilar?galeri=${s.accountId}`}
                style={{ display: 'block', fontWeight: 800, color: '#1E2333', textDecoration: 'none' }}
              >
                {s.ad}
              </Link>
              <span style={{ display: 'block', fontSize: 12.5, color: '#5A6073', marginTop: 2 }}>
                {s.yer} · {s.paket} · 30 günde {s.ilkMesaj30} ilk mesaj · {once(s.sonGiris)}
              </span>
            </span>
            <span style={{ flex: '2 1 220px', minWidth: 0 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  padding: '3px 9px',
                  borderRadius: 999,
                  background: s.risk.bg,
                  color: s.risk.fg,
                }}
              >
                Risk {s.risk.ad.toLocaleLowerCase('tr-TR')} · {s.risk.puan}
              </span>
              {s.risk.gerekceler.length ? (
                <span style={{ display: 'block', fontSize: 12, color: '#5A6073', marginTop: 4 }}>
                  {s.risk.gerekceler.join(' · ')}
                </span>
              ) : null}
            </span>
            <span style={{ flex: '1 1 150px', fontSize: 12.5 }}>
              {s.yenileme ? (
                <>
                  <span style={{ display: 'block', fontWeight: 700 }}>{s.yenileme.ne}</span>
                  <span style={{ color: s.yenileme.kalanGun <= 7 ? '#A3271F' : '#5A6073' }}>
                    {tarih(s.yenileme.tarih)} ·{' '}
                    {s.yenileme.kalanGun < 0
                      ? `${-s.yenileme.kalanGun} gün önce`
                      : s.yenileme.kalanGun === 0
                        ? 'bugün'
                        : `${s.yenileme.kalanGun} gün kaldı`}
                  </span>
                </>
              ) : (
                <span style={{ color: '#5A6073' }}>Yenileme yok</span>
              )}
            </span>
            <span style={{ flex: '1 1 170px' }}>
              {atayabilir ? (
                <select
                  aria-label={`${s.ad} sorumlu çalışan`}
                  value={s.sorumlu?.id ?? ''}
                  onChange={(e) => ata(s, e.target.value)}
                  style={{
                    width: '100%',
                    border: '1px solid #D5DAE5',
                    borderRadius: 10,
                    padding: '8px 10px',
                    fontSize: 13,
                    background: '#FFFFFF',
                    fontFamily: 'inherit',
                  }}
                >
                  <option value="">Sorumlu yok</option>
                  {l.calisanlar.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span style={{ fontSize: 12.5, color: '#3A4052' }}>{s.sorumlu?.ad ?? 'Sorumlu yok'}</span>
              )}
            </span>
          </div>
        ))}
      </section>
    </>
  );
}
