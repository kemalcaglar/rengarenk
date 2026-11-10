'use client';

import { type HomeResponse, tints } from '@rengarenk/shared';
import Link from 'next/link';
import { Fragment, type ReactNode, useEffect, useState } from 'react';
import { Banner } from '../../components/banner';
import { istek, useGiris } from '../../lib/istemci';
import { colors } from '../../lib/renk';
import { Baslik, kart, type SonKart, SonTalepler } from './ana-bolumler';
import { talepleriAl } from './ana-yedek';
import { KayitliAramalarim } from './kayitli-aramalarim';
import { PortfoyEslesmeleri } from './portfoy-eslesmeleri';

const dugme = {
  fontSize: 14.5,
  fontWeight: 700,
  color: colors.ink,
  border: `1px solid ${colors.line}`,
  borderRadius: 'calc(var(--rr-buton-kose) * 12 / 14)',
  padding: '11px 16px',
  textDecoration: 'none',
  background: 'var(--rr-kart, #FFFFFF)',
} as const;

type Galeri = NonNullable<HomeResponse['galeri']>;

/** Galeri karşılaması (Anasayfa.dc.html): ad, paket ve bugün kalan ilk mesaj hakkı; portföy ve mesajlar */
function GaleriKarsilama({ g }: { g: Galeri }) {
  return (
    <section
      aria-labelledby="merhaba"
      style={{
        ...kart,
        borderRadius: 'calc(var(--rr-kart-kose) * 20 / 18)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '20px 24px',
      }}
    >
      <div>
        <h1 id="merhaba" style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>
          Merhaba, {g.ad}
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 14.5, color: colors.muted }}>
          {g.paket} paket
          {g.gunluk ? (
            <>
              {' '}
              · Bugün kalan ilk mesaj hakkın{' '}
              <strong style={{ color: colors.ink }}>
                {g.gunluk.kalan} / {g.gunluk.toplam}
              </strong>
            </>
          ) : (
            ' · Mesaj göndermek için paket seç'
          )}
        </p>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <Link href="/galeri-paneli?bolum=portfoy" style={dugme}>
          Portföyüm ({g.portfoy} araç)
        </Link>
        <Link href="/mesajlarim" style={dugme}>
          Mesajlar
          {g.okunmamis ? (
            <span
              style={{
                background: colors.pink,
                color: 'var(--rr-pembeYazi, #1E2333)',
                borderRadius: 'var(--rr-etiket-kose)',
                padding: '2px 8px',
                marginLeft: 6,
                fontSize: 12.5,
              }}
            >
              {g.okunmamis}
            </span>
          ) : null}
        </Link>
      </div>
    </section>
  );
}

/** Kalan ilk mesaj hakkı: paketin bugünkü hakkı ve satın alınan ek haklar */
function HakKarti({ g }: { g: Galeri }) {
  const oran = g.gunluk?.toplam ? g.gunluk.kalan / g.gunluk.toplam : 0;
  return (
    <section
      aria-label="Kalan ilk mesaj hakkı"
      style={{
        ...kart,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '10px 20px',
        padding: '16px 20px',
        background: tints.yellow,
      }}
    >
      <span style={{ flex: '1 1 240px', minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15.5, fontWeight: 800 }}>
          {g.gunluk
            ? `Bugün ${g.gunluk.kalan} ilk mesaj hakkın kaldı`
            : 'Paketin yok; ilk mesaj gönderemezsin'}
        </span>
        <span style={{ display: 'block', fontSize: 13.5, color: '#5A3D00', marginTop: 3 }}>
          {g.paket} paket{g.gunluk ? ` · günde ${g.gunluk.toplam}` : ''} · ek hak {g.ek}
        </span>
        {g.gunluk ? (
          <span
            aria-hidden="true"
            style={{
              display: 'block',
              height: 8,
              borderRadius: 'var(--rr-etiket-kose)',
              background: 'var(--rr-kart, #FFFFFF)',
              marginTop: 8,
              overflow: 'hidden',
            }}
          >
            <span
              style={{
                display: 'block',
                width: `${Math.round(oran * 100)}%`,
                height: '100%',
                background: colors.yellow,
                color: 'var(--rr-sariYazi, #1E2333)',
              }}
            />
          </span>
        ) : null}
      </span>
      <Link href="/galeri-paneli?bolum=paket" style={dugme}>
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
          <Link href="/galeri-paneli?bolum=ekle" style={{ fontSize: 14, fontWeight: 700 }}>
            Araç ekle
          </Link>
        }
      >
        {a.bolge.replace(/^./, (c) => c.toLocaleUpperCase('tr-TR'))} aranan modeller
      </Baslik>
      <div style={{ ...kart, borderRadius: 'calc(var(--rr-kart-kose) * 16 / 18)', overflow: 'hidden' }}>
        {a.modeller.map((m) => (
          <div
            key={m.ad}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '6px 16px',
              padding: '12px 18px',
              borderBottom: '1px solid #EEF0F5',
            }}
          >
            <span style={{ flex: '0 0 24px', fontWeight: 800, color: colors.muted }}>{m.sira}</span>
            <span style={{ flex: '999 1 220px', minWidth: 0, fontSize: 15, fontWeight: 700 }}>{m.ad}</span>
            <span style={{ flex: '1 1 120px', fontSize: 14, fontWeight: 800, color: colors.link }}>
              {m.talep} talep
            </span>
            <span
              style={{
                flex: 'none',
                fontSize: 12.5,
                fontWeight: 800,
                padding: '3px 9px',
                borderRadius: 'var(--rr-etiket-kose)',
                background: m.arac ? '#E7FAF0' : '#FFF6DF',
                color: m.arac ? '#11683F' : '#7A5300',
              }}
            >
              {m.arac ? `Portföyünde ${m.arac}` : 'Portföyünde yok'}
            </span>
          </div>
        ))}
        <p
          style={{
            margin: 0,
            padding: '12px 18px',
            fontSize: 13.5,
            background: 'var(--rr-zemin, #F6F8FD)',
            lineHeight: 1.5,
          }}
        >
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
          <Link href="/taleplerim" style={{ fontSize: 14, fontWeight: 700 }}>
            Taleplerim
          </Link>
        }
      >
        Aktif taleplerin
      </Baslik>
      {liste.length ? (
        <div className="rr-uc-sutun">
          {liste.map((t) => (
            <Link
              key={t.no}
              href={`/talep/${t.no}`}
              style={{
                ...kart,
                borderRadius: 'calc(var(--rr-kart-kose) * 16 / 18)',
                padding: 16,
                color: colors.ink,
                textDecoration: 'none',
              }}
            >
              <span style={{ display: 'block', fontSize: 15, fontWeight: 800 }}>{t.baslik}</span>
              <span style={{ display: 'block', fontSize: 13.5, color: colors.muted, marginTop: 6 }}>
                {t.kalanGun} gün kaldı · {t.yazan} satıcı yazdı
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p style={{ ...kart, margin: 0, padding: 16, fontSize: 14, color: colors.muted }}>
          Yayında talebin yok.{' '}
          <Link href="/talep-olustur" style={{ fontWeight: 800 }}>
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
          <Link href="/mesajlarim" style={{ fontSize: 14, fontWeight: 700 }}>
            Mesajlarım
          </Link>
        }
      >
        Gelen ilk mesajlar
      </Baslik>
      <div style={{ ...kart, borderRadius: 'calc(var(--rr-kart-kose) * 16 / 18)', overflow: 'hidden' }}>
        {liste.map((m) => (
          <Link
            key={m.id}
            href={`/mesajlarim?sohbet=${m.id}`}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '6px 14px',
              padding: '13px 18px',
              borderBottom: '1px solid #EEF0F5',
              color: colors.ink,
              textDecoration: 'none',
            }}
          >
            <span
              role="img"
              aria-label={m.okunmadi ? 'Okunmadı' : 'Okundu'}
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: m.okunmadi ? colors.pink : '#D5DAE5',
                color: m.okunmadi ? 'var(--rr-pembeYazi, #1E2333)' : undefined,
                flex: 'none',
              }}
            />
            <span
              style={{ flex: '999 1 200px', minWidth: 0, fontSize: 15, fontWeight: m.okunmadi ? 800 : 600 }}
            >
              {m.satici}
            </span>
            <span style={{ flex: '1 1 200px', minWidth: 0, fontSize: 13.5, color: colors.muted }}>
              {m.talep}
            </span>
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
    <main
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
      {v.sira.includes('kat') ? bolumler.kat : null}
      <div style={{ flex: '999 1 760px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 22 }}>
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
