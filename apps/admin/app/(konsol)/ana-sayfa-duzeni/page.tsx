'use client';

import {
  HOME_AUDIENCE_KEYS,
  HOME_AUDIENCES,
  HOME_PLATFORM_KEYS,
  HOME_PLATFORMS,
  type HomeAudience,
  type HomeLayout,
  type HomePlatform,
  type HomeSection,
  homeLayoutChanges,
} from '@rengarenk/shared';
import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';
import { Switch } from '../switch';

interface Veri {
  bolumler: Record<HomeAudience, HomeSection[]>;
  yayinda: { surum: number; duzen: HomeLayout };
  zamanli: { surum: number; zaman: string; duzen: HomeLayout } | null;
  surumler: { no: string; surum: number; not: string; kim: string; durum: string; don: boolean }[];
}

const kutu: CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E3E6EF',
  borderRadius: 18,
  overflow: 'hidden',
};
const ok: CSSProperties = {
  flex: 'none',
  width: 30,
  height: 30,
  border: '1px solid #D5DAE5',
  background: '#FFFFFF',
  borderRadius: 8,
  fontSize: 13,
  color: '#1E2333',
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const kopya = (d: HomeLayout) => JSON.parse(JSON.stringify(d)) as HomeLayout;

function Hap({ on, ad, pick }: { on: boolean; ad: string; pick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={pick}
      style={
        on
          ? {
              border: 0,
              background: '#1E2333',
              borderRadius: 999,
              padding: '8px 14px',
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
              padding: '7px 13px',
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
  );
}

/**
 * Görünüm › Ana sayfa düzeni (YonetimIcerik.dc.html › anasayfa; Karar 46). Her kitle ve platform için bölümleri
 * sırala, aç ya da kapat; önizleme anında değişir. Yayın yeni sürüm açar (değişiklikler sürüm notuna yazılır),
 * "Zamanla" ileri tarihte yayına alır, "Geri dön" eski sürümü yeniden yayınlar.
 */
export default function AnaSayfaDuzeni() {
  const { me } = useKonsol();
  const tam = me.permissions['gorunum.duzenle'] === 'tam';
  const [v, setV] = useState<Veri | null>(null);
  const [taslak, setTaslak] = useState<HomeLayout | null>(null);
  const [kitle, setKitle] = useState<HomeAudience>('ziyaretci');
  const [platform, setPlatform] = useState<HomePlatform>('web');
  const [zamanAc, setZamanAc] = useState(false);
  const [zaman, setZaman] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);

  const yukle = useCallback((x: Veri) => {
    setV(x);
    setTaslak(kopya(x.yayinda.duzen));
  }, []);
  useEffect(() => {
    yonetim<Veri>('home-layout')
      .then(yukle)
      .catch((e: Error) => setHata(e.message));
  }, [yukle]);

  if (!v || !taslak) return hata ? <p className="k-error">{hata}</p> : <p className="k-empty">Yükleniyor…</p>;

  const d = taslak[kitle][platform];
  const tanim = new Map(v.bolumler[kitle].map((b) => [b.key, b]));
  const degisim = homeLayoutChanges(v.yayinda.duzen, taslak);

  const guncelle = (fn: (x: { sira: string[]; gizli: string[] }) => void) => {
    const t = kopya(taslak);
    fn(t[kitle][platform]);
    setTaslak(t);
    setBilgi(null);
  };
  const tasi = (key: string, yon: -1 | 1) =>
    guncelle((x) => {
      const i = x.sira.indexOf(key);
      const j = i + yon;
      if (i < 1 || j < 1 || j >= x.sira.length) return;
      [x.sira[i], x.sira[j]] = [x.sira[j] as string, x.sira[i] as string];
    });

  async function yayinla(ileri: boolean) {
    setHata(null);
    setBilgi(null);
    if (!taslak) return;
    try {
      const z = ileri && zaman ? new Date(zaman).toISOString() : null;
      if (ileri && !z) throw new Error('Yayın tarihini ve saatini seç');
      const r = await yonetim<Veri>('home-layout', { method: 'POST', body: { duzen: taslak, zaman: z } });
      yukle(r);
      setZamanAc(false);
      setBilgi(
        z
          ? `Düzen ${r.zamanli?.zaman ?? ''}’da yayına girecek şekilde zamanlandı.`
          : `Ana sayfa düzeni yayınlandı · s.${r.yayinda.surum}. Geri almak için Sürümler’den önceki sürüme dön.`,
      );
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  async function geriDon(surum: number) {
    setHata(null);
    try {
      const r = await yonetim<Veri>(`home-layout/rollback/${surum}`, { method: 'POST' });
      yukle(r);
      setBilgi(`s.${surum} sürümüne dönüldü · yeni sürüm s.${r.yayinda.surum}.`);
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  const mob = platform === 'mobil';
  return (
    <>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Ana sayfa düzeni</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#5A6073' }}>
            Her kitle için ayrı düzen. Bölümleri sırala, aç ya da kapat; önizleme anında değişir.
          </p>
        </div>
        {tam ? (
          <span style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setZamanAc((x) => !x)}
              aria-expanded={zamanAc}
              style={{
                border: '1px solid #D5DAE5',
                background: '#FFFFFF',
                borderRadius: 12,
                padding: '10px 14px',
                fontSize: 14,
                fontWeight: 700,
                color: '#1E2333',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Zamanla
            </button>
            <button
              type="button"
              onClick={() => yayinla(false)}
              disabled={!degisim.length}
              style={{
                border: 0,
                background: '#3DD68C',
                borderRadius: 12,
                padding: '10px 16px',
                fontSize: 14,
                fontWeight: 800,
                color: '#1E2333',
                cursor: degisim.length ? 'pointer' : 'default',
                opacity: degisim.length ? 1 : 0.5,
                fontFamily: 'inherit',
              }}
            >
              Yayınla
            </button>
          </span>
        ) : null}
      </div>
      {hata ? (
        <p className="k-error" role="alert">
          {hata}
        </p>
      ) : null}
      {bilgi ? (
        <p
          role="status"
          style={{
            background: '#E7FAF0',
            color: '#11683F',
            borderRadius: 12,
            padding: '10px 14px',
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {bilgi}
        </p>
      ) : null}
      {zamanAc ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            gap: 10,
            background: '#FFFFFF',
            border: '1.5px solid #5B8CFF',
            borderRadius: 14,
            padding: 14,
            marginBottom: 14,
          }}
        >
          <label style={{ fontSize: 13, fontWeight: 700 }}>
            Yayın zamanı
            <input
              type="datetime-local"
              value={zaman}
              onChange={(e) => setZaman(e.target.value)}
              style={{
                display: 'block',
                marginTop: 5,
                border: '1px solid #D5DAE5',
                borderRadius: 10,
                padding: 9,
                fontSize: 14,
                fontFamily: 'inherit',
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => yayinla(true)}
            disabled={!degisim.length}
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
            Bu zamanda yayınla
          </button>
          <span style={{ fontSize: 12.5, color: '#5A6073' }}>
            Bekleyen başka bir zamanlama varsa yerine geçer.
          </span>
        </div>
      ) : null}
      {v.zamanli ? (
        <p
          role="status"
          style={{
            background: '#EEF3FF',
            color: '#2450C8',
            borderRadius: 12,
            padding: '10px 14px',
            fontSize: 13.5,
            fontWeight: 700,
          }}
        >
          s.{v.zamanli.surum} zamanlandı · {v.zamanli.zaman}’da yayına girer.
        </p>
      ) : null}
      {degisim.length ? (
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#7A5300' }}>
          Yayınlanmamış değişiklik: {degisim.join(' · ')}
        </p>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 18px', marginBottom: 14 }}>
        <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: '#5A6073', marginRight: 4 }}>Kitle</span>
          {HOME_AUDIENCE_KEYS.map((k) => (
            <Hap key={k} on={kitle === k} ad={HOME_AUDIENCES[k]} pick={() => setKitle(k)} />
          ))}
        </span>
        <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: '#5A6073', marginRight: 4 }}>Platform</span>
          {HOME_PLATFORM_KEYS.map((p) => (
            <Hap key={p} on={platform === p} ad={HOME_PLATFORMS[p]} pick={() => setPlatform(p)} />
          ))}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <section aria-labelledby="bolum" style={{ ...kutu, flex: '1 1 380px', minWidth: 0 }}>
          <h2
            id="bolum"
            style={{
              margin: 0,
              padding: '16px 18px',
              fontSize: 17,
              fontWeight: 800,
              borderBottom: '1px solid #EEF0F5',
            }}
          >
            Bölümler
          </h2>
          {d.sira.map((key, i) => {
            const b = tanim.get(key);
            if (!b) return null;
            const gizli = d.gizli.includes(key);
            const sabit = key === 'karsi';
            return (
              <div
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px 10px 18px',
                  borderBottom: '1px solid #EEF0F5',
                  opacity: gizli ? 0.5 : 1,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{ flex: 'none', width: 12, height: 28, borderRadius: 4, background: b.renk }}
                />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 800 }}>{b.ad}</span>
                  <span style={{ display: 'block', fontSize: 12, color: '#5A6073' }}>{b.not}</span>
                </span>
                <button
                  type="button"
                  aria-label={`${b.ad}: yukarı taşı`}
                  disabled={!tam || sabit || i < 2}
                  onClick={() => tasi(key, -1)}
                  style={{ ...ok, opacity: !tam || sabit || i < 2 ? 0.4 : 1 }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`${b.ad}: aşağı taşı`}
                  disabled={!tam || sabit || i === d.sira.length - 1}
                  onClick={() => tasi(key, 1)}
                  style={{ ...ok, opacity: !tam || sabit || i === d.sira.length - 1 ? 0.4 : 1 }}
                >
                  ↓
                </button>
                <Switch
                  on={!gizli}
                  label={`${b.ad}: göster`}
                  disabled={!tam || sabit}
                  onChange={() =>
                    guncelle((x) => {
                      x.gizli = gizli ? x.gizli.filter((g) => g !== key) : [...x.gizli, key];
                    })
                  }
                />
              </div>
            );
          })}
          <div style={{ padding: '12px 18px', fontSize: 12.5, color: '#5A6073' }}>
            Karşılama ve arama bölümü her zaman en üsttedir. Bölüm içerikleri (vitrin, duyuru) kendi
            ekranlarından yönetilir.
          </div>
        </section>

        <section
          aria-labelledby="oniz"
          style={{ ...kutu, flex: '1 1 380px', minWidth: 0, padding: '16px 18px', overflow: 'visible' }}
        >
          <h2 id="oniz" style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 800 }}>
            Önizleme · {HOME_AUDIENCES[kitle]} · {mob ? 'mobil' : 'web'}
          </h2>
          <div
            style={{
              maxWidth: mob ? 230 : '100%',
              margin: '0 auto',
              border: '1px solid #E3E6EF',
              borderRadius: mob ? 24 : 12,
              padding: 10,
              background: '#F6F8FD',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
              {['#5B8CFF', '#FF6FB5', '#FFC84A', '#3DD68C'].map((r) => (
                <span key={r} style={{ width: 6, height: 14, borderRadius: 3, background: r }} />
              ))}
              <span style={{ fontSize: 12, fontWeight: 800, marginLeft: 4 }}>rengarenk</span>
            </div>
            {d.sira
              .filter((k) => !d.gizli.includes(k))
              .map((k) => {
                const b = tanim.get(k);
                if (!b) return null;
                return (
                  <div
                    key={k}
                    style={{
                      height: Math.round(b.h * (mob ? 1.15 : 1)),
                      marginBottom: 6,
                      borderRadius: 8,
                      background: '#FFFFFF',
                      borderLeft: `4px solid ${b.renk}`,
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 10px',
                      fontSize: 12,
                      fontWeight: 800,
                      color: '#1E2333',
                    }}
                  >
                    {b.ad}
                  </div>
                );
              })}
          </div>
        </section>
      </div>

      <section aria-labelledby="gecmis" style={{ ...kutu, marginTop: 14 }}>
        <h2
          id="gecmis"
          style={{
            margin: 0,
            padding: '14px 18px',
            fontSize: 16,
            fontWeight: 800,
            borderBottom: '1px solid #EEF0F5',
          }}
        >
          Sürümler
        </h2>
        {v.surumler.length === 0 ? (
          <p style={{ margin: 0, padding: '12px 18px', fontSize: 13.5, color: '#5A6073' }}>
            Henüz yayın yok; ana sayfa varsayılan düzenle (tasarımdaki bölümler) görünüyor.
          </p>
        ) : (
          v.surumler.map((s) => (
            <div
              key={s.no}
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
              <span style={{ flex: '0 0 52px', fontWeight: 800 }}>{s.no}</span>
              <span style={{ flex: '999 1 280px', minWidth: 0 }}>{s.not}</span>
              <span style={{ flex: 'none', color: '#5A6073' }}>
                {s.kim}
                {s.durum ? ` · ${s.durum}` : ''}
              </span>
              {s.don && tam ? (
                <button
                  type="button"
                  onClick={() => geriDon(s.surum)}
                  style={{
                    flex: 'none',
                    border: '1px solid #D5DAE5',
                    background: '#FFFFFF',
                    borderRadius: 10,
                    padding: '6px 12px',
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#1E2333',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Geri dön
                </button>
              ) : null}
            </div>
          ))
        )}
      </section>
    </>
  );
}
