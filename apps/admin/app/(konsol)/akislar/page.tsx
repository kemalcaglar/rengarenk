'use client';

import {
  FLOW_CHANNELS,
  FLOW_CONDITIONS,
  type FlowChannel,
  type FlowCondition,
  type FlowStep,
} from '@rengarenk/shared';
import { type CSSProperties, useEffect, useState } from 'react';
import { cx } from '../../../lib/cx';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';
import stil from './page.module.css';

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
      <div className={stil.kutu1}>
        <h1 className={stil.baslik1}>Otomatik akışlar</h1>
        <p className={stil.metin1}>
          Tetikleyici, bekleme, koşul ve ileti adımlarıyla kurulur. Kişi hedefe ulaşınca akıştan çıkar.
        </p>
      </div>
      {hata ? (
        <p className="k-error" role="alert">
          {hata}
        </p>
      ) : null}
      {bilgi ? (
        <p role="status" className={stil.metin2}>
          {bilgi}
        </p>
      ) : null}
      <div className={stil.kutu2}>
        <section aria-label="Akışlar" className={stil.kutu3}>
          {(liste ?? []).map((a) => (
            <div key={a.key} className={cx(stil.kutu4, a.key === sec ? stil.kutu5 : stil.kutu6)}>
              <button
                type="button"
                onClick={() => {
                  setSec(a.key);
                  setEkle(null);
                  setBilgi(null);
                }}
                aria-current={a.key === sec}
                className={stil.dugme1}
              >
                <span className={stil.metin3}>{a.ad}</span>
                <span className={stil.metin4}>
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
                className={cx(stil.dugme2, duzenler ? stil.dugme3 : stil.dugme4)}
              >
                <span className={cx(stil.metin5, a.acik ? stil.metin6 : stil.metin7)}>
                  <span className={cx(stil.metin8, a.acik ? stil.metin9 : stil.metin10)} />
                </span>
              </button>
            </div>
          ))}
        </section>
        {akis ? (
          <section aria-labelledby="akisad" className={stil.kutu7}>
            <div className={stil.kutu8}>
              <h2 id="akisad" className={stil.baslik2}>
                {akis.ad}
              </h2>
              <span className={stil.metin11}>
                {akis.acik
                  ? `Son 30 gün: ${akis.kisi.toLocaleString('tr-TR')} ileti · uygulamada okunma ${yuzde(akis.okunma)}`
                  : 'Kapalı'}
              </span>
            </div>
            <div className={stil.kutu9}>
              {tumu.map((ad, i) => (
                <div key={`${ad.ek}-${ad.tip}-${ad.baslik}`} className={stil.kutu10}>
                  <span className={stil.metin12}>
                    <span className={stil.metin13} style={{ background: RENK[ad.tip] ?? '#EEF0F5' }}>
                      {i + 1}
                    </span>
                    <span className={cx(stil.metin14, i === tumu.length - 1 ? stil.metin15 : stil.metin16)} />
                  </span>
                  <div className={stil.kutu11}>
                    <div className={stil.kutu12}>
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
                          className={stil.dugme5}
                        >
                          Kaldır
                        </button>
                      ) : null}
                    </div>
                    <div className={stil.kutu13}>{ad.baslik}</div>
                    <div className={stil.kutu14}>{ad.detay}</div>
                  </div>
                </div>
              ))}
            </div>
            {akis.ekAdimlar.length && akis.ekAdimlar.at(-1)?.tip !== 'ileti' ? (
              <p role="status" className={stil.metin17}>
                {`Son eklenen adım ${akis.ekAdimlar.at(-1)?.tip === 'bekle' ? 'bir bekleme' : 'bir koşul'}; ardından bir ileti eklemezsen kişi bu adımdan sonra akıştan çıkar.`}
              </p>
            ) : null}
            {ekle ? (
              <div className={stil.kutu15}>
                <div role="radiogroup" aria-label="Adım türü" className={stil.kutu16}>
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
                  <label className={stil.etiket1}>
                    Bekleme süresi
                    <select
                      value={saat}
                      onChange={(e) => setSaat(Number(e.target.value))}
                      className={stil.girdi1}
                    >
                      {[1, 3, 6, 12, 24, 48, 72, 168].map((h) => (
                        <option key={h} value={h}>
                          {h % 24 === 0 ? `${h / 24} gün` : `${h} saat`}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {ekle === 'kosul' ? (
                  <label className={stil.etiket1}>
                    Koşul (sağlanmazsa kişi akıştan çıkar)
                    <select
                      value={kosul}
                      onChange={(e) => setKosul(e.target.value as FlowCondition)}
                      className={stil.girdi1}
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
                    <label className={stil.etiket1}>
                      Başlık
                      <input
                        value={ileti.baslik}
                        maxLength={80}
                        onChange={(e) => setIleti({ ...ileti, baslik: e.target.value })}
                        className={stil.girdi1}
                      />
                    </label>
                    <label className={stil.etiket1}>
                      Metin
                      <textarea
                        value={ileti.metin}
                        maxLength={300}
                        rows={3}
                        onChange={(e) => setIleti({ ...ileti, metin: e.target.value })}
                        className={stil.girdi2}
                      />
                    </label>
                    <label className={stil.etiket1}>
                      Düğme
                      <input
                        value={ileti.dugme}
                        maxLength={30}
                        onChange={(e) => setIleti({ ...ileti, dugme: e.target.value })}
                        className={stil.girdi1}
                      />
                    </label>
                    <fieldset className={stil.kutu17}>
                      <legend className={stil.baslik3}>Kanal</legend>
                      <div className={stil.kutu18}>
                        {(Object.keys(FLOW_CHANNELS) as FlowChannel[]).map((k) => {
                          const kapali = k === 'eposta' && !akis.epostaVar;
                          return (
                            <label key={k} className={cx(stil.etiket2, kapali ? stil.etiket3 : stil.etiket4)}>
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
                    <p className={stil.metin18}>
                      Kullanılabilir değişkenler: {akis.degiskenler.map((v) => `{{${v}}}`).join(', ')}.
                      WhatsApp yalnızca kritik iletilerde kullanılır.
                    </p>
                  </>
                ) : null}
                <div className={stil.kutu19}>
                  <button type="button" onClick={adimEkle} className={stil.dugme6}>
                    Hedeften önce ekle
                  </button>
                  <button type="button" onClick={() => setEkle(null)} className={stil.dugme7}>
                    Vazgeç
                  </button>
                </div>
              </div>
            ) : null}
            <div className={stil.kutu20}>
              {duzenler ? (
                <button
                  type="button"
                  onClick={() => setEkle((x) => (x ? null : 'bekle'))}
                  aria-expanded={Boolean(ekle)}
                  className={stil.dugme7}
                >
                  Adım ekle
                </button>
              ) : null}
              <button type="button" onClick={test} className={stil.dugme7}>
                Test kişisine gönder
              </button>
              <span className={stil.metin19}>
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
