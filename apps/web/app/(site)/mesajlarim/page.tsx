'use client';

import { DEPOSIT_NOTE, MESSAGE_MAX } from '@rengarenk/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type CSSProperties, type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { PuanVer } from '../../../components/puan-ver';
import { Sikayet } from '../../../components/sikayet';
import { useCanli } from '../../../lib/canli';
import { API, binlik, istek, useGiris } from '../../../lib/istemci';

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

const kenarDugme: CSSProperties = {
  border: '1px solid #D5DAE5',
  background: '#FFFFFF',
  borderRadius: 12,
  padding: '9px 13px',
  fontSize: 13.5,
  fontWeight: 700,
  color: '#1E2333',
  cursor: 'pointer',
  textDecoration: 'none',
  fontFamily: 'inherit',
};

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
    <div style={{ maxWidth: 1360, margin: '0 auto', padding: 24 }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'stretch',
          background: '#FFFFFF',
          border: '1px solid #E3E6EF',
          borderRadius: 20,
          overflow: 'hidden',
          minHeight: 760,
        }}
      >
        <section
          aria-label="Sohbetler"
          style={{
            flex: '1 1 340px',
            maxWidth: 400,
            minWidth: 0,
            borderRight: '1px solid #E3E6EF',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ padding: '18px 18px 12px' }}>
            <h1 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 800 }}>Mesajlarım</h1>
            <div role="tablist" style={{ display: 'flex', gap: 6 }}>
              {FILTRE.map(([k, ad]) => {
                const on = filtre === k;
                return (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setFiltre(k)}
                    style={{
                      border: 0,
                      background: on ? '#EEF3FF' : 'transparent',
                      borderRadius: 999,
                      padding: '8px 13px',
                      fontSize: 13.5,
                      fontWeight: on ? 800 : 600,
                      color: on ? '#1E2333' : '#5A6073',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {ad}
                  </button>
                );
              })}
            </div>
          </div>
          {liste && !gorunen.length ? (
            <p
              style={{
                margin: 0,
                padding: '14px 18px',
                fontSize: 14,
                color: '#5A6073',
                borderTop: '1px solid #EEF0F5',
              }}
            >
              {liste.length
                ? 'Bu süzgeçte sohbet yok.'
                : 'Henüz mesajın yok. Satıcılar talebine yazınca ya da sen bir talebe yazınca burada görünür.'}
            </p>
          ) : null}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {destek ? (
              <li>
                <Link
                  href={`/destek?no=${destek.no}`}
                  style={{
                    display: 'flex',
                    gap: 12,
                    borderTop: '1px solid #EEF0F5',
                    background: '#FFFFFF',
                    padding: '14px 18px',
                    color: '#1E2333',
                    textDecoration: 'none',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      flex: 'none',
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: '#E7FAF0',
                      color: '#11683F',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 14,
                    }}
                  >
                    RD
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: destek.okunmamis ? 800 : 700 }}>
                        Rengarenk Destek
                      </span>
                      <span style={{ fontSize: 12, color: '#5A6073' }}>{destek.durumAd}</span>
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 13.5,
                        color: '#3A4052',
                        marginTop: 3,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontWeight: destek.okunmamis ? 700 : 400,
                      }}
                    >
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
                    onClick={() => setAktif(x.id)}
                    aria-current={on ? 'true' : undefined}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      border: 0,
                      borderTop: '1px solid #EEF0F5',
                      background: on ? '#EEF3FF' : '#FFFFFF',
                      padding: '14px 18px',
                      display: 'flex',
                      gap: 12,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: avatar(x),
                        color: '#1E2333',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: 14,
                        flex: 'none',
                      }}
                    >
                      {x.bas}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: 14.5, fontWeight: 800, color: '#1E2333' }}>{x.ad}</span>
                        <span style={{ fontSize: 12, color: '#5A6073', flex: 'none' }}>
                          {listeZamani(x.zaman)}
                        </span>
                      </span>
                      <span
                        style={{
                          display: 'block',
                          fontSize: 12.5,
                          color: '#2450C8',
                          fontWeight: 600,
                          marginTop: 2,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {x.talep?.baslik ?? x.arac?.ad ?? ''}
                      </span>
                      <span
                        style={{
                          display: 'block',
                          fontSize: 13.5,
                          color: '#3A4052',
                          marginTop: 3,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {x.son}
                      </span>
                      <span style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                        {x.bekliyor ? (
                          <span style={rozet('#FFF6DF', '#7A5300')}>
                            {x.taraf === 'alici' ? 'Yanıt bekliyor' : 'Alıcının yanıtı bekleniyor'}
                          </span>
                        ) : null}
                        {x.uyari ? <span style={rozet('#FDECEC', '#A3271F')}>Güvenlik uyarısı</span> : null}
                        {x.numara && x.taraf === 'satici' ? (
                          <span style={rozet('#E7FAF0', '#11683F')}>Numara paylaşıldı</span>
                        ) : null}
                        {x.okunmamis ? (
                          <span style={{ ...rozet('#FF6FB5', '#1E2333'), fontWeight: 800 }}>Yeni</span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section
          aria-label="Sohbet"
          style={{ flex: '999 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column' }}
        >
          {!s ? (
            <p style={{ margin: 'auto', color: '#5A6073', fontSize: 14 }}>
              {liste && !liste.length ? 'Sohbet seçilmedi.' : 'Yükleniyor…'}
            </p>
          ) : (
            <>
              <div
                style={{
                  padding: '16px 22px',
                  borderBottom: '1px solid #E3E6EF',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: '50%',
                      background: avatar({ galeri: !!s.karsi.galeri, ad: s.karsi.ad }),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      flex: 'none',
                    }}
                  >
                    {s.karsi.bas}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{s.karsi.ad}</h2>
                    <p style={{ margin: '2px 0 0', fontSize: 13, color: '#5A6073' }}>
                      {s.karsi.alt}
                      {s.karsi.telefon ? ` · Telefon: ${s.karsi.telefon}` : ''}
                    </p>
                    {s.karsi.rozetler.some((r) => r.key !== 'onay') ? (
                      <span style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 5 }}>
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
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {s.puan.uygun ? (
                    <button
                      type="button"
                      onClick={() => setPuanAcik(true)}
                      style={{
                        ...kenarDugme,
                        background: '#1E2333',
                        color: '#FFFFFF',
                        border: '1px solid #1E2333',
                      }}
                    >
                      ★ Puan ver
                    </button>
                  ) : s.puan.verilen ? (
                    <span
                      style={{ ...kenarDugme, cursor: 'default', color: '#7A5300', background: '#FFF6DF' }}
                    >
                      {'★'.repeat(s.puan.verilen)} verdin
                    </span>
                  ) : null}
                  {s.karsi.galeri && s.taraf === 'alici' ? (
                    <Link href={`/galeri/${s.karsi.galeri.slug}`} style={kenarDugme}>
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
                      style={kenarDugme}
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
                      style={kenarDugme}
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
                        style={{
                          ...kenarDugme,
                          color: '#A3271F',
                          opacity: son ? 1 : 0.55,
                          cursor: son ? 'pointer' : 'default',
                        }}
                      >
                        Şikayet et
                      </button>
                    );
                  })()}
                </div>
              </div>

              {s.talep || s.arac ? (
                <Link
                  href={s.talep ? `/talep/${s.talep.no}` : `/arac/${s.arac?.no}`}
                  style={{
                    margin: '14px 22px 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    background: '#F6F8FD',
                    border: '1px solid #E3E6EF',
                    borderRadius: 14,
                    padding: '10px 14px',
                    color: '#1E2333',
                    textDecoration: 'none',
                  }}
                >
                  <span
                    style={{
                      width: 64,
                      height: 40,
                      borderRadius: 8,
                      background: '#EEF3FF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flex: 'none',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 54,
                        maxWidth: '100%',
                        aspectRatio: '54 / 20',
                        borderRadius: 10,
                        background: 'linear-gradient(135deg, #C9D3E6, #EEF1F7)',
                      }}
                    />
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 12, color: '#5A6073' }}>
                      {s.talep ? (s.taraf === 'alici' ? 'Talebin' : 'Talep') : 'Portföy aracı'}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 14,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {s.talep?.baslik ?? s.arac?.ad}
                    </span>
                  </span>
                </Link>
              ) : null}

              <div
                style={{ flex: 1, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                {s.mesajlar.map((m) => {
                  const g = gunAdi(m.zaman);
                  const ayrac = g !== sonGun;
                  sonGun = g;
                  return (
                    <div key={m.id} style={{ display: 'contents' }}>
                      {ayrac ? (
                        <span
                          style={{
                            alignSelf: 'center',
                            fontSize: 12,
                            fontWeight: 700,
                            color: '#5A6073',
                            background: '#F3F5FA',
                            padding: '4px 12px',
                            borderRadius: 999,
                          }}
                        >
                          {g}
                        </span>
                      ) : null}
                      <MesajGorunumu m={m} sikayet={() => setSikayet(m.id)} />
                    </div>
                  );
                })}
                <div ref={alt} />
                {sikayet ? <Sikayet hedef="mesaj" id={sikayet} kapat={() => setSikayet(null)} /> : null}
              </div>

              {s.ilkMesajBekliyor && !yanitla ? (
                <div
                  style={{
                    margin: '0 22px 18px',
                    background: '#FFF6DF',
                    borderRadius: 16,
                    padding: '16px 18px',
                  }}
                >
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: '#4A3500' }}>
                    <strong>Bu satıcı sana ilk mesajını gönderdi.</strong> Yanıtlarsan sohbet açılır.
                    Yanıtlamazsan bu satıcı aynı talebine tekrar yazamaz.
                  </p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button
                      type="button"
                      onClick={() => setYanitla(true)}
                      style={{
                        border: 0,
                        background: '#5B8CFF',
                        borderRadius: 12,
                        padding: '11px 18px',
                        fontSize: 14.5,
                        fontWeight: 800,
                        color: '#1E2333',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      Yanıtla
                    </button>
                    <button
                      type="button"
                      disabled={mesgul}
                      onClick={() =>
                        islem(() => istek<Sohbet>(`/conversations/${s.id}/decline`, { method: 'POST' }))
                      }
                      style={{
                        border: '1px solid #D9C48A',
                        background: '#FFFFFF',
                        borderRadius: 12,
                        padding: '11px 16px',
                        fontSize: 14,
                        fontWeight: 700,
                        color: '#4A3500',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      İlgilenmiyorum
                    </button>
                  </div>
                </div>
              ) : null}

              {!s.yazabilir ? (
                <p
                  style={{
                    margin: 0,
                    borderTop: '1px solid #E3E6EF',
                    padding: '14px 22px 18px',
                    fontSize: 13.5,
                    color: '#5A6073',
                  }}
                >
                  {s.durum === 'DECLINED'
                    ? 'Bu sohbet kapandı; alıcı ilgilenmediğini belirtti.'
                    : s.durum === 'WAITING'
                      ? 'İlk mesajın gönderildi. Alıcı yanıt verene kadar ikinci mesaj atamazsın.'
                      : 'Alıcı bu hesaptan mesaj almak istemiyor.'}
                </p>
              ) : null}
              {hata ? (
                <p role="alert" style={{ margin: '0 22px 10px', fontSize: 13.5, color: '#A3271F' }}>
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
                <form onSubmit={gonder} style={{ borderTop: '1px solid #E3E6EF', padding: '14px 22px 18px' }}>
                  {s.kartEkleyebilir && araclar.length ? (
                    <label
                      style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 8 }}
                    >
                      Araç kartı
                      <select
                        value={kart}
                        onChange={(e) => setKart(e.target.value)}
                        style={{
                          border: '1px solid #D5DAE5',
                          borderRadius: 10,
                          padding: '6px 8px',
                          fontSize: 13,
                          fontFamily: 'inherit',
                        }}
                      >
                        <option value="">Ekleme</option>
                        {araclar.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.ad}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                    <label
                      htmlFor="yaz"
                      style={{
                        position: 'absolute',
                        width: 1,
                        height: 1,
                        overflow: 'hidden',
                        clip: 'rect(0 0 0 0)',
                      }}
                    >
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
                      style={{
                        flex: 1,
                        minWidth: 0,
                        border: '1px solid #D5DAE5',
                        borderRadius: 14,
                        padding: '12px 14px',
                        fontSize: 15,
                        resize: 'none',
                        fontFamily: 'inherit',
                      }}
                    />
                    <button
                      type="submit"
                      disabled={mesgul || !metin.trim()}
                      style={{
                        border: 0,
                        background: '#5B8CFF',
                        borderRadius: 14,
                        padding: '14px 20px',
                        fontSize: 15,
                        fontWeight: 800,
                        color: '#1E2333',
                        cursor: 'pointer',
                        opacity: mesgul || !metin.trim() ? 0.6 : 1,
                        fontFamily: 'inherit',
                      }}
                    >
                      Gönder
                    </button>
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: 12.5, color: '#5A6073' }}>{DEPOSIT_NOTE}</p>
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
    borderRadius: 999,
  };
}

function MesajGorunumu({ m, sikayet }: { m: Mesaj; sikayet: () => void }) {
  if (m.tip === 'sistem') {
    return (
      <div
        style={{
          alignSelf: 'center',
          maxWidth: '80%',
          textAlign: 'center',
          fontSize: 13,
          color: '#3A4052',
          background: '#EEF3FF',
          borderRadius: 12,
          padding: '10px 14px',
        }}
      >
        {m.metin}
      </div>
    );
  }
  if (m.tip === 'kart' && m.kart) {
    const k = m.kart;
    return (
      <div
        style={{
          alignSelf: m.yon === 'giden' ? 'flex-end' : 'flex-start',
          width: 340,
          maxWidth: '72%',
          border: '1px solid #E3E6EF',
          borderRadius: 16,
          overflow: 'hidden',
          background: '#FFFFFF',
        }}
      >
        <div
          style={{
            background: '#FFF6DF',
            padding: k.foto ? 0 : 14,
            display: 'flex',
            justifyContent: 'center',
            height: k.foto ? 150 : undefined,
          }}
        >
          {k.foto ? (
            // biome-ignore lint/performance/noImgElement: galeri fotoğrafı API'den akar
            <img
              src={`${API}${k.foto}`}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span
              aria-hidden="true"
              style={{
                width: 200,
                maxWidth: '100%',
                aspectRatio: '200 / 73',
                borderRadius: 10,
                background: 'linear-gradient(135deg, #C9D3E6, #EEF1F7)',
              }}
            />
          )}
        </div>
        <div style={{ padding: '12px 14px' }}>
          {k.satista ? (
            <span style={rozet('#E7FAF0', '#11683F')}>EİDS doğrulandı</span>
          ) : (
            <span style={rozet('#F3F5FA', '#5A6073')}>Bu araç artık satışta değil</span>
          )}
          <div style={{ fontSize: 15, fontWeight: 800, marginTop: 8 }}>{k.ad}</div>
          <div style={{ fontSize: 13, color: '#5A6073', marginTop: 3 }}>{k.ozet}</div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              marginTop: 10,
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 800, color: '#2450C8' }}>{binlik(k.fiyat)} TL</span>
            {k.satista ? (
              <Link href={`/arac/${k.no}`} style={{ fontSize: 13.5, fontWeight: 700 }}>
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
      <div
        style={{
          alignSelf: giden ? 'flex-end' : 'flex-start',
          maxWidth: '72%',
          border: '1px dashed #AEB5C4',
          borderRadius: 16,
          padding: '10px 14px',
          fontSize: 13.5,
          fontStyle: 'italic',
          color: '#5A6073',
        }}
      >
        Bu mesaj güvenlik kuralları nedeniyle moderasyon tarafından gizlendi.
      </div>
    );
  }
  return (
    <>
      <div
        style={{
          alignSelf: giden ? 'flex-end' : 'flex-start',
          maxWidth: '72%',
          textAlign: giden ? 'right' : 'left',
        }}
      >
        <div
          style={{
            background: giden ? '#5B8CFF' : '#F3F5FA',
            borderRadius: giden ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
            padding: '12px 14px',
            fontSize: 14.5,
            lineHeight: 1.55,
            textAlign: 'left',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
          }}
        >
          {m.metin}
        </div>
        <span style={{ display: 'block', fontSize: 11.5, color: '#5A6073', marginTop: 4 }}>
          {saat(m.zaman)}
          {m.gonderen ? ` · ${m.gonderen}` : ''}
          {!giden && m.tip === 'metin' ? (
            <>
              {' · '}
              <button
                type="button"
                onClick={sikayet}
                style={{
                  border: 0,
                  background: 'transparent',
                  padding: 0,
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: '#A3271F',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Şikayet et
              </button>
            </>
          ) : null}
        </span>
      </div>
      {m.uyari ? (
        <div
          role="alert"
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
            background: '#FDECEC',
            borderRadius: 14,
            padding: '12px 14px',
          }}
        >
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
            style={{ flex: 'none' }}
          >
            <path d="M12 3l9 16H3z" />
            <path d="M12 10v4M12 17h.01" />
          </svg>
          <div style={{ fontSize: 13.5, lineHeight: 1.5, color: '#6E1A15' }}>
            <strong>{m.uyari.baslik}</strong> {m.uyari.metin}{' '}
            <button
              type="button"
              onClick={sikayet}
              style={{
                border: 0,
                background: 'transparent',
                padding: 0,
                fontSize: 13.5,
                fontWeight: 800,
                color: '#A3271F',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Şikayet et
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
