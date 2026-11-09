'use client';

import { AI_BUDGET } from '@rengarenk/shared';
import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';

interface Ozet {
  ay: string;
  saglayici: 'yok' | 'fake' | 'vertex';
  harcamaUsd: number;
  tahminUsd: number;
  sinirUsd: number;
  uyariOrani: number;
  sinirda: boolean;
  gorevler: { key: string; ad: string; kritik: boolean; acik: boolean; tutarUsd: number; cagri: number }[];
  maskeler: { key: string; ad: string; ornek: string; sonuc: string }[];
  gecmis: { once: number | null; sonra: number | null; kim: string; tarih: string }[];
}

const kart: CSSProperties = { background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 18 };
const usd = (n: number) =>
  new Intl.NumberFormat('tr-TR', { maximumFractionDigits: n >= 10 ? 0 : 2 }).format(n);
const kisa = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', timeZone: 'Europe/Istanbul' }).format(
    new Date(iso),
  );
const kucukBtn: CSSProperties = {
  width: 40,
  height: 40,
  border: '1px solid #D5DAE5',
  background: '#FFFFFF',
  borderRadius: 10,
  fontSize: 18,
  fontWeight: 800,
  color: '#1E2333',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

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
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Yapay zekâ ve bütçe</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#5A6073' }}>
          Aylık sınırı yalnızca sahip değiştirir; değişiklik anında geçerli olur ve işlem kaydına girer.
        </p>
      </div>
      {hata ? (
        <p role="alert" style={{ color: '#A3271F', fontWeight: 700 }}>
          {hata}
        </p>
      ) : null}
      {bilgi ? (
        <p role="status" style={{ color: '#11683F', fontWeight: 700 }}>
          {bilgi}
        </p>
      ) : null}
      {o && not ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
          <section
            aria-labelledby="butce"
            style={{ ...kart, flex: '1 1 340px', maxWidth: 420, minWidth: 0, padding: 18 }}
          >
            <h2 id="butce" style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#5A6073' }}>
              {o.ay} harcaması
            </h2>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 38, fontWeight: 800 }}>{usd(o.harcamaUsd)} USD</span>
              <span style={{ fontSize: 15, color: '#5A6073' }}>/ {o.sinirUsd} USD</span>
            </div>
            <div
              style={{
                position: 'relative',
                height: 12,
                borderRadius: 999,
                background: '#EEF0F5',
                marginTop: 10,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${Math.min(100, (o.harcamaUsd / sinir) * 100)}%`,
                  borderRadius: 999,
                  background: '#5B8CFF',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  top: -4,
                  bottom: -4,
                  left: `${Math.min(100, (o.tahminUsd / sinir) * 100)}%`,
                  width: 2,
                  background: '#1E2333',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  top: -4,
                  bottom: -4,
                  left: `${o.uyariOrani * 100}%`,
                  width: 2,
                  background: '#FFC84A',
                }}
              />
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                color: '#5A6073',
                marginTop: 6,
              }}
            >
              <span>Ay sonu tahmini {usd(o.tahminUsd)} USD (siyah çizgi)</span>
              <span>%{Math.round(o.uyariOrani * 100)} uyarı</span>
            </div>
            <div style={{ marginTop: 18, fontSize: 13, fontWeight: 700 }}>Aylık sınır</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <button
                type="button"
                aria-label="25 USD azalt"
                disabled={!sahip}
                onClick={() => setSinir((s) => Math.max(AI_BUDGET.enAzUsd, s - AI_BUDGET.adimUsd))}
                style={kucukBtn}
              >
                −
              </button>
              <span
                style={{
                  flex: 1,
                  textAlign: 'center',
                  border: '1px solid #D5DAE5',
                  borderRadius: 10,
                  padding: 9,
                  fontSize: 18,
                  fontWeight: 800,
                }}
              >
                {sinir} USD
              </span>
              <button
                type="button"
                aria-label="25 USD artır"
                disabled={!sahip}
                onClick={() => setSinir((s) => Math.min(AI_BUDGET.enCokUsd, s + AI_BUDGET.adimUsd))}
                style={kucukBtn}
              >
                +
              </button>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 12.5, color: not.renk, fontWeight: 700 }}>{not.yazi}</p>
            {sahip ? (
              <button
                type="button"
                onClick={kaydet}
                disabled={!degisti}
                style={{
                  width: '100%',
                  marginTop: 12,
                  border: 0,
                  background: '#5B8CFF',
                  borderRadius: 12,
                  padding: 11,
                  fontSize: 14,
                  fontWeight: 800,
                  color: '#1E2333',
                  cursor: degisti ? 'pointer' : 'default',
                  fontFamily: 'inherit',
                }}
              >
                Sınırı kaydet
              </button>
            ) : (
              <p style={{ margin: '12px 0 0', fontSize: 12.5, color: '#5A6073' }}>
                Sınırı yalnızca sahip değiştirebilir.
              </p>
            )}
            <p style={{ margin: '12px 0 0', fontSize: 12, lineHeight: 1.5, color: '#5A6073' }}>
              Sınıra ulaşınca yalnızca kritik görevler (dolandırıcılık ve güvenlik, ödeme hataları, kanal
              yedeğe geçişi) çalışır; diğerleri ay sonuna kadar ya da sınır artırılana kadar durur.
            </p>
            <h3 style={{ margin: '14px 0 6px', fontSize: 13, fontWeight: 800 }}>Değişiklik geçmişi</h3>
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
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '6px 0',
                  borderTop: '1px solid #EEF0F5',
                  fontSize: 12.5,
                }}
              >
                <span>{g.ad}</span>
                <span style={{ color: '#5A6073' }}>{g.kim}</span>
              </div>
            ))}
          </section>

          <section
            aria-labelledby="gorev"
            style={{ ...kart, flex: '999 1 420px', minWidth: 0, overflow: 'hidden' }}
          >
            <h2
              id="gorev"
              style={{
                margin: 0,
                padding: '16px 18px',
                fontSize: 17,
                fontWeight: 800,
                borderBottom: '1px solid #EEF0F5',
              }}
            >
              Görevlere göre harcama · {o.ay}
            </h2>
            {o.gorevler.map((g) => (
              <div
                key={g.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 18px',
                  borderBottom: '1px solid #EEF0F5',
                }}
              >
                <span style={{ flex: '0 0 210px', minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 800 }}>{g.ad}</span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 11.5,
                      color: g.kritik ? '#11683F' : '#5A6073',
                      fontWeight: 700,
                    }}
                  >
                    {g.kritik ? 'Kritik · sınırda da çalışır' : 'Sınırda durur'}
                  </span>
                </span>
                <span style={{ flex: 1, minWidth: 0, height: 12 }}>
                  <span
                    title={`${g.ad}: ${g.tutarUsd} USD · ${g.cagri} çağrı`}
                    style={{
                      display: 'block',
                      height: 12,
                      width: `${enCok ? ((g.tutarUsd / enCok) * 100).toFixed(1) : 0}%`,
                      background: g.acik ? '#5B8CFF' : '#D5DAE5',
                      borderRadius: '0 4px 4px 0',
                    }}
                  />
                </span>
                <span style={{ flex: '0 0 64px', textAlign: 'right', fontSize: 13.5, fontWeight: 800 }}>
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
                  style={{
                    flex: 'none',
                    border: 0,
                    background: 'transparent',
                    padding: 0,
                    cursor: sahip ? 'pointer' : 'default',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      width: 36,
                      height: 22,
                      borderRadius: 999,
                      background: g.acik ? '#3DD68C' : '#D5DAE5',
                      position: 'relative',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: 3,
                        left: g.acik ? 17 : 3,
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: '#FFFFFF',
                        boxShadow: '0 1px 2px rgba(30,35,51,0.3)',
                      }}
                    />
                  </span>
                </button>
              </div>
            ))}
            <h3 style={{ margin: 0, padding: '14px 18px 6px', fontSize: 14, fontWeight: 800 }}>
              Maskeleme kuralları
            </h3>
            <p style={{ margin: 0, padding: '0 18px 8px', fontSize: 12.5, color: '#5A6073' }}>
              Kişisel veri yapay zekâ sağlayıcısına maskelenmeden gitmez. Sağlayıcı: Google Vertex AI
              (Gemini), tüm görevlerde.
              {o.saglayici !== 'vertex'
                ? ' Sağlayıcı henüz bağlı değil; ajan kurallarla hazırlanan metinleri kullanıyor.'
                : ''}
            </p>
            {o.maskeler.map((m) => (
              <div
                key={m.key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr) minmax(0, 1fr)',
                  gap: 8,
                  padding: '8px 18px',
                  borderTop: '1px solid #EEF0F5',
                  fontSize: 12.5,
                }}
              >
                <span style={{ fontWeight: 700 }}>{m.ad}</span>
                <span style={{ color: '#5A6073' }}>{m.ornek}</span>
                <span style={{ fontWeight: 800, color: '#4B2FA6' }}>{m.sonuc}</span>
              </div>
            ))}
            <div style={{ height: 8 }} />
          </section>
        </div>
      ) : null}
    </>
  );
}
