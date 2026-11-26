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
  TICARI_ILETI_KUTU,
  type TicariKanallar,
} from '@rengarenk/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cx } from '../../lib/cx';
import { ApiHatasi, dosyaYukle, istek, useGiris } from '../../lib/istemci';
import { olcumOlayi } from '../../lib/olcum';
import stil from './basvuru.module.css';

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
  const [ticari, setTicari] = useState<TicariKanallar>({ eposta: false, bildirim: false });
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
        const ilk = !b?.gonderildi;
        const r = await istek<Basvuru>('/gallery-applications/me/submit', {
          method: 'POST',
          body: { sozlesme, ticariKanallar: ticari, kanal: 'web' },
        });
        if (ilk) olcumOlayi('SubmitApplication', r.id);
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
    <div className={stil.kutu1}>
      <header className={stil.kutu2}>
        <div className={stil.kutu3}>
          <Link href="/" className={stil.bag1} aria-label="Rengarenk ana sayfa">
            <span className={stil.metin1} aria-hidden="true">
              {[
                'var(--rr-mavi, #5B8CFF)',
                'var(--rr-pembe, #FF6FB5)',
                'var(--rr-sari, #FFC84A)',
                'var(--rr-yesil, #3DD68C)',
              ].map((c) => (
                <span key={c} className={stil.metin2} style={{ background: c }} />
              ))}
            </span>
            <span className={stil.metin3}>rengarenk</span>
            <span className={stil.metin4}>Kurumsal</span>
          </Link>
          {kaydedildi && duzenlenebilir ? <span className={stil.metin5}>Taslak kaydedildi</span> : null}
        </div>
      </header>

      <main className={`rr-sayfa ${stil.kutu4}`}>
        <h1 className={stil.baslik1}>Kurumsal hesap başvurusu</h1>
        <p className={stil.metin6}>
          Başvurun onaylanınca {GALLERY_TRIAL.gun} günlük ücretsiz deneme başlar; kart bilgisi istenmez.
        </p>

        <ol aria-label="Adımlar" className={`rr-bes-sutun ${stil.liste1}`}>
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
                  className={cx(stil.dugme1, durumGorunumu ? stil.dugme2 : stil.dugme3)}
                >
                  <span className={cx(stil.metin7, on ? stil.metin8 : stil.metin9)} />
                  <span
                    className={cx(
                      stil.metin10,
                      gecerli ? stil.metin11 : stil.metin12,
                      on ? stil.metin13 : stil.metin14,
                    )}
                  >
                    {n}. {l}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className={stil.kutu5}>
          {hata ? (
            <p role="alert" className={stil.metin15}>
              {hata}
            </p>
          ) : null}
          {b?.durum === 'DOCS_REQUESTED' && b.not ? (
            <p role="status" className={stil.metin16}>
              Ekibimiz ek belge istedi: {b.not} Belgeyi yükleyip başvurunu yeniden gönder.
            </p>
          ) : null}

          {b === undefined ? <p className={stil.metin17}>Yükleniyor…</p> : null}

          {b !== undefined && !durumGorunumu && adim === 1 ? (
            <>
              <h2 className={stil.baslik2}>İşletme türün nedir?</h2>
              <p className={stil.metin18}>İstenen belgeler işletme türüne göre değişir.</p>
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
                      className={cx(stil.dugme4, on ? stil.dugme5 : stil.dugme6)}
                    >
                      <span
                        aria-hidden="true"
                        className={stil.metin19}
                        style={{ background: on ? t.dot : t.tint }}
                      />
                      <span className={cx(stil.metin20, on ? stil.metin11 : stil.metin21)}>{t.ad}</span>
                      <span className={cx(stil.metin22, on ? stil.metin23 : stil.metin14)}>{t.alt}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          {!durumGorunumu && adim === 2 ? (
            <>
              <h2 className={stil.baslik3}>İşletme bilgileri</h2>
              <div className={`rr-iki-sutun ${stil.kutu6}`}>
                {ALAN2.map((a) => (
                  <div key={a.id}>
                    <label htmlFor={a.id} className={stil.etiket1}>
                      {a.label}
                    </label>
                    <input
                      id={a.id}
                      inputMode={a.mod}
                      value={(veri[a.id] as string | undefined) ?? ''}
                      onChange={(e) => set(a.id, e.target.value)}
                      className={stil.girdi1}
                    />
                  </div>
                ))}
                <div>
                  <label htmlFor="il" className={stil.etiket1}>
                    İl
                  </label>
                  <select
                    id="il"
                    value={veri.il ?? ''}
                    onChange={(e) => {
                      set('il', e.target.value);
                      set('ilce', '');
                    }}
                    className={stil.girdi1}
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
                  <label htmlFor="ilce" className={stil.etiket1}>
                    İlçe
                  </label>
                  <select
                    id="ilce"
                    value={veri.ilce ?? ''}
                    onChange={(e) => set('ilce', e.target.value)}
                    disabled={!il}
                    className={stil.girdi1}
                  >
                    <option value="">İlçe seç</option>
                    {(il?.ilceler ?? []).map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={stil.kutu7}>
                  <label htmlFor="adres" className={stil.etiket1}>
                    İşletme adresi
                  </label>
                  <input
                    id="adres"
                    value={veri.adres ?? ''}
                    onChange={(e) => set('adres', e.target.value)}
                    placeholder="Mahalle, cadde, numara"
                    className={stil.girdi1}
                  />
                </div>
              </div>
            </>
          ) : null}

          {!durumGorunumu && adim === 3 && tur ? (
            <>
              <h2 className={stil.baslik2}>Yetki ve belgeler</h2>
              <p className={stil.metin18}>{tur.belgeNotu}</p>
              {tur.yetkiVar ? (
                <div className={stil.kutu8}>
                  <label htmlFor="yetki" className={stil.etiket2}>
                    {tur.yetkiAd}
                  </label>
                  <div className={stil.kutu9}>
                    <input
                      id="yetki"
                      value={veri.yetkiNo ?? ''}
                      onChange={(e) => {
                        set('yetkiNo', e.target.value);
                        setDogru(null);
                      }}
                      className={stil.girdi2}
                    />
                    <button
                      type="button"
                      onClick={dogrula}
                      disabled={busy === 'dogrula' || !veri.yetkiNo?.trim()}
                      className={stil.dugme7}
                    >
                      {busy === 'dogrula' ? 'Doğrulanıyor…' : 'Bakanlık sisteminden doğrula'}
                    </button>
                  </div>
                  {dogru ? (
                    <div
                      role="status"
                      className={stil.kutu10}
                      style={{
                        background:
                          dogru.sonuc === 'gecti'
                            ? '#E7FAF0'
                            : dogru.sonuc === 'kaldi'
                              ? '#FDECEC'
                              : '#FFF6DF',
                        color:
                          dogru.sonuc === 'gecti'
                            ? '#11683F'
                            : dogru.sonuc === 'kaldi'
                              ? '#A3271F'
                              : '#7A5300',
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
                      className={cx(stil.dugme8, y ? stil.dugme9 : stil.dugme10)}
                    >
                      <span className={stil.metin24}>{d.ad}</span>
                      <span className={stil.metin25}>{y ? y.ad : d.not}</span>
                      <span className={cx(stil.metin26, y ? stil.metin27 : stil.metin28)}>
                        {busy === d.key ? 'Yükleniyor…' : y ? '✓ Yüklendi · değiştir' : 'Dosya yükle'}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className={stil.metin29}>
                PDF ya da fotoğraf, en çok 10 MB. Belgeler yalnızca inceleme ekibimizce görülür.
              </p>
            </>
          ) : null}

          {!durumGorunumu && adim === 4 ? (
            <>
              <h2 className={stil.baslik2}>Hesabın sahibi</h2>
              <p className={stil.metin18}>
                Bu kişi hesabın sahibi olur; paketleri, ödemeleri ve ekibi yönetir. Diğer çalışanları onaydan
                sonra davet edebilirsin.
              </p>
              <div className={`rr-iki-sutun ${stil.kutu6}`}>
                <div>
                  <label htmlFor="sad" className={stil.etiket1}>
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
                    className={stil.girdi1}
                  />
                </div>
                <div>
                  <label htmlFor="sgorev" className={stil.etiket1}>
                    Görevi
                  </label>
                  <input
                    id="sgorev"
                    value={veri.sahip?.gorev ?? ''}
                    onChange={(e) => setVeri((x) => ({ ...x, sahip: { ...x.sahip, gorev: e.target.value } }))}
                    className={stil.girdi1}
                  />
                </div>
                <div>
                  <label htmlFor="stel" className={stil.etiket1}>
                    Cep telefonu
                  </label>
                  <input id="stel" value={telefon} readOnly className={stil.girdi3} />
                </div>
                <div className={stil.kutu11}>
                  <span className={stil.metin30}>WhatsApp koduyla doğrulandı</span>
                </div>
                <div className={stil.kutu7}>
                  <label htmlFor="seposta" className={stil.etiket1}>
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
                    className={stil.girdi1}
                  />
                </div>
              </div>
              {/* BasvuruMobil.dc.html'deki onaylar; web tasarımında yok, sözleşme onayı zorunlu olduğu için eklendi */}
              <div className={stil.kutu12}>
                <label className={stil.etiket3}>
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
                {/* Ticari ileti onayı kanal kanal (yasal metin taslağı bölüm 4; Karar 49) */}
                <fieldset className={stil.kutu13}>
                  <legend className={stil.baslik4}>{TICARI_ILETI_KUTU.metin}</legend>
                  <div className={stil.kutu14}>
                    {TICARI_ILETI_KUTU.kanallar.map((k) => (
                      <label key={k.anahtar} className={stil.etiket4}>
                        <input
                          type="checkbox"
                          className="rr-isaret"
                          checked={ticari[k.anahtar]}
                          onChange={(e) => setTicari({ ...ticari, [k.anahtar]: e.target.checked })}
                        />
                        <span>{k.ad}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            </>
          ) : null}

          {!durumGorunumu && adim === 5 && tur ? (
            <>
              <h2 className={stil.baslik2}>Kontrol et ve gönder</h2>
              <p className={stil.metin18}>
                Başvurunu yönetici ekibimiz inceler; sonucu e-postayla ve bildirimle iletiriz.
              </p>
              <dl className={`rr-iki-sutun ${stil.liste2}`}>
                {[
                  ['İşletme türü', tur.ad],
                  ['Unvan', veri.unvan],
                  ['Belgeler', `${b?.belgeler.length ?? 0} belge${tur.yetkiVar ? ' + yetki belgesi' : ''}`],
                  ['Hesap sahibi', adSoyad],
                ].map(([k, v], i) => (
                  <div key={k} className={cx(stil.kutu15, i < 2 ? stil.kutu16 : stil.kutu17)}>
                    <dt className={stil.metin31}>{k}</dt>
                    <dd className={stil.metin32}>{v}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : null}

          {durumGorunumu ? <DurumGorunumu b={b} yeniBasvuru={yeniBasvuru} busy={busy === 'yeni'} /> : null}

          {b !== undefined && !durumGorunumu ? (
            <div className={stil.kutu18}>
              {adim > 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    setHata(null);
                    setAdim(adim - 1);
                  }}
                  className={stil.dugme11}
                >
                  Geri
                </button>
              ) : (
                <span />
              )}
              <button type="button" onClick={ileri} disabled={busy === 'ileri'} className={stil.dugme12}>
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
      <h2 className={stil.baslik2}>
        {onay ? 'Başvurun onaylandı' : ret ? 'Başvurun onaylanmadı' : 'Başvurun alındı'}
      </h2>
      <p className={stil.metin33}>
        {onay
          ? `${GALLERY_TRIAL.gun} günlük ücretsiz denemen başladı.`
          : ret
            ? 'Gerekçeyi aşağıda görebilirsin; eksikleri tamamlayıp yeniden başvurabilirsin.'
            : 'Durumu bu sayfadan takip edebilirsin.'}
      </p>
      <ol className={stil.liste3}>
        {adimlar.map((a, i) => {
          const sira = i === simdiki;
          const kirmizi = ret && i === 3;
          return (
            <li key={a.ad} className={stil.oge1}>
              <span
                aria-hidden="true"
                className={stil.metin34}
                style={{
                  background: kirmizi
                    ? '#E5484D'
                    : a.bitti
                      ? 'var(--rr-mavi, #5B8CFF)'
                      : sira
                        ? 'var(--rr-kart, #FFFFFF)'
                        : '#F3F5FA',
                  border: `2px solid ${kirmizi ? '#E5484D' : a.bitti || sira ? 'var(--rr-mavi, #5B8CFF)' : 'var(--rr-cizgi, #E3E6EF)'}`,
                  color: kirmizi
                    ? '#FFFFFF'
                    : a.bitti
                      ? 'var(--rr-maviYazi, #1E2333)'
                      : 'var(--rr-murekkep, #1E2333)',
                }}
              >
                {kirmizi ? '✕' : a.bitti ? '✓' : i + 1}
              </span>
              <span>
                <span className={stil.metin35}>{a.ad}</span>
                <span className={cx(stil.metin36, kirmizi ? stil.metin37 : stil.metin14)}>{a.not}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {onay && b.galeri ? (
        <Link href="/galeri-paneli" className={stil.bag2}>
          Galeri paneline git
        </Link>
      ) : null}
      {ret ? (
        <button type="button" onClick={yeniBasvuru} disabled={busy} className={stil.dugme13}>
          Yeniden başvur
        </button>
      ) : null}
    </>
  );
}
