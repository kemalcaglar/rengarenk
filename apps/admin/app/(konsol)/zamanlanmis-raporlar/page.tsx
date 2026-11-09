'use client';

import { REPORT_FREQUENCIES, type ScheduledSource } from '@rengarenk/shared';
import Link from 'next/link';
import { type CSSProperties, type ReactNode, useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';
import { Switch } from '../switch';

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

const kutu: CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E3E6EF',
  borderRadius: 18,
  overflow: 'hidden',
};
const baslik2: CSSProperties = {
  margin: 0,
  padding: '16px 18px',
  fontSize: 17,
  fontWeight: 800,
  borderBottom: '1px solid #EEF0F5',
};
const etiket: CSSProperties = { fontSize: 13, fontWeight: 700 };
const alan: CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  marginTop: 5,
  border: '1px solid #D5DAE5',
  borderRadius: 10,
  padding: 10,
  fontSize: 14,
  background: '#FFFFFF',
};
const anaDugme: CSSProperties = {
  border: 0,
  background: '#5B8CFF',
  borderRadius: 12,
  fontWeight: 800,
  color: '#1E2333',
  cursor: 'pointer',
};

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
    <span
      style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}
    >
      <Switch on={on} label={label} disabled={disabled} onChange={onChange} />
      {durum}
    </span>
  );

  const satir = (k: Kural) => (
    <div
      key={k.key}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '6px 14px',
        padding: '12px 18px',
        borderBottom: '1px solid #EEF0F5',
        fontSize: 13.5,
      }}
    >
      <span style={{ flex: '999 1 280px', minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 700 }}>{k.kosul}</span>
        <span style={{ display: 'block', fontSize: 12, color: '#5A6073', marginTop: 2 }}>{k.ad}</span>
      </span>
      <span style={{ flex: 'none', color: '#3A4052' }}>
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
    <div
      key={key}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '8px 16px',
        padding: '13px 18px',
        borderBottom: '1px solid #EEF0F5',
      }}
    >
      <span style={{ flex: '999 1 300px', minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800 }}>{ad}</span>
        <span style={{ display: 'block', fontSize: 12.5, color: '#3A4052', marginTop: 2 }}>{zaman}</span>
        <span style={{ display: 'block', fontSize: 12, color: '#5A6073', marginTop: 2 }}>{bicim}</span>
        {ek ? (
          <span style={{ display: 'block', fontSize: 12, color: '#5A6073', marginTop: 2 }}>{ek}</span>
        ) : null}
      </span>
      {sag}
    </div>
  );

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
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Zamanlanmış raporlar ve uyarılar</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#5A6073' }}>
            Raporlar ve uyarılar şirket e-postana gelir; uyarılar konsolda{' '}
            <Link href="/uyarilar">Uyarılar</Link> listesinde de görünür.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setForm((f) => !f)}
          aria-expanded={form}
          style={{ ...anaDugme, padding: '12px 18px', fontSize: 14.5 }}
        >
          Yeni zamanlanmış rapor
        </button>
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

      {form && v ? (
        <section
          aria-label="Yeni zamanlanmış rapor"
          style={{
            background: '#FFFFFF',
            border: '1.5px solid #5B8CFF',
            borderRadius: 18,
            padding: 18,
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 }}>
            <label style={{ ...etiket, flex: '2 1 220px' }}>
              Rapor
              <select value={kaynak} onChange={(e) => setKaynak(Number(e.target.value))} style={alan}>
                {v.kaynaklar.map((k, i) => (
                  <option key={k.ad} value={i}>
                    {k.ad}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ ...etiket, flex: '1 1 150px' }}>
              Sıklık
              <select value={siklik} onChange={(e) => setSiklik(e.target.value)} style={alan}>
                {REPORT_FREQUENCIES.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.ad}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ ...etiket, flex: '0 1 100px' }}>
              Saat
              <input type="time" value={saat} onChange={(e) => setSaat(e.target.value)} style={alan} />
            </label>
            <fieldset style={{ flex: '2 1 220px', border: 0, padding: 0, margin: 0, minWidth: 0 }}>
              <legend style={{ ...etiket, padding: 0 }}>Alıcılar</legend>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 5 }}>
                {v.calisanlar.map((c) => {
                  const on = alicilar.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setAlicilar((a) => (on ? a.filter((x) => x !== c.id) : [...a, c.id]))}
                      style={{
                        border: `1px solid ${on ? '#5B8CFF' : '#D5DAE5'}`,
                        background: on ? '#EEF3FF' : '#FFFFFF',
                        color: on ? '#2450C8' : '#3A4052',
                        borderRadius: 999,
                        padding: '8px 12px',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
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
              style={{ ...anaDugme, padding: '11px 18px', fontSize: 14, opacity: alicilar.length ? 1 : 0.5 }}
            >
              Kaydet
            </button>
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 12.5, color: '#5A6073' }}>
            Alıcılar yalnızca raporları görebilen çalışanlar arasından seçilir; rapor PDF olarak gelir ve
            kişisel veri içermez.
          </p>
        </section>
      ) : null}

      <section aria-labelledby="planli" style={kutu}>
        <h2 id="planli" style={baslik2}>
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
              <span style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 14 }}>
                {r.silinebilir ? (
                  <button
                    type="button"
                    onClick={() => sil(r)}
                    style={{
                      border: 0,
                      background: 'transparent',
                      padding: 0,
                      color: '#A3271F',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
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

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 14, alignItems: 'flex-start' }}>
        <section aria-labelledby="uyari" style={{ ...kutu, flex: '3 1 460px', minWidth: 0 }}>
          <h2 id="uyari" style={baslik2}>
            Kritik uyarılar
          </h2>
          {kurallar === null ? <p className="k-empty">Yükleniyor…</p> : kritik.map(satir)}
          <p style={{ margin: 0, padding: '12px 18px', fontSize: 12.5, color: '#5A6073' }}>
            Kritik uyarılar kapatılamaz ve e-postanın konusunda “Kritik” olarak gelir.
          </p>
        </section>
        <section aria-labelledby="pano" style={{ ...kutu, flex: '2 1 300px', minWidth: 0 }}>
          <h2 id="pano" style={baslik2}>
            Kayıtlı panolar
          </h2>
          {v === null ? (
            <p className="k-empty">Yükleniyor…</p>
          ) : v.panolar.length ? (
            v.panolar.map((p) => (
              <Link
                key={p.id}
                href={`/raporlar?pano=${p.id}`}
                style={{
                  display: 'block',
                  padding: '12px 18px',
                  borderBottom: '1px solid #EEF0F5',
                  color: '#1E2333',
                  textDecoration: 'none',
                }}
              >
                <span style={{ display: 'block', fontSize: 14, fontWeight: 800 }}>{p.ad}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: '#5A6073', marginTop: 2 }}>
                  {p.not}
                </span>
              </Link>
            ))
          ) : (
            <p style={{ margin: 0, padding: '12px 18px', fontSize: 13, color: '#5A6073' }}>
              Raporlar ekranında “Panoya kaydet” ile kaydedilen görünümler burada listelenir.
            </p>
          )}
        </section>
      </div>

      <section aria-labelledby="diger" style={{ ...kutu, marginTop: 14 }}>
        <h2 id="diger" style={baslik2}>
          Diğer uyarılar
        </h2>
        {kurallar === null ? <p className="k-empty">Yükleniyor…</p> : diger.map(satir)}
        <p style={{ margin: 0, padding: '12px 18px', fontSize: 12.5, color: '#5A6073' }}>
          {sahip
            ? 'Kapattığın uyarı kimseye gitmez; değişiklik işlem kaydına girer.'
            : 'Uyarıları yalnızca sahip açıp kapatır.'}
        </p>
      </section>
    </>
  );
}
