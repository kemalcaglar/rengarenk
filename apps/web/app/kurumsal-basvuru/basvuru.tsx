'use client';

import {
  APPLICATION_STEPS,
  BUSINESS_KIND_DEFS,
  BUSINESS_KINDS,
  type BusinessKindKey,
  GALLERY_TRIAL,
  type GalleryApplicationDraft,
  galleryApplicationSchema,
  ILLER,
  maskTrMobile,
} from '@rengarenk/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { ApiHatasi, dosyaYukle, istek, useGiris } from '../../lib/istemci';

type Durum = 'DRAFT' | 'SUBMITTED' | 'IN_REVIEW' | 'DOCS_REQUESTED' | 'APPROVED' | 'REJECTED' | 'REVOKED';
interface Basvuru {
  id: string;
  durum: Durum;
  veri: GalleryApplicationDraft;
  belgeler: { id: string; kind: string; ad: string; boyut: number; yuklendi: string }[];
  gonderildi: string | null;
  kontrolEdildi: string | null;
  yetki: 'gecti' | 'kaldi' | 'uyari' | 'yapilamadi' | null;
  not: string | null;
  galeri: { accountId: string; slug: string } | null;
}
interface Dogrulama {
  sonuc: 'gecti' | 'kaldi' | 'uyari' | 'yapilamadi';
  not?: string;
  unvan?: string;
  il?: string;
}

const girdi: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #D5DAE5',
  borderRadius: 12,
  padding: 12,
  fontSize: 15,
  fontFamily: 'inherit',
  color: '#1E2333',
  background: '#FFFFFF',
};
const etiket: CSSProperties = { display: 'block', fontSize: 13.5, fontWeight: 700, marginBottom: 6 };

const ALAN2: { id: keyof GalleryApplicationDraft; label: string; ipucu?: string; mod?: 'numeric' }[] = [
  { id: 'unvan', label: 'Ticari unvan' },
  { id: 'gorunenAd', label: 'Platformda görünecek ad' },
  { id: 'vergiNo', label: 'Vergi numarası', mod: 'numeric' },
  { id: 'vergiDairesi', label: 'Vergi dairesi' },
  { id: 'mersis', label: 'MERSİS numarası', mod: 'numeric' },
];

const saat = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('tr-TR', {
        timeZone: 'Europe/Istanbul',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso))
    : '';

/** "Selin Yıldız" → ad "Selin", soyad "Yıldız" (tasarımda tek "Ad soyad" alanı) */
const adBol = (s: string) => {
  const p = s.trim().split(/\s+/);
  return p.length < 2
    ? { ad: p[0] ?? '', soyad: '' }
    : { ad: p.slice(0, -1).join(' '), soyad: p.at(-1) as string };
};

/**
 * Kurumsal hesap başvurusu (tasarım: Basvuru.dc.html; Karar 03, 12.5, 17). Taslak her adımda kaydedilir; belgeler
 * özel depoya yüklenir. Gönderildikten sonra sayfa durum zaman çizelgesine döner. Tasarımdan fark: adres il, ilçe ve
 * açık adres olarak üç alan (konum listeyle doğrulanır).
 */
export function KurumsalBasvuru() {
  const giris = useGiris();
  const router = useRouter();
  const [b, setB] = useState<Basvuru | null | undefined>(undefined);
  const [adim, setAdim] = useState(1);
  const [veri, setVeri] = useState<GalleryApplicationDraft>({});
  const [adSoyad, setAdSoyad] = useState('');
  const [telefon, setTelefon] = useState('');
  const [sozlesme, setSozlesme] = useState(false);
  const [ticariIleti, setTicariIleti] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [kaydedildi, setKaydedildi] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [dogru, setDogru] = useState<Dogrulama | null>(null);
  const dosyaRef = useRef<HTMLInputElement>(null);
  // Seçilen dosyanın hangi belge türüne ait olduğu (dosya penceresi açılmadan önce yazılır)
  const hedefBelge = useRef<string | null>(null);

  const al = useCallback(async () => {
    const r = await istek<Basvuru | null>('/gallery-applications/me');
    setB(r);
    if (r) {
      setVeri(r.veri);
      setAdSoyad([r.veri.sahip?.ad, r.veri.sahip?.soyad].filter(Boolean).join(' '));
      if (r.durum === 'DOCS_REQUESTED') setAdim(3);
    }
    return r;
  }, []);

  useEffect(() => {
    if (giris === false) router.replace('/giris?sonra=/kurumsal-basvuru');
    if (!giris) return;
    al().catch((e: Error) => setHata(e.message));
    istek<{ phone: string }>('/me')
      .then((m) => setTelefon(maskTrMobile(m.phone)))
      .catch(() => undefined);
  }, [giris, router, al]);

  // Kontroller işçide birkaç saniye sürer; bu arada durum yenilenir
  useEffect(() => {
    if (b?.durum !== 'SUBMITTED') return;
    const t = setInterval(() => al().catch(() => undefined), 4000);
    return () => clearInterval(t);
  }, [b?.durum, al]);

  const duzenlenebilir = !b || b.durum === 'DRAFT' || b.durum === 'DOCS_REQUESTED';
  const tur = veri.tur ? BUSINESS_KIND_DEFS[veri.tur] : null;

  async function kaydet(ek: Partial<GalleryApplicationDraft> = {}) {
    const dolu = <T extends object>(o: T) =>
      Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== undefined && v !== null));
    const sahip = dolu({ ...veri.sahip, ...adBol(adSoyad), ...ek.sahip });
    const temiz = dolu({ ...veri, ...ek, sahip: Object.keys(sahip).length ? sahip : undefined });
    const r = await istek<Basvuru>('/gallery-applications/me', { method: 'PATCH', body: temiz });
    setB(r);
    setKaydedildi(true);
    return r;
  }

  const set = (k: keyof GalleryApplicationDraft, v: string) => {
    setVeri((x) => ({ ...x, [k]: v }));
    setKaydedildi(false);
  };

  /** Adımın eksiğini döner; sonraki adıma geçmeden ve gönderimden önce bakılır */
  function eksik(n: number): string | null {
    const tam = galleryApplicationSchema.safeParse({ ...veri, sahip: { ...veri.sahip, ...adBol(adSoyad) } });
    const ilk = (yollar: string[]) =>
      tam.success
        ? null
        : (tam.error.issues.find((i) => yollar.includes(String(i.path[0])))?.message ?? null);
    if (n === 1) return veri.tur ? null : 'İşletme türünü seç';
    if (n === 2)
      return ilk(['unvan', 'gorunenAd', 'vergiNo', 'vergiDairesi', 'mersis', 'il', 'ilce', 'adres']);
    if (n === 3) {
      const y = ilk(['yetkiNo']);
      if (y) return y;
      const yok = tur?.belgeler.find((d) => d.zorunlu && !b?.belgeler.some((x) => x.kind === d.key));
      return yok ? `${yok.ad} yükle` : null;
    }
    if (n === 4) {
      if (!adBol(adSoyad).soyad) return 'Adını ve soyadını yaz';
      const s = ilk(['sahip']);
      if (s) return s;
      return sozlesme ? null : 'Galeri hizmet sözleşmesini ve aydınlatma metnini onayla';
    }
    return null;
  }

  async function ileri() {
    setHata(null);
    const e = eksik(adim);
    if (e) {
      setHata(e);
      return;
    }
    setBusy('ileri');
    try {
      await kaydet();
      if (adim < 5) {
        setAdim(adim + 1);
        window.scrollTo({ top: 0 });
      } else {
        const r = await istek<Basvuru>('/gallery-applications/me/submit', {
          method: 'POST',
          body: { sozlesme, ticariIleti, kanal: 'web' },
        });
        setB(r);
      }
    } catch (err) {
      setHata((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function git(n: number) {
    if (!duzenlenebilir) return;
    // İleri atlarken aradaki adımların eksiği olmamalı
    for (let i = 1; i < n; i++) {
      const e = eksik(i);
      if (e) {
        setAdim(i);
        setHata(e);
        return;
      }
    }
    setHata(null);
    if (veri.tur) await kaydet().catch(() => undefined);
    setAdim(n);
  }

  async function dogrula() {
    setBusy('dogrula');
    setHata(null);
    try {
      await kaydet();
      setDogru(await istek<Dogrulama>('/gallery-applications/me/verify-authority', { method: 'POST' }));
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function yukle(file: File) {
    const kind = hedefBelge.current;
    if (!kind) return;
    setBusy(kind);
    setHata(null);
    try {
      if (!b) await kaydet();
      setB(await dosyaYukle<Basvuru>(`/gallery-applications/me/documents/${kind}`, file));
      setKaydedildi(true);
    } catch (e) {
      setHata(e instanceof ApiHatasi ? e.message : 'Dosya yüklenemedi');
    } finally {
      setBusy(null);
      hedefBelge.current = null;
    }
  }

  async function yeniBasvuru() {
    setBusy('yeni');
    try {
      const r = await istek<Basvuru>('/gallery-applications/me', {
        method: 'PATCH',
        body: { tur: veri.tur ?? 'DEALER' },
      });
      setB(r);
      setAdim(1);
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const il = ILLER.find((x) => x.ad === veri.il);
  const durumGorunumu = b && !duzenlenebilir;

  return (
    <div style={{ background: '#F6F8FD', minHeight: '100vh', color: '#1E2333' }}>
      <header style={{ background: '#FFFFFF', borderBottom: '1px solid #E3E6EF' }}>
        <div
          style={{
            maxWidth: 1360,
            margin: '0 auto',
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              color: '#1E2333',
              textDecoration: 'none',
            }}
            aria-label="Rengarenk ana sayfa"
          >
            <span style={{ display: 'flex', gap: 3 }} aria-hidden="true">
              {['#5B8CFF', '#FF6FB5', '#FFC84A', '#3DD68C'].map((c) => (
                <span key={c} style={{ width: 10, height: 22, borderRadius: 5, background: c }} />
              ))}
            </span>
            <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>rengarenk</span>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 800,
                background: '#FFF6DF',
                color: '#7A5300',
                padding: '4px 10px',
                borderRadius: 999,
                marginLeft: 4,
              }}
            >
              Kurumsal
            </span>
          </Link>
          {kaydedildi && duzenlenebilir ? (
            <span style={{ fontSize: 13.5, color: '#11683F', fontWeight: 600 }}>Taslak kaydedildi</span>
          ) : null}
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 64px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 800 }}>Kurumsal hesap başvurusu</h1>
        <p style={{ margin: '0 0 22px', fontSize: 15, color: '#5A6073' }}>
          Başvurun onaylanınca {GALLERY_TRIAL.gun} günlük ücretsiz deneme başlar; kart bilgisi istenmez.
        </p>

        <ol
          aria-label="Adımlar"
          className="rr-bes-sutun"
          style={{ listStyle: 'none', margin: '0 0 22px', padding: 0, gap: 8 }}
        >
          {APPLICATION_STEPS.map((l, i) => {
            const n = i + 1;
            const gecerli = durumGorunumu ? n === 5 : n === adim;
            const on = durumGorunumu || n <= adim;
            return (
              <li key={l}>
                <button
                  type="button"
                  onClick={() => git(n)}
                  aria-current={gecerli ? 'step' : undefined}
                  disabled={Boolean(durumGorunumu)}
                  style={{
                    width: '100%',
                    border: 0,
                    background: 'transparent',
                    padding: 0,
                    textAlign: 'left',
                    cursor: durumGorunumu ? 'default' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      height: 6,
                      borderRadius: 3,
                      background: on ? '#5B8CFF' : '#E3E6EF',
                    }}
                  />
                  <span
                    style={{
                      display: 'block',
                      marginTop: 8,
                      fontSize: 13.5,
                      fontWeight: gecerli ? 800 : 600,
                      color: on ? '#1E2333' : '#5A6073',
                    }}
                  >
                    {n}. {l}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div style={{ background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 22, padding: 28 }}>
          {hata ? (
            <p
              role="alert"
              style={{
                margin: '0 0 16px',
                background: '#FFF0EE',
                border: '1px solid #F5C6C0',
                borderRadius: 12,
                padding: '10px 14px',
                fontSize: 14,
                color: '#A3271F',
              }}
            >
              {hata}
            </p>
          ) : null}
          {b?.durum === 'DOCS_REQUESTED' && b.not ? (
            <p
              role="status"
              style={{
                margin: '0 0 16px',
                background: '#FFF6DF',
                borderRadius: 12,
                padding: '10px 14px',
                fontSize: 14,
                color: '#7A5300',
                fontWeight: 600,
              }}
            >
              Ekibimiz ek belge istedi: {b.not} Belgeyi yükleyip başvurunu yeniden gönder.
            </p>
          ) : null}

          {b === undefined ? <p style={{ margin: 0, color: '#5A6073' }}>Yükleniyor…</p> : null}

          {b !== undefined && !durumGorunumu && adim === 1 ? (
            <>
              <h2 style={{ margin: '0 0 6px', fontSize: 21, fontWeight: 800 }}>İşletme türün nedir?</h2>
              <p style={{ margin: '0 0 18px', fontSize: 14.5, color: '#5A6073' }}>
                İstenen belgeler işletme türüne göre değişir.
              </p>
              <div className="rr-dort-sutun">
                {BUSINESS_KINDS.map((k: BusinessKindKey) => {
                  const t = BUSINESS_KIND_DEFS[k];
                  const on = veri.tur === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        set('tur', k);
                        setDogru(null);
                      }}
                      style={{
                        textAlign: 'left',
                        border: on ? '2px solid #5B8CFF' : '1px solid #E3E6EF',
                        background: on ? '#EEF3FF' : '#FFFFFF',
                        borderRadius: 16,
                        padding: on ? 16 : 17,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          display: 'block',
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          background: on ? t.dot : t.tint,
                        }}
                      />
                      <span
                        style={{
                          display: 'block',
                          fontSize: 15.5,
                          fontWeight: on ? 800 : 700,
                          color: '#1E2333',
                          marginTop: 12,
                        }}
                      >
                        {t.ad}
                      </span>
                      <span
                        style={{
                          display: 'block',
                          fontSize: 13,
                          color: on ? '#3A4052' : '#5A6073',
                          marginTop: 4,
                          lineHeight: 1.45,
                        }}
                      >
                        {t.alt}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          {!durumGorunumu && adim === 2 ? (
            <>
              <h2 style={{ margin: '0 0 18px', fontSize: 21, fontWeight: 800 }}>İşletme bilgileri</h2>
              <div className="rr-iki-sutun" style={{ gap: 14 }}>
                {ALAN2.map((a) => (
                  <div key={a.id}>
                    <label htmlFor={a.id} style={etiket}>
                      {a.label}
                    </label>
                    <input
                      id={a.id}
                      inputMode={a.mod}
                      value={(veri[a.id] as string | undefined) ?? ''}
                      onChange={(e) => set(a.id, e.target.value)}
                      style={girdi}
                    />
                  </div>
                ))}
                <div>
                  <label htmlFor="il" style={etiket}>
                    İl
                  </label>
                  <select
                    id="il"
                    value={veri.il ?? ''}
                    onChange={(e) => {
                      set('il', e.target.value);
                      set('ilce', '');
                    }}
                    style={girdi}
                  >
                    <option value="">İl seç</option>
                    {ILLER.map((x) => (
                      <option key={x.plaka} value={x.ad}>
                        {x.ad}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="ilce" style={etiket}>
                    İlçe
                  </label>
                  <select
                    id="ilce"
                    value={veri.ilce ?? ''}
                    onChange={(e) => set('ilce', e.target.value)}
                    disabled={!il}
                    style={girdi}
                  >
                    <option value="">İlçe seç</option>
                    {(il?.ilceler ?? []).map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="adres" style={etiket}>
                    İşletme adresi
                  </label>
                  <input
                    id="adres"
                    value={veri.adres ?? ''}
                    onChange={(e) => set('adres', e.target.value)}
                    placeholder="Mahalle, cadde, numara"
                    style={girdi}
                  />
                </div>
              </div>
            </>
          ) : null}

          {!durumGorunumu && adim === 3 && tur ? (
            <>
              <h2 style={{ margin: '0 0 6px', fontSize: 21, fontWeight: 800 }}>Yetki ve belgeler</h2>
              <p style={{ margin: '0 0 18px', fontSize: 14.5, color: '#5A6073' }}>{tur.belgeNotu}</p>
              {tur.yetkiVar ? (
                <div style={{ border: '1px solid #E3E6EF', borderRadius: 16, padding: 18, marginBottom: 14 }}>
                  <label
                    htmlFor="yetki"
                    style={{ display: 'block', fontSize: 14, fontWeight: 800, marginBottom: 6 }}
                  >
                    {tur.yetkiAd}
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    <input
                      id="yetki"
                      value={veri.yetkiNo ?? ''}
                      onChange={(e) => {
                        set('yetkiNo', e.target.value);
                        setDogru(null);
                      }}
                      style={{ ...girdi, flex: '1 1 240px', width: 'auto', minWidth: 0 }}
                    />
                    <button
                      type="button"
                      onClick={dogrula}
                      disabled={busy === 'dogrula' || !veri.yetkiNo?.trim()}
                      style={{
                        border: 0,
                        background: '#5B8CFF',
                        borderRadius: 12,
                        padding: '12px 18px',
                        fontSize: 14.5,
                        fontWeight: 800,
                        color: '#1E2333',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {busy === 'dogrula' ? 'Doğrulanıyor…' : 'Bakanlık sisteminden doğrula'}
                    </button>
                  </div>
                  {dogru ? (
                    <div
                      role="status"
                      style={{
                        display: 'flex',
                        gap: 10,
                        alignItems: 'center',
                        marginTop: 12,
                        background:
                          dogru.sonuc === 'gecti'
                            ? '#E7FAF0'
                            : dogru.sonuc === 'kaldi'
                              ? '#FDECEC'
                              : '#FFF6DF',
                        borderRadius: 12,
                        padding: '11px 14px',
                        fontSize: 14,
                        color:
                          dogru.sonuc === 'gecti'
                            ? '#11683F'
                            : dogru.sonuc === 'kaldi'
                              ? '#A3271F'
                              : '#7A5300',
                        fontWeight: 600,
                      }}
                    >
                      {dogru.sonuc === 'gecti' ? (
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M5 12l5 5 9-10" />
                        </svg>
                      ) : null}
                      {dogru.sonuc === 'gecti'
                        ? `Doğrulandı: ${[dogru.unvan, dogru.il].filter(Boolean).join(', ')}. Bu numara profilinde ve portföy araçlarında görünecek.`
                        : dogru.sonuc === 'kaldi'
                          ? `${dogru.not ?? 'Doğrulanamadı'}. Numarayı kontrol et; doğruysa başvurun ekibimizce incelenir.`
                          : dogru.sonuc === 'uyari'
                            ? `Doğrulandı, dikkat: ${dogru.not}.`
                            : 'Otomatik doğrulama şu an yapılamıyor; belgen ekibimizce elle kontrol edilecek.'}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <input
                ref={dosyaRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) yukle(f);
                  e.target.value = '';
                }}
              />
              <div className="rr-uc-sutun">
                {tur.belgeler.map((d) => {
                  const y = b?.belgeler.find((x) => x.kind === d.key);
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => {
                        hedefBelge.current = d.key;
                        dosyaRef.current?.click();
                      }}
                      disabled={busy === d.key}
                      style={{
                        textAlign: 'left',
                        border: y ? '2px solid #3DD68C' : '2px dashed #AEB5C4',
                        background: y ? '#E7FAF0' : '#F6F8FD',
                        borderRadius: 16,
                        padding: 18,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800, color: '#1E2333' }}>
                        {d.ad}
                      </span>
                      <span style={{ display: 'block', fontSize: 12.5, color: '#5A6073', marginTop: 4 }}>
                        {y ? y.ad : d.not}
                      </span>
                      <span
                        style={{
                          display: 'inline-block',
                          marginTop: 10,
                          fontSize: 13,
                          fontWeight: 700,
                          color: y ? '#11683F' : '#2450C8',
                        }}
                      >
                        {busy === d.key ? 'Yükleniyor…' : y ? '✓ Yüklendi · değiştir' : 'Dosya yükle'}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p style={{ margin: '10px 0 0', fontSize: 12.5, color: '#5A6073' }}>
                PDF ya da fotoğraf, en çok 10 MB. Belgeler yalnızca inceleme ekibimizce görülür.
              </p>
            </>
          ) : null}

          {!durumGorunumu && adim === 4 ? (
            <>
              <h2 style={{ margin: '0 0 6px', fontSize: 21, fontWeight: 800 }}>Hesabın sahibi</h2>
              <p style={{ margin: '0 0 18px', fontSize: 14.5, color: '#5A6073' }}>
                Bu kişi hesabın sahibi olur; paketleri, ödemeleri ve ekibi yönetir. Diğer çalışanları onaydan
                sonra davet edebilirsin.
              </p>
              <div className="rr-iki-sutun" style={{ gap: 14 }}>
                <div>
                  <label htmlFor="sad" style={etiket}>
                    Ad soyad
                  </label>
                  <input
                    id="sad"
                    value={adSoyad}
                    onChange={(e) => {
                      setAdSoyad(e.target.value);
                      setKaydedildi(false);
                    }}
                    autoComplete="name"
                    style={girdi}
                  />
                </div>
                <div>
                  <label htmlFor="sgorev" style={etiket}>
                    Görevi
                  </label>
                  <input
                    id="sgorev"
                    value={veri.sahip?.gorev ?? ''}
                    onChange={(e) => setVeri((x) => ({ ...x, sahip: { ...x.sahip, gorev: e.target.value } }))}
                    style={girdi}
                  />
                </div>
                <div>
                  <label htmlFor="stel" style={etiket}>
                    Cep telefonu
                  </label>
                  <input id="stel" value={telefon} readOnly style={{ ...girdi, background: '#F6F8FD' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <span
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      width: '100%',
                      boxSizing: 'border-box',
                      background: '#E7FAF0',
                      borderRadius: 12,
                      padding: '12px 14px',
                      fontSize: 14,
                      color: '#11683F',
                      fontWeight: 600,
                    }}
                  >
                    SMS koduyla doğrulandı
                  </span>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="seposta" style={etiket}>
                    Fatura e-postası
                  </label>
                  <input
                    id="seposta"
                    type="email"
                    autoComplete="email"
                    value={veri.sahip?.eposta ?? ''}
                    onChange={(e) =>
                      setVeri((x) => ({ ...x, sahip: { ...x.sahip, eposta: e.target.value } }))
                    }
                    style={girdi}
                  />
                </div>
              </div>
              {/* BasvuruMobil.dc.html'deki onaylar; web tasarımında yok, sözleşme onayı zorunlu olduğu için eklendi */}
              <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
                <label
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  <input
                    type="checkbox"
                    className="rr-isaret"
                    checked={sozlesme}
                    onChange={(e) => setSozlesme(e.target.checked)}
                  />
                  <span>
                    <Link href="/galeri-sozlesmesi" target="_blank">
                      Galeri hizmet sözleşmesini
                    </Link>{' '}
                    ve{' '}
                    <Link href="/kvkk" target="_blank">
                      aydınlatma metnini
                    </Link>{' '}
                    okudum.
                  </span>
                </label>
                <label
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  <input
                    type="checkbox"
                    className="rr-isaret"
                    checked={ticariIleti}
                    onChange={(e) => setTicariIleti(e.target.checked)}
                  />
                  <span>Kampanya ve duyuru iletileri almak istiyorum (isteğe bağlı, İYS’ye kaydedilir).</span>
                </label>
              </div>
            </>
          ) : null}

          {!durumGorunumu && adim === 5 && tur ? (
            <>
              <h2 style={{ margin: '0 0 6px', fontSize: 21, fontWeight: 800 }}>Kontrol et ve gönder</h2>
              <p style={{ margin: '0 0 18px', fontSize: 14.5, color: '#5A6073' }}>
                Başvurunu yönetici ekibimiz inceler; sonucu SMS ve e-postayla bildiririz.
              </p>
              <dl
                className="rr-iki-sutun"
                style={{
                  margin: 0,
                  gap: 0,
                  border: '1px solid #E3E6EF',
                  borderRadius: 16,
                  overflow: 'hidden',
                }}
              >
                {[
                  ['İşletme türü', tur.ad],
                  ['Unvan', veri.unvan],
                  ['Belgeler', `${b?.belgeler.length ?? 0} belge${tur.yetkiVar ? ' + yetki belgesi' : ''}`],
                  ['Hesap sahibi', adSoyad],
                ].map(([k, v], i) => (
                  <div
                    key={k}
                    style={{ padding: '13px 16px', borderBottom: i < 2 ? '1px solid #EEF0F5' : 0 }}
                  >
                    <dt style={{ fontSize: 12.5, color: '#5A6073' }}>{k}</dt>
                    <dd style={{ margin: '2px 0 0', fontSize: 14.5, fontWeight: 700 }}>{v}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : null}

          {durumGorunumu ? <DurumGorunumu b={b} yeniBasvuru={yeniBasvuru} busy={busy === 'yeni'} /> : null}

          {b !== undefined && !durumGorunumu ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                marginTop: 26,
                paddingTop: 20,
                borderTop: '1px solid #EEF0F5',
              }}
            >
              {adim > 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    setHata(null);
                    setAdim(adim - 1);
                  }}
                  style={{
                    border: '1px solid #D5DAE5',
                    background: '#FFFFFF',
                    borderRadius: 14,
                    padding: '13px 22px',
                    fontSize: 15,
                    fontWeight: 700,
                    color: '#1E2333',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Geri
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={ileri}
                disabled={busy === 'ileri'}
                style={{
                  border: 0,
                  background: '#5B8CFF',
                  borderRadius: 14,
                  padding: '14px 26px',
                  fontSize: 15.5,
                  fontWeight: 800,
                  color: '#1E2333',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {adim === 5
                  ? b?.durum === 'DOCS_REQUESTED'
                    ? 'Yeniden gönder'
                    : 'Başvuruyu gönder'
                  : 'Devam et'}
              </button>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}

/** Gönderilen başvurunun durumu (tasarım: "Başvurun alındı") */
function DurumGorunumu({ b, yeniBasvuru, busy }: { b: Basvuru; yeniBasvuru: () => void; busy: boolean }) {
  const tur = b.veri.tur ? BUSINESS_KIND_DEFS[b.veri.tur] : null;
  const onay = b.durum === 'APPROVED';
  const ret = b.durum === 'REJECTED' || b.durum === 'REVOKED';
  const kontrol = Boolean(b.kontrolEdildi);
  const adimlar = [
    { ad: 'Başvuru alındı', not: saat(b.gonderildi), bitti: true },
    tur?.yetkiVar
      ? {
          ad: !kontrol
            ? 'Yetki belgesi kontrol ediliyor'
            : b.yetki === 'gecti' || b.yetki === 'uyari'
              ? 'Yetki belgesi doğrulandı'
              : 'Yetki belgesi elle kontrol ediliyor',
          not: !kontrol
            ? 'Bakanlık sisteminden otomatik kontrol'
            : b.yetki === 'gecti' || b.yetki === 'uyari'
              ? 'Bakanlık sisteminden otomatik kontrol'
              : 'Otomatik doğrulama yapılamadı; belgen inceleniyor',
          bitti: kontrol,
        }
      : { ad: 'Belgeler alındı', not: 'Yönetici incelemesine hazır', bitti: true },
    {
      ad: 'Yönetici incelemesi',
      not: onay ? 'Tamamlandı' : ret ? 'Sonuçlandı' : 'Belgeler ve adres bilgisi kontrol ediliyor',
      bitti: onay || ret,
    },
    {
      ad: ret ? 'Başvuru sonuçlanmadı' : `Hesap açılır, ${GALLERY_TRIAL.gun} günlük deneme başlar`,
      not: ret
        ? (b.not ?? '')
        : onay
          ? 'Hesabın açıldı; çalışanlarını davet edebilirsin'
          : 'Onaydan sonra çalışanlarını davet edebilirsin',
      bitti: onay,
    },
  ];
  const simdiki = adimlar.findIndex((a) => !a.bitti);
  return (
    <>
      <h2 style={{ margin: '0 0 6px', fontSize: 21, fontWeight: 800 }}>
        {onay ? 'Başvurun onaylandı' : ret ? 'Başvurun onaylanmadı' : 'Başvurun alındı'}
      </h2>
      <p style={{ margin: '0 0 20px', fontSize: 14.5, color: '#5A6073' }}>
        {onay
          ? `${GALLERY_TRIAL.gun} günlük ücretsiz denemen başladı.`
          : ret
            ? 'Gerekçeyi aşağıda görebilirsin; eksikleri tamamlayıp yeniden başvurabilirsin.'
            : 'Durumu bu sayfadan takip edebilirsin.'}
      </p>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
        {adimlar.map((a, i) => {
          const sira = i === simdiki;
          const kirmizi = ret && i === 3;
          return (
            <li key={a.ad} style={{ display: 'flex', gap: 14, paddingBottom: 18 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: kirmizi ? '#E5484D' : a.bitti ? '#5B8CFF' : sira ? '#FFFFFF' : '#F3F5FA',
                  border: `2px solid ${kirmizi ? '#E5484D' : a.bitti || sira ? '#5B8CFF' : '#E3E6EF'}`,
                  boxSizing: 'border-box',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 800,
                  flex: 'none',
                  color: kirmizi ? '#FFFFFF' : '#1E2333',
                }}
              >
                {kirmizi ? '✕' : a.bitti ? '✓' : i + 1}
              </span>
              <span>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 800 }}>{a.ad}</span>
                <span
                  style={{
                    display: 'block',
                    fontSize: 13.5,
                    color: kirmizi ? '#A3271F' : '#5A6073',
                    marginTop: 2,
                  }}
                >
                  {a.not}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      {onay && b.galeri ? (
        <Link
          href="/galeri-paneli"
          style={{
            display: 'inline-block',
            marginTop: 4,
            background: '#5B8CFF',
            borderRadius: 14,
            padding: '14px 26px',
            fontSize: 15.5,
            fontWeight: 800,
            color: '#1E2333',
            textDecoration: 'none',
          }}
        >
          Galeri paneline git
        </Link>
      ) : null}
      {ret ? (
        <button
          type="button"
          onClick={yeniBasvuru}
          disabled={busy}
          style={{
            marginTop: 4,
            border: 0,
            background: '#5B8CFF',
            borderRadius: 14,
            padding: '14px 26px',
            fontSize: 15.5,
            fontWeight: 800,
            color: '#1E2333',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Yeniden başvur
        </button>
      ) : null}
    </>
  );
}
