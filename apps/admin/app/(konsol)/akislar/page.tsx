'use client';

import {
  FLOW_CHANNELS,
  FLOW_CONDITIONS,
  type FlowChannel,
  type FlowCondition,
  type FlowStep,
} from '@rengarenk/shared';
import { type CSSProperties, useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';

interface Satir {
  tip: string;
  baslik: string;
  detay: string;
}
interface Akis {
  key: string;
  ad: string;
  tur: string;
  acik: boolean;
  adimlar: Satir[];
  ekAdimlar: FlowStep[];
  ekSatirlar: Satir[];
  hedef: Satir;
  surum: number;
  degiskenler: string[];
  epostaVar: boolean;
  akista: number;
  hedefte: number;
  kisi: number;
  okunma: number | null;
}

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
  fontFamily: 'inherit',
};
const etiket: CSSProperties = { display: 'block', fontSize: 13, fontWeight: 700 };
const ikincil: CSSProperties = {
  border: '1px solid #D5DAE5',
  background: '#FFFFFF',
  borderRadius: 10,
  padding: '9px 14px',
  fontSize: 13.5,
  fontWeight: 700,
  color: '#1E2333',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

/** Adım rengi (YonetimKampanya.dc.html › akış adımları) */
const RENK: Record<string, string> = {
  Tetikleyici: '#FFC84A',
  Koşul: '#F3EFFF',
  Bekle: '#EEF0F5',
  İleti: '#EEF3FF',
  'Koşul ve ileti': '#EEF3FF',
  Hedef: '#E7FAF0',
};
const yuzde = (x: number | null) => (x === null ? '—' : `%${Math.round(x * 100)}`);

/**
 * Otomatik akışlar (YonetimKampanya.dc.html › akışlar; Karar 51): yedi akış, aç/kapat, adımlar ve son 30 gün.
 * Tetikleyici ve ilk ileti kodda; "Adım ekle" ile ilk iletiden sonra bekleme, koşul ve ileti eklenir (yeni sürüm yalnızca
 * yeni başlayanlara). "Test kişisine gönder" akışın e-postalarını örnek değerlerle çalışanın adresine yollar.
 */
export default function Akislar() {
  const { me } = useKonsol();
  const duzenler = me.permissions['kampanya.hazirla'] === 'tam';
  const [liste, setListe] = useState<Akis[] | null>(null);
  const [sec, setSec] = useState('doluyor');
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [ekle, setEkle] = useState<FlowStep['tip'] | null>(null);
  const [saat, setSaat] = useState(24);
  const [kosul, setKosul] = useState<FlowCondition>('okunmadi');
  const [ileti, setIleti] = useState({ baslik: '', metin: '', dugme: 'Aç' });
  const [kanallar, setKanallar] = useState<FlowChannel[]>(['uygulama']);

  useEffect(() => {
    yonetim<Akis[]>('notifications/automations')
      .then(setListe)
      .catch((e: Error) => setHata(e.message));
  }, []);

  async function degistir(a: Akis) {
    try {
      setListe(
        await yonetim<Akis[]>(`notifications/automations/${a.key}`, {
          method: 'POST',
          body: { acik: !a.acik },
        }),
      );
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  async function kaydet(adimlar: FlowStep[], mesaj: string) {
    if (!akis) return;
    setHata(null);
    setBilgi(null);
    try {
      setListe(
        await yonetim<Akis[]>(`notifications/automations/${akis.key}/steps`, {
          method: 'PUT',
          body: { adimlar },
        }),
      );
      setEkle(null);
      setBilgi(mesaj);
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  function adimEkle() {
    if (!akis || !ekle) return;
    const yeni: FlowStep =
      ekle === 'bekle'
        ? { tip: 'bekle', saat }
        : ekle === 'kosul'
          ? { tip: 'kosul', kosul }
          : { tip: 'ileti', ...ileti, kanallar };
    void kaydet(
      [...akis.ekAdimlar, yeni],
      'Adım eklendi. Yeni sürüm bundan sonra akışa giren kişilere uygulanır.',
    );
  }

  async function test() {
    if (!akis) return;
    setHata(null);
    setBilgi(null);
    try {
      const r = await yonetim<{ gonderilen: number }>(`notifications/automations/${akis.key}/test`, {
        method: 'POST',
      });
      setBilgi(`${r.gonderilen} test e-postası örnek değerlerle şirket adresine gönderildi.`);
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  const akis = liste?.find((a) => a.key === sec);
  const tumu = akis
    ? [
        ...akis.adimlar.map((a) => ({ ...a, ek: -1 })),
        ...akis.ekSatirlar.map((a, i) => ({ ...a, ek: i })),
        { ...akis.hedef, ek: -1 },
      ]
    : [];
  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Otomatik akışlar</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#5A6073' }}>
          Tetikleyici, bekleme, koşul ve ileti adımlarıyla kurulur. Kişi hedefe ulaşınca akıştan çıkar.
        </p>
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <section
          aria-label="Akışlar"
          style={{
            flex: '1 1 340px',
            maxWidth: 420,
            minWidth: 0,
            background: '#FFFFFF',
            border: '1px solid #E3E6EF',
            borderRadius: 18,
            padding: 8,
          }}
        >
          {(liste ?? []).map((a) => (
            <div
              key={a.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                borderRadius: 12,
                padding: 10,
                background: a.key === sec ? '#F3EFFF' : 'transparent',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setSec(a.key);
                  setEkle(null);
                  setBilgi(null);
                }}
                aria-current={a.key === sec}
                style={{
                  flex: 1,
                  minWidth: 0,
                  textAlign: 'left',
                  border: 0,
                  background: 'transparent',
                  padding: 0,
                  cursor: 'pointer',
                  color: '#1E2333',
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ display: 'block', fontSize: 14, fontWeight: 800 }}>{a.ad}</span>
                <span style={{ display: 'block', fontSize: 12, color: '#5A6073', marginTop: 2 }}>
                  {a.tur} ·{' '}
                  {a.acik
                    ? `30 günde ${a.kisi.toLocaleString('tr-TR')} ileti · okunma ${yuzde(a.okunma)}`
                    : 'Kapalı'}
                </span>
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={a.acik}
                aria-label={`${a.ad}: aç veya kapat`}
                disabled={!duzenler}
                onClick={() => degistir(a)}
                style={{
                  flex: 'none',
                  border: 0,
                  background: 'transparent',
                  padding: 0,
                  cursor: duzenler ? 'pointer' : 'default',
                }}
              >
                <span
                  style={{
                    display: 'block',
                    width: 40,
                    height: 24,
                    borderRadius: 999,
                    background: a.acik ? '#3DD68C' : '#D5DAE5',
                    position: 'relative',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: 3,
                      left: a.acik ? 19 : 3,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: '#FFFFFF',
                      boxShadow: '0 1px 2px rgba(30,35,51,0.3)',
                    }}
                  />
                </span>
              </button>
            </div>
          ))}
        </section>
        {akis ? (
          <section
            aria-labelledby="akisad"
            style={{
              flex: '999 1 420px',
              minWidth: 0,
              background: '#FFFFFF',
              border: '1px solid #E3E6EF',
              borderRadius: 18,
              padding: 18,
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <h2 id="akisad" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                {akis.ad}
              </h2>
              <span style={{ fontSize: 12.5, color: '#5A6073' }}>
                {akis.acik
                  ? `Son 30 gün: ${akis.kisi.toLocaleString('tr-TR')} ileti · uygulamada okunma ${yuzde(akis.okunma)}`
                  : 'Kapalı'}
              </span>
            </div>
            <div style={{ marginTop: 16 }}>
              {tumu.map((ad, i) => (
                <div key={`${ad.ek}-${ad.tip}-${ad.baslik}`} style={{ display: 'flex', gap: 12 }}>
                  <span
                    style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                  >
                    <span
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: '50%',
                        background: RENK[ad.tip] ?? '#EEF0F5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 13,
                        fontWeight: 800,
                      }}
                    >
                      {i + 1}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        width: 2,
                        background: '#E3E6EF',
                        minHeight: 14,
                        opacity: i === tumu.length - 1 ? 0 : 1,
                      }}
                    />
                  </span>
                  <div style={{ flex: 1, minWidth: 0, paddingBottom: 14 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 10,
                        fontSize: 11.5,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: 0.4,
                        color: '#5A6073',
                      }}
                    >
                      <span>{ad.ek >= 0 ? `${ad.tip} · eklendi` : ad.tip}</span>
                      {ad.ek >= 0 && duzenler ? (
                        <button
                          type="button"
                          onClick={() =>
                            kaydet(
                              akis.ekAdimlar.filter((_, j) => j !== ad.ek),
                              'Adım kaldırıldı. Akışta olan kişiler başladıkları sürümle devam eder.',
                            )
                          }
                          style={{
                            border: 0,
                            background: 'transparent',
                            padding: 0,
                            color: '#A3271F',
                            fontSize: 12.5,
                            fontWeight: 700,
                            textTransform: 'none',
                            letterSpacing: 0,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          Kaldır
                        </button>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 14.5, fontWeight: 800, marginTop: 2 }}>{ad.baslik}</div>
                    <div style={{ fontSize: 12.5, color: '#3A4052', marginTop: 2 }}>{ad.detay}</div>
                  </div>
                </div>
              ))}
            </div>
            {akis.ekAdimlar.length && akis.ekAdimlar.at(-1)?.tip !== 'ileti' ? (
              <p
                role="status"
                style={{
                  margin: '0 0 14px',
                  background: '#FFF6DF',
                  color: '#7A5300',
                  borderRadius: 12,
                  padding: '10px 14px',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {`Son eklenen adım ${akis.ekAdimlar.at(-1)?.tip === 'bekle' ? 'bir bekleme' : 'bir koşul'}; ardından bir ileti eklemezsen kişi bu adımdan sonra akıştan çıkar.`}
              </p>
            ) : null}
            {ekle ? (
              <div
                style={{
                  border: '1.5px solid #5B8CFF',
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 14,
                  display: 'grid',
                  gap: 10,
                }}
              >
                <div
                  role="radiogroup"
                  aria-label="Adım türü"
                  style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}
                >
                  {(
                    [
                      ['bekle', 'Bekle'],
                      ['kosul', 'Koşul'],
                      ['ileti', 'İleti'],
                    ] as const
                  ).map(([k, ad]) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={ekle === k}
                      onClick={() => setEkle(k)}
                      style={{
                        ...ikincil,
                        borderRadius: 999,
                        padding: '7px 14px',
                        background: ekle === k ? '#EEF3FF' : '#FFFFFF',
                        borderColor: ekle === k ? '#5B8CFF' : '#D5DAE5',
                        color: ekle === k ? '#2450C8' : '#1E2333',
                      }}
                    >
                      {ad}
                    </button>
                  ))}
                </div>
                {ekle === 'bekle' ? (
                  <label style={etiket}>
                    Bekleme süresi
                    <select value={saat} onChange={(e) => setSaat(Number(e.target.value))} style={alan}>
                      {[1, 3, 6, 12, 24, 48, 72, 168].map((h) => (
                        <option key={h} value={h}>
                          {h % 24 === 0 ? `${h / 24} gün` : `${h} saat`}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {ekle === 'kosul' ? (
                  <label style={etiket}>
                    Koşul (sağlanmazsa kişi akıştan çıkar)
                    <select
                      value={kosul}
                      onChange={(e) => setKosul(e.target.value as FlowCondition)}
                      style={alan}
                    >
                      {(Object.keys(FLOW_CONDITIONS) as FlowCondition[]).map((k) => (
                        <option key={k} value={k}>
                          {FLOW_CONDITIONS[k].ad}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {ekle === 'ileti' ? (
                  <>
                    <label style={etiket}>
                      Başlık
                      <input
                        value={ileti.baslik}
                        maxLength={80}
                        onChange={(e) => setIleti({ ...ileti, baslik: e.target.value })}
                        style={alan}
                      />
                    </label>
                    <label style={etiket}>
                      Metin
                      <textarea
                        value={ileti.metin}
                        maxLength={300}
                        rows={3}
                        onChange={(e) => setIleti({ ...ileti, metin: e.target.value })}
                        style={{ ...alan, resize: 'vertical' }}
                      />
                    </label>
                    <label style={etiket}>
                      Düğme
                      <input
                        value={ileti.dugme}
                        maxLength={30}
                        onChange={(e) => setIleti({ ...ileti, dugme: e.target.value })}
                        style={alan}
                      />
                    </label>
                    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                      <legend style={{ ...etiket, padding: 0 }}>Kanal</legend>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 6 }}>
                        {(Object.keys(FLOW_CHANNELS) as FlowChannel[]).map((k) => {
                          const kapali = k === 'eposta' && !akis.epostaVar;
                          return (
                            <label
                              key={k}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                fontSize: 13.5,
                                color: kapali ? '#9AA0B0' : '#1E2333',
                              }}
                            >
                              <input
                                type="checkbox"
                                disabled={kapali}
                                checked={kanallar.includes(k)}
                                onChange={() =>
                                  setKanallar((x) => (x.includes(k) ? x.filter((y) => y !== k) : [...x, k]))
                                }
                              />
                              {FLOW_CHANNELS[k]}
                              {kapali ? ' (bu akışta yok)' : ''}
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                    <p style={{ margin: 0, fontSize: 12.5, color: '#5A6073' }}>
                      Kullanılabilir değişkenler: {akis.degiskenler.map((v) => `{{${v}}}`).join(', ')}. SMS
                      yalnızca kritik iletilerde kullanılır.
                    </p>
                  </>
                ) : null}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={adimEkle}
                    style={{
                      border: 0,
                      background: '#5B8CFF',
                      borderRadius: 10,
                      padding: '9px 16px',
                      fontSize: 13.5,
                      fontWeight: 800,
                      color: '#1E2333',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Hedeften önce ekle
                  </button>
                  <button type="button" onClick={() => setEkle(null)} style={ikincil}>
                    Vazgeç
                  </button>
                </div>
              </div>
            ) : null}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 8,
                borderTop: '1px solid #EEF0F5',
                paddingTop: 14,
              }}
            >
              {duzenler ? (
                <button
                  type="button"
                  onClick={() => setEkle((x) => (x ? null : 'bekle'))}
                  aria-expanded={Boolean(ekle)}
                  style={ikincil}
                >
                  Adım ekle
                </button>
              ) : null}
              <button type="button" onClick={test} style={ikincil}>
                Test kişisine gönder
              </button>
              <span style={{ flex: '1 1 200px', fontSize: 12.5, color: '#5A6073' }}>
                {akis.akista.toLocaleString('tr-TR')} kişi akışta · son 30 günde{' '}
                {akis.hedefte.toLocaleString('tr-TR')} kişi hedefe ulaştı
                {akis.surum ? ` · sürüm ${akis.surum}` : ''}
              </span>
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
