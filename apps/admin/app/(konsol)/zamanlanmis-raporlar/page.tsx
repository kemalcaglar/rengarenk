'use client';

import { REPORT_FREQUENCIES, type ScheduledSource } from '@rengarenk/shared';
import Link from 'next/link';
import { type ReactNode, useEffect, useState } from 'react';
import { cx } from '../../../lib/cx';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';
import { Switch } from '../switch';
import stil from './page.module.css';

interface Kural {
  key: string;
  ad: string;
  kosul: string;
  kritik: boolean;
  acik: boolean;
  kanal: string;
  alicilar: string[];
}

interface Rapor {
  id: string;
  key: string | null;
  ad: string;
  zaman: string;
  alici: string;
  bicim: string;
  acik: boolean;
  durum: string;
  onayBekliyor: boolean;
  sonraki: string | null;
  son: string | null;
  silinebilir: boolean;
  degistirebilir: boolean;
}

interface Veri {
  raporlar: Rapor[];
  panolar: { id: string; ad: string; not: string }[];
  kaynaklar: { kaynak: ScheduledSource; ad: string }[];
  calisanlar: { id: string; ad: string }[];
}

/**
 * Büyüme › Zamanlanmış raporlar ve uyarılar (YonetimRapor.dc.html › zaman; Karar 44). Ajanın günlük özeti ve uyarılar
 * çalışan uyarılarından; haftalık ve aylık rapor, eklenen raporlar ve galerilere "aranan modeller" raporu zamanlanmış
 * raporlardan gelir. Raporlar şirket e-postasına PDF ekiyle gider; galeri raporunu açmak toplu gönderim onayı ister.
 * Kritik uyarı kapatılamaz; diğer uyarıları yalnızca Sahip kapatır.
 */
export default function ZamanlanmisRaporlar() {
  const { me } = useKonsol();
  const sahip = me.role === 'OWNER';
  const [kurallar, setKurallar] = useState<Kural[] | null>(null);
  const [v, setV] = useState<Veri | null>(null);
  const [form, setForm] = useState(false);
  const [kaynak, setKaynak] = useState(0);
  const [siklik, setSiklik] = useState('hafta:5');
  const [saat, setSaat] = useState('17:00');
  const [alicilar, setAlicilar] = useState<string[]>([me.id]);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    yonetim<Kural[]>('alerts/rules')
      .then(setKurallar)
      .catch((e: Error) => setHata(e.message));
    yonetim<Veri>('scheduled-reports')
      .then(setV)
      .catch((e: Error) => setHata(e.message));
  }, []);

  async function degistir(k: Kural) {
    try {
      const r = await yonetim<{ key: string; acik: boolean }>(`alerts/rules/${k.key}`, {
        method: 'POST',
        body: { enabled: !k.acik },
      });
      setKurallar((l) => (l ?? []).map((x) => (x.key === r.key ? { ...x, acik: r.acik } : x)));
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  async function raporDegistir(r: Rapor) {
    setHata(null);
    setBilgi(null);
    try {
      const yeni = await yonetim<Veri>(`scheduled-reports/${r.id}/switch`, {
        method: 'POST',
        body: { acik: !r.acik },
      });
      setV(yeni);
      if (r.key === 'galeri' && !r.acik)
        setBilgi('Açma isteği Onay kuyruğuna gitti. Onaylanınca rapor her ay galerilere gönderilir.');
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  async function kaydet() {
    const k = v?.kaynaklar[kaynak];
    if (!k) return;
    setHata(null);
    try {
      setV(
        await yonetim<Veri>('scheduled-reports', {
          method: 'POST',
          body: { kaynak: k.kaynak, siklik, saat, alicilar },
        }),
      );
      setForm(false);
      setBilgi(`“${k.ad.replace('Kayıtlı pano: ', '')}” zamanlandı. İlk gönderim bir sonraki zamanda.`);
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  async function sil(r: Rapor) {
    if (!window.confirm(`“${r.ad}” zamanlanmış raporu silinsin mi?`)) return;
    try {
      setV(await yonetim<Veri>(`scheduled-reports/${r.id}`, { method: 'DELETE' }));
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  const ozet = kurallar?.find((k) => k.key === 'ajan_ozet');
  const kritik = (kurallar ?? []).filter((k) => k.kritik);
  const diger = (kurallar ?? []).filter((k) => !k.kritik && k.key !== 'ajan_ozet');

  const anahtar = (on: boolean, label: string, disabled: boolean, durum: string, onChange: () => void) => (
    <span className={stil.metin1}>
      <Switch on={on} label={label} disabled={disabled} onChange={onChange} />
      {durum}
    </span>
  );

  const satir = (k: Kural) => (
    <div key={k.key} className={stil.kutu1}>
      <span className={stil.metin2}>
        <span className={stil.metin3}>{k.kosul}</span>
        <span className={stil.metin4}>{k.ad}</span>
      </span>
      <span className={stil.metin5}>
        {k.kanal} · {k.alicilar.join(', ')}
      </span>
      {k.kritik
        ? null
        : anahtar(k.acik, `${k.ad}: aç veya kapat`, !sahip, k.acik ? 'Açık' : 'Kapalı', () => degistir(k))}
    </div>
  );

  const raporSatiri = (
    key: string,
    ad: string,
    zaman: string,
    bicim: string,
    ek: string | null,
    sag: ReactNode,
  ) => (
    <div key={key} className={stil.kutu2}>
      <span className={stil.metin6}>
        <span className={stil.metin7}>{ad}</span>
        <span className={stil.metin8}>{zaman}</span>
        <span className={stil.metin4}>{bicim}</span>
        {ek ? <span className={stil.metin4}>{ek}</span> : null}
      </span>
      {sag}
    </div>
  );

  return (
    <>
      <div className={stil.kutu3}>
        <div>
          <h1 className={stil.baslik1}>Zamanlanmış raporlar ve uyarılar</h1>
          <p className={stil.metin9}>
            Raporlar ve uyarılar şirket e-postana gelir; uyarılar konsolda{' '}
            <Link href="/uyarilar">Uyarılar</Link> listesinde de görünür.
          </p>
        </div>
        <button type="button" onClick={() => setForm((f) => !f)} aria-expanded={form} className={stil.dugme1}>
          Yeni zamanlanmış rapor
        </button>
      </div>
      {hata ? (
        <p className="k-error" role="alert">
          {hata}
        </p>
      ) : null}
      {bilgi ? (
        <p role="status" className={stil.metin10}>
          {bilgi}
        </p>
      ) : null}

      {form && v ? (
        <section aria-label="Yeni zamanlanmış rapor" className={stil.kutu4}>
          <div className={stil.kutu5}>
            <label className={stil.etiket1}>
              Rapor
              <select
                value={kaynak}
                onChange={(e) => setKaynak(Number(e.target.value))}
                className={stil.girdi1}
              >
                {v.kaynaklar.map((k, i) => (
                  <option key={k.ad} value={i}>
                    {k.ad}
                  </option>
                ))}
              </select>
            </label>
            <label className={stil.etiket2}>
              Sıklık
              <select value={siklik} onChange={(e) => setSiklik(e.target.value)} className={stil.girdi1}>
                {REPORT_FREQUENCIES.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.ad}
                  </option>
                ))}
              </select>
            </label>
            <label className={stil.etiket3}>
              Saat
              <input
                type="time"
                value={saat}
                onChange={(e) => setSaat(e.target.value)}
                className={stil.girdi1}
              />
            </label>
            <fieldset className={stil.kutu6}>
              <legend className={stil.baslik2}>Alıcılar</legend>
              <div className={stil.kutu7}>
                {v.calisanlar.map((c) => {
                  const on = alicilar.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setAlicilar((a) => (on ? a.filter((x) => x !== c.id) : [...a, c.id]))}
                      className={cx(stil.dugme2, on ? stil.dugme3 : stil.dugme4)}
                      style={{ border: `1px solid ${on ? '#5B8CFF' : '#D5DAE5'}` }}
                    >
                      {on ? '✓ ' : ''}
                      {c.ad}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <button
              type="button"
              onClick={kaydet}
              disabled={!alicilar.length}
              className={cx(stil.dugme5, alicilar.length ? stil.dugme6 : stil.dugme7)}
            >
              Kaydet
            </button>
          </div>
          <p className={stil.metin11}>
            Alıcılar yalnızca raporları görebilen çalışanlar arasından seçilir; rapor PDF olarak gelir ve
            kişisel veri içermez.
          </p>
        </section>
      ) : null}

      <section aria-labelledby="planli" className={stil.kutu8}>
        <h2 id="planli" className={stil.baslik3}>
          Raporlar
        </h2>
        {ozet
          ? raporSatiri(
              'ozet',
              ozet.ad,
              `Her gün 09.00 · ${ozet.alicilar.join(', ')}`,
              'E-posta ve konsol · dünün özeti, dikkat isteyenler, ajanın yaptıkları',
              null,
              anahtar(
                ozet.acik,
                'Ajanın günlük özeti: aç veya kapat',
                !sahip,
                ozet.acik ? 'Açık' : 'Kapalı',
                () => degistir(ozet),
              ),
            )
          : null}
        {v === null ? (
          <p className="k-empty">Yükleniyor…</p>
        ) : (
          v.raporlar.map((r) =>
            raporSatiri(
              r.id,
              r.ad,
              `${r.zaman} · ${r.alici}`,
              r.bicim,
              [r.son ? `Son gönderim: ${r.son}` : null, r.sonraki ? `Sıradaki: ${r.sonraki}` : null]
                .filter(Boolean)
                .join(' · ') || null,
              <span className={stil.metin12}>
                {r.silinebilir ? (
                  <button type="button" onClick={() => sil(r)} className={stil.dugme8}>
                    Sil
                  </button>
                ) : null}
                {anahtar(r.acik, `${r.ad}: aç veya kapat`, !r.degistirebilir, r.durum, () =>
                  raporDegistir(r),
                )}
              </span>,
            ),
          )
        )}
      </section>

      <div className={stil.kutu9}>
        <section aria-labelledby="uyari" className={stil.kutu10}>
          <h2 id="uyari" className={stil.baslik3}>
            Kritik uyarılar
          </h2>
          {kurallar === null ? <p className="k-empty">Yükleniyor…</p> : kritik.map(satir)}
          <p className={stil.metin13}>
            Kritik uyarılar kapatılamaz ve e-postanın konusunda “Kritik” olarak gelir.
          </p>
        </section>
        <section aria-labelledby="pano" className={stil.kutu11}>
          <h2 id="pano" className={stil.baslik3}>
            Kayıtlı panolar
          </h2>
          {v === null ? (
            <p className="k-empty">Yükleniyor…</p>
          ) : v.panolar.length ? (
            v.panolar.map((p) => (
              <Link key={p.id} href={`/raporlar?pano=${p.id}`} className={stil.bag1}>
                <span className={stil.metin14}>{p.ad}</span>
                <span className={stil.metin15}>{p.not}</span>
              </Link>
            ))
          ) : (
            <p className={stil.metin16}>
              Raporlar ekranında “Panoya kaydet” ile kaydedilen görünümler burada listelenir.
            </p>
          )}
        </section>
      </div>

      <section aria-labelledby="diger" className={stil.kutu12}>
        <h2 id="diger" className={stil.baslik3}>
          Diğer uyarılar
        </h2>
        {kurallar === null ? <p className="k-empty">Yükleniyor…</p> : diger.map(satir)}
        <p className={stil.metin13}>
          {sahip
            ? 'Kapattığın uyarı kimseye gitmez; değişiklik işlem kaydına girer.'
            : 'Uyarıları yalnızca sahip açıp kapatır.'}
        </p>
      </section>
    </>
  );
}
