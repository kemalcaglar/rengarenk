'use client';

import { DEPOSIT_NOTE, MESSAGE_MAX } from '@rengarenk/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Sikayet } from '../../../../components/sikayet';
import { API, istek, useGiris } from '../../../../lib/istemci';

/** Fotoğraf gezgini (PortfoyArac.dc.html): büyük görsel, önceki/sonraki, küçük resimler */
export function FotoGezgini({ fotolar, ad }: { fotolar: string[]; ad: string }) {
  const [i, setI] = useState(0);
  const n = fotolar.length;
  const git = (d: number) => setI((x) => (x + d + n) % n);
  const ok = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    width: 44,
    height: 44,
    borderRadius: '50%',
    border: 0,
    background: 'rgba(255,255,255,0.95)',
    fontSize: 20,
    fontWeight: 800,
    color: '#1E2333',
    cursor: 'pointer',
  } as const;
  return (
    <section
      aria-label="Fotoğraflar"
      style={{ background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 18, overflow: 'hidden' }}
    >
      <div
        style={{
          position: 'relative',
          height: 400,
          background: '#EEF3FF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {n ? (
          // biome-ignore lint/performance/noImgElement: galeri fotoğrafı API'den akar
          <img
            src={`${API}${fotolar[i]}`}
            alt={`${ad}, fotoğraf ${i + 1}`}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : null}
        {n > 1 ? (
          <>
            <button
              type="button"
              aria-label="Önceki fotoğraf"
              onClick={() => git(-1)}
              style={{ ...ok, left: 14 }}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Sonraki fotoğraf"
              onClick={() => git(1)}
              style={{ ...ok, right: 14 }}
            >
              ›
            </button>
          </>
        ) : null}
        <span
          style={{
            position: 'absolute',
            left: 14,
            bottom: 12,
            fontSize: 13,
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.95)',
          }}
        >
          {n ? i + 1 : 0} / {n}
        </span>
        <span
          style={{
            position: 'absolute',
            right: 14,
            bottom: 12,
            fontSize: 12,
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.95)',
            color: '#5A6073',
          }}
        >
          Galerinin yüklediği fotoğraflar
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, padding: 10, overflowX: 'auto' }}>
        {fotolar.map((f, j) => (
          <button
            key={f}
            type="button"
            aria-label={`Fotoğraf ${j + 1}`}
            onClick={() => setI(j)}
            style={{
              flex: 'none',
              width: 92,
              height: 62,
              borderRadius: 10,
              border: j === i ? '2px solid #5B8CFF' : '1px solid #E3E6EF',
              padding: 0,
              overflow: 'hidden',
              cursor: 'pointer',
              background: '#F3F5FA',
            }}
          >
            {/* biome-ignore lint/performance/noImgElement: küçük resim */}
            <img
              src={`${API}${f}`}
              alt=""
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </button>
        ))}
      </div>
    </section>
  );
}

const telefon = (e164: string) => e164.replace(/^\+90(\d{3})(\d{3})(\d{2})(\d{2})$/, '0$1 $2 $3 $4');

/** "Telefonu göster" ve WhatsApp: girişli kullanıcıya temsilcinin numarası */
export function Iletisim({ no }: { no: number }) {
  const giris = useGiris();
  const [t, setT] = useState<{ ad: string | null; phone: string | null } | null>(null);
  // Karar 27: alıcı galeriye ilk mesajı kendisi atar; sohbet araç kartıyla başlar, alıcı için ücretsiz
  const [yaz, setYaz] = useState(false);
  const [metin, setMetin] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const gonder = async () => {
    setHata(null);
    setMesgul(true);
    try {
      const r = await istek<{ id: string }>(`/araclar/${no}/mesaj`, { method: 'POST', body: { metin } });
      window.location.href = `/mesajlarim?sohbet=${r.id}`;
    } catch (e) {
      setHata((e as Error).message);
      setMesgul(false);
    }
  };
  const goster = async () => {
    if (!giris) {
      window.location.href = `/giris?sonra=/arac/${no}`;
      return;
    }
    setT(
      await istek<{ ad: string | null; phone: string | null }>(`/araclar/${no}/iletisim`).catch(() => ({
        ad: null,
        phone: null,
      })),
    );
  };
  const kutu = {
    display: 'block',
    textAlign: 'center',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    fontWeight: 800,
    textDecoration: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
  } as const;
  return (
    <>
      {yaz ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <label htmlFor="arac-mesaj" style={{ fontSize: 13.5, fontWeight: 700 }}>
            Galeriye mesajın
          </label>
          <textarea
            id="arac-mesaj"
            rows={4}
            maxLength={MESSAGE_MAX}
            value={metin}
            onChange={(e) => setMetin(e.target.value)}
            placeholder="Merhaba, araç hâlâ satışta mı? Görmeye gelebilir miyim?"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              border: '1px solid #D5DAE5',
              borderRadius: 12,
              padding: 10,
              fontSize: 14.5,
              lineHeight: 1.5,
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
          <span style={{ fontSize: 12, color: '#5A6073' }}>
            Sohbet bu aracın kartıyla başlar. {DEPOSIT_NOTE}
          </span>
          {hata ? (
            <span role="alert" style={{ fontSize: 13, color: '#A3271F' }}>
              {hata}
            </span>
          ) : null}
          <button
            type="button"
            disabled={mesgul || !metin.trim()}
            onClick={gonder}
            style={{
              ...kutu,
              border: 0,
              background: '#5B8CFF',
              color: '#1E2333',
              opacity: mesgul || !metin.trim() ? 0.6 : 1,
            }}
          >
            {mesgul ? 'Gönderiliyor…' : 'Gönder'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            if (!giris) window.location.href = `/giris?sonra=/arac/${no}`;
            else setYaz(true);
          }}
          style={{ ...kutu, border: 0, background: '#5B8CFF', color: '#1E2333' }}
        >
          Bu araç için mesaj gönder
        </button>
      )}
      {t?.phone ? (
        <a
          href={`tel:${t.phone}`}
          style={{ ...kutu, border: '1px solid #D5DAE5', background: '#FFFFFF', color: '#1E2333' }}
        >
          {telefon(t.phone)}
          {t.ad ? ` · ${t.ad}` : ''}
        </a>
      ) : (
        <button
          type="button"
          onClick={goster}
          style={{ ...kutu, border: '1px solid #D5DAE5', background: '#FFFFFF', color: '#1E2333' }}
        >
          Telefonu göster
        </button>
      )}
      {t?.phone ? (
        <a
          href={`https://wa.me/${t.phone.replace(/\D/g, '')}`}
          rel="noreferrer"
          target="_blank"
          style={{ ...kutu, border: '1px solid #3DD68C', color: '#11683F' }}
        >
          WhatsApp
        </a>
      ) : null}
    </>
  );
}

/**
 * "BMW 3 Serisi 320i talebine uyuyor. 6 kriterin 6’sı tutuyor: …" (PortfoyArac.dc.html): girişli alıcının yayındaki
 * taleplerinden bu araca en iyi uyanı. Uyan talep yoksa ya da giriş yapılmamışsa gösterilmez.
 */
export function TalebineUyuyor({ no }: { no: number }) {
  const giris = useGiris();
  const [u, setU] = useState<{ talepNo: number; baslik: string; metin: string } | null>(null);
  useEffect(() => {
    if (!giris) return;
    istek<{ uyan: typeof u }>(`/araclar/${no}/uyum`)
      .then((r) => setU(r.uyan))
      .catch(() => undefined);
  }, [giris, no]);
  if (!u) return null;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
        background: '#FFEEF6',
        border: '1px solid #FFC2DF',
        borderRadius: 16,
        padding: '12px 18px',
        marginBottom: 16,
      }}
    >
      <span style={{ fontSize: 14.5 }}>
        <strong>{u.baslik} talebine uyuyor.</strong> {u.metin}
      </span>
      <Link href={`/talep/${u.talepNo}`} style={{ fontSize: 14, fontWeight: 800 }}>
        Talebimi aç
      </Link>
    </div>
  );
}

/** "Bu ilanı şikayet et" (PortfoyArac.dc.html; Karar 53): girişsiz kullanıcı girişe yönlenir */
export function IlanSikayet({ no }: { no: number }) {
  const giris = useGiris();
  const [acik, setAcik] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!giris) window.location.href = `/giris?sonra=/arac/${no}`;
          else setAcik(true);
        }}
        style={{
          alignSelf: 'flex-start',
          border: 0,
          background: 'transparent',
          fontSize: 13.5,
          fontWeight: 700,
          color: '#A3271F',
          padding: '0 4px',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Bu ilanı şikayet et
      </button>
      {acik ? <Sikayet hedef="arac" id={String(no)} kapat={() => setAcik(false)} /> : null}
    </>
  );
}
