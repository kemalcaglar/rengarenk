'use client';

import { BIREYSEL_FIYATLAR, DOTS, FOUND_VIA, type FoundViaKey } from '@rengarenk/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type CSSProperties, useCallback, useEffect, useState } from 'react';
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
  COMPLETED: ['Tamamlandı', '#EEF3FF', '#2450C8'],
  CLOSED: ['Kapatıldı', '#F3F5FA', '#3A4052'],
};
const TINTS = ['#EEF3FF', '#FFEEF6', '#FFF6DF', '#E7FAF0', '#F3EFFF', '#FFF0EA'];
const HESABIM = ['Mesajlarım', 'Favoriler ve aramalar', 'Haklarım ve ödemeler', 'Ayarlar', 'Yardım'];

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

function sure(t: Talep) {
  if (t.status === 'PUBLISHED') return `Yayında · ${gunKaldi(t.expiresAt)} gün kaldı`;
  if (t.status === 'PASSIVE')
    return sureDoldu(t)
      ? `Süresi ${tarih(t.expiresAt)}’da doldu`
      : 'Pasife alındı · istediğin zaman yeniden yayınlayabilirsin';
  if (t.status === 'DRAFT') return `Son düzenleme ${tarih(t.updatedAt)}`;
  return `${t.status === 'COMPLETED' ? 'Tamamlandı' : 'Kapatıldı'} · ${tarih(t.closedAt, true)}`;
}

/** Taleplerim (tasarım: Taleplerim.dc.html; Karar 09, 10, 31): durum sekmeleri, süre ve talebin işlemleri. */
export default function Taleplerim() {
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
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 14,
    fontWeight: 800,
    color: '#1E2333',
    cursor: 'pointer',
    fontFamily: 'inherit',
  });
  const cizgili: CSSProperties = {
    display: 'block',
    textAlign: 'center',
    border: '1px solid #D5DAE5',
    borderRadius: 10,
    padding: '9px 12px',
    fontSize: 14,
    fontWeight: 700,
    color: '#1E2333',
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
        <nav
          aria-label="Hesabım"
          style={{
            flex: '1 1 220px',
            maxWidth: 250,
            minWidth: 0,
            background: '#FFFFFF',
            border: '1px solid #E3E6EF',
            borderRadius: 18,
            padding: 12,
          }}
        >
          <span
            style={{
              display: 'block',
              padding: '8px 10px 10px',
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              color: '#5A6073',
            }}
          >
            Hesabım
          </span>
          <Link
            href="/taleplerim"
            aria-current="page"
            style={{
              display: 'block',
              background: '#EEF3FF',
              borderRadius: 12,
              padding: '11px 12px',
              fontSize: 14.5,
              fontWeight: 800,
              color: '#1E2333',
              textDecoration: 'none',
            }}
          >
            Taleplerim
          </Link>
          {/* Diğer hesap ekranları kendi modülleriyle gelir; o zamana kadar soluk ve tıklanmaz */}
          {HESABIM.map((ad) => (
            <span
              key={ad}
              style={{
                display: 'block',
                borderRadius: 12,
                padding: '11px 12px',
                fontSize: 14.5,
                fontWeight: 600,
                color: '#8A91A3',
              }}
            >
              {ad}
            </span>
          ))}
        </nav>

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
              <p style={{ margin: '4px 0 0', fontSize: 14.5, color: '#5A6073' }}>
                Kalan talep hakkın: <strong style={{ color: '#1E2333' }}>{hak}</strong>
                {haklar && haklar.talep === 0
                  ? ` · ek talep ${BIREYSEL_FIYATLAR.ekTalep.tl} TL (ödeme altyapısı açılınca)`
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
                borderRadius: 12,
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
                borderRadius: 16,
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
                style={{ ...btn('#FFC84A'), padding: '9px 14px' }}
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
              background: '#FFFFFF',
              border: '1px solid #E3E6EF',
              borderRadius: 14,
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
                    borderRadius: 10,
                    padding: '11px 12px',
                    fontSize: 14.5,
                    fontWeight: on ? 800 : 600,
                    color: on ? '#1E2333' : '#3A4052',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {ad} <span style={{ color: on ? '#2450C8' : '#5A6073' }}>{sayilar[k]}</span>
                </button>
              );
            })}
          </div>

          {liste !== null && gorunen.length === 0 ? (
            <div
              style={{
                background: '#FFFFFF',
                border: '1px dashed #C9CFDB',
                borderRadius: 18,
                padding: '40px 20px',
                textAlign: 'center',
                fontSize: 15,
                color: '#5A6073',
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
          {liste === null ? <p style={{ color: '#5A6073' }}>Yükleniyor…</p> : null}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {gorunen.map((t, i) => {
              const [durum, dBg, dFg] = ETIKET[t.status];
              const ink = DOTS[i % DOTS.length] as string;
              const ucretsiz = !t.freeExtensionUsed;
              return (
                <article
                  key={t.id}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E3E6EF',
                    borderRadius: 18,
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
                      borderRadius: 14,
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
                        fill={t.status === 'COMPLETED' || t.status === 'CLOSED' ? '#AEB5C4' : ink}
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
                          borderRadius: 999,
                          background: dBg,
                          color: dFg,
                        }}
                      >
                        {durum}
                      </span>
                      <span style={{ fontSize: 12.5, color: '#5A6073' }}>
                        {t.category.name} · {t.status === 'DRAFT' ? 'Taslak' : `No ${t.no}`}
                      </span>
                    </div>
                    <h2 style={{ margin: '6px 0 2px', fontSize: 18, fontWeight: 800 }}>
                      {t.status === 'DRAFT' ? (
                        t.baslik
                      ) : (
                        <Link href={`/talep/${t.no}`} style={{ color: '#1E2333' }}>
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
                        color: t.status === 'PASSIVE' ? '#7A5300' : '#5A6073',
                      }}
                    >
                      {sure(t)}
                    </p>
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
                          style={btn('#3DD68C')}
                        >
                          Aracı buldum
                        </button>
                        <Link href={`/talep-olustur?id=${t.id}`} style={cizgili}>
                          Düzenle
                        </Link>
                        {gunKaldi(t.expiresAt) <= 7 ? (
                          <button
                            type="button"
                            disabled={busy === t.id || (!ucretsiz && (haklar?.uzatma ?? 0) < 1)}
                            onClick={() => islem(t, 'extend', 'Talep uzatıldı.')}
                            style={yalin('#2450C8')}
                          >
                            {ucretsiz ? 'Ücretsiz uzat' : `Uzat · ${BIREYSEL_FIYATLAR.uzatma.tl} TL`}
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
                          style={yalin('#5A6073')}
                        >
                          Pasife al
                        </button>
                      </>
                    ) : null}
                    {t.status === 'PASSIVE' ? (
                      <>
                        {sureDoldu(t) ? (
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
                              ...btn('#5B8CFF'),
                              opacity: !ucretsiz && (haklar?.uzatma ?? 0) < 1 ? 0.55 : 1,
                            }}
                          >
                            {ucretsiz ? 'Ücretsiz uzat · 30 gün' : `Uzat · ${BIREYSEL_FIYATLAR.uzatma.tl} TL`}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy === t.id}
                            onClick={() =>
                              islem(t, 'activate', 'Talep yeniden yayında.', undefined, 'yayinda')
                            }
                            style={btn('#5B8CFF')}
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
                          style={{ ...cizgili, border: 0, background: '#5B8CFF', fontWeight: 800 }}
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
                              color: '#2450C8',
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
                          style={yalin('#5A6073')}
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
            style={{ width: '100%', maxWidth: 480, background: '#FFFFFF', borderRadius: 20, padding: 24 }}
          >
            <h2 id="dlgb" style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800 }}>
              Tebrikler! Aracı nereden buldun?
            </h2>
            <p style={{ margin: '0 0 16px', fontSize: 14, color: '#5A6073' }}>
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
                      border: on ? '1.5px solid #5B8CFF' : '1px solid #D5DAE5',
                      background: on ? '#EEF3FF' : '#FFFFFF',
                      borderRadius: 12,
                      padding: '12px 14px',
                      fontSize: 14.5,
                      fontWeight: 600,
                      color: '#1E2333',
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
                        border: `2px solid ${on ? '#5B8CFF' : '#AEB5C4'}`,
                        boxShadow: 'inset 0 0 0 3px #FFFFFF',
                        background: on ? '#5B8CFF' : '#FFFFFF',
                      }}
                    />
                    {o.ad}
                  </button>
                );
              })}
            </div>
            <p style={{ margin: '12px 0 0', fontSize: 12.5, color: '#5A6073' }}>
              Bu bilgi yalnızca hizmeti iyileştirmek için kullanılır, satıcıya gösterilmez.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button
                type="button"
                onClick={() => setDlg(null)}
                style={{
                  border: '1px solid #D5DAE5',
                  background: '#FFFFFF',
                  borderRadius: 12,
                  padding: '11px 16px',
                  fontSize: 14.5,
                  fontWeight: 700,
                  color: '#1E2333',
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
                style={{ ...btn('#3DD68C'), borderRadius: 12, padding: '11px 18px', fontSize: 14.5 }}
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
            background: '#1E2333',
            color: '#FFFFFF',
            borderRadius: 14,
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
