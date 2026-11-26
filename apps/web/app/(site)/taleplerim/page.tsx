'use client';

import { BIREYSEL_FIYATLAR, DOTS, FOUND_VIA, type FoundViaKey, PROMOTION_NAMES } from '@rengarenk/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { HesabimMenu } from '../../../components/hesabim-menu';
import { cx } from '../../../lib/cx';
import { useWebFiyat } from '../../../lib/fiyat';
import { binlik, istek, useGiris } from '../../../lib/istemci';
import stil from './page.module.css';

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
    <div className={stil.kutu1}>
      <div className={`rr-sayfa ${stil.kutu2}`}>
        <HesabimMenu aktif="/taleplerim" />

        <main className={stil.kutu3}>
          <div className={stil.kutu4}>
            <div>
              <h1 className={stil.baslik1}>Taleplerim</h1>
              <p className={stil.metin1}>
                Kalan talep hakkın: <strong className={stil.metin2}>{hak}</strong>
                {haklar && haklar.talep === 0
                  ? ` · ek talep ${fiyat('ek_talep', BIREYSEL_FIYATLAR.ekTalep.tl)} TL (ödeme altyapısı açılınca)`
                  : ''}
              </p>
            </div>
          </div>

          {hata ? (
            <p role="alert" className={stil.metin3}>
              {hata}
            </p>
          ) : null}

          {doldu ? (
            <div role="status" className={stil.kutu5}>
              <span className={stil.metin4}>
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

          <div role="tablist" aria-label="Talep durumu" className={stil.kutu6}>
            {SEKMELER.map(([k, ad]) => {
              const on = sekme === k;
              return (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setSekme(k)}
                  className={cx(stil.dugme1, on ? stil.dugme2 : stil.dugme3)}
                >
                  {ad} <span className={cx(on ? stil.metin5 : stil.metin6)}>{sayilar[k]}</span>
                </button>
              );
            })}
          </div>

          {liste !== null && gorunen.length === 0 ? (
            <div className={stil.kutu7}>
              Bu bölümde talep yok.
              {liste.length === 0 ? (
                <>
                  {' '}
                  <Link href="/talep-olustur">İlk talebini oluştur</Link>
                </>
              ) : null}
            </div>
          ) : null}
          {liste === null ? <p className={stil.metin6}>Yükleniyor…</p> : null}

          <div className={stil.kutu8}>
            {gorunen.map((t, i) => {
              const [durum, dBg, dFg] = ETIKET[t.status];
              const ink = DOTS[i % DOTS.length] as string;
              const ucretsiz = !t.freeExtensionUsed;
              return (
                <article key={t.id} className={stil.kutu9}>
                  <div
                    aria-hidden="true"
                    className={stil.kutu10}
                    style={{
                      background:
                        t.status === 'COMPLETED' || t.status === 'CLOSED'
                          ? '#F3F5FA'
                          : TINTS[i % TINTS.length],
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
                  <div className={stil.kutu11}>
                    <div className={stil.kutu12}>
                      <span className={stil.metin7} style={{ background: dBg, color: dFg }}>
                        {durum}
                      </span>
                      <span className={stil.metin8}>
                        {t.category.name} · {t.status === 'DRAFT' ? 'Taslak' : `No ${t.no}`}
                      </span>
                      {t.galeri ? <span className={stil.metin9}>{t.galeri.ad} adına</span> : null}
                    </div>
                    <h2 className={stil.baslik2}>
                      {t.status === 'DRAFT' ? (
                        t.baslik
                      ) : (
                        <Link href={`/talep/${t.no}`} className={stil.metin2}>
                          {t.baslik}
                        </Link>
                      )}
                    </h2>
                    <p className={stil.metin10}>
                      {t.status === 'DRAFT'
                        ? `Taslak · 6 adımın ${Math.max(0, t.step - 1)}’i tamam`
                        : ozet(t)}
                    </p>
                    <p className={cx(stil.metin11, t.status === 'PASSIVE' ? stil.metin12 : stil.metin6)}>
                      {sure(t)}
                    </p>
                    {t.status !== 'DRAFT' && t.istatistik ? (
                      <div className={stil.kutu13}>
                        <span>
                          <strong className={stil.metin2}>{binlik(t.istatistik.goruntu)}</strong> görüntülenme
                        </span>
                        <span>
                          <strong className={stil.metin2}>{binlik(t.istatistik.favori)}</strong> favori
                        </span>
                        <Link href="/mesajlarim" className={stil.metin5}>
                          <strong>{binlik(t.istatistik.mesaj)}</strong> mesaj
                        </Link>
                        <span>
                          <strong className={stil.metin2}>{binlik(t.istatistik.eslesen)}</strong> uyan portföy
                          aracı
                        </span>
                      </div>
                    ) : null}
                    {t.duzeltme ? (
                      <p role="status" className={stil.metin13}>
                        {t.duzeltme.alanlar.length
                          ? `Düzeltme gerekiyor: talebinde ${birlestir(t.duzeltme.alanlar)} var. Talebin yayında, bu bilgiler başkalarına gizli gösteriliyor. `
                          : ''}
                        {t.duzeltme.not ? `Destek ekibinin notu: ${t.duzeltme.not} ` : ''}
                        <Link href={`/talep-olustur?id=${t.id}`} className={stil.bag1}>
                          Düzenle
                        </Link>
                      </p>
                    ) : null}
                  </div>
                  <div className={stil.kutu14}>
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
                        <Link href={`/talep-olustur?id=${t.id}`} className={stil.bag2}>
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
                          <Link href="/bildirimler" className={stil.bag2}>
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
                        <Link href={`/talep-olustur?id=${t.id}`} className={stil.bag2}>
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
                        <Link href={`/talep-olustur?id=${t.id}`} className={stil.bag3}>
                          Kaldığın yerden devam et
                        </Link>
                        {haklar && haklar.talep < 1 ? (
                          <span className={stil.metin14}>Yayınlamak için talep hakkı gerekiyor</span>
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
                      <Link href="/talep-olustur" className={stil.bag2}>
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
        <div className={stil.kutu15}>
          <div role="dialog" aria-modal="true" aria-labelledby="dlgb" className={stil.kutu16}>
            <h2 id="dlgb" className={stil.baslik3}>
              Tebrikler! Aracı nereden buldun?
            </h2>
            <p className={stil.metin15}>
              {dlg.baslik} talebi kapanacak ve satıcılar artık mesaj gönderemeyecek. Mevcut sohbetlerin açık
              kalır.
            </p>
            <div role="radiogroup" aria-label="Aracı nereden buldun" className={stil.kutu17}>
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
                    className={cx(stil.dugme4, on ? stil.dugme5 : stil.dugme6)}
                  >
                    <span
                      className={cx(stil.metin16, on ? stil.metin17 : stil.metin18)}
                      style={{ border: `2px solid ${on ? 'var(--rr-mavi, #5B8CFF)' : '#AEB5C4'}` }}
                    />
                    {o.ad}
                  </button>
                );
              })}
            </div>
            <p className={stil.metin19}>
              Bu bilgi yalnızca hizmeti iyileştirmek için kullanılır, satıcıya gösterilmez.
            </p>
            <div className={stil.kutu18}>
              <button type="button" onClick={() => setDlg(null)} className={stil.dugme7}>
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
        <div role="status" className={stil.kutu19}>
          {toast}
        </div>
      ) : null}
    </div>
  );
}
