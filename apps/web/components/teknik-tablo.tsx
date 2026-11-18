'use client';

import {
  type DonanimGrubu,
  TEKNIK_ALANLARI,
  TEKNIK_KAYNAK,
  type TeknikOzet,
  teknikBolumleri,
  teknikOneCikanlar,
} from '@rengarenk/shared';
import Link from 'next/link';
import { useState } from 'react';
import { istek, useGiris } from '../lib/istemci';
import { colors } from '../lib/renk';

/** Gökkuşağı açık zeminleri ve noktalar (tasarım: TINTS, DOTS; talep sayfasındaki "Aranan araç" kutularıyla aynı) */
const TINTS = ['#EEF3FF', '#FFEEF6', '#FFF6DF', '#E7FAF0'];
const NOKTA = [colors.blue, colors.pink, colors.yellow, colors.green];

/**
 * Talep sayfasında aracın ayrıntılı teknik özellikleri (sahip isteği, 17 ve 18 Kasım 2026): motor sürümü başına öne
 * çıkan değerler (renkli kutular), bölüm kartları (genel, motor, performans, şanzıman ve çekiş, tüketim ve emisyon,
 * ölçüler ve ağırlık, lastik ve fren; konsolda gizlenen satırlar çıkar, eklenenler girer) ve paket donanımı. Değerler
 * Türkiye'de satılan sürümlerle eşleşen kayıtlardan; sürümler arasında farklıysa aralık.
 */
export function TeknikTablo({
  motorlar,
  not,
  talepNo,
}: {
  motorlar: {
    ad: string;
    model?: string;
    ozet: TeknikOzet;
    /** Konsoldan girilen donanım (sahip isteği, 18 Kasım 2026); pakete özelse paketin adıyla */
    donanim?: { paket: string | null; gruplar: DonanimGrubu[] }[];
  }[];
  /** Verilirse "Yanlış mı? Bildir" düğmesi görünür (sahip isteği, 17 Kasım 2026) */
  talepNo?: number;
  /** Başlık altı açıklama (ör. "G20 makyajsız kasa, 2019–2022") */
  not?: string | null;
}) {
  const [secili, setSecili] = useState(0);
  if (!motorlar.length) {
    return (
      <div
        style={{
          padding: '18px 16px',
          borderRadius: 'calc(var(--rr-buton-kose) * 12 / 14)',
          background: colors.background,
          fontSize: 14.5,
          color: colors.muted,
        }}
      >
        Bu araç için katalogda teknik bilgi bulunamadı. Motor ya da kasa seçilince ayrıntı genişler.
      </div>
    );
  }
  const m = motorlar[Math.min(secili, motorlar.length - 1)] as (typeof motorlar)[number];
  const bolumler = teknikBolumleri(m.ozet);
  const one = teknikOneCikanlar(m.ozet);
  return (
    <div>
      {motorlar.length > 1 ? (
        <div
          role="tablist"
          aria-label="Motor seçenekleri"
          className="rr-yatay-kay"
          style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}
        >
          {motorlar.map((x, i) => (
            <button
              key={x.ad}
              type="button"
              role="tab"
              aria-selected={i === secili}
              onClick={() => setSecili(i)}
              style={{
                flex: 'none',
                whiteSpace: 'nowrap',
                border: i === secili ? `1.5px solid ${colors.blue}` : `1px solid ${colors.line}`,
                background: i === secili ? '#EEF3FF' : colors.surface,
                borderRadius: 'var(--rr-etiket-kose)',
                padding: i === secili ? '8px 14px' : '8.5px 14.5px',
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
        <p style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{m.ad}</p>
      )}
      {not ? <p style={{ margin: '8px 0 0', fontSize: 13, color: colors.muted }}>{not}</p> : null}

      {one.length ? (
        <ul
          aria-label="Öne çıkan değerler"
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '16px 0 0',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: 10,
          }}
        >
          {one.map((x, i) => (
            <li
              key={x.etiket}
              style={{
                background: TINTS[i % TINTS.length],
                borderRadius: 'var(--rr-buton-kose)',
                padding: '12px 14px',
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#4A5064' }}>{x.etiket}</div>
              <div
                style={{
                  marginTop: 2,
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'baseline',
                  columnGap: 4,
                }}
              >
                <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: -0.3, whiteSpace: 'nowrap' }}>
                  {x.deger}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#4A5064', whiteSpace: 'nowrap' }}>
                  {x.birim}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Bölümler sütunlara akar (genişse iki sütun, kısa ve uzun bölümler boşluk bırakmadan) */}
      <div style={{ columns: '270px 2', columnGap: 12, marginTop: 14 }}>
        {bolumler.map((b, i) => (
          <section
            key={b.baslik}
            aria-label={b.baslik}
            style={{
              breakInside: 'avoid',
              marginBottom: 12,
              border: `1px solid ${colors.line}`,
              borderRadius: 'calc(var(--rr-kart-kose) * 14 / 18)',
              background: colors.surface,
              overflow: 'hidden',
            }}
          >
            <h3
              style={{
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '11px 14px',
                fontSize: 14.5,
                fontWeight: 800,
                background: colors.background,
                borderBottom: `1px solid ${colors.line}`,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background: NOKTA[i % NOKTA.length],
                  flex: 'none',
                }}
              />
              {b.baslik}
            </h3>
            <dl style={{ margin: 0, padding: '2px 14px' }}>
              {b.satirlar.map(([etiket, deger], j) => (
                <div
                  key={etiket}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: 14,
                    padding: '9px 0',
                    borderTop: j ? '1px solid #EEF0F5' : 0,
                    fontSize: 14,
                  }}
                >
                  <dt style={{ color: colors.muted, flex: '0 1 auto' }}>{etiket}</dt>
                  <dd style={{ margin: 0, fontWeight: 700, textAlign: 'right', minWidth: 0 }}>{deger}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      {m.donanim?.length ? <Donanim key={m.ad} liste={m.donanim} /> : null}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginTop: 4,
          padding: '10px 14px',
          borderRadius: 'calc(var(--rr-buton-kose) * 12 / 14)',
          background: colors.background,
        }}
      >
        <p style={{ margin: 0, fontSize: 12, color: colors.muted, flex: '1 1 320px', lineHeight: 1.5 }}>
          {TEKNIK_KAYNAK}.
          {m.ozet.kaynaklar?.includes('manuel') || m.donanim?.length
            ? ' Bazı değerler ve donanım ekibimizce girildi.'
            : ''}{' '}
          Değerler pakete ve model yılına göre değişebilir.
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

/** Bir grupta ilk bakışta gösterilen öğe sayısı (fazlası "+N daha" ile açılır) */
const GRUP_ILK = 8;

/**
 * Donanım (sahip isteği, 18 Kasım 2026): birden çok paket listesi varsa paket sekmeleri; gruplar renkli başlıklı
 * kartlarda, öğeler yeşil işaretle. Uzun gruplar kısaltılır.
 */
function Donanim({ liste }: { liste: { paket: string | null; gruplar: DonanimGrubu[] }[] }) {
  const [secili, setSecili] = useState(0);
  const [acik, setAcik] = useState<Record<string, boolean>>({});
  const d = liste[Math.min(secili, liste.length - 1)] as (typeof liste)[number];
  const toplam = d.gruplar.reduce((n, g) => n + g.ogeler.length, 0);
  return (
    <section aria-label="Donanım" style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Donanım</h3>
        <span style={{ fontSize: 13, color: colors.muted }}>
          {d.paket ? `${d.paket} paketi · ` : ''}
          {toplam} özellik
        </span>
      </div>
      {liste.length > 1 ? (
        <div
          role="tablist"
          aria-label="Paketler"
          className="rr-yatay-kay"
          style={{ display: 'flex', gap: 8, overflowX: 'auto', marginTop: 10 }}
        >
          {liste.map((x, i) => (
            <button
              key={x.paket ?? ''}
              type="button"
              role="tab"
              aria-selected={i === secili}
              onClick={() => setSecili(i)}
              style={{
                flex: 'none',
                whiteSpace: 'nowrap',
                border: 0,
                background: i === secili ? colors.ink : colors.background,
                color: i === secili ? colors.surface : colors.ink,
                borderRadius: 'var(--rr-etiket-kose)',
                padding: '7px 13px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {x.paket ?? 'Bütün paketler'}
            </button>
          ))}
        </div>
      ) : null}
      <div style={{ columns: '240px 3', columnGap: 12, marginTop: 12 }}>
        {d.gruplar.map((g, i) => {
          const anahtar = `${d.paket ?? ''}|${g.ad}`;
          const hepsi = acik[anahtar] || g.ogeler.length <= GRUP_ILK + 1;
          const ogeler = hepsi ? g.ogeler : g.ogeler.slice(0, GRUP_ILK);
          return (
            <div
              key={g.ad}
              style={{
                breakInside: 'avoid',
                marginBottom: 12,
                border: `1px solid ${colors.line}`,
                borderRadius: 'calc(var(--rr-kart-kose) * 14 / 18)',
                overflow: 'hidden',
                background: colors.surface,
              }}
            >
              <p
                style={{
                  margin: 0,
                  padding: '10px 14px',
                  background: TINTS[i % TINTS.length],
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 8,
                  fontSize: 14,
                  fontWeight: 800,
                }}
              >
                {g.ad}
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#4A5064' }}>{g.ogeler.length}</span>
              </p>
              <ul style={{ margin: 0, padding: '6px 14px 10px', listStyle: 'none' }}>
                {ogeler.map((o) => (
                  <li
                    key={o}
                    style={{ display: 'flex', gap: 9, padding: '5px 0', fontSize: 13.5, lineHeight: 1.4 }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        flex: 'none',
                        width: 18,
                        height: 18,
                        marginTop: 1,
                        borderRadius: '50%',
                        background: '#E7FAF0',
                        color: '#11683F',
                        fontSize: 11,
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      ✓
                    </span>
                    {o}
                  </li>
                ))}
              </ul>
              {g.ogeler.length > ogeler.length ? (
                <button
                  type="button"
                  onClick={() => setAcik((a) => ({ ...a, [anahtar]: true }))}
                  style={{
                    margin: '0 14px 12px',
                    padding: 0,
                    border: 0,
                    background: 'transparent',
                    fontSize: 13,
                    fontWeight: 700,
                    color: colors.link,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  +{g.ogeler.length - ogeler.length} özellik daha
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
