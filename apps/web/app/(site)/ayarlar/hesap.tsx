'use client';

import { CLOSE_REASON_KEYS, CLOSE_REASONS, type CloseReason, tlYaz } from '@rengarenk/shared';
import { useEffect, useRef, useState } from 'react';
import { cx } from '../../../lib/cx';
import { erisim, istek } from '../../../lib/istemci';
import stil from './hesap.module.css';

interface Onizleme {
  engel: string | null;
  iade: { satirlar: { ad: string; tutarKurus: number }[]; toplamKurus: number };
  magaza: boolean;
}

/**
 * Ayarlar › Hesap › Hesabı kapat (Ayarlar.dc.html; Karar 31, 39, 59). WhatsApp koduyla onaylanır. Kullanılmamış hakların
 * iadesi Sahip'in onayına gider; ekranda tutar "iade edilir" diye gösterilir, onaydan sonra karta yansır.
 */
export function HesabiKapat({ bildir }: { bildir: (m: string | null, h?: string | null) => void }) {
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
      // Hassas işlem onayı (Karar 58): kod hesaptaki numaraya gider (önce WhatsApp)
      const r = await istek<{ challengeId: string; devCode?: string }>('/auth/code', {
        method: 'POST',
        body: {},
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
    <section className={stil.kutu1} aria-labelledby="hk">
      <h2 id="hk" className={stil.baslik1}>
        Hesabı kapat
      </h2>
      <ul className={stil.liste1}>
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
        <p role="alert" className={stil.metin1}>
          {o.engel}
        </p>
      ) : null}
      {adim ? (
        <div className={stil.kutu2}>
          <label htmlFor="neden" className={stil.etiket1}>
            Neden ayrılıyorsun? (isteğe bağlı)
          </label>
          <select
            id="neden"
            value={neden}
            onChange={(e) => setNeden(e.target.value as CloseReason)}
            className={stil.girdi1}
          >
            {CLOSE_REASON_KEYS.map((k) => (
              <option key={k} value={k}>
                {CLOSE_REASONS[k]}
              </option>
            ))}
          </select>
          {challengeId ? (
            <label className={stil.etiket2}>
              WhatsApp kodu
              <input
                value={kod}
                onChange={(e) => setKod(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                className={stil.girdi2}
              />
            </label>
          ) : (
            <p className={stil.metin2}>Onaylamak için telefonuna bir doğrulama kodu göndereceğiz.</p>
          )}
        </div>
      ) : null}
      <button
        type="button"
        disabled={!o || !!o.engel || gonderiliyor || (!!challengeId && kod.length !== 6)}
        onClick={() => (!adim ? setAdim(true) : challengeId ? kapat() : kodGonder())}
        className={cx(stil.dugme1, !o || o.engel ? stil.dugme2 : stil.dugme3)}
      >
        {!adim
          ? 'Hesabımı kapatmak istiyorum'
          : challengeId
            ? 'Hesabı kapat'
            : 'WhatsApp kodu gönder ve hesabı kapat'}
      </button>
    </section>
  );
}
