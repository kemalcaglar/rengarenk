'use client';

import {
  ACIKLAMA_BOYUTLARI,
  ACIKLAMA_HAM_SINIR,
  ACIKLAMA_RENKLERI,
  ACIKLAMA_SINIR,
  type AciklamaBoyutu,
  type AciklamaEtiketi,
  type AciklamaRengi,
  aciklamaDuz,
  aciklamaSar,
  type CategoryField,
} from '@rengarenk/shared';
import { type CSSProperties, useRef } from 'react';
import { colors } from '../../lib/renk';
import { AciklamaGoster } from '../aciklama';
import { etiket, kutu } from './alan';

/**
 * 5. adım: biçimli açıklama (sahip isteği, 17 Kasım 2026). Araç çubuğu seçili yazıyı etiketle sarar (kalın, italik,
 * renk, boyut); altta talep sayfasındaki görünümü gösterilir. Sınır düz metne uygulanır.
 */
export function AciklamaEditoru({
  f,
  value,
  onChange,
  hata,
}: {
  f: CategoryField;
  value: string | undefined;
  onChange: (v: unknown) => void;
  hata?: string;
}) {
  const alan = useRef<HTMLTextAreaElement>(null);
  const metin = value ?? '';
  const uzunluk = aciklamaDuz(metin).length;

  const sar = (e: AciklamaEtiketi, d?: string) => {
    const t = alan.current;
    if (!t) return;
    const r = aciklamaSar(metin, t.selectionStart, t.selectionEnd, { e, d });
    if (r.metin.length > ACIKLAMA_HAM_SINIR) return;
    onChange(r.metin);
    requestAnimationFrame(() => {
      t.focus();
      t.setSelectionRange(r.bas, r.son);
    });
  };

  const dugme: CSSProperties = {
    border: `1px solid ${colors.line}`,
    background: colors.surface,
    borderRadius: 'calc(var(--rr-buton-kose) * 8 / 14)',
    minWidth: 34,
    height: 34,
    padding: '0 9px',
    fontSize: 14,
    cursor: 'pointer',
    fontFamily: 'inherit',
    color: colors.ink,
  };

  return (
    <div>
      <label htmlFor="alan-aciklama" style={{ ...etiket, marginBottom: 6 }}>
        {f.label}
      </label>
      <div
        role="toolbar"
        aria-label="Açıklama biçimi"
        style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 8 }}
      >
        <button
          type="button"
          title="Kalın"
          aria-label="Kalın"
          onClick={() => sar('k')}
          style={{ ...dugme, fontWeight: 800 }}
        >
          K
        </button>
        <button
          type="button"
          title="İtalik"
          aria-label="İtalik"
          onClick={() => sar('i')}
          style={{ ...dugme, fontStyle: 'italic', fontWeight: 700 }}
        >
          İ
        </button>
        <span aria-hidden="true" style={{ width: 1, height: 24, background: colors.line, margin: '0 4px' }} />
        {(Object.keys(ACIKLAMA_RENKLERI) as AciklamaRengi[]).map((r) => (
          <button
            key={r}
            type="button"
            title={`${ACIKLAMA_RENKLERI[r].ad} yazı`}
            aria-label={`${ACIKLAMA_RENKLERI[r].ad} yazı`}
            onClick={() => sar('renk', r)}
            style={{ ...dugme, minWidth: 30, width: 30, padding: 0, display: 'grid', placeItems: 'center' }}
          >
            <span
              aria-hidden="true"
              style={{ width: 16, height: 16, borderRadius: '50%', background: ACIKLAMA_RENKLERI[r].hex }}
            />
          </button>
        ))}
        <span aria-hidden="true" style={{ width: 1, height: 24, background: colors.line, margin: '0 4px' }} />
        {(Object.keys(ACIKLAMA_BOYUTLARI) as AciklamaBoyutu[]).map((b) => (
          <button
            key={b}
            type="button"
            title={`${ACIKLAMA_BOYUTLARI[b].ad} yazı`}
            onClick={() => sar('boyut', b)}
            style={{ ...dugme, fontSize: 13 * ACIKLAMA_BOYUTLARI[b].oran, fontWeight: 700 }}
          >
            {ACIKLAMA_BOYUTLARI[b].ad}
          </button>
        ))}
      </div>
      <textarea
        ref={alan}
        id="alan-aciklama"
        rows={6}
        maxLength={ACIKLAMA_HAM_SINIR}
        value={metin}
        onChange={(e) => onChange(e.target.value || undefined)}
        style={{ ...kutu, lineHeight: 1.55, resize: 'vertical', fontFamily: 'inherit' }}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          fontSize: 12.5,
          color: colors.muted,
          marginTop: 4,
        }}
      >
        <span>
          Yazıyı seçip düğmeye bas. Telefon numarası, IBAN veya bağlantı yazmayın; iletişim bilgileri
          aşağıdaki ayarlarla paylaşılır.
        </span>
        <span style={{ flex: 'none', color: uzunluk > ACIKLAMA_SINIR ? '#A3271F' : colors.muted }}>
          {uzunluk} / {ACIKLAMA_SINIR}
        </span>
      </div>
      {hata ? (
        <span
          role="alert"
          style={{ display: 'block', fontSize: 12.5, color: '#A3271F', fontWeight: 700, marginTop: 6 }}
        >
          {hata}
        </span>
      ) : null}
      {metin.trim() ? (
        <div
          style={{
            marginTop: 12,
            border: `1px dashed ${colors.line}`,
            borderRadius: 'calc(var(--rr-kart-kose) * 14 / 18)',
            padding: '12px 14px',
          }}
        >
          <span
            style={{ display: 'block', fontSize: 12, fontWeight: 700, color: colors.muted, marginBottom: 6 }}
          >
            Talep sayfasında böyle görünecek
          </span>
          <AciklamaGoster metin={metin} sabit />
        </div>
      ) : null}
    </div>
  );
}
