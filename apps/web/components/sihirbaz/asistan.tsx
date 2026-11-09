'use client';

import { ASSISTANT_TEXT_MAX } from '@rengarenk/shared';
import { useState } from 'react';
import { istek } from '../../lib/istemci';

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
    <section
      aria-labelledby="asistan-baslik"
      style={{
        border: '1.5px solid #C9B8FF',
        background: '#FAF7FF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 18,
      }}
    >
      <h2 id="asistan-baslik" style={{ margin: 0, fontSize: 15.5, fontWeight: 800, color: '#4B2FA6' }}>
        ✦ Aradığın aracı kendi cümlelerinle yaz
      </h2>
      <p style={{ margin: '4px 0 10px', fontSize: 13, color: '#5A6073', lineHeight: 1.45 }}>
        Asistan formu doldurur; adımları kontrol edip talebini sen yayınlarsın.
      </p>
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
        style={{
          width: '100%',
          boxSizing: 'border-box',
          border: '1px solid #D5DAE5',
          borderRadius: 14,
          padding: 12,
          fontSize: 14.5,
          lineHeight: 1.5,
          fontFamily: 'inherit',
          resize: 'vertical',
          background: '#FFFFFF',
        }}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          marginTop: 6,
        }}
      >
        <button
          type="button"
          onClick={doldur}
          disabled={busy || metin.trim().length < 5}
          style={{
            border: 0,
            background: 'transparent',
            padding: '6px 0',
            fontSize: 13.5,
            fontWeight: 800,
            color: '#2450C8',
            cursor: busy ? 'default' : 'pointer',
            opacity: metin.trim().length < 5 ? 0.55 : 1,
            fontFamily: 'inherit',
          }}
        >
          {busy ? 'Dolduruluyor…' : '✦ Formu doldur'}
        </button>
        <span style={{ fontSize: 12, color: '#5A6073' }}>
          {metin.length} / {ASSISTANT_TEXT_MAX}
        </span>
      </div>
      {hata ? (
        <p role="alert" style={{ margin: '8px 0 0', fontSize: 13, fontWeight: 600, color: '#A3271F' }}>
          {hata}
        </p>
      ) : null}
      {sonuc ? (
        <div role="status" style={{ marginTop: 10, fontSize: 13, lineHeight: 1.5, color: '#1E2333' }}>
          {sonuc.doldurulan.length ? (
            <>
              <strong>Asistan doldurdu:</strong>{' '}
              {sonuc.doldurulan.map((d) => `${d.alan}: ${d.deger}`).join(' · ')}
            </>
          ) : (
            'Metinden bir alan çıkaramadım; marka, model, yıl ya da bütçe yazmayı dene.'
          )}
          {sonuc.eksik.length ? (
            <span style={{ display: 'block', marginTop: 4, color: '#7A5300', fontWeight: 600 }}>
              Senin doldurman gerekenler: {sonuc.eksik.join(', ')}
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
