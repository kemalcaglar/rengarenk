'use client';

import {
  colors,
  HELP_TOPICS,
  type PublicHelpTopic,
  SUPPORT_TOPIC_KEYS,
  SUPPORT_TOPICS,
  type SupportTopic,
} from '@rengarenk/shared';
import Link from 'next/link';
import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { CerezBandi } from '../../components/cerez-bandi';
import { API, istek, useGiris } from '../../lib/istemci';

const BARS = [colors.blue, colors.pink, colors.yellow, colors.green];
const girdi: CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  marginTop: 5,
  border: '1px solid #D5DAE5',
  borderRadius: 10,
  padding: 11,
  fontSize: 14.5,
  background: '#FFFFFF',
  fontFamily: 'inherit',
};
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
    <div style={{ background: '#F6F8FD', minHeight: '100vh', color: '#1E2333' }}>
      <header style={{ background: '#FFFFFF', borderBottom: '1px solid #E3E6EF' }}>
        <div
          style={{
            maxWidth: 1360,
            margin: '0 auto',
            padding: '16px 24px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px 24px',
          }}
        >
          <Link
            href="/"
            aria-label="Rengarenk ana sayfa"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: '#1E2333',
              textDecoration: 'none',
            }}
          >
            <span style={{ display: 'flex', gap: 3 }} aria-hidden="true">
              {BARS.map((c) => (
                <span key={c} style={{ width: 10, height: 22, borderRadius: 5, background: c }} />
              ))}
            </span>
            <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>rengarenk</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#5A6073', marginLeft: 4 }}>Yardım</span>
          </Link>
          {ben ? (
            <Link
              href="/taleplerim"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: '#1E2333',
                fontWeight: 600,
                fontSize: 14.5,
                padding: '8px 6px',
                textDecoration: 'none',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: '#FFEEF6',
                  color: '#A3236A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                {ben.bas}
              </span>
              {ben.ad}
            </Link>
          ) : giris === false ? (
            <Link href="/giris?sonra=/yardim" style={{ fontWeight: 700, fontSize: 14.5 }}>
              Giriş yap
            </Link>
          ) : null}
        </div>
      </header>

      <section
        aria-labelledby="yh"
        style={{
          background: 'linear-gradient(100deg, #EEF3FF 0%, #FFEEF6 45%, #FFF6DF 100%)',
          padding: '44px 24px',
        }}
      >
        <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
          <h1 id="yh" style={{ margin: '0 0 16px', fontSize: 32, fontWeight: 800, letterSpacing: -0.5 }}>
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
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#FFFFFF',
              border: '1px solid #E3E6EF',
              borderRadius: 16,
              padding: '6px 6px 6px 18px',
            }}
          >
            <label
              htmlFor="ya"
              style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}
            >
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
              style={{
                flex: 1,
                minWidth: 0,
                border: 0,
                fontSize: 16,
                padding: '12px 0',
                outline: 'none',
                background: 'transparent',
                color: '#1E2333',
                fontFamily: 'inherit',
              }}
            />
            <button
              type="submit"
              style={{
                border: 0,
                background: '#5B8CFF',
                borderRadius: 12,
                padding: '12px 20px',
                fontSize: 15,
                fontWeight: 800,
                color: '#1E2333',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Ara
            </button>
          </form>
        </div>
      </section>

      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '28px 24px 64px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
            gap: 12,
          }}
        >
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
                style={{
                  textAlign: 'left',
                  background: '#FFFFFF',
                  border: on ? `2px solid ${t.renk}` : '1px solid #E3E6EF',
                  borderRadius: 18,
                  padding: on ? 17 : 18,
                  cursor: 'pointer',
                  color: '#1E2333',
                  fontFamily: 'inherit',
                }}
              >
                <span
                  style={{
                    display: 'block',
                    width: 36,
                    height: 6,
                    borderRadius: 3,
                    background: t.renk,
                    marginBottom: 12,
                  }}
                />
                <span style={{ display: 'block', fontSize: 16, fontWeight: 800 }}>{t.ad}</span>
                <span style={{ display: 'block', fontSize: 13.5, color: '#5A6073', marginTop: 4 }}>
                  {t.not}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 20, marginTop: 24 }}>
          <section
            aria-labelledby="sss"
            style={{
              flex: '999 1 560px',
              minWidth: 0,
              background: '#FFFFFF',
              border: '1px solid #E3E6EF',
              borderRadius: 18,
              overflow: 'hidden',
            }}
          >
            <h2
              id="sss"
              style={{
                margin: 0,
                padding: '18px 20px',
                fontSize: 18,
                fontWeight: 800,
                borderBottom: '1px solid #EEF0F5',
              }}
            >
              {sonuc ? `“${aranan}” için sonuçlar` : `${k.ad} · sık sorulanlar`}
            </h2>
            {sorular.length === 0 ? (
              <p style={{ margin: 0, padding: '16px 20px', fontSize: 14.5, color: '#5A6073' }}>
                Sonuç bulunamadı. Destek talebi oluşturarak bize yazabilirsin.
              </p>
            ) : null}
            {sorular.map((m, i) => {
              const on = acik === i;
              return (
                <div key={m.id || m.soru} style={{ borderBottom: '1px solid #EEF0F5' }}>
                  <button
                    type="button"
                    aria-expanded={on}
                    onClick={() => {
                      setAcik(on ? -1 : i);
                      if (!on) ac(m);
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                      textAlign: 'left',
                      border: 0,
                      background: 'transparent',
                      padding: '16px 20px',
                      fontSize: 15,
                      fontWeight: 700,
                      color: '#1E2333',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {m.soru}
                    <span style={{ flex: 'none', fontSize: 20, fontWeight: 600, color: '#5A6073' }}>
                      {on ? '−' : '+'}
                    </span>
                  </button>
                  {on ? (
                    <div style={{ padding: '0 20px 16px' }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 14.5,
                          lineHeight: 1.65,
                          color: '#2E3344',
                          whiteSpace: 'pre-line',
                        }}
                      >
                        {m.cevap}
                      </p>
                      {/* Tasarıma ek: konsoldaki "faydalı" oranı bu yanıttan (Karar 46) */}
                      {m.id ? (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            marginTop: 10,
                            fontSize: 13,
                            color: '#5A6073',
                            flexWrap: 'wrap',
                          }}
                        >
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
                                  style={{
                                    border: '1px solid #D5DAE5',
                                    background: '#FFFFFF',
                                    borderRadius: 999,
                                    padding: '4px 12px',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: '#1E2333',
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                  }}
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

          <aside
            style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <section
              aria-labelledby="gv"
              style={{ background: '#FFF6DF', border: '1px solid #F4DC9A', borderRadius: 18, padding: 20 }}
            >
              <h2 id="gv" style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 800 }}>
                Güvenli alışveriş için
              </h2>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.6, color: '#2E3344' }}>
                <li>Aracı görmeden kapora, ön ödeme veya “rezervasyon ücreti” gönderme.</li>
                <li>Mesajla gelen ödeme linklerine tıklama; Rengarenk senden mesajla ödeme istemez.</li>
                <li>Satışı noterde yap, ödemeyi satış anında güvenli ödeme sistemiyle tamamla.</li>
                <li>Ekspertiz raporunu kendin seçtiğin bir yerde yaptır.</li>
              </ul>
            </section>
            <section
              aria-labelledby="ds"
              style={{ background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 18, padding: 20 }}
            >
              <h2 id="ds" style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800 }}>
                Destek talebi oluştur
              </h2>
              {cozuldu ? (
                <div
                  role="status"
                  style={{
                    marginTop: 10,
                    background: '#E7FAF0',
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: '#11683F',
                  }}
                >
                  <strong>Sevindik.</strong> Başka bir sorunda yine buradan yazabilirsin.
                </div>
              ) : gonderildi ? (
                <div
                  role="status"
                  style={{
                    marginTop: 10,
                    background: '#E7FAF0',
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: '#11683F',
                  }}
                >
                  <strong>Destek talebin alındı · No {gonderildi}</strong>
                  <br />
                  Yanıtımız hem e-postana hem de Mesajlarım’daki “Rengarenk Destek” sohbetine gelecek.{' '}
                  <Link href="/destek" style={{ fontWeight: 700 }}>
                    Destek taleplerim
                  </Link>
                </div>
              ) : giris === false ? (
                <p style={{ margin: '8px 0 0', fontSize: 14 }}>
                  Destek talebi için{' '}
                  <Link href="/giris?sonra=/yardim" style={{ fontWeight: 700 }}>
                    giriş yap
                  </Link>
                  .
                </p>
              ) : (
                <>
                  <p style={{ margin: '0 0 12px', fontSize: 13, color: '#5A6073' }}>
                    Genellikle 1 iş günü içinde yanıtlıyoruz.
                  </p>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>
                    Konu
                    <select
                      value={form.konu}
                      onChange={(e) => setForm({ ...form, konu: e.target.value as SupportTopic })}
                      style={girdi}
                    >
                      {SUPPORT_TOPIC_KEYS.map((t) => (
                        <option key={t} value={t}>
                          {SUPPORT_TOPICS[t].ad}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginTop: 10 }}>
                    Talep veya ödeme no (varsa)
                    <input
                      value={form.referans}
                      onChange={(e) => setForm({ ...form, referans: e.target.value })}
                      maxLength={40}
                      style={girdi}
                    />
                  </label>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginTop: 10 }}>
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
                      style={{ ...girdi, resize: 'vertical' }}
                    />
                  </label>
                  {hata ? (
                    <p
                      role="alert"
                      style={{ margin: '8px 0 0', color: '#A3271F', fontSize: 13.5, fontWeight: 700 }}
                    >
                      {hata}
                    </p>
                  ) : null}
                  {oneri ? (
                    <div
                      role="status"
                      style={{
                        marginTop: 12,
                        border: '1.5px solid #C9B8FF',
                        background: '#FAF7FF',
                        borderRadius: 12,
                        padding: '12px 14px',
                        fontSize: 13.5,
                        lineHeight: 1.55,
                      }}
                    >
                      <span style={{ display: 'block', fontSize: 12.5, fontWeight: 800, color: '#4B2FA6' }}>
                        ✦ Hemen yanıt
                      </span>
                      {oneri}
                      <span style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setCozuldu(true);
                            setOneri(null);
                            setForm({ ...form, metin: '', referans: '' });
                          }}
                          style={{
                            border: 0,
                            background: '#3DD68C',
                            borderRadius: 10,
                            padding: '9px 14px',
                            fontSize: 13.5,
                            fontWeight: 800,
                            color: '#1E2333',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          Sorunum çözüldü
                        </button>
                        <button
                          type="button"
                          onClick={() => gonder(true)}
                          disabled={mesgul}
                          style={{
                            border: '1px solid #D5DAE5',
                            background: '#FFFFFF',
                            borderRadius: 10,
                            padding: '9px 14px',
                            fontSize: 13.5,
                            fontWeight: 700,
                            color: '#1E2333',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          Yine de ekibe gönder
                        </button>
                      </span>
                    </div>
                  ) : null}
                  {oneri ? null : (
                    <button
                      type="button"
                      onClick={() => gonder()}
                      disabled={mesgul}
                      style={{
                        width: '100%',
                        marginTop: 12,
                        border: 0,
                        background: '#5B8CFF',
                        borderRadius: 12,
                        padding: 13,
                        fontSize: 15,
                        fontWeight: 800,
                        color: '#1E2333',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      Gönder
                    </button>
                  )}
                </>
              )}
            </section>
            <p style={{ margin: 0, padding: '0 4px', fontSize: 13, color: '#5A6073' }}>
              Acil bir dolandırıcılık durumunda önce bankanı ara, sonra mesajı “Şikayet et” ile bize bildir.
            </p>
          </aside>
        </div>
      </div>
      <CerezBandi />
    </div>
  );
}
