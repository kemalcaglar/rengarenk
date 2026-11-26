'use client';

import { MESSAGE_MAX } from '@rengarenk/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cx } from '../lib/cx';
import { istek } from '../lib/istemci';
import stil from './ilk-mesaj.module.css';

interface Durum {
  kendi: boolean;
  yazildi: string | null;
  hesap?: string;
  hesaplar: { id: string; ad: string; galeri: boolean }[];
  gunluk: { toplam: number; kalan: number } | null;
  ek: number;
  engel: string | null;
}
interface PortfoyAraci {
  id: string;
  ad: string;
  durum: string;
}

/**
 * İlk mesaj penceresi (GaleriMobil.dc.html › İlk mesaj; Karar 08.1, 11, 26). Satıcı talebe tek ilk mesaj atar; galeri
 * adına yazılıyorsa yayındaki portföy aracı kart olarak eklenebilir. Hak: önce günlük (bireyselde ücretsiz, galeride
 * paketin günlük hakkı), sonra ek hak. Pencere açılınca taslak gelir (Karar 42): galeride eşleştirmenin en uygun
 * bulduğu portföy aracı önerilir; "✦ Taslağı yeniden yaz" başka bir taslak getirir. Gönderen her zaman satıcıdır.
 */
export function IlkMesaj({
  talepNo,
  talepBaslik,
  sahip,
  hesap: ilkHesap,
  arac: ilkArac,
  yasalUyari,
  kapat,
  gonderildi,
}: {
  talepNo: number;
  talepBaslik: string;
  sahip?: string;
  hesap?: string;
  arac?: { id: string; ad: string } | null;
  yasalUyari?: string | null;
  kapat: () => void;
  gonderildi: (sohbetId: string) => void;
}) {
  const [hesap, setHesap] = useState<string | undefined>(ilkHesap);
  const [d, setD] = useState<Durum | null>(null);
  const [araclar, setAraclar] = useState<PortfoyAraci[]>([]);
  const [aracId, setAracId] = useState<string>(ilkArac?.id ?? '');
  const [metin, setMetin] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const [sira, setSira] = useState(0);
  const [yaziyor, setYaziyor] = useState(false);
  const elle = useRef(false);

  useEffect(() => {
    istek<Durum>(`/talepler/${talepNo}/mesaj${hesap ? `?hesap=${hesap}` : ''}`)
      .then((x) => {
        setD(x);
        if (!hesap && x.hesap) setHesap(x.hesap);
      })
      .catch((e: Error) => setHata(e.message));
  }, [talepNo, hesap]);

  const secili = d?.hesaplar.find((h) => h.id === (hesap ?? d.hesap));
  useEffect(() => {
    if (!secili?.galeri) {
      setAraclar([]);
      return;
    }
    istek<{ araclar: PortfoyAraci[] }>(`/gallery/${secili.id}/portfolio`)
      .then((l) => setAraclar(l.araclar.filter((a) => a.durum === 'PUBLISHED')))
      .catch(() => setAraclar([]));
  }, [secili?.id, secili?.galeri]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && kapat();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [kapat]);

  // Taslak: hesap seçilince (ve "yeniden yaz" ile) gelir; kişi metni elle değiştirdiyse üzerine yazılmaz
  const taslakGetir = useCallback(
    async (n: number, zorla = false) => {
      if (!d || d.kendi || d.yazildi || (elle.current && !zorla)) return;
      setYaziyor(true);
      try {
        const r = await istek<{ metin: string; arac: { id: string; ad: string } | null }>(
          `/talepler/${talepNo}/mesaj/taslak`,
          {
            method: 'POST',
            body: {
              sira: n,
              ...(secili?.galeri ? { hesap: secili.id } : {}),
              ...(secili?.galeri && aracId ? { aracId } : {}),
            },
          },
        );
        setMetin(r.metin);
        elle.current = false;
        if (r.arac && !aracId) setAracId(r.arac.id);
      } catch {
        // Taslak gelmezse kişi kendisi yazar
      } finally {
        setYaziyor(false);
      }
    },
    [d, talepNo, secili?.galeri, secili?.id, aracId],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: hesap ya da araç değişince yeni taslak
  useEffect(() => {
    taslakGetir(0);
  }, [d?.hesap, secili?.id, aracId]);

  const hakVar = (d?.gunluk?.kalan ?? 0) > 0 || (d?.ek ?? 0) > 0;
  const gunlukAd = secili?.galeri ? 'Bugün kalan ilk mesaj hakkın' : 'Bugün kalan ücretsiz mesaj hakkın';

  async function gonder() {
    setHata(null);
    setMesgul(true);
    try {
      const r = await istek<{ id: string }>(`/talepler/${talepNo}/mesaj`, {
        method: 'POST',
        body: {
          metin,
          ...(secili?.galeri ? { hesap: secili.id } : {}),
          ...(secili?.galeri && aracId ? { aracId } : {}),
        },
      });
      gonderildi(r.id);
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setMesgul(false);
    }
  }

  return (
    <div className={stil.kutu1}>
      <section role="dialog" aria-modal="true" aria-labelledby="ilk-baslik" className={stil.kutu2}>
        <h2 id="ilk-baslik" className={stil.baslik1}>
          İlk mesaj
        </h2>
        <p className={stil.metin1}>{[talepBaslik, sahip].filter(Boolean).join(' · ')}</p>

        {d && d.hesaplar.length > 1 ? (
          <label className={stil.etiket1}>
            Kimin adına yazıyorsun
            <select
              value={secili?.id ?? ''}
              onChange={(e) => {
                setHesap(e.target.value);
                setAracId('');
              }}
              className={stil.girdi1}
            >
              {d.hesaplar.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.galeri ? `${h.ad} (galeri)` : 'Kendi adıma (bireysel)'}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {secili?.galeri ? (
          <label className={stil.etiket1}>
            Araç kartı (isteğe bağlı)
            <select value={aracId} onChange={(e) => setAracId(e.target.value)} className={stil.girdi1}>
              <option value="">Kart ekleme</option>
              {araclar.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.ad}
                </option>
              ))}
            </select>
            {aracId ? (
              <span className={stil.metin2}>
                <span aria-hidden="true" className={stil.metin3} />
                <span className={stil.metin4}>
                  <span className={stil.metin5}>
                    {araclar.find((a) => a.id === aracId)?.ad ?? ilkArac?.ad}
                  </span>
                  <span className={stil.metin6}>Araç kartı mesaja eklenir · EİDS doğrulandı</span>
                </span>
              </span>
            ) : null}
          </label>
        ) : null}

        <label htmlFor="ilk-metin" className={stil.etiket2}>
          Mesajın
        </label>
        <textarea
          id="ilk-metin"
          rows={5}
          maxLength={MESSAGE_MAX}
          value={metin}
          onChange={(e) => {
            elle.current = true;
            setMetin(e.target.value);
          }}
          placeholder="Merhaba, aradığınız kriterlere uyan aracım var…"
          className={stil.girdi2}
        />
        <div className={stil.kutu3}>
          <button
            type="button"
            disabled={yaziyor}
            onClick={() => {
              const n = sira + 1;
              setSira(n);
              taslakGetir(n, true);
            }}
            className={cx(stil.dugme1, yaziyor ? stil.dugme2 : stil.dugme3)}
          >
            {yaziyor ? 'Yazılıyor…' : '✦ Taslağı yeniden yaz'}
          </button>
          <span className={stil.metin7}>
            {metin.length} / {MESSAGE_MAX}
          </span>
        </div>
        <p className={stil.metin8}>
          Yalnızca metin. Telefon, IBAN, bağlantı yazma ve kapora isteme. Alıcı cevap verene kadar ikinci
          mesaj atılamaz.
        </p>
        {secili?.galeri && yasalUyari ? <p className={stil.metin9}>{yasalUyari}</p> : null}
        {d?.gunluk ? (
          <p className={stil.metin10}>
            {gunlukAd}:{' '}
            <strong>
              {d.gunluk.kalan} / {d.gunluk.toplam}
            </strong>
            {d.ek ? ` · ek hak ${d.ek}` : ''}
            {!hakVar ? ' · Bugünkü hakkın bitti; ek mesaj paketi ödemelerle açılacak.' : ''}
          </p>
        ) : null}
        {d?.engel || hata ? (
          <p role="alert" className={stil.metin11}>
            {hata ?? d?.engel}
          </p>
        ) : null}
        <div className={stil.kutu4}>
          <button type="button" onClick={kapat} className={stil.dugme4}>
            Vazgeç
          </button>
          <button
            type="button"
            disabled={mesgul || !metin.trim() || !d || !!d.engel || !hakVar}
            onClick={gonder}
            className={stil.dugme5}
            style={{ opacity: mesgul || !metin.trim() || !d || d.engel || !hakVar ? 0.55 : 1 }}
          >
            {mesgul ? 'Gönderiliyor…' : 'Gönder · 1 hak kullanılır'}
          </button>
        </div>
      </section>
    </div>
  );
}
