'use client';

import { useCallback, useEffect, useState } from 'react';
import { cx } from '../../../lib/cx';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';
import stil from './page.module.css';

interface Satir {
  key: string;
  ad: string;
  tur: 'İşlemsel' | 'Ticari';
  kanallar: string[];
  surum: number;
}
interface Icerik {
  baslik: string;
  metin: string;
  eposta?: { konu: string; paragraflar: string[]; dugme?: { yazi: string; url: string } };
}
interface Detay {
  key: string;
  ad: string;
  tur: string;
  surum: number;
  kanallar: string[];
  degiskenler: string[];
  icerik: Icerik;
  /** Meta'da onaylı WhatsApp şablonu (konsoldan değişmez) */
  whatsapp: { sablon: string; parametreler: string[]; onizleme: string } | null;
  kural: string;
}
interface Onizleme {
  uygulama: { baslik: string; metin: string };
  eposta: { kimden: string; konu: string; html: string } | null;
  whatsapp: { sablon: string; metin: string } | null;
}
type Kanal = 'eposta' | 'push' | 'whatsapp' | 'uygulama';

/**
 * Şablonlar (YonetimKampanya.dc.html › şablonlar; Karar 48): tek şablondan e-posta, push, WhatsApp ve uygulama içi metin.
 * WhatsApp metni Meta'da onaylı şablondadır ve burada yalnızca gösterilir (sahip kararı 22 Kasım 2026: SMS'in yerine).
 * Değişkenler {{ad}} biçiminde; yalnızca şablonun tanıdığı değişkenler kullanılabilir. Kayıt yeni sürüm olarak eklenir,
 * önizleme "Ayşe için" örnek değerlerle sunucuda üretilir (gönderilecek e-postanın aynısı).
 */
export default function Sablonlar() {
  const { me } = useKonsol();
  const duzenler = me.permissions['kampanya.hazirla'] === 'tam';
  const [liste, setListe] = useState<Satir[]>([]);
  const [sec, setSec] = useState('talep.suresi_doluyor');
  const [d, setD] = useState<Detay | null>(null);
  const [ic, setIc] = useState<Icerik | null>(null);
  const [kanal, setKanal] = useState<Kanal>('eposta');
  const [onz, setOnz] = useState<Onizleme | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    yonetim<Satir[]>('notifications/templates')
      .then(setListe)
      .catch((e: Error) => setHata(e.message));
  }, []);
  useEffect(() => {
    setBilgi(null);
    yonetim<Detay>(`notifications/templates/${sec}`)
      .then((x) => {
        setD(x);
        setIc(x.icerik);
        setKanal(x.icerik.eposta ? 'eposta' : 'uygulama');
      })
      .catch((e: Error) => setHata(e.message));
  }, [sec]);

  // Önizleme: yazarken kısa gecikmeyle sunucuda üretilir
  const onizle = useCallback(async (key: string, icerik: Icerik) => {
    try {
      setOnz(
        await yonetim<Onizleme>(`notifications/templates/${key}/preview`, {
          method: 'POST',
          body: { icerik },
        }),
      );
      setHata(null);
    } catch (e) {
      setHata((e as Error).message);
    }
  }, []);
  useEffect(() => {
    if (!ic || !d) return;
    const t = setTimeout(() => onizle(d.key, ic), 400);
    return () => clearTimeout(t);
  }, [ic, d, onizle]);

  async function kaydet() {
    if (!d || !ic) return;
    try {
      const x = await yonetim<Detay>(`notifications/templates/${d.key}`, { method: 'POST', body: ic });
      setD(x);
      setListe((l) => l.map((s) => (s.key === x.key ? { ...s, surum: x.surum } : s)));
      setBilgi(`Sürüm ${x.surum} kaydedildi; bir dakika içinde gönderimlerde kullanılır.`);
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function test() {
    if (!d) return;
    try {
      await yonetim(`notifications/templates/${d.key}/test`, { method: 'POST', body: {} });
      setBilgi('Test e-postası kendi adresine gönderildi (örnek değerlerle).');
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  const kanallar: [Kanal, string, boolean][] = [
    ['eposta', 'E-posta', !!ic?.eposta],
    ['push', 'Push', !!d?.kanallar.includes('push')],
    ['whatsapp', 'WhatsApp', !!d?.whatsapp],
    ['uygulama', 'Uygulama içi', !!d?.kanallar.includes('uygulama içi')],
  ];

  return (
    <>
      <div className={stil.kutu1}>
        <h1 className={stil.baslik1}>Şablonlar</h1>
        <p className={stil.metin1}>
          Tek şablondan e-posta, push, WhatsApp ve uygulama içi metin. Değişkenler süslü parantezle yazılır.
        </p>
      </div>
      {hata ? <p className={stil.metin2}>{hata}</p> : null}
      {bilgi ? <p className={stil.metin3}>{bilgi}</p> : null}
      <div className={stil.kutu2}>
        <section aria-label="Şablon listesi" className={stil.kutu3}>
          {liste.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSec(s.key)}
              aria-current={s.key === sec}
              className={cx(stil.dugme1, s.key === sec ? stil.dugme2 : stil.dugme3)}
            >
              <span className={stil.metin4}>
                <span className={stil.metin5}>{s.ad}</span>
                <span className={cx(stil.metin6, s.tur === 'Ticari' ? stil.metin7 : stil.metin8)}>
                  {s.tur}
                </span>
              </span>
              <span className={stil.metin9}>
                {s.kanallar.join(', ')} · s.{s.surum}
              </span>
            </button>
          ))}
        </section>

        {d && ic ? (
          <section aria-labelledby="sbad" className={stil.kutu4}>
            <div className={stil.kutu5}>
              <h2 id="sbad" className={stil.baslik2}>
                {d.ad} <span className={stil.metin10}>· sürüm {d.surum}</span>
              </h2>
              <span className={stil.metin11}>
                <button type="button" onClick={test} disabled={!ic.eposta} className={stil.dugme4}>
                  Kendime test gönder
                </button>
                {duzenler ? (
                  <button type="button" onClick={kaydet} className={stil.dugme5}>
                    Yeni sürüm olarak kaydet
                  </button>
                ) : null}
              </span>
            </div>
            <div role="tablist" aria-label="Kanal" className={stil.kutu6}>
              {kanallar.map(([k, ad, var_]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={kanal === k}
                  disabled={!var_}
                  onClick={() => setKanal(k)}
                  className={cx(
                    stil.dugme6,
                    kanal === k ? stil.dugme7 : stil.dugme8,
                    var_ ? stil.dugme9 : stil.dugme10,
                  )}
                  style={{
                    border: 0,
                    borderBottom: `3px solid ${kanal === k ? '#5B8CFF' : 'transparent'}`,
                    color: var_ ? (kanal === k ? '#1E2333' : '#3A4052') : '#AEB5C4',
                  }}
                >
                  {ad}
                </button>
              ))}
            </div>
            <div className={stil.kutu7}>
              <div className={stil.kutu8}>
                {kanal === 'eposta' && ic.eposta ? (
                  <>
                    <label className={stil.etiket1}>
                      Konu
                      <input
                        value={ic.eposta.konu}
                        readOnly={!duzenler}
                        onChange={(e) =>
                          setIc({
                            ...ic,
                            eposta: { ...(ic.eposta as NonNullable<Icerik['eposta']>), konu: e.target.value },
                          })
                        }
                        className={stil.girdi1}
                      />
                    </label>
                    <label className={stil.etiket1}>
                      Gövde (her satır bir paragraf)
                      <textarea
                        rows={6}
                        value={ic.eposta.paragraflar.join('\n')}
                        readOnly={!duzenler}
                        onChange={(e) =>
                          setIc({
                            ...ic,
                            eposta: {
                              ...(ic.eposta as NonNullable<Icerik['eposta']>),
                              paragraflar: e.target.value.split('\n').filter((x) => x.trim()),
                            },
                          })
                        }
                        className={stil.girdi1}
                      />
                    </label>
                    {ic.eposta.dugme ? (
                      <label className={stil.etiket1}>
                        Buton
                        <input
                          value={ic.eposta.dugme.yazi}
                          readOnly={!duzenler}
                          onChange={(e) =>
                            setIc({
                              ...ic,
                              eposta: {
                                ...(ic.eposta as NonNullable<Icerik['eposta']>),
                                dugme: {
                                  ...(ic.eposta?.dugme as { yazi: string; url: string }),
                                  yazi: e.target.value,
                                },
                              },
                            })
                          }
                          className={stil.girdi1}
                        />
                      </label>
                    ) : null}
                  </>
                ) : kanal === 'whatsapp' ? (
                  d?.whatsapp ? (
                    <div className={stil.kutu9}>
                      <div className={stil.etiket1}>
                        Meta şablonu: <code>{d.whatsapp.sablon}</code>
                      </div>
                      <textarea rows={3} value={d.whatsapp.onizleme} readOnly className={stil.girdi1} />
                      <p className={stil.metin12}>
                        WhatsApp metni Meta'da onaylı şablondadır, buradan değişmez. Değiştirmek için Meta'da
                        yeni şablon onaylatılır ve kodda adı güncellenir. Gövdedeki yerler sırasıyla:{' '}
                        {d.whatsapp.parametreler.map((v) => `{{${v}}}`).join(', ')}.
                      </p>
                    </div>
                  ) : null
                ) : (
                  <>
                    <label className={stil.etiket1}>
                      Başlık
                      <input
                        value={ic.baslik}
                        readOnly={!duzenler}
                        onChange={(e) => setIc({ ...ic, baslik: e.target.value })}
                        className={stil.girdi1}
                      />
                    </label>
                    <label className={stil.etiket1}>
                      Metin
                      <textarea
                        rows={3}
                        value={ic.metin}
                        readOnly={!duzenler}
                        onChange={(e) => setIc({ ...ic, metin: e.target.value })}
                        className={stil.girdi1}
                      />
                    </label>
                  </>
                )}
                <div className={stil.kutu10}>Değişkenler</div>
                <div className={stil.kutu11}>
                  {d.degiskenler.map((v) => (
                    <span key={v} className={stil.metin13}>
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
                <p className={stil.metin14}>{d.kural}</p>
              </div>
              <div className={stil.kutu12}>
                <div className={stil.kutu10}>Önizleme · Ayşe için</div>
                {kanal === 'eposta' && onz?.eposta ? (
                  <div className={stil.kutu13}>
                    <div className={stil.kutu14}>
                      <strong>{onz.eposta.kimden}</strong>
                      <br />
                      Konu: {onz.eposta.konu}
                    </div>
                    <iframe
                      title="E-posta önizlemesi"
                      srcDoc={onz.eposta.html}
                      sandbox=""
                      className={stil.gorsel1}
                    />
                  </div>
                ) : kanal === 'whatsapp' && onz?.whatsapp ? (
                  <div className={stil.kutu15}>
                    <div className={stil.kutu16}>Rengarenk · WhatsApp</div>
                    <div className={stil.kutu17}>{onz.whatsapp.metin}</div>
                    <div className={stil.kutu18}>
                      Meta şablonu {onz.whatsapp.sablon} · ücret Meta faturasında
                    </div>
                  </div>
                ) : onz ? (
                  <div className={stil.kutu19}>
                    <div className={stil.kutu20}>10:00</div>
                    <div className={stil.kutu21}>
                      <div className={stil.kutu22}>RENGARENK · şimdi</div>
                      <div className={stil.kutu23}>{onz.uygulama.baslik}</div>
                      <div className={stil.kutu24}>{onz.uygulama.metin}</div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
