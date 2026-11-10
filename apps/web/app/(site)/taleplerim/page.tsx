'use client';

import { BIREYSEL_FIYATLAR, DOTS, FOUND_VIA, type FoundViaKey, PROMOTION_NAMES } from '@rengarenk/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { HesabimMenu } from '../../../components/hesabim-menu';
import { useWebFiyat } from '../../../lib/fiyat';
import { binlik, istek, useGiris } from '../../../lib/istemci';

interface Talep {
  id: string;
  no: number;
  status: 'DRAFT' | 'PUBLISHED' | 'PASSIVE' | 'CLOSED' | 'COMPLETED';
  baslik: string;
  category: { slug: string; name: string };
  il: string | null;
  ilce: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  yearMin: number | null;
  yearMax: number | null;
  alternatives: number;
  step: number;
  publishedAt: string | null;
  expiresAt: string | null;
  passiveReason: string | null;
  closedAt: string | null;
  freeExtensionUsed: boolean;
  updatedAt: string;
  /** Rengarenk Ajanı düzeltme istedi (Karar 41): talep yayında, bu bilgiler başkalarına gizli */
  duzeltme: { zaman: string; alanlar: string[]; not: string | null } | null;
  /** Galeri adına açılmış talep (Karar 12.2) */
  galeri: { ad: string; slug: string } | null;
  /** Talebin hesabındaki kullanılmamış öne çıkarma hakları (galeri paketi ya da talep seçmeden alınmış hak) */
  oneCikarmaHakki: Partial<Record<'ust_sira' | 'acil' | 'vitrin', number>>;
  /** Kart istatistikleri (Taleplerim.dc.html): görüntülenme, favori, açılan sohbet, uyan portföy aracı */
  istatistik?: { goruntu: number; favori: number; mesaj: number; eslesen: number };
}
interface Haklar {
  ucretsizTalep: boolean;
  talep: number;
  uzatma: number;
}
type Sekme = 'yayinda' | 'pasif' | 'taslak' | 'bitti';

const SEKMELER: [Sekme, string][] = [
  ['yayinda', 'Yayında'],
  ['pasif', 'Pasif'],
  ['taslak', 'Taslak'],
  ['bitti', 'Tamamlanan'],
];
const ETIKET: Record<Talep['status'], [string, string, string]> = {
  PUBLISHED: ['Yayında', '#E7FAF0', '#11683F'],
  PASSIVE: ['Pasif', '#FFF6DF', '#7A5300'],
  DRAFT: ['Taslak', '#F3F5FA', '#3A4052'],
  COMPLETED: ['Tamamlandı', '#EEF3FF', 'var(--rr-baglanti, #2450C8)'],
  CLOSED: ['Kapatıldı', '#F3F5FA', '#3A4052'],
};
const TINTS = ['#EEF3FF', '#FFEEF6', '#FFF6DF', '#E7FAF0', '#F3EFFF', '#FFF0EA'];

const sekmeOf = (t: Talep): Sekme | null =>
  t.status === 'PUBLISHED'
    ? 'yayinda'
    : t.status === 'PASSIVE'
      ? 'pasif'
      : t.status === 'DRAFT'
        ? 'taslak'
        : t.publishedAt
          ? 'bitti'
          : null; // hiç yayınlanmadan kapatılan taslak listede görünmez
const tarih = (iso: string | null, yil = false) =>
  iso
    ? new Intl.DateTimeFormat('tr-TR', {
        timeZone: 'Europe/Istanbul',
        day: 'numeric',
        month: 'long',
        ...(yil ? { year: 'numeric' } : {}),
      }).format(new Date(iso))
    : '';
const gunKaldi = (iso: string | null) =>
  Math.max(0, Math.ceil(((iso ? new Date(iso).getTime() : 0) - Date.now()) / 86_400_000));
const sureDoldu = (t: Talep) =>
  t.status === 'PASSIVE' && (t.passiveReason === 'sure_doldu' || gunKaldi(t.expiresAt) === 0);
/** Moderasyon kararıyla yayından kaldırıldı (Karar 53): sahibi yeniden yayınlayamaz, itiraz eder */
const moderasyon = (t: Talep) => t.status === 'PASSIVE' && t.passiveReason === 'moderasyon';

function ozet(t: Talep) {
  const yil =
    t.yearMin && t.yearMax
      ? t.yearMin === t.yearMax
        ? `${t.yearMin}`
        : `${t.yearMin}–${t.yearMax}`
      : t.yearMin
        ? `${t.yearMin} ve üzeri`
        : '';
  const butce = t.budgetMax
    ? `${t.budgetMin && t.budgetMin !== t.budgetMax ? `${binlik(t.budgetMin)} – ` : 'En çok '}${binlik(t.budgetMax)} TL`
    : '';
  return [`${t.alternatives} alternatif`, yil, butce, [t.il, t.ilce].filter(Boolean).join(', ')]
    .filter(Boolean)
    .join(' · ');
}

/** "telefon numarası ve bağlantı" */
const birlestir = (l: string[]) =>
  l.length > 1 ? `${l.slice(0, -1).join(', ')} ve ${l.at(-1)}` : (l[0] ?? '');

function sure(t: Talep) {
  if (t.status === 'PUBLISHED') return `Yayında · ${gunKaldi(t.expiresAt)} gün kaldı`;
  if (moderasyon(t)) return 'Moderasyon kararıyla yayından kaldırıldı · bildirimlerden itiraz edebilirsin';
  if (t.status === 'PASSIVE')
    return sureDoldu(t)
      ? `Süresi ${tarih(t.expiresAt)}’da doldu`
      : 'Pasife alındı · istediğin zaman yeniden yayınlayabilirsin';
  if (t.status === 'DRAFT') return `Son düzenleme ${tarih(t.updatedAt)}`;
  return `${t.status === 'COMPLETED' ? 'Tamamlandı' : 'Kapatıldı'} · ${tarih(t.closedAt, true)}`;
}

/** Taleplerim (tasarım: Taleplerim.dc.html; Karar 09, 10, 31): durum sekmeleri, süre ve talebin işlemleri. */
export default function Taleplerim() {
  const fiyat = useWebFiyat();
  const giris = useGiris();
  const router = useRouter();
  const [liste, setListe] = useState<Talep[] | null>(null);
  const [haklar, setHaklar] = useState<Haklar | null>(null);
  const [sekme, setSekme] = useState<Sekme>('yayinda');
  const [dlg, setDlg] = useState<Talep | null>(null);
  const [secim, setSecim] = useState<FoundViaKey>('rengarenk');
  const [toast, setToast] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    const [m, h] = await Promise.all([
      istek<{ items: Talep[] }>('/demands/mine'),
      istek<Haklar>('/demands/rights'),
    ]);
    setListe(m.items);
    setHaklar(h);
  }, []);

  useEffect(() => {
    if (giris === false) router.replace('/giris?sonra=/taleplerim');
    if (!giris) return;
    const q = new URLSearchParams(window.location.search).get('yayinlandi');
    if (q) {
      setToast(`Talebin yayında · Talep No ${q}. Satıcılar artık seni bulabilir.`);
      window.history.replaceState(null, '', '/taleplerim');
    }
    yukle().catch((e: Error) => setHata(e.message));
  }, [giris, router, yukle]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function islem(t: Talep, yol: string, mesaj: string, body?: unknown, sonraki?: Sekme) {
    setBusy(t.id);
    setHata(null);
    try {
      await istek(`/demands/${t.id}/${yol}`, { method: 'POST', body });
      setToast(mesaj);
      setDlg(null);
      await yukle();
      if (sonraki) setSekme(sonraki);
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const sayilar = Object.fromEntries(
    SEKMELER.map(([k]) => [k, (liste ?? []).filter((t) => sekmeOf(t) === k).length]),
  );
  const gorunen = (liste ?? []).filter((t) => sekmeOf(t) === sekme);
  const doldu = (liste ?? []).find((t) => sureDoldu(t) && !t.freeExtensionUsed);
  const hak = haklar ? `${haklar.talep}${haklar.ucretsizTalep ? ' (ücretsiz)' : ''}` : '…';

  const btn = (renk: string): CSSProperties => ({
    border: 0,
    background: renk,
    borderRadius: 'calc(var(--rr-buton-kose) * 10 / 14)',
    padding: '10px 12px',
    fontSize: 14,
    fontWeight: 800,
    color: 'var(--rr-murekkep, #1E2333)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  });
  const cizgili: CSSProperties = {
    display: 'block',
    textAlign: 'center',
    border: '1px solid #D5DAE5',
    borderRadius: 'calc(var(--rr-buton-kose) * 10 / 14)',
    padding: '9px 12px',
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--rr-murekkep, #1E2333)',
    textDecoration: 'none',
  };
  const yalin = (renk: string): CSSProperties => ({
    border: 0,
    background: 'transparent',
    padding: 6,
    fontSize: 13.5,
    fontWeight: 700,
    color: renk,
    cursor: 'pointer',
    fontFamily: 'inherit',
  });

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          maxWidth: 1360,
          margin: '0 auto',
          padding: '24px 24px 64px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          gap: 24,
        }}
      >
        <HesabimMenu aktif="/taleplerim" />

        <main style={{ flex: '999 1 760px', minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.4 }}>Taleplerim</h1>
              <p style={{ margin: '4px 0 0', fontSize: 14.5, color: 'var(--rr-soluk, #5A6073)' }}>
                Kalan talep hakkın: <strong style={{ color: 'var(--rr-murekkep, #1E2333)' }}>{hak}</strong>
                {haklar && haklar.talep === 0
                  ? ` · ek talep ${fiyat('ek_talep', BIREYSEL_FIYATLAR.ekTalep.tl)} TL (ödeme altyapısı açılınca)`
                  : ''}
              </p>
            </div>
          </div>

          {hata ? (
            <p
              role="alert"
              style={{
                margin: '0 0 14px',
                background: '#FDECEC',
                borderRadius: 'calc(var(--rr-buton-kose) * 12 / 14)',
                padding: '12px 14px',
                fontSize: 14,
                fontWeight: 600,
                color: '#A3271F',
              }}
            >
              {hata}
            </p>
          ) : null}

          {doldu ? (
            <div
              role="status"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px 16px',
                background: '#FFF6DF',
                border: '1px solid #F4DC9A',
                borderRadius: 'calc(var(--rr-kart-kose) * 16 / 18)',
                padding: '14px 18px',
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 14.5 }}>
                <strong>{doldu.baslik} talebinin süresi doldu.</strong> Ücretsiz uzatma hakkın duruyor;{' '}
                {doldu.category.slug === 'hava' ? 90 : 30} gün daha yayında kalabilir.
              </span>
              <button
                type="button"
                disabled={busy === doldu.id}
                onClick={() =>
                  islem(doldu, 'extend', `${doldu.baslik} talebi uzatıldı.`, undefined, 'yayinda')
                }
                style={{ ...btn('var(--rr-sari, #FFC84A)'), padding: '9px 14px' }}
              >
                Ücretsiz uzat
              </button>
            </div>
          ) : null}

          <div
            role="tablist"
            aria-label="Talep durumu"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              background: 'var(--rr-kart, #FFFFFF)',
              border: '1px solid var(--rr-cizgi, #E3E6EF)',
              borderRadius: 'var(--rr-buton-kose)',
              padding: 6,
              marginBottom: 16,
            }}
          >
            {SEKMELER.map(([k, ad]) => {
              const on = sekme === k;
              return (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setSekme(k)}
                  style={{
                    flex: '1 1 140px',
                    border: 0,
                    background: on ? '#EEF3FF' : 'transparent',
                    borderRadius: 'calc(var(--rr-buton-kose) * 10 / 14)',
                    padding: '11px 12px',
                    fontSize: 14.5,
                    fontWeight: on ? 800 : 600,
                    color: on ? 'var(--rr-murekkep, #1E2333)' : '#3A4052',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {ad}{' '}
                  <span style={{ color: on ? 'var(--rr-baglanti, #2450C8)' : 'var(--rr-soluk, #5A6073)' }}>
                    {sayilar[k]}
                  </span>
                </button>
              );
            })}
          </div>

          {liste !== null && gorunen.length === 0 ? (
            <div
              style={{
                background: 'var(--rr-kart, #FFFFFF)',
                border: '1px dashed #C9CFDB',
                borderRadius: 'var(--rr-kart-kose)',
                padding: '40px 20px',
                textAlign: 'center',
                fontSize: 15,
                color: 'var(--rr-soluk, #5A6073)',
              }}
            >
              Bu bölümde talep yok.
              {liste.length === 0 ? (
                <>
                  {' '}
                  <Link href="/talep-olustur">İlk talebini oluştur</Link>
                </>
              ) : null}
            </div>
          ) : null}
          {liste === null ? <p style={{ color: 'var(--rr-soluk, #5A6073)' }}>Yükleniyor…</p> : null}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {gorunen.map((t, i) => {
              const [durum, dBg, dFg] = ETIKET[t.status];
              const ink = DOTS[i % DOTS.length] as string;
              const ucretsiz = !t.freeExtensionUsed;
              return (
                <article
                  key={t.id}
                  style={{
                    background: 'var(--rr-kart, #FFFFFF)',
                    border: '1px solid var(--rr-cizgi, #E3E6EF)',
                    borderRadius: 'var(--rr-kart-kose)',
                    padding: 18,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 16,
                  }}
                >
                  <div
                    aria-hidden="true"
                    style={{
                      flex: '0 0 150px',
                      height: 100,
                      borderRadius: 'var(--rr-buton-kose)',
                      background:
                        t.status === 'COMPLETED' || t.status === 'CLOSED'
                          ? '#F3F5FA'
                          : TINTS[i % TINTS.length],
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg width="112" height="46" viewBox="0 0 112 46" fill="none" aria-hidden="true">
                      <path
                        d="M8 34c0-6 4-9 10-10l14-10c4-3 8-4 13-4h22c6 0 10 2 14 6l8 8c8 1 15 3 15 10v4H8z"
                        style={{ fill: t.status === 'COMPLETED' || t.status === 'CLOSED' ? '#AEB5C4' : ink }}
                        opacity="0.85"
                      />
                      <circle cx="30" cy="38" r="7" fill="#1E2333" />
                      <circle cx="84" cy="38" r="7" fill="#1E2333" />
                      <circle cx="30" cy="38" r="3" fill="#FFFFFF" />
                      <circle cx="84" cy="38" r="3" fill="#FFFFFF" />
                    </svg>
                  </div>
                  <div style={{ flex: '999 1 300px', minWidth: 0 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 8px' }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          padding: '3px 9px',
                          borderRadius: 'var(--rr-etiket-kose)',
                          background: dBg,
                          color: dFg,
                        }}
                      >
                        {durum}
                      </span>
                      <span style={{ fontSize: 12.5, color: 'var(--rr-soluk, #5A6073)' }}>
                        {t.category.name} · {t.status === 'DRAFT' ? 'Taslak' : `No ${t.no}`}
                      </span>
                      {t.galeri ? (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 800,
                            padding: '3px 9px',
                            borderRadius: 'var(--rr-etiket-kose)',
                            background: '#FFF6DF',
                            color: '#7A5300',
                          }}
                        >
                          {t.galeri.ad} adına
                        </span>
                      ) : null}
                    </div>
                    <h2 style={{ margin: '6px 0 2px', fontSize: 18, fontWeight: 800 }}>
                      {t.status === 'DRAFT' ? (
                        t.baslik
                      ) : (
                        <Link href={`/talep/${t.no}`} style={{ color: 'var(--rr-murekkep, #1E2333)' }}>
                          {t.baslik}
                        </Link>
                      )}
                    </h2>
                    <p style={{ margin: 0, fontSize: 14, color: '#3A4052' }}>
                      {t.status === 'DRAFT'
                        ? `Taslak · 6 adımın ${Math.max(0, t.step - 1)}’i tamam`
                        : ozet(t)}
                    </p>
                    <p
                      style={{
                        margin: '6px 0 0',
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: t.status === 'PASSIVE' ? '#7A5300' : 'var(--rr-soluk, #5A6073)',
                      }}
                    >
                      {sure(t)}
                    </p>
                    {t.status !== 'DRAFT' && t.istatistik ? (
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '6px 18px',
                          marginTop: 10,
                          fontSize: 13.5,
                          color: '#3A4052',
                        }}
                      >
                        <span>
                          <strong style={{ color: 'var(--rr-murekkep, #1E2333)' }}>
                            {binlik(t.istatistik.goruntu)}
                          </strong>{' '}
                          görüntülenme
                        </span>
                        <span>
                          <strong style={{ color: 'var(--rr-murekkep, #1E2333)' }}>
                            {binlik(t.istatistik.favori)}
                          </strong>{' '}
                          favori
                        </span>
                        <Link href="/mesajlarim" style={{ color: 'var(--rr-baglanti, #2450C8)' }}>
                          <strong>{binlik(t.istatistik.mesaj)}</strong> mesaj
                        </Link>
                        <span>
                          <strong style={{ color: 'var(--rr-murekkep, #1E2333)' }}>
                            {binlik(t.istatistik.eslesen)}
                          </strong>{' '}
                          uyan portföy aracı
                        </span>
                      </div>
                    ) : null}
                    {t.duzeltme ? (
                      <p
                        role="status"
                        style={{
                          margin: '8px 0 0',
                          padding: '8px 12px',
                          borderRadius: 'calc(var(--rr-buton-kose) * 10 / 14)',
                          background: '#FFF6DF',
                          border: '1px solid #F4DC9A',
                          fontSize: 13,
                          fontWeight: 600,
                          color: '#7A5300',
                          lineHeight: 1.45,
                        }}
                      >
                        {t.duzeltme.alanlar.length
                          ? `Düzeltme gerekiyor: talebinde ${birlestir(t.duzeltme.alanlar)} var. Talebin yayında, bu bilgiler başkalarına gizli gösteriliyor. `
                          : ''}
                        {t.duzeltme.not ? `Destek ekibinin notu: ${t.duzeltme.not} ` : ''}
                        <Link
                          href={`/talep-olustur?id=${t.id}`}
                          style={{ color: '#7A5300', fontWeight: 800 }}
                        >
                          Düzenle
                        </Link>
                      </p>
                    ) : null}
                  </div>
                  <div
                    style={{
                      flex: '1 1 180px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      justifyContent: 'center',
                    }}
                  >
                    {t.status === 'PUBLISHED' ? (
                      <>
                        <button
                          type="button"
                          disabled={busy === t.id}
                          onClick={() => setDlg(t)}
                          style={btn('var(--rr-yesil, #3DD68C)')}
                        >
                          Aracı buldum
                        </button>
                        <Link href={`/talep-olustur?id=${t.id}`} style={cizgili}>
                          Düzenle
                        </Link>
                        {(['ust_sira', 'acil', 'vitrin'] as const)
                          .filter((k) => (t.oneCikarmaHakki[k] ?? 0) > 0)
                          .map((k) => (
                            <button
                              key={k}
                              type="button"
                              disabled={busy === t.id}
                              onClick={() =>
                                islem(t, 'promote', `${PROMOTION_NAMES[k]} 7 gün uygulandı.`, { tur: k })
                              }
                              style={yalin('var(--rr-baglanti, #2450C8)')}
                            >
                              {PROMOTION_NAMES[k]} · hakkını kullan ({t.oneCikarmaHakki[k]})
                            </button>
                          ))}
                        {gunKaldi(t.expiresAt) <= 7 ? (
                          <button
                            type="button"
                            disabled={busy === t.id || (!ucretsiz && (haklar?.uzatma ?? 0) < 1)}
                            onClick={() => islem(t, 'extend', 'Talep uzatıldı.')}
                            style={yalin('var(--rr-baglanti, #2450C8)')}
                          >
                            {ucretsiz
                              ? 'Ücretsiz uzat'
                              : `Uzat · ${fiyat('uzatma', BIREYSEL_FIYATLAR.uzatma.tl)} TL`}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={busy === t.id}
                          onClick={() =>
                            islem(
                              t,
                              'passivate',
                              'Talep pasife alındı. Satıcılar artık göremez.',
                              undefined,
                              'pasif',
                            )
                          }
                          style={yalin('var(--rr-soluk, #5A6073)')}
                        >
                          Pasife al
                        </button>
                      </>
                    ) : null}
                    {t.status === 'PASSIVE' ? (
                      <>
                        {moderasyon(t) ? (
                          <Link href="/bildirimler" style={cizgili}>
                            Kararı gör
                          </Link>
                        ) : sureDoldu(t) ? (
                          <button
                            type="button"
                            disabled={busy === t.id || (!ucretsiz && (haklar?.uzatma ?? 0) < 1)}
                            title={
                              !ucretsiz && (haklar?.uzatma ?? 0) < 1
                                ? 'Ücretli uzatma ödeme altyapısıyla açılacak'
                                : undefined
                            }
                            onClick={() => islem(t, 'extend', 'Talep yeniden yayında.', undefined, 'yayinda')}
                            style={{
                              ...btn('var(--rr-mavi, #5B8CFF)'),
                              opacity: !ucretsiz && (haklar?.uzatma ?? 0) < 1 ? 0.55 : 1,
                            }}
                          >
                            {ucretsiz
                              ? 'Ücretsiz uzat · 30 gün'
                              : `Uzat · ${fiyat('uzatma', BIREYSEL_FIYATLAR.uzatma.tl)} TL`}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy === t.id}
                            onClick={() =>
                              islem(t, 'activate', 'Talep yeniden yayında.', undefined, 'yayinda')
                            }
                            style={btn('var(--rr-mavi, #5B8CFF)')}
                          >
                            Yeniden yayınla
                          </button>
                        )}
                        <Link href={`/talep-olustur?id=${t.id}`} style={cizgili}>
                          Düzenle
                        </Link>
                        <button
                          type="button"
                          disabled={busy === t.id}
                          onClick={() => {
                            if (
                              window.confirm('Talep kapatılsın mı? Kapatılan talep yeniden yayınlanamaz.')
                            ) {
                              islem(t, 'close', 'Talep kapatıldı.', undefined, 'bitti');
                            }
                          }}
                          style={yalin('#A3271F')}
                        >
                          Talebi kapat
                        </button>
                      </>
                    ) : null}
                    {t.status === 'DRAFT' ? (
                      <>
                        <Link
                          href={`/talep-olustur?id=${t.id}`}
                          style={{
                            ...cizgili,
                            border: 0,
                            background: 'var(--rr-mavi, #5B8CFF)',
                            color: 'var(--rr-maviYazi, #1E2333)',
                            fontWeight: 800,
                          }}
                        >
                          Kaldığın yerden devam et
                        </Link>
                        {haklar && haklar.talep < 1 ? (
                          <span
                            style={{
                              display: 'block',
                              textAlign: 'center',
                              fontSize: 13,
                              fontWeight: 600,
                              color: 'var(--rr-baglanti, #2450C8)',
                            }}
                          >
                            Yayınlamak için talep hakkı gerekiyor
                          </span>
                        ) : null}
                        <button
                          type="button"
                          disabled={busy === t.id}
                          onClick={() => {
                            if (window.confirm('Taslak silinsin mi?')) islem(t, 'close', 'Taslak silindi.');
                          }}
                          style={yalin('var(--rr-soluk, #5A6073)')}
                        >
                          Taslağı sil
                        </button>
                      </>
                    ) : null}
                    {t.status === 'COMPLETED' || t.status === 'CLOSED' ? (
                      <Link href="/talep-olustur" style={cizgili}>
                        Benzerini oluştur
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </main>
      </div>

      {dlg ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(30,35,51,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            zIndex: 10,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dlgb"
            style={{
              width: '100%',
              maxWidth: 480,
              background: 'var(--rr-kart, #FFFFFF)',
              borderRadius: 'calc(var(--rr-kart-kose) * 20 / 18)',
              padding: 24,
            }}
          >
            <h2 id="dlgb" style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800 }}>
              Tebrikler! Aracı nereden buldun?
            </h2>
            <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--rr-soluk, #5A6073)' }}>
              {dlg.baslik} talebi kapanacak ve satıcılar artık mesaj gönderemeyecek. Mevcut sohbetlerin açık
              kalır.
            </p>
            <div
              role="radiogroup"
              aria-label="Aracı nereden buldun"
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              {FOUND_VIA.map((o) => {
                const on = secim === o.key;
                return (
                  // biome-ignore lint/a11y/useSemanticElements: tasarımdaki gibi radyo düğmesi görünümlü seçenek
                  <button
                    key={o.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setSecim(o.key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      textAlign: 'left',
                      border: on ? '1.5px solid var(--rr-mavi, #5B8CFF)' : '1px solid #D5DAE5',
                      background: on ? '#EEF3FF' : 'var(--rr-kart, #FFFFFF)',
                      borderRadius: 'calc(var(--rr-buton-kose) * 12 / 14)',
                      padding: '12px 14px',
                      fontSize: 14.5,
                      fontWeight: 600,
                      color: 'var(--rr-murekkep, #1E2333)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <span
                      style={{
                        flex: 'none',
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        border: `2px solid ${on ? 'var(--rr-mavi, #5B8CFF)' : '#AEB5C4'}`,
                        boxShadow: 'inset 0 0 0 3px #FFFFFF',
                        background: on ? 'var(--rr-mavi, #5B8CFF)' : '#FFFFFF',
                        color: on ? 'var(--rr-maviYazi, #1E2333)' : undefined,
                      }}
                    />
                    {o.ad}
                  </button>
                );
              })}
            </div>
            <p style={{ margin: '12px 0 0', fontSize: 12.5, color: 'var(--rr-soluk, #5A6073)' }}>
              Bu bilgi yalnızca hizmeti iyileştirmek için kullanılır, satıcıya gösterilmez.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button
                type="button"
                onClick={() => setDlg(null)}
                style={{
                  border: '1px solid #D5DAE5',
                  background: 'var(--rr-kart, #FFFFFF)',
                  borderRadius: 'calc(var(--rr-buton-kose) * 12 / 14)',
                  padding: '11px 16px',
                  fontSize: 14.5,
                  fontWeight: 700,
                  color: 'var(--rr-murekkep, #1E2333)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={busy === dlg.id}
                onClick={() =>
                  islem(dlg, 'complete', 'Talep kapatıldı. Hayırlı olsun!', { foundVia: secim }, 'bitti')
                }
                style={{
                  ...btn('var(--rr-yesil, #3DD68C)'),
                  borderRadius: 'calc(var(--rr-buton-kose) * 12 / 14)',
                  padding: '11px 18px',
                  fontSize: 14.5,
                }}
              >
                Talebi kapat
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          role="status"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 28,
            transform: 'translateX(-50%)',
            background: 'var(--rr-murekkep, #1E2333)',
            color: '#FFFFFF',
            borderRadius: 'var(--rr-buton-kose)',
            padding: '13px 18px',
            fontSize: 14.5,
            fontWeight: 600,
            zIndex: 11,
          }}
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
