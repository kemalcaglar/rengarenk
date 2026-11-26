'use client';

import { KVKK_KIND_KEYS, KVKK_KINDS, type KvkkKind } from '@rengarenk/shared';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { cx } from '../../../lib/cx';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';
import stil from './page.module.css';

interface Satir {
  id: string;
  numara: string;
  tur: string;
  kim: string;
  alt: string;
  durum: 'acik' | 'yanitlandi';
  kalanGun: number | null;
  uyari: boolean;
}
interface Liste {
  sayilar: { ad: string; deger: string; not: string }[];
  acik: Satir[];
  kapali: Satir[];
}
interface Detay {
  id: string;
  numara: string;
  baslik: string;
  alt: string;
  metin: string;
  veriler: string[];
  taslak: string | null;
  yanit: string | null;
  durum: 'acik' | 'yanitlandi';
  userId: string | null;
  silme: boolean;
}

/**
 * KVKK başvuruları (YonetimSistem.dc.html › kvkk; Karar 58): 30 gün süre, ajanın topladığı veriler ve yanıt taslağı;
 * yanıtı her zaman bir çalışan okuyup gönderir. Dışarıdan (e-posta, posta) gelen başvuru kimlik doğrulandıktan sonra
 * buradan kaydedilir.
 */
export default function Kvkk() {
  const { me } = useKonsol();
  const gonderebilir = me.permissions['kvkk.yanitla'] === 'tam';
  const [l, setL] = useState<Liste | null>(null);
  const [sec, setSec] = useState<string | null>(null);
  const [d, setD] = useState<Detay | null>(null);
  const [metin, setMetin] = useState('');
  const [okudum, setOkudum] = useState(false);
  const [yeni, setYeni] = useState(false);
  const [dis, setDis] = useState<{
    ad: string;
    eposta: string;
    tur: KvkkKind;
    metin: string;
    kanal: 'eposta' | 'posta';
  }>({
    ad: '',
    eposta: '',
    tur: 'bilgi',
    metin: '',
    kanal: 'eposta',
  });
  const [kimlik, setKimlik] = useState(false);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    try {
      const x = await yonetim<Liste>('kvkk');
      setL(x);
      setSec((s) => s ?? x.acik[0]?.id ?? x.kapali[0]?.id ?? null);
    } catch (e) {
      setHata((e as Error).message);
    }
  }, []);
  useEffect(() => {
    yukle();
  }, [yukle]);
  useEffect(() => {
    if (!sec) return;
    setD(null);
    setOkudum(false);
    yonetim<Detay>(`kvkk/${sec}`)
      .then((x) => {
        setD(x);
        setMetin(x.taslak ?? '');
      })
      .catch((e: Error) => setHata(e.message));
  }, [sec]);

  async function gonder() {
    if (!d) return;
    setHata(null);
    try {
      setD(await yonetim<Detay>(`kvkk/${d.id}/reply`, { method: 'POST', body: { metin, okudum: true } }));
      setBilgi('Yanıt gönderildi · başvuru kapatıldı ve kaydı 3 yıl saklanacak');
      yukle();
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function kaydet() {
    setHata(null);
    try {
      const x = await yonetim<Detay>('kvkk', { method: 'POST', body: { ...dis, kimlikDogrulandi: true } });
      setYeni(false);
      setKimlik(false);
      setDis({ ad: '', eposta: '', tur: 'bilgi', metin: '', kanal: 'eposta' });
      setBilgi(`${x.numara} kaydedildi; 30 günlük süre başladı.`);
      await yukle();
      setSec(x.id);
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  const satirlar = l ? [...l.acik, ...l.kapali] : [];
  return (
    <>
      <div className={stil.kutu1}>
        <div>
          <h1 className={stil.baslik1}>KVKK başvuruları</h1>
          <p className={stil.metin1}>
            En geç 30 gün içinde yanıtlanır (KVKK m.13). Ajan taslak hazırlar; yanıtı her zaman bir çalışan
            gönderir.
          </p>
        </div>
        <button type="button" onClick={() => setYeni((v) => !v)} className={stil.dugme1}>
          Dışarıdan gelen başvuruyu kaydet
        </button>
      </div>
      {hata ? <p className={stil.metin2}>{hata}</p> : null}
      {bilgi ? (
        <p role="status" className={stil.metin3}>
          {bilgi}
        </p>
      ) : null}
      {yeni ? (
        <section className={stil.kutu2} aria-label="Dışarıdan başvuru">
          <div className={stil.kutu3}>
            <label className={stil.etiket1}>
              Ad soyad
              <input
                value={dis.ad}
                onChange={(e) => setDis({ ...dis, ad: e.target.value })}
                className={stil.girdi1}
              />
            </label>
            <label className={stil.etiket2}>
              Yanıt e-postası
              <input
                value={dis.eposta}
                onChange={(e) => setDis({ ...dis, eposta: e.target.value })}
                className={stil.girdi1}
              />
            </label>
            <label className={stil.etiket3}>
              Tür
              <select
                value={dis.tur}
                onChange={(e) => setDis({ ...dis, tur: e.target.value as KvkkKind })}
                className={stil.girdi1}
              >
                {KVKK_KIND_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {KVKK_KINDS[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className={stil.etiket4}>
              Kanal
              <select
                value={dis.kanal}
                onChange={(e) => setDis({ ...dis, kanal: e.target.value as 'eposta' | 'posta' })}
                className={stil.girdi1}
              >
                <option value="eposta">E-posta</option>
                <option value="posta">Posta</option>
              </select>
            </label>
          </div>
          <label className={stil.etiket5}>
            Başvuru metni
            <textarea
              rows={3}
              value={dis.metin}
              onChange={(e) => setDis({ ...dis, metin: e.target.value })}
              className={stil.girdi2}
            />
          </label>
          <label className={stil.etiket6}>
            <input
              type="checkbox"
              checked={kimlik}
              onChange={(e) => setKimlik(e.target.checked)}
              className={stil.girdi3}
            />
            Başvuranın kimliğini doğruladım
          </label>
          <button
            type="button"
            onClick={kaydet}
            disabled={!kimlik}
            className={cx(stil.dugme2, kimlik ? stil.dugme3 : stil.dugme4)}
          >
            Kaydet
          </button>
        </section>
      ) : null}
      {l ? (
        <div className={stil.kutu4}>
          {l.sayilar.map((s) => (
            <div key={s.ad} className={stil.kutu5}>
              <div className={stil.kutu6}>{s.ad}</div>
              <div className={stil.kutu7}>{s.deger}</div>
              <div className={stil.kutu8}>{s.not}</div>
            </div>
          ))}
        </div>
      ) : null}
      <div className={stil.kutu9}>
        <section aria-label="Başvurular" className={stil.kutu10}>
          {l && !satirlar.length ? <p className={stil.metin4}>Başvuru yok.</p> : null}
          {satirlar.map((b) => {
            const on = b.id === sec;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setSec(b.id);
                  setBilgi(null);
                }}
                aria-current={on}
                className={cx(stil.dugme5, on ? stil.dugme6 : stil.dugme7)}
              >
                <span className={stil.metin5}>
                  <span className={stil.metin6}>
                    {b.tur} · {b.numara}
                  </span>
                  <span
                    style={{ color: b.durum === 'yanitlandi' ? '#11683F' : b.uyari ? '#7A5300' : '#5A6073' }}
                  >
                    {b.durum === 'yanitlandi' ? 'Yanıtlandı' : `Kalan ${Math.max(0, b.kalanGun ?? 0)} gün`}
                  </span>
                </span>
                <span className={stil.metin7}>{b.kim}</span>
                <span className={stil.metin8}>{b.alt}</span>
              </button>
            );
          })}
        </section>
        <section aria-labelledby="bvd" className={stil.kutu11}>
          {d ? (
            <>
              <div className={stil.kutu12}>
                <h2 id="bvd" className={stil.baslik2}>
                  {d.baslik}
                </h2>
                <div className={stil.kutu13}>
                  {d.numara} · {d.alt}
                  {d.userId ? (
                    <>
                      {' · '}
                      <Link href={`/kullanicilar?kisi=${d.userId}`}>Kullanıcı kartı</Link>
                    </>
                  ) : null}
                </div>
              </div>
              <div className={stil.kutu14}>
                <span className={stil.metin9}>Başvuru metni</span>
                {d.metin}
              </div>
              <div className={stil.kutu15}>
                <div className={stil.kutu16}>Ajanın topladığı veriler</div>
                <div className={stil.kutu17}>
                  {d.veriler.length ? (
                    d.veriler.map((v) => (
                      <span key={v} className={stil.metin10}>
                        {v}
                      </span>
                    ))
                  ) : (
                    <span className={stil.metin11}>Hesapla eşleşmedi; veriler e-postayla doğrulanmalı.</span>
                  )}
                </div>
              </div>
              {d.durum === 'acik' ? (
                <div className={stil.kutu18}>
                  <div className={stil.kutu19}>
                    <span className={stil.metin6}>Ajanın yanıt taslağı</span>
                    <span className={stil.metin12}>Gönderimi yalnızca çalışan yapar</span>
                  </div>
                  <label htmlFor="kvy" className={stil.etiket7}>
                    Yanıt metni
                  </label>
                  <textarea
                    id="kvy"
                    value={metin}
                    onChange={(e) => setMetin(e.target.value)}
                    rows={6}
                    className={stil.girdi4}
                  />
                  {d.silme ? (
                    <p className={stil.metin13}>
                      Hesap kapatma ve anonimleştirme sahip kararıyla eklenecek; kullanılmamış hakların iadesi
                      yalnızca sahip onayıyla yapılır.
                    </p>
                  ) : null}
                  <label className={stil.etiket8}>
                    <input
                      type="checkbox"
                      checked={okudum}
                      onChange={(e) => setOkudum(e.target.checked)}
                      className={stil.girdi3}
                    />
                    Taslağı ve eklenecek verileri okudum
                  </label>
                  <button
                    type="button"
                    onClick={gonder}
                    disabled={!okudum || !gonderebilir}
                    title={gonderebilir ? undefined : 'Yanıtı tam yetkili çalışan gönderir'}
                    className={cx(stil.dugme8, okudum && gonderebilir ? stil.dugme3 : stil.dugme4)}
                  >
                    Yanıtı gönder
                  </button>
                </div>
              ) : (
                <div className={stil.kutu18}>
                  <div className={stil.kutu20}>
                    Yanıt gönderildi · başvuru kapatıldı ve kaydı 3 yıl saklanacak
                  </div>
                  <p className={stil.metin14}>{d.yanit}</p>
                </div>
              )}
            </>
          ) : (
            <p className={stil.metin15}>{l ? 'Bir başvuru seç.' : 'Yükleniyor…'}</p>
          )}
        </section>
      </div>
    </>
  );
}
