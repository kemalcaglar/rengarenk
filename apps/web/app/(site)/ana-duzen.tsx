'use client';

import { type HomeResponse } from '@rengarenk/shared';
import Link from 'next/link';
import { Fragment, type ReactNode, useEffect, useState } from 'react';
import { Banner } from '../../components/banner';
import { cx } from '../../lib/cx';
import { istek, useGiris } from '../../lib/istemci';
import { Baslik, type SonKart, SonTalepler } from './ana-bolumler';
import stil from './ana-duzen.module.css';
import { talepleriAl } from './ana-yedek';
import { KayitliAramalarim } from './kayitli-aramalarim';
import { PortfoyEslesmeleri } from './portfoy-eslesmeleri';

type Galeri = NonNullable<HomeResponse['galeri']>;

/** Galeri karşılaması (Anasayfa.dc.html): ad, paket ve bugün kalan ilk mesaj hakkı; portföy ve mesajlar */
function GaleriKarsilama({ g }: { g: Galeri }) {
  return (
    <section aria-labelledby="merhaba" className={stil.kutu1}>
      <div>
        <h1 id="merhaba" className={stil.baslik1}>
          Merhaba, {g.ad}
        </h1>
        <p className={stil.metin1}>
          {g.paket} paket
          {g.gunluk ? (
            <>
              {' '}
              · Bugün kalan ilk mesaj hakkın{' '}
              <strong className={stil.metin2}>
                {g.gunluk.kalan} / {g.gunluk.toplam}
              </strong>
            </>
          ) : (
            ' · Mesaj göndermek için paket seç'
          )}
        </p>
      </div>
      <div className={stil.kutu2}>
        <Link href="/galeri-paneli?bolum=portfoy" className={stil.bag1}>
          Portföyüm ({g.portfoy} araç)
        </Link>
        <Link href="/mesajlarim" className={stil.bag1}>
          Mesajlar
          {g.okunmamis ? <span className={stil.metin3}>{g.okunmamis}</span> : null}
        </Link>
      </div>
    </section>
  );
}

/** Kalan ilk mesaj hakkı: paketin bugünkü hakkı ve satın alınan ek haklar */
function HakKarti({ g }: { g: Galeri }) {
  const oran = g.gunluk?.toplam ? g.gunluk.kalan / g.gunluk.toplam : 0;
  return (
    <section aria-label="Kalan ilk mesaj hakkı" className={stil.kutu3}>
      <span className={stil.metin4}>
        <span className={stil.metin5}>
          {g.gunluk
            ? `Bugün ${g.gunluk.kalan} ilk mesaj hakkın kaldı`
            : 'Paketin yok; ilk mesaj gönderemezsin'}
        </span>
        <span className={stil.metin6}>
          {g.paket} paket{g.gunluk ? ` · günde ${g.gunluk.toplam}` : ''} · ek hak {g.ek}
        </span>
        {g.gunluk ? (
          <span aria-hidden="true" className={stil.metin7}>
            <span className={stil.metin8} style={{ width: `${Math.round(oran * 100)}%` }} />
          </span>
        ) : null}
      </span>
      <Link href="/galeri-paneli?bolum=paket" className={stil.bag1}>
        Paket ve ek haklar
      </Link>
    </section>
  );
}

/** Bölgende aranan modeller: son 30 günde en çok talep edilenler ve portföydeki araç (ajan önerisiyle) */
function ArananModeller({ a }: { a: NonNullable<HomeResponse['aranan']> }) {
  return (
    <section aria-labelledby="aranan">
      <Baslik
        id="aranan"
        sag={
          <Link href="/galeri-paneli?bolum=ekle" className={stil.bag2}>
            Araç ekle
          </Link>
        }
      >
        {a.bolge.replace(/^./, (c) => c.toLocaleUpperCase('tr-TR'))} aranan modeller
      </Baslik>
      <div className={stil.kutu4}>
        {a.modeller.map((m) => (
          <div key={m.ad} className={stil.kutu5}>
            <span className={stil.metin9}>{m.sira}</span>
            <span className={stil.metin10}>{m.ad}</span>
            <span className={stil.metin11}>{m.talep} talep</span>
            <span className={cx(stil.metin12, m.arac ? stil.metin13 : stil.metin14)}>
              {m.arac ? `Portföyünde ${m.arac}` : 'Portföyünde yok'}
            </span>
          </div>
        ))}
        <p className={stil.metin15}>
          <strong>Ajan:</strong> {a.oneri}
        </p>
      </div>
    </section>
  );
}

function TaleplerimOzeti({ liste }: { liste: NonNullable<HomeResponse['taleplerim']> }) {
  return (
    <section aria-labelledby="taleplerim">
      <Baslik
        id="taleplerim"
        sag={
          <Link href="/taleplerim" className={stil.bag2}>
            Taleplerim
          </Link>
        }
      >
        Aktif taleplerin
      </Baslik>
      {liste.length ? (
        <div className="rr-uc-sutun">
          {liste.map((t) => (
            <Link key={t.no} href={`/talep/${t.no}`} className={stil.bag3}>
              <span className={stil.metin16}>{t.baslik}</span>
              <span className={stil.metin17}>
                {t.kalanGun} gün kaldı · {t.yazan} satıcı yazdı
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className={stil.metin18}>
          Yayında talebin yok.{' '}
          <Link href="/talep-olustur" className={stil.bag4}>
            Talep oluştur
          </Link>
        </p>
      )}
    </section>
  );
}

function GelenMesajlar({ liste }: { liste: NonNullable<HomeResponse['mesajlar']> }) {
  if (!liste.length) return null;
  return (
    <section aria-labelledby="mesajlar">
      <Baslik
        id="mesajlar"
        sag={
          <Link href="/mesajlarim" className={stil.bag2}>
            Mesajlarım
          </Link>
        }
      >
        Gelen ilk mesajlar
      </Baslik>
      <div className={stil.kutu4}>
        {liste.map((m) => (
          <Link key={m.id} href={`/mesajlarim?sohbet=${m.id}`} className={stil.bag5}>
            <span
              role="img"
              aria-label={m.okunmadi ? 'Okunmadı' : 'Okundu'}
              className={cx(stil.metin19, m.okunmadi ? stil.metin20 : stil.metin21)}
            />
            <span className={cx(stil.metin22, m.okunmadi ? stil.bag4 : stil.metin23)}>{m.satici}</span>
            <span className={stil.metin24}>{m.talep}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Galeri: kendi ilindeki son talepler; ilinde talep yoksa bütün Türkiye'nin son talepleri (bölüm boş kalmaz) */
function BolgeSon({ il }: { il: string }) {
  const [v, setV] = useState<{ liste: SonKart[]; il: boolean } | null>(null);
  useEffect(() => {
    let canli = true;
    (async () => {
      const bolge = await talepleriAl(`/talepler?il=${encodeURIComponent(il)}&sira=yeni&boyut=6`, {
        iptal: () => !canli,
      });
      if (bolge?.sonuclar.length) return { liste: bolge.sonuclar, il: true };
      const genel = await talepleriAl('/talepler?sira=yeni&boyut=6', { iptal: () => !canli });
      return { liste: genel?.sonuclar ?? [], il: false };
    })().then((x) => canli && setV(x));
    return () => {
      canli = false;
    };
  }, [il]);
  if (!v) return null;
  return v.il ? (
    <SonTalepler
      liste={v.liste}
      baslik={`Son talepler · ${il}`}
      tumu={`/talepler?il=${encodeURIComponent(il)}&sira=yeni`}
    />
  ) : (
    <SonTalepler liste={v.liste} baslik="Son talepler" tumu="/talepler?sira=yeni" />
  );
}

/**
 * Ana sayfa düzeni (Karar 46): sunucu ziyaretçi düzeniyle çizer; giriş yapmışsa görüntüleyenin kitlesine (bireysel,
 * galeri) göre bölümler ve kişiye özel veriler API'den gelir. Web'de "Kategori kutuları" sol sütundur.
 */
export function AnaDuzen({ ilk, bolumler }: { ilk: HomeResponse; bolumler: Record<string, ReactNode> }) {
  const giris = useGiris();
  const [v, setV] = useState<HomeResponse>(ilk);
  useEffect(() => {
    if (giris)
      istek<HomeResponse>('/icerik/anasayfa?platform=web')
        .then(setV)
        .catch(() => undefined);
  }, [giris]);

  const parca = (k: string): ReactNode => {
    switch (k) {
      case 'karsi':
        return v.kitle === 'galeri' && v.galeri ? <GaleriKarsilama g={v.galeri} /> : bolumler.karsi;
      case 'duyuru':
        return <Banner yer="duyuru" />;
      case 'arama':
        return <KayitliAramalarim />;
      case 'eslesme':
        return <PortfoyEslesmeleri />;
      case 'taleplerim':
        return v.taleplerim ? <TaleplerimOzeti liste={v.taleplerim} /> : null;
      case 'mesaj':
        return v.mesajlar ? <GelenMesajlar liste={v.mesajlar} /> : null;
      case 'hak':
        return v.galeri ? <HakKarti g={v.galeri} /> : null;
      case 'aranan':
        return v.aranan?.modeller.length ? <ArananModeller a={v.aranan} /> : null;
      case 'son':
        return v.kitle === 'galeri' && v.galeri ? <BolgeSon il={v.galeri.il} /> : bolumler.son;
      default:
        return bolumler[k] ?? null;
    }
  };

  return (
    <main className={`rr-sayfa ${stil.kutu6}`}>
      {v.sira.includes('kat') ? bolumler.kat : null}
      <div className={stil.kutu7}>
        <Banner yer="anasayfa_ust" />
        {v.sira
          .filter((k) => k !== 'kat')
          .map((k) => (
            <Fragment key={k}>{parca(k)}</Fragment>
          ))}
      </div>
    </main>
  );
}
