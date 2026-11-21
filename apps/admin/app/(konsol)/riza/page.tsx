'use client';

import { type CSSProperties, useEffect, useState } from 'react';
import { tarih, yonetim } from '../../../lib/istemci';

interface Gecmis {
  kisi: { ad: string; userId: string } | null;
  gecmis: { ad: string; durum: 'Verdi' | 'Vermedi'; surum: string; zaman: string; kanal: string }[];
}

const kart: CSSProperties = { background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 18 };
const SUTUN = 'minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.2fr)';
const zaman = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(iso));

/**
 * Rıza ve çerez kayıtları (YonetimSistem.dc.html › riza; Karar 59): her rıza tarih, metin sürümü ve kanalıyla saklanır,
 * kayıtlar değiştirilmez. İYS entegratörü yokken (sahip kararı 21 Kasım 2026) ticari ileti onay ve retleri CSV
 * olarak indirilip İYS paneline elle yüklenir.
 */
export default function Riza() {
  const [sayilar, setSayilar] = useState<{ ad: string; deger: string; not: string }[] | null>(null);
  const [q, setQ] = useState('');
  const [g, setG] = useState<Gecmis | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    yonetim<{ ad: string; deger: string; not: string }[]>('consents/overview')
      .then(setSayilar)
      .catch((e: Error) => setHata(e.message));
  }, []);
  useEffect(() => {
    if (q.trim().length < 2) {
      setG(null);
      return;
    }
    const t = setTimeout(
      () =>
        yonetim<Gecmis>(`consents?q=${encodeURIComponent(q.trim())}`)
          .then(setG)
          .catch((e: Error) => setHata(e.message)),
      350,
    );
    return () => clearTimeout(t);
  }, [q]);

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Rıza ve çerez kayıtları</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#5A6073' }}>
          Her rıza tarih, metin sürümü ve kanalıyla saklanır. Ticari ileti izinleri İYS'ye CSV ile yüklenir.
        </p>
      </div>
      {hata ? <p style={{ color: '#A3271F', fontWeight: 700 }}>{hata}</p> : null}
      {sayilar ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
            gap: 10,
            marginBottom: 14,
          }}
        >
          {sayilar.map((s) => (
            <div key={s.ad} style={{ ...kart, borderRadius: 16, padding: 14 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#5A6073' }}>{s.ad}</div>
              <div style={{ fontSize: 21, fontWeight: 800, marginTop: 4 }}>{s.deger}</div>
              <div style={{ fontSize: 12, color: '#5A6073', marginTop: 3 }}>{s.not}</div>
            </div>
          ))}
        </div>
      ) : null}
      <IysAktarim />
      <section aria-labelledby="rizag" style={{ ...kart, overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '14px 18px',
            borderBottom: '1px solid #EEF0F5',
          }}
        >
          <h2 id="rizag" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
            {g?.kisi ? `${g.kisi.ad} · rıza geçmişi` : 'Rıza geçmişi'}
          </h2>
          <input
            type="search"
            aria-label="Kullanıcı ara"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ad ya da telefonun son haneleri"
            style={{
              flex: '0 1 260px',
              border: '1px solid #D5DAE5',
              borderRadius: 10,
              padding: '8px 12px',
              fontSize: 13.5,
              fontFamily: 'inherit',
            }}
          />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 640 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: SUTUN,
                gap: 8,
                padding: '10px 18px',
                background: '#F3F5FA',
                fontSize: 11.5,
                fontWeight: 800,
                color: '#5A6073',
                textTransform: 'uppercase',
                letterSpacing: 0.3,
              }}
            >
              <span>Rıza</span>
              <span>Durum</span>
              <span>Metin sürümü</span>
              <span>Tarih ve kanal</span>
            </div>
            {!g ? (
              <p style={{ margin: 0, padding: '14px 18px', fontSize: 13.5, color: '#5A6073' }}>
                Bir kişinin rıza geçmişini görmek için adını ya da telefonunun son hanelerini yaz.
              </p>
            ) : !g.kisi ? (
              <p style={{ margin: 0, padding: '14px 18px', fontSize: 13.5, color: '#5A6073' }}>
                Kişi bulunamadı.
              </p>
            ) : (
              g.gecmis.map((r, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: geçmiş sırası sabit
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: SUTUN,
                    gap: 8,
                    alignItems: 'center',
                    padding: '10px 18px',
                    borderTop: '1px solid #EEF0F5',
                    fontSize: 13,
                  }}
                >
                  <span style={{ fontWeight: 700 }}>{r.ad}</span>
                  <span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        padding: '3px 9px',
                        borderRadius: 999,
                        background: r.durum === 'Verdi' ? '#E7FAF0' : '#F3F5FA',
                        color: r.durum === 'Verdi' ? '#11683F' : '#3A4052',
                      }}
                    >
                      {r.durum}
                    </span>
                  </span>
                  <span>{r.surum}</span>
                  <span style={{ color: '#3A4052' }}>
                    {zaman(r.zaman)} · {r.kanal}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </>
  );
}

interface IysOzet {
  bekleyen: {
    toplam: number;
    eposta: { onay: number; ret: number };
    sms: { onay: number; ret: number };
    enEski: string | null;
    gecikti: boolean;
  };
  paketler: {
    id: string;
    no: number;
    sayi: number;
    zaman: string;
    indiren: string;
    yuklendi: string | null;
    yukleyen: string | null;
  }[];
}

const dugme: CSSProperties = {
  border: 0,
  borderRadius: 10,
  padding: '9px 14px',
  fontSize: 13.5,
  fontWeight: 800,
  fontFamily: 'inherit',
  cursor: 'pointer',
  background: '#1F55E8',
  color: '#FFFFFF',
};
const ikincil: CSSProperties = {
  ...dugme,
  background: '#FFFFFF',
  color: '#1F2433',
  border: '1px solid #D5DAE5',
  padding: '6px 11px',
  fontSize: 12.5,
  textDecoration: 'none',
  display: 'inline-block',
};

/**
 * İYS'ye elle aktarım: izin değişince kanal başına (e-posta, SMS) satır birikir; "CSV'yi hazırla" en eski 50 satırı
 * pakete alır (İYS bir dosyada en fazla 50 izin aktarır), dosya İYS Web › İzin Ekle › Dosyadan Çoklu İzin Yükle'den
 * yüklenir ve paket "Yüklendi" diye işaretlenir. Yasal süre 3 iş günü.
 */
const IYS_SINIR = 50;
function IysAktarim() {
  const [o, setO] = useState<IysOzet | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const yukle = () =>
    yonetim<IysOzet>('iys')
      .then(setO)
      .catch((e: Error) => setHata(e.message));
  // biome-ignore lint/correctness/useExhaustiveDependencies: ilk açılışta bir kez
  useEffect(() => {
    yukle();
  }, []);
  const calistir = async (f: () => Promise<unknown>) => {
    setMesgul(true);
    setHata(null);
    try {
      await f();
      await yukle();
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setMesgul(false);
    }
  };
  const indir = (id: string) => {
    const a = document.createElement('a');
    a.href = `/api/yonetim/iys/paket/${id}/csv`;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  const b = o?.bekleyen;
  return (
    <section aria-labelledby="iysg" style={{ ...kart, padding: '16px 18px', marginBottom: 14 }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <div>
          <h2 id="iysg" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
            İYS'ye aktarım
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#5A6073', maxWidth: 640 }}>
            Ticari ileti onayı ya da reti 3 iş günü içinde İYS'ye yüklenmeli. Gün sonunda CSV dosyasını indir,
            İYS Web'de İzin Ekle › Dosyadan Çoklu İzin Yükle ekranından "Bireysel" olarak yükle, sonra paketi
            "Yüklendi" diye işaretle. İYS bir dosyada en fazla {IYS_SINIR} izin alır; her paket bir dosyadır.
            Ticari e-posta ve SMS yalnızca İYS'de onayı olan, yani paketi "Yüklendi" işaretlenmiş kişilere
            gider; "Yüklendi"ye dosya İYS'de başarıyla yüklendikten sonra bas.
          </p>
        </div>
        <button
          type="button"
          style={{ ...dugme, opacity: !b?.toplam || mesgul ? 0.5 : 1 }}
          disabled={!b?.toplam || mesgul}
          onClick={() =>
            calistir(async () => {
              const p = await yonetim<{ id: string } | null>('iys/paket', { method: 'POST' });
              if (p) indir(p.id);
            })
          }
        >
          {b?.toplam ? `CSV'yi hazırla ve indir (${Math.min(b.toplam, IYS_SINIR)})` : 'Bekleyen izin yok'}
        </button>
      </div>
      {hata ? <p style={{ color: '#A3271F', fontWeight: 700, margin: '10px 0 0' }}>{hata}</p> : null}
      {b?.toplam ? (
        <p
          style={{
            margin: '10px 0 0',
            fontSize: 13,
            fontWeight: 700,
            color: b.gecikti ? '#A3271F' : '#3A4052',
          }}
        >
          Bekleyen: e-posta {b.eposta.onay} onay, {b.eposta.ret} ret · SMS {b.sms.onay} onay, {b.sms.ret} ret
          · en eskisi {tarih(b.enEski)}
          {b.gecikti ? ' · 3 iş günü doldu' : ''}
          {b.toplam > IYS_SINIR
            ? ` · ${b.toplam} izin ${Math.ceil(b.toplam / IYS_SINIR)} dosyaya bölünür, düğmeye her dosya için bir kez bas`
            : ''}
        </p>
      ) : null}
      {o?.paketler.length ? (
        <div style={{ marginTop: 12, overflowX: 'auto' }}>
          <div style={{ minWidth: 560 }}>
            {o.paketler.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 0.6fr) minmax(0, 1.4fr) minmax(0, 1.4fr) auto',
                  gap: 8,
                  alignItems: 'center',
                  padding: '9px 0',
                  borderTop: '1px solid #EEF0F5',
                  fontSize: 13,
                }}
              >
                <span style={{ fontWeight: 800 }}>Paket {p.no}</span>
                <span style={{ color: '#3A4052' }}>
                  {p.sayi} satır · {tarih(p.zaman)} · {p.indiren}
                </span>
                <span>
                  {p.yuklendi ? (
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        padding: '3px 9px',
                        borderRadius: 999,
                        background: '#E7FAF0',
                        color: '#11683F',
                      }}
                    >
                      Yüklendi · {tarih(p.yuklendi)}
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        padding: '3px 9px',
                        borderRadius: 999,
                        background: '#FFF6DF',
                        color: '#7A5200',
                      }}
                    >
                      İYS'ye yüklenmedi
                    </span>
                  )}
                </span>
                <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button type="button" style={ikincil} onClick={() => indir(p.id)}>
                    İndir
                  </button>
                  {p.yuklendi ? null : (
                    <button
                      type="button"
                      style={ikincil}
                      disabled={mesgul}
                      onClick={() =>
                        calistir(() => yonetim(`iys/paket/${p.id}/yuklendi`, { method: 'POST' }))
                      }
                    >
                      Yüklendi
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
