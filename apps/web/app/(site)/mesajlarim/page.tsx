'use client';

import { DEPOSIT_NOTE, MESSAGE_MAX } from '@rengarenk/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type CSSProperties, type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { PuanVer } from '../../../components/puan-ver';
import { Sikayet } from '../../../components/sikayet';
import { useCanli } from '../../../lib/canli';
import { cx } from '../../../lib/cx';
import { API, binlik, istek, useGiris } from '../../../lib/istemci';
import stil from './page.module.css';

interface Satir {
  id: string;
  taraf: 'alici' | 'satici';
  ad: string;
  bas: string;
  galeri: boolean;
  talep: { no: number; baslik: string } | null;
  arac: { no: number; ad: string } | null;
  son: string;
  zaman: string;
  durum: 'WAITING' | 'OPEN' | 'DECLINED';
  bekliyor: boolean;
  uyari: boolean;
  numara: boolean;
  okunmamis: number;
}
interface Mesaj {
  id: string;
  tip: 'metin' | 'kart' | 'sistem';
  yon: 'gelen' | 'giden' | 'sistem';
  metin: string;
  zaman: string;
  gonderen: string | null;
  kart: { no: number; ad: string; ozet: string; fiyat: number; foto: string | null; satista: boolean } | null;
  uyari: { baslik: string; metin: string } | null;
  /** Moderasyon gizledi (Karar 53) */
  gizli?: boolean;
}
interface Sohbet {
  id: string;
  taraf: 'alici' | 'satici';
  durum: 'WAITING' | 'OPEN' | 'DECLINED';
  karsi: {
    ad: string;
    bas: string;
    alt: string;
    galeri: { slug: string } | null;
    telefon: string | null;
    rozetler: { key: string; ad: string; bg: string; renk: string; aciklama: string }[];
  };
  puan: { uygun: boolean; verilen: number | null };
  talep: { no: number; baslik: string } | null;
  arac: { no: number; ad: string } | null;
  numaraPaylasildi: boolean;
  engelli: boolean;
  ilkMesajBekliyor: boolean;
  yazabilir: boolean;
  /** Karşı taraf hesabını kapattı (Karar 31) */
  kapali?: boolean;
  kartEkleyebilir: boolean;
  saticiHesap: string | null;
  mesajlar: Mesaj[];
}

const AV = ['#FFF6DF', '#E7FAF0', '#FFEEF6', '#EEF3FF', '#F3EFFF'];
const avatar = (s: { galeri: boolean; ad: string }) =>
  s.galeri ? AV[0] : AV[(s.ad.charCodeAt(0) + s.ad.length) % (AV.length - 1)];
const saat = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
const gun = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short' }).format(new Date(iso));
function gunAdi(iso: string) {
  if (gun(iso) === gun(new Date().toISOString())) return 'Bugün';
  if (gun(iso) === gun(new Date(Date.now() - 86_400_000).toISOString())) return 'Dün';
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: 'numeric',
    month: 'long',
  }).format(new Date(iso));
}
const listeZamani = (iso: string) => (gunAdi(iso) === 'Bugün' ? saat(iso) : gunAdi(iso));

const FILTRE = [
  ['tumu', 'Tümü'],
  ['bekleyen', 'Yanıt bekleyen'],
  ['uyari', 'Uyarılı'],
] as const;

/**
 * Mesajlarım (tasarım: Mesajlar.dc.html; Karar 08, 11, 25, 26, 27). Alıcı ve satıcı olarak bütün sohbetler; galeri
 * sohbetlerini galerinin bütün çalışanları görür. Yeni mesajlar WebSocket ile anında gelir. Tasarıma ek: "Numaramı
 * paylaş" (MesajlarMobil.dc.html) ve galeride sohbete araç kartı ekleme. Şikayet moderasyonla açılır (Karar 53).
 * Destek talebi varsa listenin başında sabit "Rengarenk Destek" satırı (Yardim.dc.html; Karar 54).
 */
export default function Mesajlarim() {
  const giris = useGiris();
  const router = useRouter();
  const [liste, setListe] = useState<Satir[] | null>(null);
  const [filtre, setFiltre] = useState<(typeof FILTRE)[number][0]>('tumu');
  const [aktif, setAktif] = useState<string | null>(null);
  // Telefonda (MesajlarMobil.dc.html) önce liste görünür; sohbete dokununca ya da bağlantıda ?sohbet= varsa sohbet
  const [mobilSohbet, setMobilSohbet] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('sohbet')) setMobilSohbet(true);
  }, []);
  const [s, setS] = useState<Sohbet | null>(null);
  const [sikayet, setSikayet] = useState<string | null>(null);
  const [destek, setDestek] = useState<{
    no: number;
    ozet: string;
    okunmamis: boolean;
    durumAd: string;
  } | null>(null);
  const [metin, setMetin] = useState('');
  const [yanitla, setYanitla] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const [araclar, setAraclar] = useState<{ id: string; ad: string }[]>([]);
  const [kart, setKart] = useState('');
  const [puanAcik, setPuanAcik] = useState(false);
  const alt = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (giris === false) router.replace('/giris?sonra=/mesajlarim');
  }, [giris, router]);

  const listeYukle = useCallback(async () => {
    const l = await istek<Satir[]>('/conversations');
    setListe(l);
    setAktif((a) => a ?? new URLSearchParams(window.location.search).get('sohbet') ?? l[0]?.id ?? null);
  }, []);
  const sohbetYukle = useCallback(async (id: string) => {
    const d = await istek<Sohbet>(`/conversations/${id}`);
    setS(d);
    setListe((l) => l?.map((x) => (x.id === id ? { ...x, okunmamis: 0 } : x)) ?? l);
  }, []);

  useEffect(() => {
    if (giris) listeYukle().catch((e: Error) => setHata(e.message));
    if (giris)
      istek<{ no: number; ozet: string; okunmamis: boolean; durumAd: string }[]>('/support/tickets')
        .then((l) => setDestek(l[0] ?? null))
        .catch(() => undefined);
  }, [giris, listeYukle]);
  useEffect(() => {
    if (!aktif) return;
    setYanitla(false);
    setMetin('');
    setKart('');
    sohbetYukle(aktif).catch((e: Error) => setHata(e.message));
    window.history.replaceState(null, '', `/mesajlarim?sohbet=${aktif}`);
  }, [aktif, sohbetYukle]);
  useEffect(() => {
    if (!s?.kartEkleyebilir || !s.saticiHesap) {
      setAraclar([]);
      return;
    }
    istek<{ araclar: { id: string; ad: string; durum: string }[] }>(`/gallery/${s.saticiHesap}/portfolio`)
      .then((l) => setAraclar(l.araclar.filter((a) => a.durum === 'PUBLISHED')))
      .catch(() => setAraclar([]));
  }, [s?.kartEkleyebilir, s?.saticiHesap]);
  // Yeni mesajda sohbetin sonuna kaydırılır
  useEffect(() => {
    if (s) alt.current?.scrollIntoView({ block: 'end' });
  }, [s]);

  // Yeni mesaj gelince liste ve açık sohbet yenilenir
  useCanli((o) => {
    if (o.tip !== 'sohbet') return;
    listeYukle().catch(() => undefined);
    if (o.id && o.id === aktif) sohbetYukle(o.id).catch(() => undefined);
  }, Boolean(giris));

  async function islem(fn: () => Promise<Sohbet>) {
    setHata(null);
    setMesgul(true);
    try {
      setS(await fn());
      await listeYukle();
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setMesgul(false);
    }
  }

  function gonder(e: FormEvent) {
    e.preventDefault();
    if (!s || !metin.trim()) return;
    islem(() =>
      istek<Sohbet>(`/conversations/${s.id}/messages`, {
        method: 'POST',
        body: { metin, ...(kart ? { aracId: kart } : {}) },
      }),
    ).then(() => {
      setMetin('');
      setKart('');
      setYanitla(false);
    });
  }

  const gorunen = (liste ?? []).filter((x) =>
    filtre === 'bekleyen' ? x.bekliyor : filtre === 'uyari' ? x.uyari : true,
  );
  const besteci = s?.yazabilir && (!s.ilkMesajBekliyor || yanitla);

  let sonGun = '';
  return (
    <div className={`rr-sayfa ${stil.kutu1}`}>
      <div className={`rr-mesaj ${stil.kutu2}`} data-gorunum={mobilSohbet ? 'sohbet' : 'liste'}>
        <section aria-label="Sohbetler" className={`rr-mesaj-liste ${stil.kutu3}`}>
          <div className={stil.kutu4}>
            <h1 className={stil.baslik1}>Mesajlarım</h1>
            <div role="tablist" className={stil.kutu5}>
              {FILTRE.map(([k, ad]) => {
                const on = filtre === k;
                return (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setFiltre(k)}
                    className={cx(stil.dugme1, on ? stil.dugme2 : stil.dugme3)}
                  >
                    {ad}
                  </button>
                );
              })}
            </div>
          </div>
          {liste && !gorunen.length ? (
            <p className={stil.metin1}>
              {liste.length
                ? 'Bu süzgeçte sohbet yok.'
                : 'Henüz mesajın yok. Satıcılar talebine yazınca ya da sen bir talebe yazınca burada görünür.'}
            </p>
          ) : null}
          <ul className={stil.liste1}>
            {destek ? (
              <li>
                <Link href={`/destek?no=${destek.no}`} className={stil.bag1}>
                  <span aria-hidden="true" className={stil.metin2}>
                    RD
                  </span>
                  <span className={stil.metin3}>
                    <span className={stil.metin4}>
                      <span className={cx(stil.metin5, destek.okunmamis ? stil.metin6 : stil.metin7)}>
                        Rengarenk Destek
                      </span>
                      <span className={stil.metin8}>{destek.durumAd}</span>
                    </span>
                    <span className={cx(stil.metin9, destek.okunmamis ? stil.metin7 : stil.metin10)}>
                      {destek.okunmamis ? 'Yeni yanıt · ' : ''}
                      {destek.ozet}
                    </span>
                  </span>
                </Link>
              </li>
            ) : null}
            {gorunen.map((x) => {
              const on = x.id === aktif;
              return (
                <li key={x.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setAktif(x.id);
                      setMobilSohbet(true);
                    }}
                    aria-current={on ? 'true' : undefined}
                    className={cx(stil.dugme4, on ? stil.dugme5 : stil.dugme6)}
                  >
                    <span aria-hidden="true" className={stil.metin11} style={{ background: avatar(x) }}>
                      {x.bas}
                    </span>
                    <span className={stil.metin3}>
                      <span className={stil.metin4}>
                        <span className={stil.metin12}>{x.ad}</span>
                        <span className={stil.metin13}>{listeZamani(x.zaman)}</span>
                      </span>
                      <span className={stil.metin14}>{x.talep?.baslik ?? x.arac?.ad ?? ''}</span>
                      <span className={stil.metin15}>{x.son}</span>
                      <span className={stil.metin16}>
                        {x.bekliyor ? (
                          <span className={stil.metin34}>
                            {x.taraf === 'alici' ? 'Yanıt bekliyor' : 'Alıcının yanıtı bekleniyor'}
                          </span>
                        ) : null}
                        {x.uyari ? <span className={stil.metin35}>Güvenlik uyarısı</span> : null}
                        {x.numara && x.taraf === 'satici' ? (
                          <span className={stil.metin36}>Numara paylaşıldı</span>
                        ) : null}
                        {x.okunmamis ? <span className={stil.metin37}>Yeni</span> : null}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-label="Sohbet" className={`rr-mesaj-sohbet ${stil.kutu6}`}>
          <button
            type="button"
            className={`rr-yalniz-dar ${stil.dugme7}`}
            onClick={() => setMobilSohbet(false)}
          >
            ← Sohbetler
          </button>
          {!s ? (
            <p className={stil.metin17}>{liste && !liste.length ? 'Sohbet seçilmedi.' : 'Yükleniyor…'}</p>
          ) : (
            <>
              <div className={stil.kutu7}>
                <div className={stil.kutu8}>
                  <span
                    aria-hidden="true"
                    className={stil.metin18}
                    style={{ background: avatar({ galeri: !!s.karsi.galeri, ad: s.karsi.ad }) }}
                  >
                    {s.karsi.bas}
                  </span>
                  <div className={stil.kutu9}>
                    <h2 className={stil.baslik2}>{s.karsi.ad}</h2>
                    <p className={stil.metin19}>
                      {s.karsi.alt}
                      {s.karsi.telefon ? ` · Telefon: ${s.karsi.telefon}` : ''}
                    </p>
                    {s.karsi.rozetler.some((r) => r.key !== 'onay') ? (
                      <span className={stil.metin20}>
                        {s.karsi.rozetler
                          .filter((r) => r.key !== 'onay')
                          .map((r) => (
                            <span key={r.key} title={r.aciklama} style={rozet(r.bg, r.renk)}>
                              {r.ad}
                            </span>
                          ))}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className={stil.kutu10}>
                  {s.puan.uygun ? (
                    <button type="button" onClick={() => setPuanAcik(true)} className={stil.dugme8}>
                      ★ Puan ver
                    </button>
                  ) : s.puan.verilen ? (
                    <span className={stil.metin21}>{'★'.repeat(s.puan.verilen)} verdin</span>
                  ) : null}
                  {s.karsi.galeri && s.taraf === 'alici' ? (
                    <Link href={`/galeri/${s.karsi.galeri.slug}`} className={stil.bag2}>
                      Galeri profili
                    </Link>
                  ) : null}
                  {s.taraf === 'alici' && s.durum === 'OPEN' && !s.numaraPaylasildi ? (
                    <button
                      type="button"
                      disabled={mesgul}
                      onClick={() => {
                        if (window.confirm('Numaran bu satıcıya gösterilecek. Paylaşmak istiyor musun?')) {
                          islem(() =>
                            istek<Sohbet>(`/conversations/${s.id}/share-phone`, { method: 'POST' }),
                          );
                        }
                      }}
                      className={stil.bag2}
                    >
                      Numaramı paylaş
                    </button>
                  ) : null}
                  {s.taraf === 'alici' ? (
                    <button
                      type="button"
                      disabled={mesgul}
                      onClick={() =>
                        islem(() =>
                          istek<Sohbet>(`/conversations/${s.id}/block`, {
                            method: s.engelli ? 'DELETE' : 'POST',
                          }),
                        )
                      }
                      className={stil.bag2}
                    >
                      {s.engelli ? 'Engeli kaldır' : 'Engelle'}
                    </button>
                  ) : null}
                  {(() => {
                    // Karşı tarafın son mesajı şikâyet edilir; tek tek mesaj için mesajın altındaki bağlantı (Karar 53)
                    const son = [...s.mesajlar]
                      .reverse()
                      .find((m) => m.yon === 'gelen' && m.tip === 'metin' && !m.gizli);
                    return (
                      <button
                        type="button"
                        disabled={!son}
                        title={son ? undefined : 'Şikayet edilecek mesaj yok'}
                        onClick={() => son && setSikayet(son.id)}
                        className={cx(stil.dugme9, son ? stil.dugme10 : stil.dugme11)}
                      >
                        Şikayet et
                      </button>
                    );
                  })()}
                </div>
              </div>

              {s.talep || s.arac ? (
                <Link href={s.talep ? `/talep/${s.talep.no}` : `/arac/${s.arac?.no}`} className={stil.bag3}>
                  <span className={stil.metin22}>
                    <span aria-hidden="true" className={stil.metin23} />
                  </span>
                  <span className={stil.kutu9}>
                    <span className={stil.metin24}>
                      {s.talep ? (s.taraf === 'alici' ? 'Talebin' : 'Talep') : 'Portföy aracı'}
                    </span>
                    <span className={stil.metin25}>{s.talep?.baslik ?? s.arac?.ad}</span>
                  </span>
                </Link>
              ) : null}

              <div className={stil.kutu11}>
                {s.mesajlar.map((m) => {
                  const g = gunAdi(m.zaman);
                  const ayrac = g !== sonGun;
                  sonGun = g;
                  return (
                    <div key={m.id} className={stil.kutu12}>
                      {ayrac ? <span className={stil.metin26}>{g}</span> : null}
                      <MesajGorunumu m={m} sikayet={() => setSikayet(m.id)} />
                    </div>
                  );
                })}
                <div ref={alt} />
                {sikayet ? <Sikayet hedef="mesaj" id={sikayet} kapat={() => setSikayet(null)} /> : null}
              </div>

              {s.ilkMesajBekliyor && !yanitla ? (
                <div className={stil.kutu13}>
                  <p className={stil.metin27}>
                    <strong>Bu satıcı sana ilk mesajını gönderdi.</strong> Yanıtlarsan sohbet açılır.
                    Yanıtlamazsan bu satıcı aynı talebine tekrar yazamaz.
                  </p>
                  <div className={stil.kutu14}>
                    <button type="button" onClick={() => setYanitla(true)} className={stil.dugme12}>
                      Yanıtla
                    </button>
                    <button
                      type="button"
                      disabled={mesgul}
                      onClick={() =>
                        islem(() => istek<Sohbet>(`/conversations/${s.id}/decline`, { method: 'POST' }))
                      }
                      className={stil.dugme13}
                    >
                      İlgilenmiyorum
                    </button>
                  </div>
                </div>
              ) : null}

              {!s.yazabilir ? (
                <p className={stil.metin28}>
                  {s.kapali
                    ? 'Bu hesap kapatıldı; sohbet yalnızca okunabilir.'
                    : s.durum === 'DECLINED'
                      ? 'Bu sohbet kapandı; alıcı ilgilenmediğini belirtti.'
                      : s.durum === 'WAITING'
                        ? 'İlk mesajın gönderildi. Alıcı yanıt verene kadar ikinci mesaj atamazsın.'
                        : 'Alıcı bu hesaptan mesaj almak istemiyor.'}
                </p>
              ) : null}
              {hata ? (
                <p role="alert" className={stil.metin29}>
                  {hata}
                </p>
              ) : null}

              {puanAcik ? (
                <PuanVer
                  sohbet={s.id}
                  ad={s.karsi.ad}
                  bas={s.karsi.bas}
                  alt={[
                    s.talep ? `${s.talep.baslik} talebin` : s.arac?.ad,
                    s.karsi.galeri ? s.karsi.alt.split(' · ')[1]?.split(',')[0] : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  kapat={() => setPuanAcik(false)}
                  verildi={(n) => setS((x) => (x ? { ...x, puan: { uygun: false, verilen: n } } : x))}
                />
              ) : null}

              {besteci ? (
                <form onSubmit={gonder} className={stil.kutu15}>
                  {s.kartEkleyebilir && araclar.length ? (
                    <label className={stil.etiket1}>
                      Araç kartı
                      <select value={kart} onChange={(e) => setKart(e.target.value)} className={stil.girdi1}>
                        <option value="">Ekleme</option>
                        {araclar.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.ad}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <div className={stil.kutu16}>
                    <label htmlFor="yaz" className={stil.etiket2}>
                      Mesaj yaz
                    </label>
                    <textarea
                      id="yaz"
                      rows={2}
                      maxLength={MESSAGE_MAX}
                      placeholder="Mesajını yaz…"
                      value={metin}
                      onChange={(e) => setMetin(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          gonder(e as unknown as FormEvent);
                        }
                      }}
                      className={stil.girdi2}
                    />
                    <button
                      type="submit"
                      disabled={mesgul || !metin.trim()}
                      className={stil.dugme14}
                      style={{ opacity: mesgul || !metin.trim() ? 0.6 : 1 }}
                    >
                      Gönder
                    </button>
                  </div>
                  <p className={stil.metin30}>{DEPOSIT_NOTE}</p>
                </form>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function rozet(bg: string, renk: string): CSSProperties {
  return {
    background: bg,
    color: renk,
    fontSize: 11.5,
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: 'var(--rr-etiket-kose)',
  };
}

function MesajGorunumu({ m, sikayet }: { m: Mesaj; sikayet: () => void }) {
  if (m.tip === 'sistem') {
    return <div className={stil.kutu17}>{m.metin}</div>;
  }
  if (m.tip === 'kart' && m.kart) {
    const k = m.kart;
    return (
      <div className={cx(stil.kutu18, m.yon === 'giden' ? stil.kutu19 : stil.kutu20)}>
        <div className={cx(stil.kutu21, k.foto ? stil.kutu22 : stil.kutu23)}>
          {k.foto ? (
            // biome-ignore lint/performance/noImgElement: galeri fotoğrafı API'den akar
            <img src={`${API}${k.foto}`} alt="" className={stil.gorsel1} />
          ) : (
            <span aria-hidden="true" className={stil.metin31} />
          )}
        </div>
        <div className={stil.kutu24}>
          {k.satista ? (
            <span className={stil.metin36}>EİDS doğrulandı</span>
          ) : (
            <span className={stil.metin38}>Bu araç artık satışta değil</span>
          )}
          <div className={stil.kutu25}>{k.ad}</div>
          <div className={stil.kutu26}>{k.ozet}</div>
          <div className={stil.kutu27}>
            <span className={stil.metin32}>{binlik(k.fiyat)} TL</span>
            {k.satista ? (
              <Link href={`/arac/${k.no}`} className={stil.bag4}>
                Portföyde gör
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    );
  }
  const giden = m.yon === 'giden';
  if (m.gizli) {
    return (
      <div className={cx(stil.kutu28, giden ? stil.kutu19 : stil.kutu20)}>
        Bu mesaj güvenlik kuralları nedeniyle moderasyon tarafından gizlendi.
      </div>
    );
  }
  return (
    <>
      <div className={cx(stil.kutu29, giden ? stil.kutu30 : stil.kutu31)}>
        <div className={cx(stil.kutu32, giden ? stil.kutu33 : stil.kutu34)}>{m.metin}</div>
        <span className={stil.metin33}>
          {saat(m.zaman)}
          {m.gonderen ? ` · ${m.gonderen}` : ''}
          {!giden && m.tip === 'metin' ? (
            <>
              {' · '}
              <button type="button" onClick={sikayet} className={stil.dugme15}>
                Şikayet et
              </button>
            </>
          ) : null}
        </span>
      </div>
      {m.uyari ? (
        <div role="alert" className={stil.kutu35}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#A3271F"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={stil.gorsel2}
          >
            <path d="M12 3l9 16H3z" />
            <path d="M12 10v4M12 17h.01" />
          </svg>
          <div className={stil.kutu36}>
            <strong>{m.uyari.baslik}</strong> {m.uyari.metin}{' '}
            <button type="button" onClick={sikayet} className={stil.dugme16}>
              Şikayet et
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
