'use client';

import { TEKNIK_ALANLARI, TEKNIK_KAYNAK, type TeknikOzet, teknikBolumleri } from '@rengarenk/shared';
import Link from 'next/link';
import { useState } from 'react';
import { istek, useGiris } from '../lib/istemci';
import { colors } from '../lib/renk';

/**
 * Talep sayfasında aracın ayrıntılı teknik özellikleri (sahip isteği, 17 Kasım 2026): motor sürümü başına bölüm bölüm
 * (motor, performans, şanzıman ve çekiş, tüketim ve emisyon, ölçüler ve ağırlık, lastik ve fren). Değerler Türkiye'de
 * satılan sürümlerle eşleşen kayıtlardan; sürümler arasında farklıysa aralık.
 */
export function TeknikTablo({
  motorlar,
  not,
  talepNo,
}: {
  motorlar: { ad: string; model?: string; ozet: TeknikOzet }[];
  /** Verilirse "Yanlış mı? Bildir" düğmesi görünür (sahip isteği, 17 Kasım 2026) */
  talepNo?: number;
  /** Başlık altı açıklama (ör. "G20 makyajsız kasa, 2019–2022") */
  not?: string | null;
}) {
  const [secili, setSecili] = useState(0);
  if (!motorlar.length) {
    return (
      <p style={{ margin: 0, fontSize: 14.5, color: colors.muted }}>
        Bu araç için katalogda teknik bilgi bulunamadı. Motor ya da kasa seçilince ayrıntı genişler.
      </p>
    );
  }
  const m = motorlar[Math.min(secili, motorlar.length - 1)] as (typeof motorlar)[number];
  const bolumler = teknikBolumleri(m.ozet);
  return (
    <div>
      {motorlar.length > 1 ? (
        <div
          role="tablist"
          aria-label="Motor seçenekleri"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}
        >
          {motorlar.map((x, i) => (
            <button
              key={x.ad}
              type="button"
              role="tab"
              aria-selected={i === secili}
              onClick={() => setSecili(i)}
              style={{
                border: i === secili ? `1.5px solid ${colors.blue}` : '1px solid #D5DAE5',
                background: i === secili ? '#EEF3FF' : colors.surface,
                borderRadius: 'var(--rr-etiket-kose)',
                padding: i === secili ? '7px 13px' : '7.5px 13.5px',
                fontSize: 13.5,
                fontWeight: i === secili ? 800 : 600,
                color: colors.ink,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {x.ad}
            </button>
          ))}
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{m.ad}</p>
      )}
      {not ? <p style={{ margin: '8px 0 0', fontSize: 13, color: colors.muted }}>{not}</p> : null}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '18px 28px',
          marginTop: 16,
        }}
      >
        {bolumler.map((b) => (
          <section key={b.baslik} aria-label={b.baslik}>
            <h3
              style={{
                margin: '0 0 6px',
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: 0.3,
                textTransform: 'uppercase',
                color: colors.muted,
              }}
            >
              {b.baslik}
            </h3>
            <dl style={{ margin: 0 }}>
              {b.satirlar.map(([etiket, deger]) => (
                <div
                  key={etiket}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '8px 0',
                    borderBottom: `1px solid ${colors.line}`,
                    fontSize: 14,
                  }}
                >
                  <dt style={{ color: colors.muted }}>{etiket}</dt>
                  <dd style={{ margin: 0, fontWeight: 700, textAlign: 'right' }}>{deger}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 10,
          marginTop: 14,
        }}
      >
        <p style={{ margin: 0, fontSize: 12, color: colors.muted, flex: '1 1 320px' }}>
          {TEKNIK_KAYNAK}.
          {m.ozet.kaynaklar?.includes('manuel') ? ' Bazı değerler ekibimizce düzeltildi.' : ''} Değerler
          pakete ve model yılına göre değişebilir.
        </p>
        {talepNo && m.model ? (
          <YanlisBildir key={m.model} talepNo={talepNo} motor={m.model} ad={m.ad} />
        ) : null}
      </div>
    </div>
  );
}

/**
 * Teknik özellik "yanlış" bildirimi (sahip isteği, 17 Kasım 2026): küçük bir düğme; açılınca alan (isteğe bağlı) ve
 * kısa açıklama. Bildirim konsolda Katalog › Teknik özellikler kuyruğuna düşer. Giriş gerekir.
 */
function YanlisBildir({ talepNo, motor, ad }: { talepNo: number; motor: string; ad: string }) {
  const giris = useGiris();
  const [acik, setAcik] = useState(false);
  const [alan, setAlan] = useState('');
  const [not, setNot] = useState('');
  const [durum, setDurum] = useState<'bos' | 'gonderiliyor' | 'tamam'>('bos');
  const [hata, setHata] = useState<string | null>(null);
  const kucuk = {
    background: 'transparent',
    border: 0,
    padding: 0,
    fontSize: 12.5,
    fontWeight: 700,
    color: colors.link,
    cursor: 'pointer',
    fontFamily: 'inherit',
  } as const;

  if (durum === 'tamam')
    return (
      <p role="status" style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: '#11683F' }}>
        Teşekkürler, bildirimin ekibimize ulaştı.
      </p>
    );
  if (!acik)
    return (
      <button type="button" style={kucuk} onClick={() => setAcik(true)}>
        Bir değer yanlış mı? Bildir
      </button>
    );
  if (giris === false)
    return (
      <p style={{ margin: 0, fontSize: 12.5 }}>
        Bildirmek için{' '}
        <Link href={`/giris?sonra=/talep/${talepNo}`} style={{ fontWeight: 700 }}>
          giriş yap
        </Link>
        .
      </p>
    );

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);
    setDurum('gonderiliyor');
    try {
      await istek('/demands/teknik-bildir', {
        method: 'POST',
        body: { no: talepNo, motor, alan: alan || null, not },
      });
      setDurum('tamam');
    } catch (err) {
      setHata((err as Error).message);
      setDurum('bos');
    }
  }

  return (
    <form
      onSubmit={gonder}
      aria-label={`${ad} teknik özellik bildirimi`}
      style={{
        flex: '1 1 100%',
        display: 'grid',
        gap: 8,
        padding: 12,
        border: `1px solid ${colors.line}`,
        borderRadius: 'calc(var(--rr-buton-kose) * 10 / 14)',
        background: colors.background,
      }}
    >
      <strong style={{ fontSize: 13.5 }}>{ad}: hangi değer yanlış?</strong>
      <select
        aria-label="Yanlış olan değer"
        value={alan}
        onChange={(e) => setAlan(e.target.value)}
        style={{
          fontSize: 13.5,
          padding: 8,
          borderRadius: 8,
          border: `1px solid ${colors.line}`,
          fontFamily: 'inherit',
        }}
      >
        <option value="">Genel / birden çok değer</option>
        {TEKNIK_ALANLARI.map((a) => (
          <option key={a.key} value={a.key}>
            {a.ad}
          </option>
        ))}
      </select>
      <textarea
        aria-label="Açıklama"
        required
        minLength={5}
        maxLength={1000}
        rows={3}
        placeholder="Ör. Güç 184 hp olmalı, ruhsatta öyle yazıyor"
        value={not}
        onChange={(e) => setNot(e.target.value)}
        style={{
          fontSize: 13.5,
          padding: 8,
          borderRadius: 8,
          border: `1px solid ${colors.line}`,
          fontFamily: 'inherit',
          resize: 'vertical',
        }}
      />
      {hata ? (
        <p role="alert" style={{ margin: 0, fontSize: 12.5, color: '#A3271F', fontWeight: 600 }}>
          {hata}
        </p>
      ) : null}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          type="submit"
          disabled={durum === 'gonderiliyor'}
          style={{
            background: colors.blue,
            color: 'var(--rr-maviYazi, #1E2333)',
            border: 0,
            fontWeight: 700,
            fontSize: 13.5,
            padding: '8px 14px',
            borderRadius: 'var(--rr-buton-kose)',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {durum === 'gonderiliyor' ? 'Gönderiliyor…' : 'Gönder'}
        </button>
        <button type="button" style={kucuk} onClick={() => setAcik(false)}>
          Vazgeç
        </button>
      </div>
    </form>
  );
}
