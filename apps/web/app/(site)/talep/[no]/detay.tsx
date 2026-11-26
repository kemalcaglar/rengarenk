'use client';

import {
  type CategoryField,
  type CategoryRules,
  PAINT_PARTS,
  PAINT_STATES,
  saatYaz,
  type TeknikOzet,
} from '@rengarenk/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AciklamaGoster } from '../../../../components/aciklama';
import { AracKapak } from '../../../../components/arac-kapak';
import { AracSemasiGorunum } from '../../../../components/arac-semasi';
import { Banner } from '../../../../components/banner';
import { GorselBuyut } from '../../../../components/gorsel-buyut';
import { IlkMesaj } from '../../../../components/ilk-mesaj';
import { Sikayet } from '../../../../components/sikayet';
import { TeknikTablo } from '../../../../components/teknik-tablo';
import { cx } from '../../../../lib/cx';
import { API, istek, useGiris } from '../../../../lib/istemci';
import { butceAraligi, deger, etiket, uzunTarih } from '../../../../lib/talep-bicim';
import stil from './detay.module.css';

type Values = Record<string, unknown>;

/** Kapaktaki yıl: "2019–2023", "2019 ve sonrası", "2015 ve öncesi" */
const kapakYil = (y?: { min?: number; max?: number }) =>
  y?.min && y.max
    ? y.min === y.max
      ? `${y.min}`
      : `${y.min}–${y.max}`
    : y?.min
      ? `${y.min} ve sonrası`
      : y?.max
        ? `${y.max} ve öncesi`
        : null;
interface Foto {
  url: string;
  caption: string;
  /** Nesilde fotoğraf yoksa en yakın neslin fotoğrafı (Karar 34) */
  nesil?: 'onceki' | 'sonraki' | null;
  /** Model geneli fotoğraf (nesil ya da kasa bilinmiyor) */
  genel?: boolean;
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
      /** Alternatifin görseli (kasa, yıl ya da model geneli); yoksa marka ve model kapağı */
      foto?: Foto | null;
      paket: string[];
      teknik: { label: string; value: string }[];
      teknikOrnek: string | null;
      /** Ayrıntılı teknik özellikler, motor sürümü başına */
      motorlar?: { ad: string; model?: string; ozet: TeknikOzet }[];
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
    /** Aranabilir saatler (Karar 29): dışındaysa numara ve WhatsApp gizli */
    aramaSaati?: { bas: number; bit: number; simdiGizli: boolean } | null;
  };
}

const TINTS = ['#EEF3FF', '#FFEEF6', '#FFF6DF', '#E7FAF0'];
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
  const [sekme, setSekme] = useState<'aciklama' | 'teknik'>('aciklama');
  /** Fotoğraf büyütüldü (tam ekran) */
  const [buyuk, setBuyuk] = useState(false);
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

  // Görüntülenme (Taleplerim istatistiği): giriş durumu belli olunca bir kez; sunucu sahibi ve tekrarı saymaz
  useEffect(() => {
    if (giris === null || t.status !== 'PUBLISHED') return;
    istek(`/talepler/${t.no}/goruntu`, { method: 'POST' }).catch(() => undefined);
  }, [giris, t.no, t.status]);

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
  const foto = g?.kasa.find((k) => k.foto)?.foto ?? g?.foto ?? null;
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
  return (
    <div className={stil.kutu1}>
      <Banner yer="talep_detay" className={stil.banner} />
      <nav aria-label="Konum" className={stil.kutu2}>
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

      <div className={stil.kutu3}>
        <div className={stil.kutu4}>
          <div className={stil.kutu5}>
            {yayinda ? (
              <span className={stil.metin1}>
                <span aria-hidden="true" className={stil.metin2} />
                Yayında · {gunKaldi} gün kaldı
              </span>
            ) : (
              <span className={stil.metin3}>
                {t.status === 'PASSIVE'
                  ? 'Pasif · satıcılar şu an yazamaz'
                  : t.status === 'COMPLETED'
                    ? 'Tamamlandı'
                    : 'Kapatıldı'}
              </span>
            )}
          </div>
          <h1 className={stil.baslik1}>{t.baslik}</h1>
          <p className={stil.metin4}>
            Talep no {t.no} · Yayın tarihi {uzunTarih(t.publishedAt)}
            {t.il ? ` · ${[t.il, t.ilce].filter(Boolean).join(', ')}` : ''}
          </p>
        </div>
        <div className={stil.kutu6}>
          {sahip.isYou ? null : (
            <button
              type="button"
              onClick={favori}
              disabled={favBusy}
              aria-pressed={sahip.favori}
              className={stil.dugme1}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill={sahip.favori ? 'var(--rr-pembe, #FF6FB5)' : 'none'}
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
            className={stil.dugme2}
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

      <div className={stil.kutu7}>
        <div className={stil.kutu8}>
          <section aria-labelledby="gorsel" className={stil.kutu9}>
            <h2 id="gorsel" className="sr-only">
              Araç görseli
            </h2>
            {/* Görsel alanı kartın üst kısmını kaplar; fotoğraf kırpılmadan sığar ve tıklanınca büyür (sahip isteği) */}
            <div className={stil.kutu10}>
              <span className={stil.metin5}>
                Temsili görsel
                {foto?.nesil ? ` · ${foto.nesil === 'onceki' ? 'önceki' : 'sonraki'} nesil` : ''}
                {foto?.genel ? ' · model geneli' : ''}
              </span>
              {t.data.alternatifler.length > 1 ? <span className={stil.metin6}>{altAd}</span> : null}
              {foto ? (
                <button
                  type="button"
                  onClick={() => setBuyuk(true)}
                  aria-label="Fotoğrafı büyüt"
                  className={stil.dugme3}
                >
                  {/* Kenar boşlukları fotoğrafın bulanık kopyasıyla dolar: alan hiç boş görünmez */}
                  {/* biome-ignore lint/performance/noImgElement: katalog görseli API'den akar */}
                  <img src={`${API}${foto.url}`} alt="" aria-hidden="true" className={stil.gorsel1} />
                  {/* biome-ignore lint/performance/noImgElement: katalog görseli API'den akar */}
                  <img
                    src={`${API}${foto.url}`}
                    alt={`${[k.marka, k.seri].filter(Boolean).join(' ')} temsilî fotoğraf`}
                    className={stil.gorsel2}
                  />
                  <span aria-hidden="true" className={stil.metin7}>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                    </svg>
                    Büyüt
                  </span>
                </button>
              ) : (
                <span className={stil.metin8}>
                  <AracKapak
                    boyut="buyuk"
                    marka={k.marka}
                    seri={[k.seri, k.model].filter(Boolean).join(' ') || t.category.name}
                    bilgi={[
                      kapakYil(a.yil as { min?: number; max?: number } | undefined),
                      // Kasa ve paket her zaman yazar (sahip isteği): seçilmemişse "fark etmez"
                      t.schema.fields.some((x) => x.key === 'kasa')
                        ? `Kasa: ${g?.kasa.length ? g.kasa.map((x) => x.label).join(' ya da ') : 'fark etmez'}`
                        : null,
                      t.schema.fields.some((x) => x.key === 'paket')
                        ? `Paket: ${g?.paket.length ? g.paket.join(' ya da ') : 'fark etmez'}`
                        : null,
                    ]}
                  />
                </span>
              )}
            </div>
            {buyuk && foto ? (
              <GorselBuyut
                src={`${API}${foto.url}`}
                alt={`${[k.marka, k.seri].filter(Boolean).join(' ')} temsilî fotoğraf`}
                altyazi={`Temsilî fotoğraf; satıcının aracı değildir. ${foto.caption.replace(' · temsilî görsel', '')}`}
                kapat={() => setBuyuk(false)}
              />
            ) : null}
            <div className={stil.kutu11}>
              <div>
                <div className={stil.kutu12}>
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
                <div className={stil.kutu13}>
                  Temsilî {foto ? 'fotoğraf' : 'görsel'}
                  {g?.kasa.length ? ', kasa ve makyaja göre seçildi' : ''}; satıcının aracı değildir.
                  {foto ? ` ${foto.caption.replace(' · temsilî görsel', '')}` : ''}
                </div>
              </div>
              {renkler.length ? (
                <div className={stil.kutu14}>
                  <span>İstenen renkler:</span>
                  {renkler.map((r) => (
                    <span key={r?.value} className={stil.metin9}>
                      <span aria-hidden="true" className={stil.metin10} style={{ background: r?.hex }} />
                      {r?.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </section>

          <section aria-labelledby="ana-arac" className={stil.kutu15}>
            <h2 id="ana-arac" className={stil.baslik2}>
              Aranan araç
            </h2>
            <p className={stil.metin11}>
              Ana araç sabit;{' '}
              {t.data.alternatifler.length > 1
                ? `diğer kriterler ${t.data.alternatifler.length} alternatif halinde.`
                : 'diğer kriterler aşağıda.'}
            </p>
            <div className={stil.kutu16}>
              {anaArac.map((x, i) => (
                <div key={x.label} className={stil.kutu17} style={{ background: TINTS[i % TINTS.length] }}>
                  <div className={stil.kutu18}>{x.label}</div>
                  <div className={stil.kutu19}>{x.value}</div>
                </div>
              ))}
            </div>
          </section>

          <section aria-label="Açıklama ve teknik özellikler" className={stil.kutu15}>
            {/* Açıklama ve teknik özellikler yan yana sekme (sahip isteği, 17 Kasım 2026) */}
            <div role="tablist" aria-label="Talep ayrıntısı" className={stil.kutu20}>
              {(
                [
                  ['aciklama', 'Açıklama'],
                  ['teknik', 'Teknik özellikler'],
                ] as const
              ).map(([k, ad]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  id={`sekme-${k}`}
                  aria-selected={sekme === k}
                  aria-controls={`panel-${k}`}
                  onClick={() => setSekme(k)}
                  className={cx(stil.dugme4, sekme === k ? stil.dugme5 : stil.dugme6)}
                  style={{
                    border: 0,
                    borderBottom: `3px solid ${sekme === k ? 'var(--rr-mavi, #5B8CFF)' : 'transparent'}`,
                  }}
                >
                  {ad}
                </button>
              ))}
            </div>
            {sekme === 'aciklama' ? (
              <div role="tabpanel" id="panel-aciklama" aria-labelledby="sekme-aciklama">
                {/* Biçimli açıklama; uzayabileceği için yükseklik sabit, fazlası kaydırılır */}
                <AciklamaGoster
                  metin={(t.data.alanlar.aciklama as string | undefined) || 'Talep sahibi açıklama yazmadı.'}
                  sabit
                />
              </div>
            ) : (
              <div role="tabpanel" id="panel-teknik" aria-labelledby="sekme-teknik">
                <TeknikTablo
                  talepNo={t.no}
                  motorlar={g?.motorlar ?? []}
                  not={[
                    t.data.alternatifler.length > 1 ? altAd : null,
                    g?.kasa[0]
                      ? `${g.kasa[0].label} kasa${g.kasa[0].yillar ? ` (${g.kasa[0].yillar})` : ''}`
                      : null,
                    g?.paket.length ? `${g.paket.join(', ')} paketi` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                />
              </div>
            )}
            <div className={stil.kutu21}>
              {genel.map((x, i) => (
                <span key={x} className={stil.metin12}>
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

          <section aria-labelledby="kriterler" className={stil.kutu9}>
            <h2 id="kriterler" className="sr-only">
              Kriterler
            </h2>
            <div role="tablist" className={stil.kutu22}>
              {t.data.alternatifler.map((_, i) => (
                <button
                  // biome-ignore lint/suspicious/noArrayIndexKey: alternatiflerin kimliği sırasıdır
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={alt === i}
                  onClick={() => setAlt(i)}
                  className={cx(alt === i ? stil.dugme12 : stil.dugme13)}
                >
                  Alternatif {i + 1}
                </button>
              ))}
            </div>
            <dl className={stil.liste1}>
              {satirlar.map((r) => (
                <div key={r.label} className={stil.kutu23}>
                  <dt className={stil.metin13}>{r.label}</dt>
                  <dd className={stil.metin14}>{r.value}</dd>
                </div>
              ))}
            </dl>
            <div className={stil.kutu24}>
              <span className={stil.metin15}>Bütçe</span>
              <span className={stil.metin16}>{butceAraligi(butce?.min, butce?.max) || '—'}</span>
            </div>
          </section>

          {boya || islem ? (
            <section aria-labelledby="boya" className={stil.kutu15}>
              <div className={stil.kutu25}>
                <h2 id="boya" className={stil.baslik3}>
                  Boya, değişen ve hasar kriterleri
                </h2>
              </div>
              {boya ? (
                <>
                  <p className={stil.metin17}>
                    Toplamda en fazla {boya.limit} parçada işlem;{' '}
                    {Object.values(boya.parts).includes('degisen')
                      ? 'bazı parçalarda değişen kabul.'
                      : 'değişen parça kabul edilmez.'}
                  </p>
                  <BoyaGorunumu boya={boya} />
                </>
              ) : null}
              {islem ? (
                <div className={cx(boya ? stil.kutu26 : stil.kutu27)}>
                  <h3 className={stil.baslik4}>Hasar geçmişi</h3>
                  <div className={stil.kutu28}>
                    {(islem.options ?? []).map((o) => {
                      const ok = kabul.includes(o.value);
                      return (
                        <div key={o.value} className={stil.kutu29}>
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
                          <div className={stil.kutu30}>{o.label}</div>
                          <span className={cx(stil.metin18, ok ? stil.metin19 : stil.metin20)}>
                            {ok ? 'Kabul ediyor' : 'Kabul etmiyor'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {f.some((x) => x.key === 'tramer') ? (
                    <div className={stil.kutu31}>
                      <span className={stil.metin15}>Tramer (hasar kaydı tutarı)</span>
                      <span className={stil.metin21}>
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

          {benzer.length ? (
            <section aria-labelledby="benzer">
              <h2 id="benzer" className={stil.baslik5}>
                Benzer talepler
              </h2>
              <div className={stil.kutu32}>
                {benzer.map((b, i) => (
                  <Link key={b.no} href={`/talep/${b.no}`} className={stil.bag1}>
                    <span
                      aria-hidden="true"
                      className={stil.metin22}
                      style={{
                        background: [
                          'var(--rr-pembe, #FF6FB5)',
                          'var(--rr-sari, #FFC84A)',
                          'var(--rr-yesil, #3DD68C)',
                        ][i % 3],
                      }}
                    />
                    <span className={stil.metin23}>{b.baslik}</span>
                    <span className={stil.metin24}>
                      {[b.il, b.yilMin ? `${b.yilMin} ve sonrası` : null].filter(Boolean).join(' · ')}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside aria-label="Talep sahibi" className={stil.kutu33}>
          <section className={stil.kutu15}>
            <div className={stil.kutu34}>
              <span aria-hidden="true" className={stil.metin25}>
                {bas || '?'}
              </span>
              <div>
                <div className={stil.kutu35}>{sahip.name}</div>
                <div className={stil.kutu13}>{uyelik(sahip.memberSince)}</div>
              </div>
            </div>
            <div className={stil.kutu36}>
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
              <Link href="/taleplerim" className={stil.bag2}>
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
                className={cx(
                  stil.dugme7,
                  giris && (!yayinda || !mesaj) && !mesaj?.yazildi ? stil.dugme8 : stil.dugme9,
                )}
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
              <div className={stil.kutu37}>
                <span className={stil.metin26}>
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
                  <button type="button" onClick={() => setGoster(!goster)} className={stil.dugme10}>
                    {goster ? 'Gizle' : 'Numarayı göster'}
                  </button>
                ) : (
                  <Link href={`/giris?sonra=/talep/${t.no}`} className={stil.bag3}>
                    Görmek için giriş yap
                  </Link>
                )}
              </div>
            ) : null}
            {yayinda && sahip.aramaSaati?.simdiGizli ? (
              <p className={stil.metin27}>
                Telefon ve WhatsApp {saatYaz(sahip.aramaSaati.bas)}–
                {sahip.aramaSaati.bit === 24 ? '24.00' : saatYaz(sahip.aramaSaati.bit)} arasında görünür.
                Mesaj her zaman açık.
              </p>
            ) : null}
            {yayinda && sahip.whatsapp && sahip.phone ? (
              <a
                href={`https://wa.me/${sahip.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className={stil.bag4}
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
            <p className={stil.metin28}>
              {yayinda
                ? 'Bu talebe yalnızca bir ilk mesaj atabilirsiniz.'
                : 'Bu talep şu an yayında değil; satıcılar mesaj atamaz.'}
              {yayinda && mesaj?.gunluk && !mesaj.yazildi ? (
                <>
                  {' '}
                  {mesaj.hesaplar.length === 1 && !mesaj.hesaplar[0]?.galeri
                    ? 'Bugün kalan ücretsiz mesaj hakkınız: '
                    : 'Bugün kalan mesaj hakkınız: '}
                  <strong className={stil.dugme5}>
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

          <section aria-labelledby="guvenlik" className={stil.kutu38}>
            <h2 id="guvenlik" className={stil.baslik6}>
              Güvenliğiniz için
            </h2>
            <ul className={stil.liste2}>
              <li>Aracı görmeden kapora ödemeyin.</li>
              <li>Ödemeyi noterde Güvenli Ödeme Sistemi ile yapın.</li>
              <li>Platform dışı bağlantılara tıklamayın.</li>
            </ul>
          </section>
          {t.schema.rules.legalNotice ? <p className={stil.metin29}>{t.schema.rules.legalNotice}</p> : null}
          {sahip.isYou ? null : (
            <button
              type="button"
              onClick={() => {
                if (!giris) window.location.href = `/giris?sonra=/talep/${t.no}`;
                else setSikayet(true);
              }}
              className={stil.dugme11}
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
    <div className={stil.kutu39}>
      <AracSemasiGorunum
        parts={boya.parts}
        etiket="Parça bazında boya ve değişen kriterleri, üstten araç şeması"
      />
      <ul className={stil.liste3}>
        {PAINT_STATES.map((s) => {
          const parcalar = PAINT_PARTS.filter((p) => (boya.parts[p.key] ?? 'orijinal') === s.key).map(
            (p) => p.ad,
          );
          return (
            <li key={s.key} className={stil.oge1}>
              <span aria-hidden="true" className={stil.metin30} style={{ background: s.renk }} />
              <span>
                <span className={stil.metin31}>{BOYA_AD[s.key]}</span>
                <span className={stil.metin32}>{parcalar.length ? parcalar.join(', ') : 'Hiçbir parça'}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
