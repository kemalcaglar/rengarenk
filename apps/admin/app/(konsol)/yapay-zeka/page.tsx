'use client';

import { AI_BUDGET } from '@rengarenk/shared';
import { useCallback, useEffect, useState } from 'react';
import { cx } from '../../../lib/cx';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';
import stil from './page.module.css';

interface Ozet {
  ay: string;
  saglayici: 'yok' | 'fake' | 'bedrock' | 'vertex';
  harcamaUsd: number;
  tahminUsd: number;
  sinirUsd: number;
  uyariOrani: number;
  sinirda: boolean;
  gorevler: { key: string; ad: string; kritik: boolean; acik: boolean; tutarUsd: number; cagri: number }[];
  maskeler: { key: string; ad: string; ornek: string; sonuc: string }[];
  gecmis: { once: number | null; sonra: number | null; kim: string; tarih: string }[];
}

const usd = (n: number) =>
  new Intl.NumberFormat('tr-TR', { maximumFractionDigits: n >= 10 ? 0 : 2 }).format(n);
const kisa = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', timeZone: 'Europe/Istanbul' }).format(
    new Date(iso),
  );

/**
 * Yapay zekâ ve bütçe (YonetimSistem.dc.html › yz; Karar 57): ayın harcaması ve ay sonu tahmini, aylık sınır (yalnızca
 * sahip), görevlere göre harcama ve görev anahtarları, maskeleme kuralları.
 */
export default function YapayZeka() {
  const { me } = useKonsol();
  const [o, setO] = useState<Ozet | null>(null);
  const [sinir, setSinir] = useState<number>(AI_BUDGET.baslangicUsd);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const sahip = me.role === 'OWNER';

  const yukle = useCallback(() => {
    yonetim<Ozet>('ai')
      .then((r) => {
        setO(r);
        setSinir(r.sinirUsd);
      })
      .catch((e: Error) => setHata(e.message));
  }, []);
  useEffect(yukle, [yukle]);

  async function kaydet() {
    setHata(null);
    try {
      await yonetim('ai/limit', { method: 'POST', body: { limitUsd: sinir } });
      setBilgi(`Aylık yapay zekâ sınırı ${sinir} USD olarak kaydedildi; hemen geçerli.`);
      yukle();
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function gorev(key: string, enabled: boolean) {
    setHata(null);
    try {
      await yonetim(`ai/tasks/${key}`, { method: 'POST', body: { enabled } });
      yukle();
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  const degisti = o ? sinir !== o.sinirUsd : false;
  const not = !o
    ? ''
    : sinir < o.tahminUsd
      ? {
          yazi: 'Bu sınırla ay sonundan önce sınıra ulaşılır; kritik olmayan görevler durur.',
          renk: '#A3271F',
        }
      : degisti
        ? { yazi: `Kaydedilmedi · önceki sınır ${o.sinirUsd} USD`, renk: '#7A5300' }
        : { yazi: 'Ay sonu tahmini sınırın altında', renk: '#11683F' };
  const enCok = o ? Math.max(...o.gorevler.map((g) => g.tutarUsd), 0) : 0;

  return (
    <>
      <div className={stil.kutu1}>
        <h1 className={stil.baslik1}>Yapay zekâ ve bütçe</h1>
        <p className={stil.metin1}>
          Aylık sınırı yalnızca sahip değiştirir; değişiklik anında geçerli olur ve işlem kaydına girer.
        </p>
      </div>
      {hata ? (
        <p role="alert" className={stil.metin2}>
          {hata}
        </p>
      ) : null}
      {bilgi ? (
        <p role="status" className={stil.metin3}>
          {bilgi}
        </p>
      ) : null}
      {o && not ? (
        <div className={stil.kutu2}>
          <section aria-labelledby="butce" className={stil.kutu3}>
            <h2 id="butce" className={stil.baslik2}>
              {o.ay} harcaması
            </h2>
            <div className={stil.kutu4}>
              <span className={stil.metin4}>{usd(o.harcamaUsd)} USD</span>
              <span className={stil.metin5}>/ {o.sinirUsd} USD</span>
            </div>
            <div className={stil.kutu5}>
              <span
                className={stil.metin6}
                style={{ width: `${Math.min(100, (o.harcamaUsd / sinir) * 100)}%` }}
              />
              <span
                className={stil.metin7}
                style={{ left: `${Math.min(100, (o.tahminUsd / sinir) * 100)}%` }}
              />
              <span className={stil.metin8} style={{ left: `${o.uyariOrani * 100}%` }} />
            </div>
            <div className={stil.kutu6}>
              <span>Ay sonu tahmini {usd(o.tahminUsd)} USD (siyah çizgi)</span>
              <span>%{Math.round(o.uyariOrani * 100)} uyarı</span>
            </div>
            <div className={stil.kutu7}>Aylık sınır</div>
            <div className={stil.kutu8}>
              <button
                type="button"
                aria-label="25 USD azalt"
                disabled={!sahip}
                onClick={() => setSinir((s) => Math.max(AI_BUDGET.enAzUsd, s - AI_BUDGET.adimUsd))}
                className={stil.dugme1}
              >
                −
              </button>
              <span className={stil.metin9}>{sinir} USD</span>
              <button
                type="button"
                aria-label="25 USD artır"
                disabled={!sahip}
                onClick={() => setSinir((s) => Math.min(AI_BUDGET.enCokUsd, s + AI_BUDGET.adimUsd))}
                className={stil.dugme1}
              >
                +
              </button>
            </div>
            <p className={stil.metin10} style={{ color: not.renk }}>
              {not.yazi}
            </p>
            {sahip ? (
              <button
                type="button"
                onClick={kaydet}
                disabled={!degisti}
                className={cx(stil.dugme2, degisti ? stil.dugme3 : stil.dugme4)}
              >
                Sınırı kaydet
              </button>
            ) : (
              <p className={stil.metin11}>Sınırı yalnızca sahip değiştirebilir.</p>
            )}
            <p className={stil.metin12}>
              Sınıra ulaşınca yalnızca kritik görevler (dolandırıcılık ve güvenlik, ödeme hataları, kanal
              yedeğe geçişi) çalışır; diğerleri ay sonuna kadar ya da sınır artırılana kadar durur.
            </p>
            <h3 className={stil.baslik3}>Değişiklik geçmişi</h3>
            {[
              ...o.gecmis.map((g) => ({
                ad: `${g.once} → ${g.sonra} USD`,
                kim: `${g.kim} · ${kisa(g.tarih)}`,
              })),
              { ad: `Başlangıç sınırı ${AI_BUDGET.baslangicUsd} USD`, kim: 'Kurulum' },
            ].map((g, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: geçmiş satırları sabit sıralı
                key={i}
                className={stil.kutu9}
              >
                <span>{g.ad}</span>
                <span className={stil.metin13}>{g.kim}</span>
              </div>
            ))}
          </section>

          <section aria-labelledby="gorev" className={stil.kutu10}>
            <h2 id="gorev" className={stil.baslik4}>
              Görevlere göre harcama · {o.ay}
            </h2>
            {o.gorevler.map((g) => (
              <div key={g.key} className={stil.kutu11}>
                <span className={stil.metin14}>
                  <span className={stil.metin15}>{g.ad}</span>
                  <span className={cx(stil.metin16, g.kritik ? stil.metin17 : stil.metin13)}>
                    {g.kritik ? 'Kritik · sınırda da çalışır' : 'Sınırda durur'}
                  </span>
                </span>
                <span className={stil.metin18}>
                  <span
                    title={`${g.ad}: ${g.tutarUsd} USD · ${g.cagri} çağrı`}
                    className={cx(stil.metin19, g.acik ? stil.metin20 : stil.metin21)}
                    style={{ width: `${enCok ? ((g.tutarUsd / enCok) * 100).toFixed(1) : 0}%` }}
                  />
                </span>
                <span className={stil.metin22}>
                  {new Intl.NumberFormat('tr-TR', {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  }).format(g.tutarUsd)}{' '}
                  $
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={g.acik}
                  aria-label={`${g.ad} görevini aç veya kapat`}
                  disabled={!sahip}
                  onClick={() => gorev(g.key, !g.acik)}
                  className={cx(stil.dugme5, sahip ? stil.dugme3 : stil.dugme4)}
                >
                  <span className={cx(stil.metin23, g.acik ? stil.metin24 : stil.metin21)}>
                    <span className={cx(stil.metin25, g.acik ? stil.metin26 : stil.metin27)} />
                  </span>
                </button>
              </div>
            ))}
            <h3 className={stil.baslik5}>Maskeleme kuralları</h3>
            <p className={stil.metin28}>
              Kişisel veri yapay zekâ sağlayıcısına maskelenmeden gitmez. Sağlayıcı: AWS Bedrock (Amazon Nova,
              AB bölgesi), tüm görevlerde.
              {o.saglayici === 'yok' || o.saglayici === 'fake'
                ? ' Sağlayıcı henüz bağlı değil; ajan kurallarla hazırlanan metinleri kullanıyor.'
                : ''}
            </p>
            {o.maskeler.map((m) => (
              <div key={m.key} className={stil.kutu12}>
                <span className={stil.metin29}>{m.ad}</span>
                <span className={stil.metin13}>{m.ornek}</span>
                <span className={stil.metin30}>{m.sonuc}</span>
              </div>
            ))}
            <div className={stil.kutu13} />
          </section>
        </div>
      ) : null}
    </>
  );
}
