'use client';

import {
  HELP_TOPICS,
  type PublicHelpTopic,
  SUPPORT_TOPIC_KEYS,
  SUPPORT_TOPICS,
  type SupportTopic,
} from '@rengarenk/shared';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CerezBandi } from '../../components/cerez-bandi';
import { cx } from '../../lib/cx';
import { API, istek, useGiris } from '../../lib/istemci';
import { colors } from '../../lib/renk';
import stil from './page.module.css';

const BARS = [colors.blue, colors.pink, colors.yellow, colors.green];
const tr = (s: string) => s.toLocaleLowerCase('tr-TR');

/** API'ye ulaşılamazsa koddaki sık sorulanlar (ilk kurulum içeriği; sayaç tutulmaz) */
const YEDEK: PublicHelpTopic[] = HELP_TOPICS.map((t) => ({
  key: t.key,
  ad: t.ad,
  not: t.not,
  renk: t.renk,
  makaleler: t.sorular.map(([soru, cevap]) => ({ id: '', soru, cevap })),
}));
type Makale = PublicHelpTopic['makaleler'][number];

/**
 * Yardım merkezi (Yardim.dc.html; Karar 54): konular, sık sorulanlar, arama, güvenli alışveriş ve destek talebi.
 * Destek yalnızca yazılıdır; yanıt Mesajlarım'daki "Rengarenk Destek" sohbetine ve e-postaya gelir.
 */
export default function Yardim() {
  const giris = useGiris();
  const [ben, setBen] = useState<{ ad: string; bas: string } | null>(null);
  const [konu, setKonu] = useState<string>(HELP_TOPICS[0].key);
  // Makaleler konsoldan yönetilir (Karar 46): yayındakiler API'den
  const [konular, setKonular] = useState<PublicHelpTopic[]>(YEDEK);
  const [oy, setOy] = useState<Record<string, boolean>>({});
  useEffect(() => {
    fetch(`${API}/yardim/makaleler`)
      .then((r) => (r.ok ? (r.json() as Promise<PublicHelpTopic[]>) : null))
      .then((l) => l && setKonular(l))
      .catch(() => undefined);
  }, []);
  const [acik, setAcik] = useState(0);
  const [ara, setAra] = useState('');
  const [aranan, setAranan] = useState('');
  const [form, setForm] = useState<{ konu: SupportTopic; referans: string; metin: string }>({
    konu: 'odeme',
    referans: '',
    metin: '',
  });
  const [gonderildi, setGonderildi] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);
  // Destek sohbeti (Karar 42): gönderilmeden önce ajanın hemen yanıtı
  const [oneri, setOneri] = useState<string | null>(null);
  const [oneriSoruldu, setOneriSoruldu] = useState(false);
  const [cozuldu, setCozuldu] = useState(false);

  useEffect(() => {
    if (!giris) return;
    istek<{ firstName: string | null; lastName: string | null }>('/me')
      .then((m) => {
        const ad = [m.firstName, m.lastName].filter(Boolean).join(' ') || 'Hesabım';
        setBen({
          ad,
          bas: ad
            .split(' ')
            .slice(0, 2)
            .map((w) => w.charAt(0).toLocaleUpperCase('tr-TR'))
            .join(''),
        });
      })
      .catch(() => undefined);
  }, [giris]);

  const k = konular.find((x) => x.key === konu) ?? (konular[0] as PublicHelpTopic);
  // Aramada bütün konuların soru ve yanıtları taranır
  const sonuc = useMemo(() => {
    const q = tr(aranan.trim());
    if (!q) return null;
    return konular.flatMap((t) =>
      t.makaleler.filter((m) => tr(m.soru).includes(q) || tr(m.cevap).includes(q)),
    );
  }, [aranan, konular]);
  const sorular: Makale[] = sonuc ?? k.makaleler;
  // Okunma: makale açılınca sayılır (aynı ziyaretçi günde bir)
  const ac = (m: Makale | undefined) => {
    if (m?.id)
      void fetch(`${API}/yardim/makaleler/${m.id}/okundu`, { method: 'POST' }).catch(() => undefined);
  };
  const oyla = (m: Makale, evet: boolean) => {
    setOy((o) => ({ ...o, [m.id]: evet }));
    void fetch(`${API}/yardim/makaleler/${m.id}/faydali`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ evet }),
    }).catch(() => undefined);
  };

  async function gonder(yineDe = false) {
    if (form.metin.trim().length < 10) {
      setHata('Açıklamayı en az 10 karakterle yaz.');
      return;
    }
    setMesgul(true);
    setHata(null);
    try {
      if (!yineDe && !oneriSoruldu) {
        setOneriSoruldu(true);
        const o = await istek<{ yanit: string | null }>('/support/tickets/oneri', {
          method: 'POST',
          body: { konu: form.konu, metin: form.metin.trim() },
        }).catch(() => ({ yanit: null }));
        if (o.yanit) {
          setOneri(o.yanit);
          return;
        }
      }
      const r = await istek<{ no: number; numara: string }>('/support/tickets', {
        method: 'POST',
        body: {
          konu: form.konu,
          metin: form.metin.trim(),
          ...(form.referans.trim() ? { referans: form.referans.trim() } : {}),
        },
      });
      setGonderildi(r.numara);
      setOneri(null);
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setMesgul(false);
    }
  }

  return (
    <div className={stil.kutu1}>
      <header className={stil.kutu2}>
        <div className={stil.kutu3}>
          <Link href="/" aria-label="Rengarenk ana sayfa" className={stil.bag1}>
            <span className={stil.metin1} aria-hidden="true">
              {BARS.map((c) => (
                <span key={c} className={stil.metin2} style={{ background: c }} />
              ))}
            </span>
            <span className={stil.metin3}>rengarenk</span>
            <span className={stil.metin4}>Yardım</span>
          </Link>
          {ben ? (
            <Link href="/taleplerim" className={stil.bag2}>
              <span aria-hidden="true" className={stil.metin5}>
                {ben.bas}
              </span>
              {ben.ad}
            </Link>
          ) : giris === false ? (
            <Link href="/giris?sonra=/yardim" className={stil.bag3}>
              Giriş yap
            </Link>
          ) : null}
        </div>
      </header>

      <section aria-labelledby="yh" className={stil.kutu4}>
        <div className={stil.kutu5}>
          <h1 id="yh" className={stil.baslik1}>
            Nasıl yardımcı olabiliriz?
          </h1>
          {/* biome-ignore lint/a11y/useSemanticElements: tasarımdaki arama formu (role="search") */}
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              setAranan(ara);
              setAcik(0);
            }}
            className={stil.kutu6}
          >
            <label htmlFor="ya" className={stil.etiket1}>
              Yardım konularında ara
            </label>
            <input
              id="ya"
              type="search"
              value={ara}
              onChange={(e) => {
                setAra(e.target.value);
                if (!e.target.value) setAranan('');
              }}
              placeholder="Örneğin: talebimi nasıl uzatırım?"
              className={stil.girdi1}
            />
            <button type="submit" className={stil.dugme1}>
              Ara
            </button>
          </form>
        </div>
      </section>

      <div className={stil.kutu7}>
        <div className={stil.kutu8}>
          {konular.map((t) => {
            const on = !sonuc && t.key === konu;
            return (
              <button
                key={t.key}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setKonu(t.key);
                  setAcik(0);
                  ac(t.makaleler[0]);
                  setAranan('');
                  setAra('');
                }}
                className={cx(stil.dugme2, on ? stil.dugme3 : stil.dugme4)}
                style={{ border: on ? `2px solid ${t.renk}` : '1px solid var(--rr-cizgi, #E3E6EF)' }}
              >
                <span className={stil.metin6} style={{ background: t.renk }} />
                <span className={stil.metin7}>{t.ad}</span>
                <span className={stil.metin8}>{t.not}</span>
              </button>
            );
          })}
        </div>

        <div className={stil.kutu9}>
          <section aria-labelledby="sss" className={stil.kutu10}>
            <h2 id="sss" className={stil.baslik2}>
              {sonuc ? `“${aranan}” için sonuçlar` : `${k.ad} · sık sorulanlar`}
            </h2>
            {sorular.length === 0 ? (
              <p className={stil.metin9}>Sonuç bulunamadı. Destek talebi oluşturarak bize yazabilirsin.</p>
            ) : null}
            {sorular.map((m, i) => {
              const on = acik === i;
              return (
                <div key={m.id || m.soru} className={stil.kutu11}>
                  <button
                    type="button"
                    aria-expanded={on}
                    onClick={() => {
                      setAcik(on ? -1 : i);
                      if (!on) ac(m);
                    }}
                    className={stil.dugme5}
                  >
                    {m.soru}
                    <span className={stil.metin10}>{on ? '−' : '+'}</span>
                  </button>
                  {on ? (
                    <div className={stil.kutu12}>
                      <p className={stil.metin11}>{m.cevap}</p>
                      {/* Tasarıma ek: konsoldaki "faydalı" oranı bu yanıttan (Karar 46) */}
                      {m.id ? (
                        <div className={stil.kutu13}>
                          {m.id in oy ? (
                            <span role="status">Teşekkürler, yanıtın kaydedildi.</span>
                          ) : (
                            <>
                              Bu yanıt işine yaradı mı?
                              {(
                                [
                                  [true, 'Evet'],
                                  [false, 'Hayır'],
                                ] as const
                              ).map(([v, ad]) => (
                                <button
                                  key={ad}
                                  type="button"
                                  onClick={() => oyla(m, v)}
                                  className={stil.dugme6}
                                >
                                  {ad}
                                </button>
                              ))}
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </section>

          <aside className={stil.kutu14}>
            <section aria-labelledby="gv" className={stil.kutu15}>
              <h2 id="gv" className={stil.baslik3}>
                Güvenli alışveriş için
              </h2>
              <ul className={stil.liste1}>
                <li>Aracı görmeden kapora, ön ödeme veya “rezervasyon ücreti” gönderme.</li>
                <li>Mesajla gelen ödeme linklerine tıklama; Rengarenk senden mesajla ödeme istemez.</li>
                <li>Satışı noterde yap, ödemeyi satış anında güvenli ödeme sistemiyle tamamla.</li>
                <li>Ekspertiz raporunu kendin seçtiğin bir yerde yaptır.</li>
              </ul>
            </section>
            <section aria-labelledby="ds" className={stil.kutu16}>
              <h2 id="ds" className={stil.baslik4}>
                Destek talebi oluştur
              </h2>
              {cozuldu ? (
                <div role="status" className={stil.kutu17}>
                  <strong>Sevindik.</strong> Başka bir sorunda yine buradan yazabilirsin.
                </div>
              ) : gonderildi ? (
                <div role="status" className={stil.kutu17}>
                  <strong>Destek talebin alındı · No {gonderildi}</strong>
                  <br />
                  Yanıtımız hem e-postana hem de Mesajlarım’daki “Rengarenk Destek” sohbetine gelecek.{' '}
                  <Link href="/destek" className={stil.bag4}>
                    Destek taleplerim
                  </Link>
                </div>
              ) : giris === false ? (
                <p className={stil.metin12}>
                  Destek talebi için{' '}
                  <Link href="/giris?sonra=/yardim" className={stil.bag4}>
                    giriş yap
                  </Link>
                  .
                </p>
              ) : (
                <>
                  <p className={stil.metin13}>Genellikle 1 iş günü içinde yanıtlıyoruz.</p>
                  <label className={stil.etiket2}>
                    Konu
                    <select
                      value={form.konu}
                      onChange={(e) => setForm({ ...form, konu: e.target.value as SupportTopic })}
                      className={stil.girdi2}
                    >
                      {SUPPORT_TOPIC_KEYS.map((t) => (
                        <option key={t} value={t}>
                          {SUPPORT_TOPICS[t].ad}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={stil.etiket3}>
                    Talep veya ödeme no (varsa)
                    <input
                      value={form.referans}
                      onChange={(e) => setForm({ ...form, referans: e.target.value })}
                      maxLength={40}
                      className={stil.girdi2}
                    />
                  </label>
                  <label className={stil.etiket3}>
                    Açıklama
                    <textarea
                      rows={4}
                      value={form.metin}
                      onChange={(e) => {
                        setForm({ ...form, metin: e.target.value });
                        setOneri(null);
                        setOneriSoruldu(false);
                      }}
                      maxLength={2000}
                      className={stil.girdi3}
                    />
                  </label>
                  {hata ? (
                    <p role="alert" className={stil.metin14}>
                      {hata}
                    </p>
                  ) : null}
                  {oneri ? (
                    <div role="status" className={stil.kutu18}>
                      <span className={stil.metin15}>✦ Hemen yanıt</span>
                      {oneri}
                      <span className={stil.metin16}>
                        <button
                          type="button"
                          onClick={() => {
                            setCozuldu(true);
                            setOneri(null);
                            setForm({ ...form, metin: '', referans: '' });
                          }}
                          className={stil.dugme7}
                        >
                          Sorunum çözüldü
                        </button>
                        <button
                          type="button"
                          onClick={() => gonder(true)}
                          disabled={mesgul}
                          className={stil.dugme8}
                        >
                          Yine de ekibe gönder
                        </button>
                      </span>
                    </div>
                  ) : null}
                  {oneri ? null : (
                    <button type="button" onClick={() => gonder()} disabled={mesgul} className={stil.dugme9}>
                      Gönder
                    </button>
                  )}
                </>
              )}
            </section>
            <p className={stil.metin17}>
              Acil bir dolandırıcılık durumunda önce bankanı ara, sonra mesajı “Şikayet et” ile bize bildir.
            </p>
          </aside>
        </div>
      </div>
      <CerezBandi />
    </div>
  );
}
