'use client';

import { CLOSE_REASON_KEYS, CLOSE_REASONS, type CloseReason, tlYaz } from '@rengarenk/shared';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { erisim, istek } from '../../../lib/istemci';

interface Onizleme {
  engel: string | null;
  iade: { satirlar: { ad: string; tutarKurus: number }[]; toplamKurus: number };
  magaza: boolean;
}

const girdi: CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #E5A6A1',
  borderRadius: 10,
  padding: 11,
  fontSize: 14.5,
  background: '#FFFFFF',
  fontFamily: 'inherit',
};
const kapatDugme: CSSProperties = {
  border: '1px solid #E5A6A1',
  background: '#FFFFFF',
  borderRadius: 12,
  padding: '12px 18px',
  fontSize: 14.5,
  fontWeight: 800,
  color: '#A3271F',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

/**
 * Ayarlar › Hesap › Hesabı kapat (Ayarlar.dc.html; Karar 31, 39, 59). SMS koduyla onaylanır. Kullanılmamış hakların
 * iadesi Sahip'in onayına gider; ekranda tutar "iade edilir" diye gösterilir, onaydan sonra karta yansır.
 */
export function HesabiKapat({
  telefon,
  bildir,
}: {
  telefon: string;
  bildir: (m: string | null, h?: string | null) => void;
}) {
  const [o, setO] = useState<Onizleme | null>(null);
  const [adim, setAdim] = useState(false);
  const [neden, setNeden] = useState<CloseReason>('buldum');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [kod, setKod] = useState('');
  const [gonderiliyor, setGonderiliyor] = useState(false);

  // Üst bileşen her çizimde yeni `bildir` verir; önizleme yalnızca bir kez yüklenir
  const bildirRef = useRef(bildir);
  bildirRef.current = bildir;
  useEffect(() => {
    istek<Onizleme>('/me/close')
      .then(setO)
      .catch((e: Error) => bildirRef.current(null, e.message));
  }, []);

  async function kodGonder() {
    try {
      const r = await istek<{ challengeId: string; devCode?: string }>('/auth/otp/request', {
        method: 'POST',
        body: { phone: telefon },
      });
      setChallengeId(r.challengeId);
      setKod(r.devCode ?? '');
      bildir('Telefonuna doğrulama kodu gönderdik.');
    } catch (e) {
      bildir(null, (e as Error).message);
    }
  }
  async function kapat() {
    if (!challengeId) return;
    setGonderiliyor(true);
    try {
      await istek('/me/close', { method: 'POST', body: { challengeId, code: kod, neden } });
      // Oturumlar API'de kapandı; yenileme çerezi de silinir
      const token = await erisim().catch(() => null);
      await fetch('/api/oturum/cikis', {
        method: 'POST',
        headers: token ? { authorization: `Bearer ${token}` } : {},
      }).catch(() => undefined);
      window.location.href = '/?hesap=kapatildi';
    } catch (e) {
      bildir(null, (e as Error).message);
      setGonderiliyor(false);
    }
  }

  const iade = o?.iade;
  return (
    <section
      style={{ background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 18, padding: 22 }}
      aria-labelledby="hk"
    >
      <h2 id="hk" style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 800 }}>
        Hesabı kapat
      </h2>
      <ul style={{ margin: '0 0 16px', paddingLeft: 20, fontSize: 14.5, lineHeight: 1.6, color: '#3A4052' }}>
        <li>Yayındaki taleplerin kapanır, satıcılar artık sana yazamaz.</li>
        <li>Sohbetlerin karşı tarafta “Kapatılmış hesap” olarak görünür.</li>
        <li>
          {iade && iade.toplamKurus > 0 ? (
            <>
              Web’den aldığın ve kullanmadığın haklar ödediğin tutar üzerinden kartına iade edilir:{' '}
              <strong>{iade.satirlar.map((s) => `${s.ad} · ${tlYaz(s.tutarKurus)}`).join(', ')}</strong>.
              Başlamış öne çıkarmalar iade edilmez.
            </>
          ) : (
            'Web’den aldığın ve kullanmadığın haklar ödediğin tutar üzerinden kartına iade edilir; şu an kullanılmamış hakkın yok. Başlamış öne çıkarmalar iade edilmez.'
          )}
        </li>
        <li>App Store veya Google Play’den aldığın hakların iadesi mağaza üzerinden yapılır.</li>
        <li>Fatura ve ödeme kayıtları yasal saklama süresi boyunca tutulur; diğer verilerin silinir.</li>
      </ul>
      {o?.engel ? (
        <p role="alert" style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#A3271F' }}>
          {o.engel}
        </p>
      ) : null}
      {adim ? (
        <div style={{ background: '#FDECEC', borderRadius: 14, padding: 16, marginBottom: 14 }}>
          <label htmlFor="neden" style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
            Neden ayrılıyorsun? (isteğe bağlı)
          </label>
          <select
            id="neden"
            value={neden}
            onChange={(e) => setNeden(e.target.value as CloseReason)}
            style={girdi}
          >
            {CLOSE_REASON_KEYS.map((k) => (
              <option key={k} value={k}>
                {CLOSE_REASONS[k]}
              </option>
            ))}
          </select>
          {challengeId ? (
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginTop: 12 }}>
              SMS kodu
              <input
                value={kod}
                onChange={(e) => setKod(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                style={{ ...girdi, marginTop: 6 }}
              />
            </label>
          ) : (
            <p style={{ margin: '10px 0 0', fontSize: 13, color: '#A3271F' }}>
              Onaylamak için telefonuna bir SMS kodu göndereceğiz.
            </p>
          )}
        </div>
      ) : null}
      <button
        type="button"
        disabled={!o || !!o.engel || gonderiliyor || (!!challengeId && kod.length !== 6)}
        onClick={() => (!adim ? setAdim(true) : challengeId ? kapat() : kodGonder())}
        style={{ ...kapatDugme, opacity: !o || o.engel ? 0.55 : 1 }}
      >
        {!adim
          ? 'Hesabımı kapatmak istiyorum'
          : challengeId
            ? 'Hesabı kapat'
            : 'SMS kodu gönder ve hesabı kapat'}
      </button>
    </section>
  );
}
