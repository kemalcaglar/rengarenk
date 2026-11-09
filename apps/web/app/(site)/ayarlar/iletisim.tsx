'use client';

import { CALL_HOURS_DEFAULT, demandOwnerName, saatYaz } from '@rengarenk/shared';
import { type CSSProperties, useState } from 'react';
import { istek } from '../../../lib/istemci';

export interface IletisimTercihi {
  phoneVisible: boolean;
  whatsappVisible: boolean;
  callFrom: number;
  callTo: number;
}

const kart: CSSProperties = { background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 18 };
const secim: CSSProperties = {
  border: '1px solid #D5DAE5',
  borderRadius: 10,
  padding: 10,
  fontSize: 14.5,
  background: '#FFFFFF',
  fontFamily: 'inherit',
};
const ikincil: CSSProperties = {
  border: '1px solid #D5DAE5',
  background: '#FFFFFF',
  borderRadius: 10,
  padding: '8px 12px',
  fontSize: 13.5,
  fontWeight: 700,
  color: '#1E2333',
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const satirStil: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  padding: '14px 0',
  borderTop: '1px solid #EEF0F5',
};

function Anahtar({ acik, ad, onClick }: { acik: boolean; ad: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={acik}
      aria-label={ad}
      onClick={onClick}
      style={{
        flex: 'none',
        width: 52,
        height: 30,
        border: 0,
        borderRadius: 999,
        background: acik ? '#5B8CFF' : '#C9CFDB',
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: acik ? 25 : 3,
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: '#FFFFFF',
        }}
      />
    </button>
  );
}

/**
 * Ayarlar › İletişim (Ayarlar.dc.html; Karar 29): Rengarenk mesajları her zaman açık; telefon ve WhatsApp izni,
 * aranabilir saatler. Yeni talepler bu ayarlarla açılır; her talepte ayrıca değişir.
 */
export function Iletisim({
  v,
  kaydet,
}: {
  v: IletisimTercihi;
  kaydet: (yeni: IletisimTercihi, mesaj: string) => void;
}) {
  const degis = (p: Partial<IletisimTercihi>, mesaj: string) => {
    const yeni = { ...v, ...p };
    // WhatsApp telefon numarası açıkken görünür
    if (!yeni.phoneVisible) yeni.whatsappVisible = false;
    kaydet(yeni, mesaj);
  };
  const satirlar: { ad: string; not: string; acik?: boolean; tikla?: () => void }[] = [
    { ad: 'Rengarenk mesajları', not: 'Satıcılar sana her zaman uygulama içinden yazabilir' },
    {
      ad: 'Telefon numaramı göster',
      not: 'Talep sayfasının sağındaki iletişim kutusunda görünür',
      acik: v.phoneVisible,
      tikla: () =>
        degis(
          { phoneVisible: !v.phoneVisible },
          v.phoneVisible ? 'Numaran yeni taleplerde gizli.' : 'Numaran yeni taleplerde görünecek.',
        ),
    },
    {
      ad: 'WhatsApp ile yazılabilsin',
      not: 'Telefon numaran açıkken WhatsApp düğmesi de görünür',
      acik: v.whatsappVisible,
      tikla: () =>
        degis(
          { whatsappVisible: !v.whatsappVisible, ...(!v.whatsappVisible ? { phoneVisible: true } : {}) },
          v.whatsappVisible ? 'WhatsApp düğmesi kapandı.' : 'WhatsApp düğmesi yeni taleplerde görünecek.',
        ),
    },
  ];
  const baslar = Array.from({ length: 24 }, (_, i) => i);
  const biter = Array.from({ length: 24 }, (_, i) => i + 1);
  return (
    <section style={{ ...kart, padding: 22 }} aria-labelledby="il">
      <h2 id="il" style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800 }}>
        İletişim tercihleri
      </h2>
      <p style={{ margin: '0 0 12px', fontSize: 13.5, color: '#5A6073' }}>
        Yeni talepler bu ayarlarla açılır. Her talepte ayrıca değiştirebilirsin.
      </p>
      {satirlar.map((s) => (
        <div key={s.ad} style={satirStil}>
          <span>
            <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{s.ad}</span>
            <span style={{ display: 'block', fontSize: 12.5, color: '#5A6073', marginTop: 2 }}>{s.not}</span>
          </span>
          {s.tikla ? (
            <Anahtar acik={Boolean(s.acik)} ad={s.ad} onClick={s.tikla} />
          ) : (
            <span style={{ flex: 'none', fontSize: 13, fontWeight: 700, color: '#5A6073' }}>
              Her zaman açık
            </span>
          )}
        </div>
      ))}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 10,
          padding: '14px 0 0',
          borderTop: '1px solid #EEF0F5',
        }}
      >
        <span style={{ flex: '999 1 220px' }}>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>Aranabileceğim saatler</span>
          <span style={{ display: 'block', fontSize: 12.5, color: '#5A6073', marginTop: 2 }}>
            Bu saatlerin dışında numaran talep sayfasında gizlenir
          </span>
        </span>
        <select
          aria-label="Başlangıç saati"
          value={v.callFrom}
          onChange={(e) => {
            const bas = Number(e.target.value);
            degis({ callFrom: bas, callTo: Math.max(v.callTo, bas + 1) }, 'Aranabilir saatlerin kaydedildi.');
          }}
          style={secim}
        >
          {baslar.map((h) => (
            <option key={h} value={h}>
              {saatYaz(h)}
            </option>
          ))}
        </select>
        <span aria-hidden="true">–</span>
        <select
          aria-label="Bitiş saati"
          value={v.callTo}
          onChange={(e) => {
            const bit = Number(e.target.value);
            degis(
              { callTo: bit, callFrom: Math.min(v.callFrom, bit - 1) },
              'Aranabilir saatlerin kaydedildi.',
            );
          }}
          style={secim}
        >
          {biter.map((h) => (
            <option key={h} value={h}>
              {h === 24 ? '24.00' : saatYaz(h)}
            </option>
          ))}
        </select>
      </div>
      {v.callFrom !== CALL_HOURS_DEFAULT.bas || v.callTo !== CALL_HOURS_DEFAULT.bit ? (
        <p style={{ margin: '10px 0 0', fontSize: 12.5, color: '#5A6073' }}>
          Varsayılan aralık {saatYaz(CALL_HOURS_DEFAULT.bas)}–{saatYaz(CALL_HOURS_DEFAULT.bit)}.
        </p>
      ) : null}
    </section>
  );
}

/** Profil › "Talep sayfalarında adın nasıl görünsün?" (Karar 29) */
export function GorunenAd({
  ad,
  soyad,
  secili,
  sec,
}: {
  ad: string;
  soyad: string;
  secili: 'tam' | 'kisa';
  sec: (m: 'tam' | 'kisa') => void;
}) {
  const ornek = (m: 'tam' | 'kisa') => demandOwnerName(ad || 'Ayşe', soyad || 'Yılmaz', m);
  const secenek: ['tam' | 'kisa', string][] = [
    ['tam', 'Adın ve soyadın tam görünür'],
    ['kisa', 'Soyadının yalnızca baş harfi görünür'],
  ];
  return (
    <>
      <span style={{ display: 'block', fontSize: 13, fontWeight: 700, margin: '18px 0 8px' }}>
        Talep sayfalarında adın nasıl görünsün?
      </span>
      <div role="radiogroup" aria-label="Görünen ad" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {secenek.map(([m, not]) => {
          const on = secili === m;
          return (
            // biome-ignore lint/a11y/useSemanticElements: tasarımdaki gibi iki satırlı seçim düğmesi (Ayarlar.dc.html)
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => sec(m)}
              style={{
                flex: '1 1 220px',
                textAlign: 'left',
                border: on ? '1.5px solid #5B8CFF' : '1px solid #D5DAE5',
                background: on ? '#EEF3FF' : '#FFFFFF',
                borderRadius: 12,
                padding: '12px 14px',
                cursor: 'pointer',
                color: '#1E2333',
                fontFamily: 'inherit',
              }}
            >
              <span style={{ display: 'block', fontSize: 15, fontWeight: 800 }}>{ornek(m)}</span>
              <span style={{ display: 'block', fontSize: 12.5, color: '#5A6073', marginTop: 2 }}>{not}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

/**
 * "Numarayı değiştir" (Yardim.dc.html: yeni numarana gelen SMS kodunu gir). Doğrulanınca diğer cihazlardaki oturumlar
 * kapanır; bu cihaz açık kalır.
 */
export function NumaraDegistir({ bitti }: { bitti: (mesaj: string) => void }) {
  const [acik, setAcik] = useState(false);
  const [tel, setTel] = useState('');
  const [kod, setKod] = useState('');
  const [ch, setCh] = useState<string | null>(null);
  const [devKod, setDevKod] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);

  async function adim(fn: () => Promise<void>) {
    setHata(null);
    setMesgul(true);
    try {
      await fn();
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setMesgul(false);
    }
  }

  if (!acik) {
    return (
      <button type="button" onClick={() => setAcik(true)} style={ikincil}>
        Numarayı değiştir
      </button>
    );
  }
  const girdi: CSSProperties = { ...secim, width: 190, padding: 8 };
  return (
    <div style={{ flex: '1 1 100%', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      {!ch ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            adim(async () => {
              const r = await istek<{ challengeId: string; devCode?: string }>('/me/phone/request', {
                method: 'POST',
                body: { phone: tel },
              });
              setCh(r.challengeId);
              setDevKod(r.devCode ?? null);
            });
          }}
          style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}
        >
          <label className="sr-only" htmlFor="yeni-tel">
            Yeni cep telefonu
          </label>
          <input
            id="yeni-tel"
            type="tel"
            inputMode="tel"
            required
            placeholder="05XX XXX XX XX"
            value={tel}
            onChange={(e) => setTel(e.target.value)}
            style={girdi}
          />
          <button type="submit" disabled={mesgul} style={ikincil}>
            Yeni numaraya kod gönder
          </button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            adim(async () => {
              const r = await istek<{ kapananOturum: number }>('/me/phone/verify', {
                method: 'POST',
                body: { challengeId: ch, code: kod },
              });
              setAcik(false);
              setCh(null);
              setTel('');
              setKod('');
              bitti(
                r.kapananOturum
                  ? `Numaran değişti. Diğer ${r.kapananOturum} cihazdaki oturumun kapandı.`
                  : 'Numaran değişti.',
              );
            });
          }}
          style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}
        >
          <label className="sr-only" htmlFor="yeni-kod">
            SMS kodu
          </label>
          <input
            id="yeni-kod"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            maxLength={6}
            placeholder="6 haneli kod"
            value={kod}
            onChange={(e) => setKod(e.target.value.replace(/\D/g, ''))}
            style={{ ...girdi, width: 140 }}
          />
          <button type="submit" disabled={mesgul} style={{ ...ikincil, background: '#5B8CFF', border: 0 }}>
            Doğrula
          </button>
          <span style={{ fontSize: 12.5, color: '#5A6073' }}>
            Yeni numarana kod gönderdik.{devKod ? ` Geliştirme kodu: ${devKod}` : ''}
          </span>
        </form>
      )}
      <button
        type="button"
        onClick={() => {
          setAcik(false);
          setCh(null);
          setHata(null);
        }}
        style={{ ...ikincil, border: 0, background: 'transparent', color: '#5A6073' }}
      >
        Vazgeç
      </button>
      {hata ? (
        <span role="alert" style={{ flex: '1 1 100%', color: '#A3271F', fontWeight: 700, fontSize: 13 }}>
          {hata}
        </span>
      ) : null}
    </div>
  );
}
