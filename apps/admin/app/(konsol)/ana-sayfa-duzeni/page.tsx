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
import { useCallback, useEffect, useState } from 'react';
import { cx } from '../../../lib/cx';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';
import { Switch } from '../switch';
import stil from './page.module.css';

interface Veri {
  bolumler: Record<HomeAudience, HomeSection[]>;
  yayinda: { surum: number; duzen: HomeLayout };
  zamanli: { surum: number; zaman: string; duzen: HomeLayout } | null;
  surumler: { no: string; surum: number; not: string; kim: string; durum: string; don: boolean }[];
}

const kopya = (d: HomeLayout) => JSON.parse(JSON.stringify(d)) as HomeLayout;

function Hap({ on, ad, pick }: { on: boolean; ad: string; pick: () => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={pick} className={cx(on ? stil.dugme1 : stil.dugme2)}>
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
      <div className={stil.kutu1}>
        <div>
          <h1 className={stil.baslik1}>Ana sayfa düzeni</h1>
          <p className={stil.metin1}>
            Her kitle için ayrı düzen. Bölümleri sırala, aç ya da kapat; önizleme anında değişir.
          </p>
        </div>
        {tam ? (
          <span className={stil.metin2}>
            <button
              type="button"
              onClick={() => setZamanAc((x) => !x)}
              aria-expanded={zamanAc}
              className={stil.dugme3}
            >
              Zamanla
            </button>
            <button
              type="button"
              onClick={() => yayinla(false)}
              disabled={!degisim.length}
              className={cx(stil.dugme4, degisim.length ? stil.dugme5 : stil.dugme6)}
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
        <p role="status" className={stil.metin3}>
          {bilgi}
        </p>
      ) : null}
      {zamanAc ? (
        <div className={stil.kutu2}>
          <label className={stil.etiket1}>
            Yayın zamanı
            <input
              type="datetime-local"
              value={zaman}
              onChange={(e) => setZaman(e.target.value)}
              className={stil.girdi1}
            />
          </label>
          <button
            type="button"
            onClick={() => yayinla(true)}
            disabled={!degisim.length}
            className={stil.dugme7}
          >
            Bu zamanda yayınla
          </button>
          <span className={stil.metin4}>Bekleyen başka bir zamanlama varsa yerine geçer.</span>
        </div>
      ) : null}
      {v.zamanli ? (
        <p role="status" className={stil.metin5}>
          s.{v.zamanli.surum} zamanlandı · {v.zamanli.zaman}’da yayına girer.
        </p>
      ) : null}
      {degisim.length ? <p className={stil.metin6}>Yayınlanmamış değişiklik: {degisim.join(' · ')}</p> : null}

      <div className={stil.kutu3}>
        <span className={stil.metin7}>
          <span className={stil.metin8}>Kitle</span>
          {HOME_AUDIENCE_KEYS.map((k) => (
            <Hap key={k} on={kitle === k} ad={HOME_AUDIENCES[k]} pick={() => setKitle(k)} />
          ))}
        </span>
        <span className={stil.metin7}>
          <span className={stil.metin8}>Platform</span>
          {HOME_PLATFORM_KEYS.map((p) => (
            <Hap key={p} on={platform === p} ad={HOME_PLATFORMS[p]} pick={() => setPlatform(p)} />
          ))}
        </span>
      </div>

      <div className={stil.kutu4}>
        <section aria-labelledby="bolum" className={stil.kutu5}>
          <h2 id="bolum" className={stil.baslik2}>
            Bölümler
          </h2>
          {d.sira.map((key, i) => {
            const b = tanim.get(key);
            if (!b) return null;
            const gizli = d.gizli.includes(key);
            const sabit = key === 'karsi';
            return (
              <div key={key} className={cx(stil.kutu6, gizli ? stil.kutu7 : stil.kutu8)}>
                <span aria-hidden="true" className={stil.metin9} style={{ background: b.renk }} />
                <span className={stil.metin10}>
                  <span className={stil.metin11}>{b.ad}</span>
                  <span className={stil.metin12}>{b.not}</span>
                </span>
                <button
                  type="button"
                  aria-label={`${b.ad}: yukarı taşı`}
                  disabled={!tam || sabit || i < 2}
                  onClick={() => tasi(key, -1)}
                  className={cx(stil.dugme8, !tam || sabit || i < 2 ? stil.dugme9 : stil.kutu8)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`${b.ad}: aşağı taşı`}
                  disabled={!tam || sabit || i === d.sira.length - 1}
                  onClick={() => tasi(key, 1)}
                  className={cx(
                    stil.dugme8,
                    !tam || sabit || i === d.sira.length - 1 ? stil.dugme9 : stil.kutu8,
                  )}
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
          <div className={stil.kutu9}>
            Karşılama ve arama bölümü her zaman en üsttedir. Bölüm içerikleri (vitrin, duyuru) kendi
            ekranlarından yönetilir.
          </div>
        </section>

        <section aria-labelledby="oniz" className={stil.kutu10}>
          <h2 id="oniz" className={stil.baslik3}>
            Önizleme · {HOME_AUDIENCES[kitle]} · {mob ? 'mobil' : 'web'}
          </h2>
          <div className={cx(stil.kutu11, mob ? stil.kutu12 : stil.kutu13)}>
            <div className={stil.kutu14}>
              {['#5B8CFF', '#FF6FB5', '#FFC84A', '#3DD68C'].map((r) => (
                <span key={r} className={stil.metin13} style={{ background: r }} />
              ))}
              <span className={stil.metin14}>rengarenk</span>
            </div>
            {d.sira
              .filter((k) => !d.gizli.includes(k))
              .map((k) => {
                const b = tanim.get(k);
                if (!b) return null;
                return (
                  <div
                    key={k}
                    className={stil.kutu15}
                    style={{ height: Math.round(b.h * (mob ? 1.15 : 1)), borderLeft: `4px solid ${b.renk}` }}
                  >
                    {b.ad}
                  </div>
                );
              })}
          </div>
        </section>
      </div>

      <section aria-labelledby="gecmis" className={stil.kutu16}>
        <h2 id="gecmis" className={stil.baslik4}>
          Sürümler
        </h2>
        {v.surumler.length === 0 ? (
          <p className={stil.metin15}>
            Henüz yayın yok; ana sayfa varsayılan düzenle (tasarımdaki bölümler) görünüyor.
          </p>
        ) : (
          v.surumler.map((s) => (
            <div key={s.no} className={stil.kutu17}>
              <span className={stil.metin16}>{s.no}</span>
              <span className={stil.metin17}>{s.not}</span>
              <span className={stil.metin18}>
                {s.kim}
                {s.durum ? ` · ${s.durum}` : ''}
              </span>
              {s.don && tam ? (
                <button type="button" onClick={() => geriDon(s.surum)} className={stil.dugme10}>
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
