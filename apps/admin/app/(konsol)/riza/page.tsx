'use client';

import { useEffect, useState } from 'react';
import { cx } from '../../../lib/cx';
import { tarih, yonetim } from '../../../lib/istemci';
import stil from './page.module.css';

interface Gecmis {
  kisi: { ad: string; userId: string } | null;
  gecmis: { ad: string; durum: 'Verdi' | 'Vermedi'; surum: string; zaman: string; kanal: string }[];
}
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
      <div className={stil.kutu1}>
        <h1 className={stil.baslik1}>Rıza ve çerez kayıtları</h1>
        <p className={stil.metin1}>
          Her rıza tarih, metin sürümü ve kanalıyla saklanır. Ticari ileti izinleri İYS'ye CSV ile yüklenir.
        </p>
      </div>
      {hata ? <p className={stil.metin2}>{hata}</p> : null}
      {sayilar ? (
        <div className={stil.kutu2}>
          {sayilar.map((s) => (
            <div key={s.ad} className={stil.kutu3}>
              <div className={stil.kutu4}>{s.ad}</div>
              <div className={stil.kutu5}>{s.deger}</div>
              <div className={stil.kutu6}>{s.not}</div>
            </div>
          ))}
        </div>
      ) : null}
      <IysAktarim />
      <section aria-labelledby="rizag" className={stil.kutu7}>
        <div className={stil.kutu8}>
          <h2 id="rizag" className={stil.baslik2}>
            {g?.kisi ? `${g.kisi.ad} · rıza geçmişi` : 'Rıza geçmişi'}
          </h2>
          <input
            type="search"
            aria-label="Kullanıcı ara"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ad ya da telefonun son haneleri"
            className={stil.girdi1}
          />
        </div>
        <div className={stil.kutu9}>
          <div className={stil.kutu10}>
            <div className={stil.kutu11}>
              <span>Rıza</span>
              <span>Durum</span>
              <span>Metin sürümü</span>
              <span>Tarih ve kanal</span>
            </div>
            {!g ? (
              <p className={stil.metin3}>
                Bir kişinin rıza geçmişini görmek için adını ya da telefonunun son hanelerini yaz.
              </p>
            ) : !g.kisi ? (
              <p className={stil.metin3}>Kişi bulunamadı.</p>
            ) : (
              g.gecmis.map((r, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: geçmiş sırası sabit
                  key={i}
                  className={stil.kutu12}
                >
                  <span className={stil.metin4}>{r.ad}</span>
                  <span>
                    <span className={cx(stil.metin5, r.durum === 'Verdi' ? stil.metin6 : stil.metin7)}>
                      {r.durum}
                    </span>
                  </span>
                  <span>{r.surum}</span>
                  <span className={stil.metin8}>
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
    mesaj: { onay: number; ret: number };
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

/**
 * İYS'ye elle aktarım: izin değişince kanal başına (e-posta; eski SMS onaylarının retleri mesaj) satır birikir; "CSV'yi hazırla" en eski 50 satırı
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
    <section aria-labelledby="iysg" className={stil.kutu13}>
      <div className={stil.kutu14}>
        <div>
          <h2 id="iysg" className={stil.baslik2}>
            İYS'ye aktarım
          </h2>
          <p className={stil.metin9}>
            Ticari ileti onayı ya da reti 3 iş günü içinde İYS'ye yüklenmeli. Gün sonunda CSV dosyasını indir,
            İYS Web'de İzin Ekle › Dosyadan Çoklu İzin Yükle ekranından "Bireysel" olarak yükle, sonra paketi
            "Yüklendi" diye işaretle. İYS bir dosyada en fazla {IYS_SINIR} izin alır; her paket bir dosyadır.
            Ticari e-posta yalnızca İYS'de onayı olan, yani paketi "Yüklendi" işaretlenmiş kişilere gider;
            "Yüklendi"ye dosya İYS'de başarıyla yüklendikten sonra bas.
          </p>
        </div>
        <button
          type="button"
          className={cx(stil.dugme1, !b?.toplam || mesgul ? stil.dugme2 : stil.dugme3)}
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
      {hata ? <p className={stil.metin10}>{hata}</p> : null}
      {b?.toplam ? (
        <p className={cx(stil.metin11, b.gecikti ? stil.metin12 : stil.metin8)}>
          Bekleyen: e-posta {b.eposta.onay} onay, {b.eposta.ret} ret · mesaj {b.mesaj.onay} onay,{' '}
          {b.mesaj.ret} ret · en eskisi {tarih(b.enEski)}
          {b.gecikti ? ' · 3 iş günü doldu' : ''}
          {b.toplam > IYS_SINIR
            ? ` · ${b.toplam} izin ${Math.ceil(b.toplam / IYS_SINIR)} dosyaya bölünür, düğmeye her dosya için bir kez bas`
            : ''}
        </p>
      ) : null}
      {o?.paketler.length ? (
        <div className={stil.kutu15}>
          <div className={stil.kutu16}>
            {o.paketler.map((p) => (
              <div key={p.id} className={stil.kutu17}>
                <span className={stil.metin13}>Paket {p.no}</span>
                <span className={stil.metin8}>
                  {p.sayi} satır · {tarih(p.zaman)} · {p.indiren}
                </span>
                <span>
                  {p.yuklendi ? (
                    <span className={stil.metin14}>Yüklendi · {tarih(p.yuklendi)}</span>
                  ) : (
                    <span className={stil.metin15}>İYS'ye yüklenmedi</span>
                  )}
                </span>
                <span className={stil.metin16}>
                  <button type="button" className={stil.dugme4} onClick={() => indir(p.id)}>
                    İndir
                  </button>
                  {p.yuklendi ? null : (
                    <button
                      type="button"
                      className={stil.dugme4}
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
