'use client';

import { DEPOSIT_NOTE, MESSAGE_MAX } from '@rengarenk/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Sikayet } from '../../../../components/sikayet';
import { cx } from '../../../../lib/cx';
import { API, istek, useGiris } from '../../../../lib/istemci';
import stil from './arac-istemci.module.css';

/** Fotoğraf gezgini (PortfoyArac.dc.html): büyük görsel, önceki/sonraki, küçük resimler */
export function FotoGezgini({ fotolar, ad }: { fotolar: string[]; ad: string }) {
  const [i, setI] = useState(0);
  const n = fotolar.length;
  const git = (d: number) => setI((x) => (x + d + n) % n);
  return (
    <section aria-label="Fotoğraflar" className={stil.kutu1}>
      <div className={stil.kutu2}>
        {n ? (
          // biome-ignore lint/performance/noImgElement: galeri fotoğrafı API'den akar
          <img src={`${API}${fotolar[i]}`} alt={`${ad}, fotoğraf ${i + 1}`} className={stil.gorsel1} />
        ) : null}
        {n > 1 ? (
          <>
            <button
              type="button"
              aria-label="Önceki fotoğraf"
              onClick={() => git(-1)}
              className={stil.dugme1}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Sonraki fotoğraf"
              onClick={() => git(1)}
              className={stil.dugme2}
            >
              ›
            </button>
          </>
        ) : null}
        <span className={stil.metin1}>
          {n ? i + 1 : 0} / {n}
        </span>
        <span className={stil.metin2}>Galerinin yüklediği fotoğraflar</span>
      </div>
      <div className={stil.kutu3}>
        {fotolar.map((f, j) => (
          <button
            key={f}
            type="button"
            aria-label={`Fotoğraf ${j + 1}`}
            onClick={() => setI(j)}
            className={cx(stil.dugme3, j === i ? stil.dugme4 : stil.dugme5)}
          >
            {/* biome-ignore lint/performance/noImgElement: küçük resim */}
            <img src={`${API}${f}`} alt="" loading="lazy" className={stil.gorsel2} />
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
  return (
    <>
      {yaz ? (
        <div className={stil.kutu4}>
          <label htmlFor="arac-mesaj" className={stil.etiket1}>
            Galeriye mesajın
          </label>
          <textarea
            id="arac-mesaj"
            rows={4}
            maxLength={MESSAGE_MAX}
            value={metin}
            onChange={(e) => setMetin(e.target.value)}
            placeholder="Merhaba, araç hâlâ satışta mı? Görmeye gelebilir miyim?"
            className={stil.girdi1}
          />
          <span className={stil.metin3}>Sohbet bu aracın kartıyla başlar. {DEPOSIT_NOTE}</span>
          {hata ? (
            <span role="alert" className={stil.metin4}>
              {hata}
            </span>
          ) : null}
          <button
            type="button"
            disabled={mesgul || !metin.trim()}
            onClick={gonder}
            className={stil.dugme6}
            style={{ opacity: mesgul || !metin.trim() ? 0.6 : 1 }}
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
          className={stil.dugme6}
        >
          Bu araç için mesaj gönder
        </button>
      )}
      {t?.phone ? (
        <a href={`tel:${t.phone}`} className={stil.bag1}>
          {telefon(t.phone)}
          {t.ad ? ` · ${t.ad}` : ''}
        </a>
      ) : (
        <button type="button" onClick={goster} className={stil.bag1}>
          Telefonu göster
        </button>
      )}
      {t?.phone ? (
        <a
          href={`https://wa.me/${t.phone.replace(/\D/g, '')}`}
          rel="noreferrer"
          target="_blank"
          className={stil.bag2}
        >
          WhatsApp
        </a>
      ) : null}
    </>
  );
}

/** "♡ Favorilere ekle" (PortfoyArac.dc.html): girişsiz kullanıcı girişe gider */
export function AracFavori({ no }: { no: number }) {
  const giris = useGiris();
  const [fav, setFav] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  useEffect(() => {
    if (!giris) return;
    istek<{ favori: boolean }>(`/araclar/${no}/favori`)
      .then((r) => setFav(r.favori))
      .catch(() => undefined);
  }, [giris, no]);
  return (
    <>
      <button
        type="button"
        aria-pressed={fav}
        onClick={async () => {
          if (!giris) {
            window.location.href = `/giris?sonra=/arac/${no}`;
            return;
          }
          const yeni = !fav;
          setFav(yeni);
          setHata(null);
          try {
            await istek(`/araclar/${no}/favori`, { method: yeni ? 'PUT' : 'DELETE' });
          } catch (e) {
            setFav(!yeni);
            setHata((e as Error).message);
          }
        }}
        className={cx(stil.dugme7, fav ? stil.dugme8 : stil.dugme9)}
      >
        {fav ? '♥ Favorilerinde' : '♡ Favorilere ekle'}
      </button>
      {hata ? (
        <span role="alert" className={stil.metin5}>
          {hata}
        </span>
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
    <div className={stil.kutu5}>
      <span className={stil.metin6}>
        <strong>{u.baslik} talebine uyuyor.</strong> {u.metin}
      </span>
      <Link href={`/talep/${u.talepNo}`} className={stil.bag3}>
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
        className={stil.dugme10}
      >
        Bu ilanı şikayet et
      </button>
      {acik ? <Sikayet hedef="arac" id={String(no)} kapat={() => setAcik(false)} /> : null}
    </>
  );
}
