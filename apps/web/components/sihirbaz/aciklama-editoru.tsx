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
import { useRef } from 'react';
import { cx } from '../../lib/cx';
import { AciklamaGoster } from '../aciklama';
import stil from './aciklama-editoru.module.css';

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

  return (
    <div>
      <label htmlFor="alan-aciklama" className={stil.etiket1}>
        {f.label}
      </label>
      <div role="toolbar" aria-label="Açıklama biçimi" className={stil.kutu1}>
        <button
          type="button"
          title="Kalın"
          aria-label="Kalın"
          onClick={() => sar('k')}
          className={stil.dugme1}
        >
          K
        </button>
        <button
          type="button"
          title="İtalik"
          aria-label="İtalik"
          onClick={() => sar('i')}
          className={stil.dugme2}
        >
          İ
        </button>
        <span aria-hidden="true" className={stil.metin1} />
        {(Object.keys(ACIKLAMA_RENKLERI) as AciklamaRengi[]).map((r) => (
          <button
            key={r}
            type="button"
            title={`${ACIKLAMA_RENKLERI[r].ad} yazı`}
            aria-label={`${ACIKLAMA_RENKLERI[r].ad} yazı`}
            onClick={() => sar('renk', r)}
            className={stil.dugme3}
          >
            <span
              aria-hidden="true"
              className={stil.metin2}
              style={{ background: ACIKLAMA_RENKLERI[r].hex }}
            />
          </button>
        ))}
        <span aria-hidden="true" className={stil.metin1} />
        {(Object.keys(ACIKLAMA_BOYUTLARI) as AciklamaBoyutu[]).map((b) => (
          <button
            key={b}
            type="button"
            title={`${ACIKLAMA_BOYUTLARI[b].ad} yazı`}
            onClick={() => sar('boyut', b)}
            className={stil.dugme4}
            style={{ fontSize: 13 * ACIKLAMA_BOYUTLARI[b].oran }}
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
        className={stil.girdi1}
      />
      <div className={stil.kutu2}>
        <span>
          Yazıyı seçip düğmeye bas. Telefon numarası, IBAN veya bağlantı yazmayın; iletişim bilgileri
          aşağıdaki ayarlarla paylaşılır.
        </span>
        <span className={cx(stil.metin3, uzunluk > ACIKLAMA_SINIR ? stil.metin4 : stil.metin5)}>
          {uzunluk} / {ACIKLAMA_SINIR}
        </span>
      </div>
      {hata ? (
        <span role="alert" className={stil.metin6}>
          {hata}
        </span>
      ) : null}
      {metin.trim() ? (
        <div className={stil.kutu3}>
          <span className={stil.metin7}>Talep sayfasında böyle görünecek</span>
          <AciklamaGoster metin={metin} sabit />
        </div>
      ) : null}
    </div>
  );
}
