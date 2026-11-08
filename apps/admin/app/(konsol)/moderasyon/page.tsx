'use client';

import {
  DECISION_NAMES,
  DECISION_NOTES,
  MODERATION_DECISIONS,
  type ModerationDecision,
} from '@rengarenk/shared';
import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';

interface Satir {
  id: string;
  no: number;
  oncelik: 'kritik' | 'yuksek' | 'normal';
  oncelikAd: string;
  neden: string;
  taraf: string;
  sonTarih: string;
  durum: 'acik' | 'kapali';
  karar: string | null;
  ajan: string | null;
}
interface Kuyruk {
  acik: Satir[];
  kapali: Satir[];
  suresiAsan: number;
}
interface Detay {
  id: string;
  no: number;
  neden: string;
  oncelik: string;
  hedefTur: 'mesaj' | 'talep' | 'arac';
  gizleAd: string;
  ozet: string;
  aciklama: string | null;
  kanit: {
    baslik: string;
    link: string | null;
    satirlar: { kim: string; yon: 'sol' | 'sag'; metin: string; hedef: boolean; gizli: boolean }[];
  };
  gecmis: number;
  ajan: string | null;
  /** Şikâyet edilenin etkin askısı (bu ya da başka bir karardan) */
  aski: { until: string | null } | null;
  oneri: { karar: ModerationDecision; metin: string };
  durum: 'acik' | 'kapali';
  karar: {
    karar: ModerationDecision;
    ad: string;
    not: string | null;
    kim: string;
    zaman: string;
    onay: string | null;
    geriAlindi: string | null;
  } | null;
  itiraz: { id: string; durum: string; metin: string } | null;
}
interface Itiraz {
  id: string;
  raporId: string;
  no: number;
  ad: string;
  metin: string;
  ilkKarar: string;
  ilkKararId: string | null;
  durum: 'acik' | 'kabul' | 'red';
  sonuc: string | null;
  inceleyen: string | null;
}
interface Filtreler {
  filtreler: { key: string; ad: string; not: string; acik: boolean }[];
  kelimeler: string[];
}

/** Öncelik rozeti (YonetimPazar.dc.html › OC) */
const OC: Record<string, [string, string]> = {
  kritik: ['#FDECEC', '#A3271F'],
  yuksek: ['#FFF6DF', '#7A5300'],
  normal: ['#EEF3FF', '#2450C8'],
};
const kart: CSSProperties = { background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 18 };

function sure(s: Satir, simdi: number): [string, string] {
  if (s.durum === 'kapali') return [s.karar ? `Karar: ${s.karar}` : 'Karara bağlandı', '#11683F'];
  const fark = new Date(s.sonTarih).getTime() - simdi;
  const sa = Math.floor(Math.abs(fark) / 3_600_000);
  const dk = Math.floor((Math.abs(fark) % 3_600_000) / 60_000);
  return fark < 0
    ? [`Süre aştı · ${sa} sa`, '#A3271F']
    : [`Kalan ${sa ? `${sa} sa ` : ''}${dk} dk`, '#5A6073'];
}
const saat = (d: string) =>
  new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(d));

/**
 * Moderasyon (YonetimPazar.dc.html › moderasyon; Karar 41, 53): şikâyet kuyruğu önceliğe ve süreye göre, maskeli kanıt,
 * ajan önerisi, karar; itirazlar; otomatik içerik filtreleri ve yasaklı kelimeler (Yonetim.dc.html › içerik filtreleri).
 */
export default function Moderasyon() {
  const { me } = useKonsol();
  const [q, setQ] = useState<Kuyruk | null>(null);
  const [sec, setSec] = useState<string | null>(null);
  const [d, setD] = useState<Detay | null>(null);
  const [karar, setKarar] = useState<ModerationDecision>('uyari');
  const [not, setNot] = useState('');
  const [itirazlar, setItirazlar] = useState<Itiraz[]>([]);
  const [f, setF] = useState<Filtreler | null>(null);
  const [yeni, setYeni] = useState('');
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [simdi, setSimdi] = useState(() => Date.now());

  const yukle = useCallback(async () => {
    try {
      const [k, i, fl] = await Promise.all([
        yonetim<Kuyruk>('moderation/reports'),
        yonetim<Itiraz[]>('moderation/appeals'),
        yonetim<Filtreler>('moderation/filters'),
      ]);
      setQ(k);
      setItirazlar(i);
      setF(fl);
      setSec((s) => s ?? k.acik[0]?.id ?? k.kapali[0]?.id ?? null);
    } catch (e) {
      setHata((e as Error).message);
    }
  }, []);
  useEffect(() => {
    yukle();
    const t = setInterval(() => setSimdi(Date.now()), 60_000);
    return () => clearInterval(t);
  }, [yukle]);
  useEffect(() => {
    if (!sec) return;
    setD(null);
    setNot('');
    yonetim<Detay>(`moderation/reports/${sec}`)
      .then((x) => {
        setD(x);
        setKarar(x.oneri.karar);
      })
      .catch((e: Error) => setHata(e.message));
  }, [sec]);

  const yetki = (k: ModerationDecision) => {
    const p = me.permissions;
    if (k === 'aski') return p['hesap.askiya_al'] === 'tam';
    if (k === 'engel') return p['hesap.kalici_engelle'] === 'tam' || p['hesap.kalici_engelle'] === 'oneri';
    return p['sikayet.coz'] === 'tam';
  };

  async function uygula() {
    if (!d) return;
    setHata(null);
    try {
      const x = await yonetim<Detay>(`moderation/reports/${d.id}/decide`, {
        method: 'POST',
        body: { karar, ...(not.trim() ? { not: not.trim() } : {}) },
      });
      setD(x);
      setBilgi(
        karar === 'engel'
          ? 'Kalıcı engelleme önerisi onay kuyruğuna düştü; askı onaya kadar sürer.'
          : `Karar uygulandı: ${DECISION_NAMES[karar]}. İki tarafa bildirim gidiyor.`,
      );
      yukle();
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function itirazKarar(i: Itiraz, kabul: boolean) {
    try {
      setItirazlar(
        await yonetim<Itiraz[]>(`moderation/appeals/${i.id}/decide`, { method: 'POST', body: { kabul } }),
      );
      setBilgi(kabul ? 'İtiraz kabul edildi; yaptırım kalktı.' : 'İtiraz reddedildi; karar geçerli.');
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function filtre(key: string, acik: boolean) {
    try {
      setF(await yonetim<Filtreler>(`moderation/filters/${key}`, { method: 'PUT', body: { acik } }));
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function kelimeEkle() {
    if (yeni.trim().length < 2) return;
    try {
      setF(await yonetim<Filtreler>('moderation/words', { method: 'POST', body: { kelime: yeni.trim() } }));
      setYeni('');
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function kelimeSil(k: string) {
    try {
      setF(await yonetim<Filtreler>(`moderation/words/${encodeURIComponent(k)}`, { method: 'DELETE' }));
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  const satirlar = q ? [...q.acik, ...q.kapali] : [];
  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Moderasyon</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#5A6073' }}>
          Kritik 1 saat · yüksek 4 saat · normal 24 saat içinde karara bağlanır.
        </p>
      </div>
      {hata ? <p style={{ color: '#A3271F', fontWeight: 700 }}>{hata}</p> : null}
      {bilgi ? (
        <p
          role="status"
          style={{
            background: '#E7FAF0',
            color: '#11683F',
            borderRadius: 12,
            padding: '10px 14px',
            fontWeight: 700,
          }}
        >
          {bilgi}
        </p>
      ) : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <section
          aria-label="Şikâyet kuyruğu"
          style={{ ...kart, flex: '1 1 300px', maxWidth: 360, minWidth: 0, padding: 8 }}
        >
          {q && !satirlar.length ? (
            <p style={{ margin: 0, padding: 12, fontSize: 13.5, color: '#5A6073' }}>Şikâyet yok.</p>
          ) : null}
          {satirlar.map((s) => {
            const on = s.id === sec;
            const [st, sr] = sure(s, simdi);
            const [ob, of] = OC[s.oncelik] ?? OC.normal;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSec(s.id);
                  setBilgi(null);
                }}
                aria-current={on}
                style={{
                  width: '100%',
                  display: 'block',
                  textAlign: 'left',
                  border: 0,
                  background: on ? '#F3EFFF' : 'transparent',
                  borderRadius: 12,
                  padding: '10px 12px',
                  cursor: 'pointer',
                  color: '#1E2333',
                  opacity: s.durum === 'kapali' ? 0.6 : 1,
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: ob,
                      color: of,
                    }}
                  >
                    {s.oncelikAd}
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: sr }}>{st}</span>
                </span>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 800, marginTop: 6 }}>
                  {s.neden}
                </span>
                <span style={{ display: 'block', fontSize: 12, color: '#5A6073', marginTop: 2 }}>
                  {s.taraf}
                </span>
              </button>
            );
          })}
        </section>

        <section
          aria-labelledby="sk"
          style={{ ...kart, flex: '999 1 480px', minWidth: 0, overflow: 'hidden' }}
        >
          {d ? (
            <>
              <div style={{ padding: '16px 18px', borderBottom: '1px solid #EEF0F5' }}>
                <h2 id="sk" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                  {d.neden}{' '}
                  <span style={{ fontSize: 13, color: '#5A6073', fontWeight: 600 }}>· S-{d.no}</span>
                </h2>
                <div style={{ fontSize: 13, color: '#3A4052', marginTop: 3 }}>{d.ozet}</div>
                {d.aciklama ? (
                  <div style={{ fontSize: 13, color: '#3A4052', marginTop: 6 }}>
                    <strong>Şikâyet eden yazdı:</strong> “{d.aciklama}”
                  </div>
                ) : null}
              </div>
              <div style={{ padding: '14px 18px', background: '#F6F8FD', borderBottom: '1px solid #EEF0F5' }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#5A6073', marginBottom: 8 }}>
                  Kanıt · {d.hedefTur === 'mesaj' ? 'sohbet kesiti' : d.kanit.baslik} (maskeli)
                  {d.kanit.link ? (
                    <a
                      href={d.kanit.link}
                      target="_blank"
                      rel="noreferrer"
                      style={{ marginLeft: 8, color: '#2450C8' }}
                    >
                      Sitede aç
                    </a>
                  ) : null}
                </div>
                {d.kanit.satirlar.map((sm, i) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: kesit sırası sabit
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: sm.yon === 'sag' ? 'flex-end' : 'flex-start',
                      marginBottom: 6,
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '78%',
                        background: sm.hedef ? '#FFF6DF' : '#FFFFFF',
                        border: `1px solid ${sm.hedef ? '#F2C46D' : '#E3E6EF'}`,
                        borderRadius: 14,
                        padding: '8px 12px',
                        fontSize: 13,
                        lineHeight: 1.5,
                        overflowWrap: 'anywhere',
                      }}
                    >
                      <span style={{ display: 'block', fontSize: 11.5, fontWeight: 800, color: '#5A6073' }}>
                        {sm.kim}
                        {sm.gizli ? ' · gizlendi' : ''}
                        {sm.hedef ? ' · şikâyet edilen' : ''}
                      </span>
                      {sm.metin}
                    </div>
                  </div>
                ))}
              </div>
              <div
                style={{
                  padding: '12px 18px',
                  borderBottom: '1px solid #EEF0F5',
                  fontSize: 13.5,
                  lineHeight: 1.5,
                }}
              >
                <strong>Ajan önerisi:</strong> {d.oneri.metin}
                {d.ajan ? (
                  <span style={{ display: 'block', marginTop: 4, color: '#7A5300' }}>Ajan: {d.ajan}.</span>
                ) : null}
                {d.aski && d.durum === 'acik' ? (
                  <span style={{ display: 'block', marginTop: 4, color: '#A3271F', fontWeight: 700 }}>
                    Hesap şu an{' '}
                    {d.aski.until ? `${saat(d.aski.until)} saatine kadar askıda.` : 'onay beklerken askıda.'}
                  </span>
                ) : null}
                {d.gecmis ? (
                  <span style={{ display: 'block', marginTop: 4, color: '#3A4052' }}>
                    Son 30 günde bu kişi hakkında {d.gecmis} karar daha var.
                  </span>
                ) : null}
              </div>
              {d.durum === 'acik' ? (
                <div style={{ padding: '14px 18px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Karar</div>
                  <div
                    role="radiogroup"
                    aria-label="Karar"
                    style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}
                  >
                    {MODERATION_DECISIONS.map((k) => {
                      const on = karar === k;
                      const izin = yetki(k);
                      return (
                        // biome-ignore lint/a11y/useSemanticElements: tasarımdaki karar hapları radyo grubu olarak işaretli
                        <button
                          key={k}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          disabled={!izin}
                          onClick={() => setKarar(k)}
                          title={izin ? undefined : 'Bu karar için yetkin yok'}
                          style={{
                            border: `1.5px solid ${on ? '#5B8CFF' : '#D5DAE5'}`,
                            background: on ? '#EEF3FF' : '#FFFFFF',
                            borderRadius: 999,
                            padding: '7px 13px',
                            fontSize: 13,
                            fontWeight: 700,
                            color: izin ? '#1E2333' : '#AEB5C4',
                            cursor: izin ? 'pointer' : 'default',
                            fontFamily: 'inherit',
                          }}
                        >
                          {k === 'gizle' ? d.gizleAd : DECISION_NAMES[k]}
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ margin: '10px 0 0', fontSize: 12.5, color: '#5A6073' }}>
                    {DECISION_NOTES[karar]}
                  </p>
                  <label style={{ display: 'block', marginTop: 10, fontSize: 12.5, fontWeight: 700 }}>
                    Gerekçe (kullanıcıya gider)
                    <input
                      value={not}
                      onChange={(e) => setNot(e.target.value)}
                      maxLength={500}
                      placeholder="Ör. Mesajında kapora istendi."
                      style={{
                        display: 'block',
                        width: '100%',
                        boxSizing: 'border-box',
                        marginTop: 4,
                        border: '1px solid #D5DAE5',
                        borderRadius: 10,
                        padding: '9px 10px',
                        fontSize: 13.5,
                        fontFamily: 'inherit',
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={uygula}
                    disabled={!yetki(karar)}
                    style={{
                      marginTop: 12,
                      border: 0,
                      background: '#5B8CFF',
                      borderRadius: 12,
                      padding: '11px 18px',
                      fontSize: 14,
                      fontWeight: 800,
                      color: '#1E2333',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Kararı uygula ve iki tarafa bildir
                  </button>
                </div>
              ) : d.karar ? (
                <div style={{ padding: '14px 18px', fontSize: 14, fontWeight: 800, color: '#11683F' }}>
                  {d.karar.ad} · {d.karar.kim} · {saat(d.karar.zaman)}
                  {d.karar.onay
                    ? ` · onay: ${d.karar.onay === 'PENDING' ? 'bekliyor' : d.karar.onay.toLocaleLowerCase('tr-TR')}`
                    : ''}
                  {d.karar.geriAlindi ? ' · itirazla geri alındı' : ''}
                  {d.karar.not ? (
                    <span style={{ display: 'block', marginTop: 4, fontWeight: 600, color: '#3A4052' }}>
                      Gerekçe: {d.karar.not}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <p style={{ margin: 0, padding: 18, fontSize: 13.5, color: '#5A6073' }}>
              {q ? 'Bir şikâyet seç.' : 'Yükleniyor…'}
            </p>
          )}
        </section>
      </div>

      <section style={{ ...kart, marginTop: 16, overflow: 'hidden' }} aria-labelledby="itiraz">
        <h2
          id="itiraz"
          style={{
            margin: 0,
            padding: '16px 18px',
            fontSize: 17,
            fontWeight: 800,
            borderBottom: '1px solid #EEF0F5',
          }}
        >
          İtirazlar
        </h2>
        {!itirazlar.length ? (
          <p style={{ margin: 0, padding: '12px 18px', fontSize: 13.5, color: '#5A6073' }}>İtiraz yok.</p>
        ) : null}
        {itirazlar.map((it) => (
          <div
            key={it.id}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '6px 16px',
              padding: '12px 18px',
              borderBottom: '1px solid #EEF0F5',
              fontSize: 13.5,
            }}
          >
            <span style={{ flex: '999 1 300px', minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 800 }}>
                {it.ad} · S-{it.no}
              </span>
              <span style={{ display: 'block', fontSize: 12.5, color: '#5A6073', marginTop: 2 }}>
                “{it.metin}” · ilk karar: {it.ilkKarar}
              </span>
            </span>
            {it.durum === 'acik' ? (
              it.ilkKararId === me.id ? (
                <span style={{ flex: 'none', color: '#5A6073', fontSize: 12.5 }}>
                  İlk kararı sen verdin; başka bir moderatör inceler
                </span>
              ) : (
                <span style={{ flex: 'none', display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => itirazKarar(it, true)}
                    style={{
                      border: '1px solid #D5DAE5',
                      background: '#FFFFFF',
                      borderRadius: 10,
                      padding: '8px 12px',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Kabul et, kararı geri al
                  </button>
                  <button
                    type="button"
                    onClick={() => itirazKarar(it, false)}
                    style={{
                      border: 0,
                      background: 'transparent',
                      padding: '8px 6px',
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#5A6073',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Reddet
                  </button>
                </span>
              )
            ) : (
              <span
                style={{ flex: 'none', color: it.durum === 'kabul' ? '#11683F' : '#3A4052', fontWeight: 700 }}
              >
                {it.durum === 'kabul' ? 'Kabul edildi' : 'Reddedildi'} · {it.inceleyen}
              </span>
            )}
          </div>
        ))}
      </section>

      {f ? (
        <section style={{ ...kart, marginTop: 16, padding: 20 }} aria-labelledby="filtre">
          <h2 id="filtre" style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 800 }}>
            Otomatik içerik filtreleri
          </h2>
          {f.filtreler.map((x) => (
            <div
              key={x.key}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                padding: '12px 0',
                borderTop: '1px solid #EEF0F5',
              }}
            >
              <span>
                <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{x.ad}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: '#5A6073', marginTop: 2 }}>
                  {x.not}
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={x.acik}
                aria-label={x.ad}
                onClick={() => filtre(x.key, !x.acik)}
                style={{
                  flex: 'none',
                  width: 52,
                  height: 30,
                  border: 0,
                  borderRadius: 999,
                  background: x.acik ? '#5B8CFF' : '#C9CFDB',
                  position: 'relative',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 3,
                    left: x.acik ? 25 : 3,
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: '#FFFFFF',
                  }}
                />
              </button>
            </div>
          ))}
          <div style={{ borderTop: '1px solid #EEF0F5', paddingTop: 12 }}>
            <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, marginBottom: 8 }}>
              Yasaklı kelimeler
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {f.kelimeler.map((k) => (
                <span
                  key={k}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: '#F3F5FA',
                    borderRadius: 999,
                    padding: '6px 8px 6px 12px',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {k}
                  <button
                    type="button"
                    aria-label={`${k} kelimesini kaldır`}
                    onClick={() => kelimeSil(k)}
                    style={{
                      border: 0,
                      background: 'transparent',
                      cursor: 'pointer',
                      color: '#5A6073',
                      fontSize: 14,
                      lineHeight: 1,
                      padding: 0,
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  kelimeEkle();
                }}
                style={{ display: 'inline-flex', gap: 6 }}
              >
                <label
                  htmlFor="ykelime"
                  style={{
                    position: 'absolute',
                    width: 1,
                    height: 1,
                    overflow: 'hidden',
                    clip: 'rect(0 0 0 0)',
                  }}
                >
                  Yeni yasaklı kelime
                </label>
                <input
                  id="ykelime"
                  value={yeni}
                  onChange={(e) => setYeni(e.target.value)}
                  placeholder="Kelime ekle"
                  maxLength={40}
                  style={{
                    border: '1px dashed #AEB5C4',
                    borderRadius: 999,
                    padding: '6px 12px',
                    fontSize: 13,
                    width: 140,
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  type="submit"
                  style={{
                    border: '1px solid #D5DAE5',
                    background: '#FFFFFF',
                    borderRadius: 999,
                    padding: '6px 12px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Ekle
                </button>
              </form>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
