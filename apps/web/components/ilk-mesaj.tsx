'use client';

import { MESSAGE_MAX } from '@rengarenk/shared';
import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { istek } from '../lib/istemci';

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

const dugme: CSSProperties = {
  border: 0,
  borderRadius: 'var(--rr-buton-kose)',
  padding: '13px 16px',
  fontSize: 15,
  fontWeight: 800,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(30,35,51,0.45)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ilk-baslik"
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '92vh',
          overflowY: 'auto',
          background: '#FFFFFF',
          borderRadius: 22,
          padding: '22px 22px 20px',
          color: 'var(--rr-murekkep, #1E2333)',
        }}
      >
        <h2 id="ilk-baslik" style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
          İlk mesaj
        </h2>
        <p style={{ margin: '4px 0 14px', fontSize: 13.5, color: '#5A6073' }}>
          {[talepBaslik, sahip].filter(Boolean).join(' · ')}
        </p>

        {d && d.hesaplar.length > 1 ? (
          <label style={{ display: 'block', fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>
            Kimin adına yazıyorsun
            <select
              value={secili?.id ?? ''}
              onChange={(e) => {
                setHesap(e.target.value);
                setAracId('');
              }}
              style={{
                display: 'block',
                width: '100%',
                marginTop: 6,
                border: '1px solid #D5DAE5',
                borderRadius: 'calc(var(--rr-buton-kose) - 2px)',
                padding: 11,
                fontSize: 15,
                background: '#FFFFFF',
                fontFamily: 'inherit',
              }}
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
          <label style={{ display: 'block', fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>
            Araç kartı (isteğe bağlı)
            <select
              value={aracId}
              onChange={(e) => setAracId(e.target.value)}
              style={{
                display: 'block',
                width: '100%',
                marginTop: 6,
                border: '1px solid #D5DAE5',
                borderRadius: 'calc(var(--rr-buton-kose) - 2px)',
                padding: 11,
                fontSize: 15,
                background: '#FFFFFF',
                fontFamily: 'inherit',
              }}
            >
              <option value="">Kart ekleme</option>
              {araclar.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.ad}
                </option>
              ))}
            </select>
            {aracId ? (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginTop: 8,
                  background: '#FFF6DF',
                  borderRadius: 'calc(var(--rr-buton-kose) - 2px)',
                  padding: '10px 12px',
                  fontWeight: 600,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 46,
                    height: 30,
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, #C9D3E6, #EEF1F7)',
                    flex: 'none',
                  }}
                />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 800 }}>
                    {araclar.find((a) => a.id === aracId)?.ad ?? ilkArac?.ad}
                  </span>
                  <span style={{ display: 'block', fontSize: 12, color: '#7A5300' }}>
                    Araç kartı mesaja eklenir · EİDS doğrulandı
                  </span>
                </span>
              </span>
            ) : null}
          </label>
        ) : null}

        <label
          htmlFor="ilk-metin"
          style={{ display: 'block', fontSize: 13.5, fontWeight: 700, marginBottom: 6 }}
        >
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
          style={{
            width: '100%',
            boxSizing: 'border-box',
            border: '1px solid #D5DAE5',
            borderRadius: 'var(--rr-buton-kose)',
            padding: 12,
            fontSize: 15,
            lineHeight: 1.5,
            resize: 'vertical',
            fontFamily: 'inherit',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
          <button
            type="button"
            disabled={yaziyor}
            onClick={() => {
              const n = sira + 1;
              setSira(n);
              taslakGetir(n, true);
            }}
            style={{
              border: 0,
              background: 'transparent',
              padding: '6px 0',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--rr-baglanti, #2450C8)',
              cursor: yaziyor ? 'default' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {yaziyor ? 'Yazılıyor…' : '✦ Taslağı yeniden yaz'}
          </button>
          <span style={{ fontSize: 12.5, color: '#5A6073', padding: '6px 0' }}>
            {metin.length} / {MESSAGE_MAX}
          </span>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 12.5, lineHeight: 1.5, color: '#5A6073' }}>
          Yalnızca metin. Telefon, IBAN, bağlantı yazma ve kapora isteme. Alıcı cevap verene kadar ikinci
          mesaj atılamaz.
        </p>
        {secili?.galeri && yasalUyari ? (
          <p
            style={{
              margin: '10px 0 0',
              fontSize: 12.5,
              lineHeight: 1.5,
              color: '#3A4052',
              background: '#F3F5FA',
              borderRadius: 'calc(var(--rr-buton-kose) - 2px)',
              padding: '10px 12px',
            }}
          >
            {yasalUyari}
          </p>
        ) : null}
        {d?.gunluk ? (
          <p style={{ margin: '10px 0 0', fontSize: 13, color: '#3A4052' }}>
            {gunlukAd}:{' '}
            <strong>
              {d.gunluk.kalan} / {d.gunluk.toplam}
            </strong>
            {d.ek ? ` · ek hak ${d.ek}` : ''}
            {!hakVar ? ' · Bugünkü hakkın bitti; ek mesaj paketi ödemelerle açılacak.' : ''}
          </p>
        ) : null}
        {d?.engel || hata ? (
          <p
            role="alert"
            style={{
              margin: '10px 0 0',
              background: '#FFF0EE',
              border: '1px solid #F5C6C0',
              borderRadius: 'calc(var(--rr-buton-kose) - 2px)',
              padding: '10px 12px',
              fontSize: 13.5,
              color: '#A3271F',
            }}
          >
            {hata ?? d?.engel}
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button
            type="button"
            onClick={kapat}
            style={{
              ...dugme,
              flex: '0 0 auto',
              background: '#F3F5FA',
              color: 'var(--rr-murekkep, #1E2333)',
              fontWeight: 700,
            }}
          >
            Vazgeç
          </button>
          <button
            type="button"
            disabled={mesgul || !metin.trim() || !d || !!d.engel || !hakVar}
            onClick={gonder}
            style={{
              ...dugme,
              flex: 1,
              background: 'var(--rr-mavi, #5B8CFF)',
              color: 'var(--rr-murekkep, #1E2333)',
              opacity: mesgul || !metin.trim() || !d || d.engel || !hakVar ? 0.55 : 1,
            }}
          >
            {mesgul ? 'Gönderiliyor…' : 'Gönder · 1 hak kullanılır'}
          </button>
        </div>
      </section>
    </div>
  );
}
