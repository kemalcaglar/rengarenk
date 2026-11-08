'use client';

import { type CategoryField, type CategoryRules, PAINT_PARTS, PAINT_STATES } from '@rengarenk/shared';
import Link from 'next/link';
import { type CSSProperties, useEffect, useState } from 'react';
import { AracSemasiGorunum } from '../../../../components/arac-semasi';
import { IlkMesaj } from '../../../../components/ilk-mesaj';
import { Sikayet } from '../../../../components/sikayet';
import { API, istek, useGiris } from '../../../../lib/istemci';
import { butceAraligi, deger, etiket, uzunTarih } from '../../../../lib/talep-bicim';

type Values = Record<string, unknown>;
interface Foto {
  url: string;
  caption: string;
}
export interface TalepVeri {
  no: number;
  status: string;
  baslik: string;
  category: { slug: string; name: string };
  il: string | null;
  ilce: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
  data: { alanlar: Values; alternatifler: Values[] };
  schema: { version: number; fields: CategoryField[]; rules: CategoryRules };
  gorunum: {
    katalog: { marka: string | null; seri: string | null; model: string | null };
    alternatifler: {
      kasa: { value: string; label: string; yillar: string | null; foto: Foto | null }[];
      paket: string[];
      teknik: { label: string; value: string }[];
      teknikOrnek: string | null;
    }[];
  };
  owner: {
    name: string;
    memberSince: string;
    isYou: boolean;
    favori: boolean;
    phone: string | null;
    phoneHidden: boolean;
    whatsapp: boolean;
  };
}

const TINTS = ['#EEF3FF', '#FFEEF6', '#FFF6DF', '#E7FAF0'];
const kart: CSSProperties = { background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 18 };
const BOYA_AD: Record<string, string> = {
  orijinal: 'Orijinal olmalı',
  lokal: 'Lokal boya kabul',
  boya: 'Boya kabul',
  degisen: 'Değişen kabul',
};

/** "0 (532) 777 10 01" */
const telefon = (e164: string) => {
  const d = e164.replace(/\D/g, '').replace(/^90/, '');
  return `0 (${d.slice(0, 3)}) ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8, 10)}`;
};
/** Sayının okunuşuna göre ayrılma eki: 2025'ten, 2026'dan, 2027'den, 2030'dan */
function denEki(n: number) {
  const birler: Record<number, string> = {
    1: 'den',
    2: 'den',
    3: 'ten',
    4: 'ten',
    5: 'ten',
    6: 'dan',
    7: 'den',
    8: 'den',
    9: 'dan',
  };
  const onlar: Record<number, string> = {
    1: 'dan',
    2: 'den',
    3: 'dan',
    4: 'tan',
    5: 'den',
    6: 'tan',
    7: 'ten',
    8: 'den',
    9: 'dan',
  };
  if (n % 10) return birler[n % 10] as string;
  if (n % 100) return onlar[(n / 10) % 10] as string;
  return 'den'; // yüz, bin
}
/** "Kasım 2025'ten beri üye" */
const uyelik = (iso: string) => {
  const d = new Date(iso);
  const ay = new Intl.DateTimeFormat('tr-TR', { month: 'long', timeZone: 'Europe/Istanbul' }).format(d);
  const yil = Number(
    new Intl.DateTimeFormat('tr-TR', { year: 'numeric', timeZone: 'Europe/Istanbul' }).format(d),
  );
  return `${ay} ${yil}'${denEki(yil)} beri üye`;
};

export function TalepDetay({
  t,
  ustKategori,
  benzer,
}: {
  t: TalepVeri;
  api?: string;
  ustKategori: { slug: string; name: string } | null;
  benzer: { no: number; baslik: string; il: string | null; yilMin: number | null; yilMax: number | null }[];
}) {
  const giris = useGiris();
  const [alt, setAlt] = useState(0);
  const [sahip, setSahip] = useState(t.owner);
  const [goster, setGoster] = useState(false);
  const [paylasildi, setPaylasildi] = useState(false);
  const [favBusy, setFavBusy] = useState(false);
  // İlk mesaj (Karar 08, 11): yazıldıysa sohbete gider; kalan günlük hak iletişim kutusunda yazar
  const [mesaj, setMesaj] = useState<{
    kendi: boolean;
    yazildi: string | null;
    gunluk: { toplam: number; kalan: number } | null;
    hesaplar: { galeri: boolean }[];
  } | null>(null);
  const [pencere, setPencere] = useState(false);
  const [sikayet, setSikayet] = useState(false);

  // Favori (Karar 06.4): misafir önce giriş yapar; kendi talebi favoriye eklenmez
  async function favori() {
    if (!giris) {
      window.location.href = `/giris?sonra=/talep/${t.no}`;
      return;
    }
    const yeni = !sahip.favori;
    setFavBusy(true);
    setSahip((o) => ({ ...o, favori: yeni }));
    try {
      await istek(`/favorites/${t.no}`, { method: yeni ? 'PUT' : 'DELETE' });
    } catch {
      setSahip((o) => ({ ...o, favori: !yeni }));
    } finally {
      setFavBusy(false);
    }
  }

  // Giriş yapmış kullanıcı için izin verilen telefon numarası (Karar 11.4)
  useEffect(() => {
    if (giris)
      istek<TalepVeri>(`/talepler/${t.no}`)
        .then((x) => setSahip(x.owner))
        .catch(() => undefined);
  }, [giris, t.no]);
  useEffect(() => {
    if (giris)
      istek<NonNullable<typeof mesaj>>(`/talepler/${t.no}/mesaj`)
        .then(setMesaj)
        .catch(() => undefined);
  }, [giris, t.no]);

  const f = t.schema.fields;
  const a = t.data.alternatifler[alt] ?? {};
  const g = t.gorunum.alternatifler[alt];
  const altAd = `Alternatif ${alt + 1}`;
  const foto = g?.kasa.find((k) => k.foto)?.foto ?? null;
  const renkAlani = f.find((x) => x.key === 'renk');
  const renkler = ((a.renk as string[] | undefined) ?? [])
    .map((v) => renkAlani?.options?.find((o) => o.value === v))
    .filter(Boolean);
  const gunKaldi = Math.max(
    0,
    Math.ceil(((t.expiresAt ? new Date(t.expiresAt).getTime() : 0) - Date.now()) / 86_400_000),
  );
  const yayinda = t.status === 'PUBLISHED';
  const k = t.gorunum.katalog;
  const anaArac = [
    { label: 'Kategori', value: t.category.name },
    k.marka ? { label: 'Marka', value: k.marka } : null,
    k.seri ? { label: 'Seri', value: k.seri } : null,
    k.model ? { label: 'Model', value: k.model } : null,
    ...f
      .filter((x) => x.step === 'ana_arac' && x.type !== 'catalog')
      .map((x) => {
        const v = deger(x, t.data.alanlar[x.key]);
        return v ? { label: etiket(x), value: v } : null;
      }),
  ].filter((x): x is { label: string; value: string } => x !== null);
  // Kriter satırları: alternatif alanları (bütçe ayrı), kasa ve paket katalogdan okunur
  const satirlar = [
    g?.kasa.length ? { label: 'Kasa ve makyaj', value: g.kasa.map((x) => x.label).join(' veya ') } : null,
    f.some((x) => x.key === 'paket')
      ? { label: 'Donanım paketi', value: g?.paket.length ? g.paket.join(' veya ') : 'Fark etmez' }
      : null,
    ...f
      .filter(
        (x) =>
          x.scope === 'alternatif' && x.key !== 'butce' && x.source !== 'katalog' && x.step === 'kriterler',
      )
      .map((x) => {
        const v = deger(x, a[x.key]);
        return v ? { label: etiket(x), value: v } : null;
      }),
  ].filter((x): x is { label: string; value: string } => x !== null);
  const butce = a.butce as { min?: number; max?: number } | undefined;
  const boya = t.data.alanlar.boya as { limit: number; parts: Record<string, string> } | undefined;
  const islem = f.find((x) => x.key === 'islemKabul');
  const kabul = (t.data.alanlar.islemKabul as string[] | undefined) ?? [];
  const tramer = t.data.alanlar.tramer as number | undefined;
  const genel = [
    [t.il, t.ilce].filter(Boolean).join(', '),
    f.some((x) => x.key === 'takas') ? `Takas: ${t.data.alanlar.takas ? 'düşünüyor' : 'düşünmüyor'}` : null,
    (() => {
      const kim = t.data.alanlar.kimden as string[] | undefined;
      if (!f.some((x) => x.key === 'kimden')) return null;
      if (!kim?.length || kim.length > 1) return 'Kimden: sahibinden veya galeriden';
      return kim[0] === 'galeri' ? 'Kimden: galeriden' : 'Kimden: sahibinden';
    })(),
  ].filter((x): x is string => Boolean(x));
  const bas = sahip.name
    .split(/\s+/)
    .filter((p) => /^\p{L}/u.test(p))
    .slice(0, 2)
    .map((p) => p.charAt(0).toLocaleUpperCase('tr-TR'))
    .join('');

  const secmeli = (on: boolean): CSSProperties => ({
    border: 0,
    borderRadius: '12px 12px 0 0',
    padding: '12px 20px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    marginBottom: -1,
    background: on ? '#EEF3FF' : 'transparent',
    color: on ? '#1E2333' : '#5A6073',
    borderBottom: `3px solid ${on ? '#5B8CFF' : 'transparent'}`,
    fontFamily: 'inherit',
  });
  const etiketSag: CSSProperties = {
    background: '#EEF3FF',
    color: '#1E2333',
    fontSize: 12.5,
    fontWeight: 700,
    padding: '5px 11px',
    borderRadius: 999,
  };

  return (
    <div style={{ flex: '999 1 760px', minWidth: 0 }}>
      <nav
        aria-label="Konum"
        style={{ fontSize: 13.5, color: '#5A6073', display: 'flex', flexWrap: 'wrap', gap: 6 }}
      >
        <Link href="/talepler">Vasıta</Link>
        {ustKategori ? (
          <>
            <span aria-hidden="true">›</span>
            <Link href={`/talepler?kategori=${ustKategori.slug}`}>{ustKategori.name}</Link>
          </>
        ) : null}
        <span aria-hidden="true">›</span>
        <Link href={`/talepler?kategori=${t.category.slug}`}>{t.category.name}</Link>
        {k.marka ? (
          <>
            <span aria-hidden="true">›</span>
            <Link
              href={`/talepler?kategori=${t.category.slug}&marka=${encodeURIComponent(String((t.data.alanlar.model as { make?: string })?.make ?? ''))}`}
            >
              {k.marka}
            </Link>
          </>
        ) : null}
        {k.seri ? (
          <>
            <span aria-hidden="true">›</span>
            <span>{k.seri}</span>
          </>
        ) : null}
        {k.model ? (
          <>
            <span aria-hidden="true">›</span>
            <span>{k.model}</span>
          </>
        ) : null}
      </nav>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          margin: '16px 0 24px',
        }}
      >
        <div style={{ flex: '999 1 560px', minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {yayinda ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: '#E7FAF0',
                  color: '#11683F',
                  fontSize: 13,
                  fontWeight: 700,
                  padding: '5px 12px',
                  borderRadius: 999,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{ width: 8, height: 8, borderRadius: '50%', background: '#2DB86F' }}
                />
                Yayında · {gunKaldi} gün kaldı
              </span>
            ) : (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: '#F3F5FA',
                  color: '#3A4052',
                  fontSize: 13,
                  fontWeight: 700,
                  padding: '5px 12px',
                  borderRadius: 999,
                }}
              >
                {t.status === 'PASSIVE'
                  ? 'Pasif · satıcılar şu an yazamaz'
                  : t.status === 'COMPLETED'
                    ? 'Tamamlandı'
                    : 'Kapatıldı'}
              </span>
            )}
          </div>
          <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.25, fontWeight: 800, letterSpacing: -0.4 }}>
            {t.baslik}
          </h1>
          <p style={{ margin: '10px 0 0', fontSize: 14, color: '#5A6073' }}>
            Talep no {t.no} · Yayın tarihi {uzunTarih(t.publishedAt)}
            {t.il ? ` · ${[t.il, t.ilce].filter(Boolean).join(', ')}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {sahip.isYou ? null : (
            <button
              type="button"
              onClick={favori}
              disabled={favBusy}
              aria-pressed={sahip.favori}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                background: '#FFFFFF',
                border: '1px solid #E3E6EF',
                borderRadius: 12,
                padding: '11px 14px',
                fontSize: 14,
                fontWeight: 600,
                color: '#1E2333',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill={sahip.favori ? '#FF6FB5' : 'none'}
                stroke={sahip.favori ? '#E0479A' : 'currentColor'}
                strokeWidth="2"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
              </svg>
              {sahip.favori ? 'Favorilerde' : 'Favorilere ekle'}
            </button>
          )}
          <button
            type="button"
            aria-label="Paylaş"
            title={paylasildi ? 'Bağlantı kopyalandı' : 'Paylaş'}
            onClick={async () => {
              const url = window.location.href;
              if (navigator.share) await navigator.share({ title: t.baslik, url }).catch(() => undefined);
              else {
                await navigator.clipboard?.writeText(url).catch(() => undefined);
                setPaylasildi(true);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 46,
              height: 46,
              background: '#FFFFFF',
              border: '1px solid #E3E6EF',
              borderRadius: 12,
              color: '#1E2333',
              cursor: 'pointer',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="18" cy="5" r="2.5" />
              <circle cx="6" cy="12" r="2.5" />
              <circle cx="18" cy="19" r="2.5" />
              <path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" />
            </svg>
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 24 }}>
        <div style={{ flex: '999 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <section aria-labelledby="gorsel" style={{ ...kart, overflow: 'hidden' }}>
            <h2 id="gorsel" className="sr-only">
              Araç görseli
            </h2>
            <div
              style={{
                position: 'relative',
                background: '#EEF3FF',
                padding: '40px 24px 28px',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: 16,
                  left: 16,
                  background: '#FFFFFF',
                  color: '#3A4052',
                  fontSize: 12.5,
                  fontWeight: 700,
                  padding: '6px 11px',
                  borderRadius: 999,
                }}
              >
                Temsili görsel
              </span>
              {t.data.alternatifler.length > 1 ? (
                <span
                  style={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    background: '#FFFFFF',
                    color: '#3A4052',
                    fontSize: 12.5,
                    fontWeight: 700,
                    padding: '6px 11px',
                    borderRadius: 999,
                  }}
                >
                  {altAd}
                </span>
              ) : null}
              {foto ? (
                // biome-ignore lint/performance/noImgElement: katalog görseli API'den akar; Next görüntü iyileştirmesi gerekmez
                <img
                  src={`${API}${foto.url}`}
                  alt={`${[k.marka, k.seri].filter(Boolean).join(' ')} temsilî fotoğraf`}
                  style={{
                    width: 560,
                    maxWidth: '100%',
                    aspectRatio: '560 / 206',
                    objectFit: 'cover',
                    borderRadius: 10,
                  }}
                />
              ) : (
                <span
                  role="img"
                  aria-label="Temsilî görsel yok"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 'none',
                    width: 560,
                    maxWidth: '100%',
                    aspectRatio: '560 / 206',
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #C9D3E6, #EEF1F7)',
                  }}
                >
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#8C95AA"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M4 7h3l2-2h6l2 2h3v12H4z" />
                    <circle cx="12" cy="13" r="3.5" />
                  </svg>
                </span>
              )}
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px 20px',
                padding: '14px 22px',
              }}
            >
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>
                  {[k.marka, k.seri].filter(Boolean).join(' ') || t.category.name}
                  {g?.kasa.length
                    ? ` · ${g.kasa.map((x) => x.label).join(' ve ')}${
                        g.kasa[0]?.yillar
                          ? ` (${g.kasa
                              .map((x) => x.yillar)
                              .filter(Boolean)
                              .join(', ')})`
                          : ''
                      }`
                    : ''}
                </div>
                <div style={{ fontSize: 13, color: '#5A6073', marginTop: 2 }}>
                  Temsilî {foto ? 'fotoğraf' : 'görsel'}
                  {g?.kasa.length ? ', kasa ve makyaja göre seçildi' : ''}; satıcının aracı değildir.
                  {foto ? ` ${foto.caption.replace(/ · temsilî görsel$/, '')}` : ''}
                </div>
              </div>
              {renkler.length ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 13,
                    color: '#3A4052',
                    flexWrap: 'wrap',
                  }}
                >
                  <span>İstenen renkler:</span>
                  {renkler.map((r) => (
                    <span
                      key={r?.value}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600 }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          background: r?.hex,
                          border: '1px solid #AEB5C4',
                        }}
                      />
                      {r?.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </section>

          <section aria-labelledby="ana-arac" style={{ ...kart, padding: 22 }}>
            <h2 id="ana-arac" style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>
              Aranan araç
            </h2>
            <p style={{ margin: '0 0 16px', fontSize: 14, color: '#5A6073' }}>
              Ana araç sabit;{' '}
              {t.data.alternatifler.length > 1
                ? `diğer kriterler ${t.data.alternatifler.length} alternatif halinde.`
                : 'diğer kriterler aşağıda.'}
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 10,
              }}
            >
              {anaArac.map((x, i) => (
                <div
                  key={x.label}
                  style={{ background: TINTS[i % TINTS.length], borderRadius: 14, padding: '12px 14px' }}
                >
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: '#4A5064' }}>{x.label}</div>
                  <div style={{ fontSize: 17, fontWeight: 800, marginTop: 2 }}>{x.value}</div>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="aciklama" style={{ ...kart, padding: 22 }}>
            <h2 id="aciklama" style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 700 }}>
              Açıklama
            </h2>
            <p
              style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: '#2E3344', whiteSpace: 'pre-line' }}
            >
              {(t.data.alanlar.aciklama as string | undefined) || 'Talep sahibi açıklama yazmadı.'}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>
              {genel.map((x, i) => (
                <span
                  key={x}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    background: '#F3F5FA',
                    borderRadius: 10,
                    padding: '8px 12px',
                    fontSize: 13.5,
                    fontWeight: 600,
                  }}
                >
                  {i === 0 ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11z" />
                      <circle cx="12" cy="10" r="2.2" />
                    </svg>
                  ) : null}
                  {x}
                </span>
              ))}
            </div>
          </section>

          <section aria-labelledby="kriterler" style={{ ...kart, overflow: 'hidden' }}>
            <h2 id="kriterler" className="sr-only">
              Kriterler
            </h2>
            <div
              role="tablist"
              style={{ display: 'flex', gap: 6, padding: '14px 14px 0', borderBottom: '1px solid #E3E6EF' }}
            >
              {t.data.alternatifler.map((_, i) => (
                <button
                  // biome-ignore lint/suspicious/noArrayIndexKey: alternatiflerin kimliği sırasıdır
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={alt === i}
                  onClick={() => setAlt(i)}
                  style={secmeli(alt === i)}
                >
                  Alternatif {i + 1}
                </button>
              ))}
            </div>
            <dl
              style={{
                margin: 0,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              }}
            >
              {satirlar.map((r) => (
                <div
                  key={r.label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 16,
                    padding: '14px 22px',
                    borderBottom: '1px solid #EEF0F5',
                  }}
                >
                  <dt style={{ fontSize: 14, color: '#5A6073' }}>{r.label}</dt>
                  <dd style={{ margin: 0, fontSize: 14, fontWeight: 700, textAlign: 'right' }}>{r.value}</dd>
                </div>
              ))}
            </dl>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '16px 22px',
                background: '#EEF3FF',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: '#3A4052' }}>Bütçe</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: '#2450C8' }}>
                {butceAraligi(butce?.min, butce?.max) || '—'}
              </span>
            </div>
          </section>

          {boya || islem ? (
            <section aria-labelledby="boya" style={{ ...kart, padding: 22 }}>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <h2 id="boya" style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                  Boya, değişen ve hasar kriterleri
                </h2>
              </div>
              {boya ? (
                <>
                  <p style={{ margin: '6px 0 18px', fontSize: 14, color: '#3A4052' }}>
                    Toplamda en fazla {boya.limit} parçada işlem;{' '}
                    {Object.values(boya.parts).includes('degisen')
                      ? 'bazı parçalarda değişen kabul.'
                      : 'değişen parça kabul edilmez.'}
                  </p>
                  <BoyaGorunumu boya={boya} />
                </>
              ) : null}
              {islem ? (
                <div
                  style={{
                    borderTop: boya ? '1px solid #EEF0F5' : 0,
                    marginTop: boya ? 22 : 10,
                    paddingTop: boya ? 18 : 0,
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 700 }}>Hasar geçmişi</h3>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                      gap: 10,
                      marginTop: 12,
                    }}
                  >
                    {(islem.options ?? []).map((o) => {
                      const ok = kabul.includes(o.value);
                      return (
                        <div
                          key={o.value}
                          style={{ border: '1px solid #EEF0F5', borderRadius: 14, padding: 14 }}
                        >
                          <svg
                            width="22"
                            height="22"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke={ok ? '#11683F' : '#A3271F'}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <circle cx="12" cy="12" r="9" />
                            {ok ? <path d="M8 12l3 3 5-6" /> : <path d="M6.5 6.5l11 11" />}
                          </svg>
                          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 8 }}>{o.label}</div>
                          <span
                            style={{
                              display: 'inline-block',
                              marginTop: 8,
                              background: ok ? '#E7FAF0' : '#FDECEC',
                              color: ok ? '#11683F' : '#A3271F',
                              fontSize: 12.5,
                              fontWeight: 700,
                              padding: '4px 10px',
                              borderRadius: 999,
                            }}
                          >
                            {ok ? 'Kabul ediyor' : 'Kabul etmiyor'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {f.some((x) => x.key === 'tramer') ? (
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        marginTop: 12,
                        borderRadius: 12,
                        background: '#F3F5FA',
                        padding: '12px 14px',
                      }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#3A4052' }}>
                        Tramer (hasar kaydı tutarı)
                      </span>
                      <span style={{ fontSize: 15, fontWeight: 800 }}>
                        {tramer !== undefined
                          ? `En fazla ${new Intl.NumberFormat('tr-TR').format(tramer)} TL`
                          : 'Belirtilmedi'}
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}

          {g?.teknik.length ? (
            <section aria-labelledby="teknik" style={{ ...kart, padding: 22 }}>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <h2 id="teknik" style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                  Teknik özellikler
                </h2>
                {t.data.alternatifler.length > 1 ? <span style={etiketSag}>{altAd}</span> : null}
              </div>
              <p style={{ margin: '6px 0 16px', fontSize: 13.5, color: '#5A6073' }}>
                Katalogdaki örnek donanım: {g.teknikOrnek}
                {g.kasa[0] ? ` · ${g.kasa[0].label} kasa` : ''}. Değerler donanıma göre değişebilir.
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: 10,
                }}
              >
                {g.teknik.map((x) => (
                  <div
                    key={x.label}
                    style={{ border: '1px solid #EEF0F5', borderRadius: 12, padding: '11px 13px' }}
                  >
                    <div style={{ fontSize: 12.5, color: '#5A6073' }}>{x.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginTop: 3 }}>{x.value}</div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {benzer.length ? (
            <section aria-labelledby="benzer">
              <h2 id="benzer" style={{ margin: '8px 0 12px', fontSize: 18, fontWeight: 700 }}>
                Benzer talepler
              </h2>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 12,
                }}
              >
                {benzer.map((b, i) => (
                  <Link
                    key={b.no}
                    href={`/talep/${b.no}`}
                    style={{
                      display: 'block',
                      ...kart,
                      borderRadius: 16,
                      padding: 16,
                      color: '#1E2333',
                      textDecoration: 'none',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        display: 'block',
                        width: 32,
                        height: 6,
                        borderRadius: 3,
                        background: ['#FF6FB5', '#FFC84A', '#3DD68C'][i % 3],
                        marginBottom: 12,
                      }}
                    />
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 700, lineHeight: 1.35 }}>
                      {b.baslik}
                    </span>
                    <span style={{ display: 'block', fontSize: 13, color: '#5A6073', marginTop: 6 }}>
                      {[b.il, b.yilMin ? `${b.yilMin} ve sonrası` : null].filter(Boolean).join(' · ')}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside
          aria-label="Talep sahibi"
          style={{
            flex: '1 1 320px',
            minWidth: 0,
            maxWidth: 400,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <section style={{ ...kart, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: '#EEF3FF',
                  color: '#2450C8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 18,
                }}
              >
                {bas || '?'}
              </span>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800 }}>{sahip.name}</div>
                <div style={{ fontSize: 13, color: '#5A6073', marginTop: 2 }}>
                  {uyelik(sahip.memberSince)}
                </div>
              </div>
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 14,
                fontSize: 13,
                fontWeight: 600,
                color: '#11683F',
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              Telefon numarası doğrulandı
            </div>
            {sahip.isYou ? (
              <Link
                href="/taleplerim"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 9,
                  marginTop: 18,
                  border: '1px solid #D5DAE5',
                  color: '#1E2333',
                  fontWeight: 800,
                  fontSize: 16,
                  padding: 15,
                  borderRadius: 14,
                  textDecoration: 'none',
                }}
              >
                Bu senin talebin · Taleplerim
              </Link>
            ) : (
              <button
                type="button"
                disabled={giris && (!yayinda || !mesaj) ? true : undefined}
                onClick={() => {
                  if (!giris) window.location.href = `/giris?sonra=/talep/${t.no}`;
                  else if (mesaj?.yazildi) window.location.href = `/mesajlarim?sohbet=${mesaj.yazildi}`;
                  else setPencere(true);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 9,
                  marginTop: 18,
                  background: '#5B8CFF',
                  color: '#1E2333',
                  fontWeight: 800,
                  fontSize: 16,
                  padding: 15,
                  borderRadius: 14,
                  border: 0,
                  opacity: giris && (!yayinda || !mesaj) && !mesaj?.yazildi ? 0.55 : 1,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 5h16v11H9l-5 4z" />
                </svg>
                {mesaj?.yazildi ? 'Sohbete git' : 'Mesaj at'}
              </button>
            )}
            {yayinda && (sahip.phone || sahip.phoneHidden) ? (
              <div
                style={{
                  marginTop: 10,
                  border: '1px solid #E3E6EF',
                  borderRadius: 14,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    fontSize: 16,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" />
                  </svg>
                  {sahip.phone && goster
                    ? telefon(sahip.phone)
                    : `0 (5XX) XXX XX ${sahip.phone ? sahip.phone.slice(-2) : '••'}`}
                </span>
                {sahip.phone ? (
                  <button
                    type="button"
                    onClick={() => setGoster(!goster)}
                    style={{
                      border: 0,
                      background: 'transparent',
                      color: '#2450C8',
                      fontWeight: 700,
                      fontSize: 14,
                      padding: '8px 4px',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {goster ? 'Gizle' : 'Numarayı göster'}
                  </button>
                ) : (
                  <Link
                    href={`/giris?sonra=/talep/${t.no}`}
                    style={{ color: '#2450C8', fontWeight: 700, fontSize: 14, padding: '8px 4px' }}
                  >
                    Görmek için giriş yap
                  </Link>
                )}
              </div>
            ) : null}
            {yayinda && sahip.whatsapp && sahip.phone ? (
              <a
                href={`https://wa.me/${sahip.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 9,
                  marginTop: 10,
                  background: '#FFFFFF',
                  border: '1.5px solid #25A35A',
                  color: '#11683F',
                  fontWeight: 700,
                  fontSize: 15,
                  padding: 13,
                  borderRadius: 14,
                  textDecoration: 'none',
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 20l1.3-4A8 8 0 1 1 8.5 19z" />
                </svg>
                WhatsApp'tan yaz
              </a>
            ) : null}
            <p style={{ margin: '14px 0 0', fontSize: 13, lineHeight: 1.5, color: '#5A6073' }}>
              {yayinda
                ? 'Bu talebe yalnızca bir ilk mesaj atabilirsiniz.'
                : 'Bu talep şu an yayında değil; satıcılar mesaj atamaz.'}
              {yayinda && mesaj?.gunluk && !mesaj.yazildi ? (
                <>
                  {' '}
                  {mesaj.hesaplar.length === 1 && !mesaj.hesaplar[0]?.galeri
                    ? 'Bugün kalan ücretsiz mesaj hakkınız: '
                    : 'Bugün kalan mesaj hakkınız: '}
                  <strong style={{ color: '#1E2333' }}>
                    {mesaj.gunluk.kalan} / {mesaj.gunluk.toplam}
                  </strong>
                </>
              ) : null}
            </p>
            {pencere ? (
              <IlkMesaj
                talepNo={t.no}
                talepBaslik={t.baslik}
                sahip={sahip.name}
                yasalUyari={t.schema.rules.legalNotice}
                kapat={() => setPencere(false)}
                gonderildi={(id) => {
                  window.location.href = `/mesajlarim?sohbet=${id}`;
                }}
              />
            ) : null}
          </section>

          <section
            aria-labelledby="guvenlik"
            style={{ background: '#FFF6DF', borderRadius: 18, padding: '18px 20px' }}
          >
            <h2 id="guvenlik" style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 800, color: '#5C3F00' }}>
              Güvenliğiniz için
            </h2>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.6, color: '#4A3500' }}>
              <li>Aracı görmeden kapora ödemeyin.</li>
              <li>Ödemeyi noterde Güvenli Ödeme Sistemi ile yapın.</li>
              <li>Platform dışı bağlantılara tıklamayın.</li>
            </ul>
          </section>
          {t.schema.rules.legalNotice ? (
            <p
              style={{
                margin: 0,
                fontSize: 13,
                lineHeight: 1.55,
                color: '#3A4052',
                background: '#F3F5FA',
                borderRadius: 14,
                padding: '12px 14px',
              }}
            >
              {t.schema.rules.legalNotice}
            </p>
          ) : null}
          {sahip.isYou ? null : (
            <button
              type="button"
              onClick={() => {
                if (!giris) window.location.href = `/giris?sonra=/talep/${t.no}`;
                else setSikayet(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
                fontWeight: 600,
                color: '#5A6073',
                padding: '6px 4px',
                border: 0,
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 21V4h11l-2 4 2 4H5" />
              </svg>
              Bu talebi şikayet et
            </button>
          )}
          {sikayet ? <Sikayet hedef="talep" id={String(t.no)} kapat={() => setSikayet(false)} /> : null}
        </aside>
      </div>
    </div>
  );
}

/** Boya şeması ve parça grupları (Main.dc.html) */
function BoyaGorunumu({ boya }: { boya: { limit: number; parts: Record<string, string> } }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 28 }}>
      <AracSemasiGorunum
        parts={boya.parts}
        etiket="Parça bazında boya ve değişen kriterleri, üstten araç şeması"
      />
      <ul
        style={{
          flex: '1 1 260px',
          minWidth: 0,
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {PAINT_STATES.map((s) => {
          const parcalar = PAINT_PARTS.filter((p) => (boya.parts[p.key] ?? 'orijinal') === s.key).map(
            (p) => p.ad,
          );
          return (
            <li key={s.key} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span
                aria-hidden="true"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  background: s.renk,
                  border: '1px solid #AEB5C4',
                  flex: 'none',
                  marginTop: 1,
                }}
              />
              <span>
                <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{BOYA_AD[s.key]}</span>
                <span
                  style={{
                    display: 'block',
                    fontSize: 13.5,
                    color: '#5A6073',
                    marginTop: 2,
                    lineHeight: 1.45,
                  }}
                >
                  {parcalar.length ? parcalar.join(', ') : 'Hiçbir parça'}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
