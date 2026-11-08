'use client';

import {
  BLOCK_KINDS,
  type BlockKind,
  GRANT_KINDS,
  type GrantKind,
  PEOPLE_FILTERS,
  REVEAL_SECONDS,
} from '@rengarenk/shared';
import Link from 'next/link';
import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';

type Tip = 'kisi' | 'galeri';
interface Sonuc {
  tip: Tip;
  id: string;
  ad: string;
  bas: string;
  renk: string;
  alt: string;
  durum: string;
}
interface Kart {
  tip: Tip;
  id: string;
  ad: string;
  bas: string;
  renk: string;
  alt: string;
  rozetler: { t: string; bg: string; fg: string }[];
  telefon: string;
  eposta: string;
  sayilar: { ad: string; deger: string }[];
  gecmis: { zamanYazi: string; olay: string; detay: string; renk: string }[];
}
interface KaraSatir {
  id: string;
  tur: BlockKind;
  turAd: string;
  deger: string;
  not: string | null;
  kim: string;
  zaman: string;
}
type Form = null | 'hak' | 'not' | 'uyari' | 'aski' | 'engel';

/** Durum rozeti (YonetimPazar.dc.html › kisiler) */
const DURUM: Record<string, [string, string]> = {
  Aktif: ['#E7FAF0', '#11683F'],
  Askıda: ['#FDECEC', '#A3271F'],
  Engelli: ['#FDECEC', '#A3271F'],
  Kapalı: ['#F3F5FA', '#5A6073'],
};
const kart: CSSProperties = { background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 18 };
const girdi: CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  marginTop: 4,
  border: '1px solid #D5DAE5',
  borderRadius: 10,
  padding: 9,
  fontSize: 14,
  background: '#FFFFFF',
  fontFamily: 'inherit',
};
const KARAR_FORM: Record<'uyari' | 'aski' | 'engel', [string, string]> = {
  uyari: [
    'Uyar',
    'Şablonlu uyarı gider; 30 gün içinde ikinci uyarıda otomatik askı. Kişi 7 gün içinde itiraz edebilir.',
  ],
  aski: ['24 saat askıya al', '24 saat ilk mesaj ve mesaj gönderemez. Kişi 7 gün içinde itiraz edebilir.'],
  engel: ['Kalıcı engelleme öner', 'Öneri onay kuyruğuna düşer; onaya kadar hesap askıda kalır.'],
};

/**
 * Kullanıcılar ve galeriler (YonetimPazar.dc.html › kullanici; Karar 40, 43, 52): arama ve süzgeç, kart (maskeli
 * iletişim, sayılar, işlemler, geçmiş) ve kara liste.
 */
export default function Kullanicilar() {
  const { me } = useKonsol();
  const p = me.permissions;
  const izin = {
    uyari: p['sikayet.coz'] === 'tam',
    aski: p['hesap.askiya_al'] === 'tam',
    engel: p['hesap.kalici_engelle'] === 'tam' || p['hesap.kalici_engelle'] === 'oneri',
    hak: p['hak.tanimla'] === 'tam',
    oturum: p['destek.yanitla'] === 'tam' || p['hesap.askiya_al'] === 'tam',
    iade: p.iade === 'tam' || p.iade === 'oneri',
    kara: p['sikayet.coz'] === 'tam',
  };
  const [q, setQ] = useState('');
  const [tur, setTur] = useState<(typeof PEOPLE_FILTERS)[number][0]>('hepsi');
  const [liste, setListe] = useState<Sonuc[]>([]);
  const [sec, setSec] = useState<{ tip: Tip; id: string } | null>(null);
  const [k, setK] = useState<Kart | null>(null);
  const [acik, setAcik] = useState<{ telefon: string; eposta: string } | null>(null);
  const [gerekceAc, setGerekceAc] = useState(false);
  const [gerekce, setGerekce] = useState('');
  const [form, setForm] = useState<Form>(null);
  const [hak, setHak] = useState<{ tur: GrantKind; adet: number; gerekce: string }>({
    tur: 'ilk_mesaj',
    adet: 5,
    gerekce: '',
  });
  const [metin, setMetin] = useState('');
  const [kara, setKara] = useState<KaraSatir[]>([]);
  const [yeniKara, setYeniKara] = useState<{ tur: BlockKind; deger: string; not: string }>({
    tur: 'telefon',
    deger: '',
    not: '',
  });
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  const ara = useCallback(async (aranan: string, t: string) => {
    try {
      const r = await yonetim<Sonuc[]>(`people?q=${encodeURIComponent(aranan)}&tur=${t}`);
      setListe(r);
      // Destek ekranından gelen bağlantı: ?kisi=<id> ya da ?galeri=<id>
      const u = new URLSearchParams(window.location.search);
      const dis = u.get('kisi')
        ? { tip: 'kisi' as Tip, id: u.get('kisi') as string }
        : u.get('galeri')
          ? { tip: 'galeri' as Tip, id: u.get('galeri') as string }
          : null;
      setSec((s) => s ?? dis ?? (r[0] ? { tip: r[0].tip, id: r[0].id } : null));
    } catch (e) {
      setHata((e as Error).message);
    }
  }, []);
  useEffect(() => {
    const z = setTimeout(() => ara(q, tur), 300);
    return () => clearTimeout(z);
  }, [q, tur, ara]);
  useEffect(() => {
    if (izin.kara)
      yonetim<KaraSatir[]>('blocklist')
        .then(setKara)
        .catch(() => undefined);
  }, [izin.kara]);
  useEffect(() => {
    if (!sec) return;
    setK(null);
    setAcik(null);
    setGerekceAc(false);
    setForm(null);
    yonetim<Kart>(`people/${sec.tip}/${sec.id}`)
      .then(setK)
      .catch((e: Error) => setHata(e.message));
  }, [sec]);
  // Açılan veri 5 dakika sonra yeniden maskelenir
  useEffect(() => {
    if (!acik) return;
    const z = setTimeout(() => setAcik(null), REVEAL_SECONDS * 1000);
    return () => clearTimeout(z);
  }, [acik]);

  async function islem(yol: string, body: object, mesaj: string) {
    if (!sec) return;
    setHata(null);
    try {
      setK(await yonetim<Kart>(`people/${sec.tip}/${sec.id}/${yol}`, { method: 'POST', body }));
      setBilgi(mesaj);
      setForm(null);
      setMetin('');
      ara(q, tur);
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function goster() {
    if (!sec) return;
    try {
      setAcik(await yonetim(`people/${sec.tip}/${sec.id}/reveal`, { method: 'POST', body: { gerekce } }));
      setGerekceAc(false);
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function karaEkle() {
    try {
      setKara(
        await yonetim<KaraSatir[]>('blocklist', {
          method: 'POST',
          body: {
            tur: yeniKara.tur,
            deger: yeniKara.deger,
            ...(yeniKara.not.trim() ? { not: yeniKara.not } : {}),
          },
        }),
      );
      setYeniKara({ ...yeniKara, deger: '', not: '' });
      setBilgi('Kara listeye eklendi.');
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function karaCikar(id: string) {
    try {
      setKara(await yonetim<KaraSatir[]>(`blocklist/${id}`, { method: 'DELETE' }));
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  const dugmeler: [string, Form | 'oturum' | 'iade', boolean, string, string][] = [
    ['Uyar', 'uyari', izin.uyari, '#D5DAE5', '#1E2333'],
    ['24 saat askıya al', 'aski', izin.aski, '#D5DAE5', '#1E2333'],
    ['Hak tanımla', 'hak', izin.hak, '#D5DAE5', '#1E2333'],
    ['Oturumları kapat', 'oturum', izin.oturum, '#D5DAE5', '#1E2333'],
    ['Not ekle', 'not', true, '#D5DAE5', '#1E2333'],
    ['İade öner', 'iade', izin.iade, '#F4DC9A', '#7A5300'],
    ['Kalıcı engelleme öner', 'engel', izin.engel, '#E5A6A1', '#A3271F'],
  ];

  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Kullanıcılar ve galeriler</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#5A6073' }}>
          Kişisel veriler maskeli gelir. Açmak gerekçe ister ve işlem kaydına girer.
        </p>
      </div>
      {hata ? <p style={{ color: '#A3271F', fontWeight: 700 }}>{hata}</p> : null}
      {bilgi ? (
        <p
          role="status"
          style={{
            background: '#E7FAF0',
            color: '#11683F',
            borderRadius: 12,
            padding: '10px 14px',
            fontWeight: 700,
          }}
        >
          {bilgi}
        </p>
      ) : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <label
          htmlFor="ara"
          style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}
        >
          Kullanıcı ara
        </label>
        <input
          id="ara"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ad, galeri adı, talep no veya e-postanın ilk harfleri"
          style={{
            flex: '1 1 320px',
            minWidth: 0,
            border: '1px solid #D5DAE5',
            borderRadius: 12,
            padding: '11px 14px',
            fontSize: 14,
            background: '#FFFFFF',
            fontFamily: 'inherit',
          }}
        />
        {PEOPLE_FILTERS.map(([key, ad]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTur(key)}
            aria-pressed={tur === key}
            style={
              tur === key
                ? {
                    border: 0,
                    background: '#1E2333',
                    borderRadius: 999,
                    padding: '9px 14px',
                    fontSize: 13.5,
                    fontWeight: 800,
                    color: '#FFFFFF',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }
                : {
                    border: '1px solid #D5DAE5',
                    background: '#FFFFFF',
                    borderRadius: 999,
                    padding: '8px 13px',
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: '#1E2333',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }
            }
          >
            {ad}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <section
          aria-label="Sonuçlar"
          style={{ ...kart, flex: '1 1 260px', maxWidth: 300, minWidth: 0, padding: 8 }}
        >
          {!liste.length ? (
            <p style={{ margin: 0, padding: 12, fontSize: 13.5, color: '#5A6073' }}>Sonuç yok.</p>
          ) : null}
          {liste.map((x) => {
            const on = sec?.id === x.id;
            const [db, df] = DURUM[x.durum] ?? DURUM.Aktif;
            return (
              <button
                key={`${x.tip}-${x.id}`}
                type="button"
                onClick={() => {
                  setSec({ tip: x.tip, id: x.id });
                  setBilgi(null);
                }}
                aria-current={on}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  textAlign: 'left',
                  border: 0,
                  background: on ? '#F3EFFF' : 'transparent',
                  borderRadius: 12,
                  padding: 10,
                  cursor: 'pointer',
                  color: '#1E2333',
                  fontFamily: 'inherit',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    flex: 'none',
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: x.renk,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12.5,
                    fontWeight: 800,
                  }}
                >
                  {x.bas}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 800 }}>{x.ad}</span>
                  <span style={{ display: 'block', fontSize: 12, color: '#5A6073' }}>{x.alt}</span>
                </span>
                <span
                  style={{
                    flex: 'none',
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '2px 7px',
                    borderRadius: 999,
                    background: db,
                    color: df,
                  }}
                >
                  {x.durum}
                </span>
              </button>
            );
          })}
        </section>

        <section
          aria-labelledby="kart"
          style={{ ...kart, flex: '999 1 520px', minWidth: 0, overflow: 'hidden' }}
        >
          {k ? (
            <>
              <div
                style={{
                  padding: 18,
                  borderBottom: '1px solid #EEF0F5',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 14,
                  alignItems: 'flex-start',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    flex: 'none',
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    background: k.renk,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    fontWeight: 800,
                  }}
                >
                  {k.bas}
                </span>
                <div style={{ flex: '999 1 280px', minWidth: 0 }}>
                  <h2 id="kart" style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
                    {k.ad}
                  </h2>
                  <div style={{ fontSize: 13, color: '#3A4052', marginTop: 2 }}>{k.alt}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {k.rozetler.map((r) => (
                      <span
                        key={r.t}
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          padding: '3px 9px',
                          borderRadius: 999,
                          background: r.bg,
                          color: r.fg,
                        }}
                      >
                        {r.t}
                      </span>
                    ))}
                  </div>
                </div>
                <div
                  style={{
                    flex: '1 1 220px',
                    minWidth: 0,
                    background: '#F6F8FD',
                    borderRadius: 12,
                    padding: '10px 12px',
                    fontSize: 13,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ color: '#5A6073' }}>Telefon</span>
                    <strong>{acik?.telefon ?? k.telefon}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
                    <span style={{ color: '#5A6073' }}>E-posta</span>
                    <strong style={{ overflowWrap: 'anywhere', textAlign: 'right' }}>
                      {acik?.eposta ?? k.eposta}
                    </strong>
                  </div>
                  {acik ? (
                    <div style={{ marginTop: 8, fontSize: 11.5, color: '#7A5300', fontWeight: 700 }}>
                      Açıldı · işlem kaydına yazıldı · 5 dakika sonra yeniden maskelenir
                    </div>
                  ) : gerekceAc ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        goster();
                      }}
                      style={{ display: 'flex', gap: 6, marginTop: 8 }}
                    >
                      <input
                        value={gerekce}
                        onChange={(e) => setGerekce(e.target.value)}
                        aria-label="Gerekçe"
                        placeholder="Ör. Destek talebi D-20952, geri dönüş"
                        style={{
                          flex: 1,
                          minWidth: 0,
                          border: '1px solid #D5DAE5',
                          borderRadius: 8,
                          padding: '6px 8px',
                          fontSize: 12.5,
                          fontFamily: 'inherit',
                        }}
                      />
                      <button
                        type="submit"
                        style={{
                          border: 0,
                          background: '#5B8CFF',
                          borderRadius: 8,
                          padding: '6px 10px',
                          fontSize: 12.5,
                          fontWeight: 800,
                          color: '#1E2333',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        Göster
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setGerekceAc(true)}
                      style={{
                        marginTop: 8,
                        border: 0,
                        background: 'transparent',
                        padding: 0,
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: '#2450C8',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      Gerekçe yazıp göster
                    </button>
                  )}
                </div>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                  borderBottom: '1px solid #EEF0F5',
                }}
              >
                {k.sayilar.map((n) => (
                  <div key={n.ad} style={{ padding: '12px 16px', borderRight: '1px solid #EEF0F5' }}>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{n.deger}</div>
                    <div style={{ fontSize: 12, color: '#5A6073' }}>{n.ad}</div>
                  </div>
                ))}
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  padding: '14px 18px',
                  borderBottom: '1px solid #EEF0F5',
                }}
              >
                {dugmeler.map(([ad, ne, var_, kenar, renk]) =>
                  ne === 'iade' ? (
                    var_ ? (
                      <Link
                        key={ad}
                        href="/odemeler"
                        style={{
                          border: `1px solid ${kenar}`,
                          background: '#FFFFFF',
                          borderRadius: 10,
                          padding: '8px 12px',
                          fontSize: 13,
                          fontWeight: 700,
                          color: renk,
                          textDecoration: 'none',
                        }}
                      >
                        {ad}
                      </Link>
                    ) : null
                  ) : (
                    <button
                      key={ad}
                      type="button"
                      disabled={!var_}
                      title={var_ ? undefined : 'Bu işlem için yetkin yok'}
                      onClick={() =>
                        ne === 'oturum'
                          ? islem('sessions/revoke', {}, 'Tüm cihazlardaki oturumlar kapatıldı.')
                          : setForm(form === ne ? null : (ne as Form))
                      }
                      style={{
                        border: `1px solid ${kenar}`,
                        background: form === ne ? '#F6F8FD' : '#FFFFFF',
                        borderRadius: 10,
                        padding: '8px 12px',
                        fontSize: 13,
                        fontWeight: 700,
                        color: var_ ? renk : '#AEB5C4',
                        cursor: var_ ? 'pointer' : 'default',
                        fontFamily: 'inherit',
                      }}
                    >
                      {ad}
                    </button>
                  ),
                )}
              </div>
              {form === 'hak' ? (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'flex-end',
                    gap: 10,
                    padding: '14px 18px',
                    borderBottom: '1px solid #EEF0F5',
                    background: '#F6F8FD',
                  }}
                >
                  <label style={{ flex: '1 1 180px', fontSize: 12.5, fontWeight: 700 }}>
                    Hak
                    <select
                      value={hak.tur}
                      onChange={(e) => setHak({ ...hak, tur: e.target.value as GrantKind })}
                      style={girdi}
                    >
                      {(Object.keys(GRANT_KINDS) as GrantKind[]).map((g) => (
                        <option key={g} value={g}>
                          {GRANT_KINDS[g]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ flex: '0 1 90px', fontSize: 12.5, fontWeight: 700 }}>
                    Adet
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={hak.adet}
                      onChange={(e) => setHak({ ...hak, adet: Number(e.target.value) })}
                      style={girdi}
                    />
                  </label>
                  <label style={{ flex: '2 1 220px', fontSize: 12.5, fontWeight: 700 }}>
                    Gerekçe
                    <input
                      value={hak.gerekce}
                      onChange={(e) => setHak({ ...hak, gerekce: e.target.value })}
                      placeholder="Ör. Acil etiketi hatası nedeniyle gönül alma"
                      style={girdi}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      islem(
                        'grant',
                        hak,
                        `${hak.adet} ${GRANT_KINDS[hak.tur].toLocaleLowerCase('tr-TR')} tanımlandı; kişiye bildirim gitti.`,
                      )
                    }
                    style={{
                      border: 0,
                      background: '#5B8CFF',
                      borderRadius: 10,
                      padding: '10px 16px',
                      fontSize: 14,
                      fontWeight: 800,
                      color: '#1E2333',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Tanımla
                  </button>
                  <p style={{ flex: '1 1 100%', margin: 0, fontSize: 12, color: '#5A6073' }}>
                    Destek rolü kişi başına ayda en fazla 10 hak tanımlayabilir; üstü yönetici onayı ister.
                    İade bu ekrandan yapılmaz, yalnızca önerilir.
                  </p>
                </div>
              ) : form === 'not' || form === 'uyari' || form === 'aski' || form === 'engel' ? (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'flex-end',
                    gap: 10,
                    padding: '14px 18px',
                    borderBottom: '1px solid #EEF0F5',
                    background: '#F6F8FD',
                  }}
                >
                  <label style={{ flex: '1 1 320px', fontSize: 12.5, fontWeight: 700 }}>
                    {form === 'not' ? 'Not (yalnızca çalışanlar görür)' : 'Gerekçe (kullanıcıya gider)'}
                    <input
                      value={metin}
                      onChange={(e) => setMetin(e.target.value)}
                      maxLength={500}
                      style={girdi}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      form === 'not'
                        ? islem('notes', { metin }, 'Not eklendi; yalnızca çalışanlar görür.')
                        : islem(
                            'action',
                            { karar: form, gerekce: metin },
                            form === 'engel'
                              ? 'Kalıcı engelleme önerisi onay kuyruğuna eklendi.'
                              : form === 'aski'
                                ? '24 saat askıya alındı. Kişi 7 gün içinde itiraz edebilir.'
                                : 'Uyarı gönderildi ve işlem kaydına yazıldı.',
                          )
                    }
                    style={{
                      border: 0,
                      background: form === 'engel' ? '#E5484D' : '#5B8CFF',
                      borderRadius: 10,
                      padding: '10px 16px',
                      fontSize: 14,
                      fontWeight: 800,
                      color: form === 'engel' ? '#FFFFFF' : '#1E2333',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {form === 'not' ? 'Ekle' : KARAR_FORM[form][0]}
                  </button>
                  {form !== 'not' ? (
                    <p style={{ flex: '1 1 100%', margin: 0, fontSize: 12, color: '#5A6073' }}>
                      {KARAR_FORM[form][1]}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <h3 style={{ margin: 0, padding: '14px 18px 6px', fontSize: 14, fontWeight: 800 }}>Geçmiş</h3>
              {k.gecmis.map((g, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: geçmiş sırası sabit
                  key={i}
                  style={{ display: 'flex', gap: 12, padding: '9px 18px', fontSize: 13 }}
                >
                  <span style={{ flex: '0 0 82px', color: '#5A6073', fontWeight: 600 }}>{g.zamanYazi}</span>
                  <span
                    aria-hidden="true"
                    style={{
                      flex: 'none',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      marginTop: 6,
                      background: g.renk,
                    }}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 700 }}>{g.olay}</span>
                    {g.detay ? (
                      <span style={{ display: 'block', fontSize: 12, color: '#5A6073', marginTop: 1 }}>
                        {g.detay}
                      </span>
                    ) : null}
                  </span>
                </div>
              ))}
              <div style={{ height: 10 }} />
            </>
          ) : (
            <p style={{ margin: 0, padding: 18, fontSize: 13.5, color: '#5A6073' }}>
              {sec ? 'Yükleniyor…' : 'Soldan bir kişi ya da galeri seç.'}
            </p>
          )}
        </section>
      </div>

      {izin.kara ? (
        <section style={{ ...kart, marginTop: 16, overflow: 'hidden' }} aria-labelledby="kara">
          <div style={{ padding: '16px 18px', borderBottom: '1px solid #EEF0F5' }}>
            <h2 id="kara" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
              Kara liste
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#5A6073' }}>
              Listedeki telefon ve IP adresine giriş kodu gönderilmez; IBAN içeren mesaj gizlenir ve
              moderasyona kritik olarak düşer. Değerin kendisi saklanmaz.
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              karaEkle();
            }}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'flex-end',
              gap: 10,
              padding: '14px 18px',
              borderBottom: '1px solid #EEF0F5',
              background: '#F6F8FD',
            }}
          >
            <label style={{ flex: '0 1 150px', fontSize: 12.5, fontWeight: 700 }}>
              Tür
              <select
                value={yeniKara.tur}
                onChange={(e) => setYeniKara({ ...yeniKara, tur: e.target.value as BlockKind })}
                style={girdi}
              >
                {(Object.keys(BLOCK_KINDS) as BlockKind[]).map((b) => (
                  <option key={b} value={b}>
                    {BLOCK_KINDS[b]}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ flex: '1 1 220px', fontSize: 12.5, fontWeight: 700 }}>
              Değer
              <input
                value={yeniKara.deger}
                onChange={(e) => setYeniKara({ ...yeniKara, deger: e.target.value })}
                placeholder={
                  yeniKara.tur === 'telefon'
                    ? '0532 111 22 33'
                    : yeniKara.tur === 'iban'
                      ? 'TR00 0000 …'
                      : '203.0.113.7'
                }
                style={girdi}
              />
            </label>
            <label style={{ flex: '2 1 220px', fontSize: 12.5, fontWeight: 700 }}>
              Not
              <input
                value={yeniKara.not}
                onChange={(e) => setYeniKara({ ...yeniKara, not: e.target.value })}
                placeholder="Ör. Kapora dolandırıcılığı, S-1024"
                style={girdi}
              />
            </label>
            <button
              type="submit"
              style={{
                border: 0,
                background: '#E5484D',
                borderRadius: 10,
                padding: '10px 16px',
                fontSize: 14,
                fontWeight: 800,
                color: '#FFFFFF',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Listeye ekle
            </button>
          </form>
          {!kara.length ? (
            <p style={{ margin: 0, padding: '12px 18px', fontSize: 13.5, color: '#5A6073' }}>
              Kara liste boş.
            </p>
          ) : null}
          {kara.map((x) => (
            <div
              key={x.id}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '6px 16px',
                padding: '11px 18px',
                borderBottom: '1px solid #EEF0F5',
                fontSize: 13.5,
              }}
            >
              <span style={{ flex: '0 0 90px', fontWeight: 800 }}>{x.turAd}</span>
              <span style={{ flex: '1 1 200px', fontWeight: 700 }}>{x.deger}</span>
              <span style={{ flex: '2 1 240px', color: '#5A6073', fontSize: 12.5 }}>
                {x.not ? `${x.not} · ` : ''}
                {x.kim}
              </span>
              <button
                type="button"
                onClick={() => karaCikar(x.id)}
                style={{
                  border: 0,
                  background: 'transparent',
                  padding: '6px 4px',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#5A6073',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Listeden çıkar
              </button>
            </div>
          ))}
        </section>
      ) : null}
    </>
  );
}
