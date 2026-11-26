'use client';

import { ASSISTANT_TEXT_MAX } from '@rengarenk/shared';
import { useState } from 'react';
import { cx } from '../../lib/cx';
import { istek } from '../../lib/istemci';
import stil from './asistan.module.css';

interface Sonuc {
  doldurulan: { alan: string; deger: string }[];
  eksik: string[];
}

/**
 * Talep asistanı (Karar 42; özellik anahtarı `talep_asistani`): alıcı aradığı aracı kendi cümleleriyle yazar, asistan
 * formu doldurur; alıcı adımları kontrol edip kendisi yayınlar. Görünüm tasarımdaki "✦ Taslağı yeniden yaz" bağlantısı
 * ve form öğeleriyle aynı dildedir (GaleriMobil.dc.html › ilk mesaj, Sihirbaz.dc.html).
 */
export function Asistan({ taslakId, doldu }: { taslakId: string; doldu: () => Promise<void> }) {
  const [metin, setMetin] = useState('');
  const [busy, setBusy] = useState(false);
  const [sonuc, setSonuc] = useState<Sonuc | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  async function doldur() {
    if (metin.trim().length < 5) return;
    setBusy(true);
    setHata(null);
    try {
      const r = await istek<Sonuc>(`/demands/${taslakId}/asistan`, {
        method: 'POST',
        body: { metin: metin.trim() },
      });
      setSonuc(r);
      await doldu();
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="asistan-baslik" className={stil.kutu1}>
      <h2 id="asistan-baslik" className={stil.baslik1}>
        ✦ Aradığın aracı kendi cümlelerinle yaz
      </h2>
      <p className={stil.metin1}>Asistan formu doldurur; adımları kontrol edip talebini sen yayınlarsın.</p>
      <label htmlFor="asistan-metin" className="sr-only">
        Aradığın araç
      </label>
      <textarea
        id="asistan-metin"
        value={metin}
        onChange={(e) => setMetin(e.target.value)}
        rows={3}
        maxLength={ASSISTANT_TEXT_MAX}
        placeholder="Ör. 2019 sonrası otomatik, dizel, aile arabası, 1,5 milyon bütçe, İstanbul"
        className={stil.girdi1}
      />
      <div className={stil.kutu2}>
        <button
          type="button"
          onClick={doldur}
          disabled={busy || metin.trim().length < 5}
          className={cx(stil.dugme1, busy ? stil.dugme2 : stil.dugme3)}
          style={{ opacity: metin.trim().length < 5 ? 0.55 : 1 }}
        >
          {busy ? 'Dolduruluyor…' : '✦ Formu doldur'}
        </button>
        <span className={stil.metin2}>
          {metin.length} / {ASSISTANT_TEXT_MAX}
        </span>
      </div>
      {hata ? (
        <p role="alert" className={stil.metin3}>
          {hata}
        </p>
      ) : null}
      {sonuc ? (
        <div role="status" className={stil.kutu3}>
          {sonuc.doldurulan.length ? (
            <>
              <strong>Asistan doldurdu:</strong>{' '}
              {sonuc.doldurulan.map((d) => `${d.alan}: ${d.deger}`).join(' · ')}
            </>
          ) : (
            'Metinden bir alan çıkaramadım; marka, model, yıl ya da bütçe yazmayı dene.'
          )}
          {sonuc.eksik.length ? (
            <span className={stil.metin4}>Senin doldurman gerekenler: {sonuc.eksik.join(', ')}</span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
