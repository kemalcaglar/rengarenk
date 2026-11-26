'use client';

import { CARE_FILTERS, type CareFilter } from '@rengarenk/shared';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { cx } from '../../../lib/cx';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';
import stil from './page.module.css';

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
    <div className={stil.kutu1}>
      <div className={stil.kutu2} style={{ color: renk }}>
        {deger}
      </div>
      <div className={stil.kutu3}>{ad}</div>
    </div>
  );

  return (
    <>
      <div className={stil.kutu4}>
        <h1 className={stil.baslik1}>Galeri müşterileri</h1>
        <p className={stil.metin1}>
          Sorumlu çalışan, yenileme takibi ve ayrılma riski. Risk kurallarla hesaplanır; notlar galeri
          kartında.
        </p>
      </div>
      {hata ? <p className={stil.metin2}>{hata}</p> : null}
      {bilgi ? (
        <p role="status" className={stil.metin3}>
          {bilgi}
        </p>
      ) : null}
      {l ? (
        <div className={stil.kutu5}>
          {kutu('galeri', l.sayilar.toplam)}
          {kutu('riski yüksek', l.sayilar.yuksek, '#A3271F')}
          {kutu('30 gün içinde yenileme', l.sayilar.yenileme30, '#7A5300')}
          {kutu('sorumlusu yok', l.sayilar.sorumsuz)}
        </div>
      ) : null}

      <section className={stil.kutu6}>
        <div className={stil.kutu7}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setAranan(q.trim());
            }}
            className={stil.kutu8}
          >
            <label className="sr-only" htmlFor="galeri-ara">
              Galeri ara
            </label>
            <input
              id="galeri-ara"
              placeholder="Galeri adı"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className={stil.girdi1}
            />
          </form>
          <div role="tablist" aria-label="Süzgeç" className={stil.kutu9}>
            {CARE_FILTERS.map(([k, ad]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={filtre === k}
                onClick={() => setFiltre(k)}
                className={cx(stil.dugme1, filtre === k ? stil.dugme2 : stil.dugme3)}
              >
                {ad}
              </button>
            ))}
          </div>
        </div>
        {l && !l.satirlar.length ? <p className={stil.metin4}>Bu süzgeçte galeri yok.</p> : null}
        {l?.satirlar.map((s) => (
          <div key={s.accountId} className={stil.kutu10}>
            <span className={stil.metin5}>
              <Link href={`/kullanicilar?galeri=${s.accountId}`} className={stil.bag1}>
                {s.ad}
              </Link>
              <span className={stil.metin6}>
                {s.yer} · {s.paket} · 30 günde {s.ilkMesaj30} ilk mesaj · {once(s.sonGiris)}
              </span>
            </span>
            <span className={stil.metin7}>
              <span className={stil.metin8} style={{ background: s.risk.bg, color: s.risk.fg }}>
                Risk {s.risk.ad.toLocaleLowerCase('tr-TR')} · {s.risk.puan}
              </span>
              {s.risk.gerekceler.length ? (
                <span className={stil.metin9}>{s.risk.gerekceler.join(' · ')}</span>
              ) : null}
            </span>
            <span className={stil.metin10}>
              {s.yenileme ? (
                <>
                  <span className={stil.metin11}>{s.yenileme.ne}</span>
                  <span className={cx(s.yenileme.kalanGun <= 7 ? stil.metin12 : stil.metin13)}>
                    {tarih(s.yenileme.tarih)} ·{' '}
                    {s.yenileme.kalanGun < 0
                      ? `${-s.yenileme.kalanGun} gün önce`
                      : s.yenileme.kalanGun === 0
                        ? 'bugün'
                        : `${s.yenileme.kalanGun} gün kaldı`}
                  </span>
                </>
              ) : (
                <span className={stil.metin13}>Yenileme yok</span>
              )}
            </span>
            <span className={stil.metin14}>
              {atayabilir ? (
                <select
                  aria-label={`${s.ad} sorumlu çalışan`}
                  value={s.sorumlu?.id ?? ''}
                  onChange={(e) => ata(s, e.target.value)}
                  className={stil.girdi2}
                >
                  <option value="">Sorumlu yok</option>
                  {l.calisanlar.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className={stil.metin15}>{s.sorumlu?.ad ?? 'Sorumlu yok'}</span>
              )}
            </span>
          </div>
        ))}
      </section>
    </>
  );
}
